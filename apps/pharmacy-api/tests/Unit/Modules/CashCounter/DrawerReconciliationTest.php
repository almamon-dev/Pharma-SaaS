<?php

declare(strict_types=1);

namespace Tests\Unit\Modules\CashCounter;

use App\Modules\CashCounter\Domain\CashCounterProblem;
use App\Modules\CashCounter\Domain\CashMovementType;
use App\Modules\CashCounter\Domain\DenominationCount;
use App\Modules\CashCounter\Domain\DrawerReconciliation;
use App\Modules\CashCounter\Domain\ShiftPeriod;
use PharmaCore\Foundation\Domain\Money;
use PHPUnit\Framework\TestCase;

final class DrawerReconciliationTest extends TestCase
{
    public function test_denomination_count_computes_exact_bdt_total(): void
    {
        $count = DenominationCount::fromArray([
            '1000' => 2,
            '500' => 4,
            '100' => 10,
            '50' => -3, // negative counts are clamped to 0
        ]);

        $this->assertSame('5000.00', $count->total->toDecimalString());
        $this->assertSame(500000, $count->total->minorUnits);
        $this->assertSame(2, $count->counts[1000]);
        $this->assertSame(4, $count->counts[500]);
        $this->assertSame(10, $count->counts[100]);
        $this->assertSame(0, $count->counts[50]);
    }

    public function test_drawer_reconciliation_computes_exact_expected_cash_and_shortage(): void
    {
        // 1000.00 + 101.00 + 500.25 - 50.10 - 200.00 - 30.05 = 1321.10
        $reconciliation = new DrawerReconciliation(
            openingFloat: Money::fromDecimal('1000.00'),
            cashSales: Money::fromDecimal('101.00'),
            cardSales: Money::fromDecimal('1800.00'),
            mobileSales: Money::fromDecimal('3200.00'),
            cashIn: Money::fromDecimal('500.25'),
            cashOutOnly: Money::fromDecimal('50.10'),
            safeDrop: Money::fromDecimal('200.00'),
            cashRefunds: Money::fromDecimal('30.05'),
            countedCash: Money::fromDecimal('1300.00'),
        );

        $this->assertSame('250.10', $reconciliation->cashOutTotal->toDecimalString());
        $this->assertSame('1321.10', $reconciliation->expectedCash->toDecimalString());
        $this->assertSame('-21.10', $reconciliation->discrepancy?->toDecimalString());
        $this->assertSame('shortage', $reconciliation->discrepancyStatus);
        $this->assertTrue($reconciliation->hasDiscrepancy());
        $this->assertSame('5101.00', $reconciliation->totalCollected()->toDecimalString());
    }

    public function test_drawer_reconciliation_detects_matched_and_surplus(): void
    {
        $matched = new DrawerReconciliation(
            openingFloat: Money::fromDecimal('5000.00'),
            cashSales: Money::fromDecimal('20000.00'),
            cardSales: Money::zero(),
            mobileSales: Money::zero(),
            cashIn: Money::zero(),
            cashOutOnly: Money::zero(),
            safeDrop: Money::zero(),
            cashRefunds: Money::zero(),
            countedCash: Money::fromDecimal('25000.00'),
        );

        $this->assertSame('matched', $matched->discrepancyStatus);
        $this->assertFalse($matched->hasDiscrepancy());

        $surplus = new DrawerReconciliation(
            openingFloat: Money::fromDecimal('5000.00'),
            cashSales: Money::zero(),
            cardSales: Money::zero(),
            mobileSales: Money::zero(),
            cashIn: Money::zero(),
            cashOutOnly: Money::zero(),
            safeDrop: Money::zero(),
            cashRefunds: Money::zero(),
            countedCash: Money::fromDecimal('5050.00'),
        );

        $this->assertSame('surplus', $surplus->discrepancyStatus);
        $this->assertSame('50.00', $surplus->discrepancy?->toDecimalString());
    }

    public function test_shift_period_detection_and_movement_types(): void
    {
        $this->assertSame(ShiftPeriod::MORNING, ShiftPeriod::detectFromHour(9));
        $this->assertSame(ShiftPeriod::EVENING, ShiftPeriod::detectFromHour(16));
        $this->assertSame(ShiftPeriod::NIGHT, ShiftPeriod::detectFromHour(22));

        $this->assertTrue(CashMovementType::CASH_IN->isInflow());
        $this->assertFalse(CashMovementType::CASH_REFUND->isInflow());

        $problem = CashCounterProblem::discrepancyReasonRequired();
        $this->assertSame('DISCREPANCY_REASON_REQUIRED', $problem->errorCode);
        $this->assertSame(422, $problem->statusCode);
    }
}

