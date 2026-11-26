<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Core\Models\UserPermissionOverride;
use App\Modules\Core\Services\AccessService;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacPermissionCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class Phase1RbacAndTenancyRlsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(RbacPermissionCatalogSeeder::class);
    }

    public function test_postgresql_row_level_security_isolates_tenants(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('RLS is PostgreSQL specific.');
        }

        $provisioning = app(TenantProvisioningService::class);
        $ownerA = User::factory()->create(['account_type' => 'admin']);
        $tenantA = $provisioning->createTenantForUser($ownerA, [
            'name' => 'RLS Pharmacy A',
            'plan_key' => 'growth',
        ]);

        $ownerB = User::factory()->create(['account_type' => 'admin']);
        $tenantB = $provisioning->createTenantForUser($ownerB, [
            'name' => 'RLS Pharmacy B',
            'plan_key' => 'growth',
        ]);

        app(CurrentTenant::class)->run($tenantA, function () use ($tenantA) {
            Customer::create([
                'tenant_id' => $tenantA->id,
                'name' => 'Patient Alpha',
                'phone' => '01711111111',
            ]);
        });

        app(CurrentTenant::class)->run($tenantB, function () use ($tenantB) {
            Customer::create([
                'tenant_id' => $tenantB->id,
                'name' => 'Patient Beta',
                'phone' => '01722222222',
            ]);
        });

        // In PostgreSQL, superusers bypass RLS by design. Switch to app_user (non-superuser) to test RLS enforcement.
        DB::statement("DO \$do\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN CREATE ROLE app_user LOGIN PASSWORD 'secret' NOSUPERUSER; END IF; END \$do\$");
        DB::statement('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user');
        DB::statement('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user');
        DB::statement('SET ROLE app_user');

        try {
            // Test with Tenant A RLS context
            DB::statement("SELECT set_config('app.tenant_id', :id, false)", ['id' => (string) $tenantA->id]);
            $customersA = DB::select('SELECT name FROM customers');
            $namesA = array_column($customersA, 'name');
            $this->assertContains('Patient Alpha', $namesA);
            $this->assertNotContains('Patient Beta', $namesA);

            // Test with Tenant B RLS context
            DB::statement("SELECT set_config('app.tenant_id', :id, false)", ['id' => (string) $tenantB->id]);
            $customersB = DB::select('SELECT name FROM customers');
            $namesB = array_column($customersB, 'name');
            $this->assertContains('Patient Beta', $namesB);
            $this->assertNotContains('Patient Alpha', $namesB);
        } finally {
            DB::statement('RESET ROLE');
        }
    }

    public function test_default_system_roles_and_limits_are_seeded(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Role Testing Pharmacy',
            'plan_key' => 'growth',
        ]);

        $roles = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->get()->keyBy('name');

        $this->assertGreaterThanOrEqual(8, $roles->count());
        $this->assertTrue($roles->has('Owner'));
        $this->assertTrue($roles->has('Manager'));
        $this->assertTrue($roles->has('Pharmacist'));
        $this->assertTrue($roles->has('Cashier'));
        $this->assertTrue($roles->has('Store keeper'));
        $this->assertTrue($roles->has('Purchase officer'));
        $this->assertTrue($roles->has('Accountant'));
        $this->assertTrue($roles->has('Auditor'));

        // Owner is locked and has unlimited limits (null)
        $this->assertTrue((bool) $roles['Owner']->is_locked);
        $this->assertNull($roles['Owner']->getLimit('discount_percent'));

        // Cashier has 5% discount cap and 2h void window
        $this->assertEquals(5.00, $roles['Cashier']->getLimit('discount_percent'));
        $this->assertEquals(2.00, $roles['Cashier']->getLimit('void_window_hours'));

        // Pharmacist has 10% discount cap
        $this->assertEquals(10.00, $roles['Pharmacist']->getLimit('discount_percent'));

        // Manager has 20% discount cap
        $this->assertEquals(20.00, $roles['Manager']->getLimit('discount_percent'));
    }

    public function test_pos_discount_cap_is_enforced_server_side(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Discount Cap Pharmacy',
            'plan_key' => 'growth',
        ]);

        $branch = $tenant->branches()->first();
        $cashierRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->where('name', 'Cashier')->first();

        $cashier = User::factory()->create([
            'role_id' => $cashierRole->id,
            'current_tenant_id' => $tenant->id,
            'access_all_branches' => true,
        ]);

        $tenant->users()->attach($cashier->id, [
            'branch_id' => $branch->id,
            'is_owner' => false,
            'role' => 'cashier',
            'is_active' => true,
            'joined_at' => now(),
        ]);

        $medicine = app(CurrentTenant::class)->run($tenant, function () use ($tenant, $branch) {
            $m = Medicine::create([
                'tenant_id' => $tenant->id,
                'name' => 'Paracetamol 500mg',
                'sku' => 'PARA-500',
                'unit' => 'piece',
                'default_selling_price' => 10.00,
                'default_purchase_price' => 7.00,
                'is_active' => true,
            ]);

            MedicineBatch::create([
                'tenant_id' => $tenant->id,
                'medicine_id' => $m->id,
                'branch_id' => $branch->id,
                'batch_number' => 'B-001',
                'quantity_received' => 100,
                'quantity_available' => 100,
                'selling_price' => 10.00,
                'purchase_price' => 7.00,
                'expiry_date' => now()->addYear(),
                'status' => 'active',
            ]);

            return $m;
        });

        // 1. Attempt checkout with 15% discount (exceeds Cashier cap of 5%)
        $response = $this->actingAs($cashier)
            ->withSession(['active_branch_id' => $branch->id])
            ->post('/pos/checkout', [
                'items' => [
                    ['medicine_id' => $medicine->id, 'quantity' => 10, 'sale_unit' => 'piece'],
                ],
                'discount' => 15,
                'discount_type' => 'percent',
                'paid_amount' => 85,
            ]);

        $response->assertStatus(422);

        // 2. Checkout with 5% discount (within Cashier cap)
        $validResponse = $this->actingAs($cashier)
            ->withSession(['active_branch_id' => $branch->id])
            ->post('/pos/checkout', [
                'items' => [
                    ['medicine_id' => $medicine->id, 'quantity' => 10, 'sale_unit' => 'piece'],
                ],
                'discount' => 5,
                'discount_type' => 'percent',
                'paid_amount' => 95,
            ]);

        $validResponse->assertRedirect();
        $this->assertDatabaseHas('sales', [
            'tenant_id' => $tenant->id,
            'user_id' => $cashier->id,
            'discount_amount' => 5.00,
            'total_amount' => 95.00,
        ]);
    }

    public function test_branch_scoping_prevents_unauthorized_branch_operations(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Branch Scoping Pharmacy',
            'plan_key' => 'growth',
        ]);

        $branchA = $tenant->branches()->first();
        $branchB = app(CurrentTenant::class)->run($tenant, fn () => Branch::create([
            'tenant_id' => $tenant->id,
            'name' => 'Branch Beta',
            'code' => 'BB',
            'is_head_office' => false,
            'is_active' => true,
        ]));

        $pharmacistRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->where('name', 'Pharmacist')->first();

        $pharmacist = User::factory()->create([
            'role_id' => $pharmacistRole->id,
            'current_tenant_id' => $tenant->id,
            'access_all_branches' => false,
        ]);

        $pharmacist->branches()->attach($branchA->id);

        $tenant->users()->attach($pharmacist->id, [
            'branch_id' => $branchA->id,
            'is_owner' => false,
            'role' => 'pharmacist',
            'is_active' => true,
            'joined_at' => now(),
        ]);

        // Pharmacist can operate in Branch A
        $this->assertTrue($pharmacist->canAccessBranch($branchA));

        // Pharmacist cannot operate in Branch B
        $this->assertFalse($pharmacist->canAccessBranch($branchB));

        // Attempt checkout in Branch B must abort with 403
        $medicine = app(CurrentTenant::class)->run($tenant, function () use ($tenant, $branchB) {
            $m = Medicine::create([
                'tenant_id' => $tenant->id,
                'name' => 'Amoxicillin 500mg',
                'sku' => 'AMOX-500',
                'unit' => 'piece',
                'default_selling_price' => 15.00,
                'is_active' => true,
            ]);

            MedicineBatch::create([
                'tenant_id' => $tenant->id,
                'medicine_id' => $m->id,
                'branch_id' => $branchB->id,
                'batch_number' => 'B-002',
                'quantity_received' => 50,
                'quantity_available' => 50,
                'selling_price' => 15.00,
                'expiry_date' => now()->addYear(),
                'status' => 'active',
            ]);

            return $m;
        });

        $response = $this->actingAs($pharmacist)
            ->withSession(['active_branch_id' => $branchB->id])
            ->post('/pos/checkout', [
                'items' => [
                    ['medicine_id' => $medicine->id, 'quantity' => 2, 'sale_unit' => 'piece'],
                ],
                'paid_amount' => 30,
            ]);

        $response->assertStatus(403);
    }

    public function test_data_scopes_and_user_overrides(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Scopes Pharmacy',
            'plan_key' => 'growth',
        ]);

        $cashierRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->where('name', 'Cashier')->first();

        $cashier = User::factory()->create([
            'role_id' => $cashierRole->id,
            'current_tenant_id' => $tenant->id,
            'access_all_branches' => true,
        ]);

        $accessService = app(AccessService::class);

        // Cashier base role: sale.view has 'own' scope
        $this->assertEquals('own', $accessService->getEffectiveScope($cashier, 'sale.view'));
        $this->assertTrue($accessService->hasPermission($cashier, 'sale.view', 'own'));
        $this->assertFalse($accessService->hasPermission($cashier, 'sale.view', 'all'));

        // Grant explicit 'deny' override on sale.create
        app(CurrentTenant::class)->run($tenant, function () use ($tenant, $cashier, $owner) {
            UserPermissionOverride::create([
                'tenant_id' => $tenant->id,
                'user_id' => $cashier->id,
                'permission_key' => 'sale.create',
                'effect' => 'deny',
                'granted_by' => $owner->id,
            ]);
        });

        $cashier->bumpPermissionVersion();

        // Deny override strictly beats role allow!
        $this->assertFalse($accessService->hasPermission($cashier, 'sale.create'));

        // Add explicit 'allow' override on discount.manage with 'all' scope
        app(CurrentTenant::class)->run($tenant, function () use ($tenant, $cashier, $owner) {
            UserPermissionOverride::create([
                'tenant_id' => $tenant->id,
                'user_id' => $cashier->id,
                'permission_key' => 'discount.manage',
                'effect' => 'allow',
                'scope' => 'all',
                'granted_by' => $owner->id,
            ]);
        });

        $cashier->bumpPermissionVersion();

        $this->assertTrue($accessService->hasPermission($cashier, 'discount.manage'));
    }

    public function test_privilege_escalation_is_blocked(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Escalation Pharmacy',
            'plan_key' => 'growth',
        ]);

        $managerRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->where('name', 'Manager')->first();
        $ownerRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->where('name', 'Owner')->first();

        $manager = User::factory()->create([
            'role_id' => $managerRole->id,
            'current_tenant_id' => $tenant->id,
            'access_all_branches' => true,
        ]);

        $tenant->users()->attach($manager->id, [
            'is_owner' => false,
            'role' => 'manager',
            'is_active' => true,
            'joined_at' => now(),
        ]);

        // 1. Manager attempts to onboard a new user with Owner role -> BLOCKED
        $response = $this->actingAs($manager)->post('/team', [
            'name' => 'Sneaky Owner',
            'email' => 'sneaky@owner.com',
            'role_id' => $ownerRole->id,
        ]);

        $response->assertSessionHas('error', 'Only the pharmacy Owner can assign the Owner role.');

        // 2. User cannot edit their own role -> BLOCKED
        $membership = DB::table('tenant_user')
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $manager->id)
            ->first();

        $editSelfResponse = $this->actingAs($manager)->put("/team/memberships/{$membership->id}", [
            'role_id' => $ownerRole->id,
            'is_active' => true,
        ]);

        $editSelfResponse->assertSessionHas('error', 'Security rule: You cannot edit your own role.');
    }

    public function test_field_level_protection_hides_cost_from_pharmacist(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Cost Protection Pharmacy',
            'plan_key' => 'growth',
        ]);

        $branch = $tenant->branches()->first();
        $pharmacistRole = Role::withoutGlobalScopes()->where('tenant_id', $tenant->id)->where('name', 'Pharmacist')->first();

        $pharmacist = User::factory()->create([
            'role_id' => $pharmacistRole->id,
            'current_tenant_id' => $tenant->id,
            'access_all_branches' => true,
        ]);

        $tenant->users()->attach($pharmacist->id, [
            'branch_id' => $branch->id,
            'is_owner' => false,
            'role' => 'pharmacist',
            'is_active' => true,
            'joined_at' => now(),
        ]);

        app(CurrentTenant::class)->run($tenant, function () use ($tenant, $branch) {
            $m = Medicine::create([
                'tenant_id' => $tenant->id,
                'name' => 'Omeprazole 20mg',
                'sku' => 'OMEP-20',
                'unit' => 'piece',
                'default_selling_price' => 8.00,
                'default_purchase_price' => 5.20,
                'is_active' => true,
            ]);

            MedicineBatch::create([
                'tenant_id' => $tenant->id,
                'medicine_id' => $m->id,
                'branch_id' => $branch->id,
                'batch_number' => 'B-003',
                'quantity_received' => 100,
                'quantity_available' => 100,
                'selling_price' => 8.00,
                'purchase_price' => 5.20,
                'expiry_date' => now()->addYear(),
                'status' => 'active',
            ]);
        });

        // Pharmacist viewing inventory batches receives null for purchase_price and stock_cost_value
        $response = $this->actingAs($pharmacist)
            ->withSession(['active_branch_id' => $branch->id])
            ->get('/inventory/batches');

        $response->assertOk();
        $response->assertInertia(function ($page) {
            $batches = $page->toArray()['props']['batches']['data'];
            $this->assertNotEmpty($batches);
            foreach ($batches as $batch) {
                // Cost fields must be NULL for pharmacist
                $this->assertNull($batch['purchase_price']);
                $this->assertNull($batch['stock_cost_value']);
            }
        });
    }
}
