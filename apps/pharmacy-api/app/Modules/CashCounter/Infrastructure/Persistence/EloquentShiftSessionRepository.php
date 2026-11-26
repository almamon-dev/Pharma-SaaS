<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Infrastructure\Persistence;

use App\Models\CounterBreakLog;
use App\Models\CounterCashMovement;
use App\Models\CounterSession;
use App\Models\Sale;
use App\Modules\CashCounter\Application\DTO\ShiftSessionSnapshot;
use App\Modules\CashCounter\Application\Ports\ShiftSessionRepository;
use App\Modules\CashCounter\Domain\CashMovementType;
use DateTimeImmutable;
use PharmaCore\Foundation\Domain\Money;

final class EloquentShiftSessionRepository implements ShiftSessionRepository
{
    private const RELATIONS = ['tenant', 'branch', 'counter', 'user', 'closedBy'];

    public function findOpenByUserForUpdate(int $tenantId, int $userId): ?ShiftSessionSnapshot
    {
        $session = CounterSession::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->with(self::RELATIONS)
            ->lockForUpdate()
            ->first();

        return $session ? $this->toSnapshot($session) : null;
    }

    public function findOpenByUser(int $tenantId, int $userId): ?ShiftSessionSnapshot
    {
        $session = CounterSession::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->with(self::RELATIONS)
            ->first();

        return $session ? $this->toSnapshot($session) : null;
    }

    public function findOpenByCounterForUpdate(int $tenantId, int $counterId): ?ShiftSessionSnapshot
    {
        $query = CounterSession::query()
            ->where('counter_id', $counterId)
            ->where('status', 'open')
            ->with(self::RELATIONS);

        if ($tenantId > 0) {
            $query->where('tenant_id', $tenantId);
        }

        $session = $query->lockForUpdate()->first();

        return $session ? $this->toSnapshot($session) : null;
    }

    public function findById(int $sessionId): ShiftSessionSnapshot
    {
        $session = CounterSession::query()
            ->with(self::RELATIONS)
            ->findOrFail($sessionId);

        return $this->toSnapshot($session);
    }

    /**
     * @param  array<int, int>|null  $openingDenominations
     */
    public function createOpenSession(
        int $tenantId,
        int $branchId,
        int $counterId,
        int $cashierId,
        string $shift,
        DateTimeImmutable $openedAt,
        string $openingFloat,
        ?array $openingDenominations,
        ?string $notes,
    ): ShiftSessionSnapshot {
        $session = CounterSession::query()->create([
            'tenant_id' => $tenantId,
            'branch_id' => $branchId,
            'counter_id' => $counterId,
            'user_id' => $cashierId,
            'status' => 'open',
            'shift' => $shift,
            'opened_at' => $openedAt,
            'opening_float' => $openingFloat,
            'opening_denominations' => $openingDenominations,
            'cash_sales_total' => '0.00',
            'card_sales_total' => '0.00',
            'mobile_sales_total' => '0.00',
            'cash_in_total' => '0.00',
            'cash_out_total' => '0.00',
            'cash_refunds_total' => '0.00',
            'system_expected_cash' => $openingFloat,
            'discrepancy' => '0.00',
            'total_sales_amount' => '0.00',
            'total_transactions' => 0,
            'notes' => $notes,
        ]);

        return $this->toSnapshot($session->fresh(self::RELATIONS));
    }

    public function createCashMovement(
        int $tenantId,
        int $branchId,
        int $counterId,
        int $sessionId,
        int $actorId,
        ?int $approvedById,
        string $type,
        string $amount,
        string $reason,
        ?string $referenceNumber,
        ?string $notes,
        DateTimeImmutable $occurredAt,
    ): int {
        $movement = CounterCashMovement::query()->create([
            'tenant_id' => $tenantId,
            'branch_id' => $branchId,
            'counter_id' => $counterId,
            'counter_session_id' => $sessionId,
            'user_id' => $actorId,
            'approved_by' => $approvedById,
            'type' => $type,
            'amount' => $amount,
            'reason' => $reason,
            'reference_number' => $referenceNumber,
            'notes' => $notes,
            'occurred_at' => $occurredAt,
        ]);

        return (int) $movement->id;
    }

    /**
     * @param  array<string, string>  $totals
     */
    public function updateOpenTotals(int $sessionId, array $totals): void
    {
        $session = CounterSession::query()->findOrFail($sessionId);
        $session->update($totals);
    }

    public function closeOpenBreaks(int $sessionId, DateTimeImmutable $closedAt): void
    {
        $openBreaks = CounterBreakLog::query()
            ->where('counter_session_id', $sessionId)
            ->whereNull('ended_at')
            ->get();

        foreach ($openBreaks as $ob) {
            $startedTs = $ob->started_at?->getTimestamp() ?? $closedAt->getTimestamp();
            $mins = max(1, (int) intdiv(max(0, $closedAt->getTimestamp() - $startedTs), 60));
            $ob->update([
                'ended_at' => $closedAt,
                'duration_minutes' => $mins,
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $closingData
     */
    public function finalizeClosedSession(int $sessionId, array $closingData): ShiftSessionSnapshot
    {
        $session = CounterSession::query()->findOrFail($sessionId);
        $session->update($closingData);

        return $this->toSnapshot($session->fresh(self::RELATIONS));
    }

    public function collectLiveDrawerData(int $sessionId, DateTimeImmutable $now): array
    {
        $sales = Sale::query()
            ->where('counter_session_id', $sessionId)
            ->whereNotIn('order_status', ['draft', 'cancelled'])
            ->with('payments')
            ->get();

        $cashSalesPaisa = 0;
        $cardSalesPaisa = 0;
        $mobileSalesPaisa = 0;
        $totalSalesPaisa = 0;
        $totalTransactions = $sales->count();

        foreach ($sales as $sale) {
            $totalSalesPaisa += Money::fromDecimal($sale->total_amount)->minorUnits;

            if ($sale->payments->isNotEmpty()) {
                $saleCashPaisa = 0;
                foreach ($sale->payments as $payment) {
                    $method = strtolower((string) $payment->payment_method);
                    $amtPaisa = Money::fromDecimal($payment->amount)->minorUnits;

                    if ($method === 'cash') {
                        $saleCashPaisa += $amtPaisa;
                    } elseif ($method === 'card') {
                        $cardSalesPaisa += $amtPaisa;
                    } else {
                        $mobileSalesPaisa += $amtPaisa;
                    }
                }

                $changePaisa = Money::fromDecimal($sale->change_amount)->minorUnits;
                $cashSalesPaisa += max(0, $saleCashPaisa - $changePaisa);
            } else {
                $method = strtolower((string) $sale->payment_method);
                $netPaid = max(
                    0,
                    Money::fromDecimal($sale->paid_amount)->minorUnits - Money::fromDecimal($sale->change_amount)->minorUnits
                );
                if ($method === 'cash') {
                    $cashSalesPaisa += $netPaid;
                } elseif ($method === 'card') {
                    $cardSalesPaisa += $netPaid;
                } elseif ($netPaid > 0) {
                    $mobileSalesPaisa += $netPaid;
                }
            }
        }

        $movements = CounterCashMovement::query()
            ->where('counter_session_id', $sessionId)
            ->with('user:id,name')
            ->orderBy('occurred_at')
            ->get();

        $cashInPaisa = 0;
        $cashOutOnlyPaisa = 0;
        $safeDropPaisa = 0;
        $cashRefundsPaisa = 0;

        foreach ($movements as $m) {
            $amtPaisa = Money::fromDecimal($m->amount)->minorUnits;
            match ($m->type) {
                CashMovementType::CASH_IN->value => $cashInPaisa += $amtPaisa,
                CashMovementType::CASH_OUT->value => $cashOutOnlyPaisa += $amtPaisa,
                CashMovementType::SAFE_DROP->value => $safeDropPaisa += $amtPaisa,
                CashMovementType::CASH_REFUND->value => $cashRefundsPaisa += $amtPaisa,
                default => null,
            };
        }

        $breakLogs = CounterBreakLog::query()
            ->where('counter_session_id', $sessionId)
            ->orderBy('started_at')
            ->get();

        $totalBreakMinutes = 0;
        foreach ($breakLogs as $b) {
            if ($b->duration_minutes !== null) {
                $totalBreakMinutes += (int) $b->duration_minutes;
            } elseif ($b->started_at !== null) {
                $totalBreakMinutes += max(0, (int) intdiv(max(0, $now->getTimestamp() - $b->started_at->getTimestamp()), 60));
            }
        }

        return [
            'cash_sales_paisa' => $cashSalesPaisa,
            'card_sales_paisa' => $cardSalesPaisa,
            'mobile_sales_paisa' => $mobileSalesPaisa,
            'total_sales_paisa' => $totalSalesPaisa,
            'total_transactions' => $totalTransactions,
            'cash_in_paisa' => $cashInPaisa,
            'cash_out_only_paisa' => $cashOutOnlyPaisa,
            'safe_drop_paisa' => $safeDropPaisa,
            'cash_refunds_paisa' => $cashRefundsPaisa,
            'break_count' => $breakLogs->count(),
            'total_break_minutes' => $totalBreakMinutes,
            'breaks' => $breakLogs->map(static fn (CounterBreakLog $b): array => [
                'id' => $b->id,
                'break_type' => $b->break_type,
                'started_at' => $b->started_at?->format('h:i A'),
                'ended_at' => $b->ended_at?->format('h:i A'),
                'duration_minutes' => $b->duration_minutes,
                'notes' => $b->notes,
            ])->values()->all(),
            'movements' => $movements->map(static fn (CounterCashMovement $m): array => [
                'id' => $m->id,
                'type' => $m->type,
                'amount' => (float) $m->amount,
                'amount_formatted' => Money::fromDecimal($m->amount)->toDecimalString(),
                'reason' => $m->reason,
                'reference_number' => $m->reference_number,
                'user_name' => $m->user?->name,
                'occurred_at' => $m->occurred_at?->format('h:i A'),
            ])->values()->all(),
        ];
    }

    public function toSnapshot(CounterSession $session): ShiftSessionSnapshot
    {
        $session->loadMissing(self::RELATIONS);

        return new ShiftSessionSnapshot(
            id: (int) $session->id,
            tenantId: (int) $session->tenant_id,
            branchId: (int) $session->branch_id,
            counterId: (int) $session->counter_id,
            counterCode: (string) ($session->counter?->code ?? ''),
            counterName: (string) ($session->counter?->name ?? ''),
            counterZone: $session->counter?->zone,
            cashierId: (int) $session->user_id,
            cashierName: (string) ($session->user?->name ?? 'Cashier'),
            closedById: $session->closed_by !== null ? (int) $session->closed_by : null,
            closedByName: $session->closedBy?->name,
            tenantName: (string) ($session->tenant?->name ?? 'PharmaCore Pharmacy'),
            currencyCode: (string) ($session->tenant?->currency_code ?? 'BDT'),
            branchName: $session->branch?->name,
            branchAddress: $session->branch?->address,
            branchPhone: $session->branch?->phone,
            status: (string) $session->status,
            shift: (string) ($session->shift ?? 'morning'),
            zReportNumber: $session->z_report_number,
            isForceClosed: (bool) $session->is_force_closed,
            forceCloseReason: $session->force_close_reason,
            openedAt: $session->opened_at?->toDateTimeImmutable(),
            closedAt: $session->closed_at?->toDateTimeImmutable(),
            openingFloat: (string) $session->opening_float,
            openingDenominations: is_array($session->opening_denominations) ? $session->opening_denominations : null,
            closingCashCounted: $session->closing_cash_counted !== null ? (string) $session->closing_cash_counted : null,
            closingDenominations: is_array($session->closing_denominations) ? $session->closing_denominations : null,
            systemExpectedCash: (string) $session->system_expected_cash,
            discrepancy: $session->discrepancy !== null ? (string) $session->discrepancy : null,
            notes: $session->notes,
            zReportSnapshot: is_array($session->z_report_snapshot) ? $session->z_report_snapshot : null,
        );
    }
}

