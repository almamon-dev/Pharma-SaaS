<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Billing\Exceptions\FeatureLockedException;
use App\Modules\Billing\Exceptions\LimitReachedException;
use App\Modules\Billing\Models\Plan;
use App\Modules\Billing\Models\Subscription;
use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Catalog\Contracts\ProductReferenceChecker;
use App\Modules\Catalog\Jobs\RefreshProductSearchText;
use App\Modules\Catalog\Models\Category;
use App\Modules\Catalog\Models\Company;
use App\Modules\Catalog\Models\Generic;
use App\Modules\Catalog\Models\ImportJob;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\ProductBarcode;
use App\Modules\Catalog\Models\ProductUnit;
use App\Modules\Catalog\Services\InternalBarcodeGenerator;
use App\Modules\Catalog\Services\ImportJobService;
use App\Modules\Catalog\Services\MasterDataService;
use App\Modules\Catalog\Services\ProductSearchService;
use App\Modules\Catalog\Services\ProductService;
use App\Modules\Catalog\Services\UnitConverter;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\Phase2PlansAndFeaturesSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacPermissionCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Tests\TestCase;

class Phase3CatalogSearchImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(RbacPermissionCatalogSeeder::class);
        $this->seed(Phase2PlansAndFeaturesSeeder::class);
    }

    private function createTenantWithPlan(string $planCode, string $status = Subscription::STATUS_ACTIVE): array
    {
        $plan = Plan::where('code', $planCode)->firstOrFail();
        $owner = User::factory()->create(['account_type' => 'admin']);

        $tenant = app(TenantProvisioningService::class)->createTenantForUser($owner, [
            'name' => "Catalog {$plan->name} Pharmacy",
            'plan_key' => 'growth',
        ]);

        app(CurrentTenant::class)->run($tenant, function () use ($tenant, $plan, $status) {
            Subscription::withoutGlobalScopes()->where('tenant_id', $tenant->id)->delete();
            Subscription::create([
                'tenant_id' => $tenant->id,
                'plan_id' => $plan->id,
                'billing_cycle' => 'monthly',
                'status' => $status,
                'starts_at' => now(),
                'ends_at' => now()->addMonth(),
            ]);
        });

        return [$tenant, $owner, $plan];
    }

    public function test_unit_rules_and_conversions(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('standard');
        $converter = app(UnitConverter::class);

        [$product] = app(CurrentTenant::class)->run($tenant, function () use ($tenant, $owner) {
            $service = app(ProductService::class);
            return array_values($service->create([
                'type' => 'medicine',
                'name' => 'Napa Extra',
                'strength' => '500mg',
                'dosage_form' => 'tablet',
                'base_unit' => 'pcs',
                'units' => [
                    ['unit_name' => 'pcs', 'conversion_to_base' => 1, 'is_sale_unit' => true, 'is_default_sale' => true],
                    ['unit_name' => 'strip', 'conversion_to_base' => 10, 'is_sale_unit' => true, 'is_default_sale' => false],
                    ['unit_name' => 'box', 'conversion_to_base' => 100, 'is_sale_unit' => true, 'is_default_sale' => false],
                ],
            ], $owner));
        });

        // 1. toBase
        $this->assertEquals(10, $converter->toBase($product, 'strip', 1));
        $this->assertEquals(250, $converter->toBase($product, 'box', 2.5));
        $this->assertEquals(5, $converter->toBase($product, 'pcs', 5));

        // 2. fromBase
        $this->assertEquals(1.0, $converter->fromBase($product, 'box', 100));
        $this->assertEquals(2.5, $converter->fromBase($product, 'strip', 25));

        // 3. Validation rejections
        $this->expectException(ValidationException::class);
        app(CurrentTenant::class)->run($tenant, function () use ($owner) {
            app(ProductService::class)->create([
                'type' => 'medicine',
                'name' => 'Invalid Units Med',
                'dosage_form' => 'tablet',
                'base_unit' => 'pcs',
                'units' => [
                    ['unit_name' => 'pcs', 'conversion_to_base' => 2], // Base unit must be 1
                ],
            ], $owner);
        });
    }

    public function test_product_rules_and_deduplication(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('standard');
        $service = app(ProductService::class);

        // 1. Medicine requires dosage form
        try {
            app(CurrentTenant::class)->run($tenant, fn () => $service->create([
                'type' => 'medicine',
                'name' => 'No Form Med',
                'dosage_form' => null,
            ], $owner));
            $this->fail('Expected ValidationException for missing dosage form');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('dosage_form', $e->errors());
        }

        // 2. Non-medicine cannot be controlled
        $nonMedRes = app(CurrentTenant::class)->run($tenant, fn () => $service->create([
            'type' => 'non_medicine',
            'name' => 'Surgical Gloves',
            'is_controlled' => true, // Must be forced to false
            'base_unit' => 'pair',
            'units' => [['unit_name' => 'pair', 'conversion_to_base' => 1, 'is_sale_unit' => true, 'is_default_sale' => true]],
        ], $owner));
        $this->assertFalse($nonMedRes['product']->is_controlled);

        // 3. Exact duplicate rejected with 409 Conflict
        app(CurrentTenant::class)->run($tenant, fn () => $service->create([
            'type' => 'medicine',
            'name' => 'Seclo',
            'strength' => '20mg',
            'dosage_form' => 'capsule',
        ], $owner));

        try {
            app(CurrentTenant::class)->run($tenant, fn () => $service->create([
                'type' => 'medicine',
                'name' => 'seclo ',
                'strength' => '20 mg',
                'dosage_form' => 'capsule',
            ], $owner));
            $this->fail('Expected ConflictHttpException for exact duplicate');
        } catch (ConflictHttpException $e) {
            $this->assertEquals(409, $e->getStatusCode());
        }

        // 4. Near duplicate returns warning list but allows saving
        if (DB::getDriverName() === 'pgsql') {
            $nearRes = app(CurrentTenant::class)->run($tenant, fn () => $service->create([
                'type' => 'medicine',
                'name' => 'Secloo', // Trigram similar to Seclo
                'strength' => '20mg',
                'dosage_form' => 'capsule',
            ], $owner));
            $this->assertNotEmpty($nearRes['warnings']);
            $this->assertNotNull($nearRes['product']->id);
        }
    }

    public function test_barcode_uniqueness_inside_tenant_and_allowed_across_tenants(): void
    {
        [$tenantA, $ownerA] = $this->createTenantWithPlan('standard');
        [$tenantB, $ownerB] = $this->createTenantWithPlan('standard');

        $barcode = '8941234567890';

        // 1. Tenant A attaches barcode
        $prodA = app(CurrentTenant::class)->run($tenantA, function () use ($ownerA, $barcode) {
            $res = app(ProductService::class)->create([
                'type' => 'medicine',
                'name' => 'Medicine A',
                'dosage_form' => 'tablet',
                'barcodes' => [$barcode],
            ], $ownerA);
            return $res['product'];
        });
        $this->assertCount(1, $prodA->barcodes);

        // 2. Duplicate barcode in Tenant A is rejected
        $this->actingAs($ownerA);
        session(['active_tenant_id' => $tenantA->id]);
        $prodA2 = app(CurrentTenant::class)->run($tenantA, fn () => app(ProductService::class)->create([
            'type' => 'medicine',
            'name' => 'Medicine A2',
            'dosage_form' => 'tablet',
        ], $ownerA)['product']);

        $resConflict = $this->postJson("/api/catalog/products/{$prodA2->id}/barcodes", [
            'barcode' => $barcode,
        ]);
        $resConflict->assertStatus(422);

        // 3. Same barcode allowed in Tenant B
        $this->actingAs($ownerB);
        session(['active_tenant_id' => $tenantB->id]);
        $prodB = app(CurrentTenant::class)->run($tenantB, fn () => app(ProductService::class)->create([
            'type' => 'medicine',
            'name' => 'Medicine B',
            'dosage_form' => 'tablet',
            'barcodes' => [$barcode],
        ], $ownerB)['product']);

        $this->assertCount(1, $prodB->barcodes);
    }

    public function test_internal_barcode_generator_ean13(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('standard');
        $gen = app(InternalBarcodeGenerator::class);

        $bc1 = $gen->generateForTenant($tenant->id);
        $bc2 = $gen->generateForTenant($tenant->id);

        $this->assertNotEquals($bc1, $bc2);
        $this->assertStringStartsWith('2', $bc1);
        $this->assertStringStartsWith('2', $bc2);
        $this->assertEquals(13, strlen($bc1));
        $this->assertTrue(InternalBarcodeGenerator::isValidEan13($bc1));
        $this->assertTrue(InternalBarcodeGenerator::isValidEan13($bc2));

        // Bulk generate only attaches to products without barcode
        app(CurrentTenant::class)->run($tenant, function () use ($owner, $bc1) {
            $svc = app(ProductService::class);
            $svc->create(['type' => 'medicine', 'name' => 'Med With Barcode', 'dosage_form' => 'tablet', 'barcodes' => [$bc1]], $owner);
            $svc->create(['type' => 'medicine', 'name' => 'Med No Barcode 1', 'dosage_form' => 'tablet'], $owner);
            $svc->create(['type' => 'medicine', 'name' => 'Med No Barcode 2', 'dosage_form' => 'tablet'], $owner);
        });

        $this->actingAs($owner);
        session(['active_tenant_id' => $tenant->id]);
        $resp = $this->postJson('/api/catalog/products/barcodes/bulk-generate');
        $resp->assertOk()->assertJsonFragment(['generated_count' => 2]);
    }

    public function test_bengali_search_and_fast_lookup(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('standard');
        $searchSvc = app(ProductSearchService::class);

        app(CurrentTenant::class)->run($tenant, function () use ($owner) {
            $svc = app(ProductService::class);
            $svc->create([
                'type' => 'medicine',
                'name' => 'Napa Extra',
                'name_bn' => 'নাপা এক্সট্রা',
                'strength' => '500mg',
                'dosage_form' => 'tablet',
                'barcodes' => ['8941000000001'],
            ], $owner);

            $svc->create([
                'type' => 'medicine',
                'name' => 'Seclo',
                'name_bn' => 'সেকলো',
                'strength' => '20mg',
                'dosage_form' => 'capsule',
            ], $owner);
        });

        // Search by Bengali name
        $resBn = $searchSvc->search($tenant->id, 'নাপা');
        $this->assertNotEmpty($resBn);
        $this->assertEquals('Napa Extra 500mg tablet', $resBn->first()['display_name']);

        // Search by barcode
        $resBc = $searchSvc->search($tenant->id, '8941000000001');
        $this->assertNotEmpty($resBc);
        $this->assertEquals('Napa Extra 500mg tablet', $resBc->first()['display_name']);

        // Cost fields must never be present
        $item = $resBn->first();
        $this->assertArrayNotHasKey('cost_price', $item);
        $this->assertArrayNotHasKey('purchase_price', $item);
        $this->assertArrayHasKey('extras', $item);
    }

    public function test_max_products_limit_enforced(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('basic'); // Basic plan max_products = 2000
        $fm = app(FeatureManager::class)->setTenant($tenant);

        // Temporarily override max_products limit to 2 for testing
        app(CurrentTenant::class)->run($tenant, function () use ($tenant, $owner) {
            \App\Modules\Billing\Models\TenantOverride::create([
                'tenant_id' => $tenant->id,
                'feature_key' => 'max_products',
                'limit_value' => 2,
                'created_by' => $owner->id,
            ]);
        });
        cache()->flush();

        $service = app(ProductService::class);

        // 1st product
        app(CurrentTenant::class)->run($tenant, fn () => $service->create([
            'type' => 'medicine', 'name' => 'Item 1', 'dosage_form' => 'tablet',
        ], $owner));

        // 2nd product
        $prod2 = app(CurrentTenant::class)->run($tenant, fn () => $service->create([
            'type' => 'medicine', 'name' => 'Item 2', 'dosage_form' => 'tablet',
        ], $owner))['product'];

        // 3rd product must fail with LimitReachedException
        try {
            app(CurrentTenant::class)->run($tenant, fn () => $service->create([
                'type' => 'medicine', 'name' => 'Item 3', 'dosage_form' => 'tablet',
            ], $owner));
            $this->fail('Expected LimitReachedException when exceeding max_products');
        } catch (LimitReachedException $e) {
            $this->assertEquals('max_products', $e->featureKey);
        }

        // Soft deleted product does not count towards limit
        app(CurrentTenant::class)->run($tenant, fn () => $service->delete($prod2, $owner));

        // Now creating 3rd product succeeds
        $prod3 = app(CurrentTenant::class)->run($tenant, fn () => $service->create([
            'type' => 'medicine', 'name' => 'Item 3', 'dosage_form' => 'tablet',
        ], $owner))['product'];
        $this->assertNotNull($prod3->id);
    }

    public function test_import_wizard_preview_and_processing_and_undo(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('standard');
        $importSvc = app(ImportJobService::class);

        $csvContent = implode("\n", [
            'type,name,name_bn,generic,company,category,strength,dosage_form,base_unit,units,barcodes,sku',
            'medicine,Ace Plus,এইস প্লাস,Paracetamol,Square Pharma,Analgesic,500mg+65mg,tablet,pcs,box=100;strip=10,8945550001,ACE-PL-1',
            'medicine,Renova,,Paracetamol,Beximco,Analgesic,500mg,tablet,pcs,,8945550002,REN-500',
            'medicine,Missing Form Med,,Paracetamol,Renata,,500mg,,pcs,,,', // Invalid row (missing form)
        ]);

        $tmpFile = tempnam(sys_get_temp_dir(), 'import_').'.csv';
        file_put_contents($tmpFile, $csvContent);
        $uploadedFile = new UploadedFile($tmpFile, 'medicines.csv', 'text/csv', null, true);

        // 1. Upload
        $job = app(CurrentTenant::class)->run($tenant, fn () => $importSvc->upload($uploadedFile, $owner));
        $this->assertEquals('uploaded', $job->status);

        // 2. Preview
        $preview = app(CurrentTenant::class)->run($tenant, fn () => $importSvc->preview($job, $job->column_map, 'create_only'));
        $this->assertEquals(2, $preview['will_create']);
        $this->assertEquals(1, $preview['error_rows']);
        $this->assertContains('Square Pharma', $preview['new_masters']['companies']);

        // 3. Process
        $processed = app(CurrentTenant::class)->run($tenant, fn () => $importSvc->process($job));
        $this->assertEquals('done', $processed->status);
        $this->assertEquals(2, $processed->created_count);

        $this->assertDatabaseHas('products', ['tenant_id' => $tenant->id, 'name' => 'Ace Plus']);
        $this->assertDatabaseHas('companies', ['tenant_id' => $tenant->id, 'name' => 'Square Pharma']);

        // 4. Undo within 24h
        app(CurrentTenant::class)->run($tenant, fn () => $importSvc->undo($processed, $owner));
        $this->assertEquals('undone', $processed->fresh()->status);
        $this->assertSoftDeleted('products', ['tenant_id' => $tenant->id, 'name' => 'Ace Plus']);
        // Unused created company Square Pharma was cleaned up
        $this->assertDatabaseMissing('companies', ['tenant_id' => $tenant->id, 'name' => 'Square Pharma']);
    }

    public function test_plan_gating_for_import_export_and_labels(): void
    {
        [$basicTenant, $basicOwner] = $this->createTenantWithPlan('basic');
        [$stdTenant, $stdOwner] = $this->createTenantWithPlan('standard');

        // Basic plan: import_export is false
        $this->actingAs($basicOwner);
        session(['active_tenant_id' => $basicTenant->id]);

        $csv = UploadedFile::fake()->create('test.csv', 100, 'text/csv');
        $this->postJson('/api/catalog/imports', ['file' => $csv])
            ->assertForbidden();

        // Basic plan: barcode_labels is false
        $this->postJson('/api/catalog/labels', ['items' => [['product_id' => (string) \Illuminate\Support\Str::uuid()]]])
            ->assertForbidden();

        // Standard plan: import_export and barcode_labels are true
        $this->actingAs($stdOwner);
        session(['active_tenant_id' => $stdTenant->id]);

        $tmpFile = tempnam(sys_get_temp_dir(), 'std_').'.csv';
        file_put_contents($tmpFile, "name,dosage_form\nTest,tablet");
        $upload = new UploadedFile($tmpFile, 'test.csv', 'text/csv', null, true);

        $this->postJson('/api/catalog/imports', ['file' => $upload])
            ->assertCreated();
    }

    public function test_tenancy_and_rls_isolation_on_catalog(): void
    {
        [$tenantA, $ownerA] = $this->createTenantWithPlan('standard');
        [$tenantB, $ownerB] = $this->createTenantWithPlan('standard');

        $prodA = app(CurrentTenant::class)->run($tenantA, function () use ($ownerA) {
            return app(ProductService::class)->create([
                'type' => 'medicine',
                'name' => 'Tenant A Secret Formula',
                'dosage_form' => 'syrup',
                'sku' => 'SECRET-A',
            ], $ownerA)['product'];
        });

        // Tenant B cannot see or search Tenant A product
        $this->actingAs($ownerB);
        session(['active_tenant_id' => $tenantB->id]);

        $this->getJson("/api/catalog/products/{$prodA->id}")
            ->assertNotFound();

        $searchRes = $this->getJson('/api/catalog/products/search?q=Secret');
        $searchRes->assertOk()->assertJsonCount(0);
    }

    public function test_master_data_cycle_and_search_text_refresh(): void
    {
        Queue::fake();

        [$tenant, $owner] = $this->createTenantWithPlan('standard');
        $masterSvc = app(MasterDataService::class);

        // Max depth 3 test
        $cat1 = app(CurrentTenant::class)->run($tenant, fn () => $masterSvc->createCategory(['name' => 'Level 1'], $owner));
        $cat2 = app(CurrentTenant::class)->run($tenant, fn () => $masterSvc->createCategory(['name' => 'Level 2', 'parent_id' => $cat1->id], $owner));
        $cat3 = app(CurrentTenant::class)->run($tenant, fn () => $masterSvc->createCategory(['name' => 'Level 3', 'parent_id' => $cat2->id], $owner));

        try {
            app(CurrentTenant::class)->run($tenant, fn () => $masterSvc->createCategory(['name' => 'Level 4', 'parent_id' => $cat3->id], $owner));
            $this->fail('Expected ValidationException for depth > 3');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('parent_id', $e->errors());
        }

        // Circular hierarchy prevention
        try {
            app(CurrentTenant::class)->run($tenant, fn () => $masterSvc->updateCategory($cat1, ['parent_id' => $cat3->id], $owner));
            $this->fail('Expected ValidationException for circular hierarchy');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('parent_id', $e->errors());
        }

        // Renaming company dispatches RefreshProductSearchText job
        $company = app(CurrentTenant::class)->run($tenant, fn () => $masterSvc->createCompany(['name' => 'Old Pharma'], $owner));
        app(CurrentTenant::class)->run($tenant, fn () => $masterSvc->updateCompany($company, ['name' => 'New Pharma'], $owner));

        Queue::assertPushed(RefreshProductSearchText::class, function ($job) use ($tenant, $company) {
            return $job->tenantId === $tenant->id && $job->masterId === $company->id;
        });
    }

    public function test_read_only_mode_blocks_writes_but_permits_search_and_export(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('standard', Subscription::STATUS_READ_ONLY);

        $this->actingAs($owner);
        session(['active_tenant_id' => $tenant->id]);

        // Writes blocked with 403
        $this->postJson('/api/catalog/products', [
            'type' => 'medicine',
            'name' => 'Blocked Product',
            'dosage_form' => 'tablet',
        ])->assertForbidden();

        // Search permitted
        $this->getJson('/api/catalog/products/search?q=test')
            ->assertOk();

        // Export permitted
        $this->post('/api/catalog/exports')
            ->assertOk();
    }
}
