<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Application\Ports;

use App\Modules\CashCounter\Application\DTO\ShiftSessionSnapshot;
use DateTimeImmutable;

interface ShiftSessionRepository
{
    public function findOpenByUserForUpdate(int $tenantId, int $userId): ?ShiftSessionSnapshot;

    public function findOpenByUser(int $tenantId, int $userId): ?ShiftSessionSnapshot;

    public function findOpenByCounterForUpdate(int $tenantId, int $counterId): ?ShiftSessionSnapshot;

    public function findById(int $sessionId): ShiftSessionSnapshot;

    /**
     * @param  array<int, int>|null  $openingDenominations
     */
    public function createOpenSession(
        int $tenantId,
        int $branchId,
        int $counterId,
        int $cashierId,
        string $shift,
        DateTimeImmutable $openedAt,
        string $openingFloat,
        ?array $openingDenominations,
        ?string $notes,
    ): ShiftSessionSnapshot;

    /**
     * Record a non-sale cash drawer movement and return its created ID.
     */
    public function createCashMovement(
        int $tenantId,
        int $branchId,
        int $counterId,
        int $sessionId,
        int $actorId,
        ?int $approvedById,
        string $type,
        string $amount,
        string $reason,
        ?string $referenceNumber,
        ?string $notes,
        DateTimeImmutable $occurredAt,
    ): int;

    /**
     * Update live drawer totals on an open session.
     *
     * @param  array<string, string>  $totals
     */
    public function updateOpenTotals(int $sessionId, array $totals): void;

    /**
     * End any unclosed breaks on this shift at the given close timestamp.
     */
    public function closeOpenBreaks(int $sessionId, DateTimeImmutable $closedAt): void;

    /**
     * Persist final immutable closed-shift state and Z-Report snapshot.
     *
     * @param  array<string, mixed>  $closingData
     */
    public function finalizeClosedSession(int $sessionId, array $closingData): ShiftSessionSnapshot;

    /**
     * Collect raw sales payments, cash drawer movements, and break logs for a session.
     *
     * @return array{
     *     cash_sales_paisa: int,
     *     card_sales_paisa: int,
     *     mobile_sales_paisa: int,
     *     total_sales_paisa: int,
     *     total_transactions: int,
     *     cash_in_paisa: int,
     *     cash_out_only_paisa: int,
     *     safe_drop_paisa: int,
     *     cash_refunds_paisa: int,
     *     break_count: int,
     *     total_break_minutes: int,
     *     breaks: list<array<string, mixed>>,
     *     movements: list<array<string, mixed>>,
     * }
     */
    public function collectLiveDrawerData(int $sessionId, DateTimeImmutable $now): array;
}

