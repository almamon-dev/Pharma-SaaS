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
use App\Services\SalesOrderService;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacPermissionCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class SalesOrderEnhancementTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private $tenant;
    private Branch $branch;
    private User $salesman;
    private User $manager;
    private User $cashier;
    private Counter $counter;
    private Medicine $napa;
    private MedicineBatch $batch1;
    private MedicineBatch $batch2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(RbacPermissionCatalogSeeder::class);

        $provisioning = app(TenantProvisioningService::class);
        $this->owner = User::factory()->create(['account_type' => 'admin']);
        $this->owner->setManagerPin('1234');
        $this->owner->save();

        $this->tenant = $provisioning->createTenantForUser($this->owner, [
            'name' => 'Apex Health Pharmacy',
            'plan_key' => 'growth',
        ]);
        $this->branch = $this->tenant->branches()->first();

        // Configure tenant settings: 2% salesman limit, 15% manager limit, 5% VAT
        $this->tenant->settings = [
            'discount_limits' => [
                'salesman' => 2.0,
                'senior_salesman' => 5.0,
                'manager' => 15.0,
                'admin' => 100.0,
            ],
            'tax_percentage' => 5.0,
        ];
        $this->tenant->save();

        app(CurrentTenant::class)->set($this->tenant);

        // Create Salesman
        $this->salesman = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $this->owner->id,
            'status' => 'active',
        ]);
        $this->tenant->users()->attach($this->salesman->id, [
            'branch_id' => $this->branch->id,
            'is_owner' => false,
            'role' => TenantRole::SALESMAN->value,
            'roles' => json_encode([TenantRole::SALESMAN->value]),
            'is_active' => true,
        ]);

        // Create Manager
        $this->manager = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $this->owner->id,
            'status' => 'active',
        ]);
        $this->tenant->users()->attach($this->manager->id, [
            'branch_id' => $this->branch->id,
            'is_owner' => false,
            'role' => TenantRole::MANAGER->value,
            'roles' => json_encode([TenantRole::MANAGER->value]),
            'is_active' => true,
        ]);

        // Create Cashier
        $this->cashier = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $this->owner->id,
            'status' => 'active',
        ]);
        $this->tenant->users()->attach($this->cashier->id, [
            'branch_id' => $this->branch->id,
            'is_owner' => false,
            'role' => TenantRole::CASHIER->value,
            'roles' => json_encode([TenantRole::CASHIER->value]),
            'is_active' => true,
        ]);

        // Create Counter & Active Session for Cashier
        $this->counter = Counter::query()->create([
            'tenant_id' => $this->tenant->id,
            'branch_id' => $this->branch->id,
            'code' => 'C-01',
            'name' => 'Main Dispensing Counter',
            'type' => 'regular',
            'status' => 'active',
            'current_user_id' => $this->cashier->id,
            'auto_assignment_enabled' => true,
            'max_queue_capacity' => 20,
            'is_active' => true,
        ]);

        CounterCashier::query()->create([
            'tenant_id' => $this->tenant->id,
            'branch_id' => $this->branch->id,
            'counter_id' => $this->counter->id,
            'user_id' => $this->cashier->id,
            'shift' => 'morning',
            'is_primary' => true,
            'is_active' => true,
        ]);

        CounterSession::query()->create([
            'tenant_id' => $this->tenant->id,
            'branch_id' => $this->branch->id,
            'counter_id' => $this->counter->id,
            'user_id' => $this->cashier->id,
            'opened_at' => now()->subHour(),
            'opening_float' => 1000,
            'status' => 'open',
            'shift' => 'morning',
        ]);

        // Seed Medicine with Batches
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $this->napa = Medicine::query()->create([
                'tenant_id' => $this->tenant->id,
                'name' => 'Napa Extra 500mg',
                'generic_name' => 'Paracetamol',
                'sku' => 'MED-NAPA-01',
                'barcode' => '894110020101',
                'dosage_form' => 'tablet',
                'strength' => '500mg',
                'unit' => 'tablet',
                'units_per_strip' => 10,
                'units_per_box' => 100,
                'requires_prescription' => false,
                'default_selling_price' => 3.00,
                'default_purchase_price' => 2.00,
                'is_active' => true,
            ]);

            // Batch 1 (FEFO: expires in 30 days)
            $this->batch1 = MedicineBatch::query()->create([
                'tenant_id' => $this->tenant->id,
                'branch_id' => $this->branch->id,
                'medicine_id' => $this->napa->id,
                'batch_number' => 'B-EARLY-30',
                'expiry_date' => now()->addDays(30),
                'quantity_received' => 200,
                'quantity_available' => 200,
                'selling_price' => 3.00,
                'purchase_price' => 2.00,
                'status' => 'active',
                'is_active' => true,
            ]);

            // Batch 2 (Later expiry: in 180 days)
            $this->batch2 = MedicineBatch::query()->create([
                'tenant_id' => $this->tenant->id,
                'branch_id' => $this->branch->id,
                'medicine_id' => $this->napa->id,
                'batch_number' => 'B-LATER-180',
                'expiry_date' => now()->addDays(180),
                'quantity_received' => 500,
                'quantity_available' => 500,
                'selling_price' => 3.00,
                'purchase_price' => 2.00,
                'status' => 'active',
                'is_active' => true,
            ]);
        });
    }

    public function test_quick_customer_creation_and_duplicate_prevention(): void
    {
        $domain = $this->tenant->primaryDomainName();

        // 1. Create a new patient customer
        $response = $this->actingAs($this->salesman)
            ->post("http://{$domain}/sales/customers/quick-store", [
                'name' => 'Mr. Kabir Hossain',
                'phone' => '01711223344',
                'customer_type' => 'patient',
                'allergies' => 'Penicillin allergy',
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('customer.name', 'Mr. Kabir Hossain');
        $response->assertJsonPath('customer.customer_type', 'patient');
        $response->assertJsonPath('is_existing', false);

        $customerId = $response->json('customer.id');
        $this->assertNotNull($customerId);

        // 2. Prevent duplicate: submit same phone again
        $dupResponse = $this->actingAs($this->salesman)
            ->post("http://{$domain}/sales/customers/quick-store", [
                'name' => 'Kabir H.',
                'phone' => '01711223344',
                'customer_type' => 'registered',
            ]);

        $dupResponse->assertStatus(200);
        $dupResponse->assertJsonPath('customer.id', $customerId);
        $dupResponse->assertJsonPath('is_existing', true);

        // Verify database only has 1 customer with that phone
        $count = Customer::withoutGlobalScopes()->where('tenant_id', $this->tenant->id)->where('phone', '01711223344')->count();
        $this->assertEquals(1, $count);
    }

    public function test_walk_in_customer_order_submission_with_fefo_and_counter_assignment(): void
    {
        $service = app(SalesOrderService::class);

        // Submit Walk-in order with 10 tablets of Napa
        $sale = $service->createSalesOrder(
            tenant: $this->tenant,
            branch: $this->branch,
            salesman: $this->salesman,
            validated: [
                'customer_id' => null,
                'notes' => 'Customer invoice note',
                'internal_notes' => 'Salesman internal remark for cashier',
                'discount' => 0,
                'discount_type' => 'fixed',
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'medicine_batch_id' => null, // FEFO auto-selection
                        'quantity' => 10,
                        'sale_unit' => 'piece',
                    ],
                ],
            ],
            isDraft: false
        );

        $this->assertEquals('assigned', $sale->order_status);
        $this->assertEquals($this->counter->id, $sale->counter_id);
        $this->assertEquals(30.00, (float) $sale->subtotal);

        // Check 5% VAT automatically applied (5% of 30.00 = 1.50)
        $this->assertEquals(1.50, (float) $sale->tax_amount);
        $this->assertEquals(31.50, (float) $sale->total_amount);

        // Verify FEFO auto-selected the earliest batch (Batch 1: B-EARLY-30)
        $item = $sale->items()->first();
        $this->assertEquals($this->batch1->id, $item->medicine_batch_id);

        // Verify internal notes separate from customer notes
        $this->assertEquals('Customer invoice note', $sale->notes);
        $this->assertEquals('Salesman internal remark for cashier', $sale->internal_notes);
    }

    public function test_insufficient_stock_prevents_order_submission(): void
    {
        $service = app(SalesOrderService::class);

        $this->expectException(ValidationException::class);

        // Total available stock is 200 + 500 = 700 tablets. Requesting 1000 tablets must fail.
        $service->createSalesOrder(
            tenant: $this->tenant,
            branch: $this->branch,
            salesman: $this->salesman,
            validated: [
                'customer_id' => null,
                'discount' => 0,
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'quantity' => 1000,
                        'sale_unit' => 'piece',
                    ],
                ],
            ],
            isDraft: false
        );
    }

    public function test_expired_batch_is_rejected(): void
    {
        $service = app(SalesOrderService::class);

        $expiredBatch = null;
        app(CurrentTenant::class)->run($this->tenant, function () use (&$expiredBatch): void {
            $expiredBatch = MedicineBatch::query()->create([
                'tenant_id' => $this->tenant->id,
                'branch_id' => $this->branch->id,
                'medicine_id' => $this->napa->id,
                'batch_number' => 'B-EXPIRED-OLD',
                'expiry_date' => now()->subDay(),
                'quantity_received' => 100,
                'quantity_available' => 100,
                'selling_price' => 3.00,
                'purchase_price' => 2.00,
                'status' => 'available',
                'is_active' => true,
            ]);
        });

        $this->expectException(ValidationException::class);

        $service->createSalesOrder(
            tenant: $this->tenant,
            branch: $this->branch,
            salesman: $this->salesman,
            validated: [
                'customer_id' => null,
                'discount' => 0,
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'medicine_batch_id' => $expiredBatch->id,
                        'quantity' => 5,
                        'sale_unit' => 'piece',
                    ],
                ],
            ],
            isDraft: false
        );
    }

    public function test_salesman_discount_within_limit_auto_approved(): void
    {
        $service = app(SalesOrderService::class);

        // Salesman has 2% limit. Subtotal = 100, Discount = 2% (2.00).
        $sale = $service->createSalesOrder(
            tenant: $this->tenant,
            branch: $this->branch,
            salesman: $this->salesman,
            validated: [
                'customer_id' => null,
                'discount' => 2.0,
                'discount_type' => 'percent',
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'quantity' => 50, // 50 * 3.00 = 150.00
                        'sale_unit' => 'piece',
                    ],
                ],
            ],
            isDraft: false
        );

        $this->assertEquals('approved', $sale->discount_status);
        $this->assertEquals($this->salesman->id, $sale->discount_approved_by);
        $this->assertNotNull($sale->discount_approved_at);
        $this->assertEquals(3.00, (float) $sale->discount_amount);
    }

    public function test_salesman_discount_exceeding_limit_requires_manager_approval(): void
    {
        $service = app(SalesOrderService::class);

        // Salesman requests 10% discount, exceeding their 2% limit.
        $sale = $service->createSalesOrder(
            tenant: $this->tenant,
            branch: $this->branch,
            salesman: $this->salesman,
            validated: [
                'customer_id' => null,
                'discount' => 10.0,
                'discount_type' => 'percent',
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'quantity' => 10, // 30.00
                        'sale_unit' => 'piece',
                    ],
                ],
            ],
            isDraft: false
        );

        $this->assertEquals('pending_approval', $sale->discount_status);
        $this->assertEquals($this->salesman->id, $sale->discount_requested_by);
        $this->assertNull($sale->discount_approved_by);

        // Now Manager approves the discount
        $approvedSale = $service->approveDiscount($sale, $this->manager);
        $this->assertEquals('approved', $approvedSale->discount_status);
        $this->assertEquals($this->manager->id, $approvedSale->discount_approved_by);
        $this->assertNotNull($approvedSale->discount_approved_at);

        // Or Manager can reject
        $rejectedSale = $service->rejectDiscount($approvedSale, $this->manager, 'Discount too high for this item.');
        $this->assertEquals('rejected', $rejectedSale->discount_status);
        $this->assertEquals('Discount too high for this item.', $rejectedSale->discount_rejection_reason);
    }

    public function test_draft_order_save_resume_and_delete(): void
    {
        $service = app(SalesOrderService::class);

        // 1. Save as draft
        $draft = $service->createSalesOrder(
            tenant: $this->tenant,
            branch: $this->branch,
            salesman: $this->salesman,
            validated: [
                'customer_id' => null,
                'discount' => 0,
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'quantity' => 15,
                        'sale_unit' => 'piece',
                    ],
                ],
            ],
            isDraft: true
        );

        $this->assertEquals('draft', $draft->order_status);
        $this->assertNull($draft->counter_id); // Must not assign counter
        $this->assertEquals(0, $draft->paid_amount);

        // 2. Resume and update draft into submitted order
        $submitted = $service->createSalesOrder(
            tenant: $this->tenant,
            branch: $this->branch,
            salesman: $this->salesman,
            validated: [
                'draft_id' => $draft->id,
                'customer_id' => null,
                'discount' => 0,
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'quantity' => 20,
                        'sale_unit' => 'piece',
                    ],
                ],
            ],
            isDraft: false
        );

        $this->assertEquals($draft->id, $submitted->id);
        $this->assertEquals('assigned', $submitted->order_status);
        $this->assertEquals($this->counter->id, $submitted->counter_id);

        // 3. Create another draft and delete it
        $draft2 = $service->createSalesOrder(
            tenant: $this->tenant,
            branch: $this->branch,
            salesman: $this->salesman,
            validated: [
                'customer_id' => null,
                'discount' => 0,
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'quantity' => 5,
                        'sale_unit' => 'piece',
                    ],
                ],
            ],
            isDraft: true
        );

        $service->deleteDraft($draft2, $this->salesman);
        $this->assertNull(Sale::withoutGlobalScopes()->find($draft2->id));
    }

    public function test_unassigned_queue_when_no_counter_available(): void
    {
        // Set all counters offline
        Counter::query()->where('tenant_id', $this->tenant->id)->update(['status' => 'offline']);

        $service = app(SalesOrderService::class);

        $sale = $service->createSalesOrder(
            tenant: $this->tenant,
            branch: $this->branch,
            salesman: $this->salesman,
            validated: [
                'customer_id' => null,
                'discount' => 0,
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'quantity' => 5,
                        'sale_unit' => 'piece',
                    ],
                ],
            ],
            isDraft: false
        );

        $this->assertEquals('unassigned', $sale->order_status);
        $this->assertNull($sale->counter_id);
    }

    public function test_salesman_can_view_create_order_page_with_props(): void
    {
        $domain = $this->tenant->primaryDomainName();

        $response = $this->actingAs($this->salesman)
            ->get("http://{$domain}/sales/orders/create");

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Sales/CreateOrder')
            ->has('medicines')
            ->has('customers')
            ->has('customerTypes')
            ->where('permittedDiscountLimit', fn ($v) => (float) $v === 2.0)
            ->where('taxPercentage', fn ($v) => (float) $v === 5.0)
        );
    }

    public function test_salesman_can_submit_order_via_http_post(): void
    {
        $domain = $this->tenant->primaryDomainName();

        $response = $this->actingAs($this->salesman)
            ->post("http://{$domain}/sales/orders", [
                'customer_id' => null,
                'doctor_name' => 'Dr. Ahmed Kabir',
                'prescription_reference' => 'RX-2026-99',
                'prescription_notes' => 'Take 1 tablet after meals',
                'notes' => 'Customer note',
                'internal_notes' => 'Salesman internal note',
                'discount' => 0,
                'discount_type' => 'fixed',
                'is_draft' => false,
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'quantity' => 2,
                        'sale_unit' => 'piece',
                    ],
                ],
            ]);

        $response->assertRedirect(route('sales.orders.my-orders'));

        $sale = Sale::withoutGlobalScopes()->where('tenant_id', $this->tenant->id)->latest('id')->first();
        $this->assertNotNull($sale);
        $this->assertEquals('Dr. Ahmed Kabir', $sale->doctor_name);
        $this->assertEquals('RX-2026-99', $sale->prescription_reference);
        $this->assertEquals('Salesman internal note', $sale->internal_notes);
        $this->assertEquals('Customer note', $sale->notes);
        $this->assertEquals('assigned', $sale->order_status);
        $this->assertEquals($this->counter->id, $sale->counter_id);
    }

    public function test_salesman_can_save_draft_and_delete_it_via_http(): void
    {
        $domain = $this->tenant->primaryDomainName();

        // 1. Submit as draft
        $response = $this->actingAs($this->salesman)
            ->post("http://{$domain}/sales/orders", [
                'customer_id' => null,
                'is_draft' => true,
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'quantity' => 2,
                        'sale_unit' => 'piece',
                    ],
                ],
            ]);

        $response->assertRedirect(route('sales.orders.my-orders'));

        $draft = Sale::withoutGlobalScopes()->where('tenant_id', $this->tenant->id)->where('order_status', 'draft')->latest('id')->first();
        $this->assertNotNull($draft);
        $this->assertEquals('draft', $draft->order_status);
        $this->assertNull($draft->counter_id);

        // 2. Delete the draft
        $delResponse = $this->actingAs($this->salesman)
            ->delete("http://{$domain}/sales/orders/{$draft->id}/draft");

        $delResponse->assertRedirect();
        $this->assertNull(Sale::withoutGlobalScopes()->find($draft->id));
    }

    public function test_manager_can_approve_and_reject_discount_via_http(): void
    {
        $domain = $this->tenant->primaryDomainName();

        // Create an order with over-limit discount
        $service = app(SalesOrderService::class);
        $sale = $service->createSalesOrder(
            tenant: $this->tenant,
            branch: $this->branch,
            salesman: $this->salesman,
            validated: [
                'customer_id' => null,
                'discount' => 10.0,
                'discount_type' => 'percent',
                'items' => [
                    [
                        'medicine_id' => $this->napa->id,
                        'quantity' => 10,
                        'sale_unit' => 'piece',
                    ],
                ],
            ],
            isDraft: false
        );

        $this->assertEquals('pending_approval', $sale->discount_status);

        // Manager approves discount
        $approveRes = $this->actingAs($this->manager)
            ->post("http://{$domain}/sales/orders/{$sale->id}/approve-discount");

        $approveRes->assertRedirect();
        $this->assertEquals('approved', $sale->fresh()->discount_status);
        $this->assertEquals($this->manager->id, $sale->fresh()->discount_approved_by);

        // Manager rejects discount
        $rejectRes = $this->actingAs($this->manager)
            ->post("http://{$domain}/sales/orders/{$sale->id}/reject-discount", [
                'reason' => 'Rate not approved by owner',
            ]);

        $rejectRes->assertRedirect();
        $this->assertEquals('rejected', $sale->fresh()->discount_status);
        $this->assertEquals('Rate not approved by owner', $sale->fresh()->discount_rejection_reason);
    }
}
