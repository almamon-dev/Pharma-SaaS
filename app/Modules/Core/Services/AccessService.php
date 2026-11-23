<?php

namespace App\Modules\Core\Services;

use App\Models\Permission;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Core\Models\UserPermissionOverride;
use Illuminate\Support\Facades\Cache;

class AccessService
{
    /**
     * Check if a permission key exists in the catalog.
     */
    public function isPermissionKey(string $key): bool
    {
        static $knownKeys = null;
        if ($knownKeys === null) {
            $knownKeys = Cache::remember('rbac_known_permission_keys', 3600, function () {
                return Permission::pluck('key')->all();
            });
        }

        return in_array($key, $knownKeys, true);
    }

    /**
     * Centralized evaluation of effective user permission.
     * Effective permission = (Role Permission || User Override) && (Plan Feature Enabled) && (Branch Access) && (Data Scope)
     */
    public function hasPermission(
        User $user,
        string $permissionKey,
        ?string $requiredScope = null,
        ?int $branchId = null
    ): bool {
        // Super admin has unrestricted access to everything
        if ($user->isSuperAdmin()) {
            return true;
        }

        $currentTenant = app(\App\Tenancy\CurrentTenant::class);
        $tenant = ($currentTenant->has() ? $currentTenant->get() : null)
            ?? $user->currentTenant
            ?? ($user->current_tenant_id ? Tenant::withoutGlobalScopes()->find($user->current_tenant_id) : null);
        $isOwner = $tenant && $user->isOwnerOf($tenant);

        // Branch check if branchId is provided
        if ($branchId !== null && ! $this->canAccessBranch($user, $branchId)) {
            return false;
        }

        // Feature dependency check
        if (! $this->isFeatureEnabledForPermission($user, $permissionKey)) {
            return false;
        }

        // Owners have all permissions with 'all' scope
        if ($isOwner) {
            return true;
        }

        // Check cache for computed user permissions
        $version = $user->permission_version ?? 1;
        $cacheKey = "rbac_perm_{$user->id}_v{$version}_{$tenant?->id}";

        $effectivePermissions = Cache::remember($cacheKey, 600, function () use ($user, $tenant) {
            return $this->computeEffectivePermissions($user, $tenant);
        });

        if (! array_key_exists($permissionKey, $effectivePermissions)) {
            return false;
        }

        $grantedScope = $effectivePermissions[$permissionKey];
        if ($grantedScope === false) {
            return false; // Denied by explicit user override
        }

        // If a required data scope is specified, evaluate compatibility
        if ($requiredScope !== null) {
            return $this->isScopeCompatible($grantedScope, $requiredScope);
        }

        return true;
    }

    /**
     * Returns the user's effective data scope for a given permission ('all', 'branch', 'own', or 'none').
     */
    public function getEffectiveScope(User $user, string $permissionKey): string
    {
        if ($user->isSuperAdmin() || ($user->currentTenant && $user->isOwnerOf($user->currentTenant))) {
            return 'all';
        }

        $tenant = $user->currentTenant;
        $version = $user->permission_version ?? 1;
        $cacheKey = "rbac_perm_{$user->id}_v{$version}_{$tenant?->id}";

        $effectivePermissions = Cache::remember($cacheKey, 600, function () use ($user, $tenant) {
            return $this->computeEffectivePermissions($user, $tenant);
        });

        $scope = $effectivePermissions[$permissionKey] ?? null;
        if ($scope === false || $scope === null) {
            return 'none';
        }

        return (string) $scope;
    }

    /**
     * Get numeric limit for a role/user (null = unlimited).
     */
    public function getLimit(User $user, string $limitKey): ?float
    {
        if ($user->isSuperAdmin() || ($user->currentTenant && $user->isOwnerOf($user->currentTenant))) {
            return null; // Unlimited for super admin and owner
        }

        $roleId = $user->role_id;
        $role = $roleId ? \App\Models\Role::withoutGlobalScopes()->find($roleId) : $user->role;
        if (! $role) {
            return 0.0;
        }

        return $role->getLimit($limitKey);
    }

    /**
     * Check if a user can access a specific branch.
     */
    public function canAccessBranch(User $user, int $branchId): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        $tenant = $user->currentTenant;
        if ($tenant && $user->isOwnerOf($tenant)) {
            return true;
        }

        if ($user->access_all_branches) {
            return true;
        }

        return \Illuminate\Support\Facades\DB::table('user_branches')
            ->where('user_id', $user->id)
            ->where('branch_id', $branchId)
            ->exists();
    }

    /**
     * Compute and map effective permissions taking role + user overrides into account.
     *
     * @return array<string, string|false> Map of permission_key => scope ('all', 'branch', 'own') or false if denied
     */
    protected function computeEffectivePermissions(User $user, ?Tenant $tenant): array
    {
        $permissions = [];

        // 1. Base permissions from user's role
        $roleId = $user->role_id;
        $role = $roleId ? \App\Models\Role::withoutGlobalScopes()->find($roleId) : $user->role;
        if ($role) {
            $rolePermissions = \App\Modules\Core\Models\RolePermission::where('role_id', $role->id)->get();
            foreach ($rolePermissions as $rp) {
                $permissions[$rp->permission_key] = $rp->scope ?: 'all';
            }
        }

        // Also check any roles in tenant_user for this tenant (multi-role & custom role support)
        if ($tenant) {
            $pivot = \Illuminate\Support\Facades\DB::table('tenant_user')
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $user->id)
                ->first();

            if ($pivot) {
                $rawRoles = $pivot->roles;
                if (is_string($rawRoles)) {
                    $decoded = json_decode($rawRoles, true);
                    $rawRoles = is_array($decoded) ? $decoded : null;
                }
                $assignedSlugs = is_array($rawRoles) && ! empty($rawRoles)
                    ? $rawRoles
                    : array_filter([$pivot->role]);

                if (! empty($assignedSlugs)) {
                    $roles = \App\Models\Role::withoutGlobalScopes()
                        ->where('tenant_id', $tenant->id)
                        ->where(function ($q) use ($assignedSlugs) {
                            $q->whereIn('slug', $assignedSlugs)
                                ->orWhereIn('name', array_map('ucfirst', $assignedSlugs));
                        })
                        ->with('rolePermissions')
                        ->get();

                    foreach ($roles as $r) {
                        foreach ($r->rolePermissions as $rp) {
                            $permissions[$rp->permission_key] = $rp->scope ?: 'all';
                        }
                    }

                    // Also support TenantRole defaults if any slug matches standard TenantRole
                    foreach ($assignedSlugs as $slug) {
                        $enum = \App\Enums\TenantRole::tryFrom($slug);
                        if ($enum) {
                            foreach ($enum->defaultPermissions() as $p) {
                                $permissions[$p] = $permissions[$p] ?? 'all';
                            }
                        }
                    }
                }
            }
        }

        // 2. User permission overrides (higher precedence than role)
        $overrides = \App\Modules\Core\Models\UserPermissionOverride::withoutGlobalScopes()
            ->where('user_id', $user->id)
            ->where(function ($q) {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->get();

        foreach ($overrides as $override) {
            if ($override->effect === 'deny') {
                $permissions[$override->permission_key] = false;
            } elseif ($override->effect === 'allow') {
                $permissions[$override->permission_key] = $override->scope ?: 'all';
            }
        }

        return $permissions;
    }

    /**
     * Check if the tenant's plan enables the feature required by this permission.
     */
    protected function isFeatureEnabledForPermission(User $user, string $permissionKey): bool
    {
        $perm = Permission::where('key', $permissionKey)->first();
        if (! $perm || empty($perm->requires_feature)) {
            return true;
        }

        $featureKey = $perm->requires_feature;
        $tenant = $user->currentTenant;

        if ($tenant) {
            return app(\App\Modules\Billing\Services\FeatureManager::class)
                ->setTenant($tenant)
                ->can($featureKey);
        }

        return false;
    }

    /**
     * Check if granted scope satisfies required scope.
     * 'all' satisfies 'all', 'branch', 'own'
     * 'branch' satisfies 'branch', 'own'
     * 'own' satisfies only 'own'
     */
    protected function isScopeCompatible(string $grantedScope, string $requiredScope): bool
    {
        if ($grantedScope === 'all') {
            return true;
        }

        if ($grantedScope === 'branch' && in_array($requiredScope, ['branch', 'own'], true)) {
            return true;
        }

        if ($grantedScope === 'own' && $requiredScope === 'own') {
            return true;
        }

        return false;
    }
}
