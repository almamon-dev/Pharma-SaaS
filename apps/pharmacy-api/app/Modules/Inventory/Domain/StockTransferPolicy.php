<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Domain;

/**
 * Pure domain policy enforcing inter-branch stock transfer invariants.
 */
final class StockTransferPolicy
{
    public function assertCanTransfer(
        int $sourceBranchId,
        int $targetBranchId,
        int $requestedQuantity,
        int $availableQuantity,
    ): void {
        if ($sourceBranchId === $targetBranchId) {
            throw InventoryProblem::sameBranchTransfer();
        }

        if ($requestedQuantity <= 0 || $requestedQuantity > $availableQuantity) {
            throw InventoryProblem::insufficientTransferStock($requestedQuantity, $availableQuantity);
        }
    }
}

