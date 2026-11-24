<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Counter;
use App\Models\CounterBreakLog;
use App\Models\CounterSession;
use App\Support\TenantContext;
use Carbon\Carbon;
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

        $counters = Counter::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->with([
                'currentUser:id,name,email',
                'currentSession' => fn ($q) => $q->with('user:id,name'),
            ])
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
                'printer_ip' => $c->printer_ip,
                'terminal_device_id' => $c->terminal_device_id,
                'is_active' => $c->is_active,
                'current_user' => $c->currentUser ? [
                    'id' => $c->currentUser->id,
                    'name' => $c->currentUser->name,
                ] : null,
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

        $recentSessions = CounterSession::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->with(['counter:id,code,name', 'user:id,name'])
            ->latest('opened_at')
            ->limit(20)
            ->get()
            ->map(fn (CounterSession $s) => [
                'id' => $s->id,
                'counter_code' => $s->counter?->code,
                'counter_name' => $s->counter?->name,
                'user_name' => $s->user?->name,
                'status' => $s->status,
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

        return Inertia::render('Counters/Index', [
            'counters' => $counters,
            'recentSessions' => $recentSessions,
            'branchName' => $branch?->name,
            'currency' => $tenant->currency_code ?? 'BDT',
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
                'required',
                'string',
                'max:20',
                Rule::unique('counters')->where(fn ($query) => $query
                    ->where('tenant_id', $tenant->id)
                    ->where('branch_id', $branch->id)
                ),
            ],
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', 'string', Rule::in(['opd', 'ipd', 'express', 'general', 'billing', 'emergency'])],
            'zone' => ['nullable', 'string', 'max:100'],
            'printer_ip' => ['nullable', 'string', 'max:50'],
            'terminal_device_id' => ['nullable', 'string', 'max:100'],
        ]);

        $counter = Counter::query()->create([
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'code' => strtoupper(trim($validated['code'])),
            'name' => trim($validated['name']),
            'type' => $validated['type'],
            'zone' => ! empty($validated['zone']) ? trim($validated['zone']) : null,
            'status' => 'closed',
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
            'type' => ['required', 'string', Rule::in(['opd', 'ipd', 'express', 'general', 'billing', 'emergency'])],
            'zone' => ['nullable', 'string', 'max:100'],
            'printer_ip' => ['nullable', 'string', 'max:50'],
            'terminal_device_id' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $counter->update([
            'code' => strtoupper(trim($validated['code'])),
            'name' => trim($validated['name']),
            'type' => $validated['type'],
            'zone' => ! empty($validated['zone']) ? trim($validated['zone']) : null,
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

    public function openSession(Request $request, Counter $counter, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $branch = $tenantContext->branch();
        $tenant = $tenantContext->tenant();

        if ($counter->status === 'active' && $counter->current_user_id && $counter->current_user_id !== $user->id) {
            return back()->with('error', "Counter {$counter->code} is currently occupied by another cashier.");
        }

        $validated = $request->validate([
            'opening_float' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        DB::transaction(function () use ($counter, $user, $branch, $tenant, $validated) {
            // If there's an existing open session for this counter by this user, reuse or close it
            $existingSession = CounterSession::query()
                ->where('counter_id', $counter->id)
                ->where('status', 'open')
                ->first();

            if (! $existingSession) {
                $session = CounterSession::query()->create([
                    'tenant_id' => $tenant->id,
                    'branch_id' => $branch->id,
                    'counter_id' => $counter->id,
                    'user_id' => $user->id,
                    'status' => 'open',
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
                ]
            );
        });

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

        $isPinValid = $user->verifyManagerPin($validated['pin']) || Hash::check($validated['pin'], $user->password);

        if (! $isPinValid) {
            // Also check if user is manager or supervisor trying to unlock
            return back()->with('error', 'Invalid PIN or password. Terminal could not be unlocked.');
        }

        DB::transaction(function () use ($counter, $user) {
            // Close active break log
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
            // Mark counter closed anyway
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
            // Close any open break logs
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
}
