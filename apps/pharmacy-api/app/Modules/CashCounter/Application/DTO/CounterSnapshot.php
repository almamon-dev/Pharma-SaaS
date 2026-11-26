<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Application\DTO;

final readonly class CounterSnapshot
{
    public function __construct(
        public int $id,
        public int $tenantId,
        public int $branchId,
        public string $code,
        public string $name,
        public ?string $zone,
        public string $status,
        public bool $isActive,
        public ?int $currentUserId,
    ) {}
}

