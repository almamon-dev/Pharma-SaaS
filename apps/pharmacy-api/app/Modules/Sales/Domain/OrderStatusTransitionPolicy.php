<?php

declare(strict_types=1);

namespace App\Modules\Sales\Domain;

/**
 * Pure domain guard for sales order lifecycle transitions.
 */
final class OrderStatusTransitionPolicy
{
    public function assertCanAccept(string $orderNumber, string $currentStatus): void
    {
        if (! in_array($currentStatus, ['assigned', 'waiting'], true)) {
            throw SalesProblem::cannotAccept($orderNumber, $currentStatus);
        }
    }

    public function assertCanPay(string $orderNumber, string $currentStatus): void
    {
        if (in_array($currentStatus, ['paid', 'completed'], true)) {
            throw SalesProblem::alreadyPaid($orderNumber);
        }
    }

    public function assertCanCancel(string $currentStatus): void
    {
        if (in_array($currentStatus, ['completed', 'paid'], true)) {
            throw SalesProblem::cannotCancelCompleted();
        }
    }

    public function assertCanDeleteDraft(string $orderNumber, string $currentStatus): void
    {
        if ($currentStatus !== 'draft') {
            throw SalesProblem::notADraft($orderNumber);
        }
    }
}

