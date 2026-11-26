<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Application\DTO;

final readonly class BatchSnapshot
{
    public function __construct(
        public int $id,
        public int $tenantId,
        public int $branchId,
        public ?string $branchName,
        public int $medicineId,
        public ?int $supplierId,
        public string $batchNumber,
        public ?string $manufacturingDate,
        public string $expiryDate,
        public int $quantityReceived,
        public int $quantityAvailable,
        public float $purchasePrice,
        public float $sellingPrice,
        public ?string $rackLocation,
        public string $status,
        public bool $isExpired,
    ) {}
}

