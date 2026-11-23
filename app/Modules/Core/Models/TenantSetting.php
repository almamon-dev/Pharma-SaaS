<?php

namespace App\Modules\Core\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantSetting extends Model
{
    use BelongsToTenant;

    protected $table = 'tenant_settings';

    public $incrementing = false;

    protected $primaryKey = ['tenant_id', 'key'];

    protected $fillable = [
        'tenant_id',
        'key',
        'value',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public static function get(Tenant|int $tenant, string $key, mixed $default = null): mixed
    {
        $tenantId = $tenant instanceof Tenant ? $tenant->id : $tenant;

        $setting = static::query()
            ->where('tenant_id', $tenantId)
            ->where('key', $key)
            ->first();

        return $setting ? $setting->value : $default;
    }

    public static function set(Tenant|int $tenant, string $key, mixed $value): static
    {
        $tenantId = $tenant instanceof Tenant ? $tenant->id : $tenant;

        return static::query()->updateOrCreate(
            ['tenant_id' => $tenantId, 'key' => $key],
            ['value' => $value]
        );
    }
}

