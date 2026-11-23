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

class FeatureAccessController extends Controller
{
    public function index(Request $request, TenantContext $tenantContext, FeatureManager $featureManager): Response
    {
        $user = $request->user();
        $tenant = $tenantContext->tenant();

        if (! $tenant) {
            abort(403, 'A tenant context is required.');
        }

        $featureManager->setTenant($tenant);
        $features = $featureManager->all();
        $subMeta = $featureManager->subscriptionMeta();

        $currentSub = Subscription::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('ends_at')
            ->first();

        // 5 primary operating limits with percentage for progress bars
        $limitKeys = [
            'max_users' => ['label' => 'Staff / Employees', 'icon' => 'users'],
            'max_branches' => ['label' => 'Pharmacy Branches', 'icon' => 'store'],
            'max_products' => ['label' => 'Medicines & Products', 'icon' => 'pill'],
            'max_bills_month' => ['label' => 'Monthly POS Bills', 'icon' => 'receipt'],
            'sms_quota_month' => ['label' => 'Monthly SMS Messages', 'icon' => 'message-square'],
        ];

        $operatingLimits = [];
        foreach ($limitKeys as $key => $meta) {
            $limit = $featureManager->limit($key);
            $used = $featureManager->used($key);
            $remaining = $featureManager->remaining($key);
            $percent = $limit !== null && $limit > 0 ? min(100, (int) round(($used / $limit) * 100)) : 0;

            $status = 'normal';
            if ($limit !== null) {
                if ($percent >= 100) {
                    $status = 'exceeded';
                } elseif ($percent >= 80) {
                    $status = 'warning';
                }
            }

            $operatingLimits[$key] = [
                'key' => $key,
                'label' => $meta['label'],
                'icon' => $meta['icon'],
                'limit' => $limit,
                'used' => $used,
                'remaining' => $remaining,
                'percent' => $percent,
                'status' => $status,
                'is_unlimited' => $limit === null,
            ];
        }

        // Feature groups for grouped presentation
        $groupedFeatures = $features->groupBy('group_name');

        return Inertia::render('Billing/FeatureAccess', [
            'subscription' => $subMeta,
            'statusBadge' => SubscriptionState::statusBadge($currentSub),
            'banner' => SubscriptionState::banner($currentSub),
            'isWritable' => SubscriptionState::isWritable($currentSub),
            'operatingLimits' => $operatingLimits,
            'groupedFeatures' => $groupedFeatures,
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
            ],
            'canManageBilling' => $user->isOwnerOf($tenant) || $user->hasPermission('billing.manage'),
        ]);
    }
}

