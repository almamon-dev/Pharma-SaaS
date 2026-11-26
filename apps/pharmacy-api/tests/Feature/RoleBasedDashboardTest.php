<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use App\Models\Branch;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Role;
use App\Models\SaasPlan;
use App\Models\Sale;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\User;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RoleBasedDashboardTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $manager;
    private User $pharmacist;
    private User $cashier;
    private User $clerk;
    private Tenant $tenant;
    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);

        $plan = SaasPlan::where('key', 'growth')->first();

        // 1. Admin
        $this->admin = User::create([
            'name' => 'Dr. Admin',
            'email' => 'admin@testpharma.test',
            'password' => Hash::make('password'),
            'account_type' => 'admin',
            'status' => 'active',
        ]);

        $this->tenant = Tenant::create([
            'owner_id' => $this->admin->id,
            'name' => 'Test Pharma Care',
            'slug' => 'test-pharma',
            'currency_code' => 'BDT',
            'status' => 'active',
        ]);

        TenantDomain::setPrimaryForTenant($this->tenant, 'demo.localhost');

        $currentTenant = app(\App\Tenancy\CurrentTenant::class);

        $this->branch = $currentTenant->run($this->tenant, function () {
            return Branch::create([
                'tenant_id' => $this->tenant->id,
                'name' => 'Main Branch',
                'code' => 'MB-01',
                'is_head_office' => true,
                'is_active' => true,
            ]);
        });

        // Subscription
        $this->admin->subscriptions()->create([
            'tenant_id' => $this->tenant->id,
            'plan_id' => $plan->id,
            'status' => 'active',
            'billing_cycle' => 'monthly',
            'starts_at' => now(),
            'current_period_starts_at' => now(),
            'current_period_ends_at' => now()->addMonth(),
        ]);

        // 2. Manager
        $this->manager = User::create([
            'name' => 'Manager Tariq',
            'email' => 'manager@testpharma.test',
            'password' => Hash::make('password'),
            'account_type' => 'staff',
            'subscriber_id' => $this->admin->id,
            'status' => 'active',
        ]);

        // 3. Pharmacist
        $this->pharmacist = User::create([
            'name' => 'Pharm Nusrat',
            'email' => 'pharmacist@testpharma.test',
            'password' => Hash::make('password'),
            'account_type' => 'staff',
            'subscriber_id' => $this->admin->id,
            'status' => 'active',
        ]);

        // 4. Cashier
        $this->cashier = User::create([
            'name' => 'Cashier Rafiq',
            'email' => 'cashier@testpharma.test',
            'password' => Hash::make('password'),
            'account_type' => 'staff',
            'subscriber_id' => $this->admin->id,
            'status' => 'active',
        ]);

        // 5. Clerk
        $this->clerk = User::create([
            'name' => 'Clerk Kabir',
            'email' => 'clerk@testpharma.test',
            'password' => Hash::make('password'),
            'account_type' => 'staff',
            'subscriber_id' => $this->admin->id,
            'status' => 'active',
        ]);

        $this->tenant->users()->sync([
            $this->admin->id => [
                'branch_id' => $this->branch->id,
                'is_owner' => true,
                'role' => TenantRole::ADMIN->value,
                'roles' => json_encode([TenantRole::ADMIN->value]),
                'is_active' => true,
            ],
            $this->manager->id => [
                'branch_id' => $this->branch->id,
                'is_owner' => false,
                'role' => TenantRole::MANAGER->value,
                'roles' => json_encode([TenantRole::MANAGER->value]),
                'is_active' => true,
            ],
            $this->pharmacist->id => [
                'branch_id' => $this->branch->id,
                'is_owner' => false,
                'role' => TenantRole::PHARMACIST->value,
                'roles' => json_encode([TenantRole::PHARMACIST->value]),
                'is_active' => true,
            ],
            $this->cashier->id => [
                'branch_id' => $this->branch->id,
                'is_owner' => false,
                'role' => TenantRole::CASHIER->value,
                'roles' => json_encode([TenantRole::CASHIER->value]),
                'is_active' => true,
            ],
            $this->clerk->id => [
                'branch_id' => $this->branch->id,
                'is_owner' => false,
                'role' => TenantRole::INVENTORY_CLERK->value,
                'roles' => json_encode([TenantRole::INVENTORY_CLERK->value]),
                'is_active' => true,
            ],
        ]);
    }

    public function test_admin_sees_executive_dashboard_with_valuation_and_usage_quotas(): void
    {
        $response = $this->actingAs($this->admin)
            ->withSession([
                'active_tenant_id' => $this->tenant->id,
                'active_branch_id' => $this->branch->id,
            ])
            ->get('/dashboard');

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('roleContext.role', 'admin')
                ->where('roleContext.isOwnerOrAdmin', true)
                ->has('stats.inventoryValuation')
                ->has('usage')
            );
    }

    public function test_cashier_sees_tailored_pos_cashier_dashboard_without_confidential_valuation_or_quotas(): void
    {
        app(\App\Tenancy\CurrentTenant::class)->run($this->tenant, function () {
            Sale::create([
                'tenant_id' => $this->tenant->id,
                'branch_id' => $this->branch->id,
                'user_id' => $this->cashier->id,
                'invoice_number' => 'INV-TEST-001',
                'subtotal' => 250,
                'total_amount' => 250,
                'paid_amount' => 250,
                'payment_method' => 'cash',
                'payment_status' => 'paid',
                'sold_at' => now(),
            ]);
        });

        $response = $this->actingAs($this->cashier)
            ->withSession([
                'active_tenant_id' => $this->tenant->id,
                'active_branch_id' => $this->branch->id,
            ])
            ->get('/dashboard');

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('roleContext.role', 'cashier')
                ->where('roleContext.isCashier', true)
                ->where('stats.inventoryValuation', null)
                ->where('usage', null)
                ->where('expiringBatches', [])
                ->where('stats.myTodaySalesTotal', 250)
                ->where('stats.myTodaySalesCount', 1)
            );
    }

    public function test_pharmacist_sees_fefo_expiry_and_low_stock_without_wholesale_valuation(): void
    {
        $response = $this->actingAs($this->pharmacist)
            ->withSession([
                'active_tenant_id' => $this->tenant->id,
                'active_branch_id' => $this->branch->id,
            ])
            ->get('/dashboard');

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('roleContext.role', 'pharmacist')
                ->where('roleContext.isPharmacist', true)
                ->where('stats.inventoryValuation', null)
                ->where('usage', null)
                ->has('stats.expiringSoonCount')
                ->has('stats.lowStockCount')
            );
    }

    public function test_inventory_clerk_sees_warehouse_skus_and_batches_without_sales_financials(): void
    {
        $response = $this->actingAs($this->clerk)
            ->withSession([
                'active_tenant_id' => $this->tenant->id,
                'active_branch_id' => $this->branch->id,
            ])
            ->get('/dashboard');

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('roleContext.role', 'inventory_clerk')
                ->where('roleContext.isClerk', true)
                ->where('stats.inventoryValuation', null)
                ->where('stats.todaySalesTotal', null)
                ->where('usage', null)
                ->has('stats.totalMedicines')
                ->has('stats.totalStockUnits')
            );
    }

    public function test_demo_enter_supports_all_roles_and_routes_to_dashboard(): void
    {
        $roles = [
            'admin' => 'admin@testpharma.test',
            'manager' => 'manager@testpharma.test',
            'pharmacist' => 'pharmacist@testpharma.test',
            'cashier' => 'cashier@testpharma.test',
            'inventory_clerk' => 'clerk@testpharma.test',
        ];

        foreach ($roles as $roleKey => $email) {
            $response = $this->get("/demo/enter?role={$roleKey}&email={$email}");
            $response->assertRedirect('/dashboard');
            $this->assertAuthenticated();
        }
    }
}
