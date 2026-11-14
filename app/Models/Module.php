<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Module extends Model
{
    protected $fillable = [
        'key',
        'name',
        'description',
        'category',
        'is_core',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_core' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(Tenant::class, 'tenant_modules')
            ->withPivot(['is_enabled', 'enabled_at'])
            ->withTimestamps();
    }

    public function plans(): BelongsToMany
    {
        return $this->belongsToMany(SaasPlan::class, 'saas_plan_modules')
            ->withTimestamps();
    }
}
