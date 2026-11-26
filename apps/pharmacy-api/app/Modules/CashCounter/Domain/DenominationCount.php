<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Domain;

use PharmaCore\Foundation\Domain\Money;

/**
 * Immutable BDT note denomination count breakdown (৳1000 down to ৳1).
 */
final readonly class DenominationCount
{
    /** @var list<int> */
    public const BDT_NOTES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

    /**
     * @param  array<int, int>  $counts
     */
    private function __construct(
        public array $counts,
        public Money $total,
    ) {}

    /**
     * @param  array<int|string, int|string|null>  $raw
     */
    public static function fromArray(array $raw, string $currency = 'BDT'): self
    {
        $normalized = [];
        $totalTaka = 0;

        foreach (self::BDT_NOTES as $note) {
            $qty = max(0, (int) ($raw[$note] ?? $raw[(string) $note] ?? 0));
            $normalized[$note] = $qty;
            $totalTaka += $note * $qty;
        }

        return new self(
            counts: $normalized,
            total: Money::fromMinorUnits($totalTaka * 100, $currency),
        );
    }

    /**
     * @return array<int, int>
     */
    public function toArray(): array
    {
        return $this->counts;
    }
}

