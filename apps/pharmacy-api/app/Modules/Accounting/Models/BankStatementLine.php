<?php

namespace App\Modules\Accounting\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankStatementLine extends Model
{
    use BelongsToTenant;

    public const STATUS_UNMATCHED = 'unmatched';

    public const STATUS_MATCHED = 'matched';

    public const STATUS_IGNORED = 'ignored';

    protected $fillable = [
        'tenant_id',
        'bank_statement_id',
        'line_date',
        'reference',
        'description',
        'debit_paisa',
        'credit_paisa',
        'status',
        'matched_voucher_line_id',
        'match_method',
        'matched_at',
        'matched_by',
    ];

    protected function casts(): array
    {
        return [
            'line_date' => 'date',
            'debit_paisa' => 'integer',
            'credit_paisa' => 'integer',
            'matched_at' => 'datetime',
        ];
    }

    public function statement(): BelongsTo
    {
        return $this->belongsTo(BankStatement::class, 'bank_statement_id');
    }

    public function matchedVoucherLine(): BelongsTo
    {
        return $this->belongsTo(VoucherLine::class, 'matched_voucher_line_id');
    }

    public function matcher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'matched_by');
    }
}

