<?php

namespace App\Modules\Core\Models;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RolePermission extends Model
{
    protected $table = 'role_permissions';

    public $incrementing = false;

    protected $primaryKey = ['role_id', 'permission_key'];

    protected $fillable = [
        'role_id',
        'permission_key',
        'scope',
    ];

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function permission(): BelongsTo
    {
        return $this->belongsTo(Permission::class, 'permission_key', 'key');
    }
}

