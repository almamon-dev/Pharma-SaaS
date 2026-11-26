<?php

declare(strict_types=1);

namespace App\Modules\Sales\Domain;

use PharmaCore\Foundation\Domain\DomainProblem;

final class SalesProblem extends DomainProblem
{
    public static function cannotAccept(string $orderNumber, string $currentStatus): self
    {
        return new self(
            'ORDER_CANNOT_ACCEPT',
            "Order #{$orderNumber} is currently {$currentStatus} and cannot be accepted.",
            422,
            'order',
        );
    }

    public static function alreadyPaid(string $orderNumber): self
    {
        return new self(
            'ORDER_ALREADY_PAID',
            "Order #{$orderNumber} has already been paid and completed.",
            422,
            'order',
        );
    }

    public static function cannotCancelCompleted(): self
    {
        return new self(
            'ORDER_CANNOT_CANCEL_COMPLETED',
            'Paid/Completed orders cannot be cancelled directly without refund processing.',
            422,
            'order',
        );
    }

    public static function notADraft(string $orderNumber): self
    {
        return new self(
            'ORDER_NOT_A_DRAFT',
            "Order #{$orderNumber} is not a draft and cannot be deleted.",
            422,
            'order',
        );
    }

    public static function missingPayments(): self
    {
        return new self(
            'MISSING_PAYMENTS',
            'At least one valid payment amount is required.',
            422,
            'payments',
        );
    }

    public static function insufficientStock(string $medicineName, int $requested, int $available): self
    {
        return new self(
            'INSUFFICIENT_STOCK',
            "Insufficient unexpired stock for {$medicineName}. Requested: {$requested}, Available: {$available}.",
            422,
            'stock',
        );
    }
}

