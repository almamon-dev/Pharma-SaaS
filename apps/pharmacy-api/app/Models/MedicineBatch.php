<?php

namespace App\Models;

use App\Enums\BatchStatus;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MedicineBatch extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'medicine_id',
        'supplier_id',
        'batch_number',
        'manufacturing_date',
        'expiry_date',
        'quantity_received',
        'quantity_available',
        'purchase_price',
        'selling_price',
        'rack_location',
        'status',
        'disposed_at',
        'disposal_reason',
        'disposed_by',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'manufacturing_date' => 'date',
            'expiry_date' => 'date',
            'quantity_received' => 'integer',
            'quantity_available' => 'integer',
            'purchase_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'disposed_at' => 'datetime',
        ];
    }

    /**
     * Batches strictly eligible for dispensing at POS (active, positive qty, unexpired, optional branch).
     */
    public function scopeSellable(Builder $query, ?int $branchId = null): Builder
    {
        return $query
            ->where('status', BatchStatus::ACTIVE->value)
            ->where('quantity_available', '>', 0)
            ->whereDate('expiry_date', '>=', today()->toDateString())
            ->when($branchId !== null, static function (Builder $builder) use ($branchId): void {
                $builder->where('branch_id', $branchId);
            });
    }

    public function isExpired(): bool
    {
        return $this->status === BatchStatus::EXPIRED->value
            || ($this->expiry_date !== null && $this->expiry_date->lt(today()));
    }

    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class)->withTrashed();
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class)->withTrashed();
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function disposer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'disposed_by');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
