<?php

declare(strict_types=1);

namespace App\Modules\Sales\Infrastructure\Persistence;

use App\Models\Customer;
use App\Modules\Sales\Application\Ports\CustomerLoyaltyPort;

final class EloquentCustomerLoyaltyAdapter implements CustomerLoyaltyPort
{
    public function awardPoints(int $customerId, int $points): void
    {
        if ($points <= 0) {
            return;
        }

        Customer::query()
            ->where('id', $customerId)
            ->increment('loyalty_points', $points);
    }
}

