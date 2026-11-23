<?php

namespace App\Models;

use App\Modules\Core\Models\RolePermission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Permission extends Model
{
    protected $fillable = [
        'name',
        'guard_name',
        'key',
        'module',
        'action',
        'description',
        'is_sensitive',
        'requires_feature',
        'supports_scope',
    ];

    protected function casts(): array
    {
        return [
            'is_sensitive' => 'boolean',
            'supports_scope' => 'boolean',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_has_permissions');
    }

    public function rolePermissions(): HasMany
    {
        return $this->hasMany(RolePermission::class, 'permission_key', 'key');
    }
}
