<?php

namespace App\Modules\Billing\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantOverride extends Model
{
    use BelongsToTenant;

    protected $table = 'tenant_overrides';

    public $incrementing = false;

    protected $fillable = [
        'tenant_id',
        'feature_key',
        'bool_value',
        'limit_value',
        'level_value',
        'expires_at',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'bool_value' => 'boolean',
            'limit_value' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function feature(): BelongsTo
    {
        return $this->belongsTo(Feature::class, 'feature_key', 'key');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}

