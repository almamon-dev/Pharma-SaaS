<?php

namespace App\Modules\Accounting\Models;

use App\Models\Concerns\BelongsToTenant;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    use BelongsToTenant;

    public const TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

    public const REPORT_GROUPS = [
        'cash',
        'bank',
        'receivable',
        'inventory',
        'other_current_asset',
        'fixed_asset',
        'payable',
        'vat_input',
        'vat_output',
        'other_liability',
        'equity',
        'revenue',
        'other_income',
        'cogs',
        'operating_expense',
    ];

    protected $fillable = [
        'tenant_id',
        'parent_id',
        'code',
        'name_en',
        'name_bn',
        'type',
        'report_group',
        'is_contra',
        'is_system',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_contra' => 'boolean',
            'is_system' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (Account $account): void {
            if ($account->is_system) {
                throw new DomainException('System accounts cannot be deleted.');
            }

            if ($account->voucherLines()->exists()) {
                throw new DomainException('Accounts with voucher entries cannot be deleted; deactivate instead.');
            }
        });
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('code');
    }

    public function voucherLines(): HasMany
    {
        return $this->hasMany(VoucherLine::class, 'account_id');
    }
}

