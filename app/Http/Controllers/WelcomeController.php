<?php

namespace App\Http\Controllers;

use App\Http\Middleware\IdentifyTenantFromDomain;
use App\Models\SaasPlan;
use App\Models\TenantDomain;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WelcomeController extends Controller
{
    public function __invoke(Request $request): Response|RedirectResponse
    {
        if ($request->attributes->get(IdentifyTenantFromDomain::ADMIN_ATTRIBUTE)) {
            $user = $request->user();

            if ($user) {
                if (! $user->isSuperAdmin()) {
                    abort(403, 'Only SaaS Business Owner (Super Admin) accounts can access the admin portal.');
                }

                return redirect()->route('admin.dashboard');
            }

            return redirect()->route('login');
        }

        if ($request->attributes->has(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE)) {
            $user = $request->user();

            if ($user && ! $user->isSuperAdmin()) {
                return redirect()->route('dashboard');
            }

            return redirect()->route('login');
        }

        $plans = SaasPlan::query()
            ->where('is_active', true)
            ->where('is_public', true)
            ->with('modules:id,key,name')
            ->orderBy('sort_order')
            ->get();

        $demoRoles = \App\Models\DemoRole::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return Inertia::render('Welcome', [
            'plans' => $plans,
            'demoRoles' => $demoRoles,
        ]);
    }

    /**
     * Resolve a bare subdomain or hostname to its active tenant or admin login URL.
     */
    public function lookupWorkspace(Request $request): JsonResponse
    {
        $host = TenantDomain::normalizeInput((string) $request->query('subdomain', ''));

        if ($host === null) {
            return response()->json([
                'message' => 'Enter your workspace subdomain (e.g. demo or admin).',
            ], 422);
        }

        if (TenantDomain::isAdminHost($host)) {
            return response()->json([
                'domain' => $host,
                'url' => TenantDomain::urlForHost($host, $request, '/login'),
            ]);
        }

        $tenantDomain = TenantDomain::query()
            ->whereRaw('LOWER(domain) = ?', [$host])
            ->where('is_verified', true)
            ->whereHas('tenant', fn ($q) => $q->where('status', 'active'))
            ->first();

        if (! $tenantDomain) {
            return response()->json([
                'message' => "No active workspace found for \"{$host}\".",
            ], 422);
        }

        return response()->json([
            'domain' => $tenantDomain->domain,
            'url' => TenantDomain::urlForHost($tenantDomain->domain, $request, '/login'),
        ]);
    }
}
