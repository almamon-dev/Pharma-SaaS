<?php

declare(strict_types=1);

namespace App\Modules\Sales\Application\Ports;

use DateTimeImmutable;

interface CounterQueuePort
{
    public function completeAssignment(int $saleId, int $cashierId, DateTimeImmutable $completedAt): void;

    public function cancelAssignment(int $saleId, string $reason, DateTimeImmutable $cancelledAt): void;

    public function recordShiftSaleTally(
        ?int $counterSessionId,
        float $totalSalesAmount,
        float $netCashAmount,
    ): void;

    public function processUnassignedQueue(int $tenantId, int $branchId): void;
}

