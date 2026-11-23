<?php

namespace App\Modules\Catalog\Services;

use App\Models\Tenant;
use App\Modules\Catalog\Contracts\StockInfoProvider;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\ProductBarcode;
use App\Modules\Catalog\Support\CatalogNormalizer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProductSearchService
{
    public function __construct(
        protected StockInfoProvider $stockInfoProvider
    ) {}

    /**
     * Fast search endpoint service.
     * Order: Exact Barcode -> Exact SKU -> Multi-token trigram/prefix search with ranking.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function search(
        int $tenantId,
        string $query,
        int $limit = 20,
        ?string $type = null,
        bool $includeInactive = false,
        ?int $branchId = null
    ): Collection {
        $limit = max(1, min(50, $limit));
        $rawQuery = trim($query);
        if ($rawQuery === '') {
            return collect();
        }

        $normalizedQuery = CatalogNormalizer::normalizeText($rawQuery);
        $cleanDigits = CatalogNormalizer::normalizeDigits($rawQuery);

        // 1. Exact Barcode Match (all barcodes, including internal) - fast indexed lookup
        if (! str_contains($rawQuery, ' ') && strlen($rawQuery) <= 30) {
            $matchedBarcode = DB::table('product_barcodes')
                ->where('tenant_id', $tenantId)
                ->where(function ($sub) use ($rawQuery, $cleanDigits) {
                    $sub->where('barcode', $rawQuery);
                    if ($cleanDigits !== '' && $cleanDigits !== $rawQuery) {
                        $sub->orWhere('barcode', $cleanDigits);
                    }
                })
                ->select('product_id')
                ->first();

            if ($matchedBarcode) {
                $barcodeMatch = Product::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->where('id', $matchedBarcode->product_id)
                    ->whereNull('deleted_at')
                    ->when(! $includeInactive, fn ($q) => $q->where('is_active', true))
                    ->when($type, fn ($q) => $q->where('type', $type))
                    ->with(['generic', 'company', 'category', 'units', 'barcodes'])
                    ->first();

                if ($barcodeMatch) {
                    return collect([$this->formatProductItem($barcodeMatch, $branchId)]);
                }
            }
        }

        // 2. Exact SKU Match - fast indexed lookup
        if (! str_contains($rawQuery, ' ') && strlen($rawQuery) <= 64) {
            $matchedSku = DB::table('products')
                ->where('tenant_id', $tenantId)
                ->whereNull('deleted_at')
                ->when(! $includeInactive, fn ($q) => $q->where('is_active', true))
                ->when($type, fn ($q) => $q->where('type', $type))
                ->where(function ($q) use ($normalizedQuery, $rawQuery) {
                    $q->where('sku', $rawQuery)
                      ->orWhere('sku', $normalizedQuery);
                })
                ->select('id')
                ->first();

            if ($matchedSku) {
                $skuMatch = Product::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->where('id', $matchedSku->id)
                    ->with(['generic', 'company', 'category', 'units', 'barcodes'])
                    ->first();

                if ($skuMatch) {
                    return collect([$this->formatProductItem($skuMatch, $branchId)]);
                }
            }
        }

        // 3. Multi-token Text Search
        $tokens = array_filter(explode(' ', $normalizedQuery), fn ($t) => trim($t) !== '');
        if (empty($tokens)) {
            return collect();
        }

        $isPgsql = DB::getDriverName() === 'pgsql';

        $buildQuery = function (bool $useTrigramFuzzy = false) use ($tenantId, $includeInactive, $type, $tokens, $isPgsql, $normalizedQuery, $rawQuery) {
            $qb = Product::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->whereNull('deleted_at')
                ->when(! $includeInactive, fn ($q) => $q->where('is_active', true))
                ->when($type, fn ($q) => $q->where('type', $type));

            foreach ($tokens as $token) {
                $tLen = mb_strlen($token);
                $qb->where(function (Builder $sub) use ($token, $tLen, $isPgsql, $useTrigramFuzzy) {
                    if ($tLen < 3) {
                        $sub->where('search_text', 'LIKE', $token.'%')
                            ->orWhere('search_text', 'LIKE', '% '.$token.'%');
                    } elseif ($useTrigramFuzzy && $isPgsql) {
                        $sub->whereRaw('search_text % ?', [$token]);
                    } else {
                        $sub->where('search_text', 'LIKE', '%'.$token.'%');
                    }
                });
            }

            $exactQ = $normalizedQuery;
            $prefixQ = $normalizedQuery.'%';
            $wordQ = '% '.$normalizedQuery.'%';
            $isBengali = (bool) preg_match('/[\x{0980}-\x{09FF}]/u', $rawQuery);

            if ($isPgsql) {
                if ($isBengali) {
                    $qb->orderByRaw(
                        "CASE 
                            WHEN name_bn = ? THEN 0
                            WHEN name_bn LIKE ? THEN 1
                            WHEN name_bn LIKE ? THEN 2
                            ELSE 3
                         END ASC",
                        [$rawQuery, $rawQuery.'%', '% '.$rawQuery.'%']
                    );
                } else {
                    $qb->orderByRaw(
                        "CASE 
                            WHEN name ILIKE ? THEN 0
                            WHEN name ILIKE ? THEN 1
                            WHEN name ILIKE ? THEN 2
                            ELSE 3
                         END ASC",
                        [$exactQ, $prefixQ, $wordQ]
                    );
                }

                $qb->orderByRaw('LENGTH(name) ASC')
                   ->orderBy('name', 'ASC');
            } else {
                $qb->orderByRaw(
                    "CASE 
                        WHEN lower(name) = ? OR lower(COALESCE(name_bn, '')) = ? THEN 0
                        WHEN lower(name) LIKE ? OR lower(COALESCE(name_bn, '')) LIKE ? THEN 1
                        WHEN lower(name) LIKE ? OR lower(COALESCE(name_bn, '')) LIKE ? THEN 2
                        ELSE 3
                     END ASC",
                    [$exactQ, $exactQ, $prefixQ, $prefixQ, $wordQ, $wordQ]
                )->orderByRaw('LENGTH(name) ASC')
                 ->orderBy('name', 'ASC');
            }

            return $qb;
        };

        // Fast path: Exact/substring match on GIN index (0.2 - 2 ms)
        $results = $buildQuery(false)
            ->with(['generic', 'company', 'category', 'units', 'barcodes'])
            ->limit($limit)
            ->get();

        // Fallback for typos: if 0 results, use fuzzy trigram % operator (e.g. Zimaax -> Zimax)
        if ($results->isEmpty() && $isPgsql && max(array_map('mb_strlen', $tokens)) >= 3) {
            $results = $buildQuery(true)
                ->with(['generic', 'company', 'category', 'units', 'barcodes'])
                ->limit($limit)
                ->get();
        }

        return $results->map(fn (Product $p) => $this->formatProductItem($p, $branchId));
    }

    /**
     * Fast direct lookup by barcode for POS barcode scanners.
     */
    public function findByBarcode(int $tenantId, string $barcode, ?int $branchId = null): ?array
    {
        $rawBarcode = trim($barcode);
        $cleanDigits = CatalogNormalizer::normalizeDigits($rawBarcode);

        $product = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->whereHas('barcodes', function ($b) use ($tenantId, $rawBarcode, $cleanDigits) {
                $b->withoutGlobalScopes()
                  ->where('tenant_id', $tenantId)
                  ->where(function ($sub) use ($rawBarcode, $cleanDigits) {
                      $sub->where('barcode', $rawBarcode);
                      if ($cleanDigits !== $rawBarcode) {
                          $sub->orWhere('barcode', $cleanDigits);
                      }
                  });
            })
            ->with(['generic', 'company', 'category', 'units', 'barcodes'])
            ->first();

        return $product ? $this->formatProductItem($product, $branchId) : null;
    }

    /**
     * Format lightweight search response without leaking any purchase cost fields.
     */
    protected function formatProductItem(Product $product, ?int $branchId = null): array
    {
        $defaultSaleUnit = $product->units->firstWhere('is_default_sale', true)
            ?? $product->units->firstWhere('conversion_to_base', 1);

        $saleUnits = $product->units
            ->filter(fn ($u) => (bool) $u->is_sale_unit)
            ->map(fn ($u) => [
                'id' => $u->id,
                'unit_name' => $u->unit_name,
                'conversion_to_base' => (int) $u->conversion_to_base,
                'is_default' => (bool) $u->is_default_sale,
            ])
            ->values()
            ->all();

        $barcodes = $product->barcodes->pluck('barcode')->all();

        return [
            'id' => $product->id,
            'type' => $product->type,
            'name' => $product->name,
            'name_bn' => $product->name_bn,
            'display_name' => $product->displayName(),
            'generic' => $product->generic ? [
                'id' => $product->generic->id,
                'name' => $product->generic->name,
            ] : null,
            'company' => $product->company ? [
                'id' => $product->company->id,
                'name' => $product->company->name,
                'name_bn' => $product->company->name_bn,
            ] : null,
            'category' => $product->category ? [
                'id' => $product->category->id,
                'name' => $product->category->name,
            ] : null,
            'strength' => $product->strength,
            'dosage_form' => $product->dosage_form,
            'sku' => $product->sku,
            'base_unit' => $product->base_unit,
            'default_sale_unit' => $defaultSaleUnit?->unit_name ?? $product->base_unit,
            'sale_units' => $saleUnits,
            'barcode' => $barcodes[0] ?? null,
            'barcodes' => $barcodes,
            'has_barcode' => count($barcodes) > 0,
            'is_controlled' => (bool) $product->is_controlled,
            'track_batch' => (bool) $product->track_batch,
            'default_discount' => [
                'type' => $product->default_discount_type,
                'value' => (float) $product->default_discount_value,
            ],
            'vat_rate' => (float) $product->vat_rate,
            'is_active' => (bool) $product->is_active,
            // Additive extras hook for Phase 5 (stock, batch availability, trade/MRP prices)
            'extras' => $this->stockInfoProvider->getExtras($product, $branchId),
        ];
    }
}
