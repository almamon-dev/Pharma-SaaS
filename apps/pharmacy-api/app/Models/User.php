<?php

namespace App\Models;

use App\Enums\TenantRole;
use App\Models\Scopes\TenantScope;
use App\Modules\Core\Models\UserPermissionOverride;
use App\Modules\Core\Services\AccessService;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

#[Fillable([
    'name',
    'email',
    'phone',
    'password',
    'is_super_admin',
    'account_type',
    'subscriber_id',
    'platform_compliance_role',
    'status',
    'current_tenant_id',
    'tenant_id',
    'role_id',
    'is_owner',
    'is_active',
    'access_all_branches',
    'default_branch_id',
    'manager_pin_hash',
    'permission_version',
    'must_change_password',
])]
#[Hidden(['password', 'remember_token', 'manager_pin_hash'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_super_admin' => 'boolean',
            'is_owner' => 'boolean',
            'is_active' => 'boolean',
            'access_all_branches' => 'boolean',
            'permission_version' => 'integer',
            'must_change_password' => 'boolean',
        ];
    }

    public function isSuperAdmin(): bool
    {
        return (bool) $this->is_super_admin || $this->account_type === 'super_admin';
    }

    public function isSubscriberAdmin(): bool
    {
        return ! $this->isSuperAdmin() && $this->account_type === 'admin';
    }

    public function subscriberAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subscriber_id');
    }

    public function employees(): HasMany
    {
        return $this->hasMany(User::class, 'subscriber_id');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class, 'user_id');
    }

    public function activeSubscription(): HasOne
    {
        return $this->hasOne(TenantSubscription::class, 'user_id')->latestOfMany();
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function customRoles(): HasMany
    {
        return $this->hasMany(Role::class, 'user_id');
    }

    public function currentTenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'current_tenant_id');
    }

    public function ownedTenants(): HasMany
    {
        return $this->hasMany(Tenant::class, 'owner_id');
    }

    public function defaultBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'default_branch_id');
    }

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class, 'user_branches')->withTimestamps();
    }

    public function overrides(): HasMany
    {
        return $this->hasMany(UserPermissionOverride::class, 'user_id');
    }

    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(Tenant::class, 'tenant_user')
            ->withPivot(['branch_id', 'is_owner', 'role', 'roles', 'is_active', 'joined_at'])
            ->withTimestamps();
    }

    public function belongsToTenant(Tenant $tenant): bool
    {
        if ((int) $tenant->owner_id === (int) $this->id) {
            return true;
        }

        return $this->tenants()
            ->where('tenants.id', $tenant->getKey())
            ->wherePivot('is_active', true)
            ->exists();
    }

    public function isOwnerOf(Tenant $tenant): bool
    {
        if ((int) $tenant->owner_id === (int) $this->id) {
            return true;
        }

        return $this->tenants()
            ->where('tenants.id', $tenant->getKey())
            ->wherePivot('is_active', true)
            ->wherePivot('is_owner', true)
            ->exists();
    }

    public function effectiveSubscriberAdmin(): ?User
    {
        if ($this->isSubscriberAdmin()) {
            return $this;
        }

        if ($this->subscriber_id) {
            return $this->subscriberAdmin;
        }

        return $this->currentTenant?->owner;
    }

    public function effectiveSubscription(): ?TenantSubscription
    {
        $subscriber = $this->effectiveSubscriberAdmin();

        $sub = $subscriber?->activeSubscription()->with('plan')->first();
        if ($sub) {
            return $sub;
        }

        return $this->currentTenant?->subscription()->with('plan')->first();
    }

    public function hasUsableSubscription(): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        $tenantId = $this->current_tenant_id;
        if ($tenantId) {
            $p2Sub = \App\Modules\Billing\Models\Subscription::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->orderByDesc('ends_at')
                ->first();

            if ($p2Sub) {
                return in_array($p2Sub->status, [
                    \App\Modules\Billing\Models\Subscription::STATUS_TRIAL,
                    \App\Modules\Billing\Models\Subscription::STATUS_ACTIVE,
                    \App\Modules\Billing\Models\Subscription::STATUS_GRACE,
                    \App\Modules\Billing\Models\Subscription::STATUS_READ_ONLY,
                ], true);
            }
        }

        return (bool) $this->effectiveSubscription()?->isUsable();
    }

    /**
     * @return array{tenants: int, max_tenants: int, branches: int, max_branches: int, employees: int, max_users: int}
     */
    public function subscriptionUsage(): array
    {
        $subscription = $this->activeSubscription()->with('plan')->first();
        $plan = $subscription?->plan;

        $tenantIds = Tenant::query()
            ->where('owner_id', $this->id)
            ->pluck('id');

        $tenantsCount = $tenantIds->count();
        $branchesCount = $tenantIds->isEmpty()
            ? 0
            : Branch::withoutGlobalScope(TenantScope::class)
                ->whereIn('tenant_id', $tenantIds)
                ->count();

        $employeesCount = $tenantIds->isEmpty()
            ? 0
            : (int) DB::table('tenant_user')
                ->whereIn('tenant_id', $tenantIds)
                ->where('is_active', true)
                ->where('is_owner', false)
                ->where('user_id', '!=', $this->id)
                ->distinct('user_id')
                ->count('user_id');

        return [
            'tenants' => $tenantsCount,
            'max_tenants' => (int) ($plan?->max_pharmacies ?? 1),
            'branches' => $branchesCount,
            'max_branches' => (int) ($plan?->max_branches ?? 1),
            'employees' => $employeesCount,
            'max_users' => (int) ($plan?->max_users ?? 5),
        ];
    }

    /**
     * @return array<int, string>
     */
    public function rolesForTenant(Tenant|int $tenant): array
    {
        $tenantModel = $tenant instanceof Tenant ? $tenant : Tenant::find($tenant);
        if (! $tenantModel) {
            return [];
        }

        if ((int) $tenantModel->owner_id === (int) $this->id) {
            return [TenantRole::ADMIN->value];
        }

        $membership = $this->tenants()
            ->where('tenants.id', $tenantModel->id)
            ->wherePivot('is_active', true)
            ->first();

        if (! $membership) {
            return [];
        }

        if ((bool) $membership->pivot?->is_owner) {
            return [TenantRole::ADMIN->value];
        }

        $rawRoles = $membership->pivot?->roles;
        if (is_string($rawRoles)) {
            $decoded = json_decode($rawRoles, true);
            $rawRoles = is_array($decoded) ? $decoded : null;
        }

        $roles = is_array($rawRoles) && ! empty($rawRoles)
            ? $rawRoles
            : array_filter([$membership->pivot?->role]);

        return array_values(array_unique(array_map(
            fn (string $r) => TenantRole::normalize($r),
            $roles
        )));
    }

    /**
     * RBAC Permission check delegation.
     */
    public function hasPermission(string $permissionKey, ?string $scope = null, ?int $branchId = null): bool
    {
        return app(AccessService::class)->hasPermission($this, $permissionKey, $scope, $branchId);
    }

    /**
     * Get numeric limit for a user (discount cap, max refund, etc.).
     */
    public function getRoleLimit(string $limitKey): ?float
    {
        return app(AccessService::class)->getLimit($this, $limitKey);
    }

    /**
     * Get effective data scope ('all', 'branch', 'own', 'none').
     */
    public function getEffectiveScope(string $permissionKey): string
    {
        return app(AccessService::class)->getEffectiveScope($this, $permissionKey);
    }

    /**
     * Check if user is allowed to operate in the given branch.
     */
    public function canAccessBranch(Branch|int $branch): bool
    {
        $branchId = $branch instanceof Branch ? $branch->id : $branch;
        return app(AccessService::class)->canAccessBranch($this, (int) $branchId);
    }

    /**
     * Increment permission version to instantly invalidate cached permissions and sessions.
     */
    public function bumpPermissionVersion(): void
    {
        $this->increment('permission_version');
        $this->refresh();
    }

    /**
     * Set manager PIN for inline approvals.
     */
    public function setManagerPin(string $pin): void
    {
        $this->manager_pin_hash = Hash::make($pin);
        $this->save();
    }

    /**
     * Verify manager PIN.
     */
    public function verifyManagerPin(string $pin): bool
    {
        return ! empty($this->manager_pin_hash) && Hash::check($pin, $this->manager_pin_hash);
    }
}
