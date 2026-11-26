<?php

declare(strict_types=1);

namespace App\Modules\Sales\Application\DTO;

final readonly class SalesOrderSnapshot
{
    public function __construct(
        public int $id,
        public int $tenantId,
        public int $branchId,
        public ?int $customerId,
        public string $orderNumber,
        public ?string $invoiceNumber,
        public string $orderStatus,
        public string $totalAmount,
        public string $discountAmount,
    ) {}
}

