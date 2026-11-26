<?php

declare(strict_types=1);

namespace App\Modules\Sales\Infrastructure\Persistence;

use App\Enums\BatchStatus;
use App\Enums\StockMovementType;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Models\User;
use App\Modules\Sales\Application\Ports\StockAllocationPort;
use App\Modules\Sales\Domain\SalesProblem;
use App\Services\InventoryService;

final class FefoStockAllocationAdapter implements StockAllocationPort
{
    public function __construct(
        private readonly InventoryService $inventoryService,
    ) {}

    public function deductFefoForOrder(int $saleId, int $branchId, int $actorId): void
    {
        /** @var Sale $sale */
        $sale = Sale::query()->with('items.medicine')->findOrFail($saleId);
        $actor = User::query()->find($actorId);

        foreach ($sale->items as $item) {
            $medicine = $item->medicine;
            $requestedUnits = (int) $item->quantity;

            $batches = MedicineBatch::query()
                ->sellable($branchId)
                ->where('medicine_id', $medicine->id)
                ->orderBy('expiry_date', 'asc')
                ->lockForUpdate()
                ->get();

            $totalAvailable = (int) $batches->sum('quantity_available');
            if ($totalAvailable < $requestedUnits) {
                throw SalesProblem::insufficientStock((string) $medicine->name, $requestedUnits, $totalAvailable);
            }

            $remaining = $requestedUnits;
            foreach ($batches as $batch) {
                if ($remaining <= 0) {
                    break;
                }

                $before = (int) $batch->quantity_available;
                $take = min($remaining, $before);
                $after = max(0, $before - $take);

                $batch->quantity_available = $after;
                if ($after === 0) {
                    $batch->status = BatchStatus::DEPLETED->value;
                }
                $batch->save();

                if (! $item->medicine_batch_id) {
                    $item->medicine_batch_id = $batch->id;
                    $item->save();
                }

                $this->inventoryService->recordMovement(
                    branchId: $branchId,
                    medicineId: (int) $medicine->id,
                    batchId: (int) $batch->id,
                    movementType: StockMovementType::SALE,
                    quantityChange: -$take,
                    balanceBefore: $before,
                    balanceAfter: $after,
                    unitCost: (float) $batch->purchase_price,
                    reason: "Counter POS Sale #{$sale->order_number}",
                    actor: $actor,
                    reference: $sale,
                );

                $remaining -= $take;
            }
        }
    }
}

