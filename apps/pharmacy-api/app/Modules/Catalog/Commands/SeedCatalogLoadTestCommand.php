<?php

namespace App\Modules\Catalog\Commands;

use App\Models\Tenant;
use App\Modules\Catalog\Models\Category;
use App\Modules\Catalog\Models\Company;
use App\Modules\Catalog\Models\Generic;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\ProductBarcode;
use App\Modules\Catalog\Models\ProductUnit;
use App\Modules\Catalog\Support\CatalogNormalizer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SeedCatalogLoadTestCommand extends Command
{
    protected $signature = 'catalog:seed-load-test {--tenant= : Tenant ID} {--count=50000 : Number of products to generate}';
    protected $description = 'Seed high-volume realistic products for catalog search performance testing';

    public function handle(): int
    {
        $tenantId = (int) $this->option('tenant');
        $count = (int) $this->option('count');

        if (! $tenantId) {
            $tenant = Tenant::first();
            if (! $tenant) {
                $this->error('No tenant found.');
                return 1;
            }
            $tenantId = $tenant->id;
        } else {
            $tenant = Tenant::find($tenantId);
            if (! $tenant) {
                $this->error("Tenant #{$tenantId} not found.");
                return 1;
            }
        }

        $this->info("Seeding {$count} synthetic catalog products for tenant #{$tenantId}...");

        return app(\App\Tenancy\CurrentTenant::class)->run($tenant, function () use ($tenantId, $count) {
            // Create base companies, generics, categories
        $companies = [
            ['name' => 'Square Pharmaceuticals Ltd', 'name_bn' => 'স্কয়ার ফার্মাসিউটিক্যালস লিমিটেড'],
            ['name' => 'Beximco Pharmaceuticals Ltd', 'name_bn' => 'বেক্সিমকো ফার্মা'],
            ['name' => 'Incepta Pharmaceuticals Ltd', 'name_bn' => 'ইনসেপ্টা ফার্মাসিউটিক্যালস'],
            ['name' => 'Renata Limited', 'name_bn' => 'রেনাটা লিমিটেড'],
            ['name' => 'ACI Limited', 'name_bn' => 'এসিআই লিমিটেড'],
        ];
        $companyIds = [];
        foreach ($companies as $c) {
            $comp = Company::withoutGlobalScopes()->updateOrCreate(
                ['tenant_id' => $tenantId, 'name' => $c['name']],
                ['name_bn' => $c['name_bn'], 'is_active' => true]
            );
            $companyIds[] = $comp->id;
        }

        $generics = ['Paracetamol', 'Omeprazole', 'Azithromycin', 'Metformin', 'Amlodipine', 'Ciprofloxacin', 'Losartan Potassium', 'Pantoprazole', 'Esomeprazole', 'Cetirizine'];
        $genericIds = [];
        foreach ($generics as $g) {
            $gen = Generic::withoutGlobalScopes()->updateOrCreate(
                ['tenant_id' => $tenantId, 'name' => $g],
                ['is_active' => true]
            );
            $genericIds[] = $gen->id;
        }

        $category = Category::withoutGlobalScopes()->firstOrCreate(
            ['tenant_id' => $tenantId, 'name' => 'General Medicine'],
            ['name_bn' => 'সাধারণ ওষুধ', 'is_active' => true]
        );

        $nameRoots = [
            ['en' => 'Napa', 'bn' => 'নাপা'],
            ['en' => 'Ace', 'bn' => 'এইস'],
            ['en' => 'Seclo', 'bn' => 'সেকলো'],
            ['en' => 'Zimax', 'bn' => 'জিম্যাক্স'],
            ['en' => 'Comet', 'bn' => 'কমেট'],
            ['en' => 'Camlosart', 'bn' => 'ক্যামলোসার্ট'],
            ['en' => 'Ciprocin', 'bn' => 'সিপ্রোসিন'],
            ['en' => 'Pantobex', 'bn' => 'প্যান্টোবেক্স'],
            ['en' => 'Nexum', 'bn' => 'নেক্সাম'],
            ['en' => 'Alatrol', 'bn' => 'অ্যালাট্রোল'],
            ['en' => 'Sergel', 'bn' => 'সারজেল'],
            ['en' => 'Fexo', 'bn' => 'ফেক্সো'],
            ['en' => 'Monas', 'bn' => 'মোনাস'],
            ['en' => 'Filwel Gold', 'bn' => 'ফিলওয়েল গোল্ড'],
            ['en' => 'Ceevit', 'bn' => 'সিভিট'],
        ];

        $strengths = ['500mg', '20mg', '10mg', '5mg/5ml', '40mg', '100mg', '250mg', '1g'];
        $forms = ['tablet', 'capsule', 'syrup', 'injection', 'drop'];

        $chunkSize = 2500;
        $chunks = (int) ceil($count / $chunkSize);
        $totalCreated = 0;

        for ($c = 0; $c < $chunks; $c++) {
            $productsToInsert = [];
            $unitsToInsert = [];
            $barcodesToInsert = [];
            $thisChunk = min($chunkSize, $count - $totalCreated);

            for ($i = 0; $i < $thisChunk; $i++) {
                $idx = $totalCreated + $i + 1;
                $root = $nameRoots[($idx - 1) % count($nameRoots)];
                $strength = $strengths[($idx - 1) % count($strengths)];
                $form = $forms[($idx - 1) % count($forms)];
                $companyId = $companyIds[($idx - 1) % count($companyIds)];
                $genericId = $genericIds[($idx - 1) % count($genericIds)];

                $name = $idx <= count($nameRoots) ? $root['en'] : "{$root['en']} {$idx}";
                $nameBn = $idx <= count($nameRoots) ? $root['bn'] : "{$root['bn']} {$idx}";
                $sku = "SKU-{$tenantId}-{$idx}";
                $barcode = '894'.str_pad((string) ($tenantId * 1000000 + $idx), 10, '0', STR_PAD_LEFT);
                $uuid = (string) Str::uuid();

                $dedupeKey = CatalogNormalizer::dedupeKey($name, $strength, $form, $companyId);
                $searchText = mb_strtolower("{$name} {$nameBn} {$strength} {$form} {$sku} {$generics[($idx - 1) % count($generics)]}", 'UTF-8');

                $productsToInsert[] = [
                    'id' => $uuid,
                    'tenant_id' => $tenantId,
                    'type' => 'medicine',
                    'name' => $name,
                    'name_bn' => $nameBn,
                    'generic_id' => $genericId,
                    'company_id' => $companyId,
                    'category_id' => $category->id,
                    'strength' => $strength,
                    'dosage_form' => $form,
                    'sku' => $sku,
                    'base_unit' => 'pcs',
                    'track_batch' => true,
                    'is_controlled' => false,
                    'default_discount_type' => null,
                    'default_discount_value' => 0,
                    'vat_rate' => 0,
                    'is_active' => true,
                    'dedupe_key' => $dedupeKey,
                    'search_text' => $searchText,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                $unitsToInsert[] = [
                    'id' => (string) Str::uuid(),
                    'tenant_id' => $tenantId,
                    'product_id' => $uuid,
                    'unit_name' => 'pcs',
                    'conversion_to_base' => 1,
                    'is_sale_unit' => true,
                    'is_purchase_unit' => true,
                    'is_default_sale' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                $unitsToInsert[] = [
                    'id' => (string) Str::uuid(),
                    'tenant_id' => $tenantId,
                    'product_id' => $uuid,
                    'unit_name' => 'strip',
                    'conversion_to_base' => 10,
                    'is_sale_unit' => true,
                    'is_purchase_unit' => true,
                    'is_default_sale' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                $barcodesToInsert[] = [
                    'id' => (string) Str::uuid(),
                    'tenant_id' => $tenantId,
                    'product_id' => $uuid,
                    'barcode' => $barcode,
                    'source' => 'manufacturer',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            DB::table('products')->insert($productsToInsert);
            DB::table('product_units')->insert($unitsToInsert);
            DB::table('product_barcodes')->insert($barcodesToInsert);

            $totalCreated += $thisChunk;
            $this->output->write('.');
        }

        $this->newLine();
        $this->info("Successfully seeded {$totalCreated} products for tenant #{$tenantId}.");

        return 0;
    });
    }
}
