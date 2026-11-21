<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\StockMovementType;
use App\Enums\TenantRole;
use App\Models\Branch;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\MedicineCategory;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Scopes\TenantScope;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class InventoryBatchControlTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    public function test_owner_edits_medicine_dual_pricing_creates_categories_and_isolates_across_tenants(): void
    {
        $provisioning = app(TenantProvisioningService::class);

        $ownerA = User::factory()->create(['account_type' => 'admin']);
        $tenantA = $provisioning->createTenantForUser($ownerA, [
            'name' => 'Alpha Care Pharmacy',
            'plan_key' => 'growth',
        ]);

        $ownerB = User::factory()->create(['account_type' => 'admin']);
        $provisioning->createTenantForUser($ownerB, [
            'name' => 'Beta Health Pharmacy',
            'plan_key' => 'growth',
        ]);

        // Owner A creates a category and adds a box-priced medicine
        $this->actingAs($ownerA)
            ->post('/inventory/categories', [
                'name' => 'Cardiology',
                'description' => 'Cardiac & antihypertensive therapy',
            ])
            ->assertRedirect();

        $category = MedicineCategory::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenantA->id)
            ->where('slug', 'cardiology')
            ->firstOrFail();

        $this->actingAs($ownerA)
            ->post('/inventory', [
                'name' => 'Amlocard 5mg',
                'generic_name' => 'Amlodipine',
                'manufacturer' => 'Square',
                'sku' => 'AMLO-05',
                'category_id' => $category->id,
                'dosage_form' => 'tablet',
                'strength' => '5mg',
                'unit' => 'tablet',
                'units_per_strip' => 10,
                'units_per_box' => 10,
                'reorder_level' => 20,
                'requires_prescription' => false,
                'box_purchase_price' => 100.00,
                'box_selling_price' => 150.00,
            ])
            ->assertRedirect();

        $medicine = Medicine::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenantA->id)
            ->where('sku', 'AMLO-05')
            ->firstOrFail();

        $this->assertSame(10.0, (float) $medicine->default_purchase_price);
        $this->assertSame(15.0, (float) $medicine->default_selling_price);

        // Owner A edits catalog details, box pack ratio & pricing via PUT
        $this->actingAs($ownerA)
            ->put("/inventory/{$medicine->id}", [
                'name' => 'Amlocard Plus 5mg',
                'generic_name' => 'Amlodipine Besilate',
                'manufacturer' => 'Square Pharma',
                'sku' => 'AMLO-05',
                'barcode' => $medicine->barcode,
                'category_id' => $category->id,
                'dosage_form' => 'tablet',
                'strength' => '5mg',
                'description' => 'Updated storage guidelines: keep below 25C.',
                'unit' => 'tablet',
                'units_per_strip' => 10,
                'units_per_box' => 20,
                'reorder_level' => 50,
                'requires_prescription' => true,
                'box_purchase_price' => 240.00,
                'box_selling_price' => 320.00,
            ])
            ->assertRedirect();

        $medicine->refresh();
        $this->assertSame('Amlocard Plus 5mg', $medicine->name);
        $this->assertSame(20, (int) $medicine->units_per_box);
        $this->assertSame(12.0, (float) $medicine->default_purchase_price);
        $this->assertSame(16.0, (float) $medicine->default_selling_price);
        $this->assertSame(320.0, (float) $medicine->box_selling_price);
        $this->assertTrue((bool) $medicine->requires_prescription);

        // Strict tenant isolation: Owner B receives 404 on Tenant A medicine endpoints
        $this->actingAs($ownerB)->get("/inventory/{$medicine->id}/batches")->assertNotFound();
        $this->actingAs($ownerB)->put("/inventory/{$medicine->id}", [
            'name' => 'Hijacked',
            'sku' => 'AMLO-05',
            'dosage_form' => 'tablet',
            'unit' => 'tablet',
            'reorder_level' => 10,
            'purchase_price' => 1,
            'selling_price' => 2,
        ])->assertNotFound();
        $this->actingAs($ownerB)->patch("/inventory/{$medicine->id}/toggle")->assertNotFound();
        $this->actingAs($ownerB)->post("/inventory/{$medicine->id}/batches", [
            'batch_number' => 'B-UNAUTH',
            'quantity' => 10,
            'expiry_date' => now()->addMonths(6)->toDateString(),
        ])->assertNotFound();
    }

    public function test_restock_batch_creates_opening_and_restock_movements_and_validates_duplicates_and_expiry(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Metro Care Pharmacy',
            'plan_key' => 'growth',
        ]);

        // Create medicine with opening stock batch
        $this->actingAs($owner)
            ->post('/inventory', [
                'name' => 'Napa Extend 665mg',
                'sku' => 'NAPA-EXT',
                'dosage_form' => 'tablet',
                'unit' => 'tablet',
                'units_per_strip' => 12,
                'units_per_box' => 120,
                'reorder_level' => 30,
                'requires_prescription' => false,
                'purchase_price' => 1.50,
                'selling_price' => 2.00,
                'batch_number' => 'BATCH-OPEN',
                'quantity' => 50,
                'expiry_date' => now()->addMonths(8)->toDateString(),
                'rack_location' => 'R-01',
            ])
            ->assertRedirect();

        $medicine = Medicine::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenant->id)
            ->where('sku', 'NAPA-EXT')
            ->firstOrFail();

        $this->assertDatabaseHas('stock_movements', [
            'tenant_id' => $tenant->id,
            'medicine_id' => $medicine->id,
            'movement_type' => StockMovementType::OPENING->value,
            'quantity_change' => 50,
            'balance_before' => 0,
            'balance_after' => 50,
            'unit_cost' => 1.50,
            'total_cost' => 75.00,
        ]);

        // Add restock batch via dedicated endpoint
        $this->actingAs($owner)
            ->post("/inventory/{$medicine->id}/batches", [
                'batch_number' => 'BATCH-NEW-01',
                'quantity' => 30,
                'expiry_date' => now()->addDays(45)->toDateString(),
                'purchase_price' => 1.75,
                'selling_price' => 2.25,
                'rack_location' => 'R-02',
                'notes' => 'Emergency replenishment shipment',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('stock_movements', [
            'tenant_id' => $tenant->id,
            'medicine_id' => $medicine->id,
            'movement_type' => StockMovementType::RESTOCK->value,
            'quantity_change' => 30,
            'balance_before' => 0,
            'balance_after' => 30,
            'unit_cost' => 1.75,
            'total_cost' => 52.50,
        ]);

        // Duplicate batch number in same branch is rejected cleanly
        $this->actingAs($owner)
            ->post("/inventory/{$medicine->id}/batches", [
                'batch_number' => 'BATCH-NEW-01',
                'quantity' => 10,
                'expiry_date' => now()->addMonths(6)->toDateString(),
            ])
            ->assertSessionHasErrors('batch_number');

        // Past expiry date is rejected cleanly on restock intake
        $this->actingAs($owner)
            ->post("/inventory/{$medicine->id}/batches", [
                'batch_number' => 'BATCH-PAST',
                'quantity' => 10,
                'expiry_date' => now()->subDays(1)->toDateString(),
            ])
            ->assertSessionHasErrors('expiry_date');

        // JSON Inspector returns FEFO-ordered batches and movements
        $this->actingAs($owner)
            ->getJson("/inventory/{$medicine->id}/batches")
            ->assertOk()
            ->assertJsonPath('medicine.id', $medicine->id)
            ->assertJsonCount(2, 'batches')
            ->assertJsonPath('batches.0.batch_number', 'BATCH-NEW-01')
            ->assertJsonPath('batches.1.batch_number', 'BATCH-OPEN')
            ->assertJsonCount(2, 'movements');

        // Dedicated Inventory/Batches and Inventory/Movements Inertia views render cleanly
        $this->actingAs($owner)
            ->get('/inventory/batches')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Inventory/Batches')
                ->where('summary.activeBatches', 2)
                ->where('summary.expiring60', 1)
                ->where('summary.expiredCount', 0)
            );

        $this->actingAs($owner)
            ->get('/inventory/movements')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Inventory/Movements')
                ->where('summary.totalRecords', 2)
                ->where('summary.inboundUnits', 80)
            );
    }

    public function test_batch_adjustments_damage_expiry_disposal_and_permission_enforcement(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Integrity Meds',
            'plan_key' => 'growth',
        ]);
        $branch = Branch::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        /** @var array{0: Medicine, 1: MedicineBatch, 2: MedicineBatch} $fixtures */
        [$medicine, $activeBatch, $expiredBatch] = app(CurrentTenant::class)->run($tenant, function () use ($tenant, $branch): array {
            $medicine = Medicine::create([
                'tenant_id' => $tenant->id,
                'name' => 'Seclo 20mg',
                'sku' => 'SECLO-20',
                'dosage_form' => 'capsule',
                'unit' => 'capsule',
                'units_per_strip' => 10,
                'units_per_box' => 100,
                'reorder_level' => 15,
                'default_purchase_price' => 3.50,
                'default_selling_price' => 5.00,
                'is_active' => true,
            ]);

            $activeBatch = MedicineBatch::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'medicine_id' => $medicine->id,
                'batch_number' => 'BATCH-ADJ',
                'expiry_date' => now()->addMonths(4)->toDateString(),
                'quantity_received' => 25,
                'quantity_available' => 25,
                'purchase_price' => 3.50,
                'selling_price' => 5.00,
                'status' => BatchStatus::ACTIVE->value,
            ]);

            $expiredBatch = MedicineBatch::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'medicine_id' => $medicine->id,
                'batch_number' => 'BATCH-EXP',
                'expiry_date' => now()->subDays(5)->toDateString(),
                'quantity_received' => 12,
                'quantity_available' => 12,
                'purchase_price' => 3.50,
                'selling_price' => 5.00,
                'status' => BatchStatus::ACTIVE->value,
            ]);

            return [$medicine, $activeBatch, $expiredBatch];
        });

        // Custom role WITHOUT 'inventory.adjust' can view batches & restock, but is 403 blocked from adjustments/disposal
        $this->actingAs($owner)->post('/team/roles', [
            'name' => 'Catalog Assistant',
            'description' => 'Can view and restock but cannot adjust/dispose',
            'permissions' => ['inventory.view', 'inventory.manage'],
        ])->assertRedirect();

        $this->actingAs($owner)->post('/team', [
            'name' => 'Nabil Staff',
            'email' => 'nabil@integrity.test',
            'tenant_id' => $tenant->id,
            'roles' => ['catalog_assistant'],
        ])->assertRedirect();

        $catalogStaff = User::where('email', 'nabil@integrity.test')->firstOrFail();

        // Cashier has neither inventory view nor adjust
        $cashier = User::factory()->create([
            'account_type' => 'staff',
            'subscriber_id' => $owner->id,
            'current_tenant_id' => $tenant->id,
        ]);
        $tenant->users()->attach($cashier->id, [
            'role' => TenantRole::CASHIER->value,
            'roles' => json_encode([TenantRole::CASHIER->value]),
            'is_active' => true,
            'joined_at' => now(),
        ]);

        $this->actingAs($catalogStaff)->get('/inventory/batches')->assertOk();
        $this->actingAs($catalogStaff)->post("/inventory/batches/{$activeBatch->id}/adjust", [
            'adjustment_type' => StockMovementType::DAMAGE->value,
            'quantity' => 1,
            'reason' => 'Unauthorized',
        ])->assertForbidden();

        $this->actingAs($cashier)->get('/inventory/batches')->assertForbidden();
        $this->actingAs($cashier)->get('/inventory/movements')->assertForbidden();
        $this->actingAs($cashier)->post("/inventory/batches/{$activeBatch->id}/adjust", [
            'adjustment_type' => StockMovementType::DAMAGE->value,
            'quantity' => 1,
            'reason' => 'Unauthorized',
        ])->assertForbidden();

        // Owner performs positive adjustment (+5), damage write-off (-4), and full expiry disposal
        $this->actingAs($owner)
            ->post("/inventory/batches/{$activeBatch->id}/adjust", [
                'adjustment_type' => StockMovementType::ADJUSTMENT_IN->value,
                'quantity' => 5,
                'reason' => 'Shelf physical count recount surplus',
            ])
            ->assertRedirect();

        $activeBatch->refresh();
        $this->assertSame(30, (int) $activeBatch->quantity_available);

        $this->actingAs($owner)
            ->post("/inventory/batches/{$activeBatch->id}/adjust", [
                'adjustment_type' => StockMovementType::DAMAGE->value,
                'quantity' => 4,
                'reason' => 'Blister strips crushed during delivery',
            ])
            ->assertRedirect();

        $activeBatch->refresh();
        $this->assertSame(26, (int) $activeBatch->quantity_available);

        $this->assertDatabaseHas('stock_movements', [
            'medicine_batch_id' => $activeBatch->id,
            'movement_type' => StockMovementType::DAMAGE->value,
            'quantity_change' => -4,
            'balance_before' => 30,
            'balance_after' => 26,
            'reason' => 'Blister strips crushed during delivery',
        ]);

        // Over-deduction beyond available stock fails validation and keeps balance intact
        $this->actingAs($owner)
            ->post("/inventory/batches/{$activeBatch->id}/adjust", [
                'adjustment_type' => StockMovementType::ADJUSTMENT_OUT->value,
                'quantity' => 100,
                'reason' => 'Over deduction attempt',
            ])
            ->assertSessionHasErrors('quantity');
        $this->assertSame(26, (int) $activeBatch->fresh()->quantity_available);

        // Positive shelf adjustment on expired batch is blocked
        $this->actingAs($owner)
            ->post("/inventory/batches/{$expiredBatch->id}/adjust", [
                'adjustment_type' => StockMovementType::ADJUSTMENT_IN->value,
                'quantity' => 5,
                'reason' => 'Cannot re-add to expired',
            ])
            ->assertSessionHasErrors('quantity');

        // Full expiry disposal marks batch disposed, zeroes available qty, and writes immutable ledger record
        $this->actingAs($owner)
            ->post("/inventory/batches/{$expiredBatch->id}/adjust", [
                'adjustment_type' => StockMovementType::EXPIRY_DISPOSAL->value,
                'dispose_entire_batch' => true,
                'quantity' => 0,
                'reason' => 'Quarantined expired batch destroyed per protocol',
            ])
            ->assertRedirect();

        $expiredBatch->refresh();
        $this->assertSame(0, (int) $expiredBatch->quantity_available);
        $this->assertSame(BatchStatus::DISPOSED->value, $expiredBatch->status);
        $this->assertSame($owner->id, (int) $expiredBatch->disposed_by);
        $this->assertSame('Quarantined expired batch destroyed per protocol', $expiredBatch->disposal_reason);

        $this->assertDatabaseHas('stock_movements', [
            'medicine_batch_id' => $expiredBatch->id,
            'movement_type' => StockMovementType::EXPIRY_DISPOSAL->value,
            'quantity_change' => -12,
            'balance_before' => 12,
            'balance_after' => 0,
        ]);

        // Re-adjusting an already fully written-off batch fails validation
        $this->actingAs($owner)
            ->post("/inventory/batches/{$expiredBatch->id}/adjust", [
                'adjustment_type' => StockMovementType::EXPIRY_DISPOSAL->value,
                'dispose_entire_batch' => true,
                'quantity' => 0,
                'reason' => 'Double disposal attempt',
            ])
            ->assertSessionHasErrors('quantity');
    }

    public function test_expired_and_cross_branch_batches_are_blocked_at_pos_while_valid_sale_records_stock_movement(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'MultiBranch Integrity',
            'plan_key' => 'growth',
        ]);

        $branchA = Branch::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        $this->actingAs($owner)
            ->post('/branches', [
                'name' => 'Uttara Sector 7',
                'code' => 'UT-02',
                'phone' => '+8801711000002',
            ])
            ->assertRedirect();

        $branchB = Branch::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenant->id)
            ->where('code', 'UT-02')
            ->firstOrFail();

        /** @var array{0: Medicine, 1: MedicineBatch, 2: MedicineBatch} $fixtures */
        [$medicine, $expiredBranchABatch, $validBranchBBatch] = app(CurrentTenant::class)->run($tenant, function () use ($tenant, $branchA, $branchB): array {
            $medicine = Medicine::create([
                'tenant_id' => $tenant->id,
                'name' => 'Fexo 120mg',
                'sku' => 'FEXO-120',
                'dosage_form' => 'tablet',
                'unit' => 'tablet',
                'units_per_strip' => 10,
                'units_per_box' => 100,
                'reorder_level' => 10,
                'default_purchase_price' => 8.00,
                'default_selling_price' => 12.00,
                'is_active' => true,
            ]);

            // Expired batch sits in Branch A while valid batch sits in Branch B
            $expiredBranchABatch = MedicineBatch::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branchA->id,
                'medicine_id' => $medicine->id,
                'batch_number' => 'EXP-BR-A',
                'expiry_date' => now()->subDays(2)->toDateString(),
                'quantity_received' => 20,
                'quantity_available' => 20,
                'purchase_price' => 8.00,
                'selling_price' => 12.00,
                'status' => BatchStatus::ACTIVE->value,
            ]);

            $validBranchBBatch = MedicineBatch::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $branchB->id,
                'medicine_id' => $medicine->id,
                'batch_number' => 'VALID-BR-B',
                'expiry_date' => now()->addMonths(6)->toDateString(),
                'quantity_received' => 40,
                'quantity_available' => 40,
                'purchase_price' => 8.00,
                'selling_price' => 12.00,
                'status' => BatchStatus::ACTIVE->value,
            ]);

            return [$medicine, $expiredBranchABatch, $validBranchBBatch];
        });

        // Switch session explicitly to Branch A and attempt POS sale: must reject 422!
        $this->actingAs($owner)
            ->post('/branch/switch', ['branch_id' => $branchA->id])
            ->assertRedirect();

        $this->actingAs($owner)
            ->post('/pos/checkout', [
                'payment_method' => 'cash',
                'items' => [
                    ['medicine_id' => $medicine->id, 'quantity' => 1, 'sale_unit' => 'piece'],
                ],
            ])
            ->assertStatus(422);

        $this->assertSame(20, (int) $expiredBranchABatch->fresh()->quantity_available);
        $this->assertSame(40, (int) $validBranchBBatch->fresh()->quantity_available);

        // Add sellable batch to Branch A
        $validBranchABatch = app(CurrentTenant::class)->run($tenant, fn (): MedicineBatch => MedicineBatch::create([
            'tenant_id' => $tenant->id,
            'branch_id' => $branchA->id,
            'medicine_id' => $medicine->id,
            'batch_number' => 'VALID-BR-A',
            'expiry_date' => now()->addDays(15)->toDateString(),
            'quantity_received' => 10,
            'quantity_available' => 10,
            'purchase_price' => 8.00,
            'selling_price' => 12.00,
            'status' => BatchStatus::ACTIVE->value,
        ]));

        // POS only counts sellable unexpired stock in active Branch A (10, not 70)
        $this->actingAs($owner)
            ->get('/pos')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Pos/Index')
                ->where('medicines.0.available_stock', 10)
            );

        // Valid checkout of 4 pieces deducts only VALID-BR-A and writes sale StockMovement
        $this->actingAs($owner)
            ->post('/pos/checkout', [
                'payment_method' => 'cash',
                'items' => [
                    ['medicine_id' => $medicine->id, 'quantity' => 4, 'sale_unit' => 'piece'],
                ],
            ])
            ->assertRedirect();

        $sale = Sale::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        $this->assertSame(6, (int) $validBranchABatch->fresh()->quantity_available);
        $this->assertSame(20, (int) $expiredBranchABatch->fresh()->quantity_available);
        $this->assertSame(40, (int) $validBranchBBatch->fresh()->quantity_available);

        $this->assertDatabaseHas('stock_movements', [
            'tenant_id' => $tenant->id,
            'branch_id' => $branchA->id,
            'medicine_id' => $medicine->id,
            'medicine_batch_id' => $validBranchABatch->id,
            'movement_type' => StockMovementType::SALE->value,
            'quantity_change' => -4,
            'balance_before' => 10,
            'balance_after' => 6,
            'unit_cost' => 8.00,
            'total_cost' => 32.00,
            'reference_type' => Sale::class,
            'reference_id' => $sale->id,
        ]);

        // Selling remaining 6 marks batch depleted cleanly
        $this->actingAs($owner)
            ->post('/pos/checkout', [
                'payment_method' => 'cash',
                'items' => [
                    ['medicine_id' => $medicine->id, 'quantity' => 6, 'sale_unit' => 'piece'],
                ],
            ])
            ->assertRedirect();

        $validBranchABatch->refresh();
        $this->assertSame(0, (int) $validBranchABatch->quantity_available);
        $this->assertSame(BatchStatus::DEPLETED->value, $validBranchABatch->status);
    }

    public function test_archiving_medicine_blocks_pos_while_preserving_historical_sales_and_movements(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $owner = User::factory()->create(['account_type' => 'admin']);
        $tenant = $provisioning->createTenantForUser($owner, [
            'name' => 'Archive Safe Pharmacy',
            'plan_key' => 'growth',
        ]);

        $this->actingAs($owner)
            ->post('/inventory', [
                'name' => 'Ciprocin 500mg',
                'sku' => 'CIPRO-500',
                'dosage_form' => 'tablet',
                'unit' => 'tablet',
                'units_per_strip' => 10,
                'units_per_box' => 50,
                'reorder_level' => 10,
                'requires_prescription' => true,
                'purchase_price' => 9.00,
                'selling_price' => 14.00,
                'batch_number' => 'CIP-01',
                'quantity' => 15,
                'expiry_date' => now()->addMonths(10)->toDateString(),
            ])
            ->assertRedirect();

        $medicine = Medicine::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenant->id)
            ->where('sku', 'CIPRO-500')
            ->firstOrFail();

        // Sell 3 tablets before archiving
        $this->actingAs($owner)
            ->post('/pos/checkout', [
                'payment_method' => 'card',
                'items' => [
                    ['medicine_id' => $medicine->id, 'quantity' => 3, 'sale_unit' => 'piece'],
                ],
            ])
            ->assertRedirect();

        // Archive medicine
        $this->actingAs($owner)
            ->patch("/inventory/{$medicine->id}/toggle")
            ->assertRedirect();

        $this->assertFalse((bool) $medicine->fresh()->is_active);

        // Default /inventory hides archived item while ?filter=archived surfaces it
        $this->actingAs($owner)
            ->get('/inventory')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Inventory/Index')
                ->has('medicines', 0)
                ->where('tabCounts.archived', 1)
            );

        $this->actingAs($owner)
            ->get('/inventory?filter=archived')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Inventory/Index')
                ->has('medicines', 1)
                ->where('medicines.0.id', $medicine->id)
            );

        // Archived medicine cannot be sold at POS
        $this->actingAs($owner)
            ->post('/pos/checkout', [
                'payment_method' => 'cash',
                'items' => [
                    ['medicine_id' => $medicine->id, 'quantity' => 1, 'sale_unit' => 'piece'],
                ],
            ])
            ->assertStatus(422);

        // Historical SaleItem and StockMovement audit chain remain intact
        $saleItem = SaleItem::where('medicine_id', $medicine->id)->firstOrFail();
        $this->assertSame(3, (int) $saleItem->quantity);
        $this->assertSame(42.0, (float) $saleItem->line_total);
        $this->assertSame(2, StockMovement::withoutGlobalScope(TenantScope::class)
            ->where('medicine_id', $medicine->id)
            ->count());

        // Restoring medicine allows POS dispensing again
        $this->actingAs($owner)
            ->patch("/inventory/{$medicine->id}/toggle")
            ->assertRedirect();

        $this->assertTrue((bool) $medicine->fresh()->is_active);

        $this->actingAs($owner)
            ->post('/pos/checkout', [
                'payment_method' => 'cash',
                'items' => [
                    ['medicine_id' => $medicine->id, 'quantity' => 2, 'sale_unit' => 'piece'],
                ],
            ])
            ->assertRedirect();
    }
}
