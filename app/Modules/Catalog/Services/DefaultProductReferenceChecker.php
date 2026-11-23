<?php

namespace App\Modules\Catalog\Services;

use App\Modules\Catalog\Contracts\ProductReferenceChecker;
use App\Modules\Catalog\Models\Product;

class DefaultProductReferenceChecker implements ProductReferenceChecker
{
    /**
     * In Phase 3, no batches or sales exist for catalog products yet.
     * Later phases (4 & 5) hook into this to check batches, purchases, and invoices.
     */
    public function isReferenced(Product $product): bool
    {
        return false;
    }

    public function isUnitReferenced(Product $product, string $unitName): bool
    {
        return false;
    }
}

