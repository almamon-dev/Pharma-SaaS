<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Application\DTO;

use DateTimeImmutable;

final readonly class ShiftSessionSnapshot
{
    /**
     * @param  array<int, int>|null  $openingDenominations
     * @param  array<int, int>|null  $closingDenominations
     * @param  array<string, mixed>|null  $zReportSnapshot
     */
    public function __construct(
        public int $id,
        public int $tenantId,
        public int $branchId,
        public int $counterId,
        public string $counterCode,
        public string $counterName,
        public ?string $counterZone,
        public int $cashierId,
        public string $cashierName,
        public ?int $closedById,
        public ?string $closedByName,
        public string $tenantName,
        public string $currencyCode,
        public ?string $branchName,
        public ?string $branchAddress,
        public ?string $branchPhone,
        public string $status,
        public string $shift,
        public ?string $zReportNumber,
        public bool $isForceClosed,
        public ?string $forceCloseReason,
        public ?DateTimeImmutable $openedAt,
        public ?DateTimeImmutable $closedAt,
        public string $openingFloat,
        public ?array $openingDenominations,
        public ?string $closingCashCounted,
        public ?array $closingDenominations,
        public string $systemExpectedCash,
        public ?string $discrepancy,
        public ?string $notes,
        public ?array $zReportSnapshot,
    ) {}
}

