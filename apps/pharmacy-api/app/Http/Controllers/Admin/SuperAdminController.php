<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\DemoRole;
use App\Models\Module;
use App\Models\SaasPlan;
use App\Models\Scopes\TenantScope;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Services\Commercial\SubscriptionService;
use App\Services\TenantProvisioningService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SuperAdminController extends Controller
{
    public function dashboard(): Response
    {
        $subscriberAdminsCount = User::query()
            ->where('is_super_admin', false)
            ->where('account_type', 'admin')
            ->count();

        $activeSubscriptionsCount = TenantSubscription::query()
            ->whereIn('status', ['active', 'trialing'])
            ->count();

        $monthlyRevenue = (float) TenantSubscription::query()
            ->where('status', 'active')
            ->get()
            ->sum(function (TenantSubscription $sub): float {
                $base = $sub->billing_cycle === 'annual'
                    ? $sub->recurringAmount() / 12
                    : $sub->recurringAmount();

                return round($base, 2);
            });

        $totalTenants = Tenant::query()->count();
        $totalBranches = Branch::withoutGlobalScope(TenantScope::class)->count();
        $totalEmployees = (int) DB::table('tenant_user')->where('is_active', true)->count();

        $recentSubscriptions = TenantSubscription::query()
            ->with(['subscriber:id,name,email', 'tenant:id,name', 'plan:id,name,key'])
            ->latest('id')
            ->limit(10)
            ->get()
            ->map(fn (TenantSubscription $sub) => [
                'id' => $sub->id,
                'owner_name' => $sub->subscriber?->name ?? 'Subscriber',
                'owner_email' => $sub->subscriber?->email ?? '',
                'tenant_name' => $sub->tenant?->name ?? 'Business',
                'plan_name' => $sub->plan?->name ?? 'Plan',
                'billing_cycle' => $sub->billing_cycle,
                'status' => $sub->status,
                'amount' => $sub->recurringAmount(),
                'payment_method' => $sub->payment_method ?? 'trial',
                'ends_at' => ($sub->trial_ends_at ?? $sub->current_period_ends_at)?->format('d M Y') ?? '-',
            ]);

        $tenants = Tenant::query()
            ->with('owner:id,name,email')
            ->withCount([
                'branches' => fn ($q) => $q->withoutGlobalScope(TenantScope::class),
                'users',
            ])
            ->latest('id')
            ->limit(12)
            ->get()
            ->map(fn (Tenant $tenant) => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'owner_name' => $tenant->owner?->name ?? 'Admin',
                'city' => $tenant->city ?? '-',
                'branches_count' => $tenant->branches_count,
                'users_count' => $tenant->users_count,
                'status' => $tenant->status,
            ]);

        return Inertia::render('Admin/Dashboard', [
            'metrics' => [
                'subscriberAdminsCount' => $subscriberAdminsCount,
                'activeSubscriptionsCount' => $activeSubscriptionsCount,
                'monthlyRevenue' => round($monthlyRevenue, 2),
                'totalTenants' => $totalTenants,
                'totalBranches' => $totalBranches,
                'totalEmployees' => $totalEmployees,
            ],
            'recentSubscriptions' => $recentSubscriptions,
            'tenants' => $tenants,
        ]);
    }

    public function plans(): Response
    {
        $plans = SaasPlan::query()
            ->with('modules:id,key,name,description,category,is_core,is_active')
            ->withCount(['subscriptions as active_subscribers_count' => fn ($q) => $q->whereIn('status', ['active', 'trialing'])])
            ->orderBy('sort_order')
            ->get();

        $modules = Module::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'key', 'name', 'description', 'category', 'is_core', 'is_active']);

        return Inertia::render('Admin/Plans', [
            'plans' => $plans,
            'modules' => $modules,
        ]);
    }

    public function storePlan(Request $request, SubscriptionService $subscriptionService): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'name_bn' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'description_bn' => ['nullable', 'string', 'max:500'],
            'monthly_price' => ['required', 'numeric', 'min:0'],
            'annual_price' => ['required', 'numeric', 'min:0'],
            'trial_days' => ['nullable', 'integer', 'min:0', 'max:90'],
            'max_pharmacies' => ['required', 'integer', 'min:1'],
            'max_branches' => ['required', 'integer', 'min:1'],
            'max_users' => ['required', 'integer', 'min:1'],
            'max_medicines' => ['required', 'integer', 'min:50'],
            'features_text' => ['nullable', 'string'],
            'features_bn_text' => ['nullable', 'string'],
            'module_ids' => ['nullable', 'array'],
            'module_ids.*' => ['integer', Rule::exists('modules', 'id')],
            'is_popular' => ['boolean'],
        ]);

        $baseKey = Str::slug($validated['name']);
        $key = $baseKey;
        $counter = 1;
        while (SaasPlan::query()->where('key', $key)->exists()) {
            $key = "{$baseKey}-{$counter}";
            $counter++;
        }

        $features = collect(explode("\n", (string) ($validated['features_text'] ?? '')))
            ->map(fn ($line) => trim($line))
            ->filter()
            ->values()
            ->all();

        $featuresBn = collect(explode("\n", (string) ($validated['features_bn_text'] ?? '')))
            ->map(fn ($line) => trim($line))
            ->filter()
            ->values()
            ->all();

        $plan = SaasPlan::query()->create([
            'key' => $key,
            'name' => trim($validated['name']),
            'name_bn' => ! empty($validated['name_bn']) ? trim($validated['name_bn']) : null,
            'description' => $validated['description'] ?? null,
            'description_bn' => $validated['description_bn'] ?? null,
            'currency_code' => 'USD',
            'monthly_price' => $validated['monthly_price'],
            'annual_price' => $validated['annual_price'],
            'trial_days' => (int) ($validated['trial_days'] ?? 14),
            'max_pharmacies' => $validated['max_pharmacies'],
            'max_branches' => $validated['max_branches'],
            'max_users' => $validated['max_users'],
            'max_medicines' => $validated['max_medicines'],
            'features' => $features,
            'features_bn' => ! empty($featuresBn) ? $featuresBn : null,
            'is_popular' => (bool) ($validated['is_popular'] ?? false),
            'is_active' => true,
            'is_public' => true,
            'sort_order' => (SaasPlan::query()->max('sort_order') ?? 0) + 1,
        ]);

        if (array_key_exists('module_ids', $validated)) {
            $plan->modules()->sync($validated['module_ids'] ?? []);
            $subscriptionService->syncPlanEntitlementsToSubscribers($plan);
        }

        return back()->with('success', "Subscription plan \"{$validated['name']}\" created with feature entitlements.");
    }

    public function updatePlan(Request $request, SaasPlan $plan, SubscriptionService $subscriptionService): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'name_bn' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'description_bn' => ['nullable', 'string', 'max:500'],
            'monthly_price' => ['required', 'numeric', 'min:0'],
            'annual_price' => ['required', 'numeric', 'min:0'],
            'trial_days' => ['nullable', 'integer', 'min:0', 'max:90'],
            'max_pharmacies' => ['required', 'integer', 'min:1'],
            'max_branches' => ['required', 'integer', 'min:1'],
            'max_users' => ['required', 'integer', 'min:1'],
            'max_medicines' => ['required', 'integer', 'min:50'],
            'features_text' => ['nullable', 'string'],
            'features_bn_text' => ['nullable', 'string'],
            'module_ids' => ['nullable', 'array'],
            'module_ids.*' => ['integer', Rule::exists('modules', 'id')],
            'is_popular' => ['boolean'],
        ]);

        $features = collect(explode("\n", (string) ($validated['features_text'] ?? '')))
            ->map(fn ($line) => trim($line))
            ->filter()
            ->values()
            ->all();

        $featuresBn = collect(explode("\n", (string) ($validated['features_bn_text'] ?? '')))
            ->map(fn ($line) => trim($line))
            ->filter()
            ->values()
            ->all();

        $plan->update([
            'name' => trim($validated['name']),
            'name_bn' => ! empty($validated['name_bn']) ? trim($validated['name_bn']) : null,
            'description' => $validated['description'] ?? null,
            'description_bn' => $validated['description_bn'] ?? null,
            'monthly_price' => $validated['monthly_price'],
            'annual_price' => $validated['annual_price'],
            'trial_days' => (int) ($validated['trial_days'] ?? $plan->trial_days),
            'max_pharmacies' => $validated['max_pharmacies'],
            'max_branches' => $validated['max_branches'],
            'max_users' => $validated['max_users'],
            'max_medicines' => $validated['max_medicines'],
            'features' => $features,
            'features_bn' => ! empty($featuresBn) ? $featuresBn : null,
            'is_popular' => (bool) ($validated['is_popular'] ?? false),
        ]);

        if (array_key_exists('module_ids', $validated)) {
            $plan->modules()->sync($validated['module_ids'] ?? []);
            $subscriptionService->syncPlanEntitlementsToSubscribers($plan);
        }

        return back()->with('success', "Plan \"{$plan->name}\" and its feature entitlements updated.");
    }

    public function togglePlan(SaasPlan $plan): RedirectResponse
    {
        $plan->update(['is_active' => ! $plan->is_active]);

        return back()->with('success', "Plan \"{$plan->name}\" ".($plan->is_active ? 'activated' : 'disabled').'.');
    }

    public function subscribers(): Response
    {
        $plans = SaasPlan::query()
            ->with('modules:id,key,name')
            ->orderBy('sort_order')
            ->get(['id', 'name', 'key', 'monthly_price', 'annual_price', 'max_pharmacies', 'max_branches', 'max_users']);

        $modules = Module::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'key', 'name', 'category', 'is_core']);

        $subscribers = User::query()
            ->where('is_super_admin', false)
            ->where('account_type', 'admin')
            ->with(['activeSubscription.plan.modules:id,key,name', 'currentTenant.modules'])
            ->orderBy('name')
            ->get()
            ->map(function (User $admin) {
                $subscription = $admin->activeSubscription;
                $plan = $subscription?->plan;
                $usage = $admin->subscriptionUsage();

                $enabledModuleIds = $admin->currentTenant
                    ? $admin->currentTenant->modules
                        ->where('is_active', true)
                        ->where('pivot.is_enabled', true)
                        ->pluck('id')
                        ->all()
                    : ($plan ? $plan->modules->pluck('id')->all() : []);

                return [
                    'id' => $admin->id,
                    'name' => $admin->name,
                    'email' => $admin->email,
                    'phone' => $admin->phone,
                    'business_name' => $admin->currentTenant?->name ?? 'Unassigned',
                    'account_status' => $admin->status,
                    'plan_id' => $plan?->id,
                    'plan_key' => $plan?->key ?? '',
                    'plan_name' => $plan?->name ?? 'No Plan',
                    'subscription_status' => $subscription?->status ?? 'none',
                    'billing_cycle' => $subscription?->billing_cycle ?? 'monthly',
                    'amount' => $subscription ? $subscription->recurringAmount() : 0,
                    'ends_at' => ($subscription?->trial_ends_at ?? $subscription?->current_period_ends_at)?->format('d M Y') ?? '-',
                    'tenants_used' => $usage['tenants'],
                    'max_tenants' => $usage['max_tenants'],
                    'branches_used' => $usage['branches'],
                    'max_branches' => $usage['max_branches'],
                    'employees_used' => $usage['employees'],
                    'max_users' => $usage['max_users'],
                    'enabled_module_ids' => $enabledModuleIds,
                ];
            });

        return Inertia::render('Admin/Subscribers', [
            'subscribers' => $subscribers,
            'plans' => $plans,
            'modules' => $modules,
        ]);
    }

    public function updateSubscriber(
        Request $request,
        User $user,
        TenantProvisioningService $provisioning
    ): RedirectResponse {
        if ($user->isSuperAdmin()) {
            abort(403);
        }

        $validated = $request->validate([
            'plan_key' => ['required', 'string', Rule::exists('saas_plans', 'key')],
            'status' => ['required', Rule::in(['active', 'trialing', 'suspended', 'cancelled'])],
            'billing_cycle' => ['required', Rule::in(['monthly', 'annual'])],
            'module_ids' => ['nullable', 'array'],
            'module_ids.*' => ['integer', Rule::exists('modules', 'id')],
        ]);

        $plan = SaasPlan::query()->where('key', $validated['plan_key'])->firstOrFail();

        if (! $user->currentTenant && $user->ownedTenants()->doesntExist()) {
            $provisioning->createTenantForUser($user, [
                'name' => "{$user->name} Pharmacy",
            ]);
        }

        $provisioning->activateSubscriptionForAdmin(
            admin: $user,
            plan: $plan,
            billingCycle: $validated['billing_cycle'],
            paymentMethod: $validated['status'] === 'trialing' ? 'trial' : 'admin_assigned',
            forcedStatus: $validated['status'],
        );

        if (array_key_exists('module_ids', $validated)) {
            $tenants = $user->ownedTenants()->get();
            if ($user->currentTenant && ! $tenants->contains('id', $user->currentTenant->id)) {
                $tenants->push($user->currentTenant);
            }

            $selectedModuleIds = collect($validated['module_ids'] ?? [])->map(fn ($id) => (int) $id);
            $allActiveModules = Module::query()->where('is_active', true)->get();
            $now = now();

            foreach ($tenants as $tenant) {
                foreach ($allActiveModules as $mod) {
                    $enabled = $mod->is_core || $selectedModuleIds->contains($mod->id);
                    DB::table('tenant_modules')->updateOrInsert(
                        ['tenant_id' => $tenant->id, 'module_id' => $mod->id],
                        [
                            'is_enabled' => $enabled,
                            'enabled_at' => $enabled ? $now : null,
                            'updated_at' => $now,
                            'created_at' => $now,
                        ]
                    );
                }
            }
        }

        return back()->with('success', "Updated subscription and module privileges for {$user->name} ({$plan->name} — {$validated['status']}).");
    }

    public function features(): Response
    {
        $plans = SaasPlan::query()
            ->orderBy('sort_order')
            ->get(['id', 'name', 'key', 'monthly_price', 'is_active']);

        $features = Module::query()
            ->with('plans:id,name,key')
            ->withCount(['tenants as enabled_tenants_count' => fn ($q) => $q->where('tenant_modules.is_enabled', true)])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (Module $module) => [
                'id' => $module->id,
                'key' => $module->key,
                'name' => $module->name,
                'description' => $module->description,
                'category' => $module->category ?? 'operations',
                'is_core' => (bool) $module->is_core,
                'is_active' => (bool) $module->is_active,
                'plan_ids' => $module->plans->pluck('id')->all(),
                'plans' => $module->plans->map(fn ($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'key' => $p->key,
                ])->values()->all(),
                'enabled_tenants_count' => (int) $module->enabled_tenants_count,
            ]);

        return Inertia::render('Admin/Features', [
            'features' => $features,
            'plans' => $plans,
        ]);
    }

    public function storeFeature(Request $request, SubscriptionService $subscriptionService): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'key' => ['nullable', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'category' => ['required', 'string', 'max:60'],
            'is_core' => ['boolean'],
            'plan_ids' => ['nullable', 'array'],
            'plan_ids.*' => ['integer', Rule::exists('saas_plans', 'id')],
        ]);

        $rawKey = trim((string) ($validated['key'] ?? ''));
        $baseKey = Str::slug($rawKey !== '' ? $rawKey : $validated['name'], '_');
        if ($baseKey === '') {
            $baseKey = 'feature_'.Str::lower(Str::random(5));
        }
        $key = $baseKey;
        $counter = 1;
        while (Module::query()->where('key', $key)->exists()) {
            $key = "{$baseKey}_{$counter}";
            $counter++;
        }

        $module = Module::query()->create([
            'key' => $key,
            'name' => trim($validated['name']),
            'description' => $validated['description'] ?? null,
            'category' => $validated['category'],
            'is_core' => (bool) ($validated['is_core'] ?? false),
            'is_active' => true,
            'sort_order' => (Module::query()->max('sort_order') ?? 0) + 1,
        ]);

        if (! empty($validated['plan_ids'])) {
            $module->plans()->sync($validated['plan_ids']);
        }

        $subscriptionService->syncAllActiveTenants();

        return back()->with('success', "New feature \"{$module->name}\" ({$module->key}) added and synced to selected plans.");
    }

    public function updateFeature(
        Request $request,
        Module $module,
        SubscriptionService $subscriptionService
    ): RedirectResponse {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'category' => ['required', 'string', 'max:60'],
            'is_core' => ['boolean'],
            'plan_ids' => ['nullable', 'array'],
            'plan_ids.*' => ['integer', Rule::exists('saas_plans', 'id')],
        ]);

        $module->update([
            'name' => trim($validated['name']),
            'description' => $validated['description'] ?? null,
            'category' => $validated['category'],
            'is_core' => (bool) ($validated['is_core'] ?? false),
        ]);

        if (array_key_exists('plan_ids', $validated)) {
            $module->plans()->sync($validated['plan_ids'] ?? []);
        }

        $subscriptionService->syncAllActiveTenants();

        return back()->with('success', "Feature \"{$module->name}\" updated and plan access synced.");
    }

    public function toggleFeature(Module $module, SubscriptionService $subscriptionService): RedirectResponse
    {
        $module->update(['is_active' => ! $module->is_active]);
        $subscriptionService->syncAllActiveTenants();

        return back()->with('success', "Feature \"{$module->name}\" ".($module->is_active ? 'enabled' : 'disabled').'.');
    }

    public function demoRoles(): Response
    {
        $roles = DemoRole::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return Inertia::render('Admin/DemoRoles', [
            'roles' => $roles,
        ]);
    }

    public function updateDemoRole(Request $request, DemoRole $demoRole): RedirectResponse
    {
        $validated = $request->validate([
            'title_en' => ['required', 'string', 'max:120'],
            'title_bn' => ['nullable', 'string', 'max:120'],
            'subtitle_en' => ['required', 'string', 'max:160'],
            'subtitle_bn' => ['nullable', 'string', 'max:160'],
            'description_en' => ['nullable', 'string', 'max:1000'],
            'description_bn' => ['nullable', 'string', 'max:1000'],
            'email' => ['required', 'string', 'max:150'],
            'tags_en' => ['nullable'],
            'tags_bn' => ['nullable'],
            'features_en' => ['nullable'],
            'features_bn' => ['nullable'],
            'restrictions_en' => ['nullable'],
            'restrictions_bn' => ['nullable'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $parseList = function ($val): array {
            if (is_array($val)) {
                return array_values(array_filter(array_map('trim', $val)));
            }
            if (is_string($val)) {
                return array_values(array_filter(array_map('trim', preg_split('/[\r\n,]+/', $val))));
            }
            return [];
        };

        $demoRole->update([
            'title_en' => trim($validated['title_en']),
            'title_bn' => ! empty($validated['title_bn']) ? trim($validated['title_bn']) : null,
            'subtitle_en' => trim($validated['subtitle_en']),
            'subtitle_bn' => ! empty($validated['subtitle_bn']) ? trim($validated['subtitle_bn']) : null,
            'description_en' => ! empty($validated['description_en']) ? trim($validated['description_en']) : null,
            'description_bn' => ! empty($validated['description_bn']) ? trim($validated['description_bn']) : null,
            'email' => trim($validated['email']),
            'tags_en' => $parseList($validated['tags_en'] ?? []),
            'tags_bn' => $parseList($validated['tags_bn'] ?? []),
            'features_en' => $parseList($validated['features_en'] ?? []),
            'features_bn' => $parseList($validated['features_bn'] ?? []),
            'restrictions_en' => $parseList($validated['restrictions_en'] ?? []),
            'restrictions_bn' => $parseList($validated['restrictions_bn'] ?? []),
            'is_active' => (bool) ($validated['is_active'] ?? $demoRole->is_active),
        ]);

        return back()->with('success', "Demo role \"{$demoRole->title_en}\" updated successfully.");
    }

    public function toggleDemoRole(DemoRole $demoRole): RedirectResponse
    {
        $demoRole->update(['is_active' => ! $demoRole->is_active]);

        return back()->with('success', "Demo role \"{$demoRole->title_en}\" ".($demoRole->is_active ? 'activated' : 'deactivated').'.');
    }

    public function resetDemoRoles(): RedirectResponse
    {
        DemoRole::seedDefaults();

        return back()->with('success', 'Demo roles restored to default settings.');
    }
}
