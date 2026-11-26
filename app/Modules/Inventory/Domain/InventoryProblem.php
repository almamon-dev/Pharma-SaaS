<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Domain;

use PharmaCore\Foundation\Domain\DomainProblem;

final class InventoryProblem extends DomainProblem
{
    public static function unsupportedAdjustmentType(): self
    {
        return new self('UNSUPPORTED_ADJUSTMENT_TYPE', 'Unsupported batch adjustment type.', 422, 'adjustment_type');
    }

    public static function expiredBatchCannotReceiveStock(): self
    {
        return new self('EXPIRED_BATCH_ADJUSTMENT_IN', 'Expired batches cannot receive positive shelf adjustments.', 422, 'quantity');
    }

    public static function disposedBatchCannotReturnToShelf(): self
    {
        return new self('DISPOSED_BATCH_ADJUSTMENT_IN', 'Damaged or disposed batches cannot be returned to active shelf stock.', 422, 'quantity');
    }

    public static function minimumQuantityRequired(string $action = 'Adjustment'): self
    {
        return new self('INVALID_QUANTITY', "{$action} quantity must be at least 1 unit.", 422, 'quantity');
    }

    public static function alreadyWrittenOff(): self
    {
        return new self('BATCH_ALREADY_WRITTEN_OFF', 'This batch has already been fully written off.', 422, 'quantity');
    }

    public static function insufficientBatchStock(int $requested, int $available, string $batchNumber): self
    {
        return new self(
            'INSUFFICIENT_BATCH_STOCK',
            "Cannot deduct {$requested} units because only {$available} remain in batch {$batchNumber}.",
            422,
            'quantity',
        );
    }

    public static function sameBranchTransfer(): self
    {
        return new self(
            'SAME_BRANCH_TRANSFER',
            'Target branch must be different from the source branch.',
            422,
            'target_branch_id',
        );
    }

    public static function insufficientTransferStock(int $requested, int $available): self
    {
        return new self(
            'INSUFFICIENT_TRANSFER_STOCK',
            "Cannot transfer {$requested} units. Only {$available} units available in source batch.",
            422,
            'quantity',
        );
    }
}

