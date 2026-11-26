<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Domain;

/**
 * Pure domain policy enforcing pharmacy batch adjustment safety rules.
 */
final class StockAdjustmentPolicy
{
    /** @var list<string> */
    public const ALLOWED_TYPES = [
        'adjustment_in',
        'adjustment_out',
        'damage',
        'expiry_disposal',
        'supplier_return',
    ];

    public function evaluate(
        string $movementType,
        int $quantity,
        int $currentAvailable,
        string $currentStatus,
        bool $isExpired,
        string $batchNumber,
        bool $disposeEntireBatch = false,
    ): StockAdjustmentOutcome {
        if (! in_array($movementType, self::ALLOWED_TYPES, true)) {
            throw InventoryProblem::unsupportedAdjustmentType();
        }

        if ($movementType === 'adjustment_in') {
            if ($isExpired) {
                throw InventoryProblem::expiredBatchCannotReceiveStock();
            }
            if (in_array($currentStatus, ['damaged', 'disposed'], true)) {
                throw InventoryProblem::disposedBatchCannotReturnToShelf();
            }
            if ($quantity < 1) {
                throw InventoryProblem::minimumQuantityRequired('Adjustment');
            }

            $after = $currentAvailable + $quantity;
            $nextStatus = $currentStatus === 'depleted' ? 'active' : $currentStatus;

            return new StockAdjustmentOutcome(
                quantityChange: $quantity,
                balanceBefore: $currentAvailable,
                balanceAfter: $after,
                nextStatus: $nextStatus,
                markDisposed: false,
            );
        }

        if (in_array($currentStatus, ['damaged', 'disposed'], true) && $currentAvailable <= 0) {
            throw InventoryProblem::alreadyWrittenOff();
        }

        $effectiveQty = ($disposeEntireBatch && in_array($movementType, ['damage', 'expiry_disposal'], true))
            ? $currentAvailable
            : $quantity;

        if ($effectiveQty < 1 && ! ($disposeEntireBatch && $currentAvailable === 0 && $isExpired)) {
            throw InventoryProblem::minimumQuantityRequired('Quantity to deduct');
        }

        if ($effectiveQty > $currentAvailable) {
            throw InventoryProblem::insufficientBatchStock($effectiveQty, $currentAvailable, $batchNumber);
        }

        $after = max(0, $currentAvailable - $effectiveQty);
        $nextStatus = $currentStatus;
        $markDisposed = false;

        if ($movementType === 'expiry_disposal' && ($after === 0 || $disposeEntireBatch)) {
            $nextStatus = 'disposed';
            $markDisposed = true;
        } elseif ($movementType === 'damage' && ($after === 0 || $disposeEntireBatch)) {
            $nextStatus = 'damaged';
            $markDisposed = true;
        } elseif ($after === 0 && $currentStatus === 'active') {
            $nextStatus = 'depleted';
        }

        return new StockAdjustmentOutcome(
            quantityChange: -$effectiveQty,
            balanceBefore: $currentAvailable,
            balanceAfter: $after,
            nextStatus: $nextStatus,
            markDisposed: $markDisposed,
        );
    }
}

