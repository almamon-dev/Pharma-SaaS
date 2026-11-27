<?php

namespace App\Services;

use App\Actions\Tenancy\ProvisionTenantAccess;
use App\Enums\TenantRole;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\SaasPlan;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Services\Commercial\SubscriptionService;
use App\Tenancy\CurrentTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TenantProvisioningService
{
    public function __construct(
        private readonly CurrentTenant $currentTenant,
        private readonly ProvisionTenantAccess $provisionTenantAccess,
        private readonly SubscriptionService $subscriptionService,
    ) {}

    public function activateSubscriptionForAdmin(
        User $admin,
        SaasPlan $plan,
        string $billingCycle = 'monthly',
        string $paymentMethod = 'trial',
        ?Tenant $primaryTenant = null,
        ?string $forcedStatus = null,
    ): TenantSubscription {
        return $this->subscriptionService->activate(
            admin: $admin,
            plan: $plan,
            billingCycle: $billingCycle,
            paymentMethod: $paymentMethod,
            primaryTenant: $primaryTenant,
            forcedStatus: $forcedStatus,
        );
    }

    public function createTenantForUser(User $user, array $data): Tenant
    {
        $tenant = DB::transaction(function () use ($user, $data): Tenant {
            $name = trim((string) $data['name']);
            $baseSlug = Str::slug($name) ?: 'business';
            $slug = $baseSlug;
            $counter = 1;
            while (Tenant::withTrashed()->where('slug', $slug)->exists()) {
                $slug = "{$baseSlug}-{$counter}";
                $counter++;
            }

            $trialEndsAt = $user->activeSubscription?->trial_ends_at;

            $tenant = Tenant::query()->create([
                'uuid' => (string) Str::uuid(),
                'owner_id' => $user->id,
                'name' => $name,
                'slug' => $slug,
                'license_number' => $data['license_number'] ?? null,
                'tax_id' => $data['tax_id'] ?? null,
                'email' => $data['email'] ?? $user->email,
                'phone' => $data['phone'] ?? $user->phone,
                'address' => $data['address'] ?? null,
                'city' => $data['city'] ?? null,
                'country' => $data['country'] ?? 'Bangladesh',
                'currency_code' => $data['currency_code'] ?? ($data['currency'] ?? 'BDT'),
                'timezone' => $data['timezone'] ?? 'Asia/Dhaka',
                'status' => 'active',
                'trial_ends_at' => $trialEndsAt,
                'settings' => [
                    'low_stock_alert_days' => 30,
                    'default_tax_rate' => 0,
                    'require_prescription_verification' => true,
                    'fefo_enabled' => true,
                ],
            ]);

            TenantDomain::setPrimaryForTenant($tenant, $data['domain'] ?? null);

            $branch = $this->currentTenant->run($tenant, function () use ($data, $tenant): Branch {
                return Branch::query()->create([
                    'name' => $data['branch_name'] ?? 'Head Office',
                    'code' => strtoupper(trim((string) ($data['branch_code'] ?? 'HO'))),
                    'phone' => $tenant->phone,
                    'email' => $tenant->email,
                    'address' => $tenant->address,
                    'city' => $tenant->city,
                    'is_head_office' => true,
                    'is_active' => true,
                ]);
            });

            $tenant->users()->attach($user->id, [
                'branch_id' => $branch->id,
                'is_owner' => true,
                'role' => TenantRole::ADMIN->value,
                'roles' => json_encode([TenantRole::ADMIN->value]),
                'is_active' => true,
                'joined_at' => now(),
            ]);

            $user->forceFill([
                'account_type' => $user->isSuperAdmin() ? 'super_admin' : 'admin',
                'current_tenant_id' => $tenant->id,
            ])->save();

            session(['active_branch_id' => $branch->id]);

            $this->provisionTenantAccess->execute($tenant);

            // Seed Chart of Accounts template, fiscal year/periods, accounting settings & simple categories
            app(\App\Modules\Accounting\Services\AccountingBootstrapService::class)->bootstrapForTenant(
                tenant: $tenant,
                template: (string) ($data['coa_template'] ?? 'pharmacy'),
                mode: (string) ($data['accounting_mode'] ?? 'simple'),
            );

            $planKey = $data['plan_key'] ?? $data['plan_slug'] ?? null;
            if (! empty($planKey)) {
                $plan = SaasPlan::query()->where('key', $planKey)->first();
                if ($plan && ! $user->hasUsableSubscription()) {
                    $this->activateSubscriptionForAdmin($user, $plan, 'monthly', 'trial', $tenant);
                }
            } elseif ($activeSub = $user->effectiveSubscription()) {
                $this->subscriptionService->syncModulesForTenant($tenant, $activeSub->plan, $activeSub->status);
            }

            AuditLog::record(
                action: 'tenant.created',
                description: "Created business tenant \"{$tenant->name}\" under active subscription.",
                subject: $tenant,
                metadata: [
                    'branch_code' => $branch->code,
                ],
                tenantId: $tenant->id,
                userId: $user->id,
            );

            return $tenant->fresh(['domains', 'branches']);
        });

        if (! app()->runningUnitTests()) {
            try {
                app(\App\Modules\Catalog\Services\BangladeshCatalogImportService::class)
                    ->provisionForNewTenantIfCached($tenant);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return $tenant;
    }
}
