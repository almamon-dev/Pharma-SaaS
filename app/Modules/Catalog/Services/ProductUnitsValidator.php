<?php

namespace App\Modules\Catalog\Services;

use Illuminate\Validation\ValidationException;

class ProductUnitsValidator
{
    /**
     * Validate product unit configurations according to SaaS catalog rules.
     *
     * @param  string  $baseUnit
     * @param  array<int, array{unit_name: string, conversion_to_base: int|numeric, is_sale_unit?: bool, is_purchase_unit?: bool, is_default_sale?: bool}>  $units
     * @return array<int, array{unit_name: string, conversion_to_base: int, is_sale_unit: bool, is_purchase_unit: bool, is_default_sale: bool}>
     *
     * @throws ValidationException
     */
    public static function validate(string $baseUnit, array $units): array
    {
        $baseUnit = strtolower(trim($baseUnit));
        if ($baseUnit === '') {
            throw ValidationException::withMessages([
                'base_unit' => ['A base unit name is required.'],
            ]);
        }

        // If units array is empty, default to single base unit
        if (empty($units)) {
            return [
                [
                    'unit_name' => $baseUnit,
                    'conversion_to_base' => 1,
                    'is_sale_unit' => true,
                    'is_purchase_unit' => true,
                    'is_default_sale' => true,
                ],
            ];
        }

        $seenNames = [];
        $baseUnitCount = 0;
        $saleUnitCount = 0;
        $defaultSaleCount = 0;
        $validatedUnits = [];

        foreach ($units as $index => $u) {
            $name = strtolower(trim($u['unit_name'] ?? ''));
            if ($name === '') {
                throw ValidationException::withMessages([
                    "units.{$index}.unit_name" => ['Unit name cannot be empty.'],
                ]);
            }

            if (isset($seenNames[$name])) {
                throw ValidationException::withMessages([
                    "units.{$index}.unit_name" => ["Unit name '{$name}' is repeated. Unit names must be unique per product."],
                ]);
            }
            $seenNames[$name] = true;

            $conv = (int) ($u['conversion_to_base'] ?? 1);
            if ($conv <= 0) {
                throw ValidationException::withMessages([
                    "units.{$index}.conversion_to_base" => ["Conversion factor for '{$name}' must be a positive integer greater than 0."],
                ]);
            }

            if ($conv === 1) {
                $baseUnitCount++;
                if ($name !== $baseUnit) {
                    throw ValidationException::withMessages([
                        "units.{$index}.conversion_to_base" => ["Unit with conversion factor 1 must match the product's base unit ('{$baseUnit}')."],
                    ]);
                }
            } else {
                if ($name === $baseUnit) {
                    throw ValidationException::withMessages([
                        "units.{$index}.conversion_to_base" => ["Base unit '{$baseUnit}' must have conversion factor 1."],
                    ]);
                }
            }

            $isSale = (bool) ($u['is_sale_unit'] ?? true);
            $isPurchase = (bool) ($u['is_purchase_unit'] ?? true);
            $isDefaultSale = (bool) ($u['is_default_sale'] ?? false);

            if ($isSale) {
                $saleUnitCount++;
            }
            if ($isDefaultSale) {
                $defaultSaleCount++;
                if (! $isSale) {
                    throw ValidationException::withMessages([
                        "units.{$index}.is_default_sale" => ["Unit '{$name}' cannot be default sale unit if it is not marked as a sale unit."],
                    ]);
                }
            }

            $validatedUnits[] = [
                'unit_name' => $name,
                'conversion_to_base' => $conv,
                'is_sale_unit' => $isSale,
                'is_purchase_unit' => $isPurchase,
                'is_default_sale' => $isDefaultSale,
            ];
        }

        if ($baseUnitCount !== 1) {
            throw ValidationException::withMessages([
                'units' => ["Exactly one unit with conversion factor 1 is required matching base unit '{$baseUnit}'."],
            ]);
        }

        if ($saleUnitCount < 1) {
            throw ValidationException::withMessages([
                'units' => ['At least one unit must be designated as a sale unit.'],
            ]);
        }

        // If no unit was marked as default sale, auto-assign default sale to the base unit or first sale unit
        if ($defaultSaleCount === 0) {
            foreach ($validatedUnits as &$vu) {
                if ($vu['is_sale_unit']) {
                    $vu['is_default_sale'] = true;
                    $defaultSaleCount = 1;
                    break;
                }
            }
        }

        if ($defaultSaleCount !== 1) {
            throw ValidationException::withMessages([
                'units' => ['Exactly one unit must be designated as the default sale unit.'],
            ]);
        }

        return $validatedUnits;
    }
}

