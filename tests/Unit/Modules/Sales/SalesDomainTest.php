<?php

declare(strict_types=1);

namespace Tests\Unit\Modules\Sales;

use App\Modules\Sales\Domain\DiscountApprovalPolicy;
use App\Modules\Sales\Domain\OrderPricingSummary;
use App\Modules\Sales\Domain\OrderStatusTransitionPolicy;
use App\Modules\Sales\Domain\PaymentSettlement;
use App\Modules\Sales\Domain\SalesProblem;
use PHPUnit\Framework\TestCase;

final class SalesDomainTest extends TestCase
{
    public function test_discount_policy_resolves_limits_and_approval_gate(): void
    {
        $policy = new DiscountApprovalPolicy;

        $this->assertSame(100.0, $policy->permittedLimitPercent(true, []));
        $this->assertSame(2.0, $policy->permittedLimitPercent(false, ['salesman']));
        $this->assertSame(15.0, $policy->permittedLimitPercent(false, ['manager']));

        $this->assertSame(
            'approved',
            $policy->resolveDiscountStatus(10.0, 2.0, 2.0, false, ['salesman'])
        );
        $this->assertSame(
            'pending_approval',
            $policy->resolveDiscountStatus(50.0, 10.0, 2.0, false, ['salesman'])
        );
        $this->assertSame(
            'none',
            $policy->resolveDiscountStatus(0.0, 0.0, 2.0, false, ['salesman'])
        );
    }

    public function test_order_pricing_summary_calculates_discount_and_tax(): void
    {
        $summary = OrderPricingSummary::calculate(
            subtotal: 1000.00,
            discountType: 'percent',
            rawDiscount: 10.0,
            configuredTaxPercent: 5.0,
        );

        $this->assertSame(100.0, $summary->discountAmount);
        $this->assertSame(10.0, $summary->effectiveDiscountPercent);
        $this->assertSame(45.0, $summary->taxAmount);
        $this->assertSame(945.0, $summary->grandTotal);
    }

    public function test_payment_settlement_calculates_change_net_cash_and_loyalty_points(): void
    {
        // Order 250.50, paid 200 cash + 100 bkash = 300.00 -> change 49.50, net cash in drawer 150.50
        $settlement = PaymentSettlement::settle('250.50', [
            ['method' => 'cash', 'amount' => '200.00'],
            ['method' => 'bkash', 'amount' => '100.00', 'reference_number' => 'TRX-99'],
        ]);

        $this->assertSame('300.00', $settlement->totalPaid->toDecimalString());
        $this->assertSame('0.00', $settlement->dueAmount->toDecimalString());
        $this->assertSame('49.50', $settlement->changeAmount->toDecimalString());
        $this->assertSame('150.50', $settlement->netCashForDrawer->toDecimalString());
        $this->assertSame('paid', $settlement->paymentStatus);
        $this->assertSame('Cash + Bkash', $settlement->primaryMethodLabel);
        $this->assertSame(2, $settlement->loyaltyPointsEarned);
    }

    public function test_status_transition_policy_rejects_invalid_transitions(): void
    {
        $policy = new OrderStatusTransitionPolicy;
        $policy->assertCanAccept('ORD-1', 'assigned');
        $policy->assertCanDeleteDraft('ORD-1', 'draft');

        $this->expectException(SalesProblem::class);
        $policy->assertCanPay('ORD-1', 'completed');
    }
}

