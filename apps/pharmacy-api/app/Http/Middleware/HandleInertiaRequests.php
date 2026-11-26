<?php

namespace App\Http\Middleware;

use App\Enums\TenantRole;
use App\Models\Branch;
use App\Models\Scopes\TenantScope;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        if (file_exists(public_path('hot'))) {
            return 'dev-hot';
        }

        return parent::version($request);
    }

    /**
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        /** @var Tenant|null $domainTenant */
        $domainTenant = $request->attributes->get(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE);
        $isAdminDomain = (bool) $request->attributes->get(IdentifyTenantFromDomain::ADMIN_ATTRIBUTE);
        $host = TenantDomain::stripPort($request->getHost());
        $port = $request->getPort();
        $portSuffix = $port && ! in_array($port, [80, 443], true) ? ":{$port}" : '';

        return [
            ...parent::share($request),
            'appName' => config('app.name', 'PharmaCore SaaS'),
            'tenancy' => [
                'baseDomain' => TenantDomain::baseDomain(),
                'adminDomain' => TenantDomain::adminDomain(),
                'adminLoginUrl' => TenantDomain::urlForHost(TenantDomain::adminDomain(), $request, '/login'),
                'demoLoginUrl' => TenantDomain::urlForHost(TenantDomain::defaultSubdomain('demo'), $request, '/login'),
                'scheme' => $request->getScheme(),
                'portSuffix' => $portSuffix,
                'domainHost' => $host,
                'isAdminDomain' => $isAdminDomain,
                'isTenantDomain' => $domainTenant !== null,
            ],
            'domainTenant' => $domainTenant ? [
                'id' => $domainTenant->id,
                'name' => $domainTenant->name,
                'slug' => $domainTenant->slug,
                'domain' => $host,
                'city' => $domainTenant->city,
            ] : null,
            'auth' => fn () => $this->resolveAuthData($request),
            'subscription' => fn () => $this->resolveSubscriptionData($request),
            'tenant' => fn () => $this->resolveTenantData($request),
            'pharmacist' => fn () => $this->resolvePharmacistData($request),
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'lastSale' => fn () => $request->session()->get('lastSale'),
                'lastClosedSessionId' => fn () => $request->session()->get('lastClosedSessionId'),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveAuthData(Request $request): array
    {
        $user = $request->user();
        $context = app(TenantContext::class);

        return [
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'is_super_admin' => $user->isSuperAdmin(),
                'is_subscriber_admin' => $user->isSubscriberAdmin(),
                'account_type' => $user->account_type,
                'has_usable_subscription' => $user->hasUsableSubscription(),
                'current_tenant_id' => $context->id() ?? $user->current_tenant_id,
                'current_branch_id' => $context->branchId() ?? ($request->hasSession() ? session('active_branch_id') : null),
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveSubscriptionData(Request $request): ?array
    {
        $user = $request->user();
        if (! $user || $user->isSuperAdmin()) {
            return null;
        }

        $subscriberAdmin = $user->effectiveSubscriberAdmin();
        $subscription = $user->effectiveSubscription();
        $plan = $subscription?->plan;

        $context = app(TenantContext::class);
        $tenant = $context->tenant();
        $featureManager = app(\App\Modules\Billing\Services\FeatureManager::class);
        if ($tenant) {
            $featureManager->setTenant($tenant);
        }

        $currentSubModel = $tenant ? \App\Modules\Billing\Models\Subscription::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('ends_at')
            ->first() : null;

        $legacySub = $subscription;
        if (! $currentSubModel && $legacySub && $legacySub->isUsable()) {
            $banner = null;
            $isWritable = true;
            $statusBadge = [
                'text' => ucfirst($legacySub->status),
                'color' => 'success',
            ];
        } elseif (! $currentSubModel && $tenant && ($tenant->status === 'active' || $tenant->isOnTrial())) {
            $banner = null;
            $isWritable = true;
            $statusBadge = [
                'text' => 'Active',
                'color' => 'success',
            ];
        } else {
            $banner = \App\Modules\Billing\Support\SubscriptionState::banner($currentSubModel);
            $isWritable = \App\Modules\Billing\Support\SubscriptionState::isWritable($currentSubModel);
            $statusBadge = \App\Modules\Billing\Support\SubscriptionState::statusBadge($currentSubModel);
        }
        $subMeta = $featureManager->subscriptionMeta();

        $usage = $subscriberAdmin ? $subscriberAdmin->subscriptionUsage() : [
            'tenants' => 0,
            'max_tenants' => 1,
            'branches' => 0,
            'max_branches' => 1,
            'employees' => 0,
            'max_users' => 5,
        ];

        return [
            'has_subscription' => $currentSubModel !== null || $subscription !== null,
            'is_usable' => (bool) ($isWritable || $subscription?->isUsable()),
            'is_writable' => $isWritable,
            'status' => $currentSubModel?->status ?? $subscription?->status ?? 'none',
            'status_badge' => $statusBadge,
            'banner' => $banner,
            'billing_cycle' => $currentSubModel?->billing_cycle ?? $subscription?->billing_cycle ?? 'monthly',
            'amount' => $subscription ? $subscription->recurringAmount() : 0,
            'payment_method' => $subscription?->payment_method,
            'starts_at' => $currentSubModel?->starts_at?->toDateString() ?? $subscription?->current_period_starts_at?->toDateString(),
            'ends_at' => ($currentSubModel?->trial_ends_at ?? $currentSubModel?->ends_at ?? $subscription?->trial_ends_at ?? $subscription?->current_period_ends_at)?->toDateString(),
            'days_left' => $currentSubModel ? $currentSubModel->daysLeft() : ($subscription?->daysLeft() ?? 0),
            'plan' => $currentSubModel ? [
                'id' => $currentSubModel->plan_id,
                'name' => $subMeta['plan_name'] ?? 'Plan',
                'key' => $subMeta['plan_code'] ?? '',
                'subscription_status' => $currentSubModel->status,
            ] : ($plan ? [
                'id' => $plan->id,
                'name' => $plan->name,
                'key' => $plan->key,
                'monthly_price' => (float) $plan->monthly_price,
                'annual_price' => (float) $plan->annual_price,
                'max_pharmacies' => (int) $plan->max_pharmacies,
                'max_branches' => (int) $plan->max_branches,
                'max_users' => (int) $plan->max_users,
                'max_medicines' => (int) $plan->max_medicines,
                'subscription_status' => $subscription?->status ?? 'none',
            ] : null),
            'usage' => $usage,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveTenantData(Request $request): ?array
    {
        $user = $request->user();
        if (! $user || $user->isSuperAdmin()) {
            return null;
        }

        $context = app(TenantContext::class);
        $tenant = $context->tenant();

        if (! $tenant && $user->current_tenant_id) {
            $tenant = Tenant::query()->with('domains')->find($user->current_tenant_id);
        }

        if (! $tenant) {
            return [
                'currentTenant' => null,
                'currentBranch' => null,
                'role' => null,
                'roles' => [],
                'permissions' => [],
                'roleLabel' => $user->isSubscriberAdmin() ? 'Business Admin (Owner)' : 'Staff',
                'canManageOrganization' => $user->isSubscriberAdmin(),
                'canManageInventory' => false,
                'canEditInventory' => false,
                'canAdjustInventory' => false,
                'canManageCrm' => false,
                'canManageBilling' => $user->isSubscriberAdmin(),
                'enabledFeatures' => [],
                'features' => [],
                'branches' => [],
                'tenants' => [],
            ];
        }

        $tenant->loadMissing('domains');
        $primaryDomain = $tenant->domains->firstWhere('is_primary', true)?->domain;
        $subscription = $tenant->subscriberSubscription();
        $plan = $subscription?->plan;
        $fm = app(\App\Modules\Billing\Services\FeatureManager::class)->setTenant($tenant);
        $featuresAll = $fm->all();
        $enabledFeatures = $featuresAll
            ->filter(fn ($f) => $f['type'] === 'boolean' ? $f['value'] === true : true)
            ->pluck('key')
            ->all();

        $featureStates = $featuresAll->mapWithKeys(function ($f) {
            return [
                $f['key'] => [
                    'name' => $f['name'],
                    'type' => $f['type'],
                    'enabled' => $f['type'] === 'boolean' ? (bool) $f['value'] : true,
                    'level' => $f['type'] === 'level' ? $f['value'] : null,
                    'limit' => $f['type'] === 'limit' ? $f['limit_value'] : null,
                ],
            ];
        })->all();
        $features = $tenant->featureCatalogStatus();

        $branches = Branch::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderByDesc('is_head_office')
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'city', 'is_head_office']);

        $tenantsQuery = $user->tenants()
            ->with('domains')
            ->wherePivot('is_active', true)
            ->orderBy('tenants.name')
            ->get();

        if ($user->isSubscriberAdmin()) {
            $owned = Tenant::query()->with('domains')->where('owner_id', $user->id)->orderBy('name')->get();
            $tenantsQuery = $tenantsQuery->merge($owned)->unique('id')->values();
        }

        $tenants = $tenantsQuery
            ->map(function (Tenant $item) use ($user, $request) {
                $roles = $user->rolesForTenant($item);
                $primary = $roles[0] ?? 'pharmacist';
                $label = TenantRole::tryFrom($primary)?->label() ?? ucfirst($primary);

                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'slug' => $item->slug,
                    'domain' => $item->primaryDomainName(),
                    'domain_url' => $item->workspaceUrl($request),
                    'status' => $item->status,
                    'city' => $item->city,
                    'role' => $primary,
                    'roles' => $roles,
                    'role_label' => count($roles) > 1 ? "{$label} +".(count($roles) - 1) : $label,
                ];
            })
            ->values();

        $branch = $context->branch();
        $roles = $context->roles();
        $permissions = $context->permissions();
        $primaryRole = $context->role() ?? ($roles[0] ?? null);
        $roleEnum = $primaryRole ? TenantRole::tryFrom($primaryRole) : null;
        $roleLabel = $roleEnum?->label() ?? ($primaryRole ? ucfirst(str_replace('_', ' ', $primaryRole)) : null);
        if (count($roles) > 1 && $roleLabel) {
            $roleLabel .= ' (+'.(count($roles) - 1).')';
        }

        return [
            'currentTenant' => [
                'id' => $tenant->id,
                'uuid' => $tenant->uuid,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'domain' => $primaryDomain ?? TenantDomain::defaultSubdomain($tenant->slug),
                'domain_url' => $tenant->workspaceUrl($request),
                'license_number' => $tenant->license_number,
                'tax_id' => $tenant->tax_id,
                'email' => $tenant->email,
                'phone' => $tenant->phone,
                'address' => $tenant->address,
                'city' => $tenant->city,
                'country' => $tenant->country,
                'currency_code' => $tenant->currency_code,
                'timezone' => $tenant->timezone,
                'status' => $tenant->status,
                'trial_ends_at' => $subscription?->trial_ends_at?->toIso8601String(),
                'trial_days_left' => $subscription?->daysLeft() ?? 0,
                'plan' => $plan ? [
                    'name' => $plan->name,
                    'key' => $plan->key,
                    'max_pharmacies' => $plan->max_pharmacies,
                    'max_branches' => $plan->max_branches,
                    'max_users' => $plan->max_users,
                    'max_medicines' => $plan->max_medicines,
                    'subscription_status' => $subscription?->status ?? 'trialing',
                ] : null,
            ],
            'currentBranch' => $branch ? [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
                'city' => $branch->city,
                'is_head_office' => (bool) $branch->is_head_office,
            ] : null,
            'role' => $primaryRole,
            'roles' => $roles,
            'permissions' => $permissions,
            'roleLabel' => $roleLabel,
            'canManageOrganization' => $context->hasPermission('branches.manage', 'team.manage', 'settings.manage'),
            'canManageInventory' => $context->hasPermission('inventory.manage', 'inventory.view', 'inventory.adjust'),
            'canEditInventory' => $context->hasPermission('inventory.manage'),
            'canAdjustInventory' => $context->hasPermission('inventory.adjust'),
            'canManageCrm' => $context->hasPermission('crm.manage', 'crm.view'),
            'canManageBilling' => $user->isSubscriberAdmin() && $context->isOwner(),
            'enabledFeatures' => $enabledFeatures,
            'featureStates' => $featureStates,
            'features' => $features,
            'branches' => $branches,
            'tenants' => $tenants,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolvePharmacistData(Request $request): ?array
    {
        $user = $request->user();
        if (! $user || $user->isSuperAdmin()) {
            return null;
        }

        $context = app(TenantContext::class);
        $tenantId = $context->id();
        if (! $tenantId) {
            return null;
        }

        $role = $context->role();
        if (! in_array($role, ['pharmacist', 'admin', 'manager'], true) && ! $user->isSubscriberAdmin()) {
            return null;
        }

        return [
            'pendingRxCount' => \App\Http\Controllers\PharmacistPortalController::pendingCountFor(
                $tenantId,
                $context->branchId()
            ),
        ];
    }
}
