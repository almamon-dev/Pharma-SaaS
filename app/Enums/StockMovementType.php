<?php

namespace App\Enums;

enum StockMovementType: string
{
    case OPENING = 'opening';
    case RESTOCK = 'restock';
    case SALE = 'sale';
    case SALE_RETURN = 'sale_return';
    case ADJUSTMENT_IN = 'adjustment_in';
    case ADJUSTMENT_OUT = 'adjustment_out';
    case DAMAGE = 'damage';
    case EXPIRY_DISPOSAL = 'expiry_disposal';
    case SUPPLIER_RETURN = 'supplier_return';
    case TRANSFER_OUT = 'transfer_out';
    case TRANSFER_IN = 'transfer_in';

    public function label(): string
    {
        return match ($this) {
            self::OPENING => 'Opening Stock',
            self::RESTOCK => 'Batch Restock',
            self::SALE => 'POS Sale',
            self::SALE_RETURN => 'Sales Return',
            self::ADJUSTMENT_IN => 'Adjustment (+)',
            self::ADJUSTMENT_OUT => 'Adjustment (-)',
            self::DAMAGE => 'Damage Write-Off',
            self::EXPIRY_DISPOSAL => 'Expiry Disposal',
            self::SUPPLIER_RETURN => 'Supplier Return',
            self::TRANSFER_OUT => 'Transfer Out',
            self::TRANSFER_IN => 'Transfer In',
        };
    }

    public function isInbound(): bool
    {
        return match ($this) {
            self::OPENING, self::RESTOCK, self::SALE_RETURN, self::ADJUSTMENT_IN, self::TRANSFER_IN => true,
            default => false,
        };
    }

    /**
     * @return array<int, array{value: string, label: string, direction: string}>
     */
    public static function filterOptions(): array
    {
        return array_map(
            static fn (self $case) => [
                'value' => $case->value,
                'label' => $case->label(),
                'direction' => $case->isInbound() ? 'in' : 'out',
            ],
            self::cases()
        );
    }
}

