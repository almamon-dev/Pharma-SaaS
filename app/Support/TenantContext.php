<?php

namespace App\Support;

use App\Enums\TenantRole;
use App\Models\Branch;
use App\Models\Tenant;
use App\Tenancy\CurrentTenant;

class TenantContext
{
    private ?Tenant $tenant = null;

    private ?Branch $branch = null;

    /** @var array<int, string> */
    private array $roles = [];

    /** @var array<int, string> */
    private array $permissions = [];

    private bool $isOwner = false;

    /**
     * @param  array<int, string>  $roles
     */
    public function setTenant(
        Tenant $tenant,
        ?Branch $branch = null,
        array $roles = [],
        ?int $subscriberAdminId = null,
        bool $isOwner = false
    ): void {
        $this->tenant = $tenant;
        $this->branch = $branch;
        $this->isOwner = $isOwner;

        app(CurrentTenant::class)->set($tenant);

        $normalized = array_values(array_unique(array_map(
            fn (string $r) => TenantRole::normalize($r),
            array_filter($roles)
        )));

        if ($isOwner && ! in_array(TenantRole::ADMIN->value, $normalized, true)) {
            $normalized[] = TenantRole::ADMIN->value;
        }

        $this->roles = $normalized;
        $this->permissions = $isOwner || in_array(TenantRole::ADMIN->value, $normalized, true)
            ? array_keys(TenantRole::PERMISSION_CATALOG)
            : TenantRole::permissionsForSlugs($normalized, $subscriberAdminId, $tenant->id);
    }

    public function setBranch(?Branch $branch): void
    {
        $this->branch = $branch;
    }

    public function clear(): void
    {
        $this->tenant = null;
        $this->branch = null;
        $this->roles = [];
        $this->permissions = [];
        $this->isOwner = false;
        app(CurrentTenant::class)->clear();
    }

    public function tenant(): ?Tenant
    {
        return $this->tenant;
    }

    public function id(): ?int
    {
        return $this->tenant?->id;
    }

    public function branch(): ?Branch
    {
        return $this->branch;
    }

    public function branchId(): ?int
    {
        return $this->branch?->id;
    }

    public function isOwner(): bool
    {
        return $this->isOwner;
    }

    public function role(): ?string
    {
        return $this->roles[0] ?? null;
    }

    /**
     * @return array<int, string>
     */
    public function roles(): array
    {
        return $this->roles;
    }

    /**
     * @return array<int, string>
     */
    public function permissions(): array
    {
        return $this->permissions;
    }

    public function hasTenant(): bool
    {
        return $this->tenant !== null;
    }

    public function hasRole(string|array ...$roles): bool
    {
        if ($this->isOwner) {
            return true;
        }

        $flattened = [];
        foreach ($roles as $r) {
            if (is_array($r)) {
                $flattened = array_merge($flattened, $r);
            } else {
                $flattened[] = $r;
            }
        }

        $expected = array_map(
            fn (string $r) => TenantRole::normalize($r),
            $flattened
        );

        foreach ($this->roles as $assigned) {
            if (in_array($assigned, $expected, true)) {
                return true;
            }
        }

        return false;
    }

    public function hasPermission(string|array ...$permissions): bool
    {
        if ($this->isOwner || in_array(TenantRole::ADMIN->value, $this->roles, true)) {
            return true;
        }

        $flattened = [];
        foreach ($permissions as $p) {
            if (is_array($p)) {
                $flattened = array_merge($flattened, $p);
            } else {
                $flattened[] = $p;
            }
        }

        foreach ($flattened as $perm) {
            if (in_array($perm, $this->permissions, true)) {
                return true;
            }
        }

        return false;
    }
}
