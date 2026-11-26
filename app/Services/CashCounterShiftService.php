<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Branch;
use App\Models\Counter;
use App\Models\CounterCashMovement;
use App\Models\CounterSession;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\CashCounter\Application\CashCounterShiftWorkflow;
use App\Modules\CashCounter\Application\DTO\CloseShiftCommand;
use App\Modules\CashCounter\Application\DTO\OpenShiftCommand;
use App\Modules\CashCounter\Application\DTO\RecordCashMovementCommand;
use App\Modules\CashCounter\Application\Ports\ShiftSessionRepository;
use App\Modules\CashCounter\Domain\CashCounterProblem;
use App\Modules\CashCounter\Domain\ShiftPeriod;
use Illuminate\Validation\ValidationException;

/**
 * Backward-compatible facade delegating all shift logic to the Clean Architecture
 * `App\Modules\CashCounter\Application\CashCounterShiftWorkflow`.
 */
class CashCounterShiftService
{
    public function __construct(
        private readonly CashCounterShiftWorkflow $workflow,
        private readonly ShiftSessionRepository $sessions,
    ) {}

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
        try {
            $snapshot = $this->workflow->openShift(new OpenShiftCommand(
                tenantId: (int) $tenant->id,
                branchId: (int) $branch->id,
                counterId: (int) $counter->id,
                cashierId: (int) $cashier->id,
                cashierName: (string) $cashier->name,
                openingFloat: $openingFloat,
                shift: $shift,
                notes: $notes,
                autoSeated: $autoSeated,
                openingDenominations: $openingDenominations,
                currencyCode: (string) ($tenant->currency_code ?? 'BDT'),
            ));
        } catch (CashCounterProblem $problem) {
            throw ValidationException::withMessages([$problem->field => [$problem->getMessage()]]);
        }

        return CounterSession::query()->with(['counter', 'user'])->findOrFail($snapshot->id);
    }

    public function autoOpenShift(
        Tenant $tenant,
        Branch $branch,
        User $cashier,
        string|int|float $openingFloat = 0,
        ?string $shift = null,
        ?string $notes = null
    ): CounterSession {
        try {
            $snapshot = $this->workflow->autoOpenShift(
                tenantId: (int) $tenant->id,
                branchId: (int) $branch->id,
                cashierId: (int) $cashier->id,
                cashierName: (string) $cashier->name,
                openingFloat: $openingFloat,
                shift: $shift,
                notes: $notes,
                currencyCode: (string) ($tenant->currency_code ?? 'BDT'),
            );
        } catch (CashCounterProblem $problem) {
            throw ValidationException::withMessages([$problem->field => [$problem->getMessage()]]);
        }

        return CounterSession::query()->with(['counter', 'user'])->findOrFail($snapshot->id);
    }

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
        try {
            $result = $this->workflow->recordCashMovement(new RecordCashMovementCommand(
                counterId: (int) $counter->id,
                counterCode: (string) $counter->code,
                actorId: (int) $actor->id,
                actorName: (string) $actor->name,
                type: $type,
                amount: $amount,
                reason: $reason,
                referenceNumber: $referenceNumber,
                notes: $notes,
                canOverrideOwnership: $canOverrideOwnership,
            ));
        } catch (CashCounterProblem $problem) {
            throw ValidationException::withMessages([$problem->field => [$problem->getMessage()]]);
        }

        return CounterCashMovement::query()->findOrFail($result['movement_id']);
    }

    /**
     * @return array<string, mixed>
     */
    public function calculateLiveDrawerSummary(CounterSession $session): array
    {
        return $this->workflow->calculateLiveDrawerSummary(
            $this->sessions->findById((int) $session->id)
        );
    }

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
        try {
            $closed = $this->workflow->closeShift(new CloseShiftCommand(
                counterId: (int) $counter->id,
                actorId: (int) $actor->id,
                actorName: (string) $actor->name,
                closingCashCounted: $closingCashCounted,
                closingDenominations: $denominations,
                notes: $notes,
                canOverrideOwnership: $canOverrideOwnership,
                isForceClose: $isForceClose,
                forceCloseReason: $forceCloseReason,
            ));
        } catch (CashCounterProblem $problem) {
            throw ValidationException::withMessages([$problem->field => [$problem->getMessage()]]);
        }

        return $closed ? CounterSession::query()->with(['counter', 'user', 'closedBy'])->findOrFail($closed->id) : null;
    }

    /**
     * @return array<string, mixed>
     */
    public function getReportPayload(CounterSession $session): array
    {
        return $this->workflow->getReportPayload(
            $this->sessions->findById((int) $session->id)
        );
    }

    public function detectCurrentShift(): string
    {
        return ShiftPeriod::detectFromHour(now()->hour)->value;
    }
}
