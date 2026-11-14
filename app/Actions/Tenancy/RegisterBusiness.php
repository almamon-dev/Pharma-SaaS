<?php

namespace App\Actions\Tenancy;

use App\Enums\TenantRole;
use App\Models\Branch;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\User;
use App\Tenancy\CurrentTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class RegisterBusiness
{
    public function __construct(
        private readonly CurrentTenant $currentTenant,
        private readonly ProvisionTenantAccess $provisionTenantAccess,
    ) {}

    /**
     * Register a new Business Owner (Subscriber Admin), their primary Tenant business workspace,
     * primary TenantDomain, and Head Office Branch — following TravelOS tenancy structure.
     *
     * @param  array<string, mixed>  $data
     * @return array{user: User, tenant: Tenant, branch: Branch}
     */
    public function execute(array $data): array
    {
        return DB::transaction(function () use ($data): array {
            $owner = User::query()->create([
                'name' => trim((string) $data['name']),
                'email' => strtolower(trim((string) $data['email'])),
                'phone' => $data['phone'] ?? null,
                'password' => Hash::make((string) $data['password']),
                'account_type' => 'admin',
                'is_super_admin' => false,
                'status' => 'active',
            ]);

            $businessName = trim((string) $data['business_name']);
            $customDomain = $data['domain'] ?? null;
            $baseSuffix = '.'.TenantDomain::baseDomain();
            $slugSource = is_string($customDomain) && str_ends_with($customDomain, $baseSuffix)
                ? Str::beforeLast($customDomain, $baseSuffix)
                : $businessName;

            $baseSlug = Str::slug($slugSource) ?: 'pharmacy';
            $slug = $baseSlug;
            $suffix = 1;
            while (Tenant::withTrashed()->where('slug', $slug)->exists()) {
                $slug = "{$baseSlug}-{$suffix}";
                $suffix++;
            }

            $tenant = Tenant::query()->create([
                'uuid' => (string) Str::uuid(),
                'owner_id' => $owner->id,
                'name' => $businessName,
                'slug' => $slug,
                'email' => $owner->email,
                'phone' => $owner->phone,
                'city' => $data['city'] ?? null,
                'country' => $data['country'] ?? 'Bangladesh',
                'timezone' => $data['timezone'] ?? 'Asia/Dhaka',
                'currency_code' => $data['currency_code'] ?? 'BDT',
                'locale' => 'en',
                'status' => 'active',
                'settings' => [
                    'low_stock_alert_days' => 30,
                    'default_tax_rate' => 0,
                    'require_prescription_verification' => true,
                    'fefo_enabled' => true,
                ],
            ]);

            TenantDomain::setPrimaryForTenant($tenant, $data['domain'] ?? null);

            $branch = $this->currentTenant->run($tenant, function () use ($owner): Branch {
                return Branch::query()->create([
                    'code' => 'HO',
                    'name' => 'Head Office',
                    'email' => $owner->email,
                    'phone' => $owner->phone,
                    'is_head_office' => true,
                    'is_active' => true,
                ]);
            });

            $tenant->users()->attach($owner->id, [
                'branch_id' => $branch->id,
                'is_owner' => true,
                'role' => TenantRole::ADMIN->value,
                'roles' => json_encode([TenantRole::ADMIN->value]),
                'is_active' => true,
                'joined_at' => now(),
            ]);

            $owner->forceFill(['current_tenant_id' => $tenant->id])->save();

            $this->provisionTenantAccess->execute($tenant);

            return [
                'user' => $owner->fresh(),
                'tenant' => $tenant->fresh(['domains', 'branches']),
                'branch' => $branch,
            ];
        });
    }
}

