<?php

namespace App\Modules\Billing\Events;

use App\Modules\Billing\Models\Subscription;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PlanChanged
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly int $tenantId,
        public readonly Subscription $subscription,
        public readonly ?int $oldPlanId = null,
        public readonly int $newPlanId = 0
    ) {}
}

