<?php

namespace Tests\Feature;

use App\Enums\TenantRole;
use App\Models\Branch;
use App\Models\Counter;
use App\Models\CounterCashier;
use App\Models\CounterSession;
use App\Models\Customer;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Models\User;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacPermissionCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CounterWiseSalesOrderTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(RbacPermissionCatalogSeeder::class);
    }

    public function test_dynamic_counter_assignment_lowest_queue_and_round_robin(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $owner->setManagerPin('1234');
        $owner->save();

        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Popular Counter SaaS Test',
            'plan_key' => 'growth',
        ]);
        $branch = $tenant->branches()->first();

        // Create 2 cashiers
        $cashier1 = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $owner->id,
            'status' => 'active',
        ]);
        $tenant->users()->attach($cashier1->id, [
            'branch_id' => $branch->id,
            'is_owner' => false,
            'role' => TenantRole::CASHIER->value,
            'roles' => json_encode([TenantRole::CASHIER->value]),
            'is_active' => true,
        ]);

        $cashier2 = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $owner->id,
            'status' => 'active',
        ]);
        $tenant->users()->attach($cashier2->id, [
            'branch_id' => $branch->id,
            'is_owner' => false,
            'role' => TenantRole::CASHIER->value,
            'roles' => json_encode([TenantRole::CASHIER->value]),
            'is_active' => true,
        ]);

        // Create Salesman
        $salesman = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $owner->id,
            'status' => 'active',
        ]);
        $tenant->users()->attach($salesman->id, [
            'branch_id' => $branch->id,
            'is_owner' => false,
            'role' => TenantRole::SALESMAN->value,
            'roles' => json_encode([TenantRole::SALESMAN->value]),
            'is_active' => true,
        ]);

        [$counter1, $session1, $counter2, $session2, $med, $batch] = app(CurrentTenant::class)->run($tenant, function () use ($tenant, $branch, $cashier1, $cashier2) {
            $c1 = Counter::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'code' => 'C-01',
                'name' => 'Main Counter 1',
                'type' => 'opd',
                'status' => 'active',
                'current_user_id' => $cashier1->id,
                'max_queue_capacity' => 10,
                'auto_assignment_enabled' => true,
                'is_active' => true,
                'last_assigned_at' => now()->subMinutes(10),
            ]);

            $s1 = CounterSession::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'counter_id' => $c1->id,
                'user_id' => $cashier1->id,
                'status' => 'open',
                'opened_at' => now(),
                'opening_float' => 1000,
                'system_expected_cash' => 1000,
            ]);

            $c2 = Counter::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'code' => 'C-02',
                'name' => 'Main Counter 2',
                'type' => 'opd',
                'status' => 'active',
                'current_user_id' => $cashier2->id,
                'max_queue_capacity' => 10,
                'auto_assignment_enabled' => true,
                'is_active' => true,
                'last_assigned_at' => now()->subMinutes(20), // Earlier last assignment => Round robin prioritizes C2
            ]);

            $s2 = CounterSession::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'counter_id' => $c2->id,
                'user_id' => $cashier2->id,
                'status' => 'open',
                'opened_at' => now(),
                'opening_float' => 1000,
                'system_expected_cash' => 1000,
            ]);

            $medicine = Medicine::create([
                'tenant_id' => $tenant->id,
                'name' => 'Napa Extra 500mg',
                'sku' => 'MED-NAPA',
                'unit' => 'piece',
                'dosage_form' => 'tablet',
                'default_selling_price' => 2.50,
                'default_purchase_price' => 1.50,
                'is_active' => true,
            ]);

            $b = MedicineBatch::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'medicine_id' => $medicine->id,
                'batch_number' => 'B-001',
                'expiry_date' => now()->addYear(),
                'quantity_received' => 1000,
                'quantity_available' => 1000,
                'selling_price' => 2.50,
                'purchase_price' => 1.50,
            ]);

            return [$c1, $s1, $c2, $s2, $medicine, $b];
        });

        // 1. Salesman creates Order 1 -> routes to Counter 2 (Round-Robin priority)
        $resp1 = $this->actingAs($salesman)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->post('/sales/orders', [
                'items' => [
                    [
                        'medicine_id' => $med->id,
                        'medicine_batch_id' => $batch->id,
                        'quantity' => 10,
                        'sale_unit' => 'piece',
                    ],
                ],
            ]);

        $resp1->assertSessionHasNoErrors();
        $resp1->assertRedirect();

        $order1 = Sale::withoutGlobalScopes()->where('salesman_id', $salesman->id)->latest('id')->first();
        $this->assertNotNull($order1);
        $this->assertSame($counter2->id, $order1->counter_id);
        $this->assertSame('assigned', $order1->order_status);

        // 2. Salesman creates Order 2 -> Counter 1 now has queue 0 vs Counter 2 with queue 1 -> routes to Counter 1!
        $resp2 = $this->actingAs($salesman)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->post('/sales/orders', [
                'items' => [
                    [
                        'medicine_id' => $med->id,
                        'medicine_batch_id' => $batch->id,
                        'quantity' => 5,
                        'sale_unit' => 'piece',
                    ],
                ],
            ]);

        $resp2->assertSessionHasNoErrors();
        $resp2->assertRedirect();

        $order2 = Sale::withoutGlobalScopes()->where('salesman_id', $salesman->id)->latest('id')->first();
        $this->assertNotNull($order2);
        $this->assertSame($counter1->id, $order2->counter_id);
        $this->assertSame('assigned', $order2->order_status);

        // 3. Cashier 2 accepts Order 1 and processes payment
        $acceptResp = $this->actingAs($cashier2)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->post("/cashier/orders/{$order1->id}/accept");

        $acceptResp->assertSessionHasNoErrors();
        $order1->refresh();
        $this->assertSame('processing', $order1->order_status);

        $this->withoutExceptionHandling();
        $payResp = $this->actingAs($cashier2)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->post("/cashier/orders/{$order1->id}/pay", [
                'payment_method' => 'cash',
                'paid_amount' => $order1->total_amount,
            ]);

        $payResp->assertSessionHasNoErrors();
        $order1->refresh();
        $this->assertSame('completed', $order1->order_status);
        $this->assertSame('paid', $order1->payment_status);
        $this->assertNotNull($order1->invoice_number);

        // Verify stock deducted
        $batch->refresh();
        $this->assertSame(990, $batch->quantity_available);

        // Verify shift totals
        $session2->refresh();
        $this->assertEquals(25.00, $session2->total_sales_amount);
        $this->assertSame(1, $session2->total_transactions);

        // 4. Test Manager Reassignment of Order 2
        $reassignResp = $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->post("/counters/orders/{$order2->id}/reassign", [
                'counter_id' => $counter2->id,
                'reason' => 'Load balancing by manager',
            ]);

        $reassignResp->assertSessionHasNoErrors();
        $order2->refresh();
        $this->assertSame($counter2->id, $order2->counter_id);
        $this->assertSame('assigned', $order2->order_status);

        // 5. Test Cashier assignment to Counter
        $assignStaffResp = $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->post("/counters/{$counter1->id}/assign-cashier", [
                'user_id' => $cashier1->id,
                'shift' => 'morning',
                'is_primary' => true,
            ]);

        $assignStaffResp->assertSessionHasNoErrors();
        $this->assertDatabaseHas('counter_cashiers', [
            'counter_id' => $counter1->id,
            'user_id' => $cashier1->id,
            'shift' => 'morning',
            'is_primary' => true,
        ]);
    }

    public function test_unassigned_queue_when_no_active_counter(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Offline Counters SaaS Test',
            'plan_key' => 'growth',
        ]);
        $branch = $tenant->branches()->first();

        $salesman = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $owner->id,
            'status' => 'active',
        ]);
        $tenant->users()->attach($salesman->id, [
            'branch_id' => $branch->id,
            'is_owner' => false,
            'role' => TenantRole::SALESMAN->value,
            'roles' => json_encode([TenantRole::SALESMAN->value]),
            'is_active' => true,
        ]);

        [$med, $batch] = app(CurrentTenant::class)->run($tenant, function () use ($tenant, $branch) {
            $m = Medicine::create([
                'tenant_id' => $tenant->id,
                'name' => 'Ace Plus 500mg',
                'sku' => 'MED-ACE',
                'unit' => 'piece',
                'dosage_form' => 'tablet',
                'default_selling_price' => 3.00,
                'default_purchase_price' => 2.00,
                'is_active' => true,
            ]);

            $b = MedicineBatch::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'medicine_id' => $m->id,
                'batch_number' => 'B-ACE-01',
                'expiry_date' => now()->addYear(),
                'quantity_received' => 100,
                'quantity_available' => 100,
                'selling_price' => 3.00,
                'purchase_price' => 2.00,
            ]);

            return [$m, $b];
        });

        // Salesman submits order with NO active counters -> enters unassigned queue
        $resp = $this->actingAs($salesman)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->post('/sales/orders', [
                'items' => [
                    [
                        'medicine_id' => $med->id,
                        'medicine_batch_id' => $batch->id,
                        'quantity' => 2,
                        'sale_unit' => 'piece',
                    ],
                ],
            ]);

        $resp->assertSessionHasNoErrors();
        $resp->assertRedirect();

        $order = Sale::withoutGlobalScopes()->where('salesman_id', $salesman->id)->latest('id')->first();
        $this->assertNotNull($order);
        $this->assertNull($order->counter_id);
        $this->assertSame('unassigned', $order->order_status);

        // Salesman cancels the unassigned order
        $cancelResp = $this->actingAs($salesman)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->post("/sales/orders/{$order->id}/cancel", [
                'reason' => 'Customer changed mind',
            ]);

        $cancelResp->assertSessionHasNoErrors();
        $order->refresh();
        $this->assertSame('cancelled', $order->order_status);
        $this->assertSame('Customer changed mind', $order->cancellation_reason);
    }

    public function test_cashier_strictly_forbidden_from_salesman_functionality(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'RBAC Isolation Pharmacy',
            'plan_key' => 'growth',
        ]);
        $branch = $tenant->branches()->first();

        $cashier = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $owner->id,
            'status' => 'active',
        ]);
        $tenant->users()->attach($cashier->id, [
            'branch_id' => $branch->id,
            'is_owner' => false,
            'role' => TenantRole::CASHIER->value,
            'roles' => json_encode([TenantRole::CASHIER->value]),
            'is_active' => true,
        ]);

        // 1. Cashier attempts to open salesman order creation page -> 403 Forbidden
        $this->actingAs($cashier)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->get('/sales/orders/create')
            ->assertForbidden();

        // 2. Cashier attempts to submit a salesman order -> 403 Forbidden
        $this->actingAs($cashier)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->post('/sales/orders', [
                'items' => [['medicine_id' => 1, 'quantity' => 1]],
            ])
            ->assertForbidden();

        // 3. Cashier attempts to open salesman order history -> 403 Forbidden
        $this->actingAs($cashier)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->get('/sales/orders/my-orders')
            ->assertForbidden();
    }

    public function test_salesman_strictly_forbidden_from_cashier_and_counters(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Salesman Restriction Pharmacy',
            'plan_key' => 'growth',
        ]);
        $branch = $tenant->branches()->first();

        $salesman = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $owner->id,
            'status' => 'active',
        ]);
        $tenant->users()->attach($salesman->id, [
            'branch_id' => $branch->id,
            'is_owner' => false,
            'role' => TenantRole::SALESMAN->value,
            'roles' => json_encode([TenantRole::SALESMAN->value]),
            'is_active' => true,
        ]);

        // 1. Salesman attempts to access Cashier Workstation -> 403 Forbidden
        $this->actingAs($salesman)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->get('/cashier/dashboard')
            ->assertForbidden();

        // 2. Salesman attempts to access Counter Terminals & Shifts -> 403 Forbidden
        $this->actingAs($salesman)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->get('/counters')
            ->assertForbidden();

        // 3. Salesman attempts to access Live Queue Monitor -> 403 Forbidden
        $this->actingAs($salesman)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->get('/counters/monitoring')
            ->assertForbidden();
    }
}
