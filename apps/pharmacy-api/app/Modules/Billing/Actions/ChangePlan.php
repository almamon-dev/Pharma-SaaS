<?php

namespace App\Modules\Billing\Actions;

use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Billing\Events\PlanChanged;
use App\Modules\Billing\Models\Plan;
use App\Modules\Billing\Models\Subscription;
use App\Modules\Billing\Models\SubscriptionEvent;
use App\Modules\Billing\Support\PlanChangeImpact;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ChangePlan
{
    /**
     * Execute plan change atomically.
     */
    public function execute(
        Tenant $tenant,
        Plan $newPlan,
        string $billingCycle = 'monthly',
        ?User $actor = null,
        ?string $reason = null
    ): Subscription {
        // 1. Run impact evaluation
        $impact = PlanChangeImpact::evaluate($tenant, $newPlan);

        return app(\App\Tenancy\CurrentTenant::class)->run($tenant, function () use ($tenant, $newPlan, $billingCycle, $actor, $reason, $impact) {
            return DB::transaction(function () use ($tenant, $newPlan, $billingCycle, $actor, $reason, $impact) {
                // Find current active/latest subscription
                $currentSub = Subscription::withoutGlobalScopes()
                    ->where('tenant_id', $tenant->id)
                    ->orderByDesc('ends_at')
                    ->first();

                $oldPlanId = $currentSub?->plan_id;
                $oldStatus = $currentSub?->status;

                // If current subscription is still active/trial/grace, end it
                if ($currentSub && in_array($currentSub->status, [
                    Subscription::STATUS_ACTIVE,
                    Subscription::STATUS_TRIAL,
                    Subscription::STATUS_GRACE,
                ], true)) {
                    $currentSub->status = Subscription::STATUS_CANCELLED;
                    $currentSub->save();

                    SubscriptionEvent::create([
                        'tenant_id' => $tenant->id,
                        'subscription_id' => $currentSub->id,
                        'from_status' => $oldStatus,
                        'to_status' => Subscription::STATUS_CANCELLED,
                        'reason' => 'Superseded by new plan subscription',
                        'actor_type' => $actor ? get_class($actor) : null,
                        'actor_id' => $actor?->id,
                        'created_at' => now(),
                    ]);
                }

                $startsAt = now();
                $endsAt = $billingCycle === 'yearly'
                    ? now()->copy()->addYear()
                    : now()->copy()->addMonth();

                // Create new subscription
                $newSub = Subscription::create([
                    'tenant_id' => $tenant->id,
                    'plan_id' => $newPlan->id,
                    'billing_cycle' => $billingCycle,
                    'status' => Subscription::STATUS_ACTIVE,
                    'starts_at' => $startsAt,
                    'ends_at' => $endsAt,
                    'auto_renew' => true,
                ]);

                // Create subscription event
                SubscriptionEvent::create([
                    'tenant_id' => $tenant->id,
                    'subscription_id' => $newSub->id,
                    'from_status' => $oldStatus,
                    'to_status' => Subscription::STATUS_ACTIVE,
                    'reason' => $reason ?: "Subscribed to {$newPlan->name} ({$billingCycle})",
                    'actor_type' => $actor ? get_class($actor) : null,
                    'actor_id' => $actor?->id,
                    'created_at' => now(),
                ]);

                // Audit log
                AuditLog::record(
                    action: 'billing.plan_changed',
                    description: "Changed plan to {$newPlan->name} ({$billingCycle}).",
                    subject: $newSub,
                    metadata: [
                        'old_plan_id' => $oldPlanId,
                        'new_plan_id' => $newPlan->id,
                        'billing_cycle' => $billingCycle,
                        'actor' => $actor?->email,
                        'impact' => $impact,
                    ],
                    tenantId: $tenant->id,
                );

                // Dispatch event for cache invalidation & permission version bumping
                PlanChanged::dispatch($tenant->id, $newSub, $oldPlanId, $newPlan->id);

                return $newSub;
            });
        });
    }
}
