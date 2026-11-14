<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Medicine extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'category_id',
        'name',
        'generic_name',
        'manufacturer',
        'sku',
        'barcode',
        'dosage_form',
        'strength',
        'unit',
        'units_per_strip',
        'units_per_box',
        'reorder_level',
        'requires_prescription',
        'default_purchase_price',
        'box_purchase_price',
        'default_selling_price',
        'box_selling_price',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'units_per_strip' => 'integer',
            'units_per_box' => 'integer',
            'requires_prescription' => 'boolean',
            'is_active' => 'boolean',
            'default_purchase_price' => 'decimal:2',
            'box_purchase_price' => 'decimal:2',
            'default_selling_price' => 'decimal:2',
            'box_selling_price' => 'decimal:2',
        ];
    }

    public function packMultiplierFor(string $saleUnit): int
    {
        return match ($saleUnit) {
            'box' => max(1, (int) ($this->units_per_box ?: 1)),
            'strip' => max(1, (int) ($this->units_per_strip ?: 1)),
            default => 1,
        };
    }

    public function resolvedBoxSellingPrice(): ?float
    {
        if ($this->box_selling_price !== null && (float) $this->box_selling_price > 0) {
            return (float) $this->box_selling_price;
        }

        $unitsPerBox = (int) ($this->units_per_box ?: 1);
        if ($unitsPerBox > 1) {
            return round((float) $this->default_selling_price * $unitsPerBox, 2);
        }

        return null;
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(MedicineCategory::class, 'category_id');
    }

    public function batches(): HasMany
    {
        return $this->hasMany(MedicineBatch::class);
    }
}
