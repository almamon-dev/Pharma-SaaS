<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Medicine;
use App\Models\Sale;
use App\Services\SalesOrderService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SalesOrderController extends Controller
{
    public function __construct(
        private readonly SalesOrderService $salesOrderService
    ) {}

    public function create(Request $request, TenantContext $tenantContext): Response
    {
        $user = $request->user();
        if ($tenantContext->hasRole('cashier') && ! $tenantContext->hasPermission('sales_orders.create') && ! $user?->isSubscriberAdmin()) {
            abort(403, 'Unauthorized. Cashiers cannot create salesman orders.');
        }

        $branchId = $tenantContext->branchId();
        $tenant = $tenantContext->tenant();

        $medicines = Medicine::query()
            ->where('is_active', true)
            ->with([
                'batches' => fn ($q) => $q->sellable($branchId)->orderBy('expiry_date'),
            ])
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
                'requires_prescription' => (bool) $med->requires_prescription,
                'selling_price' => (float) $med->default_selling_price,
                'box_selling_price' => $med->resolvedBoxSellingPrice(),
                'available_stock' => (int) ($med->available_stock ?? 0),
                'batches' => $med->batches->map(fn ($b) => [
                    'id' => $b->id,
                    'batch_number' => $b->batch_number,
                    'expiry_date' => $b->expiry_date?->format('d M Y'),
                    'quantity_available' => (int) $b->quantity_available,
                    'selling_price' => (float) ($b->selling_price ?: $med->default_selling_price),
                ]),
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

        return Inertia::render('Sales/CreateOrder', [
            'medicines' => $medicines,
            'customers' => $customers,
            'branchName' => $tenantContext->branch()?->name,
            'currency' => $tenant->currency_code ?? 'BDT',
        ]);
    }

    public function store(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $branch = $tenantContext->branch();
        $user = $request->user();

        if ($tenantContext->hasRole('cashier') && ! $tenantContext->hasPermission('sales_orders.create') && ! $user?->isSubscriberAdmin()) {
            abort(403, 'Unauthorized. Cashiers cannot create salesman orders.');
        }

        if (! $tenant || ! $branch) {
            return back()->with('error', 'Select an active branch before creating sales orders.');
        }

        $validated = $request->validate([
            'customer_id' => [
                'nullable',
                Rule::exists('customers', 'id')->where('tenant_id', $tenant->id),
            ],
            'doctor_name' => ['nullable', 'string', 'max:255'],
            'prescription_notes' => ['nullable', 'string', 'max:1000'],
            'prescription_file' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:10240'],
            'requires_verification' => ['nullable', 'boolean'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'discount_type' => ['nullable', Rule::in(['fixed', 'percent'])],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
            'is_draft' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => [
                'required',
                Rule::exists('medicines', 'id')->where('tenant_id', $tenant->id),
            ],
            'items.*.medicine_batch_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.sale_unit' => ['nullable', Rule::in(['piece', 'strip', 'box'])],
        ]);

        $prescriptionFile = $request->file('prescription_file');
        $isDraft = (bool) ($validated['is_draft'] ?? false);

        $sale = $this->salesOrderService->createSalesOrder(
            tenant: $tenant,
            branch: $branch,
            salesman: $user,
            validated: $validated,
            prescriptionFile: $prescriptionFile,
            isDraft: $isDraft
        );

        if ($isDraft) {
            return redirect()->route('sales.orders.my-orders')->with('success', "Order #{$sale->order_number} saved as draft.");
        }

        $counterName = $sale->counter ? "{$sale->counter->name} ({$sale->counter->code})" : 'Unassigned Queue';

        return redirect()->route('sales.orders.my-orders')->with('success', "Order #{$sale->order_number} submitted! Assigned to: {$counterName}.");
    }

    public function myOrders(Request $request, TenantContext $tenantContext): Response
    {
        $user = $request->user();
        if ($tenantContext->hasRole('cashier') && ! $tenantContext->hasPermission('sales_orders.view_own', 'sales_orders.view_all') && ! $user?->isSubscriberAdmin()) {
            abort(403, 'Unauthorized. Cashiers cannot access salesman order history.');
        }

        $branch = $tenantContext->branch();
        $tenant = $tenantContext->tenant();

        $statusFilter = $request->query('status');
        $search = $request->query('search');

        $ordersQuery = Sale::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->where('salesman_id', $user->id)
            ->with(['counter:id,code,name', 'customer:id,name,phone', 'items.medicine:id,name,unit'])
            ->latest();

        if ($statusFilter && $statusFilter !== 'all') {
            $ordersQuery->where('order_status', $statusFilter);
        }

        if ($search) {
            $ordersQuery->where(function ($q) use ($search): void {
                $q->where('order_number', 'ilike', "%{$search}%")
                    ->orWhere('invoice_number', 'ilike', "%{$search}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'ilike', "%{$search}%")->orWhere('phone', 'ilike', "%{$search}%"));
            });
        }

        $orders = $ordersQuery->paginate(15)->through(fn (Sale $s) => [
            'id' => $s->id,
            'order_number' => $s->order_number,
            'invoice_number' => $s->invoice_number,
            'customer_name' => $s->customer?->name ?? 'Walk-in Customer',
            'customer_phone' => $s->customer?->phone,
            'counter_id' => $s->counter_id,
            'counter_name' => $s->counter?->name,
            'counter_code' => $s->counter?->code,
            'order_status' => $s->order_status,
            'payment_status' => $s->payment_status,
            'total_amount' => (float) $s->total_amount,
            'paid_amount' => (float) $s->paid_amount,
            'items_count' => $s->items->count(),
            'created_at' => $s->created_at?->format('d M Y, h:i A'),
            'assigned_at' => $s->assigned_at?->format('d M Y, h:i A'),
            'completed_at' => $s->completed_at?->format('d M Y, h:i A'),
            'prescription_file' => $s->prescription_file,
            'items' => $s->items->map(fn ($it) => [
                'medicine_name' => $it->medicine?->name,
                'quantity' => $it->quantity,
                'sale_unit' => $it->sale_unit,
                'line_total' => (float) $it->line_total,
            ]),
        ]);

        return Inertia::render('Sales/MyOrders', [
            'orders' => $orders,
            'filters' => [
                'status' => $statusFilter,
                'search' => $search,
            ],
            'currency' => $tenant->currency_code ?? 'BDT',
            'branchName' => $branch?->name,
        ]);
    }

    public function track(Sale $sale): JsonResponse
    {
        $sale->load(['counter:id,code,name,status', 'cashier:id,name', 'statusHistories.user:id,name']);

        return response()->json([
            'order_number' => $sale->order_number,
            'order_status' => $sale->order_status,
            'counter' => $sale->counter ? [
                'id' => $sale->counter->id,
                'name' => $sale->counter->name,
                'code' => $sale->counter->code,
                'status' => $sale->counter->status,
            ] : null,
            'cashier_name' => $sale->cashier?->name,
            'total_amount' => (float) $sale->total_amount,
            'timeline' => $sale->statusHistories->map(fn ($h) => [
                'status' => $h->to_status,
                'user' => $h->user?->name,
                'reason' => $h->reason,
                'timestamp' => $h->created_at?->format('d M Y, h:i:s A'),
            ]),
        ]);
    }

    public function cancel(Request $request, Sale $sale): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $this->salesOrderService->cancelOrder($sale, $request->user(), $validated['reason']);

        return back()->with('success', "Order #{$sale->order_number} cancelled.");
    }
}
