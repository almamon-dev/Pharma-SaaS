<?php

namespace App\Services\Commercial;

use App\Models\AuditLog;
use App\Models\Module;
use App\Models\SaasPlan;
use App\Models\SubscriptionLedger;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SubscriptionService
{
    public function activate(
        User $admin,
        SaasPlan $plan,
        string $billingCycle = 'monthly',
        string $paymentMethod = 'trial',
        ?Tenant $primaryTenant = null,
        ?string $idempotencyKey = null,
        ?string $forcedStatus = null,
    ): TenantSubscription {
        return DB::transaction(function () use (
            $admin,
            $plan,
            $billingCycle,
            $paymentMethod,
            $primaryTenant,
            $idempotencyKey,
            $forcedStatus
        ): TenantSubscription {
            if ($idempotencyKey) {
                $existingLedger = SubscriptionLedger::query()
                    ->where('idempotency_key', $idempotencyKey)
                    ->first();

                if ($existingLedger && $existingLedger->subscription) {
                    return $existingLedger->subscription()->with('plan')->firstOrFail();
                }
            }

            $tenant = $primaryTenant
                ?? $admin->currentTenant
                ?? $admin->ownedTenants()->orderBy('id')->first();

            if (! $tenant) {
                throw new \LogicException('A business tenant must exist before activating a subscription.');
            }

            $subscription = TenantSubscription::query()
                ->where('tenant_id', $tenant->id)
                ->lockForUpdate()
                ->firstOrNew(['tenant_id' => $tenant->id]);

            $before = $subscription->exists ? $subscription->toArray() : null;

            $cycleNormalized = $billingCycle === 'yearly' ? 'annual' : $billingCycle;
            $isTrial = $paymentMethod === 'trial' && $forcedStatus === null;
            $now = now();
            $trialDays = max(1, (int) ($plan->trial_days ?: 14));
            $periodEnd = $isTrial
                ? $now->copy()->addDays($trialDays)
                : ($cycleNormalized === 'annual' ? $now->copy()->addYear() : $now->copy()->addMonth());

            $unitPrice = $isTrial
                ? 0
                : ($cycleNormalized === 'annual' ? (float) $plan->annual_price : (float) $plan->monthly_price);

            $status = $forcedStatus ?? ($isTrial ? 'trialing' : 'active');

            $subscription->fill([
                'tenant_id' => $tenant->id,
                'user_id' => $admin->id,
                'saas_plan_id' => $plan->id,
                'status' => $status,
                'billing_cycle' => $cycleNormalized,
                'currency_code' => $plan->currency_code ?: 'USD',
                'unit_price' => $unitPrice,
                'discount_amount' => 0,
                'tax_percent' => 0,
                'payment_method' => $paymentMethod,
                'transaction_ref' => $isTrial
                    ? 'TRIAL-'.strtoupper(Str::random(8))
                    : 'PAY-'.strtoupper(Str::random(10)),
                'trial_ends_at' => $isTrial ? $periodEnd : null,
                'current_period_starts_at' => $now,
                'current_period_ends_at' => $periodEnd,
                'cancelled_at' => $status === 'cancelled' ? $now : null,
                'version' => $subscription->exists ? ((int) $subscription->version + 1) : 1,
            ]);
            $subscription->save();

            if ($admin->account_type !== 'admin' && ! $admin->isSuperAdmin()) {
                $admin->forceFill(['account_type' => 'admin'])->save();
            }

            $plan->loadMissing('modules');
            $coreModuleIds = Module::query()->where('is_core', true)->pluck('id');
            $allowedModuleIds = $plan->modules->pluck('id')->merge($coreModuleIds)->unique();
            $allModules = Module::query()->get();
            $modulesDisabled = in_array($status, ['suspended', 'cancelled', 'expired'], true);

            $ownedTenants = Tenant::query()->where('owner_id', $admin->id)->get();
            if ($ownedTenants->isEmpty()) {
                $ownedTenants = collect([$tenant]);
            }

            foreach ($ownedTenants as $targetTenant) {
                if ($targetTenant->trial_ends_at === null && $isTrial) {
                    $targetTenant->forceFill(['trial_ends_at' => $periodEnd])->save();
                }

                $this->syncModulesForTenant($targetTenant, $plan, $status);
            }

            SubscriptionLedger::query()->create([
                'tenant_id' => $tenant->id,
                'tenant_subscription_id' => $subscription->id,
                'actor_id' => auth()->id() ?? $admin->id,
                'event' => $before ? 'subscription.updated' : 'subscription.created',
                'idempotency_key' => $idempotencyKey ?? (string) Str::uuid(),
                'before' => $before,
                'after' => $subscription->fresh()->toArray(),
            ]);

            AuditLog::record(
                action: 'subscription.activated',
                description: ($isTrial ? "Started {$trialDays}-day trial" : 'Activated subscription')." for plan \"{$plan->name}\" ({$cycleNormalized}).",
                subject: $subscription,
                metadata: [
                    'plan_key' => $plan->key,
                    'billing_cycle' => $cycleNormalized,
                    'payment_method' => $paymentMethod,
                    'amount' => $unitPrice,
                ],
                tenantId: $tenant->id,
                userId: $admin->id,
            );

            return $subscription->fresh('plan');
        }, 3);
    }

    public function syncModulesForTenant(Tenant $tenant, ?SaasPlan $plan, string $status = 'active'): void
    {
        $now = now();
        $allModules = Module::query()->get();
        $modulesDisabled = in_array($status, ['suspended', 'cancelled', 'expired'], true);

        if ($plan) {
            $plan->loadMissing('modules');
        }
        $planModuleIds = $plan ? $plan->modules->pluck('id') : collect();

        $syncPayload = [];
        foreach ($allModules as $module) {
            $enabled = ! $modulesDisabled
                && $module->is_active
                && ($module->is_core || $planModuleIds->contains($module->id));

            $syncPayload[$module->id] = [
                'is_enabled' => $enabled,
                'enabled_at' => $enabled ? $now : null,
            ];
        }

        if (empty($syncPayload)) {
            return;
        }

        $tenant->modules()->syncWithoutDetaching($syncPayload);
        foreach ($syncPayload as $moduleId => $pivotData) {
            DB::table('tenant_modules')
                ->where('tenant_id', $tenant->id)
                ->where('module_id', $moduleId)
                ->update([
                    'is_enabled' => $pivotData['is_enabled'],
                    'enabled_at' => $pivotData['enabled_at'],
                    'updated_at' => $now,
                ]);
        }
    }

    public function syncPlanEntitlementsToSubscribers(SaasPlan $plan): void
    {
        $plan->load('modules');

        $subscriptions = TenantSubscription::query()
            ->where('saas_plan_id', $plan->id)
            ->with('subscriber')
            ->get();

        foreach ($subscriptions as $subscription) {
            $tenants = $subscription->subscriber
                ? Tenant::query()->where('owner_id', $subscription->subscriber->id)->get()
                : Tenant::query()->where('id', $subscription->tenant_id)->get();

            foreach ($tenants as $tenant) {
                $this->syncModulesForTenant($tenant, $plan, $subscription->status);
            }
        }
    }

    public function syncAllActiveTenants(): void
    {
        $subscriptions = TenantSubscription::query()
            ->with(['plan.modules', 'subscriber'])
            ->get();

        foreach ($subscriptions as $subscription) {
            $tenants = $subscription->subscriber
                ? Tenant::query()->where('owner_id', $subscription->subscriber->id)->get()
                : Tenant::query()->where('id', $subscription->tenant_id)->get();

            foreach ($tenants as $tenant) {
                $this->syncModulesForTenant($tenant, $subscription->plan, $subscription->status);
            }
        }
    }
}
