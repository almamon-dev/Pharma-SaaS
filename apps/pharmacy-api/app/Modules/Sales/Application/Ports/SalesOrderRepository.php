<?php

declare(strict_types=1);

namespace App\Modules\Sales\Application\Ports;

use App\Modules\Sales\Application\DTO\SalesOrderSnapshot;
use App\Modules\Sales\Domain\PaymentSettlement;
use DateTimeImmutable;

interface SalesOrderRepository
{
    public function lockForUpdate(int $saleId): SalesOrderSnapshot;

    public function markProcessing(
        int $saleId,
        int $cashierId,
        string $cashierName,
        DateTimeImmutable $startedAt,
    ): SalesOrderSnapshot;

    public function recordPaymentSettlement(
        int $saleId,
        int $tenantId,
        int $cashierId,
        int $counterId,
        ?int $counterSessionId,
        string $invoiceNumber,
        PaymentSettlement $settlement,
        DateTimeImmutable $completedAt,
    ): SalesOrderSnapshot;

    public function markCancelled(
        int $saleId,
        int $actorId,
        string $reason,
        DateTimeImmutable $cancelledAt,
    ): SalesOrderSnapshot;

    public function deleteDraft(int $saleId): void;

    public function markDiscountApproved(
        int $saleId,
        int $managerId,
        DateTimeImmutable $approvedAt,
    ): SalesOrderSnapshot;

    public function markDiscountRejected(
        int $saleId,
        int $managerId,
        string $reason,
        DateTimeImmutable $rejectedAt,
    ): SalesOrderSnapshot;
}

