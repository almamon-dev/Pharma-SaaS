<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Tenancy\RegisterBusiness;
use App\Http\Controllers\Controller;
use App\Http\Middleware\IdentifyTenantFromDomain;
use App\Models\TenantDomain;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function create(Request $request): Response
    {
        if (
            $request->attributes->get(IdentifyTenantFromDomain::ADMIN_ATTRIBUTE)
            || $request->attributes->has(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE)
        ) {
            abort(404);
        }

        return Inertia::render('Auth/Register');
    }

    public function store(Request $request, RegisterBusiness $registerBusiness): RedirectResponse
    {
        if (
            $request->attributes->get(IdentifyTenantFromDomain::ADMIN_ATTRIBUTE)
            || $request->attributes->has(IdentifyTenantFromDomain::REQUEST_ATTRIBUTE)
        ) {
            abort(404);
        }

        $validated = $request->validate([
            'business_name' => ['required', 'string', 'max:150'],
            'domain' => ['nullable', 'string', 'max:253'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $validated['domain'] = TenantDomain::validateForAssignment($validated['domain'] ?? null);

        $provisioned = $registerBusiness->execute($validated);

        Auth::login($provisioned['user']);

        $request->session()->regenerate();
        session([
            'active_tenant_id' => $provisioned['tenant']->id,
            'active_branch_id' => $provisioned['branch']->id,
        ]);

        return redirect()
            ->route('plans.index')
            ->with('success', "Business \"{$provisioned['tenant']->name}\" created! Now choose a subscription plan below.");
    }
}
