<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Counter;
use App\Models\CounterBreakLog;
use App\Models\CounterSession;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Models\User;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CounterManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    public function test_counter_lifecycle_shift_break_and_reconciliation(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $owner->setManagerPin('1234');
        $owner->save();

        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Popular Pharmacy Counters',
            'plan_key' => 'growth',
        ]);

        $branch = $tenant->branches()->first();

        app(CurrentTenant::class)->set($tenant);

        // 1. Create a Counter
        $response = $this->actingAs($owner)
            ->post('/counters', [
                'code' => 'C-99',
                'name' => 'Test OPD Counter',
                'type' => 'opd',
                'zone' => 'Floor 1',
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('counters', [
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'code' => 'C-99',
            'status' => 'closed',
        ]);

        $counter = Counter::query()->where('code', 'C-99')->firstOrFail();

        // 2. Open Shift with Float
        $response = $this->actingAs($owner)
            ->post("/counters/{$counter->id}/open-session", [
                'opening_float' => 1500.00,
                'notes' => 'Morning shift start',
            ]);

        $response->assertSessionHasNoErrors();
        $counter->refresh();
        $this->assertEquals('active', $counter->status);
        $this->assertEquals($owner->id, $counter->current_user_id);

        $session = CounterSession::query()->where('counter_id', $counter->id)->where('status', 'open')->firstOrFail();
        $this->assertEquals(1500.00, (float) $session->opening_float);
        $this->assertEquals(1500.00, (float) $session->system_expected_cash);

        // 3. Take Break (e.g. Prayer)
        $response = $this->actingAs($owner)
            ->post("/counters/{$counter->id}/take-break", [
                'break_type' => 'prayer',
                'notes' => 'Asr prayer pause',
            ]);

        $response->assertSessionHasNoErrors();
        $counter->refresh();
        $this->assertEquals('on_break', $counter->status);
        $this->assertEquals('prayer', $counter->current_break_reason);

        $this->assertDatabaseHas('counter_break_logs', [
            'counter_id' => $counter->id,
            'break_type' => 'prayer',
            'ended_at' => null,
        ]);

        // 4. Resume Service with Cashier PIN
        // Wrong PIN fails
        $response = $this->actingAs($owner)
            ->post("/counters/{$counter->id}/resume-service", [
                'pin' => '9999',
            ]);
        $response->assertSessionHas('error');

        // Correct PIN unlocks
        $response = $this->actingAs($owner)
            ->post("/counters/{$counter->id}/resume-service", [
                'pin' => '1234',
            ]);
        $response->assertSessionHasNoErrors();
        $counter->refresh();
        $this->assertEquals('active', $counter->status);
        $this->assertNull($counter->current_break_reason);

        // 5. Close Shift with Counted Cash & Discrepancy
        $response = $this->actingAs($owner)
            ->post("/counters/{$counter->id}/close-session", [
                'closing_cash_counted' => 1500.00,
                'notes' => 'Shift ended, cash matched',
            ]);

        $response->assertSessionHasNoErrors();
        $counter->refresh();
        $this->assertEquals('closed', $counter->status);
        $this->assertNull($counter->current_user_id);

        $session->refresh();
        $this->assertEquals('closed', $session->status);
        $this->assertEquals(1500.00, (float) $session->closing_cash_counted);
        $this->assertEquals(0.00, (float) $session->discrepancy);
    }

    public function test_pos_checkout_attaches_counter_and_tallies_cash_drawer(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'City Pharmacy Counters',
            'plan_key' => 'growth',
        ]);
        $branch = $tenant->branches()->first();

        [$counter, $session, $medicine] = app(CurrentTenant::class)->run($tenant, function () use ($tenant, $branch, $owner) {
            $counter = Counter::query()->create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'code' => 'C-01',
                'name' => 'Main POS Counter',
                'type' => 'opd',
                'status' => 'active',
                'current_user_id' => $owner->id,
                'is_active' => true,
            ]);

            $session = CounterSession::query()->create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'counter_id' => $counter->id,
                'user_id' => $owner->id,
                'status' => 'open',
                'opened_at' => now(),
                'opening_float' => 1000.00,
                'system_expected_cash' => 1000.00,
                'total_sales_amount' => 0,
                'total_transactions' => 0,
            ]);

            $medicine = Medicine::query()->create([
                'tenant_id' => $tenant->id,
                'name' => 'Ace Plus 500mg',
                'sku' => 'ACE-PLUS-01',
                'dosage_form' => 'tablet',
                'unit' => 'piece',
                'units_per_strip' => 10,
                'units_per_box' => 100,
                'default_purchase_price' => 1.50,
                'default_selling_price' => 2.50,
                'is_active' => true,
            ]);

            MedicineBatch::query()->create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'medicine_id' => $medicine->id,
                'batch_number' => 'B-TEST-01',
                'expiry_date' => now()->addYear(),
                'quantity_received' => 100,
                'quantity_available' => 100,
                'purchase_price' => 1.50,
                'selling_price' => 2.50,
                'status' => 'active',
            ]);

            return [$counter, $session, $medicine];
        });

        app(CurrentTenant::class)->set($tenant);
        session(['active_branch_id' => $branch->id]);

        $response = $this->actingAs($owner)
            ->post('/pos/checkout', [
                'counter_id' => $counter->id,
                'counter_session_id' => $session->id,
                'customer_name' => 'Walk-in Patient',
                'payment_method' => 'cash',
                'paid_amount' => 50.00,
                'items' => [
                    [
                        'medicine_id' => $medicine->id,
                        'quantity' => 20,
                        'sale_unit' => 'piece',
                    ],
                ],
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('lastSale');

        $lastSale = session('lastSale');
        $this->assertEquals('C-01', $lastSale['counter_code']);
        $this->assertEquals('Main POS Counter', $lastSale['counter_name']);

        $sale = Sale::query()->latest('id')->firstOrFail();
        $this->assertEquals($counter->id, $sale->counter_id);
        $this->assertEquals($session->id, $sale->counter_session_id);
        $this->assertEquals(50.00, (float) $sale->total_amount);

        // Verify session cash drawer tally updated
        $session->refresh();
        $this->assertEquals(1, $session->total_transactions);
        $this->assertEquals(50.00, (float) $session->total_sales_amount);
        $this->assertEquals(1050.00, (float) $session->system_expected_cash);
    }
}
