<?php

namespace App\Modules\Catalog\Services;

use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Support\CatalogNormalizer;

class ProductSearchIndexer
{
    /**
     * Build the normalized search_text string for a product.
     * Concatenation of: name, name_bn, generic name, company name, strength, dosage_form, sku, category name.
     */
    public static function build(Product $product): string
    {
        $parts = [];

        // 1. Name & Name BN
        if (! empty($product->name)) {
            $parts[] = CatalogNormalizer::normalizeText($product->name);
        }
        if (! empty($product->name_bn)) {
            $parts[] = CatalogNormalizer::normalizeText($product->name_bn);
        }

        // 2. Generic Name
        $genericName = $product->generic?->name;
        if (! empty($genericName)) {
            $parts[] = CatalogNormalizer::normalizeText($genericName);
        }

        // 3. Company Name
        $companyName = $product->company?->name;
        if (! empty($companyName)) {
            $parts[] = CatalogNormalizer::normalizeText($companyName);
        }
        $companyNameBn = $product->company?->name_bn;
        if (! empty($companyNameBn)) {
            $parts[] = CatalogNormalizer::normalizeText($companyNameBn);
        }

        // 4. Strength & Normalized Strength
        if (! empty($product->strength)) {
            $parts[] = CatalogNormalizer::normalizeText($product->strength);
            $normStrength = CatalogNormalizer::normalizeStrength($product->strength);
            if ($normStrength && $normStrength !== $product->strength) {
                $parts[] = $normStrength;
            }
        }

        // 5. Dosage Form
        if (! empty($product->dosage_form)) {
            $parts[] = CatalogNormalizer::normalizeText($product->dosage_form);
        }

        // 6. SKU
        if (! empty($product->sku)) {
            $parts[] = CatalogNormalizer::normalizeText($product->sku);
        }

        // 7. Category Name
        $categoryName = $product->category?->name;
        if (! empty($categoryName)) {
            $parts[] = CatalogNormalizer::normalizeText($categoryName);
        }
        $categoryNameBn = $product->category?->name_bn;
        if (! empty($categoryNameBn)) {
            $parts[] = CatalogNormalizer::normalizeText($categoryNameBn);
        }

        return implode(' ', array_filter($parts));
    }
}

