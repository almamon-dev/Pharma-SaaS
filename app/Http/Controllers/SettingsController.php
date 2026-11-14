<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\SaasPlan;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function business(Request $request, TenantContext $tenantContext): Response
    {
        $tenant = $tenantContext->tenant();
        $tenant->loadMissing('domains');
        $subscription = $tenant?->subscriberSubscription();

        return Inertia::render('Settings/Business', [
            'business' => array_merge($tenant->toArray(), [
                'domain' => $tenant->primaryDomainName(),
                'domain_url' => $tenant->workspaceUrl($request),
                'active_subscription' => $subscription ? [
                    'status' => $subscription->status,
                    'plan' => $subscription->plan,
                ] : null,
            ]),
            'plans' => SaasPlan::query()->where('is_active', true)->orderBy('sort_order')->get(),
        ]);
    }

    public function updateBusiness(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'license_number' => ['nullable', 'string', 'max:100'],
            'tax_id' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:100'],
            'currency_code' => ['required', 'string', 'in:BDT,USD,EUR,GBP'],
            'timezone' => ['required', 'string', 'max:64'],
            'low_stock_alert_days' => ['required', 'integer', 'min:7', 'max:180'],
        ]);

        $settings = $tenant->settings ?? [];
        $settings['low_stock_alert_days'] = (int) $validated['low_stock_alert_days'];

        $tenant->update([
            'name' => trim($validated['name']),
            'license_number' => $validated['license_number'] ?? null,
            'tax_id' => $validated['tax_id'] ?? null,
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'address' => $validated['address'] ?? null,
            'city' => $validated['city'] ?? null,
            'currency_code' => $validated['currency_code'],
            'timezone' => $validated['timezone'],
            'settings' => $settings,
        ]);

        AuditLog::record(
            action: 'tenant.updated',
            description: "Updated business settings for \"{$tenant->name}\".",
            subject: $tenant,
        );

        return back()->with('success', 'Business settings saved.');
    }

    public function profile(): Response
    {
        return Inertia::render('Settings/Profile');
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $user->update($validated);

        return back()->with('success', 'Profile updated.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $request->user()->update([
            'password' => Hash::make($validated['password']),
        ]);

        return back()->with('success', 'Password updated successfully.');
    }
}
