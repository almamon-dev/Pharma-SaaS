<?php

namespace App\Modules\Accounting\Models;

use App\Models\Branch;
use App\Models\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankStatement extends Model
{
    use BelongsToTenant;

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_RECONCILED = 'reconciled';

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'account_id',
        'statement_date',
        'filename',
        'opening_balance_paisa',
        'closing_balance_paisa',
        'status',
        'uploaded_by',
        'reconciled_at',
    ];

    protected function casts(): array
    {
        return [
            'statement_date' => 'date',
            'opening_balance_paisa' => 'integer',
            'closing_balance_paisa' => 'integer',
            'reconciled_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(BankStatementLine::class)->orderBy('line_date')->orderBy('id');
    }
}

