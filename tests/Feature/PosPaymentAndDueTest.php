<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\User;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PosPaymentAndDueTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    public function test_pos_split_mixed_payments_records_payments_and_clears_due(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Popular Pharmacy POS',
            'plan_key' => 'growth',
        ]);

        [$branch, $medicine, $customer] = app(CurrentTenant::class)->run($tenant, function () use ($tenant) {
            $branch = $tenant->branches()->first();

            $medicine = Medicine::query()->create([
                'name' => 'Napa Extra 500mg',
                'sku' => 'NAPA-EXT-01',
                'dosage_form' => 'tablet',
                'unit' => 'piece',
                'units_per_strip' => 10,
                'units_per_box' => 100,
                'default_purchase_price' => 2.00,
                'default_selling_price' => 3.00,
                'is_active' => true,
            ]);

            MedicineBatch::query()->create([
                'branch_id' => $branch->id,
                'medicine_id' => $medicine->id,
                'batch_number' => 'B-MIX-01',
                'quantity_received' => 100,
                'quantity_available' => 100,
                'purchase_price' => 2.00,
                'selling_price' => 3.00,
                'expiry_date' => now()->addMonths(12)->toDateString(),
                'status' => BatchStatus::ACTIVE->value,
            ]);

            $customer = Customer::query()->create([
                'name' => 'Tariqul Islam',
                'phone' => '01711223344',
            ]);

            return [$branch, $medicine, $customer];
        });

        // 10 pieces @ 3.00 = 30.00 total.
        // Pay 20.00 via Cash + 10.00 via bKash.
        $response = $this->actingAs($owner)
            ->withSession(['current_tenant_id' => $tenant->id, 'current_branch_id' => $branch->id])
            ->post(route('pos.checkout'), [
                'customer_id' => $customer->id,
                'payment_method' => 'mixed',
                'payments' => [
                    ['method' => 'cash', 'amount' => 20.00],
                    ['method' => 'bkash', 'amount' => 10.00, 'reference_number' => 'TRX778899'],
                ],
                'items' => [
                    [
                        'medicine_id' => $medicine->id,
                        'quantity' => 10,
                        'sale_unit' => 'piece',
                    ],
                ],
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $sale = Sale::query()->latest('id')->first();
        $this->assertNotNull($sale);
        $this->assertEquals(30.00, (float) $sale->total_amount);
        $this->assertEquals(30.00, (float) $sale->paid_amount);
        $this->assertEquals(0.00, (float) $sale->due_amount);
        $this->assertEquals('paid', $sale->payment_status);

        // Verify sale_payments table records
        $payments = SalePayment::query()->where('sale_id', $sale->id)->get();
        $this->assertCount(2, $payments);
        $this->assertTrue($payments->contains('payment_method', 'cash'));
        $this->assertTrue($payments->contains('payment_method', 'bkash'));

        $bkashPayment = $payments->firstWhere('payment_method', 'bkash');
        $this->assertEquals('TRX778899', $bkashPayment->reference_number);
        $this->assertEquals(10.00, (float) $bkashPayment->amount);
    }

    public function test_pos_due_credit_sale_increases_customer_due(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Sheba Pharmacy Dues',
            'plan_key' => 'growth',
        ]);

        [$branch, $medicine, $customer] = app(CurrentTenant::class)->run($tenant, function () use ($tenant) {
            $branch = $tenant->branches()->first();

            $medicine = Medicine::query()->create([
                'name' => 'Sergel 20mg',
                'sku' => 'SERGEL-20',
                'dosage_form' => 'capsule',
                'unit' => 'piece',
                'units_per_strip' => 10,
                'units_per_box' => 100,
                'default_purchase_price' => 5.00,
                'default_selling_price' => 7.00,
                'is_active' => true,
            ]);

            MedicineBatch::query()->create([
                'branch_id' => $branch->id,
                'medicine_id' => $medicine->id,
                'batch_number' => 'B-SERGEL-01',
                'quantity_received' => 100,
                'quantity_available' => 100,
                'purchase_price' => 5.00,
                'selling_price' => 7.00,
                'expiry_date' => now()->addMonths(12)->toDateString(),
                'status' => BatchStatus::ACTIVE->value,
            ]);

            $customer = Customer::query()->create([
                'name' => 'Kamal Hossain',
                'phone' => '01888999000',
            ]);

            return [$branch, $medicine, $customer];
        });

        // 10 capsules @ 7.00 = 70.00 total.
        // Paid 20.00 now via cash, Due = 50.00
        $response = $this->actingAs($owner)
            ->withSession(['current_tenant_id' => $tenant->id, 'current_branch_id' => $branch->id])
            ->post(route('pos.checkout'), [
                'customer_id' => $customer->id,
                'payment_method' => 'cash',
                'paid_amount' => 20.00,
                'items' => [
                    [
                        'medicine_id' => $medicine->id,
                        'quantity' => 10,
                        'sale_unit' => 'piece',
                    ],
                ],
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $sale = Sale::query()->latest('id')->first();
        $this->assertEquals(70.00, (float) $sale->total_amount);
        $this->assertEquals(20.00, (float) $sale->paid_amount);
        $this->assertEquals(50.00, (float) $sale->due_amount);
        $this->assertEquals('partial', $sale->payment_status);

        // Verify customer total due
        $customerDue = (float) Sale::query()->where('customer_id', $customer->id)->sum('due_amount');
        $this->assertEquals(50.00, $customerDue);
    }

    public function test_pos_due_sale_without_customer_is_rejected(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Trust Pharmacy Test',
            'plan_key' => 'growth',
        ]);

        [$branch, $medicine] = app(CurrentTenant::class)->run($tenant, function () use ($tenant) {
            $branch = $tenant->branches()->first();

            $medicine = Medicine::query()->create([
                'name' => 'Ace Plus',
                'sku' => 'ACE-PLUS',
                'dosage_form' => 'tablet',
                'unit' => 'piece',
                'units_per_strip' => 10,
                'units_per_box' => 100,
                'default_purchase_price' => 2.00,
                'default_selling_price' => 3.50,
                'is_active' => true,
            ]);

            MedicineBatch::query()->create([
                'branch_id' => $branch->id,
                'medicine_id' => $medicine->id,
                'batch_number' => 'B-ACE-01',
                'quantity_received' => 100,
                'quantity_available' => 100,
                'purchase_price' => 2.00,
                'selling_price' => 3.50,
                'expiry_date' => now()->addMonths(12)->toDateString(),
                'status' => BatchStatus::ACTIVE->value,
            ]);

            return [$branch, $medicine];
        });

        // Try to checkout on credit/due WITHOUT a registered customer
        $response = $this->actingAs($owner)
            ->withSession(['current_tenant_id' => $tenant->id, 'current_branch_id' => $branch->id])
            ->post(route('pos.checkout'), [
                'customer_id' => null,
                'payment_method' => 'cash',
                'paid_amount' => 0.00,
                'items' => [
                    [
                        'medicine_id' => $medicine->id,
                        'quantity' => 5,
                        'sale_unit' => 'piece',
                    ],
                ],
            ]);

        $response->assertStatus(422);
    }

    public function test_pos_cash_payment_with_excess_amount_calculates_change(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Change Test Pharmacy',
            'plan_key' => 'growth',
        ]);

        [$branch, $medicine] = app(CurrentTenant::class)->run($tenant, function () use ($tenant) {
            $branch = $tenant->branches()->first();

            $medicine = Medicine::query()->create([
                'name' => 'Paracetamol 500mg',
                'sku' => 'PARA-500',
                'dosage_form' => 'tablet',
                'unit' => 'piece',
                'units_per_strip' => 10,
                'units_per_box' => 100,
                'default_purchase_price' => 1.00,
                'default_selling_price' => 1.50,
                'is_active' => true,
            ]);

            MedicineBatch::query()->create([
                'branch_id' => $branch->id,
                'medicine_id' => $medicine->id,
                'batch_number' => 'B-PARA-01',
                'quantity_received' => 100,
                'quantity_available' => 100,
                'purchase_price' => 1.00,
                'selling_price' => 1.50,
                'expiry_date' => now()->addMonths(12)->toDateString(),
                'status' => BatchStatus::ACTIVE->value,
            ]);

            return [$branch, $medicine];
        });

        // 10 tablets @ 1.50 = 15.00 total. Customer hands 50.00 cash -> 35.00 change
        $response = $this->actingAs($owner)
            ->withSession(['current_tenant_id' => $tenant->id, 'current_branch_id' => $branch->id])
            ->post(route('pos.checkout'), [
                'payment_method' => 'cash',
                'paid_amount' => 50.00,
                'items' => [
                    [
                        'medicine_id' => $medicine->id,
                        'quantity' => 10,
                        'sale_unit' => 'piece',
                    ],
                ],
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $sale = Sale::query()->latest('id')->first();
        $this->assertEquals(15.00, (float) $sale->total_amount);
        $this->assertEquals(15.00, (float) $sale->paid_amount);
        $this->assertEquals(0.00, (float) $sale->due_amount);
        $this->assertEquals(35.00, (float) $sale->change_amount);
        $this->assertEquals('paid', $sale->payment_status);
    }
}
