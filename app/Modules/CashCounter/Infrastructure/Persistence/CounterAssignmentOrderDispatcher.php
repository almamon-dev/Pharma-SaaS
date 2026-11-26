<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Infrastructure\Persistence;

use App\Modules\CashCounter\Application\Ports\UnassignedOrderDispatcher;
use App\Services\CounterAssignmentService;

final class CounterAssignmentOrderDispatcher implements UnassignedOrderDispatcher
{
    public function __construct(
        private readonly CounterAssignmentService $assignmentService,
    ) {}

    public function dispatchForBranch(int $tenantId, int $branchId): void
    {
        $this->assignmentService->processUnassignedQueue($tenantId, $branchId);
    }
}

