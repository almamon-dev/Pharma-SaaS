<?php

namespace App\Modules\Billing\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Addon extends Model
{
    use HasFactory;

    protected $table = 'addons';

    protected $fillable = [
        'code',
        'name',
        'feature_key',
        'extra_limit',
        'price',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'extra_limit' => 'integer',
            'price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function feature(): BelongsTo
    {
        return $this->belongsTo(Feature::class, 'feature_key', 'key');
    }

    public function tenantAddons(): HasMany
    {
        return $this->hasMany(TenantAddon::class, 'addon_id');
    }
}

