<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Modules\Core\Models\RoleLimit;
use App\Modules\Core\Models\RolePermission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'name',
        'slug',
        'guard_name',
        'description',
        'permissions',
        'is_system',
        'is_locked',
        'sort',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
            'is_system' => 'boolean',
            'is_locked' => 'boolean',
            'sort' => 'integer',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function permissionRecords(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_has_permissions');
    }

    public function rolePermissions(): HasMany
    {
        return $this->hasMany(RolePermission::class, 'role_id');
    }

    public function roleLimits(): HasMany
    {
        return $this->hasMany(RoleLimit::class, 'role_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id');
    }

    public function getLimit(string $limitKey): ?float
    {
        $limit = $this->roleLimits->firstWhere('limit_key', $limitKey);
        return $limit ? $limit->value : null;
    }

    public function hasPermissionKey(string $key): bool
    {
        return $this->rolePermissions->contains('permission_key', $key);
    }

    public function getPermissionScope(string $key): string
    {
        $rp = $this->rolePermissions->firstWhere('permission_key', $key);
        return $rp ? $rp->scope : 'all';
    }
}
