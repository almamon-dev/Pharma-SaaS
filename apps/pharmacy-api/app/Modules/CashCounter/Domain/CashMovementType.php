<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Domain;

enum CashMovementType: string
{
    case CASH_IN = 'cash_in';
    case CASH_OUT = 'cash_out';
    case SAFE_DROP = 'safe_drop';
    case CASH_REFUND = 'cash_refund';

    public function label(): string
    {
        return match ($this) {
            self::CASH_IN => 'Cash In (Float Top-up)',
            self::CASH_OUT => 'Cash Out (Expense)',
            self::SAFE_DROP => 'Safe Drop to Vault',
            self::CASH_REFUND => 'Cash Refund',
        };
    }

    public function shortLabel(): string
    {
        return match ($this) {
            self::CASH_IN => 'Cash In',
            self::CASH_OUT => 'Cash Out',
            self::SAFE_DROP => 'Safe Drop',
            self::CASH_REFUND => 'Cash Refund',
        };
    }

    public function isInflow(): bool
    {
        return $this === self::CASH_IN;
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $case): string => $case->value, self::cases());
    }
}

