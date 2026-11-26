<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CounterCashMovement extends Model
{
    use BelongsToTenant, HasFactory;

    public const TYPE_CASH_IN = 'cash_in';

    public const TYPE_CASH_OUT = 'cash_out';

    public const TYPE_SAFE_DROP = 'safe_drop';

    public const TYPE_CASH_REFUND = 'cash_refund';

    public const TYPES = [
        self::TYPE_CASH_IN,
        self::TYPE_CASH_OUT,
        self::TYPE_SAFE_DROP,
        self::TYPE_CASH_REFUND,
    ];

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'counter_id',
        'counter_session_id',
        'user_id',
        'approved_by',
        'type',
        'amount',
        'reason',
        'reference_number',
        'notes',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'occurred_at' => 'datetime',
        ];
    }

    public function counter(): BelongsTo
    {
        return $this->belongsTo(Counter::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(CounterSession::class, 'counter_session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}

