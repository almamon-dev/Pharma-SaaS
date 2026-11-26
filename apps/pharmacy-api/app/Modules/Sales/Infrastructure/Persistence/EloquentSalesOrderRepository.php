<?php

declare(strict_types=1);

namespace App\Modules\Sales\Infrastructure\Persistence;

use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePayment;
use App\Models\User;
use App\Modules\Sales\Application\DTO\SalesOrderSnapshot;
use App\Modules\Sales\Application\Ports\SalesOrderRepository;
use App\Modules\Sales\Domain\PaymentSettlement;
use DateTimeImmutable;

final class EloquentSalesOrderRepository implements SalesOrderRepository
{
    public function lockForUpdate(int $saleId): SalesOrderSnapshot
    {
        /** @var Sale $sale */
        $sale = Sale::query()->where('id', $saleId)->lockForUpdate()->firstOrFail();

        return $this->toSnapshot($sale);
    }

    public function markProcessing(
        int $saleId,
        int $cashierId,
        string $cashierName,
        DateTimeImmutable $startedAt,
    ): SalesOrderSnapshot {
        /** @var Sale $sale */
        $sale = Sale::query()->findOrFail($saleId);
        $cashier = User::query()->find($cashierId);

        $sale->cashier_id = $cashierId;
        $sale->processing_started_at = $startedAt;
        $sale->recordStatus(
            toStatus: 'processing',
            user: $cashier,
            reason: "Cashier {$cashierName} accepted order for processing.",
        );

        return $this->toSnapshot($sale->fresh());
    }

    public function recordPaymentSettlement(
        int $saleId,
        int $tenantId,
        int $cashierId,
        int $counterId,
        ?int $counterSessionId,
        string $invoiceNumber,
        PaymentSettlement $settlement,
        DateTimeImmutable $completedAt,
    ): SalesOrderSnapshot {
        /** @var Sale $sale */
        $sale = Sale::query()->findOrFail($saleId);
        $cashier = User::query()->find($cashierId);

        foreach ($settlement->normalizedLines as $line) {
            SalePayment::query()->create([
                'tenant_id' => $tenantId,
                'sale_id' => $sale->id,
                'payment_method' => $line['method'],
                'amount' => $line['amount'],
                'reference_number' => $line['reference_number'],
            ]);
        }

        $sale->update([
            'invoice_number' => $invoiceNumber,
            'paid_amount' => $settlement->totalPaid->toDecimalString(),
            'due_amount' => $settlement->dueAmount->toDecimalString(),
            'change_amount' => $settlement->changeAmount->toDecimalString(),
            'payment_method' => $settlement->primaryMethodLabel,
            'payment_status' => $settlement->paymentStatus,
            'cashier_id' => $cashierId,
            'counter_id' => $counterId,
            'counter_session_id' => $counterSessionId,
            'completed_at' => $completedAt,
        ]);

        $sale->recordStatus(
            toStatus: 'completed',
            user: $cashier,
            reason: "Payment confirmed via {$settlement->primaryMethodLabel}. Invoice #{$invoiceNumber} issued.",
        );

        return $this->toSnapshot($sale->fresh());
    }

    public function markCancelled(
        int $saleId,
        int $actorId,
        string $reason,
        DateTimeImmutable $cancelledAt,
    ): SalesOrderSnapshot {
        /** @var Sale $sale */
        $sale = Sale::query()->findOrFail($saleId);
        $actor = User::query()->find($actorId);

        $sale->cancelled_at = $cancelledAt;
        $sale->cancellation_reason = $reason;
        $sale->recordStatus(
            toStatus: 'cancelled',
            user: $actor,
            reason: $reason,
        );

        return $this->toSnapshot($sale->fresh());
    }

    public function deleteDraft(int $saleId): void
    {
        SaleItem::query()->where('sale_id', $saleId)->delete();
        Sale::query()->where('id', $saleId)->delete();
    }

    public function markDiscountApproved(
        int $saleId,
        int $managerId,
        DateTimeImmutable $approvedAt,
    ): SalesOrderSnapshot {
        /** @var Sale $sale */
        $sale = Sale::query()->findOrFail($saleId);
        $sale->discount_status = 'approved';
        $sale->discount_approved_by = $managerId;
        $sale->discount_approved_at = $approvedAt;
        $sale->discount_rejection_reason = null;
        $sale->save();

        return $this->toSnapshot($sale->fresh());
    }

    public function markDiscountRejected(
        int $saleId,
        int $managerId,
        string $reason,
        DateTimeImmutable $rejectedAt,
    ): SalesOrderSnapshot {
        /** @var Sale $sale */
        $sale = Sale::query()->findOrFail($saleId);
        $sale->discount_status = 'rejected';
        $sale->discount_approved_by = $managerId;
        $sale->discount_approved_at = $rejectedAt;
        $sale->discount_rejection_reason = $reason;
        $sale->save();

        return $this->toSnapshot($sale->fresh());
    }

    private function toSnapshot(Sale $sale): SalesOrderSnapshot
    {
        return new SalesOrderSnapshot(
            id: (int) $sale->id,
            tenantId: (int) $sale->tenant_id,
            branchId: (int) $sale->branch_id,
            customerId: $sale->customer_id !== null ? (int) $sale->customer_id : null,
            orderNumber: (string) ($sale->order_number ?? ''),
            invoiceNumber: $sale->invoice_number,
            orderStatus: (string) $sale->order_status,
            totalAmount: (string) $sale->total_amount,
            discountAmount: (string) $sale->discount_amount,
        );
    }
}

