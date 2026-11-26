<?php

declare(strict_types=1);

namespace App\Modules\Sales\Application\Ports;

interface StockAllocationPort
{
    /**
     * Atomically verify and deduct FEFO stock for all line items on a sales order.
     */
    public function deductFefoForOrder(int $saleId, int $branchId, int $actorId): void;
}

