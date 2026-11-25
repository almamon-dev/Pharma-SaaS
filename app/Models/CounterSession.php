<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use LogicException;

class CounterSession extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'counter_id',
        'user_id',
        'closed_by',
        'is_force_closed',
        'force_close_reason',
        'status',
        'shift', // 'morning', 'evening', 'night'
        'z_report_number',
        'opened_at',
        'closed_at',
        'opening_float',
        'opening_denominations',
        'cash_sales_total',
        'card_sales_total',
        'mobile_sales_total',
        'cash_in_total',
        'cash_out_total',
        'cash_refunds_total',
        'closing_cash_counted',
        'closing_denominations',
        'system_expected_cash',
        'discrepancy',
        'total_sales_amount',
        'total_transactions',
        'notes',
        'z_report_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'is_force_closed' => 'boolean',
            'opening_float' => 'decimal:2',
            'opening_denominations' => 'array',
            'cash_sales_total' => 'decimal:2',
            'card_sales_total' => 'decimal:2',
            'mobile_sales_total' => 'decimal:2',
            'cash_in_total' => 'decimal:2',
            'cash_out_total' => 'decimal:2',
            'cash_refunds_total' => 'decimal:2',
            'closing_cash_counted' => 'decimal:2',
            'closing_denominations' => 'array',
            'system_expected_cash' => 'decimal:2',
            'discrepancy' => 'decimal:2',
            'total_sales_amount' => 'decimal:2',
            'total_transactions' => 'integer',
            'z_report_snapshot' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (self $session): void {
            if ($session->getOriginal('status') === 'closed') {
                throw new LogicException('Closed shift sessions are immutable and cannot be modified.');
            }
        });
    }

    public function counter(): BelongsTo
    {
        return $this->belongsTo(Counter::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function breakLogs(): HasMany
    {
        return $this->hasMany(CounterBreakLog::class);
    }

    public function cashMovements(): HasMany
    {
        return $this->hasMany(CounterCashMovement::class);
    }
}
