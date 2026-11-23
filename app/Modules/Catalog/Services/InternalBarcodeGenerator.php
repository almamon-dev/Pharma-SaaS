<?php

namespace App\Modules\Catalog\Services;

use App\Models\Tenant;
use App\Modules\Catalog\Models\ProductBarcode;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class InternalBarcodeGenerator
{
    /**
     * Generate next unique internal EAN-13 barcode starting with '2' for the tenant.
     */
    public function generateForTenant(int $tenantId, int $maxRetries = 10): string
    {
        for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
            $number = DB::transaction(function () use ($tenantId) {
                $seq = DB::table('document_sequences')
                    ->where('tenant_id', $tenantId)
                    ->where('doc_type', 'internal_barcode')
                    ->whereNull('branch_id')
                    ->lockForUpdate()
                    ->first();

                if (! $seq) {
                    DB::table('document_sequences')->insert([
                        'tenant_id' => $tenantId,
                        'branch_id' => null,
                        'doc_type' => 'internal_barcode',
                        'prefix' => '2',
                        'next_number' => 2,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    return 1;
                }

                $current = (int) $seq->next_number;
                DB::table('document_sequences')
                    ->where('id', $seq->id)
                    ->update([
                        'next_number' => $current + 1,
                        'updated_at' => now(),
                    ]);

                return $current;
            });

            // Format 12-digit payload starting with '2'
            // '2' + 11-digit padded integer
            $payload = '2'.str_pad((string) $number, 11, '0', STR_PAD_LEFT);
            $checkDigit = self::calculateEan13CheckDigit($payload);
            $barcode = $payload.$checkDigit;

            // Ensure no collision in product_barcodes for this tenant
            $exists = ProductBarcode::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->where('barcode', $barcode)
                ->exists();

            if (! $exists) {
                return $barcode;
            }
        }

        throw new RuntimeException("Failed to generate unique internal barcode after {$maxRetries} attempts.");
    }

    /**
     * Standard EAN-13 check digit algorithm.
     */
    public static function calculateEan13CheckDigit(string $payload12): int
    {
        if (strlen($payload12) !== 12 || ! ctype_digit($payload12)) {
            throw new \InvalidArgumentException('Payload for EAN-13 check digit must be exactly 12 numeric digits.');
        }

        $sum = 0;
        for ($i = 0; $i < 12; $i++) {
            $digit = (int) $payload12[$i];
            // Alternating weights: 1 for odd positions (index 0, 2, 4...), 3 for even positions (index 1, 3, 5...)
            $weight = ($i % 2 === 0) ? 1 : 3;
            $sum += $digit * $weight;
        }

        $remainder = $sum % 10;
        return ($remainder === 0) ? 0 : 10 - $remainder;
    }

    /**
     * Validate whether a 13-digit barcode has a mathematically correct EAN-13 check digit.
     */
    public static function isValidEan13(string $barcode): bool
    {
        if (strlen($barcode) !== 13 || ! ctype_digit($barcode)) {
            return false;
        }

        $payload = substr($barcode, 0, 12);
        $check = (int) $barcode[12];

        return self::calculateEan13CheckDigit($payload) === $check;
    }
}

