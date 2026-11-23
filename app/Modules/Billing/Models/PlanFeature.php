<?php

namespace App\Modules\Billing\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanFeature extends Model
{
    use HasFactory;

    protected $table = 'plan_features';

    public $incrementing = false;

    protected $fillable = [
        'plan_id',
        'feature_key',
        'bool_value',
        'limit_value',
        'level_value',
    ];

    protected function casts(): array
    {
        return [
            'bool_value' => 'boolean',
            'limit_value' => 'integer',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id');
    }

    public function feature(): BelongsTo
    {
        return $this->belongsTo(Feature::class, 'feature_key', 'key');
    }
}

