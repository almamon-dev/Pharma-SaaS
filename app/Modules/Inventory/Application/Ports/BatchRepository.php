<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Application\Ports;

use App\Modules\Inventory\Application\DTO\BatchSnapshot;
use DateTimeImmutable;

interface BatchRepository
{
    public function lockForUpdate(int $batchId): BatchSnapshot;

    public function updateAfterAdjustment(
        int $batchId,
        int $quantityAvailable,
        string $status,
        bool $markDisposed,
        ?DateTimeImmutable $disposedAt,
        ?string $disposalReason,
        ?int $disposedById,
    ): BatchSnapshot;

    public function deductForTransfer(int $batchId, int $quantityAfter, string $nextStatus): BatchSnapshot;

    /**
     * Credit target branch with transferred quantity (updating existing batch or creating new batch).
     *
     * @return array{batch: BatchSnapshot, balance_before: int, balance_after: int}
     */
    public function creditTransferTarget(BatchSnapshot $source, int $targetBranchId, int $quantity): array;
}

