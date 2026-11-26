<?php

namespace App\Modules\Catalog\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductDiscountRule extends Model
{
    use HasFactory, HasUuids, BelongsToTenant;

    protected $table = 'product_discount_rules';

    protected $fillable = [
        'tenant_id',
        'scope', // 'product', 'category', 'company'
        'scope_id',
        'type', // 'percent', 'fixed'
        'value',
        'starts_on',
        'ends_on',
        'is_active',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'starts_on' => 'date',
            'ends_on' => 'date',
            'is_active' => 'boolean',
        ];
    }
}

