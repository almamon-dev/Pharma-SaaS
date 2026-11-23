<?php

namespace App\Modules\Catalog\Contracts;

use App\Modules\Catalog\Models\Product;

interface ProductReferenceChecker
{
    /**
     * Determine if a product is referenced in batches, purchases, sales, or stock movements.
     */
    public function isReferenced(Product $product): bool;

    /**
     * Determine if a specific product unit conversion is referenced in historical transactions.
     */
    public function isUnitReferenced(Product $product, string $unitName): bool;
}

