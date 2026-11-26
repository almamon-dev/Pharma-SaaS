<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Application\DTO;

final readonly class TransferBatchCommand
{
    public function __construct(
        public int $sourceBatchId,
        public int $targetBranchId,
        public string $targetBranchName,
        public int $quantity,
        public ?string $reason = null,
        public ?string $notes = null,
        public ?int $actorId = null,
    ) {}
}

