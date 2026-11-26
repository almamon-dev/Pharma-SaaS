<?php

namespace App\Modules\Billing\Contracts;

use App\Models\Tenant;

/**
 * Interface for modules to hook into tenant plan limit assertions.
 *
 * Example implementation in Phase 3 (Catalog):
 *   app(ResourceLimitHook::class)->assertCanCreateProduct($tenant);
 *
 * Example implementation in Phase 5 (Sales / POS):
 *   app(ResourceLimitHook::class)->assertCanCreateBill($tenant);
 */
interface ResourceLimitHook
{
    /**
     * Enforce max_products limit before creating medicine/product.
     */
    public function assertCanCreateProduct(Tenant $tenant, int $quantity = 1): void;

    /**
     * Enforce max_bills_month limit before creating POS bill.
     */
    public function assertCanCreateBill(Tenant $tenant, int $quantity = 1): void;
}

