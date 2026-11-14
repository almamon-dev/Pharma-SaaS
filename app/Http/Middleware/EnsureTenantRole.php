<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantRole
{
    public function __construct(
        private readonly TenantContext $tenantContext,
    ) {}

    public function handle(Request $request, Closure $next, string ...$abilities): Response
    {
        $user = $request->user();

        if ($user?->isSuperAdmin()) {
            return $next($request);
        }

        if ($this->tenantContext->hasRole(...$abilities) || $this->tenantContext->hasPermission(...$abilities)) {
            return $next($request);
        }

        abort(403, 'You do not have permission in this tenant workspace for this action.');
    }
}
