<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Application\DTO;

final readonly class AdjustBatchCommand
{
    public function __construct(
        public int $batchId,
        public string $movementType,
        public string $movementLabel,
        public int $quantity,
        public string $reason,
        public ?string $notes = null,
        public ?int $actorId = null,
        public bool $disposeEntireBatch = false,
    ) {}
}

