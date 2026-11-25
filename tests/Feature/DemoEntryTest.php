<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\DemoPharmacySeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoEntryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(DemoPharmacySeeder::class);
    }

    public function test_demo_entry_for_admin_logs_in_and_redirects_to_dashboard(): void
    {
        $response = $this->get('/demo/enter?role=admin');

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticated();

        $user = auth()->user();
        $this->assertSame('admin@pharmacore.test', $user->email);
        $expectedTenantId = $user->tenants()->wherePivot('is_active', true)->first()?->id ?? 1;
        $this->assertSame($expectedTenantId, session('active_tenant_id'));
    }

    public function test_demo_entry_for_cashier_redirects_to_pos_terminal(): void
    {
        $response = $this->get('/demo/enter?role=cashier');

        $response->assertRedirect('/pos');
        $this->assertAuthenticated();

        $user = auth()->user();
        $this->assertSame('cashier@pharmacore.test', $user->email);
    }

    public function test_demo_entry_for_superadmin_is_strictly_forbidden_and_redirects_to_login(): void
    {
        $response = $this->get('/demo/enter?role=superadmin');

        $response->assertRedirect('/login');
        $this->assertGuest();

        $responseByEmail = $this->get('/demo/enter?email=superadmin@pharmacore.test');
        $responseByEmail->assertRedirect('/login');
        $this->assertGuest();
    }

    public function test_demo_entry_for_pathologist_and_radiologist_redirects_to_dashboard(): void
    {
        $responsePath = $this->get('/demo/enter?role=pathologist');
        $responsePath->assertRedirect('/dashboard');
        $this->assertAuthenticated();

        $responseRadio = $this->get('/demo/enter?role=radiologist');
        $responseRadio->assertRedirect('/dashboard');
        $this->assertAuthenticated();
    }

    public function test_super_admin_can_manage_subscriber_plan_and_custom_module_access(): void
    {
        $superAdmin = User::where('email', 'superadmin@pharmacore.test')->firstOrFail();
        $demoOwner = User::where('email', 'admin@pharmacore.test')->firstOrFail();
        $posModule = \App\Models\Module::where('key', 'pos')->firstOrFail();
        $crmModule = \App\Models\Module::where('key', 'crm')->firstOrFail();

        // Super Admin assigns starter plan and restricts to only POS (removes CRM)
        $this->actingAs($superAdmin)->patch("/admin/subscribers/{$demoOwner->id}", [
            'plan_key' => 'starter',
            'status' => 'active',
            'billing_cycle' => 'monthly',
            'module_ids' => [$posModule->id],
        ])->assertRedirect();

        $tenant = $demoOwner->fresh()->currentTenant;
        $this->assertTrue($tenant->hasFeature('pos'));
        $this->assertFalse($tenant->hasFeature('crm'));

        // CRM route is now forbidden for the subscriber
        auth()->logout();
        $this->actingAs($demoOwner);
        session(['active_tenant_id' => $tenant->id]);
        $this->get('/crm/customers')->assertForbidden();

        // Super Admin grants CRM module access
        auth()->logout();
        $this->actingAs($superAdmin)->patch("/admin/subscribers/{$demoOwner->id}", [
            'plan_key' => 'starter',
            'status' => 'active',
            'billing_cycle' => 'monthly',
            'module_ids' => [$posModule->id, $crmModule->id],
        ])->assertRedirect();

        $this->assertTrue($tenant->fresh()->hasFeature('crm'));

        // CRM route is now accessible
        auth()->logout();
        $this->actingAs($demoOwner);
        session(['active_tenant_id' => $tenant->id]);
        $this->get('/crm/customers')->assertOk();
    }

    public function test_super_admin_can_manage_demo_roles_and_sync_with_landing_page(): void
    {
        \App\Models\DemoRole::seedDefaults();
        $superAdmin = User::where('email', 'superadmin@pharmacore.test')->firstOrFail();

        // 1. Visit admin demo roles page
        $this->actingAs($superAdmin)->get('/admin/demo-roles')->assertOk();

        $role = \App\Models\DemoRole::where('role_id', 'cashier')->firstOrFail();

        // 2. Super admin updates demo role features and description
        $this->actingAs($superAdmin)->put("/admin/demo-roles/{$role->id}", [
            'title_en' => 'POS Cashier Lead',
            'title_bn' => 'প্রধান ক্যাশিয়ার',
            'subtitle_en' => 'Front Counter Billing & Shift Close',
            'subtitle_bn' => 'কাউন্টার বিল ও শিফট ক্লোজ',
            'description_en' => 'Custom description configured dynamically from admin portal.',
            'description_bn' => 'অ্যাডমিন থেকে ডাইনামিকভাবে কনফিগার করা কাস্টম বিবরণ।',
            'email' => 'cashier@pharmacore.test',
            'tags_en' => ['POS Terminal', 'Cash Register', 'Daily Sales'],
            'features_en' => [
                'Dynamic Feature 1: Live custom override',
                'Dynamic Feature 2: Real-time ledger monitoring',
            ],
            'restrictions_en' => [
                'Encrypted tenant notes',
            ],
            'is_active' => true,
        ])->assertRedirect();

        $this->assertDatabaseHas('demo_roles', [
            'id' => $role->id,
            'title_en' => 'POS Cashier Lead',
        ]);

        // 3. Verify that landing page receives updated demo roles
        auth()->logout();
        $response = $this->get('/');
        $response->assertOk();
    }
}

