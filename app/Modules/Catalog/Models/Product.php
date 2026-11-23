<?php

namespace App\Modules\Catalog\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, HasUuids, SoftDeletes, BelongsToTenant;

    protected $table = 'products';

    protected $fillable = [
        'tenant_id',
        'type',
        'name',
        'name_bn',
        'generic_id',
        'company_id',
        'category_id',
        'strength',
        'dosage_form',
        'sku',
        'description',
        'base_unit',
        'track_batch',
        'is_controlled',
        'default_discount_type',
        'default_discount_value',
        'vat_rate',
        'is_active',
        'import_job_id',
        'dedupe_key',
        'search_text',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'track_batch' => 'boolean',
            'is_controlled' => 'boolean',
            'is_active' => 'boolean',
            'default_discount_value' => 'decimal:2',
            'vat_rate' => 'decimal:2',
        ];
    }

    public function generic(): BelongsTo
    {
        return $this->belongsTo(Generic::class, 'generic_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function units(): HasMany
    {
        return $this->hasMany(ProductUnit::class, 'product_id');
    }

    public function barcodes(): HasMany
    {
        return $this->hasMany(ProductBarcode::class, 'product_id');
    }

    public function branchSettings(): HasMany
    {
        return $this->hasMany(ProductBranchSetting::class, 'product_id');
    }

    public function discountRules(): HasMany
    {
        return $this->hasMany(ProductDiscountRule::class, 'scope_id')
            ->where('scope', 'product');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function importJob(): BelongsTo
    {
        return $this->belongsTo(ImportJob::class, 'import_job_id');
    }

    /**
     * Display name formatted as: name + strength + form.
     */
    public function displayName(): string
    {
        $parts = [$this->name];
        if (! empty($this->strength)) {
            $parts[] = $this->strength;
        }
        if (! empty($this->dosage_form)) {
            $parts[] = $this->dosage_form;
        }

        return implode(' ', $parts);
    }
}

