<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveSubscription
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        if ($user->isSuperAdmin()) {
            if ($request->attributes->has(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE)) {
                abort(403, 'Platform Super Admin accounts operate on the central or admin domain.');
            }

            return redirect()->route('admin.dashboard');
        }

        if ($request->attributes->get(IdentifyTenantFromDomain::ADMIN_ATTRIBUTE)) {
            abort(403, 'SaaS Super Admin privileges are required on the admin domain.');
        }

        if (! $user->hasUsableSubscription()) {
            if (! $request->routeIs('plans.*', 'subscription.*', 'logout', 'settings.profile*')) {
                $message = $user->isSubscriberAdmin()
                    ? 'Please choose a subscription plan to activate your business workspace.'
                    : 'Your business workspace subscription is currently inactive. Please contact your Business Admin.';

                return redirect()->route('plans.index')
                    ->with('error', $message);
            }
        }

        return $next($request);
    }
}
