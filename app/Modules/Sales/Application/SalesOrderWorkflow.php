<?php

declare(strict_types=1);

namespace App\Modules\Sales\Application;

use App\Modules\Foundation\Application\Ports\AuditLogger;
use App\Modules\Sales\Application\DTO\ProcessPaymentCommand;
use App\Modules\Sales\Application\DTO\SalesOrderSnapshot;
use App\Modules\Sales\Application\Ports\CounterQueuePort;
use App\Modules\Sales\Application\Ports\CustomerLoyaltyPort;
use App\Modules\Sales\Application\Ports\SalesEventPublisher;
use App\Modules\Sales\Application\Ports\SalesOrderRepository;
use App\Modules\Sales\Application\Ports\StockAllocationPort;
use App\Modules\Sales\Domain\DiscountApprovalPolicy;
use App\Modules\Sales\Domain\OrderPricingSummary;
use App\Modules\Sales\Domain\OrderStatusTransitionPolicy;
use App\Modules\Sales\Domain\PaymentSettlement;
use PharmaCore\Foundation\Application\Clock;
use PharmaCore\Foundation\Application\TransactionManager;

/**
 * Pure framework-free Application Workflow for Sales Order lifecycle,
 * discount governance, FEFO stock settlement, and payment completion.
 */
final class SalesOrderWorkflow
{
    public function __construct(
        private readonly SalesOrderRepository $orders,
        private readonly StockAllocationPort $stockAllocation,
        private readonly CounterQueuePort $counterQueue,
        private readonly CustomerLoyaltyPort $customerLoyalty,
        private readonly SalesEventPublisher $events,
        private readonly DiscountApprovalPolicy $discountPolicy,
        private readonly OrderStatusTransitionPolicy $statusPolicy,
        private readonly TransactionManager $transactions,
        private readonly AuditLogger $auditLogger,
        private readonly Clock $clock,
    ) {}

    /**
     * @param  list<string>  $roles
     * @param  array<string, mixed>  $configuredLimits
     */
    public function permittedDiscountLimit(bool $isOwnerOrAdmin, array $roles, array $configuredLimits = []): float
    {
        return $this->discountPolicy->permittedLimitPercent($isOwnerOrAdmin, $roles, $configuredLimits);
    }

    /**
     * @param  list<string>  $roles
     * @param  array<string, mixed>  $configuredLimits
     * @return array{pricing: OrderPricingSummary, discount_status: string}
     */
    public function calculatePricingAndDiscountStatus(
        float $subtotal,
        string $discountType,
        float $rawDiscount,
        float $configuredTaxPercent,
        float $manualTaxAmount,
        bool $isOwnerOrAdmin,
        array $roles,
        array $configuredLimits = [],
    ): array {
        $pricing = OrderPricingSummary::calculate(
            subtotal: $subtotal,
            discountType: $discountType,
            rawDiscount: $rawDiscount,
            configuredTaxPercent: $configuredTaxPercent,
            manualTaxAmount: $manualTaxAmount,
        );

        $limit = $this->discountPolicy->permittedLimitPercent($isOwnerOrAdmin, $roles, $configuredLimits);
        $status = $this->discountPolicy->resolveDiscountStatus(
            discountAmount: $pricing->discountAmount,
            effectivePercentage: $pricing->effectiveDiscountPercent,
            permittedLimitPercent: $limit,
            isOwnerOrAdmin: $isOwnerOrAdmin,
            roles: $roles,
        );

        return [
            'pricing' => $pricing,
            'discount_status' => $status,
        ];
    }

    public function acceptOrder(int $saleId, int $cashierId, string $cashierName): SalesOrderSnapshot
    {
        $now = $this->clock->now();

        /** @var SalesOrderSnapshot */
        return $this->transactions->run(function () use ($saleId, $cashierId, $cashierName, $now): SalesOrderSnapshot {
            $locked = $this->orders->lockForUpdate($saleId);
            $this->statusPolicy->assertCanAccept($locked->orderNumber, $locked->orderStatus);

            return $this->orders->markProcessing($locked->id, $cashierId, $cashierName, $now);
        });
    }

    public function processPayment(ProcessPaymentCommand $command): SalesOrderSnapshot
    {
        $now = $this->clock->now();

        /** @var SalesOrderSnapshot $completed */
        $completed = $this->transactions->run(function () use ($command, $now): SalesOrderSnapshot {
            $locked = $this->orders->lockForUpdate($command->saleId);
            $this->statusPolicy->assertCanPay($locked->orderNumber, $locked->orderStatus);

            // 1. Atomically verify and deduct FEFO stock via cross-module port
            $this->stockAllocation->deductFefoForOrder($locked->id, $locked->branchId, $command->cashierId);

            // 2. Compute exact settlement in integer minor units
            $settlement = PaymentSettlement::settle(
                orderTotal: $locked->totalAmount,
                lines: $command->paymentLines,
                currency: $command->currencyCode,
            );

            // 3. Persist payments & finalize order/invoice
            $finalized = $this->orders->recordPaymentSettlement(
                saleId: $locked->id,
                tenantId: $locked->tenantId,
                cashierId: $command->cashierId,
                counterId: $command->counterId,
                counterSessionId: $command->counterSessionId,
                invoiceNumber: $command->invoiceNumber,
                settlement: $settlement,
                completedAt: $now,
            );

            // 4. Complete counter assignment & update cash drawer shift totals
            $this->counterQueue->completeAssignment($locked->id, $command->cashierId, $now);
            $this->counterQueue->recordShiftSaleTally(
                counterSessionId: $command->counterSessionId,
                totalSalesAmount: $settlement->totalAmount->toFloat(),
                netCashAmount: $settlement->netCashForDrawer->toFloat(),
            );

            // 5. Award customer loyalty points if applicable
            if ($locked->customerId !== null && $settlement->loyaltyPointsEarned > 0) {
                $this->customerLoyalty->awardPoints($locked->customerId, $settlement->loyaltyPointsEarned);
            }

            // 6. Audit log
            $this->auditLogger->record(
                action: 'sales_order.completed',
                description: "Cashier {$command->cashierName} collected {$settlement->totalPaid->toFloat()} BDT for order #{$locked->orderNumber} (Invoice: {$command->invoiceNumber}).",
                subjectType: 'App\\Models\\Sale',
                subjectId: $locked->id,
                metadata: [
                    'invoice_number' => $command->invoiceNumber,
                    'total_amount' => $settlement->totalAmount->toFloat(),
                    'paid_amount' => $settlement->totalPaid->toFloat(),
                    'payment_status' => $settlement->paymentStatus,
                ],
                tenantId: $locked->tenantId,
                userId: $command->cashierId,
            );

            // 7. Re-check unassigned counter queue & emit completion event
            $this->counterQueue->processUnassignedQueue($locked->tenantId, $locked->branchId);
            $this->events->publishOrderCompleted($locked->id);

            return $finalized;
        });

        return $completed;
    }

    public function cancelOrder(int $saleId, int $actorId, string $actorName, string $reason): SalesOrderSnapshot
    {
        $now = $this->clock->now();

        /** @var SalesOrderSnapshot */
        return $this->transactions->run(function () use ($saleId, $actorId, $actorName, $reason, $now): SalesOrderSnapshot {
            $locked = $this->orders->lockForUpdate($saleId);
            $this->statusPolicy->assertCanCancel($locked->orderStatus);

            $this->counterQueue->cancelAssignment($locked->id, $reason, $now);
            $cancelled = $this->orders->markCancelled($locked->id, $actorId, $reason, $now);

            $this->auditLogger->record(
                action: 'sales_order.cancelled',
                description: "Order #{$locked->orderNumber} cancelled by {$actorName}. Reason: {$reason}",
                subjectType: 'App\\Models\\Sale',
                subjectId: $locked->id,
                metadata: ['reason' => $reason],
                tenantId: $locked->tenantId,
                userId: $actorId,
            );

            return $cancelled;
        });
    }

    public function deleteDraft(int $saleId, int $actorId, string $actorName): void
    {
        $this->transactions->run(function () use ($saleId, $actorId, $actorName): void {
            $locked = $this->orders->lockForUpdate($saleId);
            $this->statusPolicy->assertCanDeleteDraft($locked->orderNumber, $locked->orderStatus);

            $this->auditLogger->record(
                action: 'sales_order.draft_deleted',
                description: "User {$actorName} deleted draft order #{$locked->orderNumber}.",
                subjectType: 'App\\Models\\Sale',
                subjectId: $locked->id,
                metadata: ['order_number' => $locked->orderNumber],
                tenantId: $locked->tenantId,
                userId: $actorId,
            );

            $this->orders->deleteDraft($locked->id);
        });
    }

    public function approveDiscount(int $saleId, int $managerId, string $managerName): SalesOrderSnapshot
    {
        $now = $this->clock->now();

        /** @var SalesOrderSnapshot */
        return $this->transactions->run(function () use ($saleId, $managerId, $managerName, $now): SalesOrderSnapshot {
            $locked = $this->orders->lockForUpdate($saleId);
            $updated = $this->orders->markDiscountApproved($locked->id, $managerId, $now);

            $this->auditLogger->record(
                action: 'sales_order.discount_approved',
                description: "Manager {$managerName} approved discount of {$locked->discountAmount} on order #{$locked->orderNumber}.",
                subjectType: 'App\\Models\\Sale',
                subjectId: $locked->id,
                tenantId: $locked->tenantId,
                userId: $managerId,
            );

            return $updated;
        });
    }

    public function rejectDiscount(int $saleId, int $managerId, string $managerName, string $reason): SalesOrderSnapshot
    {
        $now = $this->clock->now();

        /** @var SalesOrderSnapshot */
        return $this->transactions->run(function () use ($saleId, $managerId, $managerName, $reason, $now): SalesOrderSnapshot {
            $locked = $this->orders->lockForUpdate($saleId);
            $updated = $this->orders->markDiscountRejected($locked->id, $managerId, $reason, $now);

            $this->auditLogger->record(
                action: 'sales_order.discount_rejected',
                description: "Manager {$managerName} rejected discount on order #{$locked->orderNumber}. Reason: {$reason}",
                subjectType: 'App\\Models\\Sale',
                subjectId: $locked->id,
                tenantId: $locked->tenantId,
                userId: $managerId,
            );

            return $updated;
        });
    }
}

