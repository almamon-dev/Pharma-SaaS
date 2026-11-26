<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Application;

use App\Modules\Foundation\Application\Ports\AuditLogger;
use App\Modules\Inventory\Application\DTO\AdjustBatchCommand;
use App\Modules\Inventory\Application\DTO\BatchSnapshot;
use App\Modules\Inventory\Application\DTO\TransferBatchCommand;
use App\Modules\Inventory\Application\Ports\BatchRepository;
use App\Modules\Inventory\Application\Ports\MedicineBarcodeChecker;
use App\Modules\Inventory\Application\Ports\StockMovementWriter;
use App\Modules\Inventory\Domain\Ean13BarcodeGenerator;
use App\Modules\Inventory\Domain\PackagingPricing;
use App\Modules\Inventory\Domain\StockAdjustmentPolicy;
use App\Modules\Inventory\Domain\StockTransferPolicy;
use PharmaCore\Foundation\Application\Clock;
use PharmaCore\Foundation\Application\TransactionManager;

/**
 * Pure framework-free Application Workflow for pharmacy stock control operations.
 */
final class StockControlWorkflow
{
    public function __construct(
        private readonly BatchRepository $batches,
        private readonly StockMovementWriter $movements,
        private readonly MedicineBarcodeChecker $barcodeChecker,
        private readonly StockAdjustmentPolicy $adjustmentPolicy,
        private readonly StockTransferPolicy $transferPolicy,
        private readonly TransactionManager $transactions,
        private readonly AuditLogger $auditLogger,
        private readonly Clock $clock,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     */
    public function normalizePricing(array $input): PackagingPricing
    {
        return PackagingPricing::fromInput($input);
    }

    public function generateUniqueEan13(int $tenantId): string
    {
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $candidate = Ean13BarcodeGenerator::candidateForTenant($tenantId);
            if (! $this->barcodeChecker->existsForTenant($candidate)) {
                return $candidate;
            }
        }

        return '20'.substr((string) (int) (microtime(true) * 1000), -11);
    }

    public function adjustBatch(AdjustBatchCommand $command): BatchSnapshot
    {
        $now = $this->clock->now();

        /** @var BatchSnapshot */
        return $this->transactions->run(function () use ($command, $now): BatchSnapshot {
            $locked = $this->batches->lockForUpdate($command->batchId);
            $cleanReason = trim($command->reason);
            $cleanNotes = $command->notes !== null && trim($command->notes) !== '' ? trim($command->notes) : null;

            $outcome = $this->adjustmentPolicy->evaluate(
                movementType: $command->movementType,
                quantity: $command->quantity,
                currentAvailable: $locked->quantityAvailable,
                currentStatus: $locked->status,
                isExpired: $locked->isExpired,
                batchNumber: $locked->batchNumber,
                disposeEntireBatch: $command->disposeEntireBatch,
            );

            $updated = $this->batches->updateAfterAdjustment(
                batchId: $locked->id,
                quantityAvailable: $outcome->balanceAfter,
                status: $outcome->nextStatus,
                markDisposed: $outcome->markDisposed,
                disposedAt: $outcome->markDisposed ? $now : null,
                disposalReason: $outcome->markDisposed ? $cleanReason : null,
                disposedById: $outcome->markDisposed ? $command->actorId : null,
            );

            if ($outcome->quantityChange !== 0) {
                $this->movements->record(
                    branchId: $locked->branchId,
                    medicineId: $locked->medicineId,
                    batchId: $locked->id,
                    movementType: $command->movementType,
                    quantityChange: $outcome->quantityChange,
                    balanceBefore: $outcome->balanceBefore,
                    balanceAfter: $outcome->balanceAfter,
                    unitCost: $locked->purchasePrice,
                    reason: $cleanReason,
                    notes: $cleanNotes,
                    actorId: $command->actorId,
                    referenceType: 'App\\Models\\MedicineBatch',
                    referenceId: $locked->id,
                    occurredAt: $now,
                );
            }

            $isPositive = $outcome->quantityChange > 0;
            $absQty = abs($outcome->quantityChange);

            $auditAction = match ($command->movementType) {
                'damage' => 'inventory.batch_damaged',
                'expiry_disposal' => 'inventory.batch_disposed',
                'supplier_return' => 'inventory.batch_supplier_returned',
                default => 'inventory.batch_adjusted',
            };

            $description = $isPositive
                ? "Adjusted batch {$locked->batchNumber} by +{$absQty} ({$cleanReason})."
                : "{$command->movementLabel} on batch {$locked->batchNumber} (-{$absQty}): {$cleanReason}.";

            $metadata = [
                'before' => $outcome->balanceBefore,
                'after' => $outcome->balanceAfter,
                'type' => $command->movementType,
            ];
            if (! $isPositive) {
                $metadata['status'] = $updated->status;
                $metadata['cost_loss'] = round($absQty * $locked->purchasePrice, 2);
            }

            $this->auditLogger->record(
                action: $auditAction,
                description: $description,
                subjectType: 'App\\Models\\MedicineBatch',
                subjectId: $locked->id,
                metadata: $metadata,
                tenantId: $locked->tenantId,
                userId: $command->actorId,
            );

            return $updated;
        });
    }

    /**
     * @return array{source: BatchSnapshot, target: BatchSnapshot}
     */
    public function transferBatch(TransferBatchCommand $command): array
    {
        $now = $this->clock->now();

        /** @var array{source: BatchSnapshot, target: BatchSnapshot} */
        return $this->transactions->run(function () use ($command, $now): array {
            $lockedSource = $this->batches->lockForUpdate($command->sourceBatchId);

            $this->transferPolicy->assertCanTransfer(
                sourceBranchId: $lockedSource->branchId,
                targetBranchId: $command->targetBranchId,
                requestedQuantity: $command->quantity,
                availableQuantity: $lockedSource->quantityAvailable,
            );

            $beforeSource = $lockedSource->quantityAvailable;
            $afterSource = $beforeSource - $command->quantity;
            $nextSourceStatus = ($afterSource === 0 && $lockedSource->status === 'active')
                ? 'depleted'
                : $lockedSource->status;

            $updatedSource = $this->batches->deductForTransfer(
                batchId: $lockedSource->id,
                quantityAfter: $afterSource,
                nextStatus: $nextSourceStatus,
            );

            $creditResult = $this->batches->creditTransferTarget(
                source: $lockedSource,
                targetBranchId: $command->targetBranchId,
                quantity: $command->quantity,
            );
            $targetBatch = $creditResult['batch'];

            $cleanReason = trim((string) ($command->reason ?: "Branch transfer to {$command->targetBranchName}"));

            $this->movements->record(
                branchId: $lockedSource->branchId,
                medicineId: $lockedSource->medicineId,
                batchId: $lockedSource->id,
                movementType: 'transfer_out',
                quantityChange: -$command->quantity,
                balanceBefore: $beforeSource,
                balanceAfter: $afterSource,
                unitCost: $lockedSource->purchasePrice,
                reason: $cleanReason,
                notes: $command->notes,
                actorId: $command->actorId,
                referenceType: 'App\\Models\\MedicineBatch',
                referenceId: $targetBatch->id,
                occurredAt: $now,
            );

            $this->movements->record(
                branchId: $command->targetBranchId,
                medicineId: $lockedSource->medicineId,
                batchId: $targetBatch->id,
                movementType: 'transfer_in',
                quantityChange: $command->quantity,
                balanceBefore: $creditResult['balance_before'],
                balanceAfter: $creditResult['balance_after'],
                unitCost: $lockedSource->purchasePrice,
                reason: "Received from {$lockedSource->branchName}: {$cleanReason}",
                notes: $command->notes,
                actorId: $command->actorId,
                referenceType: 'App\\Models\\MedicineBatch',
                referenceId: $lockedSource->id,
                occurredAt: $now,
            );

            $this->auditLogger->record(
                action: 'inventory.batch_transferred',
                description: "Transferred {$command->quantity} units of batch {$lockedSource->batchNumber} from {$lockedSource->branchName} to {$command->targetBranchName}.",
                subjectType: 'App\\Models\\MedicineBatch',
                subjectId: $lockedSource->id,
                metadata: [
                    'quantity' => $command->quantity,
                    'source_branch_id' => $lockedSource->branchId,
                    'target_branch_id' => $command->targetBranchId,
                ],
                tenantId: $lockedSource->tenantId,
                userId: $command->actorId,
            );

            return [
                'source' => $updatedSource,
                'target' => $targetBatch,
            ];
        });
    }
}

