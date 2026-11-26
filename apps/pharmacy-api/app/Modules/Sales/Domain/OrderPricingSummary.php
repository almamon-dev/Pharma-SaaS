<?php

declare(strict_types=1);

namespace App\Modules\Sales\Domain;

/**
 * Pure domain calculator for order subtotal, discount, VAT/tax, and grand total.
 */
final readonly class OrderPricingSummary
{
    public function __construct(
        public float $subtotal,
        public float $discountAmount,
        public float $effectiveDiscountPercent,
        public float $taxAmount,
        public float $grandTotal,
    ) {}

    public static function calculate(
        float $subtotal,
        string $discountType,
        float $rawDiscount,
        float $configuredTaxPercent,
        float $manualTaxAmount = 0.0,
    ): self {
        $cleanSubtotal = max(0.0, round($subtotal, 2));
        $cleanRawDiscount = max(0.0, $rawDiscount);

        $discountAmount = $discountType === 'percent'
            ? round($cleanSubtotal * min(100.0, $cleanRawDiscount) / 100, 2)
            : $cleanRawDiscount;
        $discountAmount = min($cleanSubtotal, max(0.0, round($discountAmount, 2)));

        $effectivePercent = $cleanSubtotal > 0.0
            ? round(($discountAmount / $cleanSubtotal) * 100, 2)
            : 0.0;

        $taxable = max(0.0, $cleanSubtotal - $discountAmount);
        $taxAmount = $configuredTaxPercent > 0.0
            ? round($taxable * ($configuredTaxPercent / 100), 2)
            : round(max(0.0, $manualTaxAmount), 2);

        $grandTotal = max(0.0, round($taxable + $taxAmount, 2));

        return new self(
            subtotal: $cleanSubtotal,
            discountAmount: $discountAmount,
            effectiveDiscountPercent: $effectivePercent,
            taxAmount: $taxAmount,
            grandTotal: $grandTotal,
        );
    }
}

