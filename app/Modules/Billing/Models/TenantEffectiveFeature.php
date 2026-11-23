<?php

namespace App\Modules\Billing\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * Read-only model mapping to the `tenant_effective_features` view.
 */
class TenantEffectiveFeature extends Model
{
    use BelongsToTenant;

    protected $table = 'tenant_effective_features';

    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'bool_value' => 'boolean',
            'limit_value' => 'integer',
            'is_overridden' => 'boolean',
            'addon_extra_limit' => 'integer',
            'subscription_starts_at' => 'datetime',
            'subscription_ends_at' => 'datetime',
            'override_expires_at' => 'datetime',
        ];
    }
}

