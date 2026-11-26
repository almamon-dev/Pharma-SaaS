<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Application\DTO;

final readonly class RecordCashMovementCommand
{
    public function __construct(
        public int $counterId,
        public string $counterCode,
        public int $actorId,
        public string $actorName,
        public string $type,
        public string|int|float $amount,
        public string $reason,
        public ?string $referenceNumber = null,
        public ?string $notes = null,
        public bool $canOverrideOwnership = false,
        public string $currencyCode = 'BDT',
    ) {}
}

