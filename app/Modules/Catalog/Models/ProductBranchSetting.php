<?php

namespace App\Modules\Catalog\Models;

use App\Models\Branch;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductBranchSetting extends Model
{
    use HasFactory, BelongsToTenant;

    protected $table = 'product_branch_settings';

    // Composite primary key
    protected $primaryKey = ['product_id', 'branch_id'];
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'tenant_id',
        'product_id',
        'branch_id',
        'min_stock',
        'reorder_qty',
        'shelf_location',
    ];

    protected function casts(): array
    {
        return [
            'min_stock' => 'integer',
            'reorder_qty' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }
}

