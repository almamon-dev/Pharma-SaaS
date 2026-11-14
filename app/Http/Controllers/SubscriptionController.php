<?php

namespace App\Http\Controllers;

use App\Models\SaasPlan;
use App\Models\SubscriptionLedger;
use App\Models\Tenant;
use App\Services\TenantProvisioningService;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SubscriptionController extends Controller
{
    public function plans(Request $request): Response
    {
        $user = $request->user();
        $subscriberAdmin = $user->effectiveSubscriberAdmin() ?? $user;
        $businessName = $user->currentTenant?->name
            ?? $subscriberAdmin->ownedTenants()->orderBy('id')->value('name')
            ?? 'Your Business';

        $plans = SaasPlan::query()
            ->where('is_active', true)
            ->where('is_public', true)
            ->with('modules:id,key,name')
            ->orderBy('sort_order')
            ->get();

        return Inertia::render('Plans/Index', [
            'plans' => $plans,
            'businessName' => $businessName,
            'isAdminOwner' => $user->isSubscriberAdmin(),
            'usage' => $subscriberAdmin->subscriptionUsage(),
        ]);
    }

    public function index(Request $request): Response
    {
        $user = $request->user();
        $subscriberAdmin = $user->effectiveSubscriberAdmin() ?? $user;
        $tenantIds = Tenant::query()->where('owner_id', $subscriberAdmin->id)->pluck('id');

        $subscriptions = $subscriberAdmin->subscriptions()
            ->with(['plan:id,name,key', 'tenant:id,name'])
            ->latest('id')
            ->get()
            ->map(fn ($sub) => [
                'id' => $sub->id,
                'transaction_ref' => $sub->transaction_ref ?? '-',
                'tenant_name' => $sub->tenant?->name ?? 'Business',
                'plan_name' => $sub->plan?->name ?? 'Plan',
                'plan_key' => $sub->plan?->key ?? '',
                'billing_cycle' => $sub->billing_cycle,
                'status' => $sub->status,
                'amount' => $sub->recurringAmount(),
                'payment_method' => $sub->payment_method ?? 'trial',
                'starts_at' => $sub->current_period_starts_at?->format('d M Y'),
                'ends_at' => ($sub->trial_ends_at ?? $sub->current_period_ends_at)?->format('d M Y'),
            ]);

        $ledgers = $tenantIds->isEmpty()
            ? []
            : SubscriptionLedger::query()
                ->whereIn('tenant_id', $tenantIds)
                ->with(['tenant:id,name', 'actor:id,name'])
                ->latest('id')
                ->limit(25)
                ->get()
                ->map(fn (SubscriptionLedger $entry) => [
                    'id' => $entry->id,
                    'event' => $entry->event,
                    'tenant_name' => $entry->tenant?->name ?? 'Tenant',
                    'actor_name' => $entry->actor?->name ?? 'System',
                    'idempotency_key' => $entry->idempotency_key,
                    'created_at' => $entry->created_at?->format('d M Y H:i'),
                ]);

        return Inertia::render('Subscription/Index', [
            'subscriptions' => $subscriptions,
            'ledgers' => $ledgers,
            'isAdminOwner' => $user->isSubscriberAdmin(),
            'usage' => $subscriberAdmin->subscriptionUsage(),
        ]);
    }

    public function store(Request $request, TenantProvisioningService $provisioning): RedirectResponse
    {
        $user = $request->user();

        if (! $user->isSubscriberAdmin() && ! $user->isSuperAdmin()) {
            abort(403, 'Only a Business Admin can purchase or change a subscription plan.');
        }

        $validated = $request->validate([
            'plan_key' => ['required', 'string', Rule::exists('saas_plans', 'key')->where('is_active', true)],
            'billing_cycle' => ['required', Rule::in(['monthly', 'annual', 'yearly'])],
            'payment_method' => ['required', Rule::in(['trial', 'card', 'bkash', 'bank_transfer'])],
        ]);

        $plan = SaasPlan::query()->where('key', $validated['plan_key'])->firstOrFail();
        $usage = $user->subscriptionUsage();

        if ($usage['tenants'] > $plan->max_pharmacies) {
            return back()->with('error', "You currently operate {$usage['tenants']} pharmacy businesses, which exceeds {$plan->name}'s limit of {$plan->max_pharmacies}.");
        }
        if ($usage['branches'] > $plan->max_branches) {
            return back()->with('error', "You currently operate {$usage['branches']} branches, which exceeds {$plan->name}'s limit of {$plan->max_branches}.");
        }

        $provisioning->activateSubscriptionForAdmin(
            admin: $user,
            plan: $plan,
            billingCycle: $validated['billing_cycle'],
            paymentMethod: $validated['payment_method'],
        );

        $actionLabel = $validated['payment_method'] === 'trial'
            ? "{$plan->trial_days}-day free trial activated"
            : 'Subscription purchased & activated';

        if ($user->ownedTenants()->doesntExist()) {
            return redirect()->route('tenants.index')
                ->with('success', "{$actionLabel} on {$plan->name}. Add your first business workspace below.");
        }

        return redirect()->route('dashboard')
            ->with('success', "{$actionLabel} on {$plan->name}. Your business workspace is active!");
    }

    public function features(Request $request, TenantContext $tenantContext): Response
    {
        $tenant = $tenantContext->tenant();
        $user = $request->user();
        $subscriberAdmin = $user->effectiveSubscriberAdmin() ?? $user;

        $publicPlans = SaasPlan::query()
            ->where('is_active', true)
            ->where('is_public', true)
            ->with('modules:id,key,name')
            ->orderBy('sort_order')
            ->get(['id', 'name', 'key', 'monthly_price']);

        return Inertia::render('Features/Index', [
            'tenantFeatures' => $tenant?->featureCatalogStatus() ?? [],
            'plans' => $publicPlans,
            'usage' => $subscriberAdmin->subscriptionUsage(),
        ]);
    }
}
