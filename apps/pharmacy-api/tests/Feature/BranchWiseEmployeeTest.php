<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\User;
use App\Services\TenantProvisioningService;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BranchWiseEmployeeTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $owner;
    private Branch $branchA;
    private Branch $branchB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);

        $this->owner = User::create([
            'name' => 'Owner Dr. Admin',
            'email' => 'admin@testpharma.test',
            'password' => Hash::make('password'),
            'account_type' => 'admin',
            'status' => 'active',
        ]);

        $provisioning = app(TenantProvisioningService::class);
        $this->tenant = $provisioning->createTenantForUser($this->owner, [
            'name' => 'Test Pharma Care',
            'plan_key' => 'growth',
        ]);

        TenantDomain::setPrimaryForTenant($this->tenant, 'demo.localhost');

        $this->branchA = $this->tenant->branches()->first();

        $currentTenant = app(\App\Tenancy\CurrentTenant::class);
        $this->branchB = $currentTenant->run($this->tenant, function () {
            return Branch::create([
                'tenant_id' => $this->tenant->id,
                'name' => 'Dhanmondi Branch',
                'code' => 'DND-01',
                'is_head_office' => false,
                'is_active' => true,
            ]);
        });
    }

    public function test_employee_can_be_added_with_specific_primary_branch(): void
    {
        $cashierRole = Role::withoutGlobalScopes()
            ->where('tenant_id', $this->tenant->id)
            ->where('slug', 'cashier')
            ->first();

        $response = $this->actingAs($this->owner)
            ->withSession([
                'current_tenant_id' => $this->tenant->id,
                'active_branch_id' => $this->branchB->id,
            ])
            ->from(route('team.index'))
            ->post(route('team.store'), [
                'name' => 'Rafiq Islam',
                'email' => 'rafiq@testpharmacy.com',
                'phone' => '01711223344',
                'role_id' => $cashierRole?->id,
                'branch_id' => $this->branchB->id,
                'branch_ids' => [$this->branchB->id],
                'access_all_branches' => false,
            ]);

        $response->assertRedirect(route('team.index'));

        $newEmployee = User::where('email', 'rafiq@testpharmacy.com')->first();
        $this->assertNotNull($newEmployee);

        // Check pivot in tenant_user
        $membership = \DB::table('tenant_user')
            ->where('tenant_id', $this->tenant->id)
            ->where('user_id', $newEmployee->id)
            ->first();

        $this->assertNotNull($membership);
        $this->assertEquals($this->branchB->id, $membership->branch_id);

        // Check user_branches table
        $this->assertTrue(
            \DB::table('user_branches')
                ->where('user_id', $newEmployee->id)
                ->where('branch_id', $this->branchB->id)
                ->exists()
        );
    }

    public function test_team_index_returns_branch_metadata(): void
    {
        $response = $this->actingAs($this->owner)
            ->withSession([
                'current_tenant_id' => $this->tenant->id,
                'active_branch_id' => $this->branchA->id,
            ])
            ->get(route('team.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) =>
            $page->component('Team/Index')
                ->has('members')
                ->where('activeBranchId', $this->branchA->id)
                ->where('members.0.branch_name', $this->branchA->name)
                ->where('members.0.branch_code', $this->branchA->code)
        );
    }

    public function test_employee_membership_branch_can_be_updated(): void
    {
        $staff = User::create([
            'name' => 'Pharmacist Nabila',
            'email' => 'nabila@testpharma.test',
            'password' => Hash::make('password'),
            'account_type' => 'staff',
            'status' => 'active',
        ]);

        $this->tenant->users()->attach($staff->id, [
            'is_owner' => false,
            'role' => 'pharmacist',
            'roles' => json_encode(['pharmacist']),
            'is_active' => true,
            'branch_id' => $this->branchA->id,
        ]);

        $membership = \DB::table('tenant_user')
            ->where('tenant_id', $this->tenant->id)
            ->where('user_id', $staff->id)
            ->first();

        $response = $this->actingAs($this->owner)
            ->withSession([
                'current_tenant_id' => $this->tenant->id,
                'active_branch_id' => $this->branchA->id,
            ])
            ->from(route('team.index'))
            ->put(route('team.memberships.update', $membership->id), [
                'branch_id' => $this->branchB->id,
                'branch_ids' => [$this->branchB->id],
                'is_active' => true,
                'role' => 'pharmacist',
            ]);

        $response->assertRedirect(route('team.index'));

        $updatedMembership = \DB::table('tenant_user')
            ->where('id', $membership->id)
            ->first();

        $this->assertEquals($this->branchB->id, $updatedMembership->branch_id);

        $this->assertTrue(
            \DB::table('user_branches')
                ->where('user_id', $staff->id)
                ->where('branch_id', $this->branchB->id)
                ->exists()
        );
    }

    public function test_branch_manager_can_only_add_employee_to_their_own_branch(): void
    {
        $manager = User::create([
            'name' => 'Manager Tariq',
            'email' => 'tariq@testpharma.test',
            'password' => Hash::make('password'),
            'account_type' => 'staff',
            'status' => 'active',
        ]);

        $this->tenant->users()->attach($manager->id, [
            'is_owner' => false,
            'role' => 'manager',
            'roles' => json_encode(['manager']),
            'is_active' => true,
            'branch_id' => $this->branchB->id,
        ]);
        $manager->branches()->sync([$this->branchB->id]);

        $cashierRole = Role::withoutGlobalScopes()
            ->where('tenant_id', $this->tenant->id)
            ->where('slug', 'cashier')
            ->first();

        // Manager tries to add employee to branchA or grant all branches
        $response = $this->actingAs($manager)
            ->withSession([
                'current_tenant_id' => $this->tenant->id,
                'active_branch_id' => $this->branchB->id,
            ])
            ->from(route('team.index'))
            ->post(route('team.store'), [
                'name' => 'Cashier Kamal',
                'email' => 'kamal@testpharma.test',
                'role_id' => $cashierRole?->id,
                'branch_id' => $this->branchA->id,
                'branch_ids' => [$this->branchA->id],
                'access_all_branches' => true,
            ]);

        $response->assertRedirect(route('team.index'));

        $kamal = User::where('email', 'kamal@testpharma.test')->first();
        $this->assertNotNull($kamal);

        $membership = \DB::table('tenant_user')
            ->where('tenant_id', $this->tenant->id)
            ->where('user_id', $kamal->id)
            ->first();

        // Enforced to manager's branch (branchB) and no access to all branches
        $this->assertEquals($this->branchB->id, $membership->branch_id);

        $assignedBranches = \DB::table('user_branches')
            ->where('user_id', $kamal->id)
            ->pluck('branch_id')
            ->toArray();

        $this->assertEquals([$this->branchB->id], $assignedBranches);
    }
}
