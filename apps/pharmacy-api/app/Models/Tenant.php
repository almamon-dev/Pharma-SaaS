<?php

namespace App\Models;

use App\Models\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Tenant extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'owner_id',
        'name',
        'slug',
        'license_number',
        'tax_id',
        'email',
        'phone',
        'address',
        'city',
        'country',
        'status',
        'timezone',
        'currency_code',
        'locale',
        'trial_ends_at',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'datetime',
            'settings' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Tenant $tenant): void {
            if (empty($tenant->uuid)) {
                $tenant->uuid = (string) Str::uuid();
            }
            if (empty($tenant->slug)) {
                $tenant->slug = Str::slug($tenant->name).'-'.Str::lower(Str::random(4));
            }
        });
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function domains(): HasMany
    {
        return $this->hasMany(TenantDomain::class);
    }

    public function primaryDomain(): HasOne
    {
        return $this->hasOne(TenantDomain::class)->where('is_primary', true);
    }

    public function primaryDomainName(): string
    {
        $loaded = $this->relationLoaded('domains')
            ? $this->domains->firstWhere('is_primary', true)?->domain
            : null;

        return $loaded
            ?? $this->primaryDomain()->value('domain')
            ?? TenantDomain::defaultSubdomain($this->slug);
    }

    public function workspaceUrl(?\Illuminate\Http\Request $request = null, string $path = '/'): string
    {
        return TenantDomain::urlForHost($this->primaryDomainName(), $request, $path);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class)->withoutGlobalScope(TenantScope::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'tenant_user')
            ->withPivot(['branch_id', 'is_owner', 'role', 'roles', 'is_active', 'joined_at'])
            ->withTimestamps();
    }

    public function modules(): BelongsToMany
    {
        return $this->belongsToMany(Module::class, 'tenant_modules')
            ->withPivot(['is_enabled', 'enabled_at'])
            ->withTimestamps();
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(TenantSubscription::class)->latestOfMany();
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(MedicineCategory::class)->withoutGlobalScope(TenantScope::class);
    }

    public function medicines(): HasMany
    {
        return $this->hasMany(Medicine::class)->withoutGlobalScope(TenantScope::class);
    }

    public function batches(): HasMany
    {
        return $this->hasMany(MedicineBatch::class)->withoutGlobalScope(TenantScope::class);
    }

    public function suppliers(): HasMany
    {
        return $this->hasMany(Supplier::class)->withoutGlobalScope(TenantScope::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class)->withoutGlobalScope(TenantScope::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class)->withoutGlobalScope(TenantScope::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class)->withoutGlobalScope(TenantScope::class);
    }

    public function hasModule(string $key): bool
    {
        return $this->hasFeature($key);
    }

    public function hasFeature(string $key): bool
    {
        $module = Module::query()
            ->where('key', $key)
            ->where('is_active', true)
            ->first();

        if (! $module) {
            return false;
        }

        if ($module->is_core) {
            return true;
        }

        return $this->modules()
            ->where('modules.id', $module->id)
            ->wherePivot('is_enabled', true)
            ->exists();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function featureCatalogStatus(): array
    {
        $enabledIds = $this->modules()
            ->where('modules.is_active', true)
            ->wherePivot('is_enabled', true)
            ->pluck('modules.id')
            ->all();

        return Module::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(function (Module $module) use ($enabledIds): array {
                $isEnabled = $module->is_core || in_array($module->id, $enabledIds, true);

                return [
                    'id' => $module->id,
                    'key' => $module->key,
                    'name' => $module->name,
                    'description' => $module->description,
                    'category' => $module->category ?? 'operations',
                    'is_core' => (bool) $module->is_core,
                    'is_enabled' => $isEnabled,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return list<string>
     */
    public function enabledFeatureKeys(): array
    {
        return array_values(array_map(
            fn (array $item): string => (string) $item['key'],
            array_filter(
                $this->featureCatalogStatus(),
                fn (array $item): bool => (bool) $item['is_enabled']
            )
        ));
    }

    public function subscriberSubscription(): ?TenantSubscription
    {
        if ($this->owner) {
            $sub = $this->owner->activeSubscription()->with('plan')->first();
            if ($sub) {
                return $sub;
            }
        }

        return $this->subscription()->with('plan')->first();
    }

    public function isOnTrial(): bool
    {
        return $this->trial_ends_at !== null && $this->trial_ends_at->isFuture();
    }

    public function daysLeftInTrial(): int
    {
        if (! $this->isOnTrial()) {
            return 0;
        }

        return (int) now()->startOfDay()->diffInDays($this->trial_ends_at, false);
    }
}
