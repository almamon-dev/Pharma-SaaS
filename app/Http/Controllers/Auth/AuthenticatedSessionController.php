<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Middleware\IdentifyTenantFromDomain;
use App\Models\Branch;
use App\Models\Scopes\TenantScope;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    public function create(Request $request): Response
    {
        $this->ensureSubdomainPortal($request);

        return Inertia::render('Auth/Login', [
            'isLocal' => app()->isLocal(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureSubdomainPortal($request);

        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        $user = $request->user();

        if ($user?->status !== 'active') {
            Auth::logout();

            throw ValidationException::withMessages([
                'email' => 'Your account is currently inactive. Please contact your administrator.',
            ]);
        }

        /** @var Tenant|null $domainTenant */
        $domainTenant = $request->attributes->get(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE);
        $isAdminDomain = (bool) $request->attributes->get(IdentifyTenantFromDomain::ADMIN_ATTRIBUTE);

        if ($isAdminDomain && ! $user->isSuperAdmin()) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => "Only SaaS Business Owner (Super Admin) accounts can sign in on {$request->getHost()}.",
            ]);
        }

        if ($domainTenant) {
            if ($user->isSuperAdmin() || ! $user->belongsToTenant($domainTenant)) {
                Auth::guard('web')->logout();

                throw ValidationException::withMessages([
                    'email' => "This account does not belong to {$domainTenant->name} ({$request->getHost()}).",
                ]);
            }
        }

        $request->session()->regenerate();

        if ($isAdminDomain || $user->isSuperAdmin()) {
            return redirect()->route('admin.dashboard');
        }

        if (! $user->hasUsableSubscription()) {
            return redirect()->route('plans.index')
                ->with('error', 'Choose and activate a subscription plan to open your business workspace.');
        }

        if ($domainTenant) {
            $branch = Branch::withoutGlobalScope(TenantScope::class)
                ->where('tenant_id', $domainTenant->id)
                ->where('is_active', true)
                ->orderByDesc('is_head_office')
                ->orderBy('id')
                ->first();

            session([
                'active_tenant_id' => $domainTenant->id,
                'active_branch_id' => $branch?->id,
            ]);

            return redirect()->intended(route('dashboard'));
        }

        if ($user->tenants()->wherePivot('is_active', true)->doesntExist()
            && $user->ownedTenants()->doesntExist()) {
            return redirect()->route('tenants.index');
        }

        return redirect()->intended(route('dashboard'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        $isSubdomainPortal = $this->isSubdomainPortal($request);

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route($isSubdomainPortal ? 'login' : 'welcome');
    }

    public function demoEnter(Request $request): RedirectResponse
    {
        $role = strtolower((string) $request->input('role', 'admin'));
        $email = (string) $request->input('email', '');

        // Super Admin accounts can NEVER be accessed via public demo bypass; credentials are required
        if ($role === 'superadmin' || $role === 'super_admin' || $email === 'superadmin@pharmacore.test') {
            return redirect()->route('login')->with(
                'error',
                'Super Admin access is strictly protected. Please sign in with your email and password credentials.'
            );
        }

        if ($email === '') {
            $email = match ($role) {
                'pharmacist' => 'pharmacist@pharmacore.test',
                'cashier' => 'cashier@pharmacore.test',
                'salesman' => 'salesman@pharmacore.test',
                'inventory_clerk', 'clerk' => 'clerk@pharmacore.test',
                'manager', 'pathologist', 'radiologist' => 'manager@pharmacore.test',
                default => 'admin@pharmacore.test',
            };
        }

        $user = User::where('email', $email)->first()
            ?? User::where('email', 'admin@pharmacore.test')->first()
            ?? User::firstOrFail();

        // Enforce credential login for any Super Admin user
        if ($user->isSuperAdmin()) {
            return redirect()->route('login')->with(
                'error',
                'Super Admin accounts cannot be accessed via demo login. Please sign in with your credentials.'
            );
        }

        Auth::guard('web')->logout();
        Auth::login($user, true);
        $request->session()->regenerate();

        /** @var Tenant|null $domainTenant */
        $domainTenant = $request->attributes->get(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE);

        $tenant = $domainTenant
            ?? $user->tenants()->wherePivot('is_active', true)->first()
            ?? $user->ownedTenants()->first()
            ?? Tenant::find(1);

        if ($tenant) {
            $branch = Branch::withoutGlobalScope(TenantScope::class)
                ->where('tenant_id', $tenant->id)
                ->where('is_active', true)
                ->orderByDesc('is_head_office')
                ->orderBy('id')
                ->first();

            session([
                'active_tenant_id' => $tenant->id,
                'active_branch_id' => $branch?->id,
            ]);
        }

        $targetRoute = $request->input('target');
        if (! $targetRoute) {
            if ($role === 'cashier' && ! $request->has('email')) {
                $targetRoute = 'pos';
            } elseif ($role === 'salesman') {
                $targetRoute = 'sales_orders';
            } else {
                $targetRoute = 'dashboard';
            }
        }

        if ($targetRoute === 'sales_orders') {
            return redirect()->route('sales.orders.create');
        }

        return redirect()->route($targetRoute === 'pos' ? 'pos.index' : 'dashboard');
    }

    private function isSubdomainPortal(Request $request): bool
    {
        return (bool) $request->attributes->get(IdentifyTenantFromDomain::ADMIN_ATTRIBUTE)
            || $request->attributes->has(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE);
    }

    private function ensureSubdomainPortal(Request $request): void
    {
        if (! $this->isSubdomainPortal($request)) {
            abort(404);
        }
    }
}
