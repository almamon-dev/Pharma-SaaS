<?php

namespace App\Http\Controllers;

use App\Http\Middleware\IdentifyTenantFromDomain;
use App\Models\Branch;
use App\Models\Scopes\TenantScope;
use App\Models\Tenant;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class TenantSwitchController extends Controller
{
    public function switchTenant(Request $request): Response|RedirectResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['required', 'integer'],
        ]);

        $user = $request->user();
        $tenant = Tenant::query()->with('domains')->find($validated['tenant_id']);

        if (! $tenant || ! $user->belongsToTenant($tenant)) {
            abort(403, 'You do not belong to that tenant workspace.');
        }

        $branch = Branch::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderByDesc('is_head_office')
            ->orderBy('id')
            ->first();

        $user->forceFill([
            'current_tenant_id' => $tenant->id,
        ])->save();

        session([
            'active_tenant_id' => $tenant->id,
            'active_branch_id' => $branch?->id,
        ]);

        /** @var Tenant|null $domainTenant */
        $domainTenant = $request->attributes->get(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE);
        if ($domainTenant && (int) $domainTenant->id !== (int) $tenant->id) {
            return Inertia::location($tenant->workspaceUrl($request, '/dashboard'));
        }

        return redirect()->route('dashboard')
            ->with('success', "Switched workspace to {$tenant->name}.");
    }

    public function switchBranch(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $validated = $request->validate([
            'branch_id' => ['required', 'integer'],
        ]);

        $tenantId = $tenantContext->id();

        $branch = Branch::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenantId)
            ->where('id', $validated['branch_id'])
            ->where('is_active', true)
            ->firstOrFail();

        session(['active_branch_id' => $branch->id]);

        return back()->with('success', "Active branch set to {$branch->name}.");
    }
}
