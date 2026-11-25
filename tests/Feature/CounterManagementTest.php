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

    public function test_counter_and_shift_session_deletion(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Deletion Test Pharmacy',
            'plan_key' => 'growth',
        ]);
        $branch = $tenant->branches()->first();

        [$activeCounter, $closedCounter, $session] = app(CurrentTenant::class)->run($tenant, function () use ($tenant, $branch, $owner) {
            $activeCounter = Counter::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'code' => 'C-ACT',
                'name' => 'Active Counter',
                'status' => 'active',
                'current_user_id' => $owner->id,
            ]);

            $closedCounter = Counter::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'code' => 'C-CLS',
                'name' => 'Closed Counter',
                'status' => 'closed',
            ]);

            $session = CounterSession::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'counter_id' => $closedCounter->id,
                'user_id' => $owner->id,
                'status' => 'closed',
                'opening_float' => 100,
                'closing_cash_counted' => 100,
                'system_expected_cash' => 100,
            ]);

            return [$activeCounter, $closedCounter, $session];
        });

        app(CurrentTenant::class)->set($tenant);

        // 1. Deleting active counter fails with error
        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->from('/counters')
            ->delete("/counters/{$activeCounter->id}")
            ->assertSessionHas('error');

        $this->assertDatabaseHas('counters', ['id' => $activeCounter->id]);

        // 2. Deleting closed session succeeds
        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->from('/counters')
            ->delete("/counters/sessions/{$session->id}")
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('counter_sessions', ['id' => $session->id]);

        // 3. Deleting closed counter succeeds
        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->from('/counters')
            ->delete("/counters/{$closedCounter->id}")
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('counters', ['id' => $closedCounter->id]);
    }

    public function test_cashier_sees_only_own_shift_and_cannot_manage_counters(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Cashier Scoped Pharmacy',
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
            'role' => \App\Enums\TenantRole::CASHIER->value,
            'roles' => json_encode([\App\Enums\TenantRole::CASHIER->value]),
            'is_active' => true,
        ]);

        app(CurrentTenant::class)->run($tenant, function () use ($tenant, $branch, $cashier, $owner) {
            $counter1 = Counter::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'code' => 'C-01',
                'name' => 'Cashier Terminal',
                'status' => 'active',
                'current_user_id' => $cashier->id,
            ]);

            $counter2 = Counter::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'code' => 'C-02',
                'name' => 'Other Station',
                'status' => 'closed',
            ]);

            // Cashier's session
            CounterSession::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'counter_id' => $counter1->id,
                'user_id' => $cashier->id,
                'status' => 'open',
                'opening_float' => 500,
                'system_expected_cash' => 500,
            ]);

            // Other user's closed session
            CounterSession::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'counter_id' => $counter2->id,
                'user_id' => $owner->id,
                'status' => 'closed',
                'opening_float' => 1000,
                'closing_cash_counted' => 1000,
                'system_expected_cash' => 1000,
            ]);
        });

        app(CurrentTenant::class)->set($tenant);

        $response = $this->actingAs($cashier)
            ->withSession(['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id])
            ->get('/counters');

        $response->assertOk()
            ->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
                ->component('Counters/Index')
                ->where('canManageCounters', false)
                ->where('isCashier', true)
                ->has('counters', 1)
                ->where('counters.0.code', 'C-01')
                ->has('recentSessions', 1) // cashier only sees their own 1 session, not other users'
            );
    }

    public function test_industry_standard_shift_rules_cash_movements_exact_math_and_z_report(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Labaid Standard Cash Pharmacy',
            'plan_key' => 'growth',
        ]);
        $branch = $tenant->branches()->first();

        $cashierA = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $owner->id,
            'status' => 'active',
        ]);
        $cashierB = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $owner->id,
            'status' => 'active',
        ]);

        foreach ([$cashierA, $cashierB] as $staff) {
            $tenant->users()->attach($staff->id, [
                'branch_id' => $branch->id,
                'is_owner' => false,
                'role' => \App\Enums\TenantRole::CASHIER->value,
                'roles' => json_encode([\App\Enums\TenantRole::CASHIER->value]),
                'is_active' => true,
            ]);
            \Illuminate\Support\Facades\DB::table('user_branches')->insert([
                'user_id' => $staff->id,
                'branch_id' => $branch->id,
            ]);
        }

        [$counter1, $counter2, $medicine] = app(CurrentTenant::class)->run($tenant, function () use ($tenant, $branch) {
            $c1 = Counter::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'code' => 'C-01',
                'name' => 'Main Cash Counter',
                'type' => 'billing',
                'status' => 'closed',
                'is_active' => true,
            ]);
            $c2 = Counter::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'code' => 'C-02',
                'name' => 'Express Counter',
                'type' => 'express',
                'status' => 'closed',
                'is_active' => true,
            ]);

            $med = Medicine::create([
                'tenant_id' => $tenant->id,
                'name' => 'Napa Extra 500mg',
                'sku' => 'NAPA-EX-01',
                'dosage_form' => 'tablet',
                'unit' => 'piece',
                'units_per_strip' => 10,
                'units_per_box' => 100,
                'default_purchase_price' => 2.00,
                'default_selling_price' => 10.10,
                'is_active' => true,
            ]);

            MedicineBatch::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'medicine_id' => $med->id,
                'batch_number' => 'B-STD-01',
                'expiry_date' => now()->addYear(),
                'quantity_received' => 500,
                'quantity_available' => 500,
                'purchase_price' => 2.00,
                'selling_price' => 10.10,
                'status' => 'active',
            ]);

            return [$c1, $c2, $med];
        });

        app(CurrentTenant::class)->set($tenant);
        $sessionCtx = ['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id];

        // 1. Cashier A opens shift on Counter 1 with Opening Float 1000.00
        $this->actingAs($cashierA)
            ->withSession($sessionCtx)
            ->post("/counters/{$counter1->id}/open-session", [
                'opening_float' => 1000.00,
                'shift' => 'morning',
            ])
            ->assertSessionHas('success');

        $shiftA = CounterSession::query()
            ->where('counter_id', $counter1->id)
            ->where('status', 'open')
            ->firstOrFail();

        // 2. Rule: One open shift per cashier (Cashier A cannot open Counter 2)
        $this->actingAs($cashierA)
            ->withSession($sessionCtx)
            ->post("/counters/{$counter2->id}/open-session", [
                'opening_float' => 500.00,
            ])
            ->assertSessionHas('error');

        // 3. Rule: One active cashier per counter (Cashier B cannot hijack Counter 1)
        $this->actingAs($cashierB)
            ->withSession($sessionCtx)
            ->post("/counters/{$counter1->id}/open-session", [
                'opening_float' => 500.00,
            ])
            ->assertSessionHas('error');

        // 4. Rule: Cashier B cannot record cash movement or close Cashier A's shift
        $this->actingAs($cashierB)
            ->withSession($sessionCtx)
            ->post("/counters/{$counter1->id}/cash-movement", [
                'type' => 'cash_in',
                'amount' => 200.00,
                'reason' => 'Unauthorized attempt',
            ])
            ->assertSessionHas('error');

        $this->actingAs($cashierB)
            ->withSession($sessionCtx)
            ->post("/counters/{$counter1->id}/close-session", [
                'closing_cash_counted' => 1000.00,
            ])
            ->assertSessionHas('error');

        // 5. Record a POS Cash Sale (10 units * 10.10 = 101.00; paid 150.00 cash -> 49.00 change -> net cash 101.00)
        $posResponse = $this->actingAs($cashierA)
            ->withSession($sessionCtx)
            ->post('/pos/checkout', [
                'counter_id' => $counter1->id,
                'counter_session_id' => $shiftA->id,
                'customer_name' => 'Walk-in',
                'payment_method' => 'cash',
                'paid_amount' => 150.00,
                'items' => [
                    ['medicine_id' => $medicine->id, 'quantity' => 10, 'sale_unit' => 'piece'],
                ],
            ]);
        $posResponse->assertRedirect();
        $posResponse->assertSessionHas('lastSale');

        // 6. Record Cash In (+500.25), Cash Out (-50.10), Safe Drop (-200.00), Cash Refund (-30.05)
        $this->actingAs($cashierA)->withSession($sessionCtx)
            ->post("/counters/{$counter1->id}/cash-movement", [
                'type' => 'cash_in',
                'amount' => '500.25',
                'reason' => 'Float top-up from manager',
            ])->assertSessionHas('success');

        $this->actingAs($cashierA)->withSession($sessionCtx)
            ->post("/counters/{$counter1->id}/cash-movement", [
                'type' => 'cash_out',
                'amount' => '50.10',
                'reason' => 'Water bottle expense',
            ])->assertSessionHas('success');

        $this->actingAs($cashierA)->withSession($sessionCtx)
            ->post("/counters/{$counter1->id}/cash-movement", [
                'type' => 'safe_drop',
                'amount' => '200.00',
                'reason' => 'Mid-shift vault drop',
            ])->assertSessionHas('success');

        $this->actingAs($cashierA)->withSession($sessionCtx)
            ->post("/counters/{$counter1->id}/cash-movement", [
                'type' => 'cash_refund',
                'amount' => '30.05',
                'reason' => 'Customer medicine return',
                'reference_number' => 'RET-001',
            ])->assertSessionHas('success');

        // Exact Expected Cash = 1000.00 + 101.00 + 500.25 - 50.10 - 200.00 - 30.05 = 1321.10
        $shiftA->refresh();
        $this->assertSame('1321.10', (string) $shiftA->system_expected_cash);
        $this->assertSame('500.25', (string) $shiftA->cash_in_total);
        $this->assertSame('250.10', (string) $shiftA->cash_out_total);
        $this->assertSame('30.05', (string) $shiftA->cash_refunds_total);

        // 7. Live X-Report accessible by Cashier A, blocked for Cashier B
        $this->actingAs($cashierA)->withSession($sessionCtx)
            ->getJson("/counters/sessions/{$shiftA->id}/z-report")
            ->assertOk()
            ->assertJsonPath('report_type', 'X-REPORT (LIVE)')
            ->assertJsonPath('drawer.expected_cash', 1321.1);

        $this->actingAs($cashierB)->withSession($sessionCtx)
            ->getJson("/counters/sessions/{$shiftA->id}/z-report")
            ->assertForbidden();

        // 8. Close Shift with counted 1300.00 -> exact discrepancy -21.10 + sequential ZR-000001
        $this->actingAs($cashierA)->withSession($sessionCtx)
            ->post("/counters/{$counter1->id}/close-session", [
                'closing_cash_counted' => '1300.00',
                'closing_denominations' => ['1000' => 1, '100' => 3],
                'notes' => 'Shortage of 21.10 noted',
            ])
            ->assertSessionHas('success')
            ->assertSessionHas('lastClosedSessionId', $shiftA->id);

        $shiftA->refresh();
        $this->assertSame('closed', $shiftA->status);
        $this->assertSame('ZR-000001', $shiftA->z_report_number);
        $this->assertSame('1321.10', (string) $shiftA->system_expected_cash);
        $this->assertSame('1300.00', (string) $shiftA->closing_cash_counted);
        $this->assertSame('-21.10', (string) $shiftA->discrepancy);
        $this->assertSame(1, $shiftA->closing_denominations[1000]);
        $this->assertSame(3, $shiftA->closing_denominations[100]);

        // 9. Z-Report endpoint returns immutable Z-REPORT snapshot (accessible by Admin too)
        $this->actingAs($owner)->withSession($sessionCtx)
            ->getJson("/counters/sessions/{$shiftA->id}/z-report")
            ->assertOk()
            ->assertJsonPath('report_type', 'Z-REPORT')
            ->assertJsonPath('z_report_number', 'ZR-000001')
            ->assertJsonPath('drawer.discrepancy_status', 'shortage')
            ->assertJsonPath('drawer.discrepancy', -21.1)
            ->assertJsonPath('drawer.cash_refunds', 30.05);

        // 10. Next shift closed gets sequential gapless ZR-000002
        $this->actingAs($cashierB)->withSession($sessionCtx)
            ->post("/counters/{$counter1->id}/open-session", [
                'opening_float' => 500.00,
                'shift' => 'evening',
            ])->assertSessionHas('success');

        $this->actingAs($cashierB)->withSession($sessionCtx)
            ->post("/counters/{$counter1->id}/close-session", [
                'closing_cash_counted' => 500.00,
            ])->assertSessionHas('success');

        $shiftB = CounterSession::query()->where('user_id', $cashierB->id)->firstOrFail();
        $this->assertSame('ZR-000002', $shiftB->z_report_number);
        $this->assertSame('0.00', (string) $shiftB->discrepancy);
    }

    public function test_opening_float_notes_mandatory_discrepancy_reason_force_close_and_immutability(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'GreenLife Pharmacy & Diagnostics',
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
            'role' => \App\Enums\TenantRole::CASHIER->value,
            'roles' => json_encode([\App\Enums\TenantRole::CASHIER->value]),
            'is_active' => true,
        ]);
        \Illuminate\Support\Facades\DB::table('user_branches')->insert([
            'user_id' => $cashier->id,
            'branch_id' => $branch->id,
        ]);

        $counter = app(CurrentTenant::class)->run($tenant, fn () => Counter::create([
            'tenant_id' => $tenant->id,
            'branch_id' => $branch->id,
            'code' => 'C-02',
            'name' => 'Cashier & Billing Station',
            'type' => 'billing',
            'status' => 'closed',
            'is_active' => true,
        ]));

        app(CurrentTenant::class)->set($tenant);
        $sessionCtx = ['active_tenant_id' => $tenant->id, 'active_branch_id' => $branch->id];

        // 1. Open Shift with BDT Note Count (1000 x 2 + 500 x 4 + 100 x 10 = 5000.00)
        $this->actingAs($cashier)->withSession($sessionCtx)
            ->post("/counters/{$counter->id}/open-session", [
                'opening_float' => 5000.00,
                'opening_denominations' => ['1000' => 2, '500' => 4, '100' => 10],
            ])
            ->assertSessionHas('success');

        $session = CounterSession::query()->where('counter_id', $counter->id)->where('status', 'open')->firstOrFail();
        $this->assertSame('5000.00', (string) $session->opening_float);
        $this->assertSame(2, $session->opening_denominations[1000]);
        $this->assertSame(4, $session->opening_denominations[500]);
        $this->assertSame(10, $session->opening_denominations[100]);

        // 2. Discrepancy without reason is REJECTED server-side
        $this->actingAs($cashier)->withSession($sessionCtx)
            ->post("/counters/{$counter->id}/close-session", [
                'closing_cash_counted' => 4500.00,
                'notes' => '',
            ])
            ->assertSessionHas('error');

        $session->refresh();
        $this->assertSame('open', $session->status);

        // 3. Cashier CANNOT call Force Close endpoint (403 Forbidden)
        $this->actingAs($cashier)->withSession($sessionCtx)
            ->post("/counters/{$counter->id}/force-close-session", [
                'force_close_reason' => 'Trying to bypass',
            ])
            ->assertForbidden();

        // 4. Admin Force Closes forgotten shift with mandatory reason -> generates Z-Report + audit log
        $this->actingAs($owner)->withSession($sessionCtx)
            ->post("/counters/{$counter->id}/force-close-session", [
                'force_close_reason' => 'Cashier left early without closing terminal',
                'closing_cash_counted' => 4800.00,
            ])
            ->assertSessionHas('success')
            ->assertSessionHas('lastClosedSessionId', $session->id);

        $session->refresh();
        $this->assertSame('closed', $session->status);
        $this->assertTrue($session->is_force_closed);
        $this->assertSame('Cashier left early without closing terminal', $session->force_close_reason);
        $this->assertSame('-200.00', (string) $session->discrepancy);
        $this->assertSame('ZR-000001', $session->z_report_number);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'counter.shift_force_closed',
            'auditable_id' => (string) $session->id,
        ]);

        // 5. Closed shift is strictly immutable
        $this->expectException(\LogicException::class);
        $session->update(['closing_cash_counted' => 5000.00]);
    }
}
