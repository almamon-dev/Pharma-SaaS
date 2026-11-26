<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Domain;

/**
 * Pure domain policy calculating legal batch adjustment outcomes.
 */
final readonly class StockAdjustmentOutcome
{
    public function __construct(
        public int $quantityChange,
        public int $balanceBefore,
        public int $balanceAfter,
        public string $nextStatus,
        public bool $markDisposed,
    ) {}
}

