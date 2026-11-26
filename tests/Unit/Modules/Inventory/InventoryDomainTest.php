<?php

declare(strict_types=1);

namespace Tests\Unit\Modules\Inventory;

use App\Modules\Inventory\Domain\Ean13BarcodeGenerator;
use App\Modules\Inventory\Domain\InventoryProblem;
use App\Modules\Inventory\Domain\PackagingPricing;
use App\Modules\Inventory\Domain\StockAdjustmentPolicy;
use App\Modules\Inventory\Domain\StockTransferPolicy;
use PHPUnit\Framework\TestCase;

final class InventoryDomainTest extends TestCase
{
    public function test_packaging_pricing_normalizes_box_and_piece_prices(): void
    {
        $pricing = PackagingPricing::fromInput([
            'units_per_strip' => 10,
            'units_per_box' => 100,
            'box_purchase_price' => 250,
            'box_selling_price' => 350,
        ]);

        $this->assertSame(2.5, $pricing->defaultPurchasePrice);
        $this->assertSame(250.0, $pricing->boxPurchasePrice);
        $this->assertSame(3.5, $pricing->defaultSellingPrice);
        $this->assertSame(350.0, $pricing->boxSellingPrice);
    }

    public function test_stock_adjustment_policy_enforces_expiry_and_stock_guards(): void
    {
        $policy = new StockAdjustmentPolicy;

        // Re-activating depleted batch on positive adjustment
        $in = $policy->evaluate('adjustment_in', 15, 0, 'depleted', false, 'B-01');
        $this->assertSame(15, $in->balanceAfter);
        $this->assertSame('active', $in->nextStatus);

        // Full expiry disposal marks batch disposed
        $disposal = $policy->evaluate('expiry_disposal', 5, 20, 'active', true, 'B-02', true);
        $this->assertSame(-20, $disposal->quantityChange);
        $this->assertSame(0, $disposal->balanceAfter);
        $this->assertSame('disposed', $disposal->nextStatus);
        $this->assertTrue($disposal->markDisposed);

        // Expired batch cannot receive positive stock
        $this->expectException(InventoryProblem::class);
        $policy->evaluate('adjustment_in', 5, 10, 'active', true, 'B-EXP');
    }

    public function test_stock_transfer_policy_and_ean13_check_digit(): void
    {
        $barcode = Ean13BarcodeGenerator::candidateForTenant(7);
        $this->assertSame(13, strlen($barcode));
        $this->assertSame(
            (int) $barcode[12],
            Ean13BarcodeGenerator::calculateCheckDigit(substr($barcode, 0, 12))
        );

        $transfer = new StockTransferPolicy;
        $this->expectException(InventoryProblem::class);
        $transfer->assertCanTransfer(1, 1, 10, 50);
    }
}

