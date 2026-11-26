<?php

declare(strict_types=1);

namespace App\Modules\Sales\Application\Ports;

interface SalesEventPublisher
{
    public function publishOrderCompleted(int $saleId): void;
}

