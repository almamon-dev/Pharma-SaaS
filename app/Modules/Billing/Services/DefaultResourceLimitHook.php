<?php

namespace App\Modules\Billing\Services;

use App\Models\Tenant;
use App\Modules\Billing\Contracts\ResourceLimitHook;

class DefaultResourceLimitHook implements ResourceLimitHook
{
    public function __construct(
        protected FeatureManager $featureManager
    ) {}

    public function assertCanCreateProduct(Tenant $tenant, int $quantity = 1): void
    {
        $this->featureManager->setTenant($tenant)->assertCanUse('max_products', $quantity);
    }

    public function assertCanCreateBill(Tenant $tenant, int $quantity = 1): void
    {
        $this->featureManager->setTenant($tenant)->assertCanUse('max_bills_month', $quantity);
    }
}

