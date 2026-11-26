<?php

namespace Tests\Feature;

use App\Models\Sale;
use App\Models\User;
use App\Services\TenantProvisioningService;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacPermissionCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashierAcceptTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(RbacPermissionCatalogSeeder::class);
    }

    public function test_cashier_and_admin_can_accept_sales_order(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Popular Counter SaaS Test',
            'plan_key' => 'growth',
        ]);
        $branch = $tenant->branches()->first();
        app(\App\Tenancy\CurrentTenant::class)->set($tenant);

        // Create cashier
        $cashier = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $owner->id,
            'status' => 'active',
        ]);
        $tenant->users()->attach($cashier->id, [
            'role' => 'cashier',
            'branch_id' => $branch->id,
            'is_active' => true,
        ]);

        // Create counter
        $counter = \App\Models\Counter::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'code' => 'C-01',
            'name' => 'Main Cash Counter',
            'status' => 'active',
            'is_active' => true,
        ]);

        // Create an assigned sale
        $sale = Sale::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'counter_id' => $counter->id,
            'user_id' => $owner->id,
            'order_number' => 'ORD-TEST-001',
            'invoice_number' => 'ORD-TEST-001',
            'order_status' => 'assigned',
            'total_amount' => 150.00,
            'assigned_at' => now(),
        ]);

        // Test accept by cashier
        $resp = $this->actingAs($cashier)
            ->withSession([
                'active_tenant_id' => $tenant->id,
                'active_branch_id' => $branch->id,
            ])
            ->post("/cashier/orders/{$sale->id}/accept");

        $resp->assertSessionHasNoErrors();
        $resp->assertRedirect();
        $sale->refresh();
        $this->assertSame('processing', $sale->order_status);
        $this->assertSame($cashier->id, $sale->cashier_id);

        // Reset to assigned and test accept by owner/admin
        $sale->order_status = 'assigned';
        $sale->cashier_id = null;
        $sale->save();

        $respAdmin = $this->actingAs($owner)
            ->withSession([
                'active_tenant_id' => $tenant->id,
                'active_branch_id' => $branch->id,
            ])
            ->post("/cashier/orders/{$sale->id}/accept");

        $respAdmin->assertSessionHasNoErrors();
        $respAdmin->assertRedirect();
        $sale->refresh();
        $this->assertSame('processing', $sale->order_status);
        $this->assertSame($owner->id, $sale->cashier_id);
    }
}
