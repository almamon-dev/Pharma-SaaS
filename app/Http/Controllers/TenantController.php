<?php

namespace App\Http\Controllers;

use App\Models\Scopes\TenantScope;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Services\TenantProvisioningService;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TenantController extends Controller
{
    public function index(Request $request, TenantContext $tenantContext): Response
    {
        $user = $request->user();
        $subscriberAdmin = $user->effectiveSubscriberAdmin() ?? $user;
        $usage = $subscriberAdmin->subscriptionUsage();

        $tenantsQuery = $user->isSubscriberAdmin()
            ? Tenant::query()->where('owner_id', $user->id)
            : $user->tenants()->wherePivot('is_active', true);

        $tenants = $tenantsQuery
            ->with(['domains' => fn ($q) => $q->where('is_primary', true)])
            ->withCount([
                'branches' => fn ($q) => $q->withoutGlobalScope(TenantScope::class),
                'users' => fn ($q) => $q->where('tenant_user.is_active', true),
                'medicines' => fn ($q) => $q->withoutGlobalScope(TenantScope::class),
                'sales' => fn ($q) => $q->withoutGlobalScope(TenantScope::class),
            ])
            ->orderBy('id')
            ->get()
            ->map(fn (Tenant $tenant) => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'domain' => $tenant->primaryDomainName(),
                'domain_url' => $tenant->workspaceUrl($request),
                'license_number' => $tenant->license_number,
                'phone' => $tenant->phone,
                'email' => $tenant->email,
                'city' => $tenant->city,
                'address' => $tenant->address,
                'currency_code' => $tenant->currency_code,
                'status' => $tenant->status,
                'branches_count' => (int) $tenant->branches_count,
                'users_count' => (int) $tenant->users_count,
                'medicines_count' => (int) $tenant->medicines_count,
                'sales_count' => (int) $tenant->sales_count,
                'is_current' => (int) $tenant->id === (int) ($tenantContext->id() ?? $user->current_tenant_id),
            ]);

        return Inertia::render('Tenants/Index', [
            'tenants' => $tenants,
            'usage' => $usage,
            'canManageTenants' => $user->isSubscriberAdmin(),
            'baseDomain' => TenantDomain::baseDomain(),
        ]);
    }

    public function store(Request $request, TenantProvisioningService $provisioning): RedirectResponse
    {
        $user = $request->user();

        if (! $user->isSubscriberAdmin()) {
            abort(403, 'Only the Business Subscriber Admin can create new businesses/shops under this subscription.');
        }

        $usage = $user->subscriptionUsage();
        if ($usage['tenants'] >= $usage['max_tenants']) {
            return back()->with('error', "Your current plan allows up to {$usage['max_tenants']} business tenant(s). Upgrade your plan on the Plans page to open another pharmacy business.");
        }
        if ($usage['branches'] >= $usage['max_branches']) {
            return back()->with('error', "Opening a business requires at least 1 branch slot, and you have already reached {$usage['max_branches']} branches.");
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'domain' => ['nullable', 'string', 'max:253'],
            'branch_name' => ['required', 'string', 'max:255'],
            'branch_code' => ['required', 'string', 'max:32'],
            'license_number' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'currency_code' => ['required', 'string', 'in:BDT,USD,EUR,GBP'],
        ]);

        $validated['domain'] = TenantDomain::validateForAssignment($validated['domain'] ?? null);

        $tenant = $provisioning->createTenantForUser($user, $validated);

        return redirect()->route('tenants.index')
            ->with('success', "Business \"{$tenant->name}\" created under your subscription.");
    }

    public function update(Request $request, Tenant $tenant): RedirectResponse
    {
        $user = $request->user();

        if (! $user->isSubscriberAdmin() || (int) $tenant->owner_id !== (int) $user->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'domain' => ['nullable', 'string', 'max:253'],
            'license_number' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'currency_code' => ['required', 'string', 'in:BDT,USD,EUR,GBP'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $normalizedDomain = TenantDomain::validateForAssignment($validated['domain'] ?? null, $tenant);
        unset($validated['domain']);

        $tenant->update($validated);

        if ($normalizedDomain !== null) {
            TenantDomain::setPrimaryForTenant($tenant, $normalizedDomain);
        }

        return back()->with('success', "Updated business \"{$tenant->name}\".");
    }
}

