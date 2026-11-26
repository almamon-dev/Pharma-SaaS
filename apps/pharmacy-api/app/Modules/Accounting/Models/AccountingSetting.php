<?php

namespace App\Modules\Accounting\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountingSetting extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id',
        'mode',
        'coa_template',
        'fiscal_year_start_month',
        'default_currency',
        'vat_enabled',
        'vat_rate_bps',
        'approval_threshold_paisa',
        'default_cash_account_id',
        'default_bank_account_id',
        'default_wallet_account_id',
        'default_receivable_account_id',
        'default_payable_account_id',
        'default_inventory_account_id',
        'default_cogs_account_id',
        'default_sales_account_id',
        'default_sales_return_account_id',
        'default_vat_input_account_id',
        'default_vat_output_account_id',
        'default_retained_earnings_account_id',
    ];

    protected function casts(): array
    {
        return [
            'fiscal_year_start_month' => 'integer',
            'vat_enabled' => 'boolean',
            'vat_rate_bps' => 'integer',
            'approval_threshold_paisa' => 'integer',
        ];
    }

    public function cashAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'default_cash_account_id');
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'default_bank_account_id');
    }

    public function walletAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'default_wallet_account_id');
    }
}

