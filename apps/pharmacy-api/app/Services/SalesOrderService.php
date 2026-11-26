<?php

namespace App\Services;

use App\Enums\BatchStatus;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Counter;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Sales\Application\DTO\ProcessPaymentCommand;
use App\Modules\Sales\Application\SalesOrderWorkflow;
use App\Modules\Sales\Domain\SalesProblem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesOrderService
{
    public function __construct(
        private readonly CounterAssignmentService $assignmentService,
        private readonly InventoryService $inventoryService,
        private readonly SalesOrderWorkflow $workflow,
    ) {}

    /**
     * Generate unique Sales Order Number e.g. ORD-20261124-0042
     */
    public function generateOrderNumber(int $tenantId): string
    {
        $datePrefix = date('Ymd');
        $random = strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));

        return "ORD-{$datePrefix}-{$random}";
    }

    /**
     * Generate official Invoice Number e.g. INV-20261124-0042
     */
    public function generateInvoiceNumber(int $tenantId): string
    {
        $datePrefix = date('Ymd');
        $random = strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));

        return "INV-{$datePrefix}-{$random}";
    }

    /**
     * Determine maximum permitted discount percentage for user in tenant.
     */
    public function getPermittedDiscountLimit(Tenant $tenant, User $user): float
    {
        $isOwnerOrAdmin = $user->isSubscriberAdmin()
            || (int) $tenant->owner_id === (int) $user->id
            || (bool) $user->is_owner;

        $settings = $tenant->settings ?? [];

        return $this->workflow->permittedDiscountLimit(
            isOwnerOrAdmin: $isOwnerOrAdmin,
            roles: $user->rolesForTenant($tenant),
            configuredLimits: (array) ($settings['discount_limits'] ?? []),
        );
    }

    /**
     * Create a new sales order from salesman.
     */
    public function createSalesOrder(
        Tenant $tenant,
        Branch $branch,
        User $salesman,
        array $validated,
        ?UploadedFile $prescriptionFile = null,
        bool $isDraft = false
    ): Sale {
        return DB::transaction(function () use ($tenant, $branch, $salesman, $validated, $prescriptionFile, $isDraft): Sale {
            // Check if resuming or updating an existing draft
            $existingDraft = null;
            if (! empty($validated['draft_id'])) {
                $existingDraft = Sale::query()
                    ->where('id', $validated['draft_id'])
                    ->where('tenant_id', $tenant->id)
                    ->where('order_status', 'draft')
                    ->lockForUpdate()
                    ->first();
            }

            // Handle prescription upload
            $prescriptionPath = $existingDraft?->prescription_file;
            if ($prescriptionFile) {
                $prescriptionPath = $prescriptionFile->store("prescriptions/{$tenant->id}", 'public');
            }

            // Calculate Subtotal & Line items with FEFO batch selection & stock validation
            $subtotal = 0;
            $orderItems = [];

            foreach ($validated['items'] as $itemInput) {
                $medicine = Medicine::query()
                    ->where('tenant_id', $tenant->id)
                    ->findOrFail($itemInput['medicine_id']);

                if (! $medicine->is_active) {
                    throw ValidationException::withMessages([
                        'medicine' => ["{$medicine->name} is inactive and cannot be ordered."],
                    ]);
                }

                $packQty = max(1, (int) $itemInput['quantity']);
                $saleUnit = (string) ($itemInput['sale_unit'] ?? 'piece');
                $packSize = $medicine->packMultiplierFor($saleUnit);
                $totalUnits = $packQty * $packSize;

                // Validate specific batch or pick FEFO batch
                $batch = null;
                if (! empty($itemInput['medicine_batch_id'])) {
                    $batch = MedicineBatch::query()
                        ->where('id', $itemInput['medicine_batch_id'])
                        ->where('medicine_id', $medicine->id)
                        ->where('branch_id', $branch->id)
                        ->first();

                    if (! $batch || $batch->isExpired() || ($batch->status !== BatchStatus::ACTIVE->value && $batch->status !== 'active')) {
                        throw ValidationException::withMessages([
                            'batch' => ["Selected batch for {$medicine->name} is expired, blocked, or invalid."],
                        ]);
                    }
                } else {
                    // FEFO (First Expiry, First Out)
                    $batch = MedicineBatch::query()
                        ->sellable($branch->id)
                        ->where('medicine_id', $medicine->id)
                        ->orderBy('expiry_date')
                        ->first();
                }

                // Check stock availability
                $availableStock = (int) MedicineBatch::query()
                    ->sellable($branch->id)
                    ->where('medicine_id', $medicine->id)
                    ->sum('quantity_available');

                if (! $isDraft && $availableStock < $totalUnits) {
                    throw ValidationException::withMessages([
                        'stock' => ["Insufficient stock for {$medicine->name}. Requested: {$totalUnits} {$medicine->unit}, Available: {$availableStock} {$medicine->unit}."],
                    ]);
                }

                $boxPrice = $saleUnit === 'box' ? $medicine->resolvedBoxSellingPrice() : null;
                $expectedLineTotal = $boxPrice !== null ? round($boxPrice * $packQty, 2) : null;

                if ($expectedLineTotal !== null) {
                    $lineTotal = $expectedLineTotal;
                    $unitPrice = round($lineTotal / $totalUnits, 2);
                } else {
                    $unitPrice = (float) ($batch?->selling_price ?: $medicine->default_selling_price);
                    $lineTotal = round($unitPrice * $totalUnits, 2);
                }

                $subtotal += $lineTotal;

                $orderItems[] = [
                    'tenant_id' => $tenant->id,
                    'medicine_id' => $medicine->id,
                    'medicine_batch_id' => $batch?->id ?? null,
                    'sale_unit' => $saleUnit,
                    'pack_size' => $packSize,
                    'pack_quantity' => $packQty,
                    'quantity' => $totalUnits,
                    'unit_price' => $unitPrice,
                    'discount' => 0,
                    'line_total' => $lineTotal,
                ];
            }

            // Controlled Discount & Automatic VAT/Tax via Clean Architecture Sales Domain
            $isOwnerOrAdmin = $salesman->isSubscriberAdmin()
                || (int) $tenant->owner_id === (int) $salesman->id
                || (bool) $salesman->is_owner;
            $settings = $tenant->settings ?? [];

            $pricingResult = $this->workflow->calculatePricingAndDiscountStatus(
                subtotal: (float) $subtotal,
                discountType: (string) ($validated['discount_type'] ?? 'fixed'),
                rawDiscount: (float) ($validated['discount'] ?? 0),
                configuredTaxPercent: (float) ($settings['tax_percentage'] ?? 0.0),
                manualTaxAmount: (float) ($validated['tax_amount'] ?? 0),
                isOwnerOrAdmin: $isOwnerOrAdmin,
                roles: $salesman->rolesForTenant($tenant),
                configuredLimits: (array) ($settings['discount_limits'] ?? []),
            );

            $pricing = $pricingResult['pricing'];
            $discountAmount = $pricing->discountAmount;
            $effectivePercentage = $pricing->effectiveDiscountPercent;
            $taxAmount = $pricing->taxAmount;
            $grandTotal = $pricing->grandTotal;

            $discountStatus = $pricingResult['discount_status'];
            $discountRequestedBy = $discountAmount > 0 ? $salesman->id : null;
            $discountApprovedBy = $discountStatus === 'approved' ? $salesman->id : null;
            $discountApprovedAt = $discountStatus === 'approved' ? now() : null;

            $initialStatus = $isDraft ? 'draft' : 'submitted';

            $saleData = [
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'customer_id' => $validated['customer_id'] ?? null,
                'user_id' => $salesman->id,
                'salesman_id' => $salesman->id,
                'order_status' => $initialStatus,
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'discount_percentage' => $effectivePercentage,
                'discount_status' => $discountStatus,
                'discount_requested_by' => $discountRequestedBy,
                'discount_approved_by' => $discountApprovedBy,
                'discount_approved_at' => $discountApprovedAt,
                'tax_amount' => $taxAmount,
                'total_amount' => $grandTotal,
                'paid_amount' => 0,
                'due_amount' => $grandTotal,
                'change_amount' => 0,
                'payment_method' => 'pending',
                'payment_status' => 'pending',
                'doctor_name' => $validated['doctor_name'] ?? null,
                'prescription_notes' => $validated['prescription_notes'] ?? null,
                'prescription_reference' => $validated['prescription_reference'] ?? null,
                'prescription_file' => $prescriptionPath,
                'requires_verification' => (bool) ($validated['requires_verification'] ?? false),
                'verification_status' => ! empty($validated['requires_verification']) ? 'pending' : 'not_required',
                'notes' => $validated['notes'] ?? null,
                'internal_notes' => $validated['internal_notes'] ?? null,
                'sold_at' => now(),
            ];

            if ($existingDraft) {
                $existingDraft->update($saleData);
                $sale = $existingDraft;
                SaleItem::query()->where('sale_id', $sale->id)->delete();
            } else {
                $orderNumber = $this->generateOrderNumber($tenant->id);
                $saleData['order_number'] = $orderNumber;
                $saleData['invoice_number'] = $orderNumber; // temporary invoice until finalized
                $sale = Sale::query()->create($saleData);
            }

            foreach ($orderItems as $item) {
                $item['sale_id'] = $sale->id;
                SaleItem::query()->create($item);
            }

            $sale->recordStatus(
                toStatus: $initialStatus,
                user: $salesman,
                reason: $isDraft ? 'Order saved as draft.' : 'Order submitted by salesman for counter assignment.'
            );

            AuditLog::record(
                action: $isDraft ? 'sales_order.draft_saved' : 'sales_order.created',
                description: "Salesman {$salesman->name} " . ($isDraft ? 'saved draft' : 'created order') . " #{$sale->order_number} (Total: {$grandTotal}).",
                subject: $sale,
                metadata: [
                    'order_number' => $sale->order_number,
                    'total_amount' => $grandTotal,
                    'status' => $initialStatus,
                    'discount_status' => $discountStatus,
                    'discount_amount' => $discountAmount,
                    'discount_percentage' => $effectivePercentage,
                ],
                userId: $salesman->id
            );

            // Trigger dynamic automatic assignment if not draft
            if (! $isDraft) {
                $this->assignmentService->assignOrder($sale, $salesman);
            }

            return $sale->fresh(['items.medicine', 'customer', 'counter', 'latestAssignment']);
        });
    }

    /**
     * Cashier accepts an assigned order into active processing.
     */
    public function acceptOrder(Sale $sale, User $cashier): Sale
    {
        try {
            $this->workflow->acceptOrder((int) $sale->id, (int) $cashier->id, (string) $cashier->name);
        } catch (SalesProblem $problem) {
            throw ValidationException::withMessages([$problem->field => [$problem->getMessage()]]);
        }

        return $sale->fresh(['items.medicine', 'customer', 'counter']);
    }

    /**
     * Cashier processes payment, atomically deducts stock, and completes order.
     */
    public function processPayment(
        Sale $sale,
        User $cashier,
        Counter $counter,
        array $paymentData
    ): Sale {
        $paymentLines = [];
        if (! empty($paymentData['payments']) && is_array($paymentData['payments'])) {
            foreach ($paymentData['payments'] as $p) {
                $paymentLines[] = [
                    'method' => (string) ($p['method'] ?? 'cash'),
                    'amount' => $p['amount'] ?? 0,
                    'reference_number' => $p['reference_number'] ?? null,
                ];
            }
        } else {
            $paymentLines[] = [
                'method' => (string) ($paymentData['payment_method'] ?? 'cash'),
                'amount' => $paymentData['paid_amount'] ?? $sale->total_amount,
                'reference_number' => $paymentData['reference_number'] ?? null,
            ];
        }

        $session = $counter->currentSession;

        try {
            $this->workflow->processPayment(new ProcessPaymentCommand(
                saleId: (int) $sale->id,
                cashierId: (int) $cashier->id,
                cashierName: (string) $cashier->name,
                counterId: (int) $counter->id,
                counterSessionId: $session?->id !== null ? (int) $session->id : null,
                paymentLines: $paymentLines,
                invoiceNumber: $this->generateInvoiceNumber((int) $sale->tenant_id),
            ));
        } catch (SalesProblem $problem) {
            throw ValidationException::withMessages([$problem->field => [$problem->getMessage()]]);
        }

        return $sale->fresh(['items.medicine', 'customer', 'counter', 'payments']);
    }

    /**
     * Cancel an active or draft order.
     */
    public function cancelOrder(Sale $sale, User $actor, string $reason): Sale
    {
        try {
            $this->workflow->cancelOrder((int) $sale->id, (int) $actor->id, (string) $actor->name, $reason);
        } catch (SalesProblem $problem) {
            throw ValidationException::withMessages([$problem->field => [$problem->getMessage()]]);
        }

        return $sale->fresh();
    }

    /**
     * Delete an unassigned draft order.
     */
    public function deleteDraft(Sale $sale, User $user): void
    {
        try {
            $this->workflow->deleteDraft((int) $sale->id, (int) $user->id, (string) $user->name);
        } catch (SalesProblem $problem) {
            throw ValidationException::withMessages([$problem->field => [$problem->getMessage()]]);
        }
    }

    /**
     * Manager approves a sales order discount exceeding standard salesman limit.
     */
    public function approveDiscount(Sale $sale, User $manager): Sale
    {
        $this->workflow->approveDiscount((int) $sale->id, (int) $manager->id, (string) $manager->name);

        return $sale->fresh(['items.medicine', 'customer', 'counter']);
    }

    /**
     * Manager rejects an over-limit discount on a sales order.
     */
    public function rejectDiscount(Sale $sale, User $manager, string $reason): Sale
    {
        $this->workflow->rejectDiscount((int) $sale->id, (int) $manager->id, (string) $manager->name, $reason);

        return $sale->fresh(['items.medicine', 'customer', 'counter']);
    }
}
