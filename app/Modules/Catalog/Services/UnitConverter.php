<?php

namespace App\Modules\Catalog\Services;

use App\Modules\Catalog\Models\Product;
use InvalidArgumentException;

class UnitConverter
{
    /**
     * Convert given quantity in named unit to integer smallest base units.
     *
     * @throws InvalidArgumentException
     */
    public function toBase(Product $product, string $unitName, int|float $qty): int
    {
        $unitName = strtolower(trim($unitName));
        $baseUnit = strtolower(trim($product->base_unit));

        if ($unitName === $baseUnit) {
            return (int) round($qty);
        }

        $unit = $product->units->first(
            fn ($u) => strtolower($u->unit_name) === $unitName
        );

        if (! $unit) {
            throw new InvalidArgumentException("Unit '{$unitName}' is not defined for product '{$product->name}'.");
        }

        return (int) round($qty * $unit->conversion_to_base);
    }

    /**
     * Convert base units to quantity in the specified unit name.
     *
     * @throws InvalidArgumentException
     */
    public function fromBase(Product $product, string $unitName, int $baseQty): float
    {
        $unitName = strtolower(trim($unitName));
        $baseUnit = strtolower(trim($product->base_unit));

        if ($unitName === $baseUnit) {
            return (float) $baseQty;
        }

        $unit = $product->units->first(
            fn ($u) => strtolower($u->unit_name) === $unitName
        );

        if (! $unit) {
            throw new InvalidArgumentException("Unit '{$unitName}' is not defined for product '{$product->name}'.");
        }

        if ($unit->conversion_to_base <= 0) {
            throw new InvalidArgumentException("Unit '{$unitName}' has an invalid conversion factor.");
        }

        return round($baseQty / $unit->conversion_to_base, 4);
    }
}

