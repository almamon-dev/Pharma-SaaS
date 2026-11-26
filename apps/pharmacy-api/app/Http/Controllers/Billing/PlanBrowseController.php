<?php

namespace App\Http\Controllers\Billing;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Modules\Billing\Models\Plan;
use App\Modules\Billing\Models\Subscription;
use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Billing\Support\PlanChangeImpact;
use App\Modules\Billing\Support\SubscriptionState;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PlanBrowseController extends Controller
{
    public function index(Request $request, TenantContext $tenantContext, FeatureManager $featureManager): Response
    {
        $user = $request->user();
        $tenant = $tenantContext->tenant();

        $plans = Plan::with(['prices', 'planFeatures.feature'])
            ->where('is_active', true)
            ->where('is_public', true) // 'trial' is hidden
            ->orderBy('sort')
            ->get()
            ->map(function (Plan $plan) {
                return [
                    'id' => $plan->id,
                    'code' => $plan->code,
                    'name' => $plan->name,
                    'monthly_price' => (float) ($plan->priceFor('monthly')?->amount ?? 0),
                    'yearly_price' => (float) ($plan->priceFor('yearly')?->amount ?? 0),
                    'currency' => $plan->priceFor('monthly')?->currency ?? 'BDT',
                    'features' => $plan->planFeatures->mapWithKeys(function ($pf) {
                        return [
                            $pf->feature_key => [
                                'type' => $pf->feature?->type ?? 'boolean',
                                'bool_value' => (bool) $pf->bool_value,
                                'limit_value' => $pf->limit_value,
                                'level_value' => $pf->level_value,
                            ],
                        ];
                    }),
                ];
            });

        $currentSub = null;
        $subMeta = null;
        if ($tenant) {
            $featureManager->setTenant($tenant);
            $subMeta = $featureManager->subscriptionMeta();
            $currentSub = Subscription::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->orderByDesc('ends_at')
                ->first();
        }

        return Inertia::render('Billing/BrowsePlans', [
            'plans' => $plans,
            'currentPlanCode' => $subMeta['plan_code'] ?? 'none',
            'currentBillingCycle' => $subMeta['billing_cycle'] ?? 'monthly',
            'subscription' => $subMeta,
            'statusBadge' => SubscriptionState::statusBadge($currentSub),
            'banner' => SubscriptionState::banner($currentSub),
            'isWritable' => SubscriptionState::isWritable($currentSub),
            'tenant' => $tenant ? ['id' => $tenant->id, 'name' => $tenant->name] : null,
            'canManageBilling' => $tenant ? ($user->isOwnerOf($tenant) || $user->hasPermission('billing.manage')) : true,
        ]);
    }

    /**
     * Return impact warnings when switching to target plan.
     */
    public function impact(Plan $plan, TenantContext $tenantContext): JsonResponse
    {
        $tenant = $tenantContext->tenant();
        if (! $tenant) {
            return response()->json(['error' => 'No active tenant context.'], 400);
        }

        $impact = PlanChangeImpact::evaluate($tenant, $plan);

        return response()->json($impact);
    }
}

