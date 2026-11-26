<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Domain;

use PharmaCore\Foundation\Domain\DomainProblem;

final class CashCounterProblem extends DomainProblem
{
    public static function negativeOpeningFloat(): self
    {
        return new self('NEGATIVE_OPENING_FLOAT', 'Opening cash float cannot be negative.', 422, 'opening_float');
    }

    public static function counterInactive(string $counterCode): self
    {
        return new self('COUNTER_INACTIVE', "Counter {$counterCode} is inactive and cannot open a shift.", 422, 'counter');
    }

    public static function cashierAlreadyHasOpenShift(?string $otherCounterCode): self
    {
        return new self(
            'CASHIER_ALREADY_HAS_OPEN_SHIFT',
            "You already have an active open shift on Counter {$otherCounterCode}. Please close that shift first.",
            422,
            'counter'
        );
    }

    public static function counterOccupied(string $counterCode, string $occupantName = 'another cashier'): self
    {
        return new self(
            'COUNTER_OCCUPIED',
            "Counter {$counterCode} is currently occupied by {$occupantName}.",
            422,
            'counter'
        );
    }

    public static function noAvailableCounter(): self
    {
        return new self(
            'NO_AVAILABLE_COUNTER',
            'No available counter found in this branch. All active counters are currently occupied.',
            422,
            'counter'
        );
    }

    public static function invalidMovementType(): self
    {
        return new self('INVALID_MOVEMENT_TYPE', 'Invalid cash movement type.', 422, 'type');
    }

    public static function nonPositiveMovementAmount(): self
    {
        return new self('NON_POSITIVE_AMOUNT', 'Movement amount must be greater than zero.', 422, 'amount');
    }

    public static function movementReasonRequired(): self
    {
        return new self('MOVEMENT_REASON_REQUIRED', 'A reason is required for cash drawer movements.', 422, 'reason');
    }

    public static function noOpenShiftOnCounter(string $counterCode): self
    {
        return new self(
            'NO_OPEN_SHIFT',
            "Counter {$counterCode} has no open shift. Open a shift before recording cash drawer movements.",
            422,
            'shift'
        );
    }

    public static function ownershipRequiredForMovement(): self
    {
        return new self(
            'SHIFT_OWNERSHIP_REQUIRED',
            'Only the active shift cashier or a branch manager can record cash drawer movements on this counter.',
            403,
            'shift'
        );
    }

    public static function ownershipRequiredForClose(): self
    {
        return new self(
            'SHIFT_OWNERSHIP_REQUIRED',
            'Only the active shift cashier or a branch manager can close this shift.',
            403,
            'shift'
        );
    }

    public static function negativeCountedCash(): self
    {
        return new self('NEGATIVE_COUNTED_CASH', 'Counted closing cash cannot be negative.', 422, 'closing_cash_counted');
    }

    public static function discrepancyReasonRequired(): self
    {
        return new self(
            'DISCREPANCY_REASON_REQUIRED',
            'A reason is required when there is a cash discrepancy (shortage or surplus).',
            422,
            'notes'
        );
    }

    public static function forceCloseReasonRequired(): self
    {
        return new self(
            'FORCE_CLOSE_REASON_REQUIRED',
            'A reason is required to force-close an open shift.',
            422,
            'force_close_reason'
        );
    }
}

