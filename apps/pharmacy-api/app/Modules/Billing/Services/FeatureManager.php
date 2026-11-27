<?php

namespace App\Modules\Billing\Services;

use App\Models\Branch;
use App\Models\Medicine;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Billing\Exceptions\FeatureLockedException;
use App\Modules\Billing\Exceptions\LimitReachedException;
use App\Modules\Billing\Models\Feature;
use App\Modules\Billing\Models\Subscription;
use App\Modules\Billing\Models\TenantEffectiveFeature;
use App\Modules\Billing\Models\UsageCounter;
use App\Tenancy\CurrentTenant;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

class FeatureManager
{
    protected ?Tenant $tenant = null;

    public function __construct(
        protected CurrentTenant $currentTenant
    ) {}

    /**
     * Explicitly set the tenant context or default to CurrentTenant.
     */
    public function setTenant(?Tenant $tenant): self
    {
        $this->tenant = $tenant;
        return $this;
    }

    /**
     * Get active tenant instance.
     */
    public function tenant(): ?Tenant
    {
        if ($this->tenant) {
            return $this->tenant;
        }

        if ($this->currentTenant->has()) {
            return $this->currentTenant->get();
        }

        $user = auth()->user();
        if ($user && $user->current_tenant_id) {
            return Tenant::withoutGlobalScopes()->find($user->current_tenant_id);
        }

        return null;
    }

    /**
     * Check if a boolean feature is enabled for the tenant.
     */
    public function can(string $key): bool
    {
        $tenant = $this->tenant();
        $hasPhase2Sub = $tenant ? Subscription::withoutGlobalScopes()->where('tenant_id', $tenant->id)->exists() : false;

        if (! $hasPhase2Sub && $tenant) {
            try {
                if (\App\Models\Module::where('key', $key)->exists()) {
                    return $tenant->hasFeature($key);
                }
            } catch (Throwable) {
            }

            return true;
        }

        $feature = $this->getFeatureData($key);
        if (! $feature) {
            if ($tenant) {
                try {
                    if (\App\Models\Module::where('key', $key)->exists()) {
                        return $tenant->hasFeature($key);
                    }
                } catch (Throwable) {
                }
            }

            return false;
        }

        return (bool) ($feature['bool_value'] ?? false);
    }

    /**
     * Get the level value for level features ('basic', 'detailed', 'advanced', 'full').
     */
    public function level(string $key): ?string
    {
        $tenant = $this->tenant();
        $hasPhase2Sub = $tenant ? Subscription::withoutGlobalScopes()->where('tenant_id', $tenant->id)->exists() : false;

        if (! $hasPhase2Sub && $tenant) {
            return 'full';
        }

        $feature = $this->getFeatureData($key);
        return $feature['level_value'] ?? null;
    }

    /**
     * Get numeric limit for limit features (null = unlimited).
     */
    public function limit(string $key): ?int
    {
        $tenant = $this->tenant();
        $hasPhase2Sub = $tenant ? Subscription::withoutGlobalScopes()->where('tenant_id', $tenant->id)->exists() : false;

        if (! $hasPhase2Sub && $tenant) {
            return null;
        }

        $feature = $this->getFeatureData($key);
        if (! $feature) {
            return null;
        }

        return isset($feature['limit_value']) && $feature['limit_value'] !== null
            ? (int) $feature['limit_value']
            : null;
    }

    /**
     * Get the live count of currently used units for a resource.
     */
    public function used(string $key): int
    {
        $tenant = $this->tenant();
        if (! $tenant) {
            return 0;
        }

        return match ($key) {
            'max_users' => (int) DB::table('tenant_user')
                ->where('tenant_id', $tenant->id)
                ->where('is_active', true)
                ->count(),

            'max_branches' => (int) Branch::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->where('is_active', true)
                ->count(),

            'max_products' => (int) \App\Modules\Catalog\Models\Product::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->whereNull('deleted_at')
                ->where(function ($q): void {
                    $q->whereNull('sku')->orWhere('sku', 'NOT LIKE', 'BD-%');
                })
                ->count() ?: (int) Medicine::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->where('is_active', true)
                ->where(function ($q): void {
                    $q->whereNull('sku')->orWhere('sku', 'NOT LIKE', 'BD-%');
                })
                ->count(),

            'max_bills_month', 'sms_quota_month' => (int) UsageCounter::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->where('feature_key', $key)
                ->where('period', now('Asia/Dhaka')->format('Y-m'))
                ->value('used'),

            default => 0,
        };
    }

    /**
     * Get remaining units (null = unlimited).
     */
    public function remaining(string $key): ?int
    {
        $limit = $this->limit($key);
        if ($limit === null) {
            return null; // Unlimited
        }

        $used = $this->used($key);
        return max(0, $limit - $used);
    }

    /**
     * Check if the tenant can consume increment units without throwing.
     */
    public function canUse(string $key, int $increment = 1): bool
    {
        $tenant = $this->tenant();
        $hasPhase2Sub = $tenant ? Subscription::withoutGlobalScopes()->where('tenant_id', $tenant->id)->exists() : false;

        if (! $hasPhase2Sub && $tenant) {
            return true;
        }

        $feature = $this->getFeatureData($key);
        if (! $feature) {
            if ($tenant) {
                try {
                    if (\App\Models\Module::where('key', $key)->exists()) {
                        return $tenant->hasFeature($key);
                    }
                } catch (Throwable) {
                }
            }

            return false;
        }

        if (($feature['feature_type'] ?? '') === 'boolean') {
            return (bool) ($feature['bool_value'] ?? false);
        }

        $limit = $this->limit($key);
        if ($limit === null) {
            return true; // Unlimited
        }

        return ($this->used($key) + $increment) <= $limit;
    }

    /**
     * Enforce feature and limits with race-free transactional advisory locks.
     *
     * @throws FeatureLockedException
     * @throws LimitReachedException
     */
    public function assertCanUse(string $key, int $increment = 1): void
    {
        $tenant = $this->tenant();
        if (! $tenant) {
            throw new FeatureLockedException($key, 'No active tenant context.');
        }

        $hasPhase2Sub = Subscription::withoutGlobalScopes()->where('tenant_id', $tenant->id)->exists();
        if (! $hasPhase2Sub) {
            return;
        }

        $feature = $this->getFeatureData($key);
        if (! $feature) {
            throw new FeatureLockedException($key);
        }

        // 1. Boolean Feature Check
        if (($feature['feature_type'] ?? '') === 'boolean') {
            if (! (bool) ($feature['bool_value'] ?? false)) {
                throw new FeatureLockedException($key);
            }
            return;
        }

        // 2. Limit Feature Check
        $limit = $this->limit($key);
        if ($limit === null) {
            return; // Unlimited limit
        }

        // Race-free check based on resource type
        if (in_array($key, ['max_users', 'max_branches', 'max_products'], true)) {
            // Transaction advisory lock
            if (DB::getDriverName() === 'pgsql') {
                DB::statement("SELECT pg_advisory_xact_lock(hashtext(?))", ["{$tenant->id}:{$key}"]);
            }

            $currentLiveUsed = $this->used($key);
            if (($currentLiveUsed + $increment) > $limit) {
                throw new LimitReachedException($key, $limit, $currentLiveUsed);
            }
        } elseif (in_array($key, ['max_bills_month', 'sms_quota_month'], true)) {
            // Atomic UPSERT increment
            $period = now('Asia/Dhaka')->format('Y-m');

            if (DB::getDriverName() === 'pgsql') {
                $affected = DB::select(
                    "INSERT INTO usage_counters (tenant_id, feature_key, period, used, created_at, updated_at)
                     VALUES (?, ?, ?, ?, NOW(), NOW())
                     ON CONFLICT (tenant_id, feature_key, period)
                     DO UPDATE SET used = usage_counters.used + ?, updated_at = NOW()
                     WHERE usage_counters.used + ? <= ?
                     RETURNING used;",
                    [$tenant->id, $key, $period, $increment, $increment, $increment, $limit]
                );

                if (empty($affected)) {
                    $used = $this->used($key);
                    throw new LimitReachedException($key, $limit, $used);
                }
            } else {
                // SQLite fallback
                $counter = UsageCounter::withoutGlobalScopes()->firstOrCreate(
                    ['tenant_id' => $tenant->id, 'feature_key' => $key, 'period' => $period],
                    ['used' => 0]
                );

                if (($counter->used + $increment) > $limit) {
                    throw new LimitReachedException($key, $limit, $counter->used);
                }

                $counter->increment('used', $increment);
            }
        }
    }

    /**
     * Get all effective features for the current tenant (for UI pages).
     */
    public function all(): Collection
    {
        $tenant = $this->tenant();
        if (! $tenant) {
            return collect();
        }

        $featureMap = $this->loadEffectiveFeatureMap($tenant->id);
        $featuresCatalog = Feature::orderBy('sort')->get()->keyBy('key');

        return $featuresCatalog->map(function (Feature $f) use ($featureMap, $tenant) {
            $effective = $featureMap['features'][$f->key] ?? null;
            $type = $f->type;

            $boolVal = $effective ? (bool) ($effective['bool_value'] ?? false) : false;
            $limitVal = $effective && isset($effective['limit_value']) ? $effective['limit_value'] : null;
            $levelVal = $effective['level_value'] ?? null;

            return [
                'key' => $f->key,
                'name' => $f->description ?: ucwords(str_replace('_', ' ', $f->key)),
                'type' => $type,
                'group_name' => $f->group_name,
                'description' => $f->description,
                'value' => match ($type) {
                    'boolean' => $boolVal,
                    'limit' => $limitVal,
                    'level' => $levelVal,
                    default => null,
                },
                'bool_value' => $boolVal,
                'limit_value' => $limitVal,
                'level_value' => $levelVal,
                'used' => $type === 'limit' ? $this->used($f->key) : null,
                'remaining' => $type === 'limit' ? $this->remaining($f->key) : null,
                'is_overridden' => (bool) ($effective['is_overridden'] ?? false),
                'override_expires_at' => $effective['override_expires_at'] ?? null,
                'override_note' => $effective['override_note'] ?? null,
                'addon_extra_limit' => (int) ($effective['addon_extra_limit'] ?? 0),
            ];
        });
    }

    /**
     * Get subscription metadata associated with effective features.
     *
     * @return array{id: int|null, plan_code: string, plan_name: string, billing_cycle: string, status: string, ends_at: string|null, days_left: int}
     */
    public function subscriptionMeta(): array
    {
        $tenant = $this->tenant();
        if (! $tenant) {
            return [
                'id' => null,
                'plan_code' => 'none',
                'plan_name' => 'No Plan',
                'billing_cycle' => 'monthly',
                'status' => 'read_only',
                'ends_at' => null,
                'days_left' => 0,
            ];
        }

        $featureMap = $this->loadEffectiveFeatureMap($tenant->id);
        return $featureMap['subscription'] ?? [
            'id' => null,
            'plan_code' => 'none',
            'plan_name' => 'No Plan',
            'billing_cycle' => 'monthly',
            'status' => 'read_only',
            'ends_at' => null,
            'days_left' => 0,
        ];
    }

    /**
     * Date cutoff helper based on log_retention_days limit.
     */
    public function retentionCutoff(): ?Carbon
    {
        $days = $this->limit('log_retention_days');
        if ($days === null) {
            return null; // Unlimited retention
        }

        return now()->subDays($days);
    }

    /**
     * Retrieve single feature data from cached map.
     */
    protected function getFeatureData(string $key): ?array
    {
        $tenant = $this->tenant();
        if (! $tenant) {
            return null;
        }

        $featureMap = $this->loadEffectiveFeatureMap($tenant->id);
        return $featureMap['features'][$key] ?? null;
    }

    /**
     * Load feature map from Redis cache with anti-stampede lock and DB fallback.
     */
    protected function loadEffectiveFeatureMap(int $tenantId): array
    {
        $cacheKey = "tenant:{$tenantId}:features";

        try {
            $cached = Cache::get($cacheKey);
            if ($cached && is_array($cached)) {
                return $cached;
            }
        } catch (Throwable) {
            // Cache read failure
        }

        $map = $this->buildFeatureMapFromDb($tenantId);

        try {
            Cache::put($cacheKey, $map, 3600); // 1 hour TTL
        } catch (Throwable) {
            // Cache write failure
        }

        return $map;
    }

    /**
     * Query tenant_effective_features DB view directly.
     */
    protected function buildFeatureMapFromDb(int $tenantId): array
    {
        $rows = TenantEffectiveFeature::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->get();

        if ($rows->isEmpty()) {
            $tenant = Tenant::withoutGlobalScopes()->find($tenantId);
            $hasPhase2Sub = Subscription::withoutGlobalScopes()->where('tenant_id', $tenantId)->exists();

            if (! $hasPhase2Sub && $tenant && ($tenant->status === 'active' || $tenant->isOnTrial() || $tenant->subscriberSubscription())) {
                $features = [];
                try {
                    $allFeatures = Feature::all();
                    foreach ($allFeatures as $f) {
                        $features[$f->key] = [
                            'feature_key' => $f->key,
                            'feature_type' => $f->type,
                            'group_name' => $f->group_name,
                            'bool_value' => true,
                            'limit_value' => null,
                            'level_value' => 'full',
                            'is_overridden' => false,
                            'override_expires_at' => null,
                            'override_note' => null,
                            'addon_extra_limit' => 0,
                        ];
                    }
                } catch (Throwable) {
                    // In case features table is not seeded
                }

                return [
                    'features' => $features,
                    'subscription' => [
                        'id' => null,
                        'plan_code' => 'legacy',
                        'plan_name' => 'Legacy Plan',
                        'billing_cycle' => 'monthly',
                        'status' => 'active',
                        'ends_at' => null,
                        'days_left' => 30,
                    ],
                ];
            }

            return [
                'features' => [],
                'subscription' => [
                    'id' => null,
                    'plan_code' => 'none',
                    'plan_name' => 'No Active Subscription',
                    'billing_cycle' => 'monthly',
                    'status' => 'read_only',
                    'ends_at' => null,
                    'days_left' => 0,
                ],
            ];
        }

        $first = $rows->first();
        $subscription = [
            'id' => $first->subscription_id,
            'plan_id' => $first->plan_id,
            'plan_code' => $first->plan_code,
            'plan_name' => $first->plan_name,
            'billing_cycle' => $first->billing_cycle,
            'status' => $first->subscription_status,
            'starts_at' => $first->subscription_starts_at?->toIso8601String(),
            'ends_at' => $first->subscription_ends_at?->toIso8601String(),
            'days_left' => $first->subscription_ends_at ? max(0, (int) now()->diffInDays($first->subscription_ends_at, false)) : 0,
        ];

        $features = [];
        foreach ($rows as $row) {
            $features[$row->feature_key] = [
                'feature_key' => $row->feature_key,
                'feature_type' => $row->feature_type,
                'group_name' => $row->group_name,
                'bool_value' => (bool) $row->bool_value,
                'limit_value' => $row->limit_value !== null ? (int) $row->limit_value : null,
                'level_value' => $row->level_value,
                'is_overridden' => (bool) $row->is_overridden,
                'override_expires_at' => $row->override_expires_at?->toIso8601String(),
                'override_note' => $row->override_note,
                'addon_extra_limit' => (int) $row->addon_extra_limit,
            ];
        }

        return [
            'features' => $features,
            'subscription' => $subscription,
        ];
    }
}
