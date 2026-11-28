<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Counter;
use App\Models\CounterBreakLog;
use App\Models\CounterCashier;
use App\Models\CounterCashMovement;
use App\Models\CounterSession;
use App\Models\Sale;
use App\Models\User;
use App\Services\CashCounterShiftService;
use App\Services\CounterAssignmentService;
use App\Support\TenantContext;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CounterController extends Controller
{
    public function __construct(
        private readonly CashCounterShiftService $shiftService
    ) {}
    public function index(Request $request, TenantContext $tenantContext): Response
    {
        $branch = $tenantContext->branch();
        $tenant = $tenantContext->tenant();
        $user = $request->user();

        $canManageCounters = $tenantContext->hasRole(['admin', 'manager']) || ($user && $user->isSubscriberAdmin());
        if ($tenantContext->hasRole('salesman') && ! $user?->isSubscriberAdmin() && ! $canManageCounters) {
            abort(403, 'Unauthorized. Salesmen cannot manage cash counters or registers.');
        }
        $isCashier = ! $canManageCounters;

        if ($isCashier && $user) {
            // Cashier context: only personal shift and available stations
            $myActiveSession = CounterSession::query()
                ->where('user_id', $user->id)
                ->where('status', 'open')
                ->first();

            $countersQuery = Counter::query()
                ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
                ->with([
                    'currentUser:id,name,email',
                    'currentSession' => fn ($q) => $q->with('user:id,name'),
                    'cashierAssignments.user:id,name,email',
                ])
                ->withCount([
                    'sales as active_queue_count' => fn ($q) => $q->whereIn('order_status', ['assigned', 'waiting', 'processing']),
                ])
                ->where('is_active', true);

            if ($myActiveSession) {
                // If cashier currently has an open shift, show only their assigned counter
                $countersQuery->where('id', $myActiveSession->counter_id);
            } else {
                // If cashier has no shift, show counters ready for shift intake or assigned to this cashier
                $countersQuery->where(function ($q) use ($user): void {
                    $q->where('status', 'closed')
                        ->orWhereHas('cashierAssignments', fn ($sub) => $sub->where('user_id', $user->id));
                });
            }

            $recentSessionsQuery = CounterSession::query()
                ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
                ->where('user_id', $user->id)
                ->with(['counter:id,code,name', 'user:id,name'])
                ->latest('opened_at')
                ->limit(20);
        } else {
            // Admin / Manager context: full counter terminal management & branch-wide audit logs
            $countersQuery = Counter::query()
                ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
                ->with([
                    'currentUser:id,name,email',
                    'currentSession' => fn ($q) => $q->with('user:id,name'),
                    'cashierAssignments.user:id,name,email',
                ])
                ->withCount([
                    'sales as active_queue_count' => fn ($q) => $q->whereIn('order_status', ['assigned', 'waiting', 'processing']),
                ]);

            $recentSessionsQuery = CounterSession::query()
                ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
                ->with(['counter:id,code,name', 'user:id,name'])
                ->latest('opened_at')
                ->limit(20);
        }

        $counters = $countersQuery
            ->orderBy('code')
            ->get()
            ->map(fn (Counter $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name,
                'type' => $c->type,
                'zone' => $c->zone,
                'location' => $c->location,
                'status' => $c->status,
                'max_queue_capacity' => (int) ($c->max_queue_capacity ?: 20),
                'auto_assignment_enabled' => (bool) $c->auto_assignment_enabled,
                'active_queue_count' => (int) ($c->active_queue_count ?? 0),
                'current_break_reason' => $c->current_break_reason,
                'break_started_at' => $c->break_started_at?->toISOString(),
                'printer_ip' => $c->printer_ip,
                'terminal_device_id' => $c->terminal_device_id,
                'is_active' => (bool) $c->is_active,
                'current_user' => $c->currentUser ? [
                    'id' => $c->currentUser->id,
                    'name' => $c->currentUser->name,
                ] : null,
                'current_session' => $c->currentSession ? (function () use ($c): array {
                    $live = $this->shiftService->calculateLiveDrawerSummary($c->currentSession);
                    $sessionSales = Sale::query()
                        ->where('counter_session_id', $c->currentSession->id)
                        ->whereNotIn('order_status', ['draft', 'cancelled'])
                        ->with('payments:id,sale_id,payment_method,amount')
                        ->get(['id', 'total_amount', 'paid_amount', 'change_amount', 'payment_method']);

                    $breakdown = [
                        'cash' => 0.0,
                        'card' => 0.0,
                        'bkash' => 0.0,
                        'nagad' => 0.0,
                    ];

                    foreach ($sessionSales as $sale) {
                        if ($sale->payments->isNotEmpty()) {
                            $changeRemaining = (float) ($sale->change_amount ?? 0);
                            foreach ($sale->payments as $payment) {
                                $method = strtolower((string) $payment->payment_method);
                                $amt = (float) $payment->amount;
                                if ($method === 'cash') {
                                    $net = max(0.0, $amt - $changeRemaining);
                                    $changeRemaining = max(0.0, $changeRemaining - $amt);
                                    $breakdown['cash'] += $net;
                                } elseif ($method === 'card') {
                                    $breakdown['card'] += $amt;
                                } elseif ($method === 'bkash') {
                                    $breakdown['bkash'] += $amt;
                                } elseif ($method === 'nagad') {
                                    $breakdown['nagad'] += $amt;
                                }
                            }
                        } else {
                            $method = strtolower((string) ($sale->payment_method ?? 'cash'));
                            $amt = (float) ($sale->paid_amount > 0 ? $sale->paid_amount : $sale->total_amount);
                            if (array_key_exists($method, $breakdown)) {
                                $breakdown[$method] += $amt;
                            }
                        }
                    }

                    return [
                        'id' => $c->currentSession->id,
                        'user_id' => $c->currentSession->user_id,
                        'user_name' => $c->currentSession->user?->name,
                        'shift' => $c->currentSession->shift ?? 'morning',
                        'opened_at' => $c->currentSession->opened_at?->toISOString(),
                        'opened_at_time' => $c->currentSession->opened_at?->format('h:i A'),
                        'opened_at_display' => $c->currentSession->opened_at?->format('d M Y h:i A'),
                        'opening_float' => (float) $live['opening_float'],
                        'opening_denominations' => $c->currentSession->opening_denominations,
                        'cash_sales' => (float) $live['cash_sales'],
                        'card_sales' => (float) $live['card_sales'],
                        'mobile_sales' => (float) $live['mobile_sales'],
                        'payment_breakdown' => [
                            'cash' => round($breakdown['cash'], 2),
                            'card' => round($breakdown['card'], 2),
                            'bkash' => round($breakdown['bkash'], 2),
                            'nagad' => round($breakdown['nagad'], 2),
                        ],
                        'cash_in' => (float) $live['cash_in'],
                        'cash_out_total' => (float) $live['cash_out_total'],
                        'cash_refunds' => (float) $live['cash_refunds'],
                        'total_sales_amount' => (float) $live['total_sales'],
                        'total_transactions' => (int) $live['total_transactions'],
                        'system_expected_cash' => (float) $live['expected_cash'],
                    ];
                })() : null,
                'assigned_cashiers' => $c->cashierAssignments->map(fn (CounterCashier $ca) => [
                    'id' => $ca->id,
                    'user_id' => $ca->user_id,
                    'user_name' => $ca->user?->name,
                    'shift' => $ca->shift,
                    'is_primary' => (bool) $ca->is_primary,
                    'is_active' => (bool) $ca->is_active,
                ]),
            ]);

        $recentSessions = $recentSessionsQuery
            ->get()
            ->map(fn (CounterSession $s) => [
                'id' => $s->id,
                'z_report_number' => $s->z_report_number,
                'is_force_closed' => (bool) $s->is_force_closed,
                'force_close_reason' => $s->force_close_reason,
                'counter_code' => $s->counter?->code,
                'counter_name' => $s->counter?->name,
                'user_name' => $s->user?->name,
                'status' => $s->status,
                'shift' => $s->shift ?? 'morning',
                'opened_at' => $s->opened_at?->format('d M Y, h:i A'),
                'closed_at' => $s->closed_at?->format('d M Y, h:i A'),
                'opening_float' => (float) $s->opening_float,
                'cash_in_total' => (float) $s->cash_in_total,
                'cash_out_total' => (float) $s->cash_out_total,
                'cash_refunds_total' => (float) $s->cash_refunds_total,
                'closing_cash_counted' => $s->closing_cash_counted !== null ? (float) $s->closing_cash_counted : null,
                'system_expected_cash' => (float) $s->system_expected_cash,
                'discrepancy' => $s->discrepancy !== null ? (float) $s->discrepancy : null,
                'total_sales_amount' => (float) $s->total_sales_amount,
                'total_transactions' => (int) $s->total_transactions,
                'notes' => $s->notes,
            ]);

        // Eligible cashiers list for assignment modal
        $eligibleCashiers = User::query()
            ->where(function ($q) use ($tenant, $user): void {
                if ($user->isSubscriberAdmin()) {
                    $q->where('subscriber_id', $user->id)
                        ->orWhere('id', $user->id);
                } else {
                    $q->where('subscriber_id', $user->subscriber_id);
                }
            })
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
            ]);

        // Recent orders for the cashier's active shift session
        $recentOrders = collect();
        if ($isCashier && isset($myActiveSession) && $myActiveSession) {
            $recentOrders = Sale::query()
                ->where('counter_session_id', $myActiveSession->id)
                ->whereNotIn('order_status', ['draft', 'cancelled'])
                ->with(['customer:id,name'])
                ->withCount('items')
                ->latest('sold_at')
                ->latest('id')
                ->limit(6)
                ->get()
                ->map(fn (Sale $sale) => [
                    'id' => $sale->id,
                    'invoice_number' => $sale->invoice_number ?: $sale->order_number ?: ('#'.$sale->id),
                    'customer_name' => $sale->customer?->name ?: 'Walk-in Customer',
                    'payment_method' => strtolower((string) ($sale->payment_method ?: 'cash')),
                    'total_amount' => (float) $sale->total_amount,
                    'items_count' => (int) ($sale->items_count ?? 0),
                    'order_status' => (string) ($sale->order_status ?: 'completed'),
                    'time' => ($sale->sold_at ?? $sale->created_at)?->format('h:i A'),
                ]);
        }

        // Branch-wide unassigned orders count
        $unassignedOrdersCount = Sale::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->where('order_status', 'unassigned')
            ->count();

        return Inertia::render('Counters/Index', [
            'counters' => $counters,
            'recentSessions' => $recentSessions,
            'recentOrders' => $recentOrders,
            'eligibleCashiers' => $eligibleCashiers,
            'unassignedOrdersCount' => $unassignedOrdersCount,
            'branchName' => $branch?->name,
            'currency' => $tenant->currency_code ?? 'BDT',
            'canManageCounters' => $canManageCounters,
            'isCashier' => $isCashier,
        ]);
    }

    public function store(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $branch = $tenantContext->branch();

        if (! $tenant || ! $branch) {
            return back()->with('error', 'Select an active branch before creating counters.');
        }

        $validated = $request->validate([
            'code' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('counters')->where(fn ($query) => $query
                    ->where('tenant_id', $tenant->id)
                    ->where('branch_id', $branch->id)
                ),
            ],
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', 'string', Rule::in(['opd', 'ipd', 'express', 'general', 'billing', 'emergency', 'hybrid'])],
            'zone' => ['nullable', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:120'],
            'max_queue_capacity' => ['nullable', 'integer', 'min:1', 'max:100'],
            'auto_assignment_enabled' => ['nullable', 'boolean'],
            'printer_ip' => ['nullable', 'string', 'max:50'],
            'terminal_device_id' => ['nullable', 'string', 'max:100'],
        ]);

        $code = ! empty($validated['code'])
            ? strtoupper(trim($validated['code']))
            : $this->generateCounterCode($tenant->id, $branch->id);

        $counter = Counter::query()->create([
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'code' => $code,
            'name' => trim($validated['name']),
            'type' => $validated['type'],
            'zone' => ! empty($validated['zone']) ? trim($validated['zone']) : 'General',
            'location' => ! empty($validated['location']) ? trim($validated['location']) : null,
            'status' => 'closed',
            'max_queue_capacity' => (int) ($validated['max_queue_capacity'] ?? 20),
            'auto_assignment_enabled' => $request->has('auto_assignment_enabled') ? (bool) $validated['auto_assignment_enabled'] : true,
            'printer_ip' => ! empty($validated['printer_ip']) ? trim($validated['printer_ip']) : null,
            'terminal_device_id' => ! empty($validated['terminal_device_id']) ? trim($validated['terminal_device_id']) : null,
            'is_active' => true,
        ]);

        AuditLog::record(
            action: 'counter.created',
            description: "Created counter {$counter->code} ({$counter->name}) in branch {$branch->name}.",
            subject: $counter,
            metadata: ['code' => $counter->code, 'name' => $counter->name, 'type' => $counter->type]
        );

        return back()->with('success', "Counter {$counter->code} ({$counter->name}) created successfully.");
    }

    public function update(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $branch = $tenantContext->branch();

        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:20',
                Rule::unique('counters')->where(fn ($query) => $query
                    ->where('tenant_id', $tenant->id)
                    ->where('branch_id', $branch->id)
                )->ignore($counter->id),
            ],
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', 'string', Rule::in(['opd', 'ipd', 'express', 'general', 'billing', 'emergency', 'hybrid'])],
            'zone' => ['nullable', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:120'],
            'max_queue_capacity' => ['nullable', 'integer', 'min:1', 'max:100'],
            'auto_assignment_enabled' => ['nullable', 'boolean'],
            'printer_ip' => ['nullable', 'string', 'max:50'],
            'terminal_device_id' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $counter->update([
            'code' => strtoupper(trim($validated['code'])),
            'name' => trim($validated['name']),
            'type' => $validated['type'],
            'zone' => ! empty($validated['zone']) ? trim($validated['zone']) : 'General',
            'location' => ! empty($validated['location']) ? trim($validated['location']) : null,
            'max_queue_capacity' => (int) ($validated['max_queue_capacity'] ?? 20),
            'auto_assignment_enabled' => $request->has('auto_assignment_enabled') ? (bool) $validated['auto_assignment_enabled'] : $counter->auto_assignment_enabled,
            'printer_ip' => ! empty($validated['printer_ip']) ? trim($validated['printer_ip']) : null,
            'terminal_device_id' => ! empty($validated['terminal_device_id']) ? trim($validated['terminal_device_id']) : null,
            'is_active' => $request->has('is_active') ? (bool) $validated['is_active'] : $counter->is_active,
        ]);

        AuditLog::record(
            action: 'counter.updated',
            description: "Updated counter details for {$counter->code}.",
            subject: $counter,
            metadata: $validated
        );

        return back()->with('success', "Counter {$counter->code} updated successfully.");
    }

    public function assignCashier(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $branch = $tenantContext->branch();

        $validated = $request->validate([
            'user_id' => ['required', Rule::exists('users', 'id')],
            'shift' => ['required', Rule::in(['morning', 'evening', 'night', 'any'])],
            'is_primary' => ['nullable', 'boolean'],
        ]);

        $assignment = CounterCashier::query()->updateOrCreate(
            [
                'counter_id' => $counter->id,
                'user_id' => $validated['user_id'],
                'shift' => $validated['shift'],
            ],
            [
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'is_primary' => (bool) ($validated['is_primary'] ?? false),
                'is_active' => true,
            ]
        );

        $cashier = User::query()->find($validated['user_id']);

        AuditLog::record(
            action: 'counter.cashier_assigned',
            description: "Assigned cashier {$cashier?->name} to Counter {$counter->code} for {$validated['shift']} shift.",
            subject: $counter,
            metadata: $validated
        );

        return back()->with('success', "Cashier {$cashier?->name} assigned to Counter {$counter->code} ({$validated['shift']} shift).");
    }

    public function unassignCashier(Request $request, Counter $counter, User $cashier): RedirectResponse
    {
        CounterCashier::query()
            ->where('counter_id', $counter->id)
            ->where('user_id', $cashier->id)
            ->delete();

        AuditLog::record(
            action: 'counter.cashier_unassigned',
            description: "Removed cashier {$cashier->name} assignment from Counter {$counter->code}.",
            subject: $counter,
            metadata: ['counter_id' => $counter->id, 'user_id' => $cashier->id]
        );

        return back()->with('success', "Cashier {$cashier->name} unassigned from Counter {$counter->code}.");
    }

    public function openSession(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $branch = $tenantContext->branch();
        $tenant = $tenantContext->tenant();

        if (! $tenant || ! $branch) {
            return back()->with('error', 'Select an active branch before opening a shift.');
        }

        $validated = $request->validate([
            'opening_float' => ['required', 'numeric', 'min:0'],
            'opening_denominations' => ['nullable', 'array'],
            'opening_denominations.*' => ['nullable', 'integer', 'min:0'],
            'shift' => ['nullable', Rule::in(['morning', 'evening', 'night'])],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $this->shiftService->openShift(
                tenant: $tenant,
                branch: $branch,
                counter: $counter,
                cashier: $user,
                openingFloat: $validated['opening_float'],
                shift: $validated['shift'] ?? null,
                notes: $validated['notes'] ?? null,
                openingDenominations: $validated['opening_denominations'] ?? null,
            );
        } catch (ValidationException $e) {
            $firstMessage = collect($e->errors())->flatten()->first() ?? 'Could not open shift.';

            return back()->with('error', $firstMessage);
        }

        return back()->with('success', "Shift started on Counter {$counter->code} with opening float.");
    }

    public function takeBreak(Request $request, Counter $counter): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'break_type' => ['required', 'string', Rule::in(['lunch', 'prayer', 'tea', 'audit', 'custom'])],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $session = $counter->currentSession;

        DB::transaction(function () use ($counter, $user, $session, $validated) {
            $counter->update([
                'status' => 'on_break',
                'current_break_reason' => $validated['break_type'],
                'break_started_at' => now(),
            ]);

            CounterBreakLog::query()->create([
                'tenant_id' => $counter->tenant_id,
                'branch_id' => $counter->branch_id,
                'counter_id' => $counter->id,
                'counter_session_id' => $session?->id,
                'user_id' => $user->id,
                'break_type' => $validated['break_type'],
                'started_at' => now(),
                'notes' => $validated['notes'] ?? null,
            ]);

            AuditLog::record(
                action: 'counter.break_started',
                description: "Counter {$counter->code} paused for {$validated['break_type']} break.",
                subject: $counter,
                metadata: ['break_type' => $validated['break_type']]
            );
        });

        return back()->with('success', "Counter {$counter->code} is now on break ({$validated['break_type']}). Terminal locked.");
    }

    public function resumeService(Request $request, Counter $counter): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'pin' => ['required', 'string'],
        ]);

        $isPinValid = (method_exists($user, 'verifyManagerPin') && $user->verifyManagerPin($validated['pin']))
            || Hash::check($validated['pin'], $user->password);

        if (! $isPinValid) {
            return back()->with('error', 'Invalid PIN or password. Terminal could not be unlocked.');
        }

        DB::transaction(function () use ($counter, $user) {
            $activeBreak = CounterBreakLog::query()
                ->where('counter_id', $counter->id)
                ->whereNull('ended_at')
                ->latest('started_at')
                ->first();

            if ($activeBreak) {
                $ended = now();
                $mins = max(1, $ended->diffInMinutes($activeBreak->started_at));
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

        // Trigger check for unassigned orders now that counter is back online
        app(CounterAssignmentService::class)->processUnassignedQueue($counter->tenant_id, $counter->branch_id);

        return back()->with('success', "Counter {$counter->code} service resumed. Welcome back!");
    }

    public function closeSession(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $canOverride = $tenantContext->hasRole(['admin', 'manager']) || ($user && $user->isSubscriberAdmin());

        $validated = $request->validate([
            'closing_cash_counted' => ['required', 'numeric', 'min:0'],
            'closing_denominations' => ['nullable', 'array'],
            'closing_denominations.*' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $closedSession = $this->shiftService->closeShift(
                counter: $counter,
                actor: $user,
                closingCashCounted: $validated['closing_cash_counted'],
                denominations: $validated['closing_denominations'] ?? null,
                notes: $validated['notes'] ?? null,
                canOverrideOwnership: $canOverride,
            );
        } catch (ValidationException $e) {
            $firstMessage = collect($e->errors())->flatten()->first() ?? 'Could not close shift.';

            return back()->with('error', $firstMessage);
        }

        if (! $closedSession) {
            return back()->with('success', "Counter {$counter->code} closed.");
        }

        $discrepancy = (float) $closedSession->discrepancy;
        $discrepancyMsg = $discrepancy == 0.0
            ? 'Cash matched 100%!'
            : ($discrepancy > 0 ? "Cash surplus of +{$closedSession->discrepancy}" : "Cash shortage of {$closedSession->discrepancy}");

        return back()
            ->with('success', "Shift closed on Counter {$counter->code}. Z-Report {$closedSession->z_report_number} generated: {$discrepancyMsg}")
            ->with('lastClosedSessionId', $closedSession->id);
    }

    /**
     * Admin / Branch Manager force-closes a forgotten open shift with mandatory reason.
     */
    public function forceCloseSession(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $canForceClose = $tenantContext->hasRole(['admin', 'manager']) || ($user && $user->isSubscriberAdmin());
        if (! $canForceClose) {
            abort(403, 'Unauthorized. Only Admins and Branch Managers can force-close shifts.');
        }

        $validated = $request->validate([
            'force_close_reason' => ['required', 'string', 'min:3', 'max:500'],
            'closing_cash_counted' => ['nullable', 'numeric', 'min:0'],
            'closing_denominations' => ['nullable', 'array'],
            'closing_denominations.*' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $closedSession = $this->shiftService->closeShift(
                counter: $counter,
                actor: $user,
                closingCashCounted: $validated['closing_cash_counted'] ?? null,
                denominations: $validated['closing_denominations'] ?? null,
                notes: $validated['notes'] ?? null,
                canOverrideOwnership: true,
                isForceClose: true,
                forceCloseReason: $validated['force_close_reason'],
            );
        } catch (ValidationException $e) {
            $firstMessage = collect($e->errors())->flatten()->first() ?? 'Could not force-close shift.';

            return back()->with('error', $firstMessage);
        }

        if (! $closedSession) {
            return back()->with('success', "Counter {$counter->code} closed.");
        }

        return back()
            ->with('success', "Shift force-closed on Counter {$counter->code}. Z-Report {$closedSession->z_report_number} generated.")
            ->with('lastClosedSessionId', $closedSession->id);
    }

    /**
     * Record Cash In / Cash Out / Safe Drop / Cash Refund against an active open shift.
     */
    public function recordCashMovement(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $canOverride = $tenantContext->hasRole(['admin', 'manager']) || ($user && $user->isSubscriberAdmin());

        $validated = $request->validate([
            'type' => ['required', Rule::in(CounterCashMovement::TYPES)],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['required', 'string', 'max:255'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $movement = $this->shiftService->recordCashMovement(
                counter: $counter,
                actor: $user,
                type: $validated['type'],
                amount: $validated['amount'],
                reason: $validated['reason'],
                referenceNumber: $validated['reference_number'] ?? null,
                notes: $validated['notes'] ?? null,
                canOverrideOwnership: $canOverride,
            );
        } catch (ValidationException $e) {
            $firstMessage = collect($e->errors())->flatten()->first() ?? 'Failed to record cash movement.';

            return back()->with('error', $firstMessage);
        }

        $label = match ($movement->type) {
            CounterCashMovement::TYPE_CASH_IN => 'Cash In',
            CounterCashMovement::TYPE_CASH_OUT => 'Cash Out',
            CounterCashMovement::TYPE_SAFE_DROP => 'Safe Drop',
            CounterCashMovement::TYPE_CASH_REFUND => 'Cash Refund',
            default => 'Cash Movement',
        };

        return back()->with('success', "{$label} of ৳{$movement->amount} recorded on Counter {$counter->code}.");
    }

    /**
     * Return immutable Z-Report (for closed shifts) or live X-Report (for open shifts).
     */
    public function zReport(Request $request, CounterSession $session, TenantContext $tenantContext): JsonResponse
    {
        $user = $request->user();
        $canViewAll = $tenantContext->hasRole(['admin', 'manager']) || ($user && $user->isSubscriberAdmin());

        if (! $canViewAll && (int) $session->user_id !== (int) $user->id) {
            abort(403, 'Unauthorized. You can only view Z-Reports for your own shift sessions.');
        }

        return response()->json($this->shiftService->getReportPayload($session));
    }

    public function destroy(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        // Delete counter only when no active transactions / sales exist
        $activeSalesCount = $counter->sales()->whereIn('order_status', ['assigned', 'waiting', 'processing'])->count();
        if ($activeSalesCount > 0) {
            return back()->with('error', "Cannot delete Counter {$counter->code} because it has {$activeSalesCount} active orders in its queue. Reassign or complete them first.");
        }

        if ($counter->status !== 'closed') {
            return back()->with('error', "Cannot delete Counter {$counter->code} while a cashier shift is active. Please close the active shift first.");
        }

        $code = $counter->code;
        $name = $counter->name;
        $counter->delete();

        AuditLog::record(
            action: 'counter.deleted',
            description: "Deleted counter {$code} ({$name}).",
            metadata: ['code' => $code, 'name' => $name]
        );

        return back()->with('success', "Counter {$code} ({$name}) deleted successfully.");
    }

    public function destroySession(Request $request, CounterSession $session, TenantContext $tenantContext): RedirectResponse
    {
        if ($session->status === 'open') {
            return back()->with('error', 'Cannot delete an active open shift session. Close it first.');
        }

        $id = $session->id;
        $counterCode = $session->counter?->code ?? 'Unknown';
        $session->delete();

        AuditLog::record(
            action: 'counter_session.deleted',
            description: "Deleted shift record #{$id} for counter {$counterCode}.",
            metadata: ['session_id' => $id]
        );

        return back()->with('success', "Shift session record #{$id} deleted successfully.");
    }

    /**
     * Counter Monitoring & Branch-wise Live Queue Overview
     */
    public function monitoring(Request $request, TenantContext $tenantContext): Response
    {
        $tenant = $tenantContext->tenant();
        $user = $request->user();
        $now = now();

        $canViewAllBranches = $tenantContext->isOwner()
            || $tenantContext->hasRole('admin')
            || (bool) $user?->isSubscriberAdmin();

        $period = strtolower((string) $request->query('period', 'today'));
        if (! in_array($period, ['today', 'yesterday', '7d', 'month'], true)) {
            $period = 'today';
        }

        [$rangeStart, $rangeEnd, $prevStart, $prevEnd, $comparisonLabel] = match ($period) {
            'yesterday' => [
                now()->subDay()->startOfDay(),
                now()->subDay()->endOfDay(),
                now()->subDays(2)->startOfDay(),
                now()->subDays(2)->endOfDay(),
                'vs prev day',
            ],
            '7d' => [
                now()->subDays(6)->startOfDay(),
                $now,
                now()->subDays(13)->startOfDay(),
                now()->subDays(7)->endOfDay(),
                'vs prev 7d',
            ],
            'month' => [
                now()->startOfMonth(),
                $now,
                now()->subMonthNoOverflow()->startOfMonth(),
                now()->subMonthNoOverflow()->endOfMonth(),
                'vs last month',
            ],
            default => [
                now()->startOfDay(),
                $now,
                now()->subDay()->startOfDay(),
                now()->subDay()->endOfDay(),
                'vs yesterday',
            ],
        };

        $allBranches = \App\Models\Branch::query()
            ->where('is_active', true)
            ->orderByDesc('is_head_office')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'is_head_office']);

        $requestedBranch = $request->query('branch_id');
        if ($canViewAllBranches) {
            if ($requestedBranch === null || $requestedBranch === '' || $requestedBranch === 'all') {
                $selectedBranch = null;
                $selectedBranchId = 'all';
            } else {
                $selectedBranch = $allBranches->firstWhere('id', (int) $requestedBranch);
                $selectedBranchId = $selectedBranch ? $selectedBranch->id : 'all';
            }
        } else {
            $selectedBranch = $tenantContext->branch() ?? $allBranches->first();
            $selectedBranchId = $selectedBranch?->id ?? 'all';
        }

        // Build 100% dynamic All-Branches Executive Overview
        $allBranchesOverview = null;
        if ($canViewAllBranches) {
            $allCounters = Counter::query()
                ->where('is_active', true)
                ->with(['currentUser:id,name', 'currentSession:id,counter_id,status,opened_at'])
                ->orderBy('code')
                ->get();

            // Completed sales grouped by branch in current & previous period
            $completedStatuses = ['completed', 'paid', 'partially_paid'];
            $salesInPeriod = Sale::query()
                ->whereNotNull('sold_at')
                ->whereBetween('sold_at', [$rangeStart, $rangeEnd])
                ->where(fn ($q) => $q->whereNull('order_status')->orWhereIn('order_status', $completedStatuses))
                ->selectRaw('branch_id, COUNT(*) as bills_count, COALESCE(SUM(total_amount), 0) as sales_total')
                ->groupBy('branch_id')
                ->get()
                ->keyBy('branch_id');

            $prevSalesTotal = (float) Sale::query()
                ->whereNotNull('sold_at')
                ->whereBetween('sold_at', [$prevStart, $prevEnd])
                ->where(fn ($q) => $q->whereNull('order_status')->orWhereIn('order_status', $completedStatuses))
                ->sum('total_amount');

            // Active queue orders across all branches
            $queueOrders = Sale::query()
                ->whereIn('order_status', ['unassigned', 'assigned', 'waiting', 'processing'])
                ->get(['id', 'branch_id', 'counter_id', 'order_status', 'assigned_at', 'created_at']);

            // Cash differences (discrepancies) from CounterSessions in period
            $discrepancySessions = CounterSession::query()
                ->with('counter:id,code,name')
                ->where(function ($q) use ($rangeStart, $rangeEnd) {
                    $q->whereBetween('closed_at', [$rangeStart, $rangeEnd])
                        ->orWhereBetween('opened_at', [$rangeStart, $rangeEnd]);
                })
                ->whereNotNull('discrepancy')
                ->where('discrepancy', '!=', 0)
                ->latest('closed_at')
                ->get();

            // High discount bills in period (discount_percentage >= 5% or pending approval)
            $highDiscountByCounter = Sale::query()
                ->with('counter:id,code,name')
                ->whereBetween('created_at', [$rangeStart, $rangeEnd])
                ->where('order_status', '!=', 'cancelled')
                ->where(function ($q) {
                    $q->where('discount_percentage', '>=', 5)
                        ->orWhere('discount_status', 'pending_approval');
                })
                ->selectRaw('branch_id, counter_id, COUNT(*) as bills_count, MAX(discount_percentage) as max_pct')
                ->groupBy('branch_id', 'counter_id')
                ->get();

            // Rx medicines sold without doctor_name in period
            $rxWithoutDoctorByBranch = \Illuminate\Support\Facades\DB::table('sales')
                ->join('sale_items', 'sale_items.sale_id', '=', 'sales.id')
                ->join('medicines', 'medicines.id', '=', 'sale_items.medicine_id')
                ->where('sales.tenant_id', $tenant->id)
                ->whereNotNull('sales.sold_at')
                ->whereBetween('sales.sold_at', [$rangeStart, $rangeEnd])
                ->where(function ($q) {
                    $q->whereNull('sales.doctor_name')->orWhere('sales.doctor_name', '');
                })
                ->where('medicines.requires_prescription', true)
                ->selectRaw('sales.branch_id, COUNT(DISTINCT sales.id) as rx_bills_count')
                ->groupBy('sales.branch_id')
                ->pluck('rx_bills_count', 'branch_id');

            $alerts = [];
            $branchRows = [];
            $openBranchesCount = 0;
            $totalOpenCounters = 0;
            $totalBreakCounters = 0;
            $totalClosedCounters = 0;
            $totalSales = 0.0;
            $totalBills = 0;
            $totalCashDiff = 0.0;
            $cashDiffBranchIds = [];

            foreach ($allBranches as $b) {
                $bCounters = $allCounters->where('branch_id', $b->id)->values();
                $bTotalCounters = $bCounters->count();
                $bOpenCounters = $bCounters->where('status', 'active')->count();
                $bBreakCounters = $bCounters->where('status', 'on_break')->count();
                $bClosedCounters = max(0, $bTotalCounters - $bOpenCounters - $bBreakCounters);

                if ($bOpenCounters > 0) {
                    $openBranchesCount++;
                }

                $totalOpenCounters += $bOpenCounters;
                $totalBreakCounters += $bBreakCounters;
                $totalClosedCounters += $bClosedCounters;

                $saleAgg = $salesInPeriod->get($b->id);
                $bSales = (float) ($saleAgg->sales_total ?? 0);
                $bBills = (int) ($saleAgg->bills_count ?? 0);
                $totalSales += $bSales;
                $totalBills += $bBills;

                $bQueueOrders = $queueOrders->where('branch_id', $b->id);
                $bQueueCount = $bQueueOrders->count();
                $bDelayedCount = $bQueueOrders->filter(function ($o) use ($now) {
                    $since = $o->assigned_at ?? $o->created_at ?? $now;

                    return floor($since->diffInSeconds($now, false) / 60) >= 5;
                })->count();

                $bDiscrepancies = $discrepancySessions->where('branch_id', $b->id);
                $bCashDiff = (float) $bDiscrepancies->sum('discrepancy');
                if (abs($bCashDiff) >= 0.01) {
                    $totalCashDiff += $bCashDiff;
                    $cashDiffBranchIds[$b->id] = true;
                }

                // Dynamic Alerts per branch
                foreach ($bDiscrepancies as $ds) {
                    $diffVal = (float) $ds->discrepancy;
                    $absDiff = number_format(abs($diffVal), 0);
                    $dirWord = $diffVal < 0 ? 'short' : 'over';
                    $cLabel = $ds->counter?->name ?? $ds->counter?->code ?? 'Counter';
                    $endedLabel = $ds->closed_at ? 'Shift ended '.$ds->closed_at->format('g:i A') : 'Active shift';
                    $alerts[] = [
                        'id' => 'cash-'.$ds->id,
                        'type' => 'cash_diff',
                        'severity' => abs($diffVal) >= 100 ? 'high' : 'medium',
                        'branch_id' => $b->id,
                        'branch_name' => $b->name,
                        'title' => "{$b->name} drawer {$dirWord} by ৳{$absDiff}",
                        'subtitle' => "{$cLabel}, {$endedLabel}",
                    ];
                }

                foreach ($highDiscountByCounter->where('branch_id', $b->id) as $hd) {
                    $cModel = $bCounters->firstWhere('id', $hd->counter_id);
                    $cLabel = $cModel?->name ?? $cModel?->code ?? 'Sales Order';
                    $cnt = (int) $hd->bills_count;
                    $alerts[] = [
                        'id' => "disc-{$b->id}-{$hd->counter_id}",
                        'type' => 'discount',
                        'severity' => $cnt >= 3 ? 'high' : 'medium',
                        'branch_id' => $b->id,
                        'branch_name' => $b->name,
                        'title' => "{$b->name}: high discounts at {$cLabel}",
                        'subtitle' => "{$cnt} bill".($cnt > 1 ? 's' : '').' (up to '.round((float) $hd->max_pct, 1).'%)',
                    ];
                }

                if ($bQueueCount >= 3 && ($bClosedCounters + $bBreakCounters) > 0) {
                    $closedCounter = $bCounters->first(fn ($c) => $c->status !== 'active');
                    $closedHint = $closedCounter
                        ? 'Open '.$closedCounter->name
                        : ($bClosedCounters + $bBreakCounters).' counter offline';
                    $alerts[] = [
                        'id' => 'queue-'.$b->id,
                        'type' => 'queue',
                        'severity' => $bDelayedCount > 0 || $bQueueCount >= 5 ? 'high' : 'medium',
                        'branch_id' => $b->id,
                        'branch_name' => $b->name,
                        'title' => "{$b->name} queue has {$bQueueCount} orders, ".($bClosedCounters + $bBreakCounters).' counter closed',
                        'subtitle' => $closedHint,
                    ];
                } elseif ($bDelayedCount > 0) {
                    $alerts[] = [
                        'id' => 'delay-'.$b->id,
                        'type' => 'queue',
                        'severity' => 'high',
                        'branch_id' => $b->id,
                        'branch_name' => $b->name,
                        'title' => "{$bDelayedCount} order".($bDelayedCount > 1 ? 's' : '')." waiting >5m at {$b->name}",
                        'subtitle' => 'Reassign to an available counter',
                    ];
                }

                $rxCount = (int) ($rxWithoutDoctorByBranch[$b->id] ?? 0);
                if ($rxCount > 0) {
                    $alerts[] = [
                        'id' => 'rx-'.$b->id,
                        'type' => 'rx',
                        'severity' => 'medium',
                        'branch_id' => $b->id,
                        'branch_name' => $b->name,
                        'title' => "{$rxCount} Rx bill".($rxCount > 1 ? 's' : '').' sold without a doctor note',
                        'subtitle' => $b->name,
                    ];
                }

                // Determine Branch Status Pill ('normal' | 'long_queue' | 'check')
                if ($bCashDiff < -0.01 || $bDelayedCount > 0 || ($bQueueCount > 0 && $bOpenCounters === 0)) {
                    $statusKey = 'check';
                    $statusLabel = 'Check';
                } elseif ($bQueueCount >= 4) {
                    $statusKey = 'long_queue';
                    $statusLabel = 'Long queue';
                } else {
                    $statusKey = 'normal';
                    $statusLabel = 'Normal';
                }

                $branchRows[] = [
                    'id' => $b->id,
                    'code' => $b->code,
                    'name' => $b->name,
                    'counters_open' => $bOpenCounters,
                    'counters_total' => $bTotalCounters,
                    'sales' => round($bSales, 2),
                    'bills' => $bBills,
                    'queue' => $bQueueCount,
                    'cash_diff' => round($bCashDiff, 2),
                    'status' => $statusKey,
                    'status_label' => $statusLabel,
                ];
            }

            // Sort alerts so 'high' severity comes first
            usort($alerts, fn ($a, $b) => ($a['severity'] === 'high' ? 0 : 1) <=> ($b['severity'] === 'high' ? 0 : 1));
            $actionNeededCount = collect($alerts)->where('severity', 'high')->count();

            // Sales comparison %
            if ($prevSalesTotal > 0) {
                $pctDiff = round((($totalSales - $prevSalesTotal) / $prevSalesTotal) * 100);
                $sign = $pctDiff > 0 ? '+' : '';
                $salesSubtitle = "{$sign}{$pctDiff}% {$comparisonLabel}";
                $salesTrend = $pctDiff > 0 ? 'up' : ($pctDiff < 0 ? 'down' : 'flat');
            } else {
                $salesSubtitle = $totalSales > 0 ? "New sales {$comparisonLabel}" : "No sales {$comparisonLabel}";
                $salesTrend = 'flat';
            }

            $maxBranchSales = max(1.0, (float) (collect($branchRows)->max('sales') ?: 1));
            $salesByBranch = collect($branchRows)
                ->sortByDesc('sales')
                ->values()
                ->map(fn ($r) => [
                    'id' => $r['id'],
                    'name' => $r['name'],
                    'sales' => $r['sales'],
                    'status' => $r['status'],
                    'percent' => $r['sales'] > 0 ? max(6, (int) round(($r['sales'] / $maxBranchSales) * 100)) : 0,
                ])
                ->all();

            $totalBranchesCount = $allBranches->count();
            $totalCountersCount = $allCounters->count();
            $offlineCounters = $totalBreakCounters + $totalClosedCounters;

            $allBranchesOverview = [
                'period_label' => match ($period) {
                    'yesterday' => "Yesterday's sales",
                    '7d' => '7-day sales',
                    'month' => "This month's sales",
                    default => "Today's sales",
                },
                'kpis' => [
                    'branches_open' => $openBranchesCount,
                    'branches_total' => $totalBranchesCount,
                    'branches_subtitle' => $totalBranchesCount > 0 && $openBranchesCount === $totalBranchesCount
                        ? 'All online'
                        : ($totalBranchesCount - $openBranchesCount).' with no open counter',
                    'counters_open' => $totalOpenCounters,
                    'counters_total' => $totalCountersCount,
                    'counters_subtitle' => $offlineCounters === 0
                        ? 'All open'
                        : ($totalBreakCounters > 0
                            ? "{$totalBreakCounters} on break · {$totalClosedCounters} closed"
                            : "{$totalClosedCounters} closed"),
                    'sales_total' => round($totalSales, 2),
                    'sales_subtitle' => $salesSubtitle,
                    'sales_trend' => $salesTrend,
                    'bills_count' => $totalBills,
                    'bills_avg' => $totalBills > 0 ? round($totalSales / $totalBills) : 0,
                    'cash_diff' => round($totalCashDiff, 2),
                    'cash_diff_branches' => count($cashDiffBranchIds),
                    'alerts_total' => count($alerts),
                    'alerts_action_needed' => $actionNeededCount,
                ],
                'branch_rows' => $branchRows,
                'sales_by_branch' => $salesByBranch,
                'alerts' => $alerts,
            ];
        }

        // Single-branch Counter & Queue detail (for drilldown or branch manager)
        $targetBranch = $selectedBranch ?? $tenantContext->branch();
        $counters = collect();
        $unassignedOrders = collect();

        if ($selectedBranchId !== 'all' && $targetBranch) {
            $counters = Counter::query()
                ->where('branch_id', $targetBranch->id)
                ->where('is_active', true)
                ->orderBy('code')
                ->with([
                    'currentUser:id,name',
                    'currentSession:id,counter_id,user_id,status,shift,opened_at,total_sales_amount,total_transactions',
                    'activeQueue' => fn ($q) => $q
                        ->with(['salesman:id,name', 'customer:id,name'])
                        ->withCount('items')
                        ->orderByRaw("CASE WHEN order_status = 'processing' THEN 0 ELSE 1 END")
                        ->orderBy('assigned_at')
                        ->orderBy('id'),
                ])
                ->get()
                ->map(function (Counter $c) use ($now) {
                    $mappedOrders = $c->activeQueue->map(function (Sale $s) use ($now, $c) {
                        $since = $s->assigned_at ?? $s->created_at ?? $now;
                        $waitMins = (int) max(0, floor($since->diffInSeconds($now, false) / 60));

                        return [
                            'id' => $s->id,
                            'order_number' => $s->order_number,
                            'customer_name' => $s->customer?->name ?? 'Walk-in Customer',
                            'salesman_name' => $s->salesman?->name,
                            'total_amount' => (float) $s->total_amount,
                            'order_status' => $s->order_status,
                            'assigned_at' => $since->format('h:i A'),
                            'waiting_minutes' => $waitMins,
                            'is_delayed' => $waitMins >= 5,
                            'requires_verification' => (bool) $s->requires_verification,
                            'verification_status' => $s->verification_status,
                            'items_count' => (int) ($s->items_count ?? 0),
                            'counter_id' => $c->id,
                            'counter_code' => $c->code,
                            'counter_name' => $c->name,
                        ];
                    })->values();

                    return [
                        'id' => $c->id,
                        'code' => $c->code,
                        'name' => $c->name,
                        'type' => $c->type,
                        'zone' => $c->zone,
                        'location' => $c->location,
                        'status' => $c->status,
                        'break_reason' => $c->current_break_reason,
                        'max_queue_capacity' => (int) ($c->max_queue_capacity ?: 20),
                        'auto_assignment_enabled' => (bool) $c->auto_assignment_enabled,
                        'current_cashier' => $c->currentUser?->name,
                        'current_shift' => $c->currentSession?->shift,
                        'shift_opened_at' => $c->currentSession?->opened_at?->format('h:i A'),
                        'completed_bills' => (int) ($c->currentSession?->total_transactions ?? 0),
                        'shift_sales' => (float) ($c->currentSession?->total_sales_amount ?? 0),
                        'queue_count' => $mappedOrders->count(),
                        'delayed_count' => $mappedOrders->where('is_delayed', true)->count(),
                        'max_wait_minutes' => (int) ($mappedOrders->max('waiting_minutes') ?? 0),
                        'active_orders' => $mappedOrders,
                    ];
                });

            $unassignedOrders = Sale::query()
                ->where('branch_id', $targetBranch->id)
                ->where('order_status', 'unassigned')
                ->with(['salesman:id,name', 'customer:id,name'])
                ->withCount('items')
                ->oldest()
                ->get()
                ->map(function (Sale $s) use ($now) {
                    $since = $s->created_at ?? $now;
                    $waitMins = (int) max(0, floor($since->diffInSeconds($now, false) / 60));

                    return [
                        'id' => $s->id,
                        'order_number' => $s->order_number,
                        'customer_name' => $s->customer?->name ?? 'Walk-in Customer',
                        'salesman_name' => $s->salesman?->name,
                        'total_amount' => (float) $s->total_amount,
                        'created_at' => $since->format('h:i A'),
                        'waiting_minutes' => $waitMins,
                        'is_delayed' => $waitMins >= 5,
                        'items_count' => (int) ($s->items_count ?? 0),
                    ];
                });
        }

        return Inertia::render('Counters/Monitoring', [
            'canViewAllBranches' => $canViewAllBranches,
            'selectedBranchId' => $selectedBranchId,
            'period' => $period,
            'branchesList' => $allBranches->map(fn ($b) => [
                'id' => $b->id,
                'code' => $b->code,
                'name' => $b->name,
            ])->values(),
            'allBranchesOverview' => $allBranchesOverview,
            'counters' => $counters,
            'unassignedOrders' => $unassignedOrders,
            'branchName' => $targetBranch?->name,
            'currency' => $tenant->currency_code ?? 'BDT',
            'syncedAt' => $now->format('h:i:s A'),
        ]);
    }

    /**
     * Branch Manager manual order reassignment.
     */
    public function reassign(Request $request, Sale $sale, CounterAssignmentService $assignmentService): RedirectResponse
    {
        $validated = $request->validate([
            'counter_id' => ['required', Rule::exists('counters', 'id')],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $assignmentService->reassignOrder(
            sale: $sale,
            newCounterId: (int) $validated['counter_id'],
            manager: $request->user(),
            reason: $validated['reason']
        );

        return back()->with('success', "Order #{$sale->order_number} reassigned successfully.");
    }

    /**
     * Retry assigning all unassigned orders.
     */
    public function retryUnassigned(TenantContext $tenantContext, CounterAssignmentService $assignmentService): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $branch = $tenantContext->branch();

        if (! $tenant || ! $branch) {
            return back()->with('error', 'Select branch first.');
        }

        $assignedCount = $assignmentService->processUnassignedQueue($tenant->id, $branch->id);

        if ($assignedCount > 0) {
            return back()->with('success', "Successfully assigned {$assignedCount} order(s) to available counters.");
        }

        return back()->with('error', 'All counters are currently offline, on break, or at maximum queue capacity.');
    }

    private function generateCounterCode(int $tenantId, int $branchId): string
    {
        $count = Counter::query()
            ->where('tenant_id', $tenantId)
            ->where('branch_id', $branchId)
            ->count();

        return 'C-'.str_pad((string) ($count + 1), 2, '0', STR_PAD_LEFT);
    }
}
