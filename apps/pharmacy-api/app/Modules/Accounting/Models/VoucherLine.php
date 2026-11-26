<?php

namespace App\Modules\Accounting\Models;

use App\Models\Concerns\BelongsToTenant;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VoucherLine extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'voucher_id',
        'account_id',
        'party_id',
        'vat_type',
        'vat_rate_bps',
        'vat_amount_paisa',
        'date',
        'debit_paisa',
        'credit_paisa',
        'narration',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'debit_paisa' => 'integer',
            'credit_paisa' => 'integer',
            'vat_rate_bps' => 'integer',
            'vat_amount_paisa' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (VoucherLine $line): void {
            $debit = (int) $line->debit_paisa;
            $credit = (int) $line->credit_paisa;

            if ($debit < 0 || $credit < 0) {
                throw new DomainException('Voucher line amounts cannot be negative.');
            }

            if ($debit > 0 && $credit > 0) {
                throw new DomainException('A voucher line must have either debit or credit, never both.');
            }

            if ($debit === 0 && $credit === 0) {
                throw new DomainException('A voucher line must have a non-zero debit or credit amount.');
            }
        });

        static::updating(function (VoucherLine $line): void {
            $parentStatus = $line->voucher()->value('status');
            if (in_array($parentStatus, [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED], true)) {
                throw new DomainException('Lines of a posted voucher are immutable and cannot be edited.');
            }
        });

        static::deleting(function (VoucherLine $line): void {
            $parentStatus = $line->voucher()->value('status');
            if (in_array($parentStatus, [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED], true)) {
                throw new DomainException('Lines of a posted voucher are immutable and cannot be deleted.');
            }
        });
    }

    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class, 'voucher_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id');
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class, 'party_id');
    }
}

