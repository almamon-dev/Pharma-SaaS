<?php

namespace App\Modules\Accounting\Models;

use App\Models\Branch;
use App\Models\Concerns\BelongsToTenant;
use App\Models\User;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Voucher extends Model
{
    use BelongsToTenant;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING_APPROVAL = 'pending_approval';
    public const STATUS_POSTED = 'posted';
    public const STATUS_REVERSED = 'reversed';

    public const TYPES = [
        'receipt' => 'RCP',
        'payment' => 'PAY',
        'journal' => 'JRN',
        'contra' => 'CNT',
        'sales' => 'SLS',
        'purchase' => 'PUR',
        'sales_return' => 'SRN',
        'purchase_return' => 'PRN',
        'opening_balance' => 'OPN',
        'stock_adjustment' => 'ADJ',
        'payroll' => 'PRL',
    ];

    /**
     * Internal flag allowed strictly by VoucherService::reverse() when marking a posted voucher as reversed.
     */
    public bool $allowReversalLinkUpdate = false;

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'fiscal_year_id',
        'fiscal_period_id',
        'type',
        'number',
        'date',
        'status',
        'narration',
        'total_debit_paisa',
        'total_credit_paisa',
        'source_module',
        'source_id',
        'source_event',
        'reversed_voucher_id',
        'reversal_of_voucher_id',
        'attachments',
        'created_by',
        'approved_by',
        'posted_by',
        'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'total_debit_paisa' => 'integer',
            'total_credit_paisa' => 'integer',
            'attachments' => 'array',
            'posted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (Voucher $voucher): void {
            $originalStatus = $voucher->getOriginal('status');

            if (in_array($originalStatus, [self::STATUS_POSTED, self::STATUS_REVERSED], true)) {
                $dirtyKeys = array_keys($voucher->getDirty());
                $allowedReversalKeys = ['status', 'reversed_voucher_id', 'updated_at'];

                $isOfficialReversalTransition = $voucher->allowReversalLinkUpdate
                    && $originalStatus === self::STATUS_POSTED
                    && $voucher->status === self::STATUS_REVERSED
                    && empty(array_diff($dirtyKeys, $allowedReversalKeys));

                if (! $isOfficialReversalTransition) {
                    throw new DomainException('Posted vouchers are immutable and cannot be edited. Create a reversal voucher instead.');
                }
            }
        });

        static::deleting(function (Voucher $voucher): void {
            if (in_array($voucher->status, [self::STATUS_POSTED, self::STATUS_REVERSED], true)) {
                throw new DomainException('Posted vouchers are immutable and cannot be deleted. Create a reversal voucher instead.');
            }
        });
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function fiscalYear(): BelongsTo
    {
        return $this->belongsTo(FiscalYear::class, 'fiscal_year_id');
    }

    public function fiscalPeriod(): BelongsTo
    {
        return $this->belongsTo(FiscalPeriod::class, 'fiscal_period_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(VoucherLine::class, 'voucher_id')->orderBy('id');
    }

    public function reversedVoucher(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reversed_voucher_id');
    }

    public function reversalOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reversal_of_voucher_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function poster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'posted_by');
    }
}

