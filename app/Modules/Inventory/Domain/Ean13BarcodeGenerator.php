<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Domain;

/**
 * Pure domain EAN-13 internal barcode candidate & check-digit calculator.
 */
final class Ean13BarcodeGenerator
{
    public static function calculateCheckDigit(string $payload12): int
    {
        $sum = 0;
        for ($i = 0; $i < 12; $i++) {
            $sum += ((int) $payload12[$i]) * ($i % 2 === 0 ? 1 : 3);
        }

        return (10 - ($sum % 10)) % 10;
    }

    public static function candidateForTenant(int $tenantId): string
    {
        $tenantPart = str_pad((string) ($tenantId % 1000), 3, '0', STR_PAD_LEFT);
        $randomPart = str_pad((string) random_int(0, 9999999), 7, '0', STR_PAD_LEFT);
        $payload12 = '20'.$tenantPart.$randomPart;

        return $payload12.self::calculateCheckDigit($payload12);
    }
}

