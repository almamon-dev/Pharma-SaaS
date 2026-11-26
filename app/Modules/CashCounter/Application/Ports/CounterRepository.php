<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Application\Ports;

use App\Modules\CashCounter\Application\DTO\CounterSnapshot;

interface CounterRepository
{
    public function lockForUpdate(int $tenantId, int $counterId): CounterSnapshot;

    public function findBestAvailableCounterForCashier(int $tenantId, int $branchId, int $cashierId): ?CounterSnapshot;

    public function markActive(int $counterId, int $cashierId): void;

    public function markClosed(int $counterId): void;
}

