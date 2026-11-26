<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Application\Ports;

interface UnassignedOrderDispatcher
{
    public function dispatchForBranch(int $tenantId, int $branchId): void;
}

