<?php

declare(strict_types=1);

namespace PharmaCore\Foundation\Domain;

use InvalidArgumentException;

/**
 * Immutable exact integer minor-unit (paisa / cents) Money value object.
 * Framework-free and immune to IEEE 754 floating-point drift.
 */
final readonly class Money
{
    private function __construct(
        public int $minorUnits,
        public string $currency = 'BDT',
    ) {}

    public static function zero(string $currency = 'BDT'): self
    {
        return new self(0, strtoupper($currency));
    }

    public static function fromMinorUnits(int $minorUnits, string $currency = 'BDT'): self
    {
        return new self($minorUnits, strtoupper($currency));
    }

    public static function fromDecimal(string|int|float|null $amount, string $currency = 'BDT'): self
    {
        if ($amount === null || $amount === '') {
            return self::zero($currency);
        }

        if (is_int($amount)) {
            return new self($amount * 100, strtoupper($currency));
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

        $minorUnits = ($wholeInt * 100) + $twoDigits + ($thirdDigit >= 5 ? 1 : 0);

        return new self($negative ? -$minorUnits : $minorUnits, strtoupper($currency));
    }

    public function add(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->minorUnits + $other->minorUnits, $this->currency);
    }

    public function subtract(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->minorUnits - $other->minorUnits, $this->currency);
    }

    public function isZero(): bool
    {
        return $this->minorUnits === 0;
    }

    public function isPositive(): bool
    {
        return $this->minorUnits > 0;
    }

    public function isNegative(): bool
    {
        return $this->minorUnits < 0;
    }

    public function toDecimalString(): string
    {
        $negative = $this->minorUnits < 0;
        $abs = abs($this->minorUnits);
        $whole = intdiv($abs, 100);
        $fraction = $abs % 100;

        return ($negative ? '-' : '').$whole.'.'.str_pad((string) $fraction, 2, '0', STR_PAD_LEFT);
    }

    public function toFloat(): float
    {
        return (float) $this->toDecimalString();
    }

    private function assertSameCurrency(self $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new InvalidArgumentException(
                "Currency mismatch: cannot combine {$this->currency} with {$other->currency}."
            );
        }
    }
}

