<?php

namespace App\Services;

use App\Events\SalesOrderAssigned;
use App\Events\SalesOrderReassigned;
use App\Events\UnassignedOrderAlert;
use App\Models\AuditLog;
use App\Models\Counter;
use App\Models\CounterAssignment;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CounterAssignmentService
{
    /**
     * Dynamically assign a sales order to the optimal counter.
     */
    public function assignOrder(
        Sale $sale,
        ?User $assigner = null,
        ?int $targetCounterId = null,
        ?string $reason = null
    ): ?CounterAssignment {
        return DB::transaction(function () use ($sale, $assigner, $targetCounterId, $reason): ?CounterAssignment {
            // Lock the sale row to prevent concurrent assignment
            $lockedSale = Sale::query()
                ->where('id', $sale->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($lockedSale->order_status, ['paid', 'completed', 'cancelled'], true)) {
                throw ValidationException::withMessages([
                    'order' => ["Order #{$lockedSale->order_number} is already {$lockedSale->order_status} and cannot be assigned."],
                ]);
            }

            $counter = null;

            if ($targetCounterId) {
                // Manual Assignment to specific counter
                $counter = Counter::query()
                    ->where('id', $targetCounterId)
                    ->where('tenant_id', $lockedSale->tenant_id)
                    ->where('branch_id', $lockedSale->branch_id)
                    ->lockForUpdate()
                    ->first();

                if (! $counter) {
                    throw ValidationException::withMessages([
                        'counter' => ['The specified counter was not found in this branch.'],
                    ]);
                }
            } else {
                // Automatic Dynamic Assignment Engine
                $counter = $this->findBestAvailableCounter($lockedSale->tenant_id, $lockedSale->branch_id);
            }

            if (! $counter) {
                // Place into Unassigned Queue
                $lockedSale->counter_id = null;
                $lockedSale->recordStatus(
                    toStatus: 'unassigned',
                    user: $assigner,
                    reason: 'No available online counter with open cashier session and queue capacity.'
                );

                AuditLog::record(
                    action: 'sales_order.unassigned',
                    description: "Order #{$lockedSale->order_number} placed in Unassigned Queue: No counter available.",
                    subject: $lockedSale,
                    metadata: ['sale_id' => $lockedSale->id]
                );

                event(new UnassignedOrderAlert(
                    sale: $lockedSale,
                    reason: 'All counters offline, closed, or full.'
                ));

                return null;
            }

            // Close any previous active assignment for this sale
            CounterAssignment::query()
                ->where('sale_id', $lockedSale->id)
                ->where('status', 'active')
                ->update([
                    'status' => 'reassigned',
                    'completed_at' => now(),
                ]);

            $assignmentType = $targetCounterId ? ($assigner ? 'manual' : 'automatic') : 'automatic';

            $assignment = CounterAssignment::query()->create([
                'tenant_id' => $lockedSale->tenant_id,
                'branch_id' => $lockedSale->branch_id,
                'sale_id' => $lockedSale->id,
                'counter_id' => $counter->id,
                'cashier_id' => $counter->current_user_id,
                'assigned_by' => $assigner?->id,
                'assignment_type' => $assignmentType,
                'status' => 'active',
                'assigned_at' => now(),
                'notes' => $reason,
            ]);

            // Update Counter last_assigned_at for round-robin balancing
            $counter->update([
                'last_assigned_at' => now(),
            ]);

            // Update Sale
            $lockedSale->counter_id = $counter->id;
            $lockedSale->counter_session_id = $counter->currentSession?->id;
            $lockedSale->assigned_at = now();
            $lockedSale->recordStatus(
                toStatus: 'assigned',
                user: $assigner,
                reason: $reason ?? "Assigned to Counter {$counter->name} ({$counter->code}) via {$assignmentType} engine."
            );

            AuditLog::record(
                action: 'sales_order.assigned',
                description: "Order #{$lockedSale->order_number} assigned to Counter {$counter->code} ({$counter->name}).",
                subject: $lockedSale,
                metadata: [
                    'counter_id' => $counter->id,
                    'assignment_type' => $assignmentType,
                ]
            );

            event(new SalesOrderAssigned($lockedSale, $counter, $assignmentType));

            return $assignment;
        });
    }

    /**
     * Find best available counter based on strict queue count and Round-Robin.
     */
    public function findBestAvailableCounter(int $tenantId, int $branchId): ?Counter
    {
        // Eligible counters:
        // 1. Same tenant and branch
        // 2. is_active = true
        // 3. auto_assignment_enabled = true
        // 4. status = 'active'
        // 5. current_user_id IS NOT NULL
        // 6. Has active open CounterSession
        // 7. Active queue count < max_queue_capacity
        // Ordered by: active_queue_count ASC, last_assigned_at ASC NULLS FIRST, id ASC
        return Counter::query()
            ->where('tenant_id', $tenantId)
            ->where('branch_id', $branchId)
            ->where('is_active', true)
            ->where('auto_assignment_enabled', true)
            ->where('status', 'active')
            ->whereNotNull('current_user_id')
            ->whereHas('sessions', fn ($q) => $q->where('status', 'open'))
            ->withCount([
                'sales as active_queue_count' => fn ($q) => $q->whereIn('order_status', ['assigned', 'waiting', 'processing']),
            ])
            ->whereRaw('
                (SELECT count(*) FROM sales
                 WHERE sales.counter_id = counters.id
                 AND sales.order_status IN (\'assigned\', \'waiting\', \'processing\')
                ) < COALESCE(counters.max_queue_capacity, 20)
            ')
            ->orderBy('active_queue_count', 'asc')
            ->orderByRaw('last_assigned_at ASC NULLS FIRST')
            ->orderBy('id', 'asc')
            ->lockForUpdate()
            ->first();
    }

    /**
     * Reassign an order to a different counter (Manager override).
     */
    public function reassignOrder(
        Sale $sale,
        int $newCounterId,
        User $manager,
        string $reason
    ): CounterAssignment {
        return DB::transaction(function () use ($sale, $newCounterId, $manager, $reason): CounterAssignment {
            $lockedSale = Sale::query()
                ->where('id', $sale->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($lockedSale->order_status, ['paid', 'completed'], true)) {
                throw ValidationException::withMessages([
                    'order' => ["Order #{$lockedSale->order_number} has already been paid/completed and cannot be reassigned."],
                ]);
            }

            $oldCounter = $lockedSale->counter;

            $newCounter = Counter::query()
                ->where('id', $newCounterId)
                ->where('tenant_id', $lockedSale->tenant_id)
                ->where('branch_id', $lockedSale->branch_id)
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();

            if (! $newCounter) {
                throw ValidationException::withMessages([
                    'counter' => ['Target counter is invalid or inactive.'],
                ]);
            }

            // Close previous assignment
            CounterAssignment::query()
                ->where('sale_id', $lockedSale->id)
                ->where('status', 'active')
                ->update([
                    'status' => 'reassigned',
                    'completed_at' => now(),
                ]);

            // Create new assignment
            $assignment = CounterAssignment::query()->create([
                'tenant_id' => $lockedSale->tenant_id,
                'branch_id' => $lockedSale->branch_id,
                'sale_id' => $lockedSale->id,
                'counter_id' => $newCounter->id,
                'cashier_id' => $newCounter->current_user_id,
                'assigned_by' => $manager->id,
                'assignment_type' => 'reassigned',
                'status' => 'active',
                'assigned_at' => now(),
                'notes' => $reason,
            ]);

            $lockedSale->counter_id = $newCounter->id;
            $lockedSale->counter_session_id = $newCounter->currentSession?->id;
            $lockedSale->recordStatus(
                toStatus: 'reassigned',
                user: $manager,
                reason: "Reassigned from Counter {$oldCounter?->name} to {$newCounter->name}. Reason: {$reason}"
            );

            // Set back to assigned
            $lockedSale->recordStatus(
                toStatus: 'assigned',
                user: $manager,
                reason: "Active in queue for Counter {$newCounter->name}."
            );

            AuditLog::record(
                action: 'sales_order.reassigned',
                description: "Order #{$lockedSale->order_number} reassigned by {$manager->name} to Counter {$newCounter->code}. Reason: {$reason}",
                subject: $lockedSale,
                metadata: [
                    'old_counter_id' => $oldCounter?->id,
                    'new_counter_id' => $newCounter->id,
                    'reason' => $reason,
                ]
            );

            event(new SalesOrderReassigned($lockedSale, $oldCounter, $newCounter, $reason));

            return $assignment;
        });
    }

    /**
     * Retry assigning pending unassigned orders when a counter becomes available.
     */
    public function processUnassignedQueue(int $tenantId, int $branchId): int
    {
        $unassignedOrders = Sale::query()
            ->where('tenant_id', $tenantId)
            ->where('branch_id', $branchId)
            ->where('order_status', 'unassigned')
            ->orderBy('created_at', 'asc')
            ->limit(10)
            ->get();

        $assignedCount = 0;

        foreach ($unassignedOrders as $order) {
            $assignment = $this->assignOrder($order);
            if ($assignment) {
                $assignedCount++;
            } else {
                // No more capacity
                break;
            }
        }

        return $assignedCount;
    }
}

