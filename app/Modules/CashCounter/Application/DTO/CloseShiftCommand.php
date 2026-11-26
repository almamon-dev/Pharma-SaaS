<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Application\DTO;

final readonly class CloseShiftCommand
{
    /**
     * @param  array<int|string, int|string|null>|null  $closingDenominations
     */
    public function __construct(
        public int $counterId,
        public int $actorId,
        public string $actorName,
        public string|int|float|null $closingCashCounted = null,
        public ?array $closingDenominations = null,
        public ?string $notes = null,
        public bool $canOverrideOwnership = false,
        public bool $isForceClose = false,
        public ?string $forceCloseReason = null,
        public string $currencyCode = 'BDT',
    ) {}
}

