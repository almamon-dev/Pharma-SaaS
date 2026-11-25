<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Counter;
use App\Models\CounterBreakLog;
use App\Models\CounterCashier;
use App\Models\CounterCashMovement;
use App\Models\CounterSession;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Core\Models\DocumentSequence;
use App\Support\MoneyMath;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CashCounterShiftService
{
    public function __construct(
        private readonly CounterAssignmentService $assignmentService
    ) {}

    /**
     * Open a shift on a specific counter with strict concurrency & single-shift rules.
     */
    public function openShift(
        Tenant $tenant,
        Branch $branch,
        Counter $counter,
        User $cashier,
        string|int|float $openingFloat = 0,
        ?string $shift = null,
        ?string $notes = null,
        bool $autoSeated = false,
        ?array $openingDenominations = null
    ): CounterSession {
        $normalizedOpeningDenoms = null;
        if (! empty($openingDenominations)) {
            $denomResult = MoneyMath::sumDenominations($openingDenominations);
            $normalizedOpeningDenoms = $denomResult['normalized'];
            if (MoneyMath::toPaisa($openingFloat) === 0 && $denomResult['total_paisa'] > 0) {
                $openingFloat = MoneyMath::fromPaisa($denomResult['total_paisa']);
            }
        }

        $openingFloatPaisa = MoneyMath::toPaisa($openingFloat);
        if ($openingFloatPaisa < 0) {
            throw ValidationException::withMessages([
                'opening_float' => ['Opening cash float cannot be negative.'],
            ]);
        }

        $resolvedShift = $shift ?: $this->detectCurrentShift();

        $session = DB::transaction(function () use (
            $tenant,
            $branch,
            $counter,
            $cashier,
            $openingFloatPaisa,
            $normalizedOpeningDenoms,
            $resolvedShift,
            $notes,
            $autoSeated
        ): CounterSession {
            $lockedCounter = Counter::query()
                ->where('id', $counter->id)
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedCounter->is_active) {
                throw ValidationException::withMessages([
                    'counter' => ["Counter {$lockedCounter->code} is inactive and cannot open a shift."],
                ]);
            }

            // Rule 1: One open shift per cashier
            $existingUserSession = CounterSession::query()
                ->where('tenant_id', $tenant->id)
                ->where('user_id', $cashier->id)
                ->where('status', 'open')
                ->lockForUpdate()
                ->first();

            if ($existingUserSession && (int) $existingUserSession->counter_id !== (int) $lockedCounter->id) {
                $otherCounter = $existingUserSession->counter;

                throw ValidationException::withMessages([
                    'counter' => ["You already have an active open shift on Counter {$otherCounter?->code}. Please close that shift first."],
                ]);
            }

            // Rule 2: One active cashier per counter
            $existingCounterSession = CounterSession::query()
                ->where('tenant_id', $tenant->id)
                ->where('counter_id', $lockedCounter->id)
                ->where('status', 'open')
                ->lockForUpdate()
                ->first();

            if ($existingCounterSession && (int) $existingCounterSession->user_id !== (int) $cashier->id) {
                $occupant = $existingCounterSession->user?->name ?? 'another cashier';

                throw ValidationException::withMessages([
                    'counter' => ["Counter {$lockedCounter->code} is currently occupied by {$occupant}."],
                ]);
            }

            if ($lockedCounter->status === 'active' && $lockedCounter->current_user_id && (int) $lockedCounter->current_user_id !== (int) $cashier->id) {
                throw ValidationException::withMessages([
                    'counter' => ["Counter {$lockedCounter->code} is currently occupied by another cashier."],
                ]);
            }

            $openingFloatDecimal = MoneyMath::fromPaisa($openingFloatPaisa);

            if ($existingCounterSession) {
                $session = $existingCounterSession;
            } else {
                $session = CounterSession::query()->create([
                    'tenant_id' => $tenant->id,
                    'branch_id' => $branch->id,
                    'counter_id' => $lockedCounter->id,
                    'user_id' => $cashier->id,
                    'status' => 'open',
                    'shift' => $resolvedShift,
                    'opened_at' => now(),
                    'opening_float' => $openingFloatDecimal,
                    'opening_denominations' => $normalizedOpeningDenoms,
                    'cash_sales_total' => '0.00',
                    'card_sales_total' => '0.00',
                    'mobile_sales_total' => '0.00',
                    'cash_in_total' => '0.00',
                    'cash_out_total' => '0.00',
                    'cash_refunds_total' => '0.00',
                    'system_expected_cash' => $openingFloatDecimal,
                    'discrepancy' => '0.00',
                    'total_sales_amount' => '0.00',
                    'total_transactions' => 0,
                    'notes' => $notes,
                ]);
            }

            $lockedCounter->update([
                'status' => 'active',
                'current_user_id' => $cashier->id,
                'current_break_reason' => null,
                'break_started_at' => null,
            ]);

            AuditLog::record(
                action: 'counter.shift_opened',
                description: "Cashier {$cashier->name} opened {$resolvedShift} shift on Counter {$lockedCounter->code} with opening float {$openingFloatDecimal}.",
                subject: $lockedCounter,
                metadata: [
                    'counter_id' => $lockedCounter->id,
                    'counter_session_id' => $session->id,
                    'opening_float' => $openingFloatDecimal,
                    'opening_denominations' => $normalizedOpeningDenoms,
                    'shift' => $resolvedShift,
                    'auto_seated' => $autoSeated,
                ],
                userId: $cashier->id
            );

            return $session->fresh(['counter', 'user']);
        });

        $this->assignmentService->processUnassignedQueue($tenant->id, $branch->id);

        return $session;
    }

    /**
     * Auto-seat logged-in cashier on their assigned (or first available) counter and open a shift.
     */
    public function autoOpenShift(
        Tenant $tenant,
        Branch $branch,
        User $cashier,
        string|int|float $openingFloat = 0,
        ?string $shift = null,
        ?string $notes = null
    ): CounterSession {
        // 1. If cashier already has an open shift, ensure counter is active and return it
        $existingUserSession = CounterSession::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $cashier->id)
            ->where('status', 'open')
            ->with('counter')
            ->first();

        if ($existingUserSession && $existingUserSession->counter) {
            if ($existingUserSession->counter->status !== 'active') {
                $existingUserSession->counter->update([
                    'status' => 'active',
                    'current_user_id' => $cashier->id,
                    'current_break_reason' => null,
                    'break_started_at' => null,
                ]);
            }

            return $existingUserSession;
        }

        // 2. Prefer counter explicitly assigned to this cashier
        $assignedCounterIds = CounterCashier::query()
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $cashier->id)
            ->where('branch_id', $branch->id)
            ->where('is_active', true)
            ->orderByDesc('is_primary')
            ->pluck('counter_id');

        $counter = null;

        if ($assignedCounterIds->isNotEmpty()) {
            $counter = Counter::query()
                ->whereIn('id', $assignedCounterIds)
                ->where('tenant_id', $tenant->id)
                ->where('branch_id', $branch->id)
                ->where('is_active', true)
                ->where(function ($q) use ($cashier): void {
                    $q->where('status', 'closed')
                        ->orWhereNull('current_user_id')
                        ->orWhere('current_user_id', $cashier->id);
                })
                ->orderByRaw('CASE WHEN id = ? THEN 0 ELSE 1 END', [$assignedCounterIds->first()])
                ->first();
        }

        // 3. Fallback: first available unoccupied active counter in this branch
        if (! $counter) {
            $counter = Counter::query()
                ->where('tenant_id', $tenant->id)
                ->where('branch_id', $branch->id)
                ->where('is_active', true)
                ->where(function ($q) use ($cashier): void {
                    $q->where('status', 'closed')
                        ->orWhereNull('current_user_id')
                        ->orWhere('current_user_id', $cashier->id);
                })
                ->orderBy('code')
                ->first();
        }

        if (! $counter) {
            throw ValidationException::withMessages([
                'counter' => ['No available counter found in this branch. All active counters are currently occupied.'],
            ]);
        }

        return $this->openShift(
            tenant: $tenant,
            branch: $branch,
            counter: $counter,
            cashier: $cashier,
            openingFloat: $openingFloat,
            shift: $shift,
            notes: $notes ?: 'Started from Cashier Station',
            autoSeated: true
        );
    }

    /**
     * Record a Cash Drawer Movement (Cash In, Cash Out, Safe Drop, or Cash Refund)
     * and atomically recompute exact expected cash in integer paisa.
     */
    public function recordCashMovement(
        Counter $counter,
        User $actor,
        string $type,
        string|int|float $amount,
        string $reason,
        ?string $referenceNumber = null,
        ?string $notes = null,
        bool $canOverrideOwnership = false
    ): CounterCashMovement {
        if (! in_array($type, CounterCashMovement::TYPES, true)) {
            throw ValidationException::withMessages([
                'type' => ['Invalid cash movement type.'],
            ]);
        }

        $amountPaisa = MoneyMath::toPaisa($amount);
        if ($amountPaisa <= 0) {
            throw ValidationException::withMessages([
                'amount' => ['Movement amount must be greater than zero.'],
            ]);
        }

        $trimmedReason = trim($reason);
        if ($trimmedReason === '') {
            throw ValidationException::withMessages([
                'reason' => ['A reason is required for cash drawer movements.'],
            ]);
        }

        return DB::transaction(function () use (
            $counter,
            $actor,
            $type,
            $amountPaisa,
            $trimmedReason,
            $referenceNumber,
            $notes,
            $canOverrideOwnership
        ): CounterCashMovement {
            $session = CounterSession::query()
                ->where('counter_id', $counter->id)
                ->where('status', 'open')
                ->lockForUpdate()
                ->first();

            if (! $session) {
                throw ValidationException::withMessages([
                    'shift' => ["Counter {$counter->code} has no open shift. Open a shift before recording cash drawer movements."],
                ]);
            }

            if (! $canOverrideOwnership && (int) $session->user_id !== (int) $actor->id) {
                throw ValidationException::withMessages([
                    'shift' => ['Only the active shift cashier or a branch manager can record cash drawer movements on this counter.'],
                ]);
            }

            $amountDecimal = MoneyMath::fromPaisa($amountPaisa);

            $movement = CounterCashMovement::query()->create([
                'tenant_id' => $session->tenant_id,
                'branch_id' => $session->branch_id,
                'counter_id' => $counter->id,
                'counter_session_id' => $session->id,
                'user_id' => $actor->id,
                'approved_by' => $canOverrideOwnership && (int) $session->user_id !== (int) $actor->id ? $actor->id : null,
                'type' => $type,
                'amount' => $amountDecimal,
                'reason' => $trimmedReason,
                'reference_number' => $referenceNumber ? trim($referenceNumber) : null,
                'notes' => $notes ? trim($notes) : null,
                'occurred_at' => now(),
            ]);

            // Recompute exact drawer state in integer paisa
            $summary = $this->calculateLiveDrawerSummary($session);
            $session->update([
                'cash_sales_total' => $summary['cash_sales'],
                'card_sales_total' => $summary['card_sales'],
                'mobile_sales_total' => $summary['mobile_sales'],
                'cash_in_total' => $summary['cash_in'],
                'cash_out_total' => $summary['cash_out_total'],
                'cash_refunds_total' => $summary['cash_refunds'],
                'system_expected_cash' => $summary['expected_cash'],
            ]);

            $label = match ($type) {
                CounterCashMovement::TYPE_CASH_IN => 'Cash In (Float Top-up)',
                CounterCashMovement::TYPE_CASH_OUT => 'Cash Out (Expense)',
                CounterCashMovement::TYPE_SAFE_DROP => 'Safe Drop to Vault',
                CounterCashMovement::TYPE_CASH_REFUND => 'Cash Refund',
                default => $type,
            };

            AuditLog::record(
                action: "counter.{$type}",
                description: "{$actor->name} recorded {$label} of {$amountDecimal} on Counter {$counter->code}. Reason: {$trimmedReason}",
                subject: $movement,
                metadata: [
                    'counter_id' => $counter->id,
                    'counter_session_id' => $session->id,
                    'type' => $type,
                    'amount' => $amountDecimal,
                    'reason' => $trimmedReason,
                    'reference_number' => $movement->reference_number,
                    'system_expected_cash_after' => $summary['expected_cash'],
                ],
                userId: $actor->id
            );

            return $movement;
        });
    }

    /**
     * Authoritatively compute live cash drawer summary in exact integer paisa.
     * Formula: Expected Cash = Opening Float + Cash Sales + Cash In - Cash Out - Safe Drops - Cash Refunds.
     *
     * @return array<string, mixed>
     */
    public function calculateLiveDrawerSummary(CounterSession $session): array
    {
        $openingFloatPaisa = MoneyMath::toPaisa($session->opening_float);

        // 1. Aggregate completed/paid sales & payment channels for this shift
        $sales = Sale::query()
            ->where('counter_session_id', $session->id)
            ->whereNotIn('order_status', ['draft', 'cancelled'])
            ->with('payments')
            ->get();

        $cashSalesPaisa = 0;
        $cardSalesPaisa = 0;
        $mobileSalesPaisa = 0;
        $totalSalesPaisa = 0;
        $totalTransactions = $sales->count();

        foreach ($sales as $sale) {
            $totalSalesPaisa += MoneyMath::toPaisa($sale->total_amount);

            if ($sale->payments->isNotEmpty()) {
                $saleCashPaisa = 0;
                foreach ($sale->payments as $payment) {
                    $method = strtolower((string) $payment->payment_method);
                    $amtPaisa = MoneyMath::toPaisa($payment->amount);

                    if ($method === 'cash') {
                        $saleCashPaisa += $amtPaisa;
                    } elseif ($method === 'card') {
                        $cardSalesPaisa += $amtPaisa;
                    } else {
                        $mobileSalesPaisa += $amtPaisa;
                    }
                }

                // Subtract change handed back to customer from gross cash tendered
                $changePaisa = MoneyMath::toPaisa($sale->change_amount);
                $cashSalesPaisa += max(0, $saleCashPaisa - $changePaisa);
            } else {
                // Fallback if a legacy sale record has no SalePayment rows
                $method = strtolower((string) $sale->payment_method);
                $netPaid = max(0, MoneyMath::toPaisa($sale->paid_amount) - MoneyMath::toPaisa($sale->change_amount));
                if ($method === 'cash') {
                    $cashSalesPaisa += $netPaid;
                } elseif ($method === 'card') {
                    $cardSalesPaisa += $netPaid;
                } elseif ($netPaid > 0) {
                    $mobileSalesPaisa += $netPaid;
                }
            }
        }

        // 2. Aggregate non-sale cash drawer movements
        $movements = CounterCashMovement::query()
            ->where('counter_session_id', $session->id)
            ->with('user:id,name')
            ->orderBy('occurred_at')
            ->get();

        $cashInPaisa = 0;
        $cashOutOnlyPaisa = 0;
        $safeDropPaisa = 0;
        $cashRefundsPaisa = 0;

        foreach ($movements as $m) {
            $amtPaisa = MoneyMath::toPaisa($m->amount);
            match ($m->type) {
                CounterCashMovement::TYPE_CASH_IN => $cashInPaisa += $amtPaisa,
                CounterCashMovement::TYPE_CASH_OUT => $cashOutOnlyPaisa += $amtPaisa,
                CounterCashMovement::TYPE_SAFE_DROP => $safeDropPaisa += $amtPaisa,
                CounterCashMovement::TYPE_CASH_REFUND => $cashRefundsPaisa += $amtPaisa,
                default => null,
            };
        }

        $cashOutTotalPaisa = $cashOutOnlyPaisa + $safeDropPaisa;

        // Exact expected cash in drawer (integer paisa)
        $expectedCashPaisa = $openingFloatPaisa
            + $cashSalesPaisa
            + $cashInPaisa
            - $cashOutTotalPaisa
            - $cashRefundsPaisa;

        // 3. Aggregate break logs
        $breakLogs = CounterBreakLog::query()
            ->where('counter_session_id', $session->id)
            ->orderBy('started_at')
            ->get();

        $totalBreakMinutes = 0;
        foreach ($breakLogs as $b) {
            if ($b->duration_minutes !== null) {
                $totalBreakMinutes += (int) $b->duration_minutes;
            } elseif ($b->started_at) {
                $totalBreakMinutes += max(0, (int) now()->diffInMinutes($b->started_at));
            }
        }

        $totalCollectedPaisa = $cashSalesPaisa + $cardSalesPaisa + $mobileSalesPaisa;

        return [
            'opening_float_paisa' => $openingFloatPaisa,
            'cash_sales_paisa' => $cashSalesPaisa,
            'card_sales_paisa' => $cardSalesPaisa,
            'mobile_sales_paisa' => $mobileSalesPaisa,
            'total_collected_paisa' => $totalCollectedPaisa,
            'total_sales_paisa' => $totalSalesPaisa,
            'cash_in_paisa' => $cashInPaisa,
            'cash_out_only_paisa' => $cashOutOnlyPaisa,
            'safe_drop_paisa' => $safeDropPaisa,
            'cash_out_total_paisa' => $cashOutTotalPaisa,
            'cash_refunds_paisa' => $cashRefundsPaisa,
            'expected_cash_paisa' => $expectedCashPaisa,
            'opening_float' => MoneyMath::fromPaisa($openingFloatPaisa),
            'cash_sales' => MoneyMath::fromPaisa($cashSalesPaisa),
            'card_sales' => MoneyMath::fromPaisa($cardSalesPaisa),
            'mobile_sales' => MoneyMath::fromPaisa($mobileSalesPaisa),
            'total_collected' => MoneyMath::fromPaisa($totalCollectedPaisa),
            'total_sales' => MoneyMath::fromPaisa($totalSalesPaisa),
            'cash_in' => MoneyMath::fromPaisa($cashInPaisa),
            'cash_out_only' => MoneyMath::fromPaisa($cashOutOnlyPaisa),
            'safe_drop' => MoneyMath::fromPaisa($safeDropPaisa),
            'cash_out_total' => MoneyMath::fromPaisa($cashOutTotalPaisa),
            'cash_refunds' => MoneyMath::fromPaisa($cashRefundsPaisa),
            'expected_cash' => MoneyMath::fromPaisa($expectedCashPaisa),
            'total_transactions' => $totalTransactions,
            'break_count' => $breakLogs->count(),
            'total_break_minutes' => $totalBreakMinutes,
            'breaks' => $breakLogs->map(fn (CounterBreakLog $b) => [
                'id' => $b->id,
                'break_type' => $b->break_type,
                'started_at' => $b->started_at?->format('h:i A'),
                'ended_at' => $b->ended_at?->format('h:i A'),
                'duration_minutes' => $b->duration_minutes,
                'notes' => $b->notes,
            ])->values()->all(),
            'movements' => $movements->map(fn (CounterCashMovement $m) => [
                'id' => $m->id,
                'type' => $m->type,
                'amount' => (float) $m->amount,
                'amount_formatted' => MoneyMath::fromPaisa(MoneyMath::toPaisa($m->amount)),
                'reason' => $m->reason,
                'reference_number' => $m->reference_number,
                'user_name' => $m->user?->name,
                'occurred_at' => $m->occurred_at?->format('h:i A'),
            ])->values()->all(),
        ];
    }

    /**
     * Close shift, lock drawer, enforce mandatory discrepancy reason & generate immutable gapless Z-Report.
     */
    public function closeShift(
        Counter $counter,
        User $actor,
        string|int|float|null $closingCashCounted,
        ?array $denominations = null,
        ?string $notes = null,
        bool $canOverrideOwnership = false,
        bool $isForceClose = false,
        ?string $forceCloseReason = null
    ): ?CounterSession {
        if ($isForceClose && trim((string) $forceCloseReason) === '') {
            throw ValidationException::withMessages([
                'force_close_reason' => ['A reason is required to force-close an open shift.'],
            ]);
        }

        if ($closingCashCounted !== null && MoneyMath::toPaisa($closingCashCounted) < 0) {
            throw ValidationException::withMessages([
                'closing_cash_counted' => ['Counted closing cash cannot be negative.'],
            ]);
        }

        $normalizedDenominations = null;
        if (! empty($denominations)) {
            $denomResult = MoneyMath::sumDenominations($denominations);
            $normalizedDenominations = $denomResult['normalized'];
        }

        return DB::transaction(function () use (
            $counter,
            $actor,
            $closingCashCounted,
            $normalizedDenominations,
            $notes,
            $canOverrideOwnership,
            $isForceClose,
            $forceCloseReason
        ): ?CounterSession {
            $lockedCounter = Counter::query()
                ->where('id', $counter->id)
                ->lockForUpdate()
                ->firstOrFail();

            $session = CounterSession::query()
                ->where('counter_id', $lockedCounter->id)
                ->where('status', 'open')
                ->lockForUpdate()
                ->first();

            if (! $session) {
                $lockedCounter->update([
                    'status' => 'closed',
                    'current_user_id' => null,
                    'current_break_reason' => null,
                    'break_started_at' => null,
                ]);

                return null;
            }

            if (! $canOverrideOwnership && (int) $session->user_id !== (int) $actor->id) {
                throw ValidationException::withMessages([
                    'shift' => ['Only the active shift cashier or a branch manager can close this shift.'],
                ]);
            }

            // Close any active break logs
            $openBreaks = CounterBreakLog::query()
                ->where('counter_session_id', $session->id)
                ->whereNull('ended_at')
                ->get();

            $closedAt = now();
            foreach ($openBreaks as $ob) {
                $mins = max(1, (int) $closedAt->diffInMinutes($ob->started_at));
                $ob->update([
                    'ended_at' => $closedAt,
                    'duration_minutes' => $mins,
                ]);
            }

            // Authoritative recalculation in exact integer paisa
            $summary = $this->calculateLiveDrawerSummary($session);
            $expectedPaisa = (int) $summary['expected_cash_paisa'];
            $countedPaisa = $closingCashCounted !== null
                ? MoneyMath::toPaisa($closingCashCounted)
                : $expectedPaisa;
            $discrepancyPaisa = $countedPaisa - $expectedPaisa;

            $effectiveReason = trim((string) ($notes ?: $forceCloseReason ?: ''));
            if ($discrepancyPaisa !== 0 && $effectiveReason === '') {
                throw ValidationException::withMessages([
                    'notes' => ['A reason is required when there is a cash discrepancy (shortage or surplus).'],
                ]);
            }

            $countedDecimal = MoneyMath::fromPaisa($countedPaisa);
            $expectedDecimal = MoneyMath::fromPaisa($expectedPaisa);
            $discrepancyDecimal = MoneyMath::fromPaisa($discrepancyPaisa);

            // Gapless per-tenant sequential Z-Report Number (ZR-000001)
            $zReportNumber = DocumentSequence::nextNumber(
                tenantId: (int) $session->tenant_id,
                branchId: null,
                docType: 'z_report',
                defaultPrefix: 'ZR',
                padding: 6
            );

            $session->loadMissing(['tenant', 'branch', 'counter', 'user']);

            $durationMinutes = $session->opened_at
                ? max(1, (int) $closedAt->diffInMinutes($session->opened_at))
                : 0;

            $trimmedForceReason = $isForceClose ? trim((string) $forceCloseReason) : null;
            $trimmedNotes = $notes ? trim($notes) : ($trimmedForceReason ?: $session->notes);

            $zReportSnapshot = [
                'report_type' => 'Z-REPORT',
                'z_report_number' => $zReportNumber,
                'session_id' => $session->id,
                'status' => 'closed',
                'is_force_closed' => $isForceClose,
                'force_close_reason' => $trimmedForceReason,
                'generated_at' => $closedAt->format('d M Y, h:i A'),
                'tenant' => [
                    'name' => $session->tenant?->name ?? 'PharmaCore Pharmacy',
                    'currency' => $session->tenant?->currency_code ?? 'BDT',
                ],
                'branch' => [
                    'name' => $session->branch?->name,
                    'address' => $session->branch?->address,
                    'phone' => $session->branch?->phone,
                ],
                'counter' => [
                    'id' => $lockedCounter->id,
                    'code' => $lockedCounter->code,
                    'name' => $lockedCounter->name,
                    'zone' => $lockedCounter->zone,
                ],
                'shift' => $session->shift ?? 'morning',
                'cashier' => [
                    'id' => $session->user_id,
                    'name' => $session->user?->name ?? 'Cashier',
                ],
                'closed_by' => [
                    'id' => $actor->id,
                    'name' => $actor->name,
                ],
                'opened_at' => $session->opened_at?->format('d M Y, h:i A'),
                'closed_at' => $closedAt->format('d M Y, h:i A'),
                'duration_minutes' => $durationMinutes,
                'totals' => [
                    'total_transactions' => (int) $summary['total_transactions'],
                    'total_sales' => (float) $summary['total_sales'],
                    'cash_sales' => (float) $summary['cash_sales'],
                    'card_sales' => (float) $summary['card_sales'],
                    'mobile_sales' => (float) $summary['mobile_sales'],
                    'total_collected' => (float) $summary['total_collected'],
                ],
                'drawer' => [
                    'opening_float' => (float) $summary['opening_float'],
                    'cash_sales' => (float) $summary['cash_sales'],
                    'cash_in' => (float) $summary['cash_in'],
                    'cash_out_only' => (float) $summary['cash_out_only'],
                    'safe_drop' => (float) $summary['safe_drop'],
                    'cash_out_total' => (float) $summary['cash_out_total'],
                    'cash_refunds' => (float) $summary['cash_refunds'],
                    'expected_cash' => (float) $expectedDecimal,
                    'counted_cash' => (float) $countedDecimal,
                    'discrepancy' => (float) $discrepancyDecimal,
                    'discrepancy_status' => $discrepancyPaisa === 0
                        ? 'matched'
                        : ($discrepancyPaisa > 0 ? 'surplus' : 'shortage'),
                ],
                'opening_denominations' => $session->opening_denominations,
                'denominations' => $normalizedDenominations,
                'breaks' => $summary['breaks'],
                'total_break_minutes' => $summary['total_break_minutes'],
                'movements' => $summary['movements'],
                'notes' => $trimmedNotes,
            ];

            $session->update([
                'status' => 'closed',
                'closed_at' => $closedAt,
                'closed_by' => $actor->id,
                'is_force_closed' => $isForceClose,
                'force_close_reason' => $trimmedForceReason,
                'z_report_number' => $zReportNumber,
                'cash_sales_total' => $summary['cash_sales'],
                'card_sales_total' => $summary['card_sales'],
                'mobile_sales_total' => $summary['mobile_sales'],
                'cash_in_total' => $summary['cash_in'],
                'cash_out_total' => $summary['cash_out_total'],
                'cash_refunds_total' => $summary['cash_refunds'],
                'total_sales_amount' => $summary['total_sales'],
                'total_transactions' => (int) $summary['total_transactions'],
                'system_expected_cash' => $expectedDecimal,
                'closing_cash_counted' => $countedDecimal,
                'closing_denominations' => $normalizedDenominations,
                'discrepancy' => $discrepancyDecimal,
                'notes' => $trimmedNotes,
                'z_report_snapshot' => $zReportSnapshot,
            ]);

            $lockedCounter->update([
                'status' => 'closed',
                'current_user_id' => null,
                'current_break_reason' => null,
                'break_started_at' => null,
            ]);

            AuditLog::record(
                action: $isForceClose ? 'counter.shift_force_closed' : 'counter.shift_closed',
                description: $isForceClose
                    ? "Supervisor {$actor->name} force-closed shift on Counter {$lockedCounter->code} ({$zReportNumber}). Reason: {$trimmedForceReason}. Expected: {$expectedDecimal}, Counted: {$countedDecimal}, Discrepancy: {$discrepancyDecimal}."
                    : "{$actor->name} closed shift on Counter {$lockedCounter->code} ({$zReportNumber}). Expected: {$expectedDecimal}, Counted: {$countedDecimal}, Discrepancy: {$discrepancyDecimal}.",
                subject: $session,
                metadata: [
                    'z_report_number' => $zReportNumber,
                    'counter_id' => $lockedCounter->id,
                    'is_force_closed' => $isForceClose,
                    'force_close_reason' => $trimmedForceReason,
                    'opening_float' => $summary['opening_float'],
                    'cash_sales' => $summary['cash_sales'],
                    'cash_in' => $summary['cash_in'],
                    'cash_out_total' => $summary['cash_out_total'],
                    'cash_refunds' => $summary['cash_refunds'],
                    'system_expected_cash' => $expectedDecimal,
                    'closing_cash_counted' => $countedDecimal,
                    'discrepancy' => $discrepancyDecimal,
                    'total_sales' => $summary['total_sales'],
                    'total_transactions' => (int) $summary['total_transactions'],
                ],
                userId: $actor->id
            );

            return $session->fresh(['counter', 'user', 'closedBy']);
        });
    }

    /**
     * Return immutable Z-Report for closed sessions, or live mid-shift X-Report for open sessions.
     *
     * @return array<string, mixed>
     */
    public function getReportPayload(CounterSession $session): array
    {
        if ($session->status === 'closed' && is_array($session->z_report_snapshot)) {
            return $session->z_report_snapshot;
        }

        $session->loadMissing(['tenant', 'branch', 'counter', 'user', 'closedBy']);
        $summary = $this->calculateLiveDrawerSummary($session);
        $now = now();
        $endTime = $session->closed_at ?? $now;
        $durationMinutes = $session->opened_at
            ? max(1, (int) $endTime->diffInMinutes($session->opened_at))
            : 0;

        $counted = $session->closing_cash_counted !== null ? (float) $session->closing_cash_counted : null;
        $discrepancy = $session->discrepancy !== null ? (float) $session->discrepancy : 0.0;

        return [
            'report_type' => $session->status === 'closed' ? 'Z-REPORT' : 'X-REPORT (LIVE)',
            'z_report_number' => $session->z_report_number ?? 'LIVE-SHIFT-'.$session->id,
            'session_id' => $session->id,
            'status' => $session->status,
            'generated_at' => $now->format('d M Y, h:i A'),
            'tenant' => [
                'name' => $session->tenant?->name ?? 'PharmaCore Pharmacy',
                'currency' => $session->tenant?->currency_code ?? 'BDT',
            ],
            'branch' => [
                'name' => $session->branch?->name,
                'address' => $session->branch?->address,
                'phone' => $session->branch?->phone,
            ],
            'counter' => [
                'id' => $session->counter?->id,
                'code' => $session->counter?->code,
                'name' => $session->counter?->name,
                'zone' => $session->counter?->zone,
            ],
            'shift' => $session->shift ?? 'morning',
            'cashier' => [
                'id' => $session->user_id,
                'name' => $session->user?->name ?? 'Cashier',
            ],
            'closed_by' => $session->closedBy ? [
                'id' => $session->closedBy->id,
                'name' => $session->closedBy->name,
            ] : null,
            'opened_at' => $session->opened_at?->format('d M Y, h:i A'),
            'closed_at' => $session->closed_at?->format('d M Y, h:i A'),
            'duration_minutes' => $durationMinutes,
            'totals' => [
                'total_transactions' => (int) $summary['total_transactions'],
                'total_sales' => (float) $summary['total_sales'],
                'cash_sales' => (float) $summary['cash_sales'],
                'card_sales' => (float) $summary['card_sales'],
                'mobile_sales' => (float) $summary['mobile_sales'],
                'total_collected' => (float) $summary['total_collected'],
            ],
            'drawer' => [
                'opening_float' => (float) $summary['opening_float'],
                'cash_sales' => (float) $summary['cash_sales'],
                'cash_in' => (float) $summary['cash_in'],
                'cash_out_only' => (float) $summary['cash_out_only'],
                'safe_drop' => (float) $summary['safe_drop'],
                'cash_out_total' => (float) $summary['cash_out_total'],
                'cash_refunds' => (float) $summary['cash_refunds'],
                'expected_cash' => (float) $summary['expected_cash'],
                'counted_cash' => $counted,
                'discrepancy' => $discrepancy,
                'discrepancy_status' => $session->status === 'open'
                    ? 'open'
                    : ($discrepancy == 0.0 ? 'matched' : ($discrepancy > 0 ? 'surplus' : 'shortage')),
            ],
            'denominations' => $session->closing_denominations,
            'breaks' => $summary['breaks'],
            'total_break_minutes' => $summary['total_break_minutes'],
            'movements' => $summary['movements'],
            'notes' => $session->notes,
        ];
    }

    public function detectCurrentShift(): string
    {
        $hour = now()->hour;

        return $hour < 14 ? 'morning' : ($hour < 21 ? 'evening' : 'night');
    }
}
