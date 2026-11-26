<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Domain;

use PharmaCore\Foundation\Domain\Money;

/**
 * Pure domain calculation for cash drawer expected balance and closing discrepancy.
 * Formula: Expected Cash = Opening Float + Cash Sales + Cash In - Cash Out - Safe Drops - Cash Refunds.
 */
final readonly class DrawerReconciliation
{
    public Money $cashOutTotal;

    public Money $expectedCash;

    public ?Money $discrepancy;

    public string $discrepancyStatus;

    public function __construct(
        public Money $openingFloat,
        public Money $cashSales,
        public Money $cardSales,
        public Money $mobileSales,
        public Money $cashIn,
        public Money $cashOutOnly,
        public Money $safeDrop,
        public Money $cashRefunds,
        public ?Money $countedCash = null,
    ) {
        $this->cashOutTotal = $this->cashOutOnly->add($this->safeDrop);

        $this->expectedCash = $this->openingFloat
            ->add($this->cashSales)
            ->add($this->cashIn)
            ->subtract($this->cashOutTotal)
            ->subtract($this->cashRefunds);

        if ($this->countedCash === null) {
            $this->discrepancy = null;
            $this->discrepancyStatus = 'open';
        } else {
            $this->discrepancy = $this->countedCash->subtract($this->expectedCash);
            $this->discrepancyStatus = $this->discrepancy->isZero()
                ? 'matched'
                : ($this->discrepancy->isPositive() ? 'surplus' : 'shortage');
        }
    }

    public function totalCollected(): Money
    {
        return $this->cashSales->add($this->cardSales)->add($this->mobileSales);
    }

    public function hasDiscrepancy(): bool
    {
        return $this->discrepancy !== null && ! $this->discrepancy->isZero();
    }
}

