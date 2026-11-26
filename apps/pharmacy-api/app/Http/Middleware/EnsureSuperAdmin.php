<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->attributes->has(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE)) {
            abort(404);
        }

        if (! $request->user()?->isSuperAdmin()) {
            abort(403, 'SaaS Super Admin privileges are required to access this console.');
        }

        return $next($request);
    }
}

