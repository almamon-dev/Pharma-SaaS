<?php

namespace App\Modules\Catalog\Services;

use App\Enums\BatchStatus;
use App\Enums\StockMovementType;
use App\Models\Tenant;
use App\Modules\Catalog\Support\CatalogNormalizer;
use App\Tenancy\CurrentTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class BangladeshCatalogImportService
{
    public const HF_CSV_URL = 'https://huggingface.co/datasets/Mahadih534/all-Bangladeshi-medicines/resolve/main/medicine.csv';

    public const WSAYAN_JSON_URL = 'https://raw.githubusercontent.com/WSAyan/medicinedb/master/medicne.json';

    /**
     * Ensure online datasets exist in local cache and parse combined unique medicines.
     *
     * @return array{categories: array<string, string>, companies: array<string, string>, generics: array<string, string>, items: array<int, array<string, mixed>>}
     */
    public function loadCombinedDatasets(bool $refreshCache = false, bool $allowDownload = true, ?callable $logger = null): array
    {
        $cacheDir = $this->cacheDirectory();
        if (! is_dir($cacheDir)) {
            @mkdir($cacheDir, 0775, true);
        }

        $hfPath = $cacheDir.'/hf_medicines.csv';
        $wsPath = $cacheDir.'/wsayan_medicinedb.json';

        if ($allowDownload) {
            $this->downloadIfNeeded(self::HF_CSV_URL, $hfPath, $refreshCache, 'HuggingFace BD Medicines CSV', $logger);
            $this->downloadIfNeeded(self::WSAYAN_JSON_URL, $wsPath, $refreshCache, 'WSAyan MedicineDB JSON', $logger);
        }

        return $this->parseCachedDatasets($hfPath, $wsPath);
    }

    public function hasCachedDatasets(): bool
    {
        $cacheDir = $this->cacheDirectory();
        $hfPath = $cacheDir.'/hf_medicines.csv';
        $wsPath = $cacheDir.'/wsayan_medicinedb.json';

        return file_exists($hfPath) && filesize($hfPath) > 100000
            && file_exists($wsPath) && filesize($wsPath) > 100000;
    }

    /**
     * Auto-provision preloaded 30k+ BD medicine catalog into a newly created tenant if cache files are present.
     */
    public function provisionForNewTenantIfCached(Tenant $tenant): void
    {
        if (! $this->hasCachedDatasets()) {
            return;
        }

        $dataset = $this->loadCombinedDatasets(refreshCache: false, allowDownload: false);
        if ($dataset['items'] === []) {
            return;
        }

        $this->syncProductsForTenant($tenant, $dataset);
        $this->syncLegacyMedicinesForTenant($tenant, $dataset);
        $this->ensureOpeningBatchesForTenant($tenant);
    }

    /**
     * Import into both Catalog `products` and Inventory `medicines` tables for a tenant.
     *
     * @return array{products_inserted: int, products_skipped: int, medicines_inserted: int, medicines_skipped: int, batches_inserted: int}
     */
    public function syncForTenant(
        Tenant $tenant,
        array $dataset,
        int $limit = 0,
        ?callable $progressCallback = null
    ): array {
        $items = $dataset['items'];
        if ($limit > 0 && count($items) > $limit) {
            $items = array_slice($items, 0, $limit);
        }

        $trimmedDataset = [
            'categories' => $dataset['categories'],
            'companies' => $dataset['companies'],
            'generics' => $dataset['generics'],
            'items' => $items,
        ];

        [$pIns, $pSkip] = $this->syncProductsForTenant($tenant, $trimmedDataset, $progressCallback);
        [$mIns, $mSkip] = $this->syncLegacyMedicinesForTenant($tenant, $trimmedDataset, $progressCallback);
        $batchesInserted = $this->ensureOpeningBatchesForTenant($tenant);

        return [
            'products_inserted' => $pIns,
            'products_skipped' => $pSkip,
            'medicines_inserted' => $mIns,
            'medicines_skipped' => $mSkip,
            'batches_inserted' => $batchesInserted,
        ];
    }

    /**
     * Populate Catalog module tables (`categories`, `companies`, `generics`, `products`, `product_units`, `product_barcodes`).
     *
     * @return array{0: int, 1: int} [inserted, skipped]
     */
    public function syncProductsForTenant(Tenant $tenant, array $dataset, ?callable $progressCallback = null): array
    {
        $tenantId = $tenant->id;
        $now = now();
        $items = $dataset['items'];

        $categoryMap = $this->ensureLookupRecords('categories', $tenantId, $dataset['categories'], ['parent_id' => null], true);
        $companyMap = $this->ensureLookupRecords('companies', $tenantId, $dataset['companies']);
        $genericMap = $this->ensureLookupRecords('generics', $tenantId, $dataset['generics']);

        $existingDedupeKeys = array_flip(
            DB::table('products')->where('tenant_id', $tenantId)->whereNull('deleted_at')->pluck('dedupe_key')->all()
        );
        $existingSkus = array_flip(
            DB::table('products')->where('tenant_id', $tenantId)->whereNotNull('sku')->pluck('sku')->all()
        );
        $existingBarcodes = array_flip(
            DB::table('product_barcodes')->where('tenant_id', $tenantId)->pluck('barcode')->all()
        );

        $skuSeq = (int) DB::table('products')->where('tenant_id', $tenantId)->count() + 1;
        $barcodeSeq = $skuSeq;

        $productsBatch = [];
        $unitsBatch = [];
        $barcodesBatch = [];
        $inserted = 0;
        $skipped = 0;
        $chunkSize = 1000;

        foreach ($items as $item) {
            $companyId = $companyMap[CatalogNormalizer::normalizeText($item['company'])] ?? null;
            $genericId = $genericMap[CatalogNormalizer::normalizeText($item['generic'])] ?? null;
            $categoryId = $categoryMap[CatalogNormalizer::normalizeText($item['category'])] ?? null;

            $dedupeKey = CatalogNormalizer::dedupeKey(
                $item['name'],
                $item['strength'],
                $item['dosage_form'],
                $companyId
            );

            if (isset($existingDedupeKeys[$dedupeKey])) {
                $skipped++;
                if ($progressCallback) {
                    $progressCallback();
                }
                continue;
            }
            $existingDedupeKeys[$dedupeKey] = true;

            do {
                $sku = sprintf('BD-%06d', $skuSeq++);
            } while (isset($existingSkus[$sku]));
            $existingSkus[$sku] = true;

            do {
                $barcode = '894'.str_pad((string) ($tenantId * 10000000 + ($barcodeSeq++)), 10, '0', STR_PAD_LEFT);
            } while (isset($existingBarcodes[$barcode]));
            $existingBarcodes[$barcode] = true;

            $productId = (string) Str::uuid();
            $baseUnit = $this->determineBaseUnit($item['dosage_form']);
            $mrp = round((float) $item['mrp'], 2);
            $purchasePrice = $mrp > 0 ? round($mrp * 0.88, 2) : 0.0;

            $searchText = mb_strtolower(trim(sprintf(
                '%s %s %s %s %s %s %s %s',
                $item['name'],
                $item['strength'] ?? '',
                $item['dosage_form'],
                $sku,
                $item['generic'],
                $item['company'],
                $item['category'],
                $barcode
            )), 'UTF-8');

            $productsBatch[] = [
                'id' => $productId,
                'tenant_id' => $tenantId,
                'type' => 'medicine',
                'name' => $item['name'],
                'name_bn' => null,
                'generic_id' => $genericId,
                'company_id' => $companyId,
                'category_id' => $categoryId,
                'strength' => $item['strength'],
                'dosage_form' => $item['dosage_form'],
                'sku' => $sku,
                'base_unit' => $baseUnit,
                'mrp' => $mrp,
                'selling_price' => $mrp,
                'purchase_price' => $purchasePrice,
                'track_batch' => true,
                'is_controlled' => false,
                'default_discount_type' => null,
                'default_discount_value' => 0,
                'vat_rate' => 0,
                'is_active' => true,
                'dedupe_key' => $dedupeKey,
                'search_text' => $searchText,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            $unitsBatch[] = [
                'id' => (string) Str::uuid(),
                'tenant_id' => $tenantId,
                'product_id' => $productId,
                'unit_name' => $baseUnit,
                'conversion_to_base' => 1,
                'is_sale_unit' => true,
                'is_purchase_unit' => true,
                'is_default_sale' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (! empty($item['pack_units']) && (int) $item['pack_units'] > 1) {
                $unitsBatch[] = [
                    'id' => (string) Str::uuid(),
                    'tenant_id' => $tenantId,
                    'product_id' => $productId,
                    'unit_name' => 'pack',
                    'conversion_to_base' => (int) $item['pack_units'],
                    'is_sale_unit' => true,
                    'is_purchase_unit' => true,
                    'is_default_sale' => false,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            $barcodesBatch[] = [
                'id' => (string) Str::uuid(),
                'tenant_id' => $tenantId,
                'product_id' => $productId,
                'barcode' => $barcode,
                'source' => 'internal',
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (count($productsBatch) >= $chunkSize) {
                $inserted += $this->flushProductChunk($productsBatch, $unitsBatch, $barcodesBatch);
                $productsBatch = [];
                $unitsBatch = [];
                $barcodesBatch = [];
            }

            if ($progressCallback) {
                $progressCallback();
            }
        }

        if ($productsBatch !== []) {
            $inserted += $this->flushProductChunk($productsBatch, $unitsBatch, $barcodesBatch);
        }

        return [$inserted, $skipped];
    }

    /**
     * Also populate `medicine_categories` & `medicines` tables used by Inventory & FEFO, Batches, POS, and Sales Orders.
     *
     * @return array{0: int, 1: int} [inserted, skipped]
     */
    public function syncLegacyMedicinesForTenant(Tenant $tenant, array $dataset, ?callable $progressCallback = null): array
    {
        $tenantId = $tenant->id;
        $now = now();
        $items = $dataset['items'];

        // 1. Ensure medicine_categories (keyed by slug)
        $existingCats = DB::table('medicine_categories')
            ->where('tenant_id', $tenantId)
            ->get(['id', 'slug', 'name']);

        $catBySlug = [];
        $catByNormName = [];
        foreach ($existingCats as $c) {
            $catBySlug[$c->slug] = (int) $c->id;
            $catByNormName[CatalogNormalizer::normalizeText((string) $c->name)] = (int) $c->id;
        }

        $catsToInsert = [];
        foreach ($dataset['categories'] as $norm => $name) {
            if ($norm === '' || isset($catByNormName[$norm])) {
                continue;
            }
            $baseSlug = Str::slug($name) ?: 'cat';
            $slug = mb_substr($baseSlug, 0, 240);
            $i = 1;
            while (isset($catBySlug[$slug])) {
                $slug = mb_substr($baseSlug, 0, 230).'-'.$i++;
            }
            $catBySlug[$slug] = 0; // reserve slug
            $catsToInsert[] = [
                'tenant_id' => $tenantId,
                'name' => mb_substr($name, 0, 250),
                'slug' => $slug,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if ($catsToInsert !== []) {
            foreach (array_chunk($catsToInsert, 200) as $chunk) {
                DB::table('medicine_categories')->insert($chunk);
            }
            $reloaded = DB::table('medicine_categories')->where('tenant_id', $tenantId)->get(['id', 'name']);
            foreach ($reloaded as $c) {
                $catByNormName[CatalogNormalizer::normalizeText((string) $c->name)] = (int) $c->id;
            }
        }

        // 2. Load existing medicines signature + SKU + barcode
        $existingMeds = DB::table('medicines')
            ->where('tenant_id', $tenantId)
            ->get(['name', 'dosage_form', 'strength', 'sku', 'barcode', 'manufacturer']);

        $existingSignatures = [];
        $existingSkus = [];
        $existingBarcodes = [];

        foreach ($existingMeds as $m) {
            $existingSkus[$m->sku] = true;
            if (! empty($m->barcode)) {
                $existingBarcodes[$m->barcode] = true;
            }
            $sig = $this->buildLegacySignature(
                (string) $m->name,
                (string) ($m->strength ?? ''),
                (string) ($m->dosage_form ?? ''),
                (string) ($m->manufacturer ?? '')
            );
            $existingSignatures[$sig] = true;
        }

        $skuSeq = $existingMeds->count() + 1;
        $barcodeSeq = $skuSeq;
        $batch = [];
        $inserted = 0;
        $skipped = 0;
        $chunkSize = 1000;

        foreach ($items as $item) {
            $dosageForm = $this->cleanText($item['dosage_form'], 50) ?: 'Tablet';
            $strength = $item['strength'] !== null ? $this->cleanText($item['strength'], 64) : null;
            $sig = $this->buildLegacySignature($item['name'], $strength ?? '', $dosageForm, $item['company']);

            if (isset($existingSignatures[$sig])) {
                $skipped++;
                if ($progressCallback) {
                    $progressCallback();
                }
                continue;
            }
            $existingSignatures[$sig] = true;

            do {
                $sku = sprintf('BD-%06d', $skuSeq++);
            } while (isset($existingSkus[$sku]));
            $existingSkus[$sku] = true;

            do {
                $barcode = '894'.str_pad((string) ($tenantId * 10000000 + ($barcodeSeq++)), 10, '0', STR_PAD_LEFT);
            } while (isset($existingBarcodes[$barcode]));
            $existingBarcodes[$barcode] = true;

            $baseUnit = $this->determineBaseUnit($dosageForm);
            $formLower = strtolower($dosageForm);
            $isSolidCount = str_contains($formLower, 'tablet') || str_contains($formLower, 'capsule');
            $unitsPerStrip = $isSolidCount ? 10 : 1;
            $unitsPerBox = ! empty($item['pack_units']) && (int) $item['pack_units'] > 1
                ? (int) $item['pack_units']
                : ($isSolidCount ? 100 : 1);

            $mrp = round((float) $item['mrp'], 2);
            $purchasePrice = $mrp > 0 ? round($mrp * 0.88, 2) : 0.0;

            $batch[] = [
                'tenant_id' => $tenantId,
                'category_id' => $catByNormName[CatalogNormalizer::normalizeText($item['category'])] ?? null,
                'name' => mb_substr($item['name'], 0, 250),
                'generic_name' => mb_substr($item['generic'], 0, 250),
                'manufacturer' => mb_substr($item['company'], 0, 250),
                'sku' => $sku,
                'barcode' => $barcode,
                'dosage_form' => $dosageForm,
                'strength' => $strength !== '' ? $strength : null,
                'unit' => $baseUnit,
                'units_per_strip' => $unitsPerStrip,
                'units_per_box' => $unitsPerBox,
                'reorder_level' => $isSolidCount ? 20 : 5,
                'requires_prescription' => false,
                'default_purchase_price' => $purchasePrice,
                'box_purchase_price' => round($purchasePrice * $unitsPerBox, 2),
                'default_selling_price' => $mrp,
                'box_selling_price' => round($mrp * $unitsPerBox, 2),
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (count($batch) >= $chunkSize) {
                DB::table('medicines')->insert($batch);
                $inserted += count($batch);
                $batch = [];
            }

            if ($progressCallback) {
                $progressCallback();
            }
        }

        if ($batch !== []) {
            DB::table('medicines')->insert($batch);
            $inserted += count($batch);
        }

        return [$inserted, $skipped];
    }

    /**
     * Create an opening FEFO stock batch & StockMovement record for any active medicine
     * that currently has zero batches in the tenant's primary branch. Idempotent.
     */
    public function ensureOpeningBatchesForTenant(Tenant $tenant): int
    {
        return app(CurrentTenant::class)->run($tenant, function () use ($tenant): int {
            $tenantId = $tenant->id;
            $branchId = DB::table('branches')
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->orderByDesc('is_head_office')
                ->orderBy('id')
                ->value('id');

            if (! $branchId) {
                return 0;
            }

            $supplierId = DB::table('suppliers')
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->orderBy('id')
                ->value('id');

            $actorId = $tenant->owner_id;
            $today = now()->startOfDay();
            $now = now();
            $totalCreated = 0;

            DB::table('medicines')
                ->where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->whereNull('deleted_at')
                ->whereNotExists(function ($sub) use ($tenantId): void {
                    $sub->selectRaw('1')
                        ->from('medicine_batches')
                        ->whereColumn('medicine_batches.medicine_id', 'medicines.id')
                        ->where('medicine_batches.tenant_id', $tenantId);
                })
                ->orderBy('id')
                ->select([
                    'id',
                    'sku',
                    'default_purchase_price',
                    'default_selling_price',
                ])
                ->chunkById(1000, function ($meds) use (
                    $tenantId,
                    $branchId,
                    $supplierId,
                    $actorId,
                    $today,
                    $now,
                    &$totalCreated
                ): void {
                    $batchRows = [];
                    $chunkMedIds = [];

                    foreach ($meds as $med) {
                        $medId = (int) $med->id;
                        $chunkMedIds[] = $medId;

                        $mod = $medId % 100;
                        $expiryDays = match (true) {
                            $mod <= 1 => 18 + ($medId % 10),   // ~2% expiring <= 30d
                            $mod <= 3 => 45 + ($medId % 30),   // ~2% expiring 45-75d
                            default => 180 + ($medId % 360),   // ~96% active 6-18 months
                        };

                        $qty = 40 + (($medId * 7) % 160);
                        $purchasePrice = (float) ($med->default_purchase_price ?? 0);
                        if ($purchasePrice <= 0) {
                            $purchasePrice = 5.00;
                        }
                        $sellingPrice = (float) ($med->default_selling_price ?? 0);
                        if ($sellingPrice <= 0) {
                            $sellingPrice = round($purchasePrice * 1.25, 2);
                        }

                        $skuSlug = Str::upper(preg_replace('/[^A-Za-z0-9\-]/', '', (string) $med->sku) ?: "M{$medId}");
                        $batchNumber = mb_substr("OP-{$skuSlug}", 0, 60);

                        $batchRows[] = [
                            'tenant_id' => $tenantId,
                            'branch_id' => $branchId,
                            'medicine_id' => $medId,
                            'supplier_id' => $supplierId,
                            'batch_number' => $batchNumber,
                            'manufacturing_date' => $today->copy()->subDays(90 + ($medId % 90))->toDateString(),
                            'expiry_date' => $today->copy()->addDays($expiryDays)->toDateString(),
                            'quantity_received' => $qty,
                            'quantity_available' => $qty,
                            'purchase_price' => round($purchasePrice, 2),
                            'selling_price' => round($sellingPrice, 2),
                            'rack_location' => 'R-'.str_pad((string) (($medId % 24) + 1), 2, '0', STR_PAD_LEFT),
                            'status' => BatchStatus::ACTIVE->value,
                            'notes' => 'Auto-generated opening catalog stock batch',
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                    }

                    if ($batchRows === []) {
                        return;
                    }

                    $insertedCount = DB::table('medicine_batches')->insertOrIgnore($batchRows);
                    $totalCreated += $insertedCount;

                    $createdBatches = DB::table('medicine_batches')
                        ->where('tenant_id', $tenantId)
                        ->where('branch_id', $branchId)
                        ->whereIn('medicine_id', $chunkMedIds)
                        ->whereNotExists(function ($sub) use ($tenantId): void {
                            $sub->selectRaw('1')
                                ->from('stock_movements')
                                ->whereColumn('stock_movements.medicine_batch_id', 'medicine_batches.id')
                                ->where('stock_movements.tenant_id', $tenantId);
                        })
                        ->get(['id', 'medicine_id', 'quantity_received', 'purchase_price']);

                    $movementRows = [];
                    foreach ($createdBatches as $cb) {
                        $qty = (int) $cb->quantity_received;
                        $unitCost = (float) $cb->purchase_price;
                        $movementRows[] = [
                            'tenant_id' => $tenantId,
                            'branch_id' => $branchId,
                            'medicine_id' => (int) $cb->medicine_id,
                            'medicine_batch_id' => (int) $cb->id,
                            'user_id' => $actorId,
                            'movement_type' => StockMovementType::OPENING->value,
                            'quantity_change' => $qty,
                            'balance_before' => 0,
                            'balance_after' => $qty,
                            'unit_cost' => round($unitCost, 2),
                            'total_cost' => round($qty * $unitCost, 2),
                            'reference_type' => null,
                            'reference_id' => null,
                            'reason' => 'Opening catalog stock batch',
                            'notes' => null,
                            'occurred_at' => $now,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                    }

                    if ($movementRows !== []) {
                        DB::table('stock_movements')->insert($movementRows);
                    }
                });

            return $totalCreated;
        });
    }

    private function cacheDirectory(): string
    {
        return storage_path('app/catalog-import-cache');
    }

    private function downloadIfNeeded(string $url, string $destPath, bool $refresh, string $label, ?callable $logger = null): void
    {
        if (! $refresh && file_exists($destPath) && filesize($destPath) > 100000) {
            if ($logger) {
                $logger("  Using cached {$label}...");
            }

            return;
        }

        if ($logger) {
            $logger("  Downloading {$label}...");
        }
        $response = Http::timeout(120)->withOptions(['sink' => $destPath])->get($url);
        if (! $response->successful() || ! file_exists($destPath) || filesize($destPath) < 10000) {
            throw new \RuntimeException("Failed downloading {$label} from {$url} (HTTP {$response->status()})");
        }
    }

    /**
     * @return array{categories: array<string, string>, companies: array<string, string>, generics: array<string, string>, items: array<int, array<string, mixed>>}
     */
    private function parseCachedDatasets(string $hfPath, string $wsPath): array
    {
        $categories = [];
        $companies = [];
        $generics = [];
        $companyAliases = [];
        $genericCategoryByNorm = [];
        $seenProducts = [];
        $items = [];

        $wsJson = file_exists($wsPath) ? json_decode((string) file_get_contents($wsPath), true) : null;
        $wsBrands = [];
        $wsGenericsById = [];
        $wsCompaniesById = [];

        if (is_array($wsJson)) {
            $sysMap = [];
            foreach ($wsJson['systemics'] ?? [] as $sys) {
                if (! empty($sys['systemic_id']) && ! empty($sys['systemic_name'])) {
                    $sysMap[(string) $sys['systemic_id']] = $this->cleanText((string) $sys['systemic_name']);
                }
            }

            $therMap = [];
            foreach ($wsJson['therapatics'] ?? [] as $th) {
                $tid = (string) ($th['therapitic_id'] ?? '');
                if ($tid !== '') {
                    $sname = $sysMap[(string) ($th['therapitic_systemic_class_id'] ?? '')] ?? '';
                    $tname = $this->cleanText((string) ($th['therapitic_name'] ?? ''));
                    $therMap[$tid] = $sname !== '' ? $sname : $tname;
                }
            }

            $wsGenCategoryById = [];
            foreach ($wsJson['therapatics_generics'] ?? [] as $tg) {
                $gid = (string) ($tg['generic_id'] ?? '');
                $tid = (string) ($tg['therapitic_id'] ?? '');
                if ($gid !== '' && isset($therMap[$tid]) && ! isset($wsGenCategoryById[$gid])) {
                    $wsGenCategoryById[$gid] = $therMap[$tid];
                }
            }

            foreach ($wsJson['generics'] ?? [] as $g) {
                $gid = (string) ($g['generic_id'] ?? '');
                $gname = $this->cleanText((string) ($g['generic_name'] ?? ''), 200);
                if ($gid !== '' && $gname !== '') {
                    $wsGenericsById[$gid] = $gname;
                    $gKey = CatalogNormalizer::normalizeText($gname);
                    $generics[$gKey] = $generics[$gKey] ?? $gname;
                    if (isset($wsGenCategoryById[$gid])) {
                        $catName = $this->cleanText($wsGenCategoryById[$gid], 200);
                        if ($catName !== '') {
                            $genericCategoryByNorm[$gKey] = $catName;
                            $categories[CatalogNormalizer::normalizeText($catName)] = $catName;
                        }
                    }
                }
            }

            foreach ($wsJson['companies'] ?? [] as $c) {
                $cid = (string) ($c['company_id'] ?? '');
                $cname = $this->cleanText((string) ($c['company_name'] ?? ''), 200);
                if ($cid !== '' && $cname !== '') {
                    $wsCompaniesById[$cid] = $cname;
                    $cKey = CatalogNormalizer::normalizeText($cname);
                    $companies[$cKey] = $companies[$cKey] ?? $cname;
                    $companyAliases[$this->companyStem($cname)] = $cname;
                }
            }

            $wsBrands = is_array($wsJson['brands'] ?? null) ? $wsJson['brands'] : [];
        }

        if (file_exists($hfPath) && ($handle = fopen($hfPath, 'r')) !== false) {
            $header = fgetcsv($handle);
            $colIdx = $header ? array_flip(array_map(fn ($h) => strtolower(trim((string) $h)), $header)) : [];

            while (($row = fgetcsv($handle)) !== false) {
                $name = $this->cleanText($row[$colIdx['brand name'] ?? 1] ?? '', 220);
                if ($name === '') {
                    continue;
                }

                $rawType = strtolower(trim((string) ($row[$colIdx['type'] ?? 2] ?? 'allopathic')));
                $dosageForm = $this->cleanText($row[$colIdx['dosage form'] ?? 4] ?? 'Tablet', 120) ?: 'Tablet';
                $genericName = $this->cleanText($row[$colIdx['generic'] ?? 5] ?? 'General', 220) ?: 'General';
                $strength = $this->cleanText($row[$colIdx['strength'] ?? 6] ?? '', 120);
                $companyName = $this->cleanText($row[$colIdx['manufacturer'] ?? 7] ?? 'Local Pharma', 220) ?: 'Local Pharma';
                $pkgContainer = (string) ($row[$colIdx['package container'] ?? 8] ?? '');
                $pkgSize = (string) ($row[$colIdx['package size'] ?? 9] ?? '');

                $gKey = CatalogNormalizer::normalizeText($genericName);
                $generics[$gKey] = $generics[$gKey] ?? $genericName;

                $cKey = CatalogNormalizer::normalizeText($companyName);
                $companies[$cKey] = $companies[$cKey] ?? $companyName;
                $companyAliases[$this->companyStem($companyName)] = $companies[$cKey];

                $categoryName = $genericCategoryByNorm[$gKey]
                    ?? ($rawType === 'herbal' ? 'Herbal & Unani' : 'General Medicine');
                $catKey = CatalogNormalizer::normalizeText($categoryName);
                $categories[$catKey] = $categories[$catKey] ?? $categoryName;

                [$mrp, $packUnits] = $this->parseHfPricing($pkgContainer, $pkgSize);

                $dedupeKey = $this->buildSourceDedupeKey($name, $strength, $dosageForm, $companyName);
                if (isset($seenProducts[$dedupeKey])) {
                    continue;
                }
                $seenProducts[$dedupeKey] = true;

                $items[] = [
                    'name' => $name,
                    'generic' => $genericName,
                    'company' => $companyName,
                    'category' => $categoryName,
                    'strength' => $strength !== '' ? $strength : null,
                    'dosage_form' => $dosageForm,
                    'mrp' => $mrp,
                    'pack_units' => $packUnits,
                ];
            }
            fclose($handle);
        }

        foreach ($wsBrands as $b) {
            $name = $this->cleanText((string) ($b['brand_name'] ?? ''), 220);
            if ($name === '') {
                continue;
            }

            $dosageForm = $this->cleanText((string) ($b['form'] ?? 'Tablet'), 120) ?: 'Tablet';
            $strength = $this->cleanText((string) ($b['strength'] ?? ''), 120);
            $genericName = $wsGenericsById[(string) ($b['generic_id'] ?? '')] ?? 'General';
            $rawCompany = $wsCompaniesById[(string) ($b['company_id'] ?? '')] ?? 'Local Pharma';
            $companyName = $companyAliases[$this->companyStem($rawCompany)] ?? $rawCompany;

            $gKey = CatalogNormalizer::normalizeText($genericName);
            $generics[$gKey] = $generics[$gKey] ?? $genericName;

            $cKey = CatalogNormalizer::normalizeText($companyName);
            $companies[$cKey] = $companies[$cKey] ?? $companyName;

            $categoryName = $genericCategoryByNorm[$gKey] ?? 'General Medicine';
            $catKey = CatalogNormalizer::normalizeText($categoryName);
            $categories[$catKey] = $categories[$catKey] ?? $categoryName;

            $dedupeKey = $this->buildSourceDedupeKey($name, $strength, $dosageForm, $companyName);
            if (isset($seenProducts[$dedupeKey])) {
                continue;
            }
            $seenProducts[$dedupeKey] = true;

            [$mrp, $packUnits] = $this->parseWsPricing(
                (string) ($b['price'] ?? '0'),
                (string) ($b['packsize'] ?? '')
            );

            $items[] = [
                'name' => $name,
                'generic' => $genericName,
                'company' => $companyName,
                'category' => $categoryName,
                'strength' => $strength !== '' ? $strength : null,
                'dosage_form' => $dosageForm,
                'mrp' => $mrp,
                'pack_units' => $packUnits,
            ];
        }

        return [
            'categories' => $categories,
            'companies' => $companies,
            'generics' => $generics,
            'items' => $items,
        ];
    }

    /**
     * @param  array<string, string>  $recordsByNorm
     * @return array<string, string> normKey => uuid
     */
    private function ensureLookupRecords(
        string $table,
        int $tenantId,
        array $recordsByNorm,
        array $extraCols = [],
        bool $isCategory = false
    ): array {
        $existingQuery = DB::table($table)->where('tenant_id', $tenantId);
        if ($isCategory) {
            $existingQuery->whereNull('parent_id');
        }
        $existing = $existingQuery->get(['id', 'name']);

        $map = [];
        foreach ($existing as $row) {
            $map[CatalogNormalizer::normalizeText((string) $row->name)] = $row->id;
        }

        $now = now();
        $toInsert = [];
        foreach ($recordsByNorm as $norm => $name) {
            if ($norm === '' || isset($map[$norm])) {
                continue;
            }
            $id = (string) Str::uuid();
            $map[$norm] = $id;
            $toInsert[] = array_merge([
                'id' => $id,
                'tenant_id' => $tenantId,
                'name' => $name,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ], $extraCols);
        }

        foreach (array_chunk($toInsert, 500) as $chunk) {
            DB::table($table)->insert($chunk);
        }

        return $map;
    }

    private function flushProductChunk(array $products, array $units, array $barcodes): int
    {
        DB::transaction(function () use ($products, $units, $barcodes): void {
            DB::table('products')->insert($products);
            DB::table('product_units')->insert($units);
            DB::table('product_barcodes')->insert($barcodes);
        });

        return count($products);
    }

    private function cleanText(?string $value, int $maxLen = 200): string
    {
        if ($value === null) {
            return '';
        }

        $s = @iconv('UTF-8', 'UTF-8//IGNORE', $value) ?: $value;
        $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
        if (strtoupper($s) === 'NULL') {
            return '';
        }

        return mb_substr($s, 0, $maxLen, 'UTF-8');
    }

    private function companyStem(string $company): string
    {
        $c = CatalogNormalizer::normalizeText($company);
        $c = preg_replace('/\b(ltd|limited|pharma|pharmaceuticals|pharmaceutical|plc|inc)\b\.?/u', '', $c) ?? $c;

        return preg_replace('/[^a-z0-9]/u', '', $c) ?? $c;
    }

    private function buildSourceDedupeKey(string $name, string $strength, string $dosageForm, string $company): string
    {
        return implode('|', [
            CatalogNormalizer::normalizeText($name),
            CatalogNormalizer::normalizeStrength($strength) ?? '',
            CatalogNormalizer::normalizeText($dosageForm),
            $this->companyStem($company),
        ]);
    }

    private function buildLegacySignature(string $name, string $strength, string $dosageForm, string $company): string
    {
        return implode('|', [
            CatalogNormalizer::normalizeText($name),
            CatalogNormalizer::normalizeStrength($strength) ?? '',
            CatalogNormalizer::normalizeText(mb_substr($dosageForm, 0, 50)),
            $this->companyStem($company),
        ]);
    }

    /**
     * @return array{0: float, 1: ?int}
     */
    private function parseHfPricing(string $pkgContainer, string $pkgSize): array
    {
        $mrp = 0.0;
        if (preg_match('/Unit Price:\s*(?:৳|BDT|Tk)?\s*([\d,]+(?:\.\d+)?)/ui', $pkgContainer, $m)) {
            $mrp = (float) str_replace(',', '', $m[1]);
        } elseif (preg_match('/:\s*(?:৳|BDT|Tk)?\s*([\d,]+(?:\.\d+)?)/ui', $pkgContainer, $m)) {
            $mrp = (float) str_replace(',', '', $m[1]);
        }

        $packCount = null;
        if (preg_match('/(\d+)\s*\'s\s*pack/i', $pkgSize !== '' ? $pkgSize : $pkgContainer, $pm)) {
            $val = (int) $pm[1];
            if ($val > 1 && $val <= 5000) {
                $packCount = $val;
            }
        }

        return [min(999999.99, max(0.0, $mrp)), $packCount];
    }

    /**
     * @return array{0: float, 1: ?int}
     */
    private function parseWsPricing(string $rawPrice, string $packsize): array
    {
        $price = is_numeric($rawPrice) ? (float) $rawPrice : 0.0;
        $packCount = null;

        if (preg_match('/(\d+)\s*\'s\s*pack/i', $packsize, $pm)) {
            $val = (int) $pm[1];
            if ($val > 1 && $val <= 5000) {
                $packCount = $val;
                if ($price > 0) {
                    $price = round($price / $val, 2);
                }
            }
        }

        return [min(999999.99, max(0.0, $price)), $packCount];
    }

    private function determineBaseUnit(string $dosageForm): string
    {
        $f = strtolower($dosageForm);
        if (str_contains($f, 'syrup') || str_contains($f, 'suspension') || str_contains($f, 'solution') || str_contains($f, 'drop') || str_contains($f, 'elixir') || str_contains($f, 'wash')) {
            return 'bottle';
        }
        if (str_contains($f, 'injection') || str_contains($f, 'infusion') || str_contains($f, 'vial') || str_contains($f, 'ampoule')) {
            return 'vial';
        }
        if (str_contains($f, 'cream') || str_contains($f, 'ointment') || str_contains($f, 'gel')) {
            return 'tube';
        }
        if (str_contains($f, 'sachet') || str_contains($f, 'powder')) {
            return 'sachet';
        }

        return 'pcs';
    }
}

