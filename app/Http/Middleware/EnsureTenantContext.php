<?php

namespace App\Http\Middleware;

use App\Models\Branch;
use App\Models\Scopes\TenantScope;
use App\Models\Tenant;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantContext
{
    public function __construct(
        private readonly TenantContext $tenantContext,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        /** @var Tenant|null $domainTenant */
        $domainTenant = $request->attributes->get(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE);

        if ($user->isSuperAdmin()) {
            $this->tenantContext->clear();

            if ($domainTenant) {
                abort(403, 'Platform Super Admin accounts operate on the central or admin domain.');
            }

            if (! $request->routeIs('admin.*', 'settings.profile*', 'logout')) {
                return redirect()->route('admin.dashboard');
            }

            return $next($request);
        }

        if ($request->attributes->get(IdentifyTenantFromDomain::ADMIN_ATTRIBUTE)) {
            $this->tenantContext->clear();
            abort(403, 'SaaS Super Admin privileges are required on the admin domain.');
        }

        $memberships = $user->tenants()
            ->wherePivot('is_active', true)
            ->orderBy('tenants.id')
            ->get();

        if ($user->isSubscriberAdmin()) {
            $owned = Tenant::query()
                ->where('owner_id', $user->id)
                ->orderBy('id')
                ->get();

            if ($owned->isNotEmpty()) {
                $memberships = $memberships->merge($owned)->unique('id')->values();
            }
        }

        if ($memberships->isEmpty()) {
            $this->tenantContext->clear();

            if ($domainTenant) {
                abort(403, "You do not have access to workspace \"{$domainTenant->name}\" ({$request->getHost()}).");
            }

            if (! $request->routeIs('tenants.*', 'plans.*', 'subscription.*', 'settings.profile*', 'logout')) {
                $redirectRoute = $user->isSubscriberAdmin() && ! $user->hasUsableSubscription()
                    ? 'plans.index'
                    : 'tenants.index';

                return redirect()->route($redirectRoute);
            }

            return $next($request);
        }

        if ($domainTenant) {
            $activeTenant = $memberships->firstWhere('id', $domainTenant->id);

            if (! $activeTenant) {
                $this->tenantContext->clear();
                abort(403, "You do not have access to workspace \"{$domainTenant->name}\" ({$request->getHost()}).");
            }

            session(['active_tenant_id' => $activeTenant->id]);
        } else {
            $requestedTenantId = session('active_tenant_id') ?? $user->current_tenant_id;
            $activeTenant = $memberships->firstWhere('id', $requestedTenantId)
                ?? $memberships->first();
        }

        $branches = Branch::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $activeTenant->id)
            ->where('is_active', true)
            ->orderByDesc('is_head_office')
            ->orderBy('id')
            ->get();

        $requestedBranchId = session('active_branch_id') ?? $activeTenant->pivot?->branch_id;
        $selectedBranch = $branches->firstWhere('id', $requestedBranchId)
            ?? $branches->first();

        if ((int) $user->current_tenant_id !== (int) $activeTenant->id) {
            $user->forceFill(['current_tenant_id' => $activeTenant->id])->save();
        }

        if ($request->hasSession()) {
            session([
                'active_tenant_id' => $activeTenant->id,
                'active_branch_id' => $selectedBranch?->id,
            ]);
        }

        $isOwner = $user->isOwnerOf($activeTenant);
        $roles = $user->rolesForTenant($activeTenant);

        $this->tenantContext->setTenant(
            tenant: $activeTenant,
            branch: $selectedBranch,
            roles: $roles,
            subscriberAdminId: $activeTenant->owner_id,
            isOwner: $isOwner,
        );

        return $next($request);
    }
}
