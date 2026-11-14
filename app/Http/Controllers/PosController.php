<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PosController extends Controller
{
    public function index(TenantContext $tenantContext): Response
    {
        $medicines = Medicine::query()
            ->where('is_active', true)
            ->withSum(['batches as available_stock' => fn ($q) => $q->where('status', 'active')], 'quantity_available')
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
            ->orderBy('name')
            ->get(['id', 'name', 'phone', 'loyalty_points', 'allergies']);

        return Inertia::render('Pos/Index', [
            'medicines' => $medicines,
            'customers' => $customers,
            'branchName' => $tenantContext->branch()?->name,
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
            'customer_id' => [
                'nullable',
                Rule::exists('customers', 'id')->where('tenant_id', $tenant->id),
            ],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'payment_method' => ['required', Rule::in(['cash', 'card', 'bkash'])],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => [
                'required',
                Rule::exists('medicines', 'id')->where('tenant_id', $tenant->id),
            ],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.sale_unit' => ['nullable', Rule::in(['piece', 'strip', 'box'])],
        ]);

        $sale = DB::transaction(function () use ($validated, $branch, $request): Sale {
            $subtotal = 0;
            $allocatedLines = [];

            foreach ($validated['items'] as $itemInput) {
                $medicine = Medicine::query()->findOrFail($itemInput['medicine_id']);
                $packQty = (int) $itemInput['quantity'];
                $saleUnit = (string) ($itemInput['sale_unit'] ?? 'piece');
                $packSize = $medicine->packMultiplierFor($saleUnit);
                $requestedUnits = $packQty * $packSize;

                $batches = MedicineBatch::query()
                    ->where('medicine_id', $medicine->id)
                    ->where('status', 'active')
                    ->where('quantity_available', '>', 0)
                    ->orderByRaw('CASE WHEN branch_id = ? THEN 0 ELSE 1 END', [$branch->id])
                    ->orderBy('expiry_date')
                    ->lockForUpdate()
                    ->get();

                $totalAvailable = $batches->sum('quantity_available');
                if ($totalAvailable < $requestedUnits) {
                    abort(422, "Insufficient stock for {$medicine->name}. Available: {$totalAvailable} {$medicine->unit} (requested {$requestedUnits}).");
                }

                $boxPrice = $saleUnit === 'box' ? $medicine->resolvedBoxSellingPrice() : null;
                $expectedPackTotal = $boxPrice !== null ? round($boxPrice * $packQty, 2) : null;
                $remainingPackTotal = $expectedPackTotal ?? 0.0;
                $remaining = $requestedUnits;

                foreach ($batches as $batch) {
                    if ($remaining <= 0) {
                        break;
                    }
                    $take = min($remaining, (int) $batch->quantity_available);

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

                    $batch->decrement('quantity_available', $take);
                    $allocatedLines[] = [
                        'medicine_id' => $medicine->id,
                        'medicine_batch_id' => $batch->id,
                        'sale_unit' => $saleUnit,
                        'pack_size' => $packSize,
                        'pack_quantity' => $packQty,
                        'quantity' => $take,
                        'unit_price' => $unitPrice,
                        'line_total' => $lineTotal,
                    ];

                    $remaining -= $take;
                }
            }

            $discountAmount = min($subtotal, max(0, (float) ($validated['discount'] ?? 0)));
            $totalAmount = max(0, round($subtotal - $discountAmount, 2));

            $invoiceNumber = 'INV-'.now()->format('ymd').'-'.strtoupper(substr(uniqid(), -5));

            $sale = Sale::query()->create([
                'branch_id' => $branch->id,
                'customer_id' => $validated['customer_id'] ?? null,
                'user_id' => $request->user()->id,
                'invoice_number' => $invoiceNumber,
                'subtotal' => round($subtotal, 2),
                'discount_amount' => round($discountAmount, 2),
                'tax_amount' => 0,
                'total_amount' => $totalAmount,
                'paid_amount' => $totalAmount,
                'payment_method' => $validated['payment_method'],
                'payment_status' => 'paid',
                'notes' => ! empty($validated['customer_name']) ? "Customer: {$validated['customer_name']}" : null,
                'sold_at' => now(),
            ]);

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
            }

            if (! empty($validated['customer_id'])) {
                $earnedPoints = (int) floor($totalAmount / 100);
                if ($earnedPoints > 0) {
                    Customer::query()->where('id', $validated['customer_id'])->increment('loyalty_points', $earnedPoints);
                }
            }

            AuditLog::record(
                action: 'pos.sale_completed',
                description: "Completed POS invoice {$invoiceNumber} for {$totalAmount}.",
                subject: $sale,
                metadata: ['total' => $totalAmount, 'payment_method' => $validated['payment_method']],
            );

            return $sale;
        });

        return back()->with('success', "Invoice {$sale->invoice_number} recorded and FEFO stock deducted.");
    }
}
