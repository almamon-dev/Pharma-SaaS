<?php

namespace App\Services;

use App\Enums\BatchStatus;
use App\Enums\StockMovementType;
use App\Enums\TenantRole;
use App\Events\SalesOrderCompleted;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Counter;
use App\Models\CounterAssignment;
use App\Models\Customer;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePayment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SalesOrderService
{
    public function __construct(
        private readonly CounterAssignmentService $assignmentService,
        private readonly InventoryService $inventoryService
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
        if ($user->isSubscriberAdmin() || (int) $tenant->owner_id === (int) $user->id || (bool) $user->is_owner) {
            return 100.0;
        }

        $roles = $user->rolesForTenant($tenant);

        if (in_array(TenantRole::ADMIN->value, $roles, true)) {
            return 100.0;
        }

        $settings = $tenant->settings ?? [];
        $limits = $settings['discount_limits'] ?? [
            'salesman' => 2.0,
            'senior_salesman' => 5.0,
            'manager' => 15.0,
            'admin' => 100.0,
            'owner' => 100.0,
        ];

        if (in_array(TenantRole::MANAGER->value, $roles, true)) {
            return (float) ($limits['manager'] ?? 15.0);
        }

        if (in_array('senior_salesman', $roles, true)) {
            return (float) ($limits['senior_salesman'] ?? 5.0);
        }

        return (float) ($limits['salesman'] ?? 2.0);
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

            // Controlled Discount Validation (Permission Based)
            $discountType = (string) ($validated['discount_type'] ?? 'fixed');
            $rawDiscount = max(0, (float) ($validated['discount'] ?? 0));
            $discountAmount = $discountType === 'percent'
                ? round($subtotal * min(100, $rawDiscount) / 100, 2)
                : $rawDiscount;
            $discountAmount = min($subtotal, max(0, round($discountAmount, 2)));

            $effectivePercentage = $subtotal > 0 ? round(($discountAmount / $subtotal) * 100, 2) : 0.0;
            $discountLimit = $this->getPermittedDiscountLimit($tenant, $salesman);

            $discountStatus = 'none';
            $discountApprovedBy = null;
            $discountApprovedAt = null;
            $discountRequestedBy = null;

            if ($discountAmount > 0) {
                $discountRequestedBy = $salesman->id;
                $roles = $salesman->rolesForTenant($tenant);
                $isManagerOrAdmin = $salesman->isSubscriberAdmin()
                    || (int) $tenant->owner_id === (int) $salesman->id
                    || (bool) $salesman->is_owner
                    || in_array(TenantRole::ADMIN->value, $roles, true)
                    || in_array(TenantRole::MANAGER->value, $roles, true);

                if ($effectivePercentage <= ($discountLimit + 0.01) || $isManagerOrAdmin) {
                    $discountStatus = 'approved';
                    $discountApprovedBy = $salesman->id;
                    $discountApprovedAt = now();
                } else {
                    $discountStatus = 'pending_approval';
                }
            }

            // Automatic VAT / Tax calculation based on pharmacy configured settings
            $taxRate = (float) ($tenant->settings['tax_percentage'] ?? 0.0);
            $taxable = max(0, $subtotal - $discountAmount);
            $taxAmount = $taxRate > 0
                ? round($taxable * ($taxRate / 100), 2)
                : round(max(0, (float) ($validated['tax_amount'] ?? 0)), 2);
            $grandTotal = max(0, round($taxable + $taxAmount, 2));

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
        return DB::transaction(function () use ($sale, $cashier): Sale {
            $lockedSale = Sale::query()
                ->where('id', $sale->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($lockedSale->order_status, ['assigned', 'waiting'], true)) {
                throw ValidationException::withMessages([
                    'order' => ["Order #{$lockedSale->order_number} is currently {$lockedSale->order_status} and cannot be accepted."],
                ]);
            }

            $lockedSale->cashier_id = $cashier->id;
            $lockedSale->processing_started_at = now();
            $lockedSale->recordStatus(
                toStatus: 'processing',
                user: $cashier,
                reason: "Cashier {$cashier->name} accepted order for processing."
            );

            return $lockedSale->fresh(['items.medicine', 'customer', 'counter']);
        });
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
        return DB::transaction(function () use ($sale, $cashier, $counter, $paymentData): Sale {
            $lockedSale = Sale::query()
                ->where('id', $sale->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($lockedSale->order_status, ['paid', 'completed'], true)) {
                throw ValidationException::withMessages([
                    'order' => ["Order #{$lockedSale->order_number} has already been paid and completed."],
                ]);
            }

            $branch = $lockedSale->branch;
            $session = $counter->currentSession;

            // 1. Verify item availability and atomically allocate & deduct FEFO stock
            foreach ($lockedSale->items as $item) {
                $medicine = $item->medicine;
                $requestedUnits = $item->quantity;

                $batches = MedicineBatch::query()
                    ->sellable($branch->id)
                    ->where('medicine_id', $medicine->id)
                    ->orderBy('expiry_date', 'asc')
                    ->lockForUpdate()
                    ->get();

                $totalAvailable = $batches->sum('quantity_available');
                if ($totalAvailable < $requestedUnits) {
                    throw ValidationException::withMessages([
                        'stock' => ["Insufficient unexpired stock for {$medicine->name}. Requested: {$requestedUnits}, Available: {$totalAvailable}."],
                    ]);
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

                    // If item didn't have batch assigned, assign first batch
                    if (! $item->medicine_batch_id) {
                        $item->medicine_batch_id = $batch->id;
                        $item->save();
                    }

                    // Record Stock Movement
                    $this->inventoryService->recordMovement(
                        branchId: (int) $branch->id,
                        medicineId: (int) $medicine->id,
                        batchId: $batch->id,
                        movementType: StockMovementType::SALE,
                        quantityChange: -$take,
                        balanceBefore: $before,
                        balanceAfter: $after,
                        unitCost: (float) $batch->purchase_price,
                        reason: "Counter POS Sale #{$lockedSale->order_number}",
                        actor: $cashier,
                        reference: $lockedSale
                    );

                    $remaining -= $take;
                }
            }

            // 2. Validate and Record Payments
            $totalAmount = (float) $lockedSale->total_amount;
            $paymentLines = [];

            if (! empty($paymentData['payments']) && is_array($paymentData['payments'])) {
                foreach ($paymentData['payments'] as $p) {
                    $amt = round((float) ($p['amount'] ?? 0), 2);
                    if ($amt > 0) {
                        $paymentLines[] = [
                            'method' => (string) ($p['method'] ?? 'cash'),
                            'amount' => $amt,
                            'reference_number' => ! empty($p['reference_number']) ? trim((string) $p['reference_number']) : null,
                        ];
                    }
                }
            } else {
                $method = (string) ($paymentData['payment_method'] ?? 'cash');
                $givenPaid = isset($paymentData['paid_amount']) ? (float) $paymentData['paid_amount'] : $totalAmount;
                $clampedGiven = max(0, round($givenPaid, 2));
                if ($clampedGiven > 0) {
                    $paymentLines[] = [
                        'method' => $method === 'due' ? 'cash' : $method,
                        'amount' => $clampedGiven,
                        'reference_number' => $paymentData['reference_number'] ?? null,
                    ];
                }
            }

            $totalCollected = array_sum(array_column($paymentLines, 'amount'));
            if ($totalCollected >= $totalAmount) {
                $paidAmount = $totalAmount;
                $changeAmount = round($totalCollected - $totalAmount, 2);
                $dueAmount = 0.0;
                $paymentStatus = 'paid';
            } else {
                $paidAmount = round($totalCollected, 2);
                $changeAmount = 0.0;
                $dueAmount = max(0, round($totalAmount - $totalCollected, 2));
                $paymentStatus = $paidAmount > 0 ? 'partially_paid' : 'due';

                if ($dueAmount > 0 && empty($lockedSale->customer_id)) {
                    throw ValidationException::withMessages([
                        'customer_id' => ['A registered customer is required for credit/due sales (বাকিতে বিক্রি করতে কাস্টমার থাকা আবশ্যক)।'],
                    ]);
                }
            }

            // Record each positive payment line
            foreach ($paymentLines as $pline) {
                SalePayment::query()->create([
                    'tenant_id' => $lockedSale->tenant_id,
                    'sale_id' => $lockedSale->id,
                    'payment_method' => $pline['method'],
                    'amount' => $pline['amount'],
                    'reference_number' => $pline['reference_number'],
                ]);
            }

            // 3. Finalize Sale & Invoice
            $finalInvoice = $this->generateInvoiceNumber($lockedSale->tenant_id);
            $primaryMethod = ! empty($paymentLines)
                ? implode(' + ', array_unique(array_map(fn ($p) => ucfirst($p['method']), $paymentLines)))
                : 'Due';

            $lockedSale->update([
                'invoice_number' => $finalInvoice,
                'paid_amount' => $paidAmount,
                'due_amount' => $dueAmount,
                'change_amount' => $changeAmount,
                'payment_method' => $primaryMethod,
                'payment_status' => $paymentStatus,
                'cashier_id' => $cashier->id,
                'counter_id' => $counter->id,
                'counter_session_id' => $session?->id,
                'completed_at' => now(),
            ]);

            $lockedSale->recordStatus(
                toStatus: 'completed',
                user: $cashier,
                reason: "Payment confirmed via {$primaryMethod}. Invoice #{$finalInvoice} issued."
            );

            // 4. Mark active counter assignment completed
            CounterAssignment::query()
                ->where('sale_id', $lockedSale->id)
                ->where('status', 'active')
                ->update([
                    'status' => 'completed',
                    'completed_at' => now(),
                    'cashier_id' => $cashier->id,
                ]);

            // 5. Update Cash Register Session financials
            if ($session) {
                $session->increment('total_sales_amount', $totalAmount);
                $session->increment('total_transactions', 1);

                // Add net cash portion (cash received minus change given) to expected cash
                $cashPortion = array_sum(array_map(
                    fn ($p) => $p['method'] === 'cash' ? $p['amount'] : 0,
                    $paymentLines
                ));
                $netCash = max(0, round($cashPortion - $changeAmount, 2));
                if ($netCash > 0) {
                    $session->increment('system_expected_cash', $netCash);
                    $session->increment('cash_sales_total', $netCash);
                }
            }

            // 6. Customer loyalty points if customer attached
            if ($lockedSale->customer_id) {
                Customer::query()
                    ->where('id', $lockedSale->customer_id)
                    ->increment('loyalty_points', (int) floor($totalAmount / 100));
            }

            AuditLog::record(
                action: 'sales_order.completed',
                description: "Cashier {$cashier->name} collected {$paidAmount} BDT (Due: {$dueAmount} BDT) for order #{$lockedSale->order_number} (Invoice: {$finalInvoice}).",
                subject: $lockedSale,
                metadata: [
                    'invoice_number' => $finalInvoice,
                    'total_amount' => $totalAmount,
                    'paid_amount' => $paidAmount,
                    'due_amount' => $dueAmount,
                    'payment_status' => $paymentStatus,
                ],
                userId: $cashier->id
            );

            // 7. Check if unassigned orders can now be dynamically assigned to this counter!
            $this->assignmentService->processUnassignedQueue($counter->tenant_id, $counter->branch_id);

            event(new SalesOrderCompleted($lockedSale));

            return $lockedSale->fresh(['items.medicine', 'customer', 'counter', 'payments']);
        });
    }

    /**
     * Cancel an active or draft order.
     */
    public function cancelOrder(Sale $sale, User $actor, string $reason): Sale
    {
        return DB::transaction(function () use ($sale, $actor, $reason): Sale {
            $lockedSale = Sale::query()
                ->where('id', $sale->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($lockedSale->order_status, ['completed', 'paid'], true)) {
                throw ValidationException::withMessages([
                    'order' => ['Paid/Completed orders cannot be cancelled directly without refund processing.'],
                ]);
            }

            // Close active assignment
            CounterAssignment::query()
                ->where('sale_id', $lockedSale->id)
                ->where('status', 'active')
                ->update([
                    'status' => 'cancelled',
                    'completed_at' => now(),
                    'notes' => $reason,
                ]);

            $lockedSale->cancelled_at = now();
            $lockedSale->cancellation_reason = $reason;
            $lockedSale->recordStatus(
                toStatus: 'cancelled',
                user: $actor,
                reason: $reason
            );

            AuditLog::record(
                action: 'sales_order.cancelled',
                description: "Order #{$lockedSale->order_number} cancelled by {$actor->name}. Reason: {$reason}",
                subject: $lockedSale,
                metadata: ['reason' => $reason],
                userId: $actor->id
            );

            return $lockedSale;
        });
    }

    /**
     * Delete an unassigned draft order.
     */
    public function deleteDraft(Sale $sale, User $user): void
    {
        DB::transaction(function () use ($sale, $user): void {
            $lockedSale = Sale::query()
                ->where('id', $sale->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedSale->order_status !== 'draft') {
                throw ValidationException::withMessages([
                    'order' => ["Order #{$lockedSale->order_number} is not a draft and cannot be deleted."],
                ]);
            }

            AuditLog::record(
                action: 'sales_order.draft_deleted',
                description: "User {$user->name} deleted draft order #{$lockedSale->order_number}.",
                subject: $lockedSale,
                metadata: ['order_number' => $lockedSale->order_number],
                userId: $user->id
            );

            SaleItem::query()->where('sale_id', $lockedSale->id)->delete();
            $lockedSale->delete();
        });
    }

    /**
     * Manager approves a sales order discount exceeding standard salesman limit.
     */
    public function approveDiscount(Sale $sale, User $manager): Sale
    {
        return DB::transaction(function () use ($sale, $manager): Sale {
            $lockedSale = Sale::query()
                ->where('id', $sale->id)
                ->lockForUpdate()
                ->firstOrFail();

            $lockedSale->discount_status = 'approved';
            $lockedSale->discount_approved_by = $manager->id;
            $lockedSale->discount_approved_at = now();
            $lockedSale->discount_rejection_reason = null;
            $lockedSale->save();

            AuditLog::record(
                action: 'sales_order.discount_approved',
                description: "Manager {$manager->name} approved discount of {$lockedSale->discount_amount} on order #{$lockedSale->order_number}.",
                subject: $lockedSale,
                userId: $manager->id
            );

            return $lockedSale->fresh(['items.medicine', 'customer', 'counter']);
        });
    }

    /**
     * Manager rejects an over-limit discount on a sales order.
     */
    public function rejectDiscount(Sale $sale, User $manager, string $reason): Sale
    {
        return DB::transaction(function () use ($sale, $manager, $reason): Sale {
            $lockedSale = Sale::query()
                ->where('id', $sale->id)
                ->lockForUpdate()
                ->firstOrFail();

            $lockedSale->discount_status = 'rejected';
            $lockedSale->discount_approved_by = $manager->id;
            $lockedSale->discount_approved_at = now();
            $lockedSale->discount_rejection_reason = $reason;
            $lockedSale->save();

            AuditLog::record(
                action: 'sales_order.discount_rejected',
                description: "Manager {$manager->name} rejected discount on order #{$lockedSale->order_number}. Reason: {$reason}",
                subject: $lockedSale,
                userId: $manager->id
            );

            return $lockedSale->fresh(['items.medicine', 'customer', 'counter']);
        });
    }
}
