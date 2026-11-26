<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Domain;

/**
 * Pure domain packaging & dual piece/box pricing normalizer.
 */
final readonly class PackagingPricing
{
    public function __construct(
        public int $unitsPerStrip,
        public int $unitsPerBox,
        public float $defaultPurchasePrice,
        public ?float $boxPurchasePrice,
        public float $defaultSellingPrice,
        public ?float $boxSellingPrice,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     */
    public static function fromInput(array $input): self
    {
        $unitsPerStrip = max(1, (int) ($input['units_per_strip'] ?? 1));
        $unitsPerBox = max(1, (int) ($input['units_per_box'] ?? 1));

        $hasPiecePurchase = isset($input['purchase_price']) && $input['purchase_price'] !== '' && $input['purchase_price'] !== null;
        $hasBoxPurchase = isset($input['box_purchase_price']) && $input['box_purchase_price'] !== '' && $input['box_purchase_price'] !== null;
        $hasPieceSelling = isset($input['selling_price']) && $input['selling_price'] !== '' && $input['selling_price'] !== null;
        $hasBoxSelling = isset($input['box_selling_price']) && $input['box_selling_price'] !== '' && $input['box_selling_price'] !== null;

        $unitPurchase = $hasPiecePurchase
            ? round((float) $input['purchase_price'], 2)
            : round(((float) ($input['box_purchase_price'] ?? 0)) / $unitsPerBox, 2);

        $unitSelling = $hasPieceSelling
            ? round((float) $input['selling_price'], 2)
            : round(((float) ($input['box_selling_price'] ?? 0)) / $unitsPerBox, 2);

        $boxPurchase = $hasBoxPurchase
            ? round((float) $input['box_purchase_price'], 2)
            : ($unitsPerBox > 1 ? round($unitPurchase * $unitsPerBox, 2) : null);

        $boxSelling = $hasBoxSelling
            ? round((float) $input['box_selling_price'], 2)
            : ($unitsPerBox > 1 ? round($unitSelling * $unitsPerBox, 2) : null);

        return new self(
            unitsPerStrip: $unitsPerStrip,
            unitsPerBox: $unitsPerBox,
            defaultPurchasePrice: $unitPurchase,
            boxPurchasePrice: $boxPurchase,
            defaultSellingPrice: $unitSelling,
            boxSellingPrice: $boxSelling,
        );
    }

    /**
     * @return array{
     *     units_per_strip: int,
     *     units_per_box: int,
     *     default_purchase_price: float,
     *     box_purchase_price: ?float,
     *     default_selling_price: float,
     *     box_selling_price: ?float,
     * }
     */
    public function toArray(): array
    {
        return [
            'units_per_strip' => $this->unitsPerStrip,
            'units_per_box' => $this->unitsPerBox,
            'default_purchase_price' => $this->defaultPurchasePrice,
            'box_purchase_price' => $this->boxPurchasePrice,
            'default_selling_price' => $this->defaultSellingPrice,
            'box_selling_price' => $this->boxSellingPrice,
        ];
    }
}

