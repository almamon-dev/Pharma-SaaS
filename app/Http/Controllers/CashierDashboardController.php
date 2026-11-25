<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Counter;
use App\Models\CounterBreakLog;
use App\Models\CounterCashier;
use App\Models\CounterSession;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Services\CashCounterShiftService;
use App\Services\CounterAssignmentService;
use App\Services\SalesOrderService;
use App\Support\TenantContext;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CashierDashboardController extends Controller
{
    public function __construct(
        private readonly SalesOrderService $salesOrderService,
        private readonly CashCounterShiftService $shiftService
    ) {}

    public function dashboard(Request $request, TenantContext $tenantContext): Response
    {
        $user = $request->user();
        if ($tenantContext->hasRole('salesman') && ! $tenantContext->hasPermission('sales_orders.process', 'payments.receive') && ! $user?->isSubscriberAdmin()) {
            abort(403, 'Unauthorized. Salesmen cannot access cashier collection station.');
        }

        $branch = $tenantContext->branch();
        $tenant = $tenantContext->tenant();

        // 1. Find active open shift session for this cashier
        $activeSession = CounterSession::query()
            ->where('user_id', $user->id)
            ->where('status', 'open')
            ->with(['counter'])
            ->first();

        $activeCounter = $activeSession?->counter;

        // If no active session by user, check if cashier has a counter where they are logged in
        if (! $activeCounter) {
            $activeCounter = Counter::query()
                ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
                ->where('current_user_id', $user->id)
                ->where('status', '!=', 'closed')
                ->first();
        }

        $today = Carbon::today();

        // 2. Financial Metrics for today
        $counterId = $activeCounter?->id;

        $paymentsQuery = SalePayment::query()
            ->where('tenant_id', $tenant->id)
            ->whereDate('created_at', $today);

        if ($counterId) {
            $paymentsQuery->whereHas('sale', fn ($q) => $q->where('counter_id', $counterId));
        }

        $cashCollection = (float) (clone $paymentsQuery)->where('payment_method', 'cash')->sum('amount');
        $cardCollection = (float) (clone $paymentsQuery)->where('payment_method', 'card')->sum('amount');
        $mobileCollection = (float) (clone $paymentsQuery)->whereIn('payment_method', ['bkash', 'nagad', 'rocket'])->sum('amount');
        $totalCollection = $cashCollection + $cardCollection + $mobileCollection;

        $salesQuery = Sale::query()
            ->where('tenant_id', $tenant->id)
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id));

        if ($counterId) {
            $salesQuery->where('counter_id', $counterId);
        }

        $totalTransactions = (clone $salesQuery)->whereDate('sold_at', $today)->where('order_status', 'completed')->count();
        $completedTodaySales = (clone $salesQuery)->whereDate('sold_at', $today)->where('order_status', 'completed')->sum('total_amount');
        $pendingOrdersCount = (clone $salesQuery)->whereIn('order_status', ['assigned', 'waiting', 'processing'])->count();

        // 3. Counter Queues
        $incomingOrders = [];
        $processingOrders = [];
        $completedOrders = [];

        if ($activeCounter) {
            $baseQueueQuery = Sale::query()
                ->where('tenant_id', $tenant->id)
                ->where('counter_id', $activeCounter->id)
                ->with([
                    'customer:id,name,phone,loyalty_points',
                    'salesman:id,name',
                    'items.medicine:id,name,unit,dosage_form,strength',
                    'payments',
                ]);

            $incomingOrders = (clone $baseQueueQuery)
                ->whereIn('order_status', ['assigned', 'waiting'])
                ->orderBy('assigned_at', 'asc')
                ->get()
                ->map(fn (Sale $s) => $this->formatOrderPayload($s));

            $processingOrders = (clone $baseQueueQuery)
                ->where('order_status', 'processing')
                ->orderBy('processing_started_at', 'asc')
                ->get()
                ->map(fn (Sale $s) => $this->formatOrderPayload($s));

            $completedOrders = (clone $baseQueueQuery)
                ->where('order_status', 'completed')
                ->whereDate('completed_at', $today)
                ->latest('completed_at')
                ->limit(20)
                ->get()
                ->map(fn (Sale $s) => $this->formatOrderPayload($s));
        }

        // Recent completed transactions for today (for table display)
        $recentTransactions = (clone $salesQuery)
            ->where('order_status', 'completed')
            ->whereDate('completed_at', $today)
            ->with(['customer:id,name,phone', 'salesman:id,name', 'payments', 'items.medicine'])
            ->latest('completed_at')
            ->limit(10)
            ->get()
            ->map(function (Sale $s) {
                $primaryPayment = $s->payments->first();
                $method = $primaryPayment ? strtolower($primaryPayment->payment_method) : 'cash';

                return [
                    'id' => $s->id,
                    'invoice_number' => $s->invoice_number ?? $s->order_number,
                    'customer_name' => $s->customer?->name ?? 'Walk-in Customer',
                    'payment_method' => $method,
                    'total_amount' => (float) $s->total_amount,
                    'time' => $s->completed_at ? $s->completed_at->format('h:i A') : ($s->sold_at ? $s->sold_at->format('h:i A') : ''),
                    'status' => 'Completed',
                    'order' => $this->formatOrderPayload($s),
                ];
            });

        // Latest activity timeline items
        $latestActivity = [];
        if ($activeSession && $activeSession->opened_at) {
            $latestActivity[] = [
                'id' => 'shift-' . $activeSession->id,
                'type' => 'shift',
                'title' => 'Shift opened with ৳' . number_format($activeSession->opening_float, 2) . ' float',
                'time' => $activeSession->opened_at->format('h:i A'),
                'timestamp' => $activeSession->opened_at->timestamp,
            ];
        }

        foreach ($completedOrders as $co) {
            $latestActivity[] = [
                'id' => 'completed-' . $co['id'],
                'type' => 'completed',
                'title' => "{$co['order_number']} completed (৳" . number_format($co['total_amount'], 2) . ')',
                'time' => $co['completed_at'] ?? '',
                'timestamp' => strtotime($co['completed_at'] ?? 'now'),
            ];
        }

        foreach ($incomingOrders as $io) {
            $latestActivity[] = [
                'id' => 'assigned-' . $io['id'],
                'type' => 'assigned',
                'title' => "{$io['order_number']} assigned to counter",
                'time' => $io['assigned_at'] ?? '',
                'timestamp' => strtotime($io['assigned_at'] ?? 'now'),
            ];
        }

        usort($latestActivity, fn ($a, $b) => $b['timestamp'] <=> $a['timestamp']);
        $latestActivity = array_slice($latestActivity, 0, 8);

        // Available counters if cashier needs to switch or open shift
        $availableCounters = Counter::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->where('is_active', true)
            ->with(['currentUser:id,name', 'currentSession'])
            ->get()
            ->map(fn (Counter $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name,
                'type' => $c->type ?? 'pos',
                'status' => $c->status,
                'location' => $c->location,
                'current_user_id' => $c->current_user_id,
                'current_user_name' => $c->currentUser?->name,
                'current_cashier' => $c->currentUser?->name,
            ]);

        $liveSessionSummary = $activeSession
            ? $this->shiftService->calculateLiveDrawerSummary($activeSession)
            : null;

        $activeSessionPayload = ($activeSession && $liveSessionSummary) ? [
            'id' => $activeSession->id,
            'user_id' => $activeSession->user_id,
            'user_name' => $user->name,
            'opened_at' => $activeSession->opened_at?->format('h:i A'),
            'opened_date_time' => $activeSession->opened_at ? ($activeSession->opened_at->isToday() ? 'Today, ' . $activeSession->opened_at->format('h:i A') : $activeSession->opened_at->format('M d, h:i A')) : 'Today, 8:00 AM',
            'opening_float' => (float) $liveSessionSummary['opening_float'],
            'cash_sales' => (float) $liveSessionSummary['cash_sales'],
            'card_sales' => (float) $liveSessionSummary['card_sales'],
            'mobile_sales' => (float) $liveSessionSummary['mobile_sales'],
            'cash_in' => (float) $liveSessionSummary['cash_in'],
            'cash_out_total' => (float) $liveSessionSummary['cash_out_total'],
            'cash_refunds' => (float) $liveSessionSummary['cash_refunds'],
            'system_expected_cash' => (float) $liveSessionSummary['expected_cash'],
            'shift' => $activeSession->shift ?? 'morning',
            'total_sales_amount' => (float) $liveSessionSummary['total_sales'],
            'total_transactions' => (int) $liveSessionSummary['total_transactions'],
        ] : null;

        return Inertia::render('Cashier/Dashboard', [
            'activeCounter' => $activeCounter ? [
                'id' => $activeCounter->id,
                'code' => $activeCounter->code,
                'name' => $activeCounter->name,
                'type' => $activeCounter->type ?? 'pos',
                'status' => $activeCounter->status,
                'location' => $activeCounter->location,
                'max_queue_capacity' => (int) ($activeCounter->max_queue_capacity ?? 50),
                'current_break_reason' => $activeCounter->current_break_reason,
                'current_session' => $activeSessionPayload,
            ] : null,
            'activeSession' => $activeSessionPayload,
            'metrics' => [
                'total_collection' => (float) $totalCollection,
                'cash_collection' => (float) $cashCollection,
                'card_collection' => (float) $cardCollection,
                'mobile_collection' => (float) $mobileCollection,
                'total_transactions' => (int) $totalTransactions,
                'completed_sales_amount' => (float) $completedTodaySales,
                'pending_orders' => (int) $pendingOrdersCount,
            ],
            'queues' => [
                'incoming' => $incomingOrders,
                'processing' => $processingOrders,
                'completed' => $completedOrders,
            ],
            'recentTransactions' => $recentTransactions,
            'latestActivity' => $latestActivity,
            'availableCounters' => $availableCounters,
            'currency' => $tenant->currency_code ?? 'BDT',
            'branchName' => $branch?->name,
        ]);
    }

    public function autoOpenShift(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $branch = $tenantContext->branch();
        $tenant = $tenantContext->tenant();

        if (! $tenant || ! $branch) {
            return back()->with('error', 'Select an active branch before starting a shift.');
        }

        $validated = $request->validate([
            'opening_float' => ['nullable', 'numeric', 'min:0'],
            'shift' => ['nullable', Rule::in(['morning', 'evening', 'night'])],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $session = $this->shiftService->autoOpenShift(
                tenant: $tenant,
                branch: $branch,
                cashier: $user,
                openingFloat: $validated['opening_float'] ?? 0,
                shift: $validated['shift'] ?? null,
                notes: $validated['notes'] ?? null,
            );
        } catch (ValidationException $e) {
            $firstMessage = collect($e->errors())->flatten()->first() ?? 'Could not start shift.';

            return back()->with('error', $firstMessage);
        }

        $counter = $session->counter;

        return back()->with('success', "Shift started on Counter {$counter?->code} ({$counter?->name}) with Opening Float ৳{$session->opening_float}.");
    }

    public function resumeShift(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $branch = $tenantContext->branch();

        $activeSession = CounterSession::query()
            ->where('user_id', $user->id)
            ->where('status', 'open')
            ->with('counter')
            ->first();

        $counter = $activeSession?->counter ?? Counter::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->where('current_user_id', $user->id)
            ->where('status', 'on_break')
            ->first();

        if (! $counter) {
            return back()->with('error', 'No paused counter shift found to resume.');
        }

        DB::transaction(function () use ($counter, $user): void {
            $activeBreak = CounterBreakLog::query()
                ->where('counter_id', $counter->id)
                ->whereNull('ended_at')
                ->latest('started_at')
                ->first();

            if ($activeBreak) {
                $ended = now();
                $mins = max(1, (int) $ended->diffInMinutes($activeBreak->started_at));
                $activeBreak->update([
                    'ended_at' => $ended,
                    'duration_minutes' => $mins,
                ]);
            }

            $counter->update([
                'status' => 'active',
                'current_break_reason' => null,
                'break_started_at' => null,
            ]);

            AuditLog::record(
                action: 'counter.break_resumed',
                description: "Cashier {$user->name} resumed service on Counter {$counter->code}.",
                subject: $counter,
                metadata: ['counter_id' => $counter->id]
            );
        });

        app(CounterAssignmentService::class)->processUnassignedQueue($counter->tenant_id, $counter->branch_id);

        return back()->with('success', "Counter {$counter->code} resumed from break. Ready for orders!");
    }

    public function accept(Request $request, Sale $sale): RedirectResponse
    {
        $this->salesOrderService->acceptOrder($sale, $request->user());

        return back()->with('success', "Order #{$sale->order_number} moved to processing.");
    }

    public function processPayment(Request $request, Sale $sale): RedirectResponse
    {
        $user = $request->user();

        // Check active counter session
        $activeSession = CounterSession::query()
            ->where('user_id', $user->id)
            ->where('status', 'open')
            ->with('counter')
            ->first();

        if (! $activeSession || ! $activeSession->counter) {
            return back()->with('error', 'You must have an open counter shift session to process payments.');
        }

        $validated = $request->validate([
            'payment_method' => ['nullable', 'string', 'max:50'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'payments' => ['nullable', 'array'],
            'payments.*.method' => ['required_with:payments', 'string', Rule::in(['cash', 'card', 'bkash', 'nagad', 'rocket'])],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'min:0.01'],
            'payments.*.reference_number' => ['nullable', 'string', 'max:100'],
        ]);

        $completedSale = $this->salesOrderService->processPayment(
            sale: $sale,
            cashier: $user,
            counter: $activeSession->counter,
            paymentData: $validated
        );

        return back()->with('success', "Payment completed for Order #{$completedSale->order_number}! Invoice #{$completedSale->invoice_number} generated.");
    }

    public function requestReassign(Request $request, Sale $sale): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $sale->recordStatus(
            toStatus: 'waiting',
            user: $request->user(),
            reason: "Cashier requested reassignment: {$validated['reason']}"
        );

        return back()->with('success', "Reassignment request recorded for Order #{$sale->order_number}.");
    }

    public function invoice(Sale $sale): JsonResponse
    {
        $sale->load([
            'customer:id,name,phone,loyalty_points',
            'salesman:id,name',
            'cashier:id,name',
            'counter:id,code,name',
            'branch:id,name,address,phone',
            'items.medicine:id,name,unit,strength,dosage_form',
            'payments',
        ]);

        return response()->json([
            'invoice_number' => $sale->invoice_number,
            'order_number' => $sale->order_number,
            'sold_at' => $sale->sold_at?->format('d M Y, h:i A'),
            'branch' => [
                'name' => $sale->branch?->name,
                'address' => $sale->branch?->address,
                'phone' => $sale->branch?->phone,
            ],
            'counter' => [
                'code' => $sale->counter?->code,
                'name' => $sale->counter?->name,
            ],
            'cashier' => $sale->cashier?->name,
            'salesman' => $sale->salesman?->name,
            'customer' => [
                'name' => $sale->customer?->name ?? 'Walk-in Customer',
                'phone' => $sale->customer?->phone,
            ],
            'items' => $sale->items->map(fn ($it) => [
                'name' => $it->medicine?->name,
                'dosage_form' => $it->medicine?->dosage_form,
                'strength' => $it->medicine?->strength,
                'quantity' => $it->quantity,
                'unit' => $it->sale_unit ?: $it->medicine?->unit,
                'unit_price' => (float) $it->unit_price,
                'line_total' => (float) $it->line_total,
            ]),
            'subtotal' => (float) $sale->subtotal,
            'discount_amount' => (float) $sale->discount_amount,
            'tax_amount' => (float) $sale->tax_amount,
            'total_amount' => (float) $sale->total_amount,
            'paid_amount' => (float) $sale->paid_amount,
            'due_amount' => (float) $sale->due_amount,
            'change_amount' => (float) $sale->change_amount,
            'payment_method' => $sale->payment_method,
            'payment_status' => $sale->payment_status,
            'payments' => $sale->payments->map(fn ($p) => [
                'method' => $p->payment_method,
                'amount' => (float) $p->amount,
                'reference_number' => $p->reference_number,
            ]),
        ]);
    }

    private function formatOrderPayload(Sale $s): array
    {
        $salesmanName = $s->salesman?->name ?? 'Salesman';
        $words = preg_split('/\s+/', trim($salesmanName));
        $initials = '';
        foreach ($words as $w) {
            if (! empty($w)) {
                $initials .= strtoupper($w[0]);
            }
        }
        $initials = substr($initials, 0, 2) ?: 'SM';

        return [
            'id' => $s->id,
            'order_number' => $s->order_number,
            'invoice_number' => $s->invoice_number,
            'customer_name' => $s->customer?->name ?? 'Walk-in Customer',
            'customer_phone' => $s->customer?->phone,
            'customer_allergies' => $s->customer?->allergies,
            'salesman_name' => $s->salesman?->name,
            'salesman_initials' => $initials,
            'total_amount' => (float) $s->total_amount,
            'subtotal' => (float) $s->subtotal,
            'discount_amount' => (float) $s->discount_amount,
            'tax_amount' => (float) $s->tax_amount,
            'order_status' => $s->order_status,
            'payment_status' => $s->payment_status,
            'prescription_file' => $s->prescription_file,
            'doctor_name' => $s->doctor_name,
            'prescription_notes' => $s->prescription_notes,
            'created_at' => $s->created_at?->format('h:i A'),
            'assigned_at' => $s->assigned_at?->format('h:i A'),
            'assigned_date_time' => $s->assigned_at ? ($s->assigned_at->isToday() ? 'Today, ' . $s->assigned_at->format('h:i A') : $s->assigned_at->format('M d, h:i A')) : 'Today, ' . now()->format('h:i A'),
            'assigned_time_ago' => $s->assigned_at ? $s->assigned_at->diffForHumans() : 'Just now',
            'processing_started_at' => $s->processing_started_at?->format('h:i A'),
            'completed_at' => $s->completed_at?->format('h:i A'),
            'items_count' => $s->items->count(),
            'items' => $s->items->map(fn ($it) => [
                'id' => $it->id,
                'medicine_id' => $it->medicine_id,
                'medicine_name' => $it->medicine?->name,
                'dosage_form' => $it->medicine?->dosage_form,
                'strength' => $it->medicine?->strength,
                'quantity' => $it->quantity,
                'sale_unit' => $it->sale_unit,
                'pack_size' => $it->pack_size,
                'unit_price' => (float) $it->unit_price,
                'line_total' => (float) $it->line_total,
            ]),
        ];
    }
}
