<?php

namespace App\Modules\Catalog\Contracts;

use App\Modules\Catalog\Models\Product;

interface StockInfoProvider
{
    /**
     * Provide branch stock, batch counts, and pricing extras for search responses.
     *
     * @return array<string, mixed>|null
     */
    public function getExtras(Product $product, ?int $branchId = null): ?array;
}

