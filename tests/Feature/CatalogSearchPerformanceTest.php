<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use App\Modules\Billing\Models\Plan;
use App\Modules\Billing\Models\Subscription;
use App\Modules\Catalog\Services\ProductSearchService;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\Phase2PlansAndFeaturesSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacPermissionCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CatalogSearchPerformanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(RbacPermissionCatalogSeeder::class);
        $this->seed(Phase2PlansAndFeaturesSeeder::class);
    }

    public function test_50k_products_search_p95_sub_200ms_and_explain_uses_gin_trigram_index(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Performance test with GIN trigram index requires PostgreSQL.');
        }

        $plan = Plan::where('code', 'premium')->firstOrFail();
        $provisioning = app(TenantProvisioningService::class);

        // 1. Create Tenant A
        $ownerA = User::factory()->create(['account_type' => 'admin']);
        $tenantA = $provisioning->createTenantForUser($ownerA, ['name' => 'LoadTest Pharmacy A', 'plan_key' => 'growth']);
        app(CurrentTenant::class)->run($tenantA, function () use ($tenantA, $plan) {
            Subscription::create([
                'tenant_id' => $tenantA->id,
                'plan_id' => $plan->id,
                'billing_cycle' => 'monthly',
                'status' => 'active',
                'starts_at' => now(),
                'ends_at' => now()->addMonth(),
            ]);
        });

        // 2. Create Tenant B (to prove multi-tenant RLS isolation does not degrade performance)
        $ownerB = User::factory()->create(['account_type' => 'admin']);
        $tenantB = $provisioning->createTenantForUser($ownerB, ['name' => 'LoadTest Pharmacy B', 'plan_key' => 'growth']);
        app(CurrentTenant::class)->run($tenantB, function () use ($tenantB, $plan) {
            Subscription::create([
                'tenant_id' => $tenantB->id,
                'plan_id' => $plan->id,
                'billing_cycle' => 'monthly',
                'status' => 'active',
                'starts_at' => now(),
                'ends_at' => now()->addMonth(),
            ]);
        });

        // 3. Seed 50,000 products for Tenant A and 50,000 for Tenant B
        Artisan::call('catalog:seed-load-test', ['--tenant' => $tenantA->id, '--count' => 50000]);
        Artisan::call('catalog:seed-load-test', ['--tenant' => $tenantB->id, '--count' => 50000]);

        $countA = DB::table('products')->where('tenant_id', $tenantA->id)->count();
        $countB = DB::table('products')->where('tenant_id', $tenantB->id)->count();
        $this->assertEquals(50000, $countA);
        $this->assertEquals(50000, $countB);

        // Analyze table to refresh PostgreSQL query planner statistics
        DB::statement('ANALYZE products;');
        DB::statement('ANALYZE product_barcodes;');

        // 4. Assert via EXPLAIN that PostgreSQL uses GIN trigram index or unique index
        $explainResults = DB::select("EXPLAIN SELECT id, name, search_text FROM products WHERE tenant_id = ? AND search_text % ?;", [$tenantA->id, 'paracetamol']);
        $explainText = implode(' ', array_map(fn ($r) => $r->{'QUERY PLAN'} ?? '', $explainResults));
        $this->assertStringContainsString('products_search_text_trgm_idx', $explainText, 'PostgreSQL query plan must use products_search_text_trgm_idx GIN index.');

        // 5. Run 200 typical searches across diverse input types
        $sampleBarcode = DB::table('product_barcodes')->where('tenant_id', $tenantA->id)->value('barcode');
        $searchInputs = [
            'Napa',              // Full/prefix English name
            'Ace',               // Short English name
            'Zimax 500',         // Multi-word with strength
            'Zimaax',            // Typo / misspelled name (trigram similarity)
            'Paracetamol',       // Generic name
            'নাপা',              // Full Bengali name
            'সেকলো',             // Short Bengali name
            'Na',                // 2-character input
            'Se',                // 2-character input
            $sampleBarcode,      // Exact 13-digit Barcode
        ];

        $searchSvc = app(ProductSearchService::class);
        $latencies = [];

        // Set tenant context for RLS session
        app(CurrentTenant::class)->set($tenantA);
        DB::statement("SELECT set_config('app.tenant_id', :id, true)", ['id' => (string) $tenantA->id]);

        $byInput = [];
        for ($i = 0; $i < 200; $i++) {
            $input = $searchInputs[$i % count($searchInputs)];
            $start = microtime(true);
            $results = $searchSvc->search($tenantA->id, $input, limit: 20);
            $elapsedMs = (microtime(true) - $start) * 1000;
            $latencies[] = $elapsedMs;
            $byInput[$input][] = $elapsedMs;

            $this->assertLessThan(500, $elapsedMs, "Individual query '{$input}' exceeded 500ms (took {$elapsedMs}ms)");
        }

        foreach ($byInput as $inp => $times) {
            $avgInp = array_sum($times) / count($times);
            $maxInp = max($times);
            fwrite(STDERR, sprintf("Input [%-15s]: Avg = %6.2f ms | Max = %6.2f ms\n", $inp, $avgInp, $maxInp));
        }

        sort($latencies);
        $p95Index = (int) floor(0.95 * count($latencies));
        $p95 = $latencies[$p95Index];
        $max = max($latencies);
        $min = min($latencies);
        $avg = array_sum($latencies) / count($latencies);

        fwrite(STDERR, "\n--- 50k Search Performance Results ---\n");
        fwrite(STDERR, "Total queries: ".count($latencies)."\n");
        fwrite(STDERR, "Min: ".round($min, 2)." ms\n");
        fwrite(STDERR, "Avg: ".round($avg, 2)." ms\n");
        fwrite(STDERR, "p95: ".round($p95, 2)." ms (Target < 200 ms)\n");
        fwrite(STDERR, "Max: ".round($max, 2)." ms (Target < 500 ms)\n");
        fwrite(STDERR, "-------------------------------------\n");

        $this->assertLessThan(200, $p95, "p95 search latency ({$p95}ms) must be less than 200ms.");
    }
}
