<?php

namespace App\Services;

use App\Enums\BatchStatus;
use App\Enums\StockMovementType;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\StockMovement;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    /**
     * Normalize piece and box pricing from validated request inputs.
     *
     * @param  array<string, mixed>  $validated
     * @return array{
     *     units_per_strip: int,
     *     units_per_box: int,
     *     default_purchase_price: float,
     *     box_purchase_price: ?float,
     *     default_selling_price: float,
     *     box_selling_price: ?float,
     * }
     */
    public function normalizePricing(array $validated): array
    {
        $unitsPerStrip = max(1, (int) ($validated['units_per_strip'] ?? 1));
        $unitsPerBox = max(1, (int) ($validated['units_per_box'] ?? 1));

        $hasPiecePurchase = isset($validated['purchase_price']) && $validated['purchase_price'] !== '' && $validated['purchase_price'] !== null;
        $hasBoxPurchase = isset($validated['box_purchase_price']) && $validated['box_purchase_price'] !== '' && $validated['box_purchase_price'] !== null;
        $hasPieceSelling = isset($validated['selling_price']) && $validated['selling_price'] !== '' && $validated['selling_price'] !== null;
        $hasBoxSelling = isset($validated['box_selling_price']) && $validated['box_selling_price'] !== '' && $validated['box_selling_price'] !== null;

        $unitPurchase = $hasPiecePurchase
            ? round((float) $validated['purchase_price'], 2)
            : round(((float) ($validated['box_purchase_price'] ?? 0)) / $unitsPerBox, 2);

        $unitSelling = $hasPieceSelling
            ? round((float) $validated['selling_price'], 2)
            : round(((float) ($validated['box_selling_price'] ?? 0)) / $unitsPerBox, 2);

        $boxPurchase = $hasBoxPurchase
            ? round((float) $validated['box_purchase_price'], 2)
            : ($unitsPerBox > 1 ? round($unitPurchase * $unitsPerBox, 2) : null);

        $boxSelling = $hasBoxSelling
            ? round((float) $validated['box_selling_price'], 2)
            : ($unitsPerBox > 1 ? round($unitSelling * $unitsPerBox, 2) : null);

        return [
            'units_per_strip' => $unitsPerStrip,
            'units_per_box' => $unitsPerBox,
            'default_purchase_price' => $unitPurchase,
            'box_purchase_price' => $boxPurchase,
            'default_selling_price' => $unitSelling,
            'box_selling_price' => $boxSelling,
        ];
    }

    /**
     * Create a medicine SKU and optional opening FEFO batch atomically.
     *
     * @param  array<string, mixed>  $validated
     */
    public function createMedicine(
        Tenant $tenant,
        ?Branch $branch,
        array $validated,
        ?User $actor = null
    ): Medicine {
        return DB::transaction(function () use ($tenant, $branch, $validated, $actor): Medicine {
            $barcode = ! empty($validated['barcode'])
                ? trim((string) $validated['barcode'])
                : $this->generateUniqueEan13($tenant->id);

            $pricing = $this->normalizePricing($validated);

            $medicine = Medicine::query()->create([
                'category_id' => $validated['category_id'] ?? null,
                'name' => trim((string) $validated['name']),
                'generic_name' => $validated['generic_name'] ?? null,
                'manufacturer' => $validated['manufacturer'] ?? null,
                'sku' => strtoupper(trim((string) $validated['sku'])),
                'barcode' => $barcode,
                'dosage_form' => $validated['dosage_form'],
                'strength' => $validated['strength'] ?? null,
                'description' => $validated['description'] ?? null,
                'unit' => $validated['unit'],
                'units_per_strip' => $pricing['units_per_strip'],
                'units_per_box' => $pricing['units_per_box'],
                'reorder_level' => (int) $validated['reorder_level'],
                'requires_prescription' => (bool) ($validated['requires_prescription'] ?? false),
                'default_purchase_price' => $pricing['default_purchase_price'],
                'box_purchase_price' => $pricing['box_purchase_price'],
                'default_selling_price' => $pricing['default_selling_price'],
                'box_selling_price' => $pricing['box_selling_price'],
                'is_active' => true,
            ]);

            if ($branch && ! empty($validated['batch_number']) && ! empty($validated['quantity']) && ! empty($validated['expiry_date'])) {
                $this->addBatch(
                    branch: $branch,
                    medicine: $medicine,
                    validated: [
                        'batch_number' => $validated['batch_number'],
                        'supplier_id' => $validated['supplier_id'] ?? null,
                        'quantity' => (int) $validated['quantity'],
                        'expiry_date' => $validated['expiry_date'],
                        'purchase_price' => $pricing['default_purchase_price'],
                        'selling_price' => $pricing['default_selling_price'],
                        'rack_location' => $validated['rack_location'] ?? null,
                        'notes' => 'Opening stock batch',
                    ],
                    movementType: StockMovementType::OPENING,
                    actor: $actor,
                    reference: $medicine,
                );
            }

            AuditLog::record(
                action: 'inventory.medicine_created',
                description: "Added {$medicine->name} ({$medicine->sku}) to tenant catalog.",
                subject: $medicine,
                userId: $actor?->id,
            );

            return $medicine;
        });
    }

    /**
     * Update medicine catalog metadata, pricing, and packaging rules.
     *
     * @param  array<string, mixed>  $validated
     */
    public function updateMedicine(Medicine $medicine, array $validated, ?User $actor = null): Medicine
    {
        return DB::transaction(function () use ($medicine, $validated, $actor): Medicine {
            $pricing = $this->normalizePricing($validated);
            $barcode = ! empty($validated['barcode'])
                ? trim((string) $validated['barcode'])
                : ($medicine->barcode ?: $this->generateUniqueEan13((int) $medicine->tenant_id));

            $medicine->update([
                'category_id' => $validated['category_id'] ?? null,
                'name' => trim((string) $validated['name']),
                'generic_name' => $validated['generic_name'] ?? null,
                'manufacturer' => $validated['manufacturer'] ?? null,
                'sku' => strtoupper(trim((string) $validated['sku'])),
                'barcode' => $barcode,
                'dosage_form' => $validated['dosage_form'],
                'strength' => $validated['strength'] ?? null,
                'description' => $validated['description'] ?? null,
                'unit' => $validated['unit'],
                'units_per_strip' => $pricing['units_per_strip'],
                'units_per_box' => $pricing['units_per_box'],
                'reorder_level' => (int) $validated['reorder_level'],
                'requires_prescription' => (bool) ($validated['requires_prescription'] ?? false),
                'default_purchase_price' => $pricing['default_purchase_price'],
                'box_purchase_price' => $pricing['box_purchase_price'],
                'default_selling_price' => $pricing['default_selling_price'],
                'box_selling_price' => $pricing['box_selling_price'],
            ]);

            AuditLog::record(
                action: 'inventory.medicine_updated',
                description: "Updated catalog profile and pricing for {$medicine->name} ({$medicine->sku}).",
                subject: $medicine,
                metadata: [
                    'default_selling_price' => $pricing['default_selling_price'],
                    'box_selling_price' => $pricing['box_selling_price'],
                    'units_per_box' => $pricing['units_per_box'],
                ],
                userId: $actor?->id,
            );

            return $medicine->fresh();
        });
    }

    public function toggleArchiveMedicine(Medicine $medicine, ?User $actor = null): Medicine
    {
        return DB::transaction(function () use ($medicine, $actor): Medicine {
            $nextState = ! (bool) $medicine->is_active;
            $medicine->update(['is_active' => $nextState]);

            AuditLog::record(
                action: $nextState ? 'inventory.medicine_restored' : 'inventory.medicine_archived',
                description: ($nextState ? 'Restored' : 'Archived')." medicine {$medicine->name} ({$medicine->sku}).",
                subject: $medicine,
                userId: $actor?->id,
            );

            return $medicine->fresh();
        });
    }

    /**
     * Add a new FEFO stock batch to a branch and record an immutable inbound StockMovement.
     *
     * @param  array<string, mixed>  $validated
     */
    public function addBatch(
        Branch $branch,
        Medicine $medicine,
        array $validated,
        StockMovementType $movementType = StockMovementType::RESTOCK,
        ?User $actor = null,
        ?Model $reference = null,
    ): MedicineBatch {
        return DB::transaction(function () use ($branch, $medicine, $validated, $movementType, $actor, $reference): MedicineBatch {
            $batchNumber = strtoupper(trim((string) $validated['batch_number']));

            $exists = MedicineBatch::query()
                ->where('branch_id', $branch->id)
                ->where('medicine_id', $medicine->id)
                ->where('batch_number', $batchNumber)
                ->exists();

            if ($exists) {
                throw ValidationException::withMessages([
                    'batch_number' => "Batch \"{$batchNumber}\" already exists for {$medicine->name} in {$branch->name}. Use a new batch number or adjust that batch directly.",
                ]);
            }

            $quantity = max(1, (int) $validated['quantity']);
            $unitsPerBox = max(1, (int) ($medicine->units_per_box ?: 1));

            $unitPurchase = isset($validated['purchase_price']) && $validated['purchase_price'] !== ''
                ? round((float) $validated['purchase_price'], 2)
                : (isset($validated['box_purchase_price']) && $validated['box_purchase_price'] !== ''
                    ? round(((float) $validated['box_purchase_price']) / $unitsPerBox, 2)
                    : (float) $medicine->default_purchase_price);

            $unitSelling = isset($validated['selling_price']) && $validated['selling_price'] !== ''
                ? round((float) $validated['selling_price'], 2)
                : (isset($validated['box_selling_price']) && $validated['box_selling_price'] !== ''
                    ? round(((float) $validated['box_selling_price']) / $unitsPerBox, 2)
                    : (float) $medicine->default_selling_price);

            $batch = MedicineBatch::query()->create([
                'branch_id' => $branch->id,
                'medicine_id' => $medicine->id,
                'supplier_id' => ! empty($validated['supplier_id']) ? (int) $validated['supplier_id'] : null,
                'batch_number' => $batchNumber,
                'expiry_date' => $validated['expiry_date'],
                'quantity_received' => $quantity,
                'quantity_available' => $quantity,
                'purchase_price' => $unitPurchase,
                'selling_price' => $unitSelling,
                'rack_location' => ! empty($validated['rack_location']) ? trim((string) $validated['rack_location']) : null,
                'status' => BatchStatus::ACTIVE->value,
                'notes' => ! empty($validated['notes']) ? trim((string) $validated['notes']) : null,
            ]);

            $this->recordMovement(
                branchId: $branch->id,
                medicineId: $medicine->id,
                batchId: $batch->id,
                movementType: $movementType,
                quantityChange: $quantity,
                balanceBefore: 0,
                balanceAfter: $quantity,
                unitCost: $unitPurchase,
                reason: $movementType === StockMovementType::OPENING
                    ? 'Opening batch created'
                    : 'Batch restock received',
                notes: $batch->notes,
                actor: $actor,
                reference: $reference ?? $batch,
            );

            AuditLog::record(
                action: $movementType === StockMovementType::OPENING ? 'inventory.opening_batch_added' : 'inventory.batch_restocked',
                description: "Added batch {$batch->batch_number} (+{$quantity} {$medicine->unit}) for {$medicine->name} at {$branch->name}.",
                subject: $batch,
                metadata: [
                    'medicine_id' => $medicine->id,
                    'branch_id' => $branch->id,
                    'quantity' => $quantity,
                    'expiry_date' => $batch->expiry_date?->toDateString(),
                    'purchase_price' => $unitPurchase,
                ],
                userId: $actor?->id,
            );

            return $batch;
        });
    }

    /**
     * Execute a traceable stock adjustment, damage write-off, or expiry disposal on a locked batch.
     */
    public function adjustBatch(
        MedicineBatch $batch,
        StockMovementType $movementType,
        int $quantity,
        string $reason,
        ?string $notes = null,
        ?User $actor = null,
        bool $disposeEntireBatch = false,
    ): MedicineBatch {
        if (! in_array($movementType, [
            StockMovementType::ADJUSTMENT_IN,
            StockMovementType::ADJUSTMENT_OUT,
            StockMovementType::DAMAGE,
            StockMovementType::EXPIRY_DISPOSAL,
        ], true)) {
            throw ValidationException::withMessages([
                'adjustment_type' => 'Unsupported batch adjustment type.',
            ]);
        }

        return DB::transaction(function () use (
            $batch,
            $movementType,
            $quantity,
            $reason,
            $notes,
            $actor,
            $disposeEntireBatch
        ): MedicineBatch {
            /** @var MedicineBatch $locked */
            $locked = MedicineBatch::query()->lockForUpdate()->findOrFail($batch->id);
            $before = (int) $locked->quantity_available;
            $unitCost = (float) $locked->purchase_price;
            $cleanReason = trim($reason);
            $cleanNotes = $notes ? trim($notes) : null;

            if ($movementType === StockMovementType::ADJUSTMENT_IN) {
                if ($locked->isExpired()) {
                    throw ValidationException::withMessages([
                        'quantity' => 'Expired batches cannot receive positive shelf adjustments.',
                    ]);
                }

                if (in_array($locked->status, [BatchStatus::DAMAGED->value, BatchStatus::DISPOSED->value], true)) {
                    throw ValidationException::withMessages([
                        'quantity' => 'Damaged or disposed batches cannot be returned to active shelf stock.',
                    ]);
                }

                if ($quantity < 1) {
                    throw ValidationException::withMessages([
                        'quantity' => 'Adjustment quantity must be at least 1 unit.',
                    ]);
                }

                $after = $before + $quantity;
                $locked->quantity_available = $after;
                if ($locked->status === BatchStatus::DEPLETED->value) {
                    $locked->status = BatchStatus::ACTIVE->value;
                }
                $locked->save();

                $this->recordMovement(
                    branchId: (int) $locked->branch_id,
                    medicineId: (int) $locked->medicine_id,
                    batchId: $locked->id,
                    movementType: $movementType,
                    quantityChange: $quantity,
                    balanceBefore: $before,
                    balanceAfter: $after,
                    unitCost: $unitCost,
                    reason: $cleanReason,
                    notes: $cleanNotes,
                    actor: $actor,
                    reference: $locked,
                );

                AuditLog::record(
                    action: 'inventory.batch_adjusted',
                    description: "Adjusted batch {$locked->batch_number} by +{$quantity} ({$cleanReason}).",
                    subject: $locked,
                    metadata: ['before' => $before, 'after' => $after, 'type' => $movementType->value],
                    userId: $actor?->id,
                );

                return $locked->fresh();
            }

            if (in_array($locked->status, [BatchStatus::DAMAGED->value, BatchStatus::DISPOSED->value], true) && $before <= 0) {
                throw ValidationException::withMessages([
                    'quantity' => 'This batch has already been fully written off.',
                ]);
            }

            $effectiveQty = ($disposeEntireBatch && in_array($movementType, [StockMovementType::DAMAGE, StockMovementType::EXPIRY_DISPOSAL], true))
                ? $before
                : $quantity;

            if ($effectiveQty < 1 && ! ($disposeEntireBatch && $before === 0 && $locked->isExpired())) {
                throw ValidationException::withMessages([
                    'quantity' => 'Quantity to deduct must be at least 1 unit.',
                ]);
            }

            if ($effectiveQty > $before) {
                throw ValidationException::withMessages([
                    'quantity' => "Cannot deduct {$effectiveQty} units because only {$before} remain in batch {$locked->batch_number}.",
                ]);
            }

            $after = max(0, $before - $effectiveQty);
            $locked->quantity_available = $after;

            if ($movementType === StockMovementType::EXPIRY_DISPOSAL && ($after === 0 || $disposeEntireBatch)) {
                $locked->status = BatchStatus::DISPOSED->value;
                $locked->disposed_at = now();
                $locked->disposal_reason = $cleanReason;
                $locked->disposed_by = $actor?->id;
            } elseif ($movementType === StockMovementType::DAMAGE && ($after === 0 || $disposeEntireBatch)) {
                $locked->status = BatchStatus::DAMAGED->value;
                $locked->disposed_at = now();
                $locked->disposal_reason = $cleanReason;
                $locked->disposed_by = $actor?->id;
            } elseif ($after === 0 && $locked->status === BatchStatus::ACTIVE->value) {
                $locked->status = BatchStatus::DEPLETED->value;
            }

            $locked->save();

            if ($effectiveQty > 0) {
                $this->recordMovement(
                    branchId: (int) $locked->branch_id,
                    medicineId: (int) $locked->medicine_id,
                    batchId: $locked->id,
                    movementType: $movementType,
                    quantityChange: -$effectiveQty,
                    balanceBefore: $before,
                    balanceAfter: $after,
                    unitCost: $unitCost,
                    reason: $cleanReason,
                    notes: $cleanNotes,
                    actor: $actor,
                    reference: $locked,
                );
            }

            AuditLog::record(
                action: match ($movementType) {
                    StockMovementType::DAMAGE => 'inventory.batch_damaged',
                    StockMovementType::EXPIRY_DISPOSAL => 'inventory.batch_disposed',
                    default => 'inventory.batch_adjusted',
                },
                description: "{$movementType->label()} on batch {$locked->batch_number} (-{$effectiveQty}): {$cleanReason}.",
                subject: $locked,
                metadata: [
                    'before' => $before,
                    'after' => $after,
                    'type' => $movementType->value,
                    'status' => $locked->status,
                    'cost_loss' => round($effectiveQty * $unitCost, 2),
                ],
                userId: $actor?->id,
            );

            return $locked->fresh();
        });
    }

    public function recordMovement(
        int $branchId,
        int $medicineId,
        ?int $batchId,
        StockMovementType $movementType,
        int $quantityChange,
        int $balanceBefore,
        int $balanceAfter,
        float $unitCost,
        ?string $reason = null,
        ?string $notes = null,
        ?User $actor = null,
        ?Model $reference = null,
    ): StockMovement {
        $resolvedUnitCost = round(max(0, $unitCost), 2);

        return StockMovement::query()->create([
            'branch_id' => $branchId,
            'medicine_id' => $medicineId,
            'medicine_batch_id' => $batchId,
            'user_id' => $actor?->id,
            'movement_type' => $movementType->value,
            'quantity_change' => $quantityChange,
            'balance_before' => $balanceBefore,
            'balance_after' => $balanceAfter,
            'unit_cost' => $resolvedUnitCost,
            'total_cost' => round(abs($quantityChange) * $resolvedUnitCost, 2),
            'reference_type' => $reference?->getMorphClass(),
            'reference_id' => $reference?->getKey(),
            'reason' => $reason,
            'notes' => $notes,
            'occurred_at' => now(),
        ]);
    }

    public function generateUniqueEan13(int $tenantId): string
    {
        $tenantPart = str_pad((string) ($tenantId % 1000), 3, '0', STR_PAD_LEFT);

        for ($attempt = 0; $attempt < 20; $attempt++) {
            $randomPart = str_pad((string) random_int(0, 9999999), 7, '0', STR_PAD_LEFT);
            $base = '20'.$tenantPart.$randomPart;

            $sum = 0;
            for ($i = 0; $i < 12; $i++) {
                $sum += ((int) $base[$i]) * ($i % 2 === 0 ? 1 : 3);
            }
            $checkDigit = (10 - ($sum % 10)) % 10;
            $candidate = $base.$checkDigit;

            if (! Medicine::query()->withTrashed()->where('barcode', $candidate)->exists()) {
                return $candidate;
            }
        }

        return '20'.substr((string) (int) (microtime(true) * 1000), -11);
    }
}

