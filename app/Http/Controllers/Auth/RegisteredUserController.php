<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Tenancy\RegisterBusiness;
use App\Http\Controllers\Controller;
use App\Http\Middleware\IdentifyTenantFromDomain;
use App\Models\SaasPlan;
use App\Models\TenantDomain;
use App\Services\TenantProvisioningService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function create(Request $request): Response
    {
        if (
            $request->attributes->get(IdentifyTenantFromDomain::ADMIN_ATTRIBUTE)
            || $request->attributes->has(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE)
        ) {
            abort(404);
        }

        $planKey = $request->query('plan');
        $plan = $planKey ? SaasPlan::query()->where('key', $planKey)->where('is_active', true)->first() : null;

        return Inertia::render('Auth/Register', [
            'initialPlan' => $plan ? [
                'key' => $plan->key,
                'name' => $plan->name,
                'name_bn' => $plan->name_bn,
                'trial_days' => $plan->trial_days ?: 14,
                'monthly_price' => $plan->monthly_price,
            ] : null,
        ]);
    }

    public function store(
        Request $request,
        RegisterBusiness $registerBusiness,
        TenantProvisioningService $provisioning,
    ): RedirectResponse {
        if (
            $request->attributes->get(IdentifyTenantFromDomain::ADMIN_ATTRIBUTE)
            || $request->attributes->has(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE)
        ) {
            abort(404);
        }

        $validated = $request->validate([
            'business_name' => ['required', 'string', 'max:150'],
            'domain' => ['nullable', 'string', 'max:253'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'plan' => ['nullable', 'string', 'exists:saas_plans,key'],
        ]);

        $validated['domain'] = TenantDomain::validateForAssignment($validated['domain'] ?? null);

        $provisioned = $registerBusiness->execute($validated);

        Auth::login($provisioned['user']);

        $request->session()->regenerate();
        session([
            'active_tenant_id' => $provisioned['tenant']->id,
            'active_branch_id' => $provisioned['branch']->id,
        ]);

        $selectedPlanKey = $validated['plan'] ?? $request->query('plan');

        if (! empty($selectedPlanKey)) {
            $plan = SaasPlan::query()->where('key', $selectedPlanKey)->first();
            if ($plan) {
                $provisioning->activateSubscriptionForAdmin(
                    admin: $provisioned['user'],
                    plan: $plan,
                    billingCycle: 'monthly',
                    paymentMethod: 'trial',
                    primaryTenant: $provisioned['tenant'],
                );

                return redirect()
                    ->route('dashboard')
                    ->with('success', "স্বাগতম! \"{$provisioned['tenant']->name}\"-এর জন্য {$plan->name} প্ল্যানের ১৪ দিনের ফ্রি ট্রায়াল সক্রিয় হয়েছে! সকল ফিচার আনলক করা আছে।");
            }
        }

        return redirect()
            ->route('plans.index')
            ->with('success', "Business \"{$provisioned['tenant']->name}\" created! Now choose a subscription plan below.");
    }
}
