<?php

namespace App\Modules\Core\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Permission;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPermissionOverride extends Model
{
    use BelongsToTenant;

    protected $table = 'user_permission_overrides';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'permission_key',
        'effect',
        'scope',
        'expires_at',
        'reason',
        'granted_by',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function grantedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by');
    }

    public function permission(): BelongsTo
    {
        return $this->belongsTo(Permission::class, 'permission_key', 'key');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}

