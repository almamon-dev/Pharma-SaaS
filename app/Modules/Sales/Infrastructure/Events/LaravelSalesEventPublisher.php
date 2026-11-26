<?php

declare(strict_types=1);

namespace App\Modules\Sales\Infrastructure\Events;

use App\Events\SalesOrderCompleted;
use App\Models\Sale;
use App\Modules\Sales\Application\Ports\SalesEventPublisher;

final class LaravelSalesEventPublisher implements SalesEventPublisher
{
    public function publishOrderCompleted(int $saleId): void
    {
        $sale = Sale::query()->find($saleId);
        if ($sale !== null) {
            event(new SalesOrderCompleted($sale));
        }
    }
}

