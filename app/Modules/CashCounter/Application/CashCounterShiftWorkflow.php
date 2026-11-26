<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Application;

use App\Modules\CashCounter\Application\DTO\CloseShiftCommand;
use App\Modules\CashCounter\Application\DTO\OpenShiftCommand;
use App\Modules\CashCounter\Application\DTO\RecordCashMovementCommand;
use App\Modules\CashCounter\Application\DTO\ShiftSessionSnapshot;
use App\Modules\CashCounter\Application\Ports\CounterRepository;
use App\Modules\CashCounter\Application\Ports\ShiftSessionRepository;
use App\Modules\CashCounter\Application\Ports\UnassignedOrderDispatcher;
use App\Modules\CashCounter\Domain\CashCounterProblem;
use App\Modules\CashCounter\Domain\CashMovementType;
use App\Modules\CashCounter\Domain\DenominationCount;
use App\Modules\CashCounter\Domain\DrawerReconciliation;
use App\Modules\CashCounter\Domain\ShiftPeriod;
use App\Modules\Foundation\Application\Ports\AuditLogger;
use App\Modules\Foundation\Application\Ports\SequenceNumberGenerator;
use DateTimeImmutable;
use PharmaCore\Foundation\Application\Clock;
use PharmaCore\Foundation\Application\TransactionManager;
use PharmaCore\Foundation\Domain\Money;

/**
 * Pure framework-free Application Workflow for Cash Counter Shift lifecycle.
 */
final class CashCounterShiftWorkflow
{
    public function __construct(
        private readonly CounterRepository $counters,
        private readonly ShiftSessionRepository $sessions,
        private readonly UnassignedOrderDispatcher $orderDispatcher,
        private readonly TransactionManager $transactions,
        private readonly AuditLogger $auditLogger,
        private readonly SequenceNumberGenerator $sequenceGenerator,
        private readonly Clock $clock,
    ) {}

    public function openShift(OpenShiftCommand $command): ShiftSessionSnapshot
    {
        $openingDenoms = null;
        $openingMoney = Money::fromDecimal($command->openingFloat, $command->currencyCode);

        if (! empty($command->openingDenominations)) {
            $denomCount = DenominationCount::fromArray($command->openingDenominations, $command->currencyCode);
            $openingDenoms = $denomCount->toArray();
            if ($openingMoney->isZero() && $denomCount->total->isPositive()) {
                $openingMoney = $denomCount->total;
            }
        }

        if ($openingMoney->isNegative()) {
            throw CashCounterProblem::negativeOpeningFloat();
        }

        $now = $this->clock->now();
        $resolvedShift = $command->shift ?: ShiftPeriod::detectFromHour((int) $now->format('G'))->value;

        /** @var ShiftSessionSnapshot $session */
        $session = $this->transactions->run(function () use (
            $command,
            $openingMoney,
            $openingDenoms,
            $resolvedShift,
            $now
        ): ShiftSessionSnapshot {
            $counter = $this->counters->lockForUpdate($command->tenantId, $command->counterId);

            if (! $counter->isActive) {
                throw CashCounterProblem::counterInactive($counter->code);
            }

            // Rule 1: One open shift per cashier
            $existingUserSession = $this->sessions->findOpenByUserForUpdate($command->tenantId, $command->cashierId);
            if ($existingUserSession !== null && $existingUserSession->counterId !== $counter->id) {
                throw CashCounterProblem::cashierAlreadyHasOpenShift($existingUserSession->counterCode);
            }

            // Rule 2: One active cashier per counter
            $existingCounterSession = $this->sessions->findOpenByCounterForUpdate($command->tenantId, $counter->id);
            if ($existingCounterSession !== null && $existingCounterSession->cashierId !== $command->cashierId) {
                throw CashCounterProblem::counterOccupied($counter->code, $existingCounterSession->cashierName);
            }

            if ($counter->status === 'active' && $counter->currentUserId !== null && $counter->currentUserId !== $command->cashierId) {
                throw CashCounterProblem::counterOccupied($counter->code);
            }

            $openingFloatDecimal = $openingMoney->toDecimalString();

            $session = $existingCounterSession ?? $this->sessions->createOpenSession(
                tenantId: $command->tenantId,
                branchId: $command->branchId,
                counterId: $counter->id,
                cashierId: $command->cashierId,
                shift: $resolvedShift,
                openedAt: $now,
                openingFloat: $openingFloatDecimal,
                openingDenominations: $openingDenoms,
                notes: $command->notes,
            );

            $this->counters->markActive($counter->id, $command->cashierId);

            $this->auditLogger->record(
                action: 'counter.shift_opened',
                description: "Cashier {$command->cashierName} opened {$resolvedShift} shift on Counter {$counter->code} with opening float {$openingFloatDecimal}.",
                subjectType: 'App\\Models\\Counter',
                subjectId: $counter->id,
                metadata: [
                    'counter_id' => $counter->id,
                    'counter_session_id' => $session->id,
                    'opening_float' => $openingFloatDecimal,
                    'opening_denominations' => $openingDenoms,
                    'shift' => $resolvedShift,
                    'auto_seated' => $command->autoSeated,
                ],
                tenantId: $command->tenantId,
                userId: $command->cashierId,
            );

            return $this->sessions->findById($session->id);
        });

        $this->orderDispatcher->dispatchForBranch($command->tenantId, $command->branchId);

        return $session;
    }

    public function autoOpenShift(
        int $tenantId,
        int $branchId,
        int $cashierId,
        string $cashierName,
        string|int|float $openingFloat = 0,
        ?string $shift = null,
        ?string $notes = null,
        string $currencyCode = 'BDT',
    ): ShiftSessionSnapshot {
        $existing = $this->sessions->findOpenByUser($tenantId, $cashierId);
        if ($existing !== null) {
            $this->counters->markActive($existing->counterId, $cashierId);

            return $existing;
        }

        $counter = $this->counters->findBestAvailableCounterForCashier($tenantId, $branchId, $cashierId);
        if ($counter === null) {
            throw CashCounterProblem::noAvailableCounter();
        }

        return $this->openShift(new OpenShiftCommand(
            tenantId: $tenantId,
            branchId: $branchId,
            counterId: $counter->id,
            cashierId: $cashierId,
            cashierName: $cashierName,
            openingFloat: $openingFloat,
            shift: $shift,
            notes: $notes ?: 'Started from Cashier Station',
            autoSeated: true,
            currencyCode: $currencyCode,
        ));
    }

    /**
     * @return array{movement_id: int, type: string, amount: string, expected_cash: string}
     */
    public function recordCashMovement(RecordCashMovementCommand $command): array
    {
        $movementType = CashMovementType::tryFrom($command->type);
        if ($movementType === null) {
            throw CashCounterProblem::invalidMovementType();
        }

        $amount = Money::fromDecimal($command->amount, $command->currencyCode);
        if (! $amount->isPositive()) {
            throw CashCounterProblem::nonPositiveMovementAmount();
        }

        $trimmedReason = trim($command->reason);
        if ($trimmedReason === '') {
            throw CashCounterProblem::movementReasonRequired();
        }

        $now = $this->clock->now();

        /** @var array{movement_id: int, type: string, amount: string, expected_cash: string} */
        return $this->transactions->run(function () use ($command, $movementType, $amount, $trimmedReason, $now): array {
            $session = $this->sessions->findOpenByCounterForUpdate(0, $command->counterId);
            if ($session === null) {
                throw CashCounterProblem::noOpenShiftOnCounter($command->counterCode);
            }

            if (! $command->canOverrideOwnership && $session->cashierId !== $command->actorId) {
                throw CashCounterProblem::ownershipRequiredForMovement();
            }

            $amountDecimal = $amount->toDecimalString();
            $approvedById = $command->canOverrideOwnership && $session->cashierId !== $command->actorId
                ? $command->actorId
                : null;

            $movementId = $this->sessions->createCashMovement(
                tenantId: $session->tenantId,
                branchId: $session->branchId,
                counterId: $command->counterId,
                sessionId: $session->id,
                actorId: $command->actorId,
                approvedById: $approvedById,
                type: $movementType->value,
                amount: $amountDecimal,
                reason: $trimmedReason,
                referenceNumber: $command->referenceNumber !== null ? trim($command->referenceNumber) : null,
                notes: $command->notes !== null ? trim($command->notes) : null,
                occurredAt: $now,
            );

            $summary = $this->calculateLiveDrawerSummary($session);
            $this->sessions->updateOpenTotals($session->id, [
                'cash_sales_total' => $summary['cash_sales'],
                'card_sales_total' => $summary['card_sales'],
                'mobile_sales_total' => $summary['mobile_sales'],
                'cash_in_total' => $summary['cash_in'],
                'cash_out_total' => $summary['cash_out_total'],
                'cash_refunds_total' => $summary['cash_refunds'],
                'system_expected_cash' => $summary['expected_cash'],
            ]);

            $this->auditLogger->record(
                action: "counter.{$movementType->value}",
                description: "{$command->actorName} recorded {$movementType->label()} of {$amountDecimal} on Counter {$command->counterCode}. Reason: {$trimmedReason}",
                subjectType: 'App\\Models\\CounterCashMovement',
                subjectId: $movementId,
                metadata: [
                    'counter_id' => $command->counterId,
                    'counter_session_id' => $session->id,
                    'type' => $movementType->value,
                    'amount' => $amountDecimal,
                    'reason' => $trimmedReason,
                    'reference_number' => $command->referenceNumber !== null ? trim($command->referenceNumber) : null,
                    'system_expected_cash_after' => $summary['expected_cash'],
                ],
                tenantId: $session->tenantId,
                userId: $command->actorId,
            );

            return [
                'movement_id' => $movementId,
                'type' => $movementType->value,
                'amount' => $amountDecimal,
                'expected_cash' => $summary['expected_cash'],
            ];
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function calculateLiveDrawerSummary(ShiftSessionSnapshot $session): array
    {
        $now = $this->clock->now();
        $currency = $session->currencyCode;
        $raw = $this->sessions->collectLiveDrawerData($session->id, $now);

        $reconciliation = new DrawerReconciliation(
            openingFloat: Money::fromDecimal($session->openingFloat, $currency),
            cashSales: Money::fromMinorUnits($raw['cash_sales_paisa'], $currency),
            cardSales: Money::fromMinorUnits($raw['card_sales_paisa'], $currency),
            mobileSales: Money::fromMinorUnits($raw['mobile_sales_paisa'], $currency),
            cashIn: Money::fromMinorUnits($raw['cash_in_paisa'], $currency),
            cashOutOnly: Money::fromMinorUnits($raw['cash_out_only_paisa'], $currency),
            safeDrop: Money::fromMinorUnits($raw['safe_drop_paisa'], $currency),
            cashRefunds: Money::fromMinorUnits($raw['cash_refunds_paisa'], $currency),
        );

        $totalSales = Money::fromMinorUnits($raw['total_sales_paisa'], $currency);

        return [
            'opening_float_paisa' => $reconciliation->openingFloat->minorUnits,
            'cash_sales_paisa' => $reconciliation->cashSales->minorUnits,
            'card_sales_paisa' => $reconciliation->cardSales->minorUnits,
            'mobile_sales_paisa' => $reconciliation->mobileSales->minorUnits,
            'total_collected_paisa' => $reconciliation->totalCollected()->minorUnits,
            'total_sales_paisa' => $totalSales->minorUnits,
            'cash_in_paisa' => $reconciliation->cashIn->minorUnits,
            'cash_out_only_paisa' => $reconciliation->cashOutOnly->minorUnits,
            'safe_drop_paisa' => $reconciliation->safeDrop->minorUnits,
            'cash_out_total_paisa' => $reconciliation->cashOutTotal->minorUnits,
            'cash_refunds_paisa' => $reconciliation->cashRefunds->minorUnits,
            'expected_cash_paisa' => $reconciliation->expectedCash->minorUnits,
            'opening_float' => $reconciliation->openingFloat->toDecimalString(),
            'cash_sales' => $reconciliation->cashSales->toDecimalString(),
            'card_sales' => $reconciliation->cardSales->toDecimalString(),
            'mobile_sales' => $reconciliation->mobileSales->toDecimalString(),
            'total_collected' => $reconciliation->totalCollected()->toDecimalString(),
            'total_sales' => $totalSales->toDecimalString(),
            'cash_in' => $reconciliation->cashIn->toDecimalString(),
            'cash_out_only' => $reconciliation->cashOutOnly->toDecimalString(),
            'safe_drop' => $reconciliation->safeDrop->toDecimalString(),
            'cash_out_total' => $reconciliation->cashOutTotal->toDecimalString(),
            'cash_refunds' => $reconciliation->cashRefunds->toDecimalString(),
            'expected_cash' => $reconciliation->expectedCash->toDecimalString(),
            'total_transactions' => $raw['total_transactions'],
            'break_count' => $raw['break_count'],
            'total_break_minutes' => $raw['total_break_minutes'],
            'breaks' => $raw['breaks'],
            'movements' => $raw['movements'],
        ];
    }

    public function closeShift(CloseShiftCommand $command): ?ShiftSessionSnapshot
    {
        if ($command->isForceClose && trim((string) $command->forceCloseReason) === '') {
            throw CashCounterProblem::forceCloseReasonRequired();
        }

        $countedMoney = null;
        if ($command->closingCashCounted !== null) {
            $countedMoney = Money::fromDecimal($command->closingCashCounted, $command->currencyCode);
            if ($countedMoney->isNegative()) {
                throw CashCounterProblem::negativeCountedCash();
            }
        }

        $normalizedDenominations = null;
        if (! empty($command->closingDenominations)) {
            $normalizedDenominations = DenominationCount::fromArray(
                $command->closingDenominations,
                $command->currencyCode,
            )->toArray();
        }

        $closedAt = $this->clock->now();

        /** @var ShiftSessionSnapshot|null */
        return $this->transactions->run(function () use (
            $command,
            $countedMoney,
            $normalizedDenominations,
            $closedAt
        ): ?ShiftSessionSnapshot {
            $counter = $this->counters->lockForUpdate(0, $command->counterId);
            $session = $this->sessions->findOpenByCounterForUpdate($counter->tenantId, $counter->id);

            if ($session === null) {
                $this->counters->markClosed($counter->id);

                return null;
            }

            if (! $command->canOverrideOwnership && $session->cashierId !== $command->actorId) {
                throw CashCounterProblem::ownershipRequiredForClose();
            }

            $this->sessions->closeOpenBreaks($session->id, $closedAt);

            $summary = $this->calculateLiveDrawerSummary($session);
            $currency = $session->currencyCode;
            $expectedMoney = Money::fromMinorUnits((int) $summary['expected_cash_paisa'], $currency);
            $resolvedCounted = $countedMoney ?? $expectedMoney;

            $finalReconciliation = new DrawerReconciliation(
                openingFloat: Money::fromMinorUnits((int) $summary['opening_float_paisa'], $currency),
                cashSales: Money::fromMinorUnits((int) $summary['cash_sales_paisa'], $currency),
                cardSales: Money::fromMinorUnits((int) $summary['card_sales_paisa'], $currency),
                mobileSales: Money::fromMinorUnits((int) $summary['mobile_sales_paisa'], $currency),
                cashIn: Money::fromMinorUnits((int) $summary['cash_in_paisa'], $currency),
                cashOutOnly: Money::fromMinorUnits((int) $summary['cash_out_only_paisa'], $currency),
                safeDrop: Money::fromMinorUnits((int) $summary['safe_drop_paisa'], $currency),
                cashRefunds: Money::fromMinorUnits((int) $summary['cash_refunds_paisa'], $currency),
                countedCash: $resolvedCounted,
            );

            $effectiveReason = trim((string) ($command->notes ?: $command->forceCloseReason ?: ''));
            if ($finalReconciliation->hasDiscrepancy() && $effectiveReason === '') {
                throw CashCounterProblem::discrepancyReasonRequired();
            }

            $countedDecimal = $resolvedCounted->toDecimalString();
            $expectedDecimal = $finalReconciliation->expectedCash->toDecimalString();
            $discrepancyDecimal = $finalReconciliation->discrepancy?->toDecimalString() ?? '0.00';

            $zReportNumber = $this->sequenceGenerator->nextNumber(
                tenantId: $session->tenantId,
                branchId: null,
                docType: 'z_report',
                defaultPrefix: 'ZR',
                padding: 6,
            );

            $durationMinutes = $this->diffMinutes($session->openedAt, $closedAt);
            $trimmedForceReason = $command->isForceClose ? trim((string) $command->forceCloseReason) : null;
            $trimmedNotes = $command->notes !== null && trim($command->notes) !== ''
                ? trim($command->notes)
                : ($trimmedForceReason ?: $session->notes);

            $zReportSnapshot = [
                'report_type' => 'Z-REPORT',
                'z_report_number' => $zReportNumber,
                'session_id' => $session->id,
                'status' => 'closed',
                'is_force_closed' => $command->isForceClose,
                'force_close_reason' => $trimmedForceReason,
                'generated_at' => $closedAt->format('d M Y, h:i A'),
                'tenant' => [
                    'name' => $session->tenantName,
                    'currency' => $currency,
                ],
                'branch' => [
                    'name' => $session->branchName,
                    'address' => $session->branchAddress,
                    'phone' => $session->branchPhone,
                ],
                'counter' => [
                    'id' => $counter->id,
                    'code' => $counter->code,
                    'name' => $counter->name,
                    'zone' => $counter->zone,
                ],
                'shift' => $session->shift,
                'cashier' => [
                    'id' => $session->cashierId,
                    'name' => $session->cashierName,
                ],
                'closed_by' => [
                    'id' => $command->actorId,
                    'name' => $command->actorName,
                ],
                'opened_at' => $session->openedAt?->format('d M Y, h:i A'),
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
                    'discrepancy_status' => $finalReconciliation->discrepancyStatus,
                ],
                'opening_denominations' => $session->openingDenominations,
                'denominations' => $normalizedDenominations,
                'breaks' => $summary['breaks'],
                'total_break_minutes' => $summary['total_break_minutes'],
                'movements' => $summary['movements'],
                'notes' => $trimmedNotes,
            ];

            $closedSession = $this->sessions->finalizeClosedSession($session->id, [
                'status' => 'closed',
                'closed_at' => $closedAt,
                'closed_by' => $command->actorId,
                'is_force_closed' => $command->isForceClose,
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

            $this->counters->markClosed($counter->id);

            $this->auditLogger->record(
                action: $command->isForceClose ? 'counter.shift_force_closed' : 'counter.shift_closed',
                description: $command->isForceClose
                    ? "Supervisor {$command->actorName} force-closed shift on Counter {$counter->code} ({$zReportNumber}). Reason: {$trimmedForceReason}. Expected: {$expectedDecimal}, Counted: {$countedDecimal}, Discrepancy: {$discrepancyDecimal}."
                    : "{$command->actorName} closed shift on Counter {$counter->code} ({$zReportNumber}). Expected: {$expectedDecimal}, Counted: {$countedDecimal}, Discrepancy: {$discrepancyDecimal}.",
                subjectType: 'App\\Models\\CounterSession',
                subjectId: $session->id,
                metadata: [
                    'z_report_number' => $zReportNumber,
                    'counter_id' => $counter->id,
                    'is_force_closed' => $command->isForceClose,
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
                tenantId: $session->tenantId,
                userId: $command->actorId,
            );

            return $closedSession;
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function getReportPayload(ShiftSessionSnapshot $session): array
    {
        if ($session->status === 'closed' && $session->zReportSnapshot !== null) {
            return $session->zReportSnapshot;
        }

        $now = $this->clock->now();
        $summary = $this->calculateLiveDrawerSummary($session);
        $durationMinutes = $this->diffMinutes($session->openedAt, $session->closedAt ?? $now);

        $counted = $session->closingCashCounted !== null ? (float) $session->closingCashCounted : null;
        $discrepancy = $session->discrepancy !== null ? (float) $session->discrepancy : 0.0;

        return [
            'report_type' => $session->status === 'closed' ? 'Z-REPORT' : 'X-REPORT (LIVE)',
            'z_report_number' => $session->zReportNumber ?? 'LIVE-SHIFT-'.$session->id,
            'session_id' => $session->id,
            'status' => $session->status,
            'is_force_closed' => $session->isForceClosed,
            'force_close_reason' => $session->forceCloseReason,
            'generated_at' => $now->format('d M Y, h:i A'),
            'tenant' => [
                'name' => $session->tenantName,
                'currency' => $session->currencyCode,
            ],
            'branch' => [
                'name' => $session->branchName,
                'address' => $session->branchAddress,
                'phone' => $session->branchPhone,
            ],
            'counter' => [
                'id' => $session->counterId,
                'code' => $session->counterCode,
                'name' => $session->counterName,
                'zone' => $session->counterZone,
            ],
            'shift' => $session->shift,
            'cashier' => [
                'id' => $session->cashierId,
                'name' => $session->cashierName,
            ],
            'closed_by' => $session->closedById !== null ? [
                'id' => $session->closedById,
                'name' => $session->closedByName ?? 'Supervisor',
            ] : null,
            'opened_at' => $session->openedAt?->format('d M Y, h:i A'),
            'closed_at' => $session->closedAt?->format('d M Y, h:i A'),
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
            'opening_denominations' => $session->openingDenominations,
            'denominations' => $session->closingDenominations,
            'breaks' => $summary['breaks'],
            'total_break_minutes' => $summary['total_break_minutes'],
            'movements' => $summary['movements'],
            'notes' => $session->notes,
        ];
    }

    private function diffMinutes(?DateTimeImmutable $start, DateTimeImmutable $end): int
    {
        if ($start === null) {
            return 0;
        }

        $seconds = max(0, $end->getTimestamp() - $start->getTimestamp());

        return max(1, (int) intdiv($seconds, 60));
    }
}

