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
            ->orderByRaw(
                "CASE WHEN EXISTS (SELECT 1 FROM medicine_batches mb WHERE mb.medicine_id = medicines.id AND mb.status = 'active' AND mb.quantity_available > 0"
                .($branchId ? ' AND mb.branch_id = '.(int) $branchId : '')
                .') THEN 0 ELSE 1 END, name ASC'
            )
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
            ->withCount('sales as purchase_count')
            ->withSum('sales as total_due', 'due_amount')
            ->orderBy('name')
            ->get(['id', 'customer_code', 'customer_type', 'name', 'phone', 'loyalty_points', 'allergies'])
            ->map(fn (Customer $c) => [
                'id' => $c->id,
                'customer_code' => $c->customer_code,
                'customer_type' => $c->customer_type ?: 'registered',
                'name' => $c->name,
                'phone' => $c->phone,
                'loyalty_points' => (int) $c->loyalty_points,
                'allergies' => $c->allergies,
                'purchase_count' => (int) $c->purchase_count,
                'total_due' => (float) ($c->total_due ?? 0),
            ]);

        $customerTypes = [
            ['value' => 'walk_in', 'label' => 'Walk-in Customer (নগদ ক্রেতা)'],
            ['value' => 'registered', 'label' => 'Registered Customer (নিবন্ধিত গ্রাহক)'],
            ['value' => 'patient', 'label' => 'Registered Patient (রোগী)'],
            ['value' => 'corporate', 'label' => 'Corporate Customer (প্রাতিষ্ঠানিক)'],
        ];

        $draftOrder = null;
        if ($draftId = $request->query('draft_id')) {
            $draft = Sale::query()
                ->where('id', $draftId)
                ->where('tenant_id', $tenant->id)
                ->where('order_status', 'draft')
                ->with(['items.medicine', 'customer'])
                ->first();

            if ($draft) {
                $draftOrder = [
                    'id' => $draft->id,
                    'order_number' => $draft->order_number,
                    'customer_id' => $draft->customer_id,
                    'customer' => $draft->customer ? [
                        'id' => $draft->customer->id,
                        'customer_code' => $draft->customer->customer_code,
                        'customer_type' => $draft->customer->customer_type ?: 'registered',
                        'name' => $draft->customer->name,
                        'phone' => $draft->customer->phone,
                        'total_due' => (float) $draft->customer->sales()->sum('due_amount'),
                    ] : null,
                    'doctor_name' => $draft->doctor_name,
                    'prescription_notes' => $draft->prescription_notes,
                    'prescription_reference' => $draft->prescription_reference,
                    'requires_verification' => (bool) $draft->requires_verification,
                    'discount' => (float) $draft->discount_amount,
                    'discount_percentage' => (float) $draft->discount_percentage,
                    'discount_type' => 'fixed',
                    'tax_amount' => (float) $draft->tax_amount,
                    'notes' => $draft->notes,
                    'internal_notes' => $draft->internal_notes,
                    'items' => $draft->items->map(fn ($it) => [
                        'medicine_id' => $it->medicine_id,
                        'medicine_batch_id' => $it->medicine_batch_id,
                        'quantity' => $it->quantity,
                        'sale_unit' => $it->sale_unit ?? 'piece',
                        'pack_quantity' => $it->pack_quantity,
                        'unit_price' => (float) $it->unit_price,
                        'line_total' => (float) $it->line_total,
                    ]),
                ];
            }
        }

        $permittedDiscountLimit = $this->salesOrderService->getPermittedDiscountLimit($tenant, $user);
        $taxPercentage = (float) ($tenant->settings['tax_percentage'] ?? 0.0);

        return Inertia::render('Sales/CreateOrder', [
            'medicines' => $medicines,
            'customers' => $customers,
            'customerTypes' => $customerTypes,
            'draftOrder' => $draftOrder,
            'permittedDiscountLimit' => $permittedDiscountLimit,
            'taxPercentage' => $taxPercentage,
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
            'prescription_reference' => ['nullable', 'string', 'max:100'],
            'prescription_file' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:10240'],
            'requires_verification' => ['nullable', 'boolean'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'discount_type' => ['nullable', Rule::in(['fixed', 'percent'])],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
            'internal_notes' => ['nullable', 'string', 'max:1000'],
            'is_draft' => ['nullable', 'boolean'],
            'draft_id' => ['nullable', 'integer'],
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
            'subtotal' => (float) $s->subtotal,
            'discount_amount' => (float) $s->discount_amount,
            'discount_status' => $s->discount_status,
            'discount_percentage' => (float) $s->discount_percentage,
            'tax_amount' => (float) $s->tax_amount,
            'total_amount' => (float) $s->total_amount,
            'paid_amount' => (float) $s->paid_amount,
            'items_count' => $s->items->count(),
            'notes' => $s->notes,
            'internal_notes' => $s->internal_notes,
            'prescription_reference' => $s->prescription_reference,
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

    /**
     * Quick register a customer from Sales Order screen without leaving page.
     * Prevents duplicate customer registration if matching phone number exists.
     */
    public function quickStoreCustomer(Request $request, TenantContext $tenantContext): JsonResponse
    {
        $tenant = $tenantContext->tenant();
        if (! $tenant) {
            return response()->json(['message' => 'No active tenant context found.'], 400);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'customer_type' => ['nullable', 'string', Rule::in(['walk_in', 'registered', 'patient', 'corporate'])],
            'allergies' => ['nullable', 'string', 'max:500'],
            'address' => ['nullable', 'string', 'max:500'],
        ]);

        $phone = ! empty($validated['phone']) ? trim($validated['phone']) : null;

        // Check if customer already exists by phone to prevent duplicates
        if ($phone) {
            $existing = Customer::query()
                ->where('tenant_id', $tenant->id)
                ->where('phone', $phone)
                ->first();

            if ($existing) {
                return response()->json([
                    'customer' => [
                        'id' => $existing->id,
                        'customer_code' => $existing->customer_code,
                        'customer_type' => $existing->customer_type ?: 'registered',
                        'name' => $existing->name,
                        'phone' => $existing->phone,
                        'allergies' => $existing->allergies,
                        'loyalty_points' => (int) $existing->loyalty_points,
                        'total_due' => (float) $existing->sales()->sum('due_amount'),
                        'purchase_count' => (int) $existing->sales()->count(),
                    ],
                    'is_existing' => true,
                    'message' => 'Customer already exists with this phone number. Reusing profile.',
                ]);
            }
        }

        $customerCode = 'CST-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));

        $customer = Customer::query()->create([
            'tenant_id' => $tenant->id,
            'customer_code' => $customerCode,
            'customer_type' => $validated['customer_type'] ?? 'registered',
            'name' => trim($validated['name']),
            'phone' => $phone,
            'address' => ! empty($validated['address']) ? trim($validated['address']) : null,
            'allergies' => ! empty($validated['allergies']) ? trim($validated['allergies']) : null,
            'loyalty_points' => 0,
        ]);

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'customer_code' => $customer->customer_code,
                'customer_type' => $customer->customer_type,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'allergies' => $customer->allergies,
                'loyalty_points' => 0,
                'total_due' => 0.0,
                'purchase_count' => 0,
            ],
            'is_existing' => false,
            'message' => 'New customer registered successfully.',
        ], 201);
    }

    /**
     * Delete an unassigned draft sales order.
     */
    public function destroyDraft(Request $request, Sale $sale): RedirectResponse
    {
        $this->salesOrderService->deleteDraft($sale, $request->user());

        return back()->with('success', "Draft order #{$sale->order_number} has been deleted.");
    }

    /**
     * Manager approves an order discount.
     */
    public function approveDiscount(Request $request, Sale $sale): RedirectResponse
    {
        $this->salesOrderService->approveDiscount($sale, $request->user());

        return back()->with('success', "Discount for order #{$sale->order_number} approved.");
    }

    /**
     * Manager rejects an order discount.
     */
    public function rejectDiscount(Request $request, Sale $sale): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $this->salesOrderService->rejectDiscount($sale, $request->user(), $validated['reason']);

        return back()->with('success', "Discount for order #{$sale->order_number} rejected.");
    }
}
