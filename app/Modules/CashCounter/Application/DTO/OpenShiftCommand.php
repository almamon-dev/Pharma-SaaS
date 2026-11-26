<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Application\DTO;

final readonly class OpenShiftCommand
{
    /**
     * @param  array<int|string, int|string|null>|null  $openingDenominations
     */
    public function __construct(
        public int $tenantId,
        public int $branchId,
        public int $counterId,
        public int $cashierId,
        public string $cashierName,
        public string|int|float $openingFloat = 0,
        public ?string $shift = null,
        public ?string $notes = null,
        public bool $autoSeated = false,
        public ?array $openingDenominations = null,
        public string $currencyCode = 'BDT',
    ) {}
}

