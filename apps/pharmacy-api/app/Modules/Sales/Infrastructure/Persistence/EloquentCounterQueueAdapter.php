<?php

declare(strict_types=1);

namespace App\Modules\Sales\Infrastructure\Persistence;

use App\Models\CounterAssignment;
use App\Models\CounterSession;
use App\Modules\Sales\Application\Ports\CounterQueuePort;
use App\Services\CounterAssignmentService;
use DateTimeImmutable;

final class EloquentCounterQueueAdapter implements CounterQueuePort
{
    public function __construct(
        private readonly CounterAssignmentService $assignmentService,
    ) {}

    public function completeAssignment(int $saleId, int $cashierId, DateTimeImmutable $completedAt): void
    {
        CounterAssignment::query()
            ->where('sale_id', $saleId)
            ->where('status', 'active')
            ->update([
                'status' => 'completed',
                'completed_at' => $completedAt,
                'cashier_id' => $cashierId,
            ]);
    }

    public function cancelAssignment(int $saleId, string $reason, DateTimeImmutable $cancelledAt): void
    {
        CounterAssignment::query()
            ->where('sale_id', $saleId)
            ->where('status', 'active')
            ->update([
                'status' => 'cancelled',
                'completed_at' => $cancelledAt,
                'notes' => $reason,
            ]);
    }

    public function recordShiftSaleTally(
        ?int $counterSessionId,
        float $totalSalesAmount,
        float $netCashAmount,
    ): void {
        if ($counterSessionId === null) {
            return;
        }

        $session = CounterSession::query()->find($counterSessionId);
        if (! $session) {
            return;
        }

        $session->increment('total_sales_amount', $totalSalesAmount);
        $session->increment('total_transactions', 1);

        if ($netCashAmount > 0.0) {
            $session->increment('system_expected_cash', $netCashAmount);
            $session->increment('cash_sales_total', $netCashAmount);
        }
    }

    public function processUnassignedQueue(int $tenantId, int $branchId): void
    {
        $this->assignmentService->processUnassignedQueue($tenantId, $branchId);
    }
}

