<?php

namespace App\Modules\Accounting\Services;

use InvalidArgumentException;

final class MoneyPaisa
{
    /**
     * Convert a BDT decimal string or integer (e.g. "3200.50", "3,200", 3200) into integer paisa.
     * Uses pure string/integer math — never binary floats.
     */
    public static function fromBdt(string|int $amount): int
    {
        if (is_int($amount)) {
            return $amount * 100;
        }

        $clean = str_replace([',', '৳', ' '], '', trim($amount));
        if ($clean === '' || ! preg_match('/^-?\d+(?:\.\d{1,2})?$/', $clean)) {
            throw new InvalidArgumentException("Invalid BDT money amount: '{$amount}'. Expected up to 2 decimal places.");
        }

        $negative = str_starts_with($clean, '-');
        if ($negative) {
            $clean = substr($clean, 1);
        }

        $parts = explode('.', $clean, 2);
        $taka = (int) $parts[0];
        $paisaStr = isset($parts[1]) ? str_pad($parts[1], 2, '0') : '00';
        $total = ($taka * 100) + (int) $paisaStr;

        return $negative ? -$total : $total;
    }

    /**
     * Format integer paisa as exact decimal string (e.g. 320050 -> "3200.50").
     */
    public static function toDecimalString(int $paisa): string
    {
        $negative = $paisa < 0;
        $abs = abs($paisa);
        $taka = intdiv($abs, 100);
        $rem = $abs % 100;

        return ($negative ? '-' : '').$taka.'.'.str_pad((string) $rem, 2, '0', STR_PAD_LEFT);
    }

    /**
     * Format integer paisa for display with ৳ symbol and commas.
     */
    public static function formatBdt(int $paisa): string
    {
        $negative = $paisa < 0;
        $abs = abs($paisa);
        $taka = intdiv($abs, 100);
        $rem = $abs % 100;

        $formatted = number_format($taka, 0, '.', ',').'.'.str_pad((string) $rem, 2, '0', STR_PAD_LEFT);

        return ($negative ? '-৳' : '৳').$formatted;
    }
}

