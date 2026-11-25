<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Exact integer minor-unit (paisa / cents) arithmetic helper.
 * Eliminates IEEE 754 floating-point drift on all currency calculations.
 */
final class MoneyMath
{
    public const BDT_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

    /**
     * Convert a decimal currency representation into exact integer paisa (minor units).
     */
    public static function toPaisa(string|int|float|null $amount): int
    {
        if ($amount === null || $amount === '') {
            return 0;
        }

        if (is_int($amount)) {
            return $amount * 100;
        }

        $raw = is_float($amount)
            ? number_format($amount, 4, '.', '')
            : trim((string) $amount);

        $raw = str_replace([',', ' '], '', $raw);

        if ($raw === '' || ! preg_match('/^[+-]?\d+(\.\d+)?$/', $raw)) {
            throw new InvalidArgumentException("Invalid monetary amount: {$raw}");
        }

        $negative = str_starts_with($raw, '-');
        $unsigned = ltrim($raw, '+-');
        [$whole, $frac] = array_pad(explode('.', $unsigned, 2), 2, '');

        $wholeInt = (int) $whole;
        $paddedFrac = str_pad($frac, 3, '0');
        $twoDigits = (int) substr($paddedFrac, 0, 2);
        $thirdDigit = (int) $paddedFrac[2];

        $paisa = ($wholeInt * 100) + $twoDigits + ($thirdDigit >= 5 ? 1 : 0);

        return $negative ? -$paisa : $paisa;
    }

    /**
     * Convert integer paisa back into an exact 2-decimal string (e.g. "1250.50").
     */
    public static function fromPaisa(int $paisa): string
    {
        $negative = $paisa < 0;
        $abs = abs($paisa);
        $whole = intdiv($abs, 100);
        $fraction = $abs % 100;

        return ($negative ? '-' : '').$whole.'.'.str_pad((string) $fraction, 2, '0', STR_PAD_LEFT);
    }

    /**
     * Compute exact integer paisa total from BDT note denomination counts.
     *
     * @param  array<int|string, int|string>  $denominations
     * @return array{normalized: array<int, int>, total_paisa: int}
     */
    public static function sumDenominations(array $denominations): array
    {
        $normalized = [];
        $totalTaka = 0;

        foreach (self::BDT_DENOMINATIONS as $note) {
            $count = max(0, (int) ($denominations[$note] ?? $denominations[(string) $note] ?? 0));
            $normalized[$note] = $count;
            $totalTaka += $note * $count;
        }

        return [
            'normalized' => $normalized,
            'total_paisa' => $totalTaka * 100,
        ];
    }
}
