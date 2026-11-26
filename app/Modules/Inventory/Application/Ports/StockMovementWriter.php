<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Application\Ports;

use DateTimeImmutable;

interface StockMovementWriter
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
    ): void;
}

