<?php

declare(strict_types=1);

namespace App\Modules\Sales\Application\Ports;

interface CustomerLoyaltyPort
{
    public function awardPoints(int $customerId, int $points): void;
}

