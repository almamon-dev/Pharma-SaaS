<?php

declare(strict_types=1);

namespace App\Modules\CashCounter\Infrastructure\Persistence;

use App\Models\Counter;
use App\Models\CounterCashier;
use App\Modules\CashCounter\Application\DTO\CounterSnapshot;
use App\Modules\CashCounter\Application\Ports\CounterRepository;

final class EloquentCounterRepository implements CounterRepository
{
    public function lockForUpdate(int $tenantId, int $counterId): CounterSnapshot
    {
        $query = Counter::query()->where('id', $counterId);
        if ($tenantId > 0) {
            $query->where('tenant_id', $tenantId);
        }

        $counter = $query->lockForUpdate()->firstOrFail();

        return $this->toSnapshot($counter);
    }

    public function findBestAvailableCounterForCashier(int $tenantId, int $branchId, int $cashierId): ?CounterSnapshot
    {
        $assignedCounterIds = CounterCashier::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $cashierId)
            ->where('branch_id', $branchId)
            ->where('is_active', true)
            ->orderByDesc('is_primary')
            ->pluck('counter_id');

        $counter = null;

        if ($assignedCounterIds->isNotEmpty()) {
            $counter = Counter::query()
                ->whereIn('id', $assignedCounterIds)
                ->where('tenant_id', $tenantId)
                ->where('branch_id', $branchId)
                ->where('is_active', true)
                ->where(function ($q) use ($cashierId): void {
                    $q->where('status', 'closed')
                        ->orWhereNull('current_user_id')
                        ->orWhere('current_user_id', $cashierId);
                })
                ->orderByRaw('CASE WHEN id = ? THEN 0 ELSE 1 END', [$assignedCounterIds->first()])
                ->first();
        }

        if (! $counter) {
            $counter = Counter::query()
                ->where('tenant_id', $tenantId)
                ->where('branch_id', $branchId)
                ->where('is_active', true)
                ->where(function ($q) use ($cashierId): void {
                    $q->where('status', 'closed')
                        ->orWhereNull('current_user_id')
                        ->orWhere('current_user_id', $cashierId);
                })
                ->orderBy('code')
                ->first();
        }

        return $counter ? $this->toSnapshot($counter) : null;
    }

    public function markActive(int $counterId, int $cashierId): void
    {
        Counter::query()
            ->where('id', $counterId)
            ->update([
                'status' => 'active',
                'current_user_id' => $cashierId,
                'current_break_reason' => null,
                'break_started_at' => null,
            ]);
    }

    public function markClosed(int $counterId): void
    {
        Counter::query()
            ->where('id', $counterId)
            ->update([
                'status' => 'closed',
                'current_user_id' => null,
                'current_break_reason' => null,
                'break_started_at' => null,
            ]);
    }

    private function toSnapshot(Counter $counter): CounterSnapshot
    {
        return new CounterSnapshot(
            id: (int) $counter->id,
            tenantId: (int) $counter->tenant_id,
            branchId: (int) $counter->branch_id,
            code: (string) $counter->code,
            name: (string) $counter->name,
            zone: $counter->zone,
            status: (string) $counter->status,
            isActive: (bool) $counter->is_active,
            currentUserId: $counter->current_user_id !== null ? (int) $counter->current_user_id : null,
        );
    }
}

