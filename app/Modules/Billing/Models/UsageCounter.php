<?php

namespace App\Modules\Billing\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UsageCounter extends Model
{
    use BelongsToTenant;

    protected $table = 'usage_counters';

    public $incrementing = false;

    protected $fillable = [
        'tenant_id',
        'feature_key',
        'period', // 'YYYY-MM'
        'used',
    ];

    protected function casts(): array
    {
        return [
            'used' => 'integer',
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
}

