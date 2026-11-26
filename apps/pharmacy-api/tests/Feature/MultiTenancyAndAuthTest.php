<?php

namespace Tests\Feature;

use App\Actions\Tenancy\ProvisionTenantAccess;
use App\Enums\TenantRole;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Module;
use App\Models\SaasPlan;
use App\Models\Scopes\TenantScope;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\User;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\DemoPharmacySeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MultiTenancyAndAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    public function test_subscriber_admin_registers_with_business_name_picks_plan_on_separate_page_and_manages_tenants_within_quota(): void
    {
        // Business name is required during registration (no plan dropdown)
        $this->post('/register', [
            'name' => 'Dr. Nadia Karim',
            'email' => 'missing-biz@medicare.test',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
        ])->assertSessionHasErrors('business_name');

        $response = $this->post('/register', [
            'business_name' => 'MediCare Wellness Ltd.',
            'name' => 'Dr. Nadia Karim',
            'email' => 'nadia@medicare.test',
            'phone' => '+8801711223344',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
        ]);

        $response->assertRedirect('/plans');
        $this->assertAuthenticated();

        $admin = User::where('email', 'nadia@medicare.test')->firstOrFail();
        $this->assertSame('admin', $admin->account_type);
        $this->assertFalse($admin->hasUsableSubscription());

        $primaryTenant = Tenant::where('owner_id', $admin->id)->firstOrFail();
        $this->assertSame('MediCare Wellness Ltd.', $primaryTenant->name);
        $this->assertDatabaseHas('tenant_domains', [
            'tenant_id' => $primaryTenant->id,
            'is_primary' => true,
        ]);
        $this->assertDatabaseHas('branches', [
            'tenant_id' => $primaryTenant->id,
            'code' => 'HO',
            'is_head_office' => true,
        ]);

        // Without active subscription, protected workspace routes redirect to the separate /plans page
        $this->actingAs($admin)->get('/tenants')->assertRedirect('/plans');
        $this->actingAs($admin)->get('/dashboard')->assertRedirect('/plans');

        // Dedicated Plans page renders Business Name and public SaaS plans
        $this->actingAs($admin)
            ->get('/plans')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Plans/Index')
                ->where('businessName', 'MediCare Wellness Ltd.')
                ->has('plans', 3)
            );

        // Purchase Starter plan (max_pharmacies = 1)
        $this->actingAs($admin)->post('/subscription', [
            'plan_key' => 'starter',
            'billing_cycle' => 'monthly',
            'payment_method' => 'card',
        ])->assertRedirect('/dashboard');

        $this->assertDatabaseHas('tenant_subscriptions', [
            'user_id' => $admin->id,
            'tenant_id' => $primaryTenant->id,
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('subscription_ledgers', [
            'tenant_id' => $primaryTenant->id,
            'event' => 'subscription.created',
        ]);
        $this->assertDatabaseHas('tenant_modules', [
            'tenant_id' => $primaryTenant->id,
            'is_enabled' => true,
        ]);

        $this->assertSame(1, Tenant::where('owner_id', $admin->id)->count());

        // Attempting 2nd business tenant on Starter plan (limit = 1) fails quota check
        $this->actingAs($admin)->post('/tenants', [
            'name' => 'Second Blocked Shop',
            'branch_name' => 'Head Office',
            'branch_code' => 'HO',
            'currency_code' => 'BDT',
        ])->assertSessionHas('error');

        $this->assertSame(1, Tenant::where('owner_id', $admin->id)->count());

        // Upgrade subscription to Growth Chain (max_pharmacies = 3)
        $this->actingAs($admin)->post('/subscription', [
            'plan_key' => 'growth',
            'billing_cycle' => 'annual',
            'payment_method' => 'card',
        ])->assertRedirect('/dashboard');

        // Now 2nd business tenant succeeds under the same subscriber admin account
        $this->actingAs($admin)->post('/tenants', [
            'name' => 'MediCare Uttara Hub',
            'branch_name' => 'Uttara Main',
            'branch_code' => 'MCR-UT1',
            'city' => 'Dhaka',
            'currency_code' => 'BDT',
        ])->assertRedirect('/tenants');

        $this->assertSame(2, Tenant::where('owner_id', $admin->id)->count());
    }

    public function test_inventory_and_branches_are_strictly_isolated_between_subscribers(): void
    {
        $provisioning = app(TenantProvisioningService::class);

        $ownerA = User::factory()->create(['account_type' => 'admin']);
        $tenantA = $provisioning->createTenantForUser($ownerA, [
            'name' => 'Alpha Care Pharmacy',
            'plan_key' => 'growth',
        ]);

        $ownerB = User::factory()->create(['account_type' => 'admin']);
        $tenantB = $provisioning->createTenantForUser($ownerB, [
            'name' => 'Beta Health Store',
            'plan_key' => 'growth',
        ]);

        $currentTenant = app(CurrentTenant::class);

        $currentTenant->run($tenantA, function () {
            Medicine::query()->create([
                'name' => 'AlphaParacetamol',
                'sku' => 'ALPHA-1',
                'dosage_form' => 'Tablet',
                'unit' => 'Pcs',
            ]);
        });

        $branchB = $currentTenant->run($tenantB, function () {
            Medicine::query()->create([
                'name' => 'BetaAmoxicillin',
                'sku' => 'BETA-1',
                'dosage_form' => 'Capsule',
                'unit' => 'Pcs',
            ]);

            return Branch::query()->create([
                'name' => 'Beta Secondary',
                'code' => 'BETA-02',
                'is_head_office' => false,
                'is_active' => true,
            ]);
        });

        // Owner A sees only AlphaParacetamol
        $this->actingAs($ownerA)
            ->get('/inventory')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Inventory/Index')
                ->has('medicines', 1)
                ->where('medicines.0.name', 'AlphaParacetamol')
            );

        // Owner A cannot toggle Owner B's branch
        $this->actingAs($ownerA)
            ->patch("/branches/{$branchB->id}/toggle")
            ->assertNotFound();

        // Owner A cannot switch to Owner B's tenant
        $this->actingAs($ownerA)
            ->post('/tenant/switch', ['tenant_id' => $tenantB->id])
            ->assertForbidden();
    }

    public function test_user_can_switch_between_authorized_tenant_workspaces(): void
    {
        $provisioning = app(TenantProvisioningService::class);

        $user = User::factory()->create(['account_type' => 'admin']);
        $tenantOne = $provisioning->createTenantForUser($user, ['name' => 'First Meds', 'plan_key' => 'growth']);
        $tenantTwo = $provisioning->createTenantForUser($user, ['name' => 'Second Meds']);

        $this->assertSame($tenantTwo->id, $user->fresh()->current_tenant_id);

        $this->actingAs($user)
            ->post('/tenant/switch', ['tenant_id' => $tenantOne->id])
            ->assertRedirect('/dashboard');

        $this->assertSame($tenantOne->id, $user->fresh()->current_tenant_id);
    }

    public function test_employee_multi_role_and_custom_role_permissions(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $admin = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($admin, ['name' => 'MultiRole Pharmacy', 'plan_key' => 'growth']);

        // Admin creates a custom CRM role scoped to tenant
        $this->actingAs($admin)->post('/team/roles', [
            'name' => 'CRM Lead',
            'description' => 'Handles customer and supplier directory',
            'permissions' => ['crm.view', 'crm.manage'],
        ])->assertRedirect();

        // Admin onboards an employee with multiple roles: cashier + crm_lead
        $this->actingAs($admin)->post('/team', [
            'name' => 'Sadia Rahman',
            'email' => 'sadia@multirole.test',
            'tenant_id' => $tenant->id,
            'roles' => ['cashier', 'crm_lead'],
        ])->assertRedirect();

        $staff = User::where('email', 'sadia@multirole.test')->firstOrFail();

        // Staff has combined roles -> can operate POS and manage CRM customers
        $this->actingAs($staff)->post('/crm/customers', [
            'name' => 'Patient Karim',
            'phone' => '+8801711111111',
            'allergies' => 'Aspirin',
        ])->assertRedirect();

        $this->assertDatabaseHas('customers', [
            'tenant_id' => $tenant->id,
            'name' => 'Patient Karim',
        ]);

        // Pure cashier cannot manage branches, team, or CRM write
        $pureCashier = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $admin->id,
            'current_tenant_id' => $tenant->id,
        ]);
        $tenant->users()->attach($pureCashier->id, [
            'role' => TenantRole::CASHIER->value,
            'roles' => json_encode([TenantRole::CASHIER->value]),
            'is_active' => true,
            'joined_at' => now(),
        ]);

        $this->actingAs($pureCashier)
            ->post('/branches', ['name' => 'Unauthorized', 'code' => 'NO-01'])
            ->assertForbidden();

        $this->actingAs($pureCashier)
            ->post('/team', ['name' => 'Unauthorized', 'email' => 'x@y.com', 'roles' => ['cashier']])
            ->assertForbidden();

        $this->actingAs($pureCashier)
            ->post('/crm/customers', ['name' => 'Blocked Customer'])
            ->assertForbidden();

        // Admin updates staff assignment roles cleanly
        $membershipId = DB::table('tenant_user')
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $staff->id)
            ->value('id');

        $this->actingAs($admin)->put("/team/memberships/{$membershipId}", [
            'branch_id' => null,
            'roles' => ['pharmacist', 'cashier'],
            'is_active' => true,
        ])->assertRedirect();

        $this->assertEqualsCanonicalizing(['pharmacist', 'cashier'], $staff->fresh()->rolesForTenant($tenant));
    }

    public function test_crm_pos_fefo_checkout_and_pages_work_end_to_end(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $admin = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($admin, [
            'name' => 'Full Flow Pharmacy',
            'plan_key' => 'growth',
        ]);

        // Add supplier & customer CRM records
        $this->actingAs($admin)->post('/crm/suppliers', [
            'name' => 'Beximco Logistics',
            'contact_person' => 'Rashed',
            'payment_terms' => 'Net-15',
        ])->assertRedirect();

        $this->actingAs($admin)->post('/crm/customers', [
            'name' => 'Rafiqul Patient',
            'phone' => '+8801999999999',
            'allergies' => 'None',
        ])->assertRedirect();

        $customer = Customer::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        // Add medicine + initial batch (auto-generates valid EAN-13 if barcode is omitted)
        $this->actingAs($admin)->post('/inventory', [
            'name' => 'Losectil 20mg',
            'generic_name' => 'Omeprazole',
            'sku' => 'LOSEC-20',
            'dosage_form' => 'Capsule',
            'unit' => 'Pcs',
            'reorder_level' => 15,
            'requires_prescription' => false,
            'purchase_price' => 4.00,
            'selling_price' => 6.00,
        ])->assertRedirect();

        $autoBarcodedMed = Medicine::withoutGlobalScope(TenantScope::class)
            ->where('sku', 'LOSEC-20')
            ->firstOrFail();
        $this->assertMatchesRegularExpression('/^20\d{11}$/', (string) $autoBarcodedMed->barcode);

        // Add medicine with explicit barcode + initial batch
        $this->actingAs($admin)->post('/inventory', [
            'name' => 'A Napa Extra',
            'generic_name' => 'Paracetamol + Caffeine',
            'sku' => 'NAPA-EX-01',
            'barcode' => '8941100999991',
            'dosage_form' => 'Tablet',
            'unit' => 'Pcs',
            'reorder_level' => 25,
            'requires_prescription' => false,
            'purchase_price' => 2.00,
            'selling_price' => 10.00,
            'batch_number' => 'NX-01',
            'quantity' => 50,
            'expiry_date' => now()->addMonths(6)->toDateString(),
        ])->assertRedirect();

        $medicine = Medicine::withoutGlobalScope(TenantScope::class)
            ->where('sku', 'NAPA-EX-01')
            ->firstOrFail();

        // Process real POS checkout & verify FEFO batch deduction + loyalty points
        $this->actingAs($admin)->post('/pos/checkout', [
            'customer_id' => $customer->id,
            'payment_method' => 'cash',
            'discount' => 0,
            'items' => [
                ['medicine_id' => $medicine->id, 'quantity' => 12],
            ],
        ])->assertRedirect();

        $batch = MedicineBatch::withoutGlobalScope(TenantScope::class)
            ->where('medicine_id', $medicine->id)
            ->firstOrFail();
        $this->assertSame(38, $batch->quantity_available);
        $this->assertDatabaseHas('sales', [
            'tenant_id' => $tenant->id,
            'customer_id' => $customer->id,
            'total_amount' => 120.00,
        ]);
        $this->assertSame(1, $customer->fresh()->loyalty_points);

        // Create secondary branch + check all authenticated workspace pages render OK
        $this->actingAs($admin)->post('/branches', [
            'tenant_id' => $tenant->id,
            'name' => 'Mirpur Outlet',
            'code' => 'DHK-09',
            'city' => 'Dhaka',
        ])->assertRedirect();

        $this->actingAs($admin)->get('/plans')->assertOk();
        $this->actingAs($admin)->get('/subscription')->assertOk();
        $this->actingAs($admin)->get('/tenants')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Tenants/Index')
                ->where('tenants.0.users_count', fn (int $count) => $count >= 1)
            );
        $this->actingAs($admin)->get('/dashboard')->assertOk();
        $this->actingAs($admin)->get('/pos')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Pos/Index')
                ->where('medicines.0.sku', 'NAPA-EX-01')
                ->where('medicines.0.barcode', '8941100999991')
            );
        $this->actingAs($admin)->get('/inventory')->assertOk();
        $this->actingAs($admin)->get('/branches')->assertOk();
        $this->actingAs($admin)->get('/team')->assertOk();
        $this->actingAs($admin)->get('/crm/customers')->assertOk();
        $this->actingAs($admin)->get('/crm/suppliers')->assertOk();
        $this->actingAs($admin)->get('/settings/business')->assertOk();
        $this->actingAs($admin)->get('/settings/profile')->assertOk();
    }

    public function test_dual_box_and_piece_pricing_with_pack_unit_pos_checkout(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $admin = User::factory()->create([
            'account_type' => 'admin',
            'email_verified_at' => now(),
        ]);
        $tenant = $provisioning->createTenantForUser($admin, [
            'name' => 'Box Pricing Pharmacy',
            'plan_key' => 'growth',
        ]);

        // Create boxed medicine supplying box prices + per-piece selling price (purchase_price derived automatically)
        $this->actingAs($admin)->post('/inventory', [
            'name' => 'Ace Plus Box',
            'generic_name' => 'Paracetamol + Caffeine',
            'sku' => 'BOX-ACE-001',
            'dosage_form' => 'Tablet',
            'unit' => 'tablet',
            'units_per_strip' => 10,
            'units_per_box' => 100,
            'box_purchase_price' => 150.00,
            'selling_price' => 2.00,
            'box_selling_price' => 195.00,
            'reorder_level' => 20,
            'batch_number' => 'BOX-B01',
            'expiry_date' => now()->addYear()->toDateString(),
            'quantity' => 120,
        ])->assertSessionHasNoErrors()->assertRedirect();

        $medicine = Medicine::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenant->id)
            ->where('name', 'Ace Plus Box')
            ->firstOrFail();

        $this->assertSame(10, $medicine->units_per_strip);
        $this->assertSame(100, $medicine->units_per_box);
        $this->assertEquals(1.50, (float) $medicine->default_purchase_price);
        $this->assertEquals(2.00, (float) $medicine->default_selling_price);
        $this->assertEquals(150.00, (float) $medicine->box_purchase_price);
        $this->assertEquals(195.00, (float) $medicine->box_selling_price);

        // POS sells 1 full Box (100 pcs at discounted box price 195.00) + 1 Strip (10 pcs at 2.00 = 20.00)
        $this->actingAs($admin)->post('/pos/checkout', [
            'customer_name' => 'Walk-in Customer',
            'payment_method' => 'cash',
            'discount' => 0,
            'items' => [
                [
                    'medicine_id' => $medicine->id,
                    'quantity' => 1,
                    'sale_unit' => 'box',
                ],
                [
                    'medicine_id' => $medicine->id,
                    'quantity' => 1,
                    'sale_unit' => 'strip',
                ],
            ],
        ])->assertSessionHasNoErrors()->assertRedirect();

        $remainingBatchQty = MedicineBatch::withoutGlobalScope(TenantScope::class)
            ->where('medicine_id', $medicine->id)
            ->sum('quantity_available');
        $this->assertSame(10, (int) $remainingBatchQty);

        $this->assertDatabaseHas('sales', [
            'tenant_id' => $tenant->id,
            'total_amount' => 215.00,
        ]);

        $this->assertDatabaseHas('sale_items', [
            'medicine_id' => $medicine->id,
            'sale_unit' => 'box',
            'pack_size' => 100,
            'pack_quantity' => 1,
            'quantity' => 100,
            'line_total' => 195.00,
        ]);

        $this->assertDatabaseHas('sale_items', [
            'medicine_id' => $medicine->id,
            'sale_unit' => 'strip',
            'pack_size' => 10,
            'pack_quantity' => 1,
            'quantity' => 10,
            'line_total' => 20.00,
        ]);

        // Percentage discount (10% on 10.00 subtotal = 1.00 off -> 9.00 total)
        $this->actingAs($admin)->post('/pos/checkout', [
            'customer_name' => 'Percent Buyer',
            'payment_method' => 'cash',
            'discount' => 10,
            'discount_type' => 'percent',
            'items' => [
                [
                    'medicine_id' => $medicine->id,
                    'quantity' => 5,
                    'sale_unit' => 'piece',
                ],
            ],
        ])->assertSessionHasNoErrors()->assertRedirect();

        $this->assertDatabaseHas('sales', [
            'tenant_id' => $tenant->id,
            'subtotal' => 10.00,
            'discount_amount' => 1.00,
            'total_amount' => 9.00,
        ]);

        // Fixed Taka discount (2.50 off on 10.00 subtotal -> 7.50 total)
        $this->actingAs($admin)->post('/pos/checkout', [
            'customer_name' => 'Fixed Buyer',
            'payment_method' => 'cash',
            'discount' => 2.50,
            'discount_type' => 'fixed',
            'items' => [
                [
                    'medicine_id' => $medicine->id,
                    'quantity' => 5,
                    'sale_unit' => 'piece',
                ],
            ],
        ])->assertSessionHasNoErrors()->assertRedirect();

        $this->assertDatabaseHas('sales', [
            'tenant_id' => $tenant->id,
            'subtotal' => 10.00,
            'discount_amount' => 2.50,
            'total_amount' => 7.50,
        ]);
    }

    public function test_saas_super_admin_manages_plans_and_subscribers_while_store_admin_is_blocked(): void
    {
        $superAdmin = User::factory()->create([
            'is_super_admin' => true,
            'account_type' => 'super_admin',
        ]);

        $storeAdmin = User::factory()->create([
            'is_super_admin' => false,
            'account_type' => 'admin',
        ]);

        // Store admin cannot open Super Admin portal
        $this->actingAs($storeAdmin)->get('/admin')->assertForbidden();
        $this->actingAs($storeAdmin)->get('/admin/plans')->assertForbidden();

        // Super admin views dashboard, plans & subscribers
        $this->actingAs($superAdmin)->get('/admin')->assertOk();
        $this->actingAs($superAdmin)->get('/admin/plans')->assertOk();
        $this->actingAs($superAdmin)->get('/admin/subscribers')->assertOk();

        // Super admin creates a new SaaS plan with bilingual fields
        $this->actingAs($superAdmin)->post('/admin/plans', [
            'name' => 'Regional Chain Pro',
            'name_bn' => 'রিজিওনাল চেইন প্রো',
            'description' => '5 business tenants & 15 branches',
            'description_bn' => '৫টি ফার্মেসি ব্যবসা ও ১৫টি শাখা',
            'monthly_price' => 129,
            'annual_price' => 1290,
            'trial_days' => 14,
            'max_pharmacies' => 5,
            'max_branches' => 15,
            'max_users' => 60,
            'max_medicines' => 25000,
            'features_text' => "5 Business Tenants\n15 Retail Branches",
            'features_bn_text' => "৫টি ব্যবসা টেন্যান্ট\n১৫টি রিটেল শাখা",
            'is_popular' => true,
        ])->assertRedirect();

        $plan = SaasPlan::where('key', 'regional-chain-pro')->firstOrFail();
        $this->assertSame(5, $plan->max_pharmacies);
        $this->assertSame('রিজিওনাল চেইন প্রো', $plan->name_bn);
        $this->assertSame('৫টি ফার্মেসি ব্যবসা ও ১৫টি শাখা', $plan->description_bn);
        $this->assertEquals(['৫টি ব্যবসা টেন্যান্ট', '১৫টি রিটেল শাখা'], $plan->features_bn);
        $this->assertSame('রিজিওনাল চেইন প্রো', $plan->localizedName('bn'));
        $this->assertSame('Regional Chain Pro', $plan->localizedName('en'));

        // Super admin assigns subscription to a subscriber admin
        $this->actingAs($superAdmin)->patch("/admin/subscribers/{$storeAdmin->id}", [
            'plan_key' => 'regional-chain-pro',
            'status' => 'active',
            'billing_cycle' => 'annual',
        ])->assertRedirect();

        $this->assertTrue($storeAdmin->fresh()->hasUsableSubscription());
    }

    public function test_super_admin_adds_features_assigns_to_plans_and_enforces_feature_wise_access(): void
    {
        $superAdmin = User::factory()->create([
            'is_super_admin' => true,
            'account_type' => 'super_admin',
            'email_verified_at' => now(),
        ]);

        // Register Starter and Growth pharmacy owners (with business names)
        $this->post('/register', [
            'name' => 'Starter Owner',
            'email' => 'starter@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'business_name' => 'Starter Pharma Care',
        ])->assertRedirect();

        $starterOwner = User::where('email', 'starter@example.com')->firstOrFail();
        $starterOwner->forceFill(['email_verified_at' => now()])->save();

        auth()->logout();

        $this->post('/register', [
            'name' => 'Growth Owner',
            'email' => 'growth@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'business_name' => 'Growth Health Group',
        ])->assertRedirect();

        $growthOwner = User::where('email', 'growth@example.com')->firstOrFail();
        $growthOwner->forceFill(['email_verified_at' => now()])->save();

        auth()->logout();

        // Assign Starter and Growth subscriptions via Super Admin
        $this->actingAs($superAdmin)->patch("/admin/subscribers/{$starterOwner->id}", [
            'plan_key' => 'starter',
            'status' => 'active',
            'billing_cycle' => 'monthly',
        ])->assertRedirect();

        $this->actingAs($superAdmin)->patch("/admin/subscribers/{$growthOwner->id}", [
            'plan_key' => 'growth',
            'status' => 'active',
            'billing_cycle' => 'monthly',
        ])->assertRedirect();

        $starterTenant = $starterOwner->fresh()->currentTenant;
        $growthTenant = $growthOwner->fresh()->currentTenant;
        $this->assertNotNull($starterTenant);
        $this->assertNotNull($growthTenant);

        // Starter plan unlocks pos, inventory, branches, crm — NOT team_rbac
        $this->assertTrue($starterTenant->hasFeature('pos'));
        $this->assertTrue($starterTenant->hasFeature('inventory'));
        $this->assertTrue($starterTenant->hasFeature('branches'));
        $this->assertTrue($starterTenant->hasFeature('crm'));
        $this->assertFalse($starterTenant->hasFeature('team_rbac'));

        $this->actingAs($starterOwner)->get('/pos')->assertOk();
        $this->actingAs($starterOwner)->get('/crm/customers')->assertOk();
        $this->actingAs($starterOwner)->get('/team')->assertForbidden();

        // Starter sees feature matrix page showing team_rbac locked
        $this->actingAs($starterOwner)->get('/features')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Features/Index')
                ->has('tenantFeatures')
            );

        // Growth plan unlocks team_rbac
        $this->assertTrue($growthTenant->hasFeature('team_rbac'));
        $this->actingAs($growthOwner)->get('/team')->assertOk();

        // Super Admin opens /admin/features and adds a new non-core feature assigned ONLY to Growth
        $this->actingAs($superAdmin)->get('/admin/features')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Features')
                ->has('features')
                ->has('plans')
                ->where('features.0.enabled_tenants_count', fn (int $count) => $count >= 1)
            );

        $growthPlan = SaasPlan::where('key', 'growth')->firstOrFail();

        $this->actingAs($superAdmin)->post('/admin/features', [
            'key' => 'expiry_analytics_pro',
            'name' => 'Expiry Analytics Pro',
            'description' => 'Advanced batch wastage & FEFO forecasting.',
            'category' => 'analytics',
            'is_core' => false,
            'is_active' => true,
            'plan_ids' => [$growthPlan->id],
        ])->assertRedirect();

        $expiryModule = Module::where('key', 'expiry_analytics_pro')->firstOrFail();

        // Live-synced immediately to existing active Growth vs Starter subscribers
        $this->assertTrue($growthTenant->fresh()->hasFeature('expiry_analytics_pro'));
        $this->assertFalse($starterTenant->fresh()->hasFeature('expiry_analytics_pro'));

        // Non-super-admin cannot manage features
        $this->actingAs($starterOwner)->get('/admin/features')->assertForbidden();

        // Super Admin creates a custom plan attaching team_rbac + expiry_analytics_pro modules and moves Starter owner onto it
        $teamModule = Module::where('key', 'team_rbac')->firstOrFail();
        $posModule = Module::where('key', 'pos')->firstOrFail();

        $this->actingAs($superAdmin)->post('/admin/plans', [
            'name' => 'Custom Team Plus',
            'description' => 'Includes RBAC & Expiry Analytics',
            'monthly_price' => 79,
            'annual_price' => 790,
            'trial_days' => 14,
            'max_pharmacies' => 2,
            'max_branches' => 5,
            'max_users' => 20,
            'max_medicines' => 10000,
            'features_text' => "POS\nRBAC Team\nExpiry Analytics Pro",
            'is_popular' => false,
            'module_ids' => [$posModule->id, $teamModule->id, $expiryModule->id],
        ])->assertRedirect();

        $customPlan = SaasPlan::where('key', 'custom-team-plus')->firstOrFail();
        $this->assertTrue($customPlan->modules()->where('modules.id', $teamModule->id)->exists());
        $this->assertTrue($customPlan->modules()->where('modules.id', $expiryModule->id)->exists());

        // Upgrade Starter owner to Growth (or custom-team-plus) and verify /team unlocks immediately
        $this->actingAs($superAdmin)->patch("/admin/subscribers/{$starterOwner->id}", [
            'plan_key' => 'growth',
            'status' => 'active',
            'billing_cycle' => 'monthly',
        ])->assertRedirect();

        $this->assertTrue($starterTenant->fresh()->hasFeature('team_rbac'));
        $this->actingAs($starterOwner)->get('/team')->assertOk();

        // Updating custom plan module_ids syncs live to its subscribers
        $this->actingAs($superAdmin)->patch("/admin/subscribers/{$starterOwner->id}", [
            'plan_key' => 'custom-team-plus',
            'status' => 'active',
            'billing_cycle' => 'monthly',
        ])->assertRedirect();

        $this->assertTrue($starterTenant->fresh()->hasFeature('expiry_analytics_pro'));

        $this->actingAs($superAdmin)->put("/admin/plans/{$customPlan->id}", [
            'name' => 'Custom Team Plus',
            'description' => 'Updated features',
            'monthly_price' => 79,
            'annual_price' => 790,
            'trial_days' => 14,
            'max_pharmacies' => 2,
            'max_branches' => 5,
            'max_users' => 20,
            'max_medicines' => 10000,
            'features_text' => "POS\nRBAC Team",
            'is_popular' => false,
            'module_ids' => [$posModule->id, $teamModule->id],
        ])->assertRedirect();

        $this->assertFalse($starterTenant->fresh()->hasFeature('expiry_analytics_pro'));
        $this->assertTrue($starterTenant->fresh()->hasFeature('team_rbac'));

        // Global feature toggle disables team_rbac across active tenants (403 on /team), then re-enables (200 OK)
        $this->actingAs($superAdmin)->patch("/admin/features/{$teamModule->id}/toggle")->assertRedirect();
        $this->assertFalse($teamModule->fresh()->is_active);
        $this->assertFalse($growthTenant->fresh()->hasFeature('team_rbac'));
        $this->actingAs($growthOwner)->get('/team')->assertForbidden();

        $this->actingAs($superAdmin)->patch("/admin/features/{$teamModule->id}/toggle")->assertRedirect();
        $this->assertTrue($teamModule->fresh()->is_active);
        $this->assertTrue($growthTenant->fresh()->hasFeature('team_rbac'));
        $this->actingAs($growthOwner)->get('/team')->assertOk();
    }

    public function test_tenant_subdomains_and_custom_domains_resolve_and_isolate_workspaces(): void
    {
        $provisioning = app(TenantProvisioningService::class);

        $owner = User::factory()->create(['account_type' => 'admin']);
        $alphaTenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Alpha Pharma',
            'plan_key' => 'growth',
        ]);
        $betaTenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Beta Pharma',
            'domain' => 'demo',
        ]);

        // Provisioning defaults to config('tenancy.base_domain') ("localhost") and expands single-label "demo"
        $this->assertSame('alpha-pharma.localhost', $alphaTenant->primaryDomainName());
        $this->assertSame('demo.localhost', $betaTenant->primaryDomainName());
        $this->assertSame('subdomain', TenantDomain::where('tenant_id', $betaTenant->id)->value('type'));

        // Seed distinct medicine per tenant
        $currentTenant = app(CurrentTenant::class);
        $currentTenant->run($alphaTenant, function () {
            Medicine::query()->create([
                'name' => 'AlphaOnlyMed',
                'sku' => 'DOM-A1',
                'dosage_form' => 'Tablet',
                'unit' => 'Pcs',
            ]);
        });
        $currentTenant->run($betaTenant, function () {
            Medicine::query()->create([
                'name' => 'BetaOnlyMed',
                'sku' => 'DOM-B1',
                'dosage_form' => 'Capsule',
                'unit' => 'Pcs',
            ]);
        });

        // Visiting root "/" on tenant subdomain sends guests to /login and workspace users to /dashboard
        $this->get('http://demo.localhost/')->assertRedirect('/login');
        $this->get('http://demo.localhost/login')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Auth/Login')
                ->where('domainTenant.name', 'Beta Pharma')
                ->where('domainTenant.domain', 'demo.localhost')
            );

        // Owner's current_tenant_id is betaTenant, yet hitting alpha-pharma.localhost forces alphaTenant
        $this->assertSame($betaTenant->id, $owner->fresh()->current_tenant_id);

        $this->actingAs($owner)
            ->get('http://demo.localhost/')
            ->assertRedirect('/dashboard');

        $this->actingAs($owner)
            ->get('http://alpha-pharma.localhost/inventory')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Inventory/Index')
                ->where('tenancy.isTenantDomain', true)
                ->where('domainTenant.slug', 'alpha-pharma')
                ->where('tenant.currentTenant.id', $alphaTenant->id)
                ->has('medicines', 1)
                ->where('medicines.0.name', 'AlphaOnlyMed')
            );

        // Hitting demo.localhost forces betaTenant even if active_tenant_id session is alphaTenant
        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $alphaTenant->id])
            ->get('http://demo.localhost/inventory')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Inventory/Index')
                ->where('tenant.currentTenant.id', $betaTenant->id)
                ->has('medicines', 1)
                ->where('medicines.0.name', 'BetaOnlyMed')
            );

        // Cross-tenant isolation: another subscriber cannot access demo.localhost or log into it
        $outsider = User::factory()->create([
            'account_type' => 'admin',
            'password' => bcrypt('SecretPass123!'),
        ]);
        $outsiderTenant = $provisioning->createTenantForUser($outsider, [
            'name' => 'Outsider Care',
            'plan_key' => 'growth',
        ]);

        $this->actingAs($outsider)->get('http://demo.localhost/dashboard')->assertForbidden();
        auth()->logout();
        $this->post('http://demo.localhost/login', [
            'email' => $outsider->email,
            'password' => 'SecretPass123!',
        ])->assertSessionHasErrors('email');

        // Unknown subdomain returns 404; /admin on tenant subdomain returns 404; super_admin blocked on tenant dashboard
        $this->get('http://unknown-shop.localhost/')->assertNotFound();

        $superAdmin = User::factory()->create(['account_type' => 'super_admin', 'is_super_admin' => true]);
        $this->actingAs($superAdmin)->get('http://demo.localhost/admin')->assertNotFound();
        $this->actingAs($superAdmin)->get('http://demo.localhost/dashboard')->assertForbidden();

        // Central domain reservation & cross-tenant uniqueness validation
        $this->actingAs($owner)->put("/tenants/{$alphaTenant->id}", [
            'name' => 'Alpha Pharma',
            'domain' => 'localhost',
            'currency_code' => 'BDT',
            'status' => 'active',
        ])->assertSessionHasErrors('domain');

        $this->actingAs($owner)->put("/tenants/{$alphaTenant->id}", [
            'name' => 'Alpha Pharma',
            'domain' => $outsiderTenant->primaryDomainName(),
            'currency_code' => 'BDT',
            'status' => 'active',
        ])->assertSessionHasErrors('domain');

        // Updating to a custom domain switches primary domain and resolves live on http://rx.alphapharma.com
        $this->actingAs($owner)->put("/tenants/{$alphaTenant->id}", [
            'name' => 'Alpha Pharma',
            'domain' => 'rx.alphapharma.com',
            'currency_code' => 'BDT',
            'status' => 'active',
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('tenant_domains', [
            'tenant_id' => $alphaTenant->id,
            'domain' => 'rx.alphapharma.com',
            'type' => 'custom',
            'is_primary' => true,
        ]);

        $this->get('http://alpha-pharma.localhost/')->assertNotFound();
        $this->actingAs($owner)
            ->get('http://rx.alphapharma.com/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tenant.currentTenant.id', $alphaTenant->id)
                ->where('domainTenant.domain', 'rx.alphapharma.com')
            );
    }

    public function test_admin_portal_subdomain_and_registration_domain_assignment(): void
    {
        $superAdmin = User::factory()->create([
            'account_type' => 'super_admin',
            'is_super_admin' => true,
            'password' => bcrypt('AdminPass123!'),
        ]);

        // Central hosts (127.0.0.1 & localhost) must NOT expose /login (404); guests on /dashboard go to "/"
        $this->get('http://127.0.0.1/login')->assertNotFound();
        $this->post('http://127.0.0.1/login', ['email' => $superAdmin->email, 'password' => 'AdminPass123!'])->assertNotFound();
        $this->get('http://localhost/login')->assertNotFound();
        $this->post('http://localhost/login', ['email' => $superAdmin->email, 'password' => 'AdminPass123!'])->assertNotFound();
        $this->get('http://127.0.0.1/dashboard')->assertRedirect('/');

        // Admin portal root & login render cleanly on admin.localhost and admin.127.0.0.1.nip.io
        $this->get('http://admin.localhost/')->assertRedirect('/login');
        $this->get('http://admin.localhost/register')->assertNotFound();

        $this->get('http://admin.localhost/login')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Auth/Login')
                ->where('tenancy.isAdminDomain', true)
            );

        $this->get('http://admin.127.0.0.1.nip.io/login')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Auth/Login')
                ->where('tenancy.isAdminDomain', true)
            );

        // Super Admin authenticates on admin domain and accesses /admin
        $this->post('http://admin.localhost/login', [
            'email' => $superAdmin->email,
            'password' => 'AdminPass123!',
        ])->assertRedirect('/admin');

        $this->actingAs($superAdmin)
            ->get('http://admin.localhost/admin')
            ->assertOk();

        // Logout super admin via HTTP and verify subscriber registration blocks reserved "admin" subdomain
        $this->post('http://admin.localhost/logout')->assertRedirect('/login');
        $this->actingAsGuest();

        $this->post('http://localhost/register', [
            'business_name' => 'Fake Admin',
            'domain' => 'admin',
            'name' => 'Test User',
            'email' => 'fake-admin@test.com',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
        ])->assertSessionHasErrors('domain');

        // Subscriber registering with custom subdomain "demo" (even with longer business name) gets demo.localhost
        $this->post('http://localhost/register', [
            'business_name' => 'Demo Pharmacy Group',
            'domain' => 'demo',
            'name' => 'Demo Owner',
            'email' => 'owner@demogroup.test',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
        ])->assertRedirect('/plans');

        $demoOwner = User::where('email', 'owner@demogroup.test')->firstOrFail();
        $demoTenant = Tenant::where('owner_id', $demoOwner->id)->firstOrFail();
        $this->assertSame('demo', $demoTenant->slug);
        $this->assertSame('demo.localhost', $demoTenant->primaryDomainName());

        // Same-origin workspace lookup resolves bare subdomains ("demo", "admin") and rejects missing ones
        $this->getJson('http://127.0.0.1:8001/workspace/lookup?subdomain=demo')
            ->assertOk()
            ->assertJson([
                'domain' => 'demo.localhost',
                'url' => 'http://demo.localhost:8001/login',
            ]);

        $this->getJson('http://127.0.0.1:8001/workspace/lookup?subdomain=admin')
            ->assertOk()
            ->assertJson([
                'domain' => 'admin.localhost',
                'url' => 'http://admin.localhost:8001/login',
            ]);

        $this->getJson('http://127.0.0.1:8001/workspace/lookup?subdomain=missing-shop')
            ->assertStatus(422)
            ->assertJsonStructure(['message']);

        // Duplicate subdomain during registration fails cleanly
        $this->post('http://localhost/logout');
        $this->actingAsGuest();
        $this->post('http://localhost/register', [
            'business_name' => 'Another Demo',
            'domain' => 'demo',
            'name' => 'Other Owner',
            'email' => 'other@demogroup.test',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
        ])->assertSessionHasErrors('domain');

        // Subscriber cannot sign into or access admin portal domain
        $this->post('http://admin.localhost/login', [
            'email' => $demoOwner->email,
            'password' => 'StrongPass123!',
        ])->assertSessionHasErrors('email');

        $this->actingAs($demoOwner)
            ->get('http://admin.localhost/dashboard')
            ->assertForbidden();

        // Invalid numeric TLD like demo.127.0.0.1 is rejected; valid 127.0.0.1.nip.io resolves cleanly
        $this->post('http://localhost/logout');
        $this->actingAsGuest();
        $this->post('http://localhost/register', [
            'business_name' => 'Invalid IP Subdomain',
            'domain' => 'demo.127.0.0.1',
            'name' => 'Bad Domain Owner',
            'email' => 'bad@domain.test',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
        ])->assertSessionHasErrors('domain');

        config(['tenancy.base_domain' => '127.0.0.1.nip.io']);

        $this->post('http://localhost/register', [
            'business_name' => 'Apollo Care',
            'name' => 'Apollo Owner',
            'email' => 'owner@apollo.test',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
        ])->assertRedirect('/plans');

        $apolloOwner = User::where('email', 'owner@apollo.test')->firstOrFail();
        $apolloTenant = Tenant::where('owner_id', $apolloOwner->id)->firstOrFail();
        $this->assertSame('apollo-care.127.0.0.1.nip.io', $apolloTenant->primaryDomainName());

        $this->post('http://localhost/logout');
        $this->actingAsGuest();
        $this->get('http://apollo-care.127.0.0.1.nip.io/login')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Auth/Login')
                ->where('domainTenant.id', $apolloTenant->id)
                ->where('domainTenant.domain', 'apollo-care.127.0.0.1.nip.io')
            );
    }

    public function test_pharmacy_owner_retains_branch_entitlements_across_reseed_and_creates_multiple_branches(): void
    {
        $this->seed(DemoPharmacySeeder::class);
        // Re-running DemoPharmacySeeder must preserve branches, crm, and team_rbac entitlements
        $this->seed(DemoPharmacySeeder::class);

        $growthOwner = User::where('email', 'admin@pharmacore.test')->firstOrFail();
        $greenlife = Tenant::where('slug', 'greenlife-pharmacy')->firstOrFail();

        $this->assertTrue($greenlife->hasFeature('branches'));
        $this->assertTrue($greenlife->hasFeature('crm'));
        $this->assertTrue($greenlife->hasFeature('team_rbac'));

        // Calling ProvisionTenantAccess directly on an already-subscribed tenant preserves entitlements
        app(ProvisionTenantAccess::class)->execute($greenlife);
        $this->assertTrue($greenlife->fresh()->hasFeature('branches'));
        $this->assertTrue($greenlife->fresh()->hasFeature('team_rbac'));

        $this->actingAs($growthOwner)
            ->get('http://demo.localhost/branches')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Branches/Index')
                ->where('usage.branches', 3)
                ->where('usage.max_branches', 8)
            );

        // Pharmacy owner creates a new branch directly after login
        $this->actingAs($growthOwner)
            ->post('http://demo.localhost/branches', [
                'tenant_id' => $greenlife->id,
                'name' => 'Uttara Sector 7',
                'code' => 'DHK-07',
                'city' => 'Dhaka',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $this->assertDatabaseHas('branches', [
            'tenant_id' => $greenlife->id,
            'code' => 'DHK-07',
            'name' => 'Uttara Sector 7',
            'is_active' => true,
        ]);

        // Single-branch Starter owner (metro) can view their 1 branch cleanly without 403 and gets clear quota guard on extra branch
        $starterOwner = User::where('email', 'metro@pharmacore.test')->firstOrFail();
        $this->actingAs($starterOwner)
            ->get('http://metro-health-pharma.localhost/branches')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Branches/Index')
                ->has('branches', 1)
                ->where('usage.branches', 1)
                ->where('usage.max_branches', 1)
            );
    }
}
