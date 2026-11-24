<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CounterSession extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'counter_id',
        'user_id',
        'status',
        'opened_at',
        'closed_at',
        'opening_float',
        'closing_cash_counted',
        'system_expected_cash',
        'discrepancy',
        'total_sales_amount',
        'total_transactions',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'opening_float' => 'decimal:2',
            'closing_cash_counted' => 'decimal:2',
            'system_expected_cash' => 'decimal:2',
            'discrepancy' => 'decimal:2',
            'total_sales_amount' => 'decimal:2',
            'total_transactions' => 'integer',
        ];
    }

    public function counter(): BelongsTo
    {
        return $this->belongsTo(Counter::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
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
}

