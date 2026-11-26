<?php

namespace App\Http\Controllers;

use App\Enums\BatchStatus;
use App\Enums\StockMovementType;
use App\Models\AuditLog;
use App\Models\Counter;
use App\Models\CounterSession;
use App\Models\Customer;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePayment;
use App\Services\InventoryService;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PosController extends Controller
{
    public function __construct(
        private readonly InventoryService $inventoryService,
    ) {}

    public function index(TenantContext $tenantContext): Response
    {
        $branchId = $tenantContext->branchId();

        $medicines = Medicine::query()
            ->where('is_active', true)
            ->withSum([
                'batches as available_stock' => fn ($q) => $q->sellable($branchId),
            ], 'quantity_available')
            ->orderBy('name')
            ->limit(500)
            ->get()
            ->map(fn (Medicine $med) => [
                'id' => $med->id,
                'name' => $med->name,
                'generic_name' => $med->generic_name,
                'sku' => $med->sku,
                'barcode' => $med->barcode,
                'dosage_form' => $med->dosage_form,
                'strength' => $med->strength,
                'unit' => $med->unit,
                'units_per_strip' => (int) ($med->units_per_strip ?: 1),
                'units_per_box' => (int) ($med->units_per_box ?: 1),
                'requires_prescription' => $med->requires_prescription,
                'selling_price' => (float) $med->default_selling_price,
                'box_selling_price' => $med->resolvedBoxSellingPrice(),
                'available_stock' => (int) ($med->available_stock ?? 0),
            ]);

        $customers = Customer::query()
            ->withSum('sales as total_due', 'due_amount')
            ->orderBy('name')
            ->get(['id', 'name', 'phone', 'loyalty_points', 'allergies'])
            ->map(fn (Customer $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'phone' => $c->phone,
                'loyalty_points' => (int) $c->loyalty_points,
                'allergies' => $c->allergies,
                'total_due' => (float) ($c->total_due ?? 0),
            ]);

        $userId = auth()->id();
        $counters = Counter::query()
            ->where('branch_id', $branchId)
            ->where('is_active', true)
            ->with(['currentUser:id,name', 'currentSession' => fn ($q) => $q->with('user:id,name')])
            ->orderBy('code')
            ->get()
            ->map(fn (Counter $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name,
                'type' => $c->type,
                'zone' => $c->zone,
                'status' => $c->status,
                'current_break_reason' => $c->current_break_reason,
                'break_started_at' => $c->break_started_at?->toISOString(),
                'current_user_id' => $c->current_user_id,
                'current_user_name' => $c->currentUser?->name,
                'current_session' => $c->currentSession ? [
                    'id' => $c->currentSession->id,
                    'user_id' => $c->currentSession->user_id,
                    'user_name' => $c->currentSession->user?->name,
                    'opened_at' => $c->currentSession->opened_at?->toISOString(),
                    'opening_float' => (float) $c->currentSession->opening_float,
                    'total_sales_amount' => (float) $c->currentSession->total_sales_amount,
                    'total_transactions' => (int) $c->currentSession->total_transactions,
                    'system_expected_cash' => (float) $c->currentSession->system_expected_cash,
                ] : null,
            ]);

        $activeCounter = $counters->first(fn ($c) => $c['current_user_id'] === $userId && $c['status'] !== 'closed');

        return Inertia::render('Pos/Index', [
            'medicines' => $medicines,
            'customers' => $customers,
            'branchName' => $tenantContext->branch()?->name,
            'counters' => $counters,
            'activeCounter' => $activeCounter,
        ]);
    }

    public function __invoke(TenantContext $tenantContext): Response
    {
        return $this->index($tenantContext);
    }

    public function checkout(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $branch = $tenantContext->branch();

        if (! $tenant || ! $branch) {
            return back()->with('error', 'Select an active branch before processing POS checkout.');
        }

        $validated = $request->validate([
            'counter_id' => [
                'nullable',
                Rule::exists('counters', 'id')->where('tenant_id', $tenant->id),
            ],
            'counter_session_id' => [
                'nullable',
                Rule::exists('counter_sessions', 'id')->where('tenant_id', $tenant->id),
            ],
            'customer_id' => [
                'nullable',
                Rule::exists('customers', 'id')->where('tenant_id', $tenant->id),
            ],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'doctor_name' => ['nullable', 'string', 'max:255'],
            'prescription_notes' => ['nullable', 'string', 'max:1000'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payments' => ['nullable', 'array'],
            'payments.*.method' => ['required_with:payments', 'string', Rule::in(['cash', 'card', 'bkash', 'nagad', 'rocket'])],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'min:0.01'],
            'payments.*.reference_number' => ['nullable', 'string', 'max:100'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'discount_type' => ['nullable', Rule::in(['fixed', 'percent'])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => [
                'required',
                Rule::exists('medicines', 'id')->where('tenant_id', $tenant->id),
            ],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.sale_unit' => ['nullable', Rule::in(['piece', 'strip', 'box'])],
        ]);

        if ($branch && ! $request->user()->canAccessBranch($branch)) {
            abort(403, "You do not have permission to dispense from branch \"{$branch->name}\".");
        }

        $counterId = ! empty($validated['counter_id']) ? (int) $validated['counter_id'] : null;
        $counterSessionId = ! empty($validated['counter_session_id']) ? (int) $validated['counter_session_id'] : null;

        if (! $counterId) {
            $userActiveCounter = Counter::query()
                ->where('tenant_id', $tenant->id)
                ->where('branch_id', $branch->id)
                ->where('current_user_id', $request->user()->id)
                ->where('status', 'active')
                ->first();
            if ($userActiveCounter) {
                $counterId = $userActiveCounter->id;
                $counterSessionId = $userActiveCounter->currentSession?->id;
            }
        }

        // Enforce open shift for cashiers when the branch has active cash counters configured
        $isAdminOrManager = $tenantContext->hasRole(['admin', 'manager']) || ($request->user()?->isSubscriberAdmin());
        if (! $isAdminOrManager) {
            $branchHasCounters = Counter::query()
                ->where('tenant_id', $tenant->id)
                ->where('branch_id', $branch->id)
                ->where('is_active', true)
                ->exists();

            $openShift = CounterSession::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $request->user()->id)
                ->where('status', 'open')
                ->first();

            if ($branchHasCounters && ! $openShift) {
                return back()->with('error', 'You must have an open shift on a cash counter before taking payments.');
            }

            if ($openShift) {
                $counterId = $counterId ?: $openShift->counter_id;
                $counterSessionId = $counterSessionId ?: $openShift->id;
            }
        }

        $sale = DB::transaction(function () use ($validated, $branch, $request, $counterId, $counterSessionId): Sale {
            $subtotal = 0;
            $allocatedLines = [];

            foreach ($validated['items'] as $itemInput) {
                $medicine = Medicine::query()->findOrFail($itemInput['medicine_id']);
                if (! $medicine->is_active) {
                    abort(422, "{$medicine->name} is archived and cannot be dispensed at POS.");
                }

                $packQty = (int) $itemInput['quantity'];
                $saleUnit = (string) ($itemInput['sale_unit'] ?? 'piece');
                $packSize = $medicine->packMultiplierFor($saleUnit);
                $requestedUnits = $packQty * $packSize;

                $batches = MedicineBatch::query()
                    ->sellable($branch->id)
                    ->where('medicine_id', $medicine->id)
                    ->orderBy('expiry_date')
                    ->lockForUpdate()
                    ->get();

                $totalAvailable = $batches->sum('quantity_available');
                if ($totalAvailable < $requestedUnits) {
                    abort(422, "Insufficient unexpired stock in {$branch->name} for {$medicine->name}. Available: {$totalAvailable} {$medicine->unit} (requested {$requestedUnits}).");
                }

                $boxPrice = $saleUnit === 'box' ? $medicine->resolvedBoxSellingPrice() : null;
                $expectedPackTotal = $boxPrice !== null ? round($boxPrice * $packQty, 2) : null;
                $remainingPackTotal = $expectedPackTotal ?? 0.0;
                $remaining = $requestedUnits;

                foreach ($batches as $batch) {
                    if ($remaining <= 0) {
                        break;
                    }
                    $before = (int) $batch->quantity_available;
                    $take = min($remaining, $before);
                    $after = max(0, $before - $take);

                    if ($expectedPackTotal !== null) {
                        $lineTotal = ($remaining === $take)
                            ? round($remainingPackTotal, 2)
                            : round($expectedPackTotal * ($take / $requestedUnits), 2);
                        $remainingPackTotal -= $lineTotal;
                        $unitPrice = $take > 0 ? round($lineTotal / $take, 2) : 0.0;
                    } else {
                        $unitPrice = (float) ($batch->selling_price ?: $medicine->default_selling_price);
                        $lineTotal = round($unitPrice * $take, 2);
                    }

                    $subtotal += $lineTotal;

                    $batch->quantity_available = $after;
                    if ($after === 0) {
                        $batch->status = BatchStatus::DEPLETED->value;
                    }
                    $batch->save();

                    $allocatedLines[] = [
                        'medicine_id' => $medicine->id,
                        'medicine_batch_id' => $batch->id,
                        'sale_unit' => $saleUnit,
                        'pack_size' => $packSize,
                        'pack_quantity' => $packQty,
                        'quantity' => $take,
                        'unit_price' => $unitPrice,
                        'line_total' => $lineTotal,
                        'balance_before' => $before,
                        'balance_after' => $after,
                        'purchase_price' => (float) $batch->purchase_price,
                    ];

                    $remaining -= $take;
                }
            }

            $discountType = (string) ($validated['discount_type'] ?? 'fixed');
            $rawDiscount = max(0, (float) ($validated['discount'] ?? 0));
            $discountAmount = $discountType === 'percent'
                ? round($subtotal * min(100, $rawDiscount) / 100, 2)
                : $rawDiscount;
            $discountAmount = min($subtotal, max(0, round($discountAmount, 2)));

            // Enforce role discount limit cap (server-side per Section 3.8)
            $discountCapPercent = $request->user()->getRoleLimit('discount_percent');
            if ($discountCapPercent !== null && $subtotal > 0) {
                $effectivePercent = ($discountAmount / $subtotal) * 100;
                if ($effectivePercent > $discountCapPercent + 0.01) {
                    abort(422, "Your role allows a maximum discount of {$discountCapPercent}%. Requested: ".round($effectivePercent, 1)."%. Manager approval required.");
                }
            }

            $totalAmount = max(0, round($subtotal - $discountAmount, 2));

            // Determine payment lines and amounts
            $paymentLines = [];
            if (! empty($validated['payments']) && is_array($validated['payments'])) {
                foreach ($validated['payments'] as $p) {
                    $amt = round((float) ($p['amount'] ?? 0), 2);
                    if ($amt > 0) {
                        $paymentLines[] = [
                            'method' => (string) ($p['method'] ?? 'cash'),
                            'amount' => $amt,
                            'reference_number' => ! empty($p['reference_number']) ? trim((string) $p['reference_number']) : null,
                        ];
                    }
                }
                $totalCollected = array_sum(array_column($paymentLines, 'amount'));
                $paymentMethodSummary = implode(' + ', array_unique(array_map(fn ($p) => ucfirst($p['method']), $paymentLines)));
            } else {
                $method = (string) ($validated['payment_method'] ?? 'cash');
                $givenPaid = isset($validated['paid_amount']) ? (float) $validated['paid_amount'] : $totalAmount;
                $totalCollected = max(0, round($givenPaid, 2));
                $paymentMethodSummary = ucfirst($method);
                if ($totalCollected > 0) {
                    $paymentLines[] = [
                        'method' => in_array($method, ['cash', 'card', 'bkash', 'nagad', 'rocket']) ? $method : 'cash',
                        'amount' => $totalCollected,
                        'reference_number' => null,
                    ];
                }
            }

            if ($totalCollected >= $totalAmount) {
                $paidAmount = $totalAmount;
                $changeAmount = round($totalCollected - $totalAmount, 2);
                $dueAmount = 0.0;
                $paymentStatus = 'paid';
            } else {
                $paidAmount = round($totalCollected, 2);
                $changeAmount = 0.0;
                $dueAmount = round($totalAmount - $totalCollected, 2);
                $paymentStatus = $paidAmount > 0 ? 'partial' : 'due';

                if (empty($validated['customer_id'])) {
                    abort(422, 'A registered customer is required when selling on credit or with pending due (বাকিতে বিক্রি করতে কাস্টমার সিলেক্ট করতে হবে)।');
                }
            }

            $invoiceNumber = 'INV-'.now()->format('ymd').'-'.strtoupper(substr(uniqid(), -5));

            $sale = Sale::query()->create([
                'branch_id' => $branch->id,
                'counter_id' => $counterId,
                'counter_session_id' => $counterSessionId,
                'customer_id' => $validated['customer_id'] ?? null,
                'user_id' => $request->user()->id,
                'invoice_number' => $invoiceNumber,
                'subtotal' => round($subtotal, 2),
                'discount_amount' => round($discountAmount, 2),
                'tax_amount' => 0,
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'due_amount' => $dueAmount,
                'change_amount' => $changeAmount,
                'payment_method' => $paymentMethodSummary ?: 'Cash',
                'payment_status' => $paymentStatus,
                'doctor_name' => ! empty($validated['doctor_name']) ? trim((string) $validated['doctor_name']) : null,
                'prescription_notes' => ! empty($validated['prescription_notes']) ? trim((string) $validated['prescription_notes']) : null,
                'notes' => ! empty($validated['customer_name']) ? "Customer: {$validated['customer_name']}" : null,
                'sold_at' => now(),
            ]);

            foreach ($paymentLines as $pay) {
                SalePayment::query()->create([
                    'sale_id' => $sale->id,
                    'payment_method' => $pay['method'],
                    'amount' => $pay['amount'],
                    'reference_number' => $pay['reference_number'],
                ]);
            }

            foreach ($allocatedLines as $line) {
                SaleItem::query()->create([
                    'sale_id' => $sale->id,
                    'medicine_id' => $line['medicine_id'],
                    'medicine_batch_id' => $line['medicine_batch_id'],
                    'sale_unit' => $line['sale_unit'],
                    'pack_size' => $line['pack_size'],
                    'pack_quantity' => $line['pack_quantity'],
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'discount' => 0,
                    'line_total' => $line['line_total'],
                ]);

                $this->inventoryService->recordMovement(
                    branchId: $branch->id,
                    medicineId: $line['medicine_id'],
                    batchId: $line['medicine_batch_id'],
                    movementType: StockMovementType::SALE,
                    quantityChange: -$line['quantity'],
                    balanceBefore: $line['balance_before'],
                    balanceAfter: $line['balance_after'],
                    unitCost: $line['purchase_price'],
                    reason: "POS Invoice {$sale->invoice_number}",
                    actor: $request->user(),
                    reference: $sale,
                );
            }

            if (! empty($validated['customer_id'])) {
                $earnedPoints = (int) floor($totalAmount / 100);
                if ($earnedPoints > 0) {
                    Customer::query()->where('id', $validated['customer_id'])->increment('loyalty_points', $earnedPoints);
                }
            }

            if ($counterSessionId) {
                $session = CounterSession::query()->find($counterSessionId);
                if ($session) {
                    $cashCollected = 0.0;
                    foreach ($paymentLines as $p) {
                        if ($p['method'] === 'cash') {
                            $cashCollected += $p['amount'];
                        }
                    }
                    $netCash = max(0, $cashCollected - $changeAmount);

                    $session->increment('total_sales_amount', $totalAmount);
                    $session->increment('total_transactions', 1);
                    if ($netCash > 0) {
                        $session->increment('system_expected_cash', $netCash);
                    }
                }
            }

            AuditLog::record(
                action: 'pos.sale_completed',
                description: "Completed POS invoice {$invoiceNumber} for {$totalAmount}.",
                subject: $sale,
                metadata: [
                    'total' => $totalAmount,
                    'paid_amount' => $paidAmount,
                    'due_amount' => $dueAmount,
                    'payment_status' => $paymentStatus,
                    'discount_type' => $discountType,
                    'discount_amount' => round($discountAmount, 2),
                    'payment_method' => $paymentMethodSummary ?: 'Cash',
                    'counter_id' => $counterId,
                    'counter_session_id' => $counterSessionId,
                ],
            );

            return $sale;
        });

        $sale->load(['items.medicine:id,name,generic_name,strength,unit', 'customer:id,name,phone', 'payments', 'counter:id,code,name']);

        $receiptData = [
            'id' => $sale->id,
            'invoice_number' => $sale->invoice_number,
            'sold_at' => $sale->sold_at ? $sale->sold_at->format('d M Y, h:i A') : now()->format('d M Y, h:i A'),
            'branch_name' => $branch->name,
            'branch_address' => $branch->address,
            'branch_phone' => $branch->phone,
            'counter_code' => $sale->counter?->code,
            'counter_name' => $sale->counter?->name,
            'cashier_name' => $request->user()->name,
            'customer_name' => ! empty($validated['customer_name']) ? $validated['customer_name'] : ($sale->customer?->name ?? 'Walk-in Customer'),
            'customer_phone' => $sale->customer?->phone,
            'doctor_name' => $sale->doctor_name,
            'prescription_notes' => $sale->prescription_notes,
            'payment_method' => $sale->payment_method,
            'payment_status' => $sale->payment_status,
            'subtotal' => (float) $sale->subtotal,
            'discount_amount' => (float) $sale->discount_amount,
            'tax_amount' => (float) $sale->tax_amount,
            'total_amount' => (float) $sale->total_amount,
            'paid_amount' => (float) $sale->paid_amount,
            'due_amount' => (float) $sale->due_amount,
            'change_amount' => (float) $sale->change_amount,
            'payments' => $sale->payments->map(fn ($p) => [
                'method' => $p->payment_method,
                'amount' => (float) $p->amount,
                'reference_number' => $p->reference_number,
            ])->values()->all(),
            'currency' => $tenant->currency_code ?? 'BDT',
            'items' => $sale->items->map(fn ($item) => [
                'name' => $item->medicine?->name ?? 'Medicine',
                'generic_name' => $item->medicine?->generic_name,
                'strength' => $item->medicine?->strength,
                'sale_unit' => $item->sale_unit,
                'pack_quantity' => (int) ($item->pack_quantity ?: $item->quantity),
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'line_total' => (float) $item->line_total,
            ])->values()->all(),
        ];

        return back()
            ->with('success', "Invoice {$sale->invoice_number} recorded and FEFO stock deducted.")
            ->with('lastSale', $receiptData);
    }
}
