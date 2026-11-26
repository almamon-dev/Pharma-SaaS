<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Infrastructure\Persistence;

use App\Enums\BatchStatus;
use App\Models\MedicineBatch;
use App\Modules\Inventory\Application\DTO\BatchSnapshot;
use App\Modules\Inventory\Application\Ports\BatchRepository;
use DateTimeImmutable;

final class EloquentBatchRepository implements BatchRepository
{
    public function lockForUpdate(int $batchId): BatchSnapshot
    {
        /** @var MedicineBatch $batch */
        $batch = MedicineBatch::query()->with('branch')->lockForUpdate()->findOrFail($batchId);

        return $this->toSnapshot($batch);
    }

    public function updateAfterAdjustment(
        int $batchId,
        int $quantityAvailable,
        string $status,
        bool $markDisposed,
        ?DateTimeImmutable $disposedAt,
        ?string $disposalReason,
        ?int $disposedById,
    ): BatchSnapshot {
        /** @var MedicineBatch $batch */
        $batch = MedicineBatch::query()->findOrFail($batchId);
        $batch->quantity_available = $quantityAvailable;
        $batch->status = $status;

        if ($markDisposed) {
            $batch->disposed_at = $disposedAt;
            $batch->disposal_reason = $disposalReason;
            $batch->disposed_by = $disposedById;
        }

        $batch->save();

        return $this->toSnapshot($batch->fresh(['branch']));
    }

    public function deductForTransfer(int $batchId, int $quantityAfter, string $nextStatus): BatchSnapshot
    {
        /** @var MedicineBatch $batch */
        $batch = MedicineBatch::query()->findOrFail($batchId);
        $batch->quantity_available = $quantityAfter;
        $batch->status = $nextStatus;
        $batch->save();

        return $this->toSnapshot($batch->fresh(['branch']));
    }

    public function creditTransferTarget(BatchSnapshot $source, int $targetBranchId, int $quantity): array
    {
        $targetBatch = MedicineBatch::query()
            ->where('branch_id', $targetBranchId)
            ->where('medicine_id', $source->medicineId)
            ->where('batch_number', $source->batchNumber)
            ->lockForUpdate()
            ->first();

        $beforeTarget = 0;
        if ($targetBatch !== null) {
            $beforeTarget = (int) $targetBatch->quantity_available;
            $afterTarget = $beforeTarget + $quantity;
            $targetBatch->quantity_available = $afterTarget;
            $targetBatch->quantity_received += $quantity;
            if ($targetBatch->status === BatchStatus::DEPLETED->value && $afterTarget > 0) {
                $targetBatch->status = BatchStatus::ACTIVE->value;
            }
            $targetBatch->save();
        } else {
            $afterTarget = $quantity;
            $targetBatch = MedicineBatch::query()->create([
                'branch_id' => $targetBranchId,
                'medicine_id' => $source->medicineId,
                'supplier_id' => $source->supplierId,
                'batch_number' => $source->batchNumber,
                'manufacturing_date' => $source->manufacturingDate,
                'expiry_date' => $source->expiryDate,
                'quantity_received' => $quantity,
                'quantity_available' => $quantity,
                'purchase_price' => $source->purchasePrice,
                'selling_price' => $source->sellingPrice,
                'rack_location' => $source->rackLocation,
                'status' => BatchStatus::ACTIVE->value,
                'notes' => "Transferred from {$source->branchName}",
            ]);
        }

        return [
            'batch' => $this->toSnapshot($targetBatch->fresh(['branch'])),
            'balance_before' => $beforeTarget,
            'balance_after' => $afterTarget,
        ];
    }

    private function toSnapshot(MedicineBatch $batch): BatchSnapshot
    {
        return new BatchSnapshot(
            id: (int) $batch->id,
            tenantId: (int) $batch->tenant_id,
            branchId: (int) $batch->branch_id,
            branchName: $batch->branch?->name,
            medicineId: (int) $batch->medicine_id,
            supplierId: $batch->supplier_id !== null ? (int) $batch->supplier_id : null,
            batchNumber: (string) $batch->batch_number,
            manufacturingDate: $batch->manufacturing_date?->toDateString(),
            expiryDate: (string) ($batch->expiry_date?->toDateString() ?? ''),
            quantityReceived: (int) $batch->quantity_received,
            quantityAvailable: (int) $batch->quantity_available,
            purchasePrice: (float) $batch->purchase_price,
            sellingPrice: (float) $batch->selling_price,
            rackLocation: $batch->rack_location,
            status: (string) $batch->status,
            isExpired: $batch->isExpired(),
        );
    }
}

