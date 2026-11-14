<?php

namespace App\Models;

use App\Enums\TenantRole;
use App\Models\Scopes\TenantScope;
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
])]
#[Hidden(['password', 'remember_token'])]
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
}
