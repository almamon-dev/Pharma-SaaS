<?php

namespace App\Modules\Catalog\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductUnit extends Model
{
    use HasFactory, HasUuids, BelongsToTenant;

    protected $table = 'product_units';

    protected $fillable = [
        'tenant_id',
        'product_id',
        'unit_name',
        'conversion_to_base',
        'is_sale_unit',
        'is_purchase_unit',
        'is_default_sale',
    ];

    protected function casts(): array
    {
        return [
            'conversion_to_base' => 'integer',
            'is_sale_unit' => 'boolean',
            'is_purchase_unit' => 'boolean',
            'is_default_sale' => 'boolean',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}

