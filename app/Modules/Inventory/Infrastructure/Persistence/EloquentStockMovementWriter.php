<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Infrastructure\Persistence;

use App\Models\StockMovement;
use App\Modules\Inventory\Application\Ports\StockMovementWriter;
use DateTimeImmutable;

final class EloquentStockMovementWriter implements StockMovementWriter
{
    public function record(
        int $branchId,
        int $medicineId,
        ?int $batchId,
        string $movementType,
        int $quantityChange,
        int $balanceBefore,
        int $balanceAfter,
        float $unitCost,
        ?string $reason,
        ?string $notes,
        ?int $actorId,
        ?string $referenceType,
        string|int|null $referenceId,
        DateTimeImmutable $occurredAt,
    ): void {
        $resolvedUnitCost = round(max(0, $unitCost), 2);

        StockMovement::query()->create([
            'branch_id' => $branchId,
            'medicine_id' => $medicineId,
            'medicine_batch_id' => $batchId,
            'user_id' => $actorId,
            'movement_type' => $movementType,
            'quantity_change' => $quantityChange,
            'balance_before' => $balanceBefore,
            'balance_after' => $balanceAfter,
            'unit_cost' => $resolvedUnitCost,
            'total_cost' => round(abs($quantityChange) * $resolvedUnitCost, 2),
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'reason' => $reason,
            'notes' => $notes,
            'occurred_at' => $occurredAt,
        ]);
    }
}

