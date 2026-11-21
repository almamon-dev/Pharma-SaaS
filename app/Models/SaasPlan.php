<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SaasPlan extends Model
{
    use HasFactory;

    protected $table = 'saas_plans';

    protected $fillable = [
        'key',
        'name',
        'name_bn',
        'description',
        'description_bn',
        'currency_code',
        'monthly_price',
        'annual_price',
        'trial_days',
        'max_pharmacies',
        'max_branches',
        'max_users',
        'max_medicines',
        'storage_limit_mb',
        'features',
        'features_bn',
        'is_popular',
        'is_active',
        'is_public',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'monthly_price' => 'decimal:2',
            'annual_price' => 'decimal:2',
            'features' => 'array',
            'features_bn' => 'array',
            'is_popular' => 'boolean',
            'is_active' => 'boolean',
            'is_public' => 'boolean',
        ];
    }

    public function localizedName(string $locale = 'en'): string
    {
        return ($locale === 'bn' && ! empty($this->name_bn)) ? $this->name_bn : $this->name;
    }

    public function localizedDescription(string $locale = 'en'): ?string
    {
        return ($locale === 'bn' && ! empty($this->description_bn)) ? $this->description_bn : $this->description;
    }

    /**
     * @return array<int, string>
     */
    public function localizedFeatures(string $locale = 'en'): array
    {
        if ($locale === 'bn' && ! empty($this->features_bn) && is_array($this->features_bn)) {
            return $this->features_bn;
        }

        return $this->features ?? [];
    }

    public function modules(): BelongsToMany
    {
        return $this->belongsToMany(Module::class, 'saas_plan_modules')
            ->withTimestamps();
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class, 'saas_plan_id');
    }
}
