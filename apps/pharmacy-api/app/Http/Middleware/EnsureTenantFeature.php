<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantFeature
{
    public function __construct(
        private readonly TenantContext $tenantContext,
    ) {}

    public function handle(Request $request, Closure $next, string $featureKey): Response
    {
        $user = $request->user();

        if ($user?->isSuperAdmin()) {
            return $next($request);
        }

        $tenant = $this->tenantContext->tenant();
        if (! $tenant || ! $tenant->hasFeature($featureKey)) {
            abort(403, "Feature \"{$featureKey}\" is not included in your active subscription plan. Upgrade your plan to unlock this feature.");
        }

        return $next($request);
    }
}

