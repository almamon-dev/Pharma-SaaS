<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Counter;
use App\Models\CounterBreakLog;
use App\Models\CounterCashier;
use App\Models\CounterSession;
use App\Models\Sale;
use App\Models\User;
use App\Services\CounterAssignmentService;
use App\Support\TenantContext;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CounterController extends Controller
{
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
                'current_session' => $c->currentSession ? [
                    'id' => $c->currentSession->id,
                    'user_id' => $c->currentSession->user_id,
                    'user_name' => $c->currentSession->user?->name,
                    'shift' => $c->currentSession->shift ?? 'morning',
                    'opened_at' => $c->currentSession->opened_at?->toISOString(),
                    'opening_float' => (float) $c->currentSession->opening_float,
                    'total_sales_amount' => (float) $c->currentSession->total_sales_amount,
                    'total_transactions' => (int) $c->currentSession->total_transactions,
                    'system_expected_cash' => (float) $c->currentSession->system_expected_cash,
                ] : null,
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
                'counter_code' => $s->counter?->code,
                'counter_name' => $s->counter?->name,
                'user_name' => $s->user?->name,
                'status' => $s->status,
                'shift' => $s->shift ?? 'morning',
                'opened_at' => $s->opened_at?->format('d M Y, h:i A'),
                'closed_at' => $s->closed_at?->format('d M Y, h:i A'),
                'opening_float' => (float) $s->opening_float,
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

        // Branch-wide unassigned orders count
        $unassignedOrdersCount = Sale::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->where('order_status', 'unassigned')
            ->count();

        return Inertia::render('Counters/Index', [
            'counters' => $counters,
            'recentSessions' => $recentSessions,
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

        // Check if cashier already has an active session on another counter
        $otherActiveSession = CounterSession::query()
            ->where('user_id', $user->id)
            ->where('status', 'open')
            ->where('counter_id', '!=', $counter->id)
            ->first();

        if ($otherActiveSession) {
            $otherCounter = $otherActiveSession->counter;

            return back()->with('error', "You already have an active open shift on Counter {$otherCounter?->code}. Please close that shift first.");
        }

        if ($counter->status === 'active' && $counter->current_user_id && $counter->current_user_id !== $user->id) {
            return back()->with('error', "Counter {$counter->code} is currently occupied by another cashier.");
        }

        $validated = $request->validate([
            'opening_float' => ['required', 'numeric', 'min:0'],
            'shift' => ['nullable', Rule::in(['morning', 'evening', 'night'])],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        DB::transaction(function () use ($counter, $user, $branch, $tenant, $validated) {
            $existingSession = CounterSession::query()
                ->where('counter_id', $counter->id)
                ->where('status', 'open')
                ->first();

            if (! $existingSession) {
                CounterSession::query()->create([
                    'tenant_id' => $tenant->id,
                    'branch_id' => $branch->id,
                    'counter_id' => $counter->id,
                    'user_id' => $user->id,
                    'status' => 'open',
                    'shift' => $validated['shift'] ?? 'morning',
                    'opened_at' => now(),
                    'opening_float' => $validated['opening_float'],
                    'system_expected_cash' => $validated['opening_float'],
                    'total_sales_amount' => 0,
                    'total_transactions' => 0,
                    'notes' => $validated['notes'] ?? null,
                ]);
            }

            $counter->update([
                'status' => 'active',
                'current_user_id' => $user->id,
                'current_break_reason' => null,
                'break_started_at' => null,
            ]);

            AuditLog::record(
                action: 'counter.shift_opened',
                description: "Cashier {$user->name} opened shift on Counter {$counter->code} with opening float {$validated['opening_float']}.",
                subject: $counter,
                metadata: [
                    'counter_id' => $counter->id,
                    'opening_float' => $validated['opening_float'],
                    'shift' => $validated['shift'] ?? 'morning',
                ]
            );
        });

        // Try dynamically assigning any pending unassigned orders to this newly opened counter!
        app(CounterAssignmentService::class)->processUnassignedQueue($tenant->id, $branch->id);

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

    public function closeSession(Request $request, Counter $counter): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'closing_cash_counted' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $session = $counter->currentSession;
        if (! $session) {
            $counter->update([
                'status' => 'closed',
                'current_user_id' => null,
                'current_break_reason' => null,
                'break_started_at' => null,
            ]);

            return back()->with('success', "Counter {$counter->code} closed.");
        }

        $counted = round((float) $validated['closing_cash_counted'], 2);
        $expected = round((float) $session->system_expected_cash, 2);
        $discrepancy = round($counted - $expected, 2);

        DB::transaction(function () use ($counter, $session, $user, $counted, $expected, $discrepancy, $validated) {
            $openBreaks = CounterBreakLog::query()
                ->where('counter_session_id', $session->id)
                ->whereNull('ended_at')
                ->get();

            foreach ($openBreaks as $ob) {
                $now = now();
                $mins = max(1, $now->diffInMinutes($ob->started_at));
                $ob->update([
                    'ended_at' => $now,
                    'duration_minutes' => $mins,
                ]);
            }

            $session->update([
                'status' => 'closed',
                'closed_at' => now(),
                'closing_cash_counted' => $counted,
                'discrepancy' => $discrepancy,
                'notes' => $validated['notes'] ?? null,
            ]);

            $counter->update([
                'status' => 'closed',
                'current_user_id' => null,
                'current_break_reason' => null,
                'break_started_at' => null,
            ]);

            AuditLog::record(
                action: 'counter.shift_closed',
                description: "Cashier {$user->name} closed shift on Counter {$counter->code}. Expected Cash: {$expected}, Counted: {$counted}, Discrepancy: {$discrepancy}.",
                subject: $session,
                metadata: [
                    'counter_id' => $counter->id,
                    'opening_float' => (float) $session->opening_float,
                    'system_expected_cash' => $expected,
                    'closing_cash_counted' => $counted,
                    'discrepancy' => $discrepancy,
                    'total_sales' => (float) $session->total_sales_amount,
                    'total_transactions' => (int) $session->total_transactions,
                ]
            );
        });

        $discrepancyMsg = $discrepancy == 0
            ? 'Cash matched 100%!'
            : ($discrepancy > 0 ? "Cash surplus of +{$discrepancy}" : "Cash shortage of {$discrepancy}");

        return back()->with('success', "Shift closed on Counter {$counter->code}. Z-Report generated: {$discrepancyMsg}");
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
        $branch = $tenantContext->branch();
        $tenant = $tenantContext->tenant();

        $counters = Counter::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->where('is_active', true)
            ->with([
                'currentUser:id,name',
                'currentSession:id,counter_id,user_id,status,shift,opened_at,total_sales_amount,total_transactions',
                'activeQueue' => fn ($q) => $q->with(['salesman:id,name', 'customer:id,name'])->latest('assigned_at'),
            ])
            ->get()
            ->map(fn (Counter $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name,
                'type' => $c->type,
                'location' => $c->location,
                'status' => $c->status,
                'max_queue_capacity' => (int) ($c->max_queue_capacity ?: 20),
                'auto_assignment_enabled' => (bool) $c->auto_assignment_enabled,
                'current_cashier' => $c->currentUser?->name,
                'current_shift' => $c->currentSession?->shift,
                'queue_count' => $c->activeQueue->count(),
                'active_orders' => $c->activeQueue->map(fn (Sale $s) => [
                    'id' => $s->id,
                    'order_number' => $s->order_number,
                    'customer_name' => $s->customer?->name ?? 'Walk-in Customer',
                    'salesman_name' => $s->salesman?->name,
                    'total_amount' => (float) $s->total_amount,
                    'order_status' => $s->order_status,
                    'assigned_at' => $s->assigned_at?->format('h:i A'),
                    'items_count' => $s->items()->count(),
                ]),
            ]);

        $unassignedOrders = Sale::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->where('order_status', 'unassigned')
            ->with(['salesman:id,name', 'customer:id,name'])
            ->latest()
            ->get()
            ->map(fn (Sale $s) => [
                'id' => $s->id,
                'order_number' => $s->order_number,
                'customer_name' => $s->customer?->name ?? 'Walk-in Customer',
                'salesman_name' => $s->salesman?->name,
                'total_amount' => (float) $s->total_amount,
                'created_at' => $s->created_at?->format('h:i A'),
                'items_count' => $s->items()->count(),
            ]);

        return Inertia::render('Counters/Monitoring', [
            'counters' => $counters,
            'unassignedOrders' => $unassignedOrders,
            'branchName' => $branch?->name,
            'currency' => $tenant->currency_code ?? 'BDT',
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
