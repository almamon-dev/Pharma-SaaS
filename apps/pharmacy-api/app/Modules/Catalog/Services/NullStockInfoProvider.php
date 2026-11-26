<?php

namespace App\Modules\Catalog\Services;

use App\Modules\Catalog\Contracts\StockInfoProvider;
use App\Modules\Catalog\Models\Product;

class NullStockInfoProvider implements StockInfoProvider
{
    /**
     * In Phase 3, stock and batches are out of scope. Returns null.
     */
    public function getExtras(Product $product, ?int $branchId = null): ?array
    {
        return null;
    }
}

