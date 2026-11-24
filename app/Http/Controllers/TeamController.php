<?php

namespace App\Http\Controllers;

use App\Enums\TenantRole;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Core\Models\RoleLimit;
use App\Modules\Core\Models\RolePermission;
use App\Modules\Core\Models\UserPermissionOverride;
use App\Modules\Core\Services\AccessService;
use App\Support\TenantContext;
use Database\Seeders\RbacPermissionCatalogSeeder;
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
    public function index(Request $request, TenantContext $tenantContext, AccessService $accessService): Response
    {
        $user = $request->user();
        $currentTenant = $tenantContext->tenant();
        $isOwner = (int) $currentTenant->owner_id === (int) $user->id;

        // Ensure roles exist for tenant
        if (Role::where('tenant_id', $currentTenant->id)->count() === 0) {
            RbacPermissionCatalogSeeder::seedRolesForTenant($currentTenant);
        }

        $branches = Branch::where('tenant_id', $currentTenant->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'tenant_id', 'name', 'code']);

        $roles = Role::where('tenant_id', $currentTenant->id)
            ->with(['rolePermissions', 'roleLimits'])
            ->orderBy('sort')
            ->get()
            ->map(function (Role $role) {
                return [
                    'id' => $role->id,
                    'name' => $role->name,
                    'slug' => $role->slug,
                    'description' => $role->description,
                    'is_system' => (bool) $role->is_system,
                    'is_locked' => (bool) $role->is_locked,
                    'sort' => $role->sort,
                    'permissions' => $role->rolePermissions->mapWithKeys(function ($rp) {
                        return [$rp->permission_key => $rp->scope];
                    })->all(),
                    'limits' => $role->roleLimits->mapWithKeys(function ($rl) {
                        return [$rl->limit_key => $rl->value];
                    })->all(),
                ];
            });

        $permissionsCatalog = Permission::orderBy('module')
            ->orderBy('key')
            ->get(['key', 'name', 'module', 'action', 'description', 'is_sensitive', 'requires_feature', 'supports_scope'])
            ->groupBy('module');

        $users = DB::table('tenant_user')
            ->join('users', 'users.id', '=', 'tenant_user.user_id')
            ->where('tenant_user.tenant_id', $currentTenant->id)
            ->orderBy('users.name')
            ->select([
                'tenant_user.id as membership_id',
                'tenant_user.tenant_id',
                'tenant_user.user_id',
                'tenant_user.branch_id',
                'tenant_user.is_owner',
                'tenant_user.role as legacy_role',
                'tenant_user.is_active',
                'tenant_user.joined_at',
                'users.name',
                'users.email',
                'users.phone',
                'users.role_id',
                'users.permission_version',
                'users.access_all_branches',
                'users.manager_pin_hash',
            ])
            ->get();

        $userIds = $users->pluck('user_id')->all();
        $userBranchesMap = DB::table('user_branches')
            ->whereIn('user_id', $userIds)
            ->get()
            ->groupBy('user_id')
            ->map(fn ($rows) => $rows->pluck('branch_id')->all());

        $overridesMap = UserPermissionOverride::whereIn('user_id', $userIds)
            ->where('tenant_id', $currentTenant->id)
            ->get()
            ->groupBy('user_id');

        $members = $users->map(function ($row) use ($roles, $branches, $userBranchesMap, $overridesMap, $accessService) {
            $assignedRole = $roles->firstWhere('id', $row->role_id)
                ?? $roles->firstWhere('name', ucfirst((string) $row->legacy_role))
                ?? $roles->firstWhere('slug', (string) $row->legacy_role);

            $assignedBranchIds = $userBranchesMap->get($row->user_id, []);
            if ($row->branch_id && ! in_array($row->branch_id, $assignedBranchIds, true)) {
                $assignedBranchIds[] = (int) $row->branch_id;
            }

            $userModel = new User([
                'id' => $row->user_id,
                'is_super_admin' => false,
                'permission_version' => $row->permission_version,
                'access_all_branches' => (bool) $row->access_all_branches,
            ]);
            $userModel->exists = true;
            $userModel->setRelation('role', $assignedRole ? Role::find($assignedRole['id']) : null);

            $userOverrides = ($overridesMap->get($row->user_id) ?? collect())->map(function ($ov) {
                return [
                    'id' => $ov->id,
                    'permission_key' => $ov->permission_key,
                    'effect' => $ov->effect,
                    'scope' => $ov->scope,
                    'expires_at' => $ov->expires_at?->format('Y-m-d H:i'),
                    'reason' => $ov->reason,
                    'is_expired' => $ov->isExpired(),
                ];
            });

            return [
                'id' => (int) $row->membership_id,
                'user_id' => (int) $row->user_id,
                'tenant_id' => (int) $row->tenant_id,
                'name' => $row->name,
                'email' => $row->email,
                'phone' => $row->phone,
                'role_id' => $assignedRole ? $assignedRole['id'] : null,
                'role_name' => $assignedRole ? $assignedRole['name'] : 'No Role',
                'role_slug' => $assignedRole ? $assignedRole['slug'] : '',
                'branch_id' => $row->branch_id ? (int) $row->branch_id : null,
                'branch_ids' => $assignedBranchIds,
                'access_all_branches' => (bool) $row->access_all_branches,
                'has_pin' => ! empty($row->manager_pin_hash),
                'is_active' => (bool) $row->is_active,
                'is_owner' => (bool) $row->is_owner,
                'joined_at' => $row->joined_at ? Carbon::parse($row->joined_at)->format('d M Y') : '-',
                'overrides' => $userOverrides,
            ];
        });

        $activityLog = AuditLog::where('tenant_id', $currentTenant->id)
            ->whereIn('action', [
                'team.member_added',
                'team.member_updated',
                'team.role_created',
                'team.role_updated',
                'team.role_deleted',
                'team.override_created',
                'team.override_deleted',
                'team.pin_updated',
                'team.password_reset',
            ])
            ->latest()
            ->limit(30)
            ->get();

        return Inertia::render('Team/Index', [
            'members' => $members,
            'roles' => $roles,
            'permissionsCatalog' => $permissionsCatalog,
            'branches' => $branches,
            'activityLog' => $activityLog,
            'currentTenantId' => $currentTenant->id,
            'isOwner' => $isOwner,
            'canManageRoles' => $isOwner || $user->hasPermission('role.manage'),
            'currentTab' => in_array($request->query('tab'), ['matrix', 'activity']) ? $request->query('tab') : 'users',
        ]);
    }

    public function store(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $tenant = $tenantContext->tenant();
        $isOwner = (int) $tenant->owner_id === (int) $user->id;

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'role_id' => ['nullable'],
            'roles' => ['nullable', 'array'],
            'role' => ['nullable', 'string'],
            'branch_ids' => ['nullable', 'array'],
            'branch_ids.*' => [Rule::exists('branches', 'id')->where('tenant_id', $tenant->id)],
            'access_all_branches' => ['nullable', 'boolean'],
            'manager_pin' => ['nullable', 'string', 'digits:4'],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        $targetRole = null;
        if (! empty($validated['role_id'])) {
            $targetRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->find($validated['role_id']);
        }

        if (! $targetRole && ! empty($validated['roles'])) {
            $slug = $validated['roles'][0];
            $targetRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)
                ->where(fn ($q) => $q->where('slug', $slug)->orWhere('name', ucfirst($slug))->orWhere('slug', str($slug)->slug('_')))
                ->first();
        }

        if (! $targetRole && ! empty($validated['role'])) {
            $slug = $validated['role'];
            $targetRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)
                ->where(fn ($q) => $q->where('slug', $slug)->orWhere('name', ucfirst($slug))->orWhere('slug', str($slug)->slug('_')))
                ->first();
        }

        if (! $targetRole) {
            $targetRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->where('name', 'Pharmacist')->first()
                ?? Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->first();
        }

        // Privilege escalation check: cannot assign Owner unless caller is Owner
        if ($targetRole && $targetRole->name === 'Owner' && ! $isOwner) {
            return back()->with('error', 'Only the pharmacy Owner can assign the Owner role.');
        }

        if ($tenant->users()->where('users.email', $validated['email'])->exists()) {
            return back()->with('error', "Employee with email {$validated['email']} already exists in this pharmacy.");
        }

        // Plan Limit Enforcement: check max_users
        app(\App\Modules\Billing\Services\FeatureManager::class)
            ->setTenant($tenant)
            ->assertCanUse('max_users');

        $assignedRoles = ! empty($validated['roles'])
            ? array_values(array_unique($validated['roles']))
            : [($targetRole?->slug ?: ($validated['role'] ?? 'pharmacist'))];

        DB::transaction(function () use ($validated, $tenant, $targetRole, $assignedRoles, $user) {
            $member = User::where('email', $validated['email'])->first();

            if (! $member) {
                $member = User::create([
                    'name' => trim($validated['name']),
                    'email' => $validated['email'],
                    'phone' => $validated['phone'] ?? null,
                    'password' => Hash::make($validated['password'] ?? 'PharmaStaff@2026'),
                    'account_type' => 'staff',
                    'role_id' => $targetRole?->id,
                    'status' => 'active',
                    'current_tenant_id' => $tenant->id,
                    'access_all_branches' => (bool) ($validated['access_all_branches'] ?? false),
                    'manager_pin_hash' => ! empty($validated['manager_pin']) ? Hash::make($validated['manager_pin']) : null,
                    'permission_version' => 1,
                ]);
            } else {
                $member->role_id = $targetRole?->id;
                $member->access_all_branches = (bool) ($validated['access_all_branches'] ?? false);
                if (! empty($validated['manager_pin'])) {
                    $member->manager_pin_hash = Hash::make($validated['manager_pin']);
                }
                $member->save();
            }

            // Sync user branches
            $branchIds = $validated['branch_ids'] ?? [];
            if (! empty($branchIds)) {
                $member->branches()->sync($branchIds);
            }

            $primaryBranchId = ! empty($branchIds) ? $branchIds[0] : null;

            $tenant->users()->attach($member->id, [
                'branch_id' => $primaryBranchId,
                'is_owner' => $targetRole && $targetRole->name === 'Owner',
                'role' => $assignedRoles[0],
                'roles' => json_encode($assignedRoles),
                'is_active' => true,
                'joined_at' => now(),
            ]);

            AuditLog::record(
                action: 'team.member_added',
                description: "Onboarded {$member->name} with role ".($targetRole?->name ?? $assignedRoles[0]).".",
                subject: $member,
                metadata: [
                    'role' => $targetRole?->name ?? $assignedRoles[0],
                    'roles' => $assignedRoles,
                    'branches' => $branchIds,
                    'access_all_branches' => $validated['access_all_branches'] ?? false,
                ],
                tenantId: $tenant->id,
            );
        });

        return back()->with('success', "Employee {$validated['name']} added successfully.");
    }

    public function updateMembership(Request $request, int $membershipId, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $tenant = $tenantContext->tenant();
        $isOwner = (int) $tenant->owner_id === (int) $user->id;

        $membership = DB::table('tenant_user')->where('id', $membershipId)->first();
        if (! $membership || (int) $membership->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $targetUser = User::findOrFail($membership->user_id);

        // Rule 1: Nobody can edit their own role
        if ((int) $user->id === (int) $targetUser->id && $request->filled('role_id')) {
            $currentRoleId = $targetUser->role_id;
            if ($currentRoleId && (int) $request->input('role_id') !== (int) $currentRoleId) {
                return back()->with('error', 'Security rule: You cannot edit your own role.');
            }
        }

        // Rule 2: Cannot touch or demote the last Owner
        if ((bool) $membership->is_owner) {
            $otherOwnersCount = DB::table('tenant_user')
                ->where('tenant_id', $tenant->id)
                ->where('is_owner', true)
                ->where('is_active', true)
                ->where('id', '!=', $membershipId)
                ->count();

            if ($otherOwnersCount === 0 && (! $request->input('is_active', true) || $request->input('role_name') !== 'Owner')) {
                return back()->with('error', 'Cannot deactivate or demote the sole active Owner of this pharmacy.');
            }
        }

        $validated = $request->validate([
            'role_id' => ['nullable'],
            'roles' => ['nullable', 'array'],
            'role' => ['nullable', 'string'],
            'branch_ids' => ['nullable', 'array'],
            'branch_ids.*' => [Rule::exists('branches', 'id')->where('tenant_id', $tenant->id)],
            'access_all_branches' => ['nullable', 'boolean'],
            'is_active' => ['required', 'boolean'],
            'manager_pin' => ['nullable', 'string', 'digits:4'],
        ]);

        $newRole = null;
        if (! empty($validated['role_id'])) {
            $newRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->find($validated['role_id']);
        }
        if (! $newRole && ! empty($validated['roles'])) {
            $slug = $validated['roles'][0];
            $newRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)
                ->where(fn ($q) => $q->where('slug', $slug)->orWhere('name', ucfirst($slug))->orWhere('slug', str($slug)->slug('_')))
                ->first();
        }
        if (! $newRole && ! empty($validated['role'])) {
            $slug = $validated['role'];
            $newRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)
                ->where(fn ($q) => $q->where('slug', $slug)->orWhere('name', ucfirst($slug))->orWhere('slug', str($slug)->slug('_')))
                ->first();
        }
        if (! $newRole) {
            $newRole = $targetUser->role ?? Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->first();
        }

        // Privilege escalation: non-owner cannot assign Owner
        if ($newRole && $newRole->name === 'Owner' && ! $isOwner) {
            return back()->with('error', 'Only the Owner can assign the Owner role.');
        }

        $assignedRoles = ! empty($validated['roles'])
            ? array_values(array_unique($validated['roles']))
            : [($newRole?->slug ?: ($validated['role'] ?? 'pharmacist'))];

        DB::transaction(function () use ($membership, $targetUser, $newRole, $assignedRoles, $validated, $tenant) {
            $branchIds = $validated['branch_ids'] ?? [];
            if (! empty($branchIds)) {
                $targetUser->branches()->sync($branchIds);
            }

            if ($newRole) {
                $targetUser->role_id = $newRole->id;
            }
            $targetUser->access_all_branches = (bool) ($validated['access_all_branches'] ?? false);
            if (! empty($validated['manager_pin'])) {
                $targetUser->manager_pin_hash = Hash::make($validated['manager_pin']);
            }
            $targetUser->bumpPermissionVersion();
            $targetUser->save();

            DB::table('tenant_user')
                ->where('id', $membership->id)
                ->update([
                    'branch_id' => ! empty($branchIds) ? $branchIds[0] : null,
                    'is_owner' => $newRole && $newRole->name === 'Owner',
                    'role' => $assignedRoles[0],
                    'roles' => json_encode($assignedRoles),
                    'is_active' => (bool) $validated['is_active'],
                    'updated_at' => now(),
                ]);

            AuditLog::record(
                action: 'team.member_updated',
                description: "Updated employee {$targetUser->name} with role ".($newRole?->name ?? $assignedRoles[0]).".",
                subject: $targetUser,
                metadata: [
                    'role' => $newRole?->name ?? $assignedRoles[0],
                    'roles' => $assignedRoles,
                    'branches' => $branchIds,
                    'is_active' => $validated['is_active'],
                ],
                tenantId: $tenant->id,
            );
        });

        return back()->with('success', "Employee {$targetUser->name} updated successfully.");
    }

    public function storeRole(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $tenant = $tenantContext->tenant();
        $isOwner = (int) $tenant->owner_id === (int) $user->id;

        if (! $isOwner && ! $user->hasPermission('role.manage')) {
            abort(403, 'Unauthorized to create custom roles.');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['string'],
            'scopes' => ['nullable', 'array'],
        ]);

        $name = trim($validated['name']);
        if (Role::where('tenant_id', $tenant->id)->where('name', $name)->exists()) {
            return back()->with('error', "Role \"{$name}\" already exists in this pharmacy.");
        }

        // Rule: A user can assign/create only roles whose permissions are a subset of their own
        if (! $isOwner) {
            foreach ($validated['permissions'] as $pKey) {
                if (! $user->hasPermission($pKey)) {
                    return back()->with('error', "Privilege escalation blocked: You cannot grant permission {$pKey} which you do not possess.");
                }
            }
        }

        DB::transaction(function () use ($tenant, $user, $name, $validated) {
            $role = Role::create([
                'tenant_id' => $tenant->id,
                'user_id' => $user->id,
                'name' => $name,
                'slug' => Str::slug($name, '_'),
                'description' => $validated['description'] ?? null,
                'permissions' => $validated['permissions'],
                'is_system' => false,
                'is_locked' => false,
                'sort' => 10,
            ]);

            $rpRows = [];
            $scopes = $validated['scopes'] ?? [];
            foreach ($validated['permissions'] as $pKey) {
                $rpRows[] = [
                    'role_id' => $role->id,
                    'permission_key' => $pKey,
                    'scope' => $scopes[$pKey] ?? 'all',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            RolePermission::insert($rpRows);

            AuditLog::record(
                action: 'team.role_created',
                description: "Created custom role \"{$name}\" with ".count($rpRows).' permissions.',
                subject: $role,
                tenantId: $tenant->id,
            );
        });

        return back()->with('success', "Role \"{$name}\" created successfully.");
    }

    public function updateRolePermissions(Request $request, Role $role, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $tenant = $tenantContext->tenant();
        $isOwner = (int) $tenant->owner_id === (int) $user->id;

        if (! $isOwner && ! $user->hasPermission('role.manage')) {
            abort(403);
        }

        if ((int) $role->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        if ($role->is_locked) {
            return back()->with('error', 'Owner role is system-locked and permissions cannot be modified.');
        }

        $validated = $request->validate([
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['string'],
            'scopes' => ['nullable', 'array'],
        ]);

        if (! $isOwner) {
            foreach ($validated['permissions'] as $pKey) {
                if (! $user->hasPermission($pKey)) {
                    return back()->with('error', "Privilege escalation: You cannot grant permission {$pKey} which you do not possess.");
                }
            }
        }

        DB::transaction(function () use ($role, $validated, $tenant) {
            RolePermission::where('role_id', $role->id)->delete();

            $rpRows = [];
            $scopes = $validated['scopes'] ?? [];
            foreach ($validated['permissions'] as $pKey) {
                $rpRows[] = [
                    'role_id' => $role->id,
                    'permission_key' => $pKey,
                    'scope' => $scopes[$pKey] ?? 'all',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            RolePermission::insert($rpRows);

            // Invalidate cache for all users holding this role
            User::where('role_id', $role->id)->each(fn (User $u) => $u->bumpPermissionVersion());

            AuditLog::record(
                action: 'team.role_updated',
                description: "Updated permissions for role \"{$role->name}\".",
                subject: $role,
                tenantId: $tenant->id,
            );
        });

        return back()->with('success', "Role {$role->name} permissions updated.");
    }

    public function updateRoleLimits(Request $request, Role $role, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $tenant = $tenantContext->tenant();
        $isOwner = (int) $tenant->owner_id === (int) $user->id;

        if (! $isOwner && ! $user->hasPermission('role.manage')) {
            abort(403);
        }

        if ((int) $role->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        if ($role->is_locked) {
            return back()->with('error', 'Owner role is unlimited and limits cannot be modified.');
        }

        $validated = $request->validate([
            'limits' => ['required', 'array'],
            'limits.*' => ['nullable', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($role, $validated, $tenant) {
            RoleLimit::where('role_id', $role->id)->delete();

            $rlRows = [];
            foreach ($validated['limits'] as $key => $val) {
                $rlRows[] = [
                    'role_id' => $role->id,
                    'limit_key' => $key,
                    'value' => $val !== null ? (float) $val : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            RoleLimit::insert($rlRows);

            User::where('role_id', $role->id)->each(fn (User $u) => $u->bumpPermissionVersion());

            AuditLog::record(
                action: 'team.role_updated',
                description: "Updated operating limits for role \"{$role->name}\".",
                subject: $role,
                tenantId: $tenant->id,
            );
        });

        return back()->with('success', "Role {$role->name} limits updated.");
    }

    public function deleteRole(Role $role, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();

        if ((int) $role->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        if ($role->is_system || $role->is_locked) {
            return back()->with('error', "System role \"{$role->name}\" cannot be deleted.");
        }

        $assignedCount = User::where('role_id', $role->id)->count();
        if ($assignedCount > 0) {
            return back()->with('error', "Cannot delete role \"{$role->name}\" because it is assigned to {$assignedCount} employee(s).");
        }

        $name = $role->name;
        $role->delete();

        AuditLog::record(
            action: 'team.role_deleted',
            description: "Deleted custom role \"{$name}\".",
            tenantId: $tenant->id,
        );

        return back()->with('success', "Custom role \"{$name}\" deleted.");
    }

    public function storeOverride(Request $request, User $targetUser, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $tenant = $tenantContext->tenant();
        $isOwner = (int) $tenant->owner_id === (int) $user->id;

        if (! $isOwner && ! $user->hasPermission('role.manage')) {
            abort(403);
        }

        $validated = $request->validate([
            'permission_key' => ['required', 'string'],
            'effect' => ['required', Rule::in(['allow', 'deny'])],
            'scope' => ['nullable', Rule::in(['own', 'branch', 'all'])],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        // Non-owner cannot grant an 'allow' override for a permission they don't have
        if (! $isOwner && $validated['effect'] === 'allow' && ! $user->hasPermission($validated['permission_key'])) {
            return back()->with('error', "Cannot grant permission {$validated['permission_key']} which you do not possess.");
        }

        UserPermissionOverride::updateOrCreate(
            [
                'tenant_id' => $tenant->id,
                'user_id' => $targetUser->id,
                'permission_key' => $validated['permission_key'],
            ],
            [
                'effect' => $validated['effect'],
                'scope' => $validated['scope'] ?? 'all',
                'expires_at' => $validated['expires_at'] ?? null,
                'reason' => $validated['reason'] ?? null,
                'granted_by' => $user->id,
            ]
        );

        $targetUser->bumpPermissionVersion();

        AuditLog::record(
            action: 'team.override_created',
            description: "Granted {$validated['effect']} override on {$validated['permission_key']} for {$targetUser->name}.",
            subject: $targetUser,
            metadata: $validated,
            tenantId: $tenant->id,
        );

        return back()->with('success', "Permission override saved for {$targetUser->name}.");
    }

    public function deleteOverride(UserPermissionOverride $override, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        if ((int) $override->tenant_id !== (int) $tenant->id) {
            abort(404);
        }

        $user = $override->user;
        $permKey = $override->permission_key;
        $override->delete();

        $user?->bumpPermissionVersion();

        AuditLog::record(
            action: 'team.override_deleted',
            description: "Removed permission override for {$permKey}.",
            tenantId: $tenant->id,
        );

        return back()->with('success', "Override for {$permKey} removed.");
    }

    public function setPin(Request $request, User $targetUser, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $tenant = $tenantContext->tenant();
        $isOwner = (int) $tenant->owner_id === (int) $user->id;

        if (! $isOwner && (int) $user->id !== (int) $targetUser->id && ! $user->hasPermission('user.manage')) {
            abort(403);
        }

        $validated = $request->validate([
            'pin' => ['required', 'string', 'digits:4'],
        ]);

        $targetUser->setManagerPin($validated['pin']);

        AuditLog::record(
            action: 'team.pin_updated',
            description: "Updated manager PIN for {$targetUser->name}.",
            subject: $targetUser,
            tenantId: $tenant->id,
        );

        return back()->with('success', "Manager PIN updated for {$targetUser->name}.");
    }

    public function resetPassword(Request $request, User $targetUser, TenantContext $tenantContext): RedirectResponse
    {
        $user = $request->user();
        $tenant = $tenantContext->tenant();
        $isOwner = (int) $tenant->owner_id === (int) $user->id;

        if (! $isOwner && ! $user->hasPermission('user.manage')) {
            abort(403);
        }

        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8'],
        ]);

        $targetUser->password = Hash::make($validated['password']);
        $targetUser->must_change_password = true;
        $targetUser->bumpPermissionVersion();
        $targetUser->save();

        AuditLog::record(
            action: 'team.password_reset',
            description: "Reset password for {$targetUser->name}.",
            subject: $targetUser,
            tenantId: $tenant->id,
        );

        return back()->with('success', "Password reset for {$targetUser->name}.");
    }
}
