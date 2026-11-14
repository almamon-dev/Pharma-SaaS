<?php

namespace App\Http\Controllers;

use App\Enums\TenantRole;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Role;
use App\Models\Scopes\TenantScope;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function index(Request $request, TenantContext $tenantContext): Response
    {
        $user = $request->user();
        $currentTenant = $tenantContext->tenant();
        $subscriberAdmin = $user->effectiveSubscriberAdmin() ?? $currentTenant->owner;
        $isOwner = $user->isSubscriberAdmin() && (int) $currentTenant->owner_id === (int) $user->id;

        $scopedTenantIds = $isOwner
            ? Tenant::query()->where('owner_id', $user->id)->pluck('id')->all()
            : [$currentTenant->id];

        $tenants = Tenant::query()
            ->whereIn('id', $scopedTenantIds)
            ->orderBy('name')
            ->get(['id', 'name', 'city']);

        $branches = Branch::withoutGlobalScope(TenantScope::class)
            ->whereIn('tenant_id', $scopedTenantIds)
            ->where('is_active', true)
            ->orderBy('tenant_id')
            ->orderBy('name')
            ->get(['id', 'tenant_id', 'name', 'code']);

        $branchesById = $branches->pluck('name', 'id');
        $tenantsById = $tenants->pluck('name', 'id');

        $roleOptions = TenantRole::optionsForSubscriber($subscriberAdmin?->id, includeAdmin: false);
        $roleLabelMap = [];
        foreach (TenantRole::optionsForSubscriber($subscriberAdmin?->id, includeAdmin: true) as $opt) {
            $roleLabelMap[$opt['value']] = $opt['label'];
        }

        $pivotRows = DB::table('tenant_user')
            ->join('users', 'users.id', '=', 'tenant_user.user_id')
            ->whereIn('tenant_user.tenant_id', $scopedTenantIds)
            ->orderBy('users.name')
            ->select([
                'tenant_user.id as membership_id',
                'tenant_user.tenant_id',
                'tenant_user.user_id',
                'tenant_user.branch_id',
                'tenant_user.is_owner',
                'tenant_user.role',
                'tenant_user.roles',
                'tenant_user.is_active',
                'tenant_user.joined_at',
                'users.name',
                'users.email',
                'users.phone',
            ])
            ->get();

        $members = $pivotRows->map(function ($row) use ($tenantsById, $branchesById, $roleLabelMap, $subscriberAdmin) {
            $decoded = is_string($row->roles) ? json_decode($row->roles, true) : $row->roles;
            $roleSlugs = is_array($decoded) && ! empty($decoded)
                ? $decoded
                : [$row->role];

            $normalizedSlugs = array_values(array_unique(array_map(
                fn (string $r) => TenantRole::normalize($r),
                $roleSlugs
            )));

            $roleLabels = array_map(
                fn (string $slug) => $roleLabelMap[$slug] ?? ucfirst(str_replace('_', ' ', $slug)),
                $normalizedSlugs
            );

            return [
                'id' => (int) $row->membership_id,
                'user_id' => (int) $row->user_id,
                'tenant_id' => (int) $row->tenant_id,
                'tenant_name' => $tenantsById[$row->tenant_id] ?? 'Business',
                'name' => $row->name,
                'email' => $row->email,
                'phone' => $row->phone,
                'role' => $normalizedSlugs[0] ?? 'pharmacist',
                'roles' => $normalizedSlugs,
                'role_labels' => $roleLabels,
                'role_label' => implode(', ', $roleLabels),
                'branch_id' => $row->branch_id ? (int) $row->branch_id : null,
                'branch_name' => $row->branch_id ? ($branchesById[$row->branch_id] ?? 'Assigned Branch') : 'All Branches',
                'is_active' => (bool) $row->is_active,
                'is_owner' => (bool) $row->is_owner || ($subscriberAdmin && (int) $row->user_id === (int) $subscriberAdmin->id),
                'joined_at' => $row->joined_at
                    ? Carbon::parse($row->joined_at)->format('d M Y')
                    : '-',
            ];
        });

        return Inertia::render('Team/Index', [
            'members' => $members,
            'roles' => $roleOptions,
            'permissionCatalog' => TenantRole::permissionCatalogOptions(),
            'branches' => $branches,
            'tenants' => $tenants,
            'currentTenantId' => $currentTenant->id,
            'isOwner' => $isOwner,
            'usage' => $subscriberAdmin?->subscriptionUsage(),
        ]);
    }

    public function store(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $currentTenant = $tenantContext->tenant();
        $subscriberAdmin = $user->effectiveSubscriberAdmin() ?? $currentTenant->owner;
        $usage = $subscriberAdmin?->subscriptionUsage();

        $targetTenantId = $user->isSubscriberAdmin() && $request->filled('tenant_id')
            ? (int) $request->input('tenant_id')
            : (int) $currentTenant->id;

        $targetTenant = Tenant::query()
            ->where('id', $targetTenantId)
            ->when(
                $user->isSubscriberAdmin(),
                fn ($q) => $q->where('owner_id', $user->id),
                fn ($q) => $q->where('id', $currentTenant->id)
            )
            ->firstOrFail();

        $allowedRoleSlugs = array_column(
            TenantRole::optionsForSubscriber($subscriberAdmin?->id, includeAdmin: false),
            'value'
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'tenant_id' => ['nullable', 'integer'],
            'branch_id' => [
                'nullable',
                Rule::exists('branches', 'id')->where('tenant_id', $targetTenant->id),
            ],
            'role' => ['nullable', Rule::in($allowedRoleSlugs)],
            'roles' => ['nullable', 'array', 'min:1'],
            'roles.*' => [Rule::in($allowedRoleSlugs)],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        $assignedRoles = ! empty($validated['roles'])
            ? array_values(array_unique($validated['roles']))
            : [$validated['role'] ?? TenantRole::PHARMACIST->value];

        if ($targetTenant->users()->where('users.email', $validated['email'])->exists()) {
            return back()->with('error', "This employee is already assigned to {$targetTenant->name}. Use Edit to update roles or branches.");
        }

        $existingUser = User::query()->where('email', $validated['email'])->first();
        $isNewUniqueEmployee = true;
        if ($existingUser && $subscriberAdmin) {
            $adminTenantIds = Tenant::query()->where('owner_id', $subscriberAdmin->id)->pluck('id');
            $alreadyInAccount = DB::table('tenant_user')
                ->whereIn('tenant_id', $adminTenantIds)
                ->where('user_id', $existingUser->id)
                ->where('is_active', true)
                ->exists();
            if ($alreadyInAccount || (int) $existingUser->id === (int) $subscriberAdmin->id) {
                $isNewUniqueEmployee = false;
            }
        }

        if ($isNewUniqueEmployee && $usage && $usage['employees'] >= $usage['max_users']) {
            return back()->with('error', "Your subscription allows up to {$usage['max_users']} active employee(s). Upgrade your plan to onboard more staff.");
        }

        DB::transaction(function () use ($validated, $targetTenant, $assignedRoles, $subscriberAdmin, $existingUser): void {
            $member = $existingUser;

            if (! $member) {
                $member = User::query()->create([
                    'name' => trim($validated['name']),
                    'email' => $validated['email'],
                    'phone' => $validated['phone'] ?? null,
                    'password' => Hash::make(! empty($validated['password']) ? $validated['password'] : 'PharmaStaff@2026'),
                    'account_type' => 'staff',
                    'subscriber_id' => $subscriberAdmin?->id,
                    'status' => 'active',
                    'current_tenant_id' => $targetTenant->id,
                ]);
            }

            $targetTenant->users()->attach($member->id, [
                'branch_id' => $validated['branch_id'] ?? null,
                'is_owner' => false,
                'role' => $assignedRoles[0],
                'roles' => json_encode($assignedRoles),
                'is_active' => true,
                'joined_at' => now(),
            ]);

            AuditLog::record(
                action: 'team.member_added',
                description: "Assigned {$member->name} to {$targetTenant->name} with roles: ".implode(', ', $assignedRoles).'.',
                subject: $member,
                metadata: ['roles' => $assignedRoles, 'branch_id' => $validated['branch_id'] ?? null],
                tenantId: $targetTenant->id,
            );
        });

        return back()->with('success', 'Employee added and roles assigned successfully.');
    }

    public function updateMembership(Request $request, int $membershipId, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $currentTenant = $tenantContext->tenant();
        $subscriberAdmin = $user->effectiveSubscriberAdmin() ?? $currentTenant->owner;

        $membership = DB::table('tenant_user')->where('id', $membershipId)->first();
        if (! $membership) {
            abort(404);
        }

        $targetTenant = Tenant::query()->findOrFail($membership->tenant_id);
        $allowedByOwner = $user->isSubscriberAdmin() && (int) $targetTenant->owner_id === (int) $user->id;
        $allowedByTenant = (int) $targetTenant->id === (int) $currentTenant->id;

        if (! $allowedByOwner && ! $allowedByTenant) {
            abort(403);
        }

        if ((bool) $membership->is_owner || ($subscriberAdmin && (int) $membership->user_id === (int) $subscriberAdmin->id)) {
            return back()->with('error', 'Business Subscriber Admin privileges cannot be downgraded here.');
        }

        $allowedRoleSlugs = array_column(
            TenantRole::optionsForSubscriber($subscriberAdmin?->id, includeAdmin: false),
            'value'
        );

        $validated = $request->validate([
            'branch_id' => [
                'nullable',
                Rule::exists('branches', 'id')->where('tenant_id', $targetTenant->id),
            ],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => [Rule::in($allowedRoleSlugs)],
            'is_active' => ['required', 'boolean'],
        ]);

        $roles = array_values(array_unique($validated['roles']));

        DB::table('tenant_user')
            ->where('id', $membershipId)
            ->update([
                'branch_id' => $validated['branch_id'] ?? null,
                'role' => $roles[0],
                'roles' => json_encode($roles),
                'is_active' => (bool) $validated['is_active'],
                'updated_at' => now(),
            ]);

        AuditLog::record(
            action: 'team.member_updated',
            description: 'Updated employee assignment with roles: '.implode(', ', $roles).'.',
            metadata: ['membership_id' => $membershipId, 'roles' => $roles, 'is_active' => $validated['is_active']],
            tenantId: $targetTenant->id,
        );

        return back()->with('success', 'Employee roles & branch assignment updated.');
    }

    public function storeRole(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $tenant = $tenantContext->tenant();
        $subscriberAdmin = $user->effectiveSubscriberAdmin() ?? $tenant?->owner;

        if (! $subscriberAdmin || ! $user->isSubscriberAdmin()) {
            abort(403, 'Only the Business Subscriber Admin can create custom roles.');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => [Rule::in(array_keys(TenantRole::PERMISSION_CATALOG))],
        ]);

        $slug = Str::slug($validated['name'], '_');
        if ($slug === '' || in_array($slug, array_column(TenantRole::cases(), 'value'), true) || $slug === 'owner') {
            $slug = 'custom_'.($slug ?: Str::random(5));
        }

        $exists = Role::query()
            ->where('tenant_id', $tenant?->id)
            ->where('slug', $slug)
            ->exists();

        if ($exists) {
            return back()->with('error', "A custom role matching \"{$validated['name']}\" already exists.");
        }

        Role::query()->create([
            'tenant_id' => $tenant?->id,
            'user_id' => $subscriberAdmin->id,
            'name' => trim($validated['name']),
            'slug' => $slug,
            'guard_name' => 'web',
            'description' => $validated['description'] ?? null,
            'permissions' => array_values(array_unique($validated['permissions'])),
            'is_system' => false,
        ]);

        return back()->with('success', "Custom role \"{$validated['name']}\" created and ready to assign.");
    }
}
