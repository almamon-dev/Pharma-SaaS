<?php

namespace App\Http\Middleware;

use App\Models\TenantDomain;
use App\Tenancy\CurrentTenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IdentifyTenantFromDomain
{
    public const REQUEST_ATTRIBUTE = 'domain_tenant';

    public const ADMIN_ATTRIBUTE = 'is_admin_domain';

    public function __construct(
        private readonly CurrentTenant $currentTenant,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $host = TenantDomain::stripPort($request->getHost());

        if ($host === '') {
            return $next($request);
        }

        if (TenantDomain::isAdminHost($host)) {
            $request->attributes->set(self::ADMIN_ATTRIBUTE, true);

            return $next($request);
        }

        if (TenantDomain::isCentralHost($host)) {
            return $next($request);
        }

        $tenantDomain = TenantDomain::query()
            ->with('tenant.domains')
            ->whereRaw('LOWER(domain) = ?', [$host])
            ->where('is_verified', true)
            ->first();

        if (! $tenantDomain || ! $tenantDomain->tenant || $tenantDomain->tenant->status !== 'active') {
            abort(404, 'No active pharmacy workspace is configured for this domain.');
        }

        $tenant = $tenantDomain->tenant;

        $request->attributes->set(self::REQUEST_ATTRIBUTE, $tenant);
        $this->currentTenant->set($tenant);

        return $next($request);
    }
}
