<?php

namespace App\Console\Commands;

use App\Enums\BatchStatus;
use App\Enums\StockMovementType;
use App\Models\Branch;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\MedicineCategory;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\CurrentTenant;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ImportharmaCoreCatalog extends Command
{
    protected $signature = 'lazzpharma:import {--tenant= : Tenant ID or slug to import into (default: all active tenants)}';
    protected $description = 'Import products, categories, suppliers, and active batches from lazzpharma.com into the tenant database';

    public function handle(CurrentTenant $currentTenant): int
    {
        $this->info('Starting Lazz Pharma catalog import...');

        $tenantFilter = $this->option('tenant');
        $tenantsQuery = Tenant::query()->where('status', 'active');
        if ($tenantFilter) {
            $tenantsQuery->where(function ($q) use ($tenantFilter) {
                if (is_numeric($tenantFilter)) {
                    $q->where('id', (int) $tenantFilter);
                } else {
                    $q->where('slug', $tenantFilter);
                }
            });
        }

        $tenants = $tenantsQuery->get();
        if ($tenants->isEmpty()) {
            $this->error('No matching active tenant found.');
            return self::FAILURE;
        }

        $catalog = $this->fetchLazzPharmaData();
        $this->info(sprintf('Fetched %d categories and %d products from Lazz Pharma + essential BD pharma list.', count($catalog['categories']), count($catalog['products'])));

        foreach ($tenants as $tenant) {
            $this->info("Importing into Tenant #{$tenant->id}: {$tenant->name}...");
            $currentTenant->run($tenant, function () use ($tenant, $catalog) {
                $this->importCatalogForTenant($tenant, $catalog);
            });
        }

        $this->info('Lazz Pharma catalog import completed successfully!');
        return self::SUCCESS;
    }

    private function fetchLazzPharmaData(): array
    {
        $categoriesMap = [];
        $products = [];

        // 1. Attempt to fetch live from lazzpharma.com/app-globals.js
        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept' => '*/*',
            ])->timeout(10)->get('https://www.lazzpharma.com/app-globals.js');

            if ($response->successful()) {
                $content = $response->body();
                if (preg_match('/var appData\s*=\s*(\[.*?\]);?\s*(?:try|$)/s', $content, $matches)) {
                    $appData = json_decode($matches[1], true);
                    if (is_array($appData) && count($appData) >= 5) {
                        // appData[0] is categories list
                        if (isset($appData[0]) && is_array($appData[0])) {
                            foreach ($appData[0] as $cat) {
                                if (isset($cat[1]) && is_string($cat[1])) {
                                    $catName = trim($cat[1]);
                                    $categoriesMap[$catName] = $catName;
                                }
                            }
                        }

                        // appData[4] is products grouped by category
                        if (isset($appData[4]) && is_array($appData[4])) {
                            foreach ($appData[4] as $group) {
                                $groupCatName = isset($group[1]) ? trim($group[1]) : 'Prescription Medicine';
                                if (isset($group[2]) && is_array($group[2])) {
                                    foreach ($group[2] as $p) {
                                        $name = isset($p[1]) ? trim($p[1]) : '';
                                        if (!$name) continue;

                                        $rawForm = isset($p[2]) ? trim((string) $p[2]) : '';
                                        $price = isset($p[3]) ? (float) $p[3] : 10.00;
                                        $generic = isset($p[7]) ? trim((string) $p[7]) : '';
                                        $dosageForm = isset($p[10]) ? trim((string) $p[10]) : 'Tablet';
                                        $manufacturer = isset($p[11]) && trim((string) $p[11]) !== '' ? trim((string) $p[11]) : 'Lazz Pharma Ltd.';

                                        $products[] = [
                                            'name' => $name,
                                            'category' => $groupCatName,
                                            'form_unit' => $rawForm,
                                            'price' => max(1.0, $price),
                                            'generic' => $generic,
                                            'dosage_form' => $dosageForm,
                                            'manufacturer' => $manufacturer,
                                        ];
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            $this->warn('Could not fetch live Lazz Pharma script: ' . $e->getMessage() . '. Using built-in comprehensive catalog.');
        }

        // 2. High-demand Bangladeshi Pharmacy Medicines to guarantee complete coverage
        $standardMedicines = [
            [
                'name' => 'Napa 500mg Tablet',
                'category' => 'Pain & Fever',
                'form_unit' => '500 mg',
                'price' => 1.20,
                'generic' => 'Paracetamol',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Beximco Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Napa Extra 500mg/65mg',
                'category' => 'Pain & Fever',
                'form_unit' => '500mg/65mg',
                'price' => 2.50,
                'generic' => 'Paracetamol + Caffeine',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Beximco Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Napa Extend 665mg',
                'category' => 'Pain & Fever',
                'form_unit' => '665 mg',
                'price' => 2.00,
                'generic' => 'Paracetamol',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Beximco Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Seclo 20mg Capsule',
                'category' => 'Gastrointestinal',
                'form_unit' => '20 mg',
                'price' => 6.00,
                'generic' => 'Omeprazole',
                'dosage_form' => 'Capsule',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Sergel 20mg Capsule',
                'category' => 'Gastrointestinal',
                'form_unit' => '20 mg',
                'price' => 7.00,
                'generic' => 'Esomeprazole Magnesium',
                'dosage_form' => 'Capsule',
                'manufacturer' => 'Healthcare Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Maxpro 20mg Capsule',
                'category' => 'Gastrointestinal',
                'form_unit' => '20 mg',
                'price' => 7.00,
                'generic' => 'Esomeprazole Magnesium',
                'dosage_form' => 'Capsule',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Ceevit 250mg Chewable',
                'category' => 'Supplements & Vitamins',
                'form_unit' => '250 mg',
                'price' => 1.90,
                'generic' => 'Ascorbic Acid (Vitamin C)',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Ace Plus 500mg/65mg',
                'category' => 'Pain & Fever',
                'form_unit' => '500mg/65mg',
                'price' => 2.50,
                'generic' => 'Paracetamol + Caffeine',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Fexo 120mg Tablet',
                'category' => 'Prescription Medicine',
                'form_unit' => '120 mg',
                'price' => 9.00,
                'generic' => 'Fexofenadine Hydrochloride',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Alatrol 10mg Tablet',
                'category' => 'OTC Medicine',
                'form_unit' => '10 mg',
                'price' => 3.50,
                'generic' => 'Cetirizine Hydrochloride',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Monas 10mg Tablet',
                'category' => 'Prescription Medicine',
                'form_unit' => '10 mg',
                'price' => 16.00,
                'generic' => 'Montelukast Sodium',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'The ACME Laboratories Ltd',
            ],
            [
                'name' => 'Tofen 1mg Tablet',
                'category' => 'Prescription Medicine',
                'form_unit' => '1 mg',
                'price' => 2.50,
                'generic' => 'Ketotifen Fumarate',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Beximco Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Finix 20mg Tablet',
                'category' => 'Gastrointestinal',
                'form_unit' => '20 mg',
                'price' => 7.00,
                'generic' => 'Rabeprazole Sodium',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Opsonin Pharma Ltd',
            ],
            [
                'name' => 'Losectil 20mg Capsule',
                'category' => 'Gastrointestinal',
                'form_unit' => '20 mg',
                'price' => 5.50,
                'generic' => 'Omeprazole',
                'dosage_form' => 'Capsule',
                'manufacturer' => 'Eskayef Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Pantonix 20mg Tablet',
                'category' => 'Gastrointestinal',
                'form_unit' => '20 mg',
                'price' => 7.00,
                'generic' => 'Pantoprazole Sodium',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Incepta Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Bicozin Syrup 100ml',
                'category' => 'Supplements & Vitamins',
                'form_unit' => '100 ml',
                'price' => 75.00,
                'generic' => 'Vitamin B Complex + Zinc',
                'dosage_form' => 'Syrup',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Calbo D Tablet',
                'category' => 'Supplements & Vitamins',
                'form_unit' => '500mg+200IU',
                'price' => 7.00,
                'generic' => 'Calcium Carbonate + Vitamin D3',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Filwel Gold Tablet',
                'category' => 'Supplements & Vitamins',
                'form_unit' => '32 Nutrients',
                'price' => 12.00,
                'generic' => 'Multivitamin & Multimineral (A to Z)',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Torax 10mg Tablet',
                'category' => 'Pain & Fever',
                'form_unit' => '10 mg',
                'price' => 12.00,
                'generic' => 'Ketorolac Tromethamine',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Zimax 500mg Tablet',
                'category' => 'Antibiotics',
                'form_unit' => '500 mg',
                'price' => 35.00,
                'generic' => 'Azithromycin Dihydrate',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Ciprocin 500mg Tablet',
                'category' => 'Antibiotics',
                'form_unit' => '500 mg',
                'price' => 15.00,
                'generic' => 'Ciprofloxacin Hydrochloride',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Moxacil 500mg Capsule',
                'category' => 'Antibiotics',
                'form_unit' => '500 mg',
                'price' => 7.50,
                'generic' => 'Amoxicillin Trihydrate',
                'dosage_form' => 'Capsule',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'D-Rise 20000 IU Capsule',
                'category' => 'Supplements & Vitamins',
                'form_unit' => '20,000 IU',
                'price' => 40.00,
                'generic' => 'Cholecalciferol (Vitamin D3)',
                'dosage_form' => 'Capsule',
                'manufacturer' => 'Square Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Bizoran 5/20mg Tablet',
                'category' => 'Cardiovascular',
                'form_unit' => '5mg/20mg',
                'price' => 18.00,
                'generic' => 'Amlodipine + Olmesartan Medoxomil',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Beximco Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Rivotril 0.5mg Tablet',
                'category' => 'Prescription Medicine',
                'form_unit' => '0.5 mg',
                'price' => 6.00,
                'generic' => 'Clonazepam',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Radiant Pharmaceuticals Ltd',
            ],
            [
                'name' => 'Renova 500mg Tablet',
                'category' => 'Pain & Fever',
                'form_unit' => '500 mg',
                'price' => 1.20,
                'generic' => 'Paracetamol',
                'dosage_form' => 'Tablet',
                'manufacturer' => 'Opsonin Pharma Ltd',
            ],
            [
                'name' => 'E-Cap 400 IU Capsule',
                'category' => 'Supplements & Vitamins',
                'form_unit' => '400 IU',
                'price' => 6.50,
                'generic' => 'Vitamin E (d-alpha Tocopherol)',
                'dosage_form' => 'Capsule',
                'manufacturer' => 'Drug International Ltd',
            ],
        ];

        // Ensure category map has standard categories
        $standardCategories = [
            'Prescription Medicine',
            'OTC Medicine',
            'Antibiotics',
            'Pain & Fever',
            'Gastrointestinal',
            'Cardiovascular',
            'Supplements & Vitamins',
            'Diabetic Accessories',
            'Skin Care Products',
            'Personal Care',
            'Dental & Oral Care',
            'Baby Products',
            'Women\'s Care',
            'Men\'s Care',
            'Herbal Supplements',
            'Surgical Product',
            'Food & Groceries',
        ];

        foreach ($standardCategories as $cat) {
            $categoriesMap[$cat] = $cat;
        }

        // Merge products, avoiding duplicates
        $seen = [];
        $uniqueProducts = [];

        foreach ($products as $p) {
            $key = strtolower(trim($p['name']));
            if (!isset($seen[$key])) {
                $seen[$key] = true;
                $uniqueProducts[] = $p;
            }
        }

        foreach ($standardMedicines as $p) {
            $key = strtolower(trim($p['name']));
            if (!isset($seen[$key])) {
                $seen[$key] = true;
                $uniqueProducts[] = $p;
            }
        }

        return [
            'categories' => array_values($categoriesMap),
            'products' => $uniqueProducts,
        ];
    }

    private function importCatalogForTenant(Tenant $tenant, array $catalog): void
    {
        // 1. Ensure Suppliers exist
        $suppliers = [
            'Square Pharmaceuticals Distributors' => ['Kamrul Hasan', '+880 1713-456789', 'orders@squaredist.bd'],
            'Beximco Healthcare Logistics' => ['Sabbir Ahmed', '+880 1711-334499', 'supply@beximcopharma.bd'],
            'Incepta Supply Chain Network' => ['Tanvir Rahman', '+880 1711-889900', 'orders@inceptapharma.com'],
            'Healthcare Pharma Distributors' => ['Nazrul Islam', '+880 1819-556677', 'distribution@hplbd.com'],
            'Lazz Pharma Direct Procurement' => ['Lazz Central Warehouse', '+880 1319-864049', 'procurement@lazzpharma.bd'],
        ];

        $supplierModels = [];
        foreach ($suppliers as $name => $info) {
            $supplierModels[$name] = Supplier::query()->updateOrCreate(
                ['tenant_id' => $tenant->id, 'name' => $name],
                [
                    'contact_person' => $info[0],
                    'phone' => $info[1],
                    'email' => $info[2],
                    'address' => 'Dhaka Industrial Zone, Bangladesh',
                    'tax_number' => 'BIN-BD-' . rand(100000, 999999),
                    'payment_terms' => 'Net-30',
                    'is_active' => true,
                ]
            );
        }

        $defaultSupplier = reset($supplierModels);

        // 2. Ensure Categories exist
        $categoryModels = [];
        foreach ($catalog['categories'] as $catName) {
            $slug = Str::slug($catName);
            if (!$slug) {
                $slug = 'cat-' . rand(1000, 9999);
            }

            $categoryModels[$catName] = MedicineCategory::query()->updateOrCreate(
                ['tenant_id' => $tenant->id, 'slug' => $slug],
                [
                    'name' => $catName,
                    'description' => "Official {$catName} collection imported from Lazz Pharma catalog.",
                    'is_active' => true,
                ]
            );
        }

        // 3. Branches of this tenant
        $branches = $tenant->branches()->where('is_active', true)->get();
        if ($branches->isEmpty()) {
            $headBranch = Branch::query()->create([
                'tenant_id' => $tenant->id,
                'code' => 'HQ-01',
                'name' => $tenant->name . ' Main Branch',
                'phone' => $tenant->phone ?? '+880 1700-000000',
                'email' => $tenant->email ?? 'main@pharmacy.test',
                'address' => $tenant->address ?? 'Main Road, Dhaka',
                'city' => $tenant->city ?? 'Dhaka',
                'is_head_office' => true,
                'is_active' => true,
            ]);
            $branches = collect([$headBranch]);
        }

        $actorUser = User::query()->where('current_tenant_id', $tenant->id)->first()
            ?? User::query()->first();

        // 4. Import Medicines and Batches
        $skuCounter = 1001;
        $existingHighestSku = Medicine::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('sku', 'LIKE', 'MED-%')
            ->pluck('sku')
            ->map(fn ($s) => (int) str_replace('MED-', '', $s))
            ->max();

        if ($existingHighestSku && $existingHighestSku >= 1000) {
            $skuCounter = $existingHighestSku + 1;
        }

        $createdMedicinesCount = 0;
        $createdBatchesCount = 0;

        foreach ($catalog['products'] as $idx => $p) {
            $catName = $p['category'] ?? 'Prescription Medicine';
            $category = $categoryModels[$catName] ?? reset($categoryModels);

            // Determine dosage form and packaging
            $dosageForm = $this->normalizeDosageForm($p['dosage_form'] ?? '');
            $unit = $this->determineUnit($dosageForm);
            $unitsPerStrip = in_array($dosageForm, ['Tablet', 'Capsule']) ? 10 : 1;
            $unitsPerBox = in_array($dosageForm, ['Tablet', 'Capsule']) ? (rand(0, 1) ? 100 : 60) : 1;

            $sellingPrice = round((float) $p['price'], 2);
            if ($sellingPrice <= 0) $sellingPrice = 10.00;

            $boxSellingPrice = $unitsPerBox > 1
                ? round($sellingPrice * $unitsPerBox * 0.98, 2)
                : $sellingPrice;

            $purchasePrice = round($sellingPrice * 0.82, 2);
            $boxPurchasePrice = round($boxSellingPrice * 0.82, 2);

            // Match supplier based on manufacturer
            $mfgLower = strtolower($p['manufacturer'] ?? '');
            $assignedSupplier = $defaultSupplier;
            foreach ($supplierModels as $sName => $sModel) {
                if (str_contains($mfgLower, 'square') && str_contains(strtolower($sName), 'square')) {
                    $assignedSupplier = $sModel;
                    break;
                }
                if (str_contains($mfgLower, 'beximco') && str_contains(strtolower($sName), 'beximco')) {
                    $assignedSupplier = $sModel;
                    break;
                }
                if (str_contains($mfgLower, 'incepta') && str_contains(strtolower($sName), 'incepta')) {
                    $assignedSupplier = $sModel;
                    break;
                }
                if (str_contains($mfgLower, 'healthcare') && str_contains(strtolower($sName), 'healthcare')) {
                    $assignedSupplier = $sModel;
                    break;
                }
            }

            // Prescription requirement
            $requiresPrescription = in_array($catName, ['Prescription Medicine', 'Antibiotics', 'Cardiovascular'])
                || in_array($dosageForm, ['Injection', 'Inhaler']);

            // Find existing or create new
            $medicine = Medicine::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->where('name', $p['name'])
                ->first();

            if (!$medicine) {
                $sku = 'MED-' . str_pad($skuCounter++, 4, '0', STR_PAD_LEFT);
                $barcode = '8941' . str_pad($tenant->id, 2, '0', STR_PAD_LEFT) . str_pad($skuCounter, 6, '0', STR_PAD_LEFT);

                $strength = !empty($p['form_unit']) && $p['form_unit'] !== '.' && $p['form_unit'] !== '..'
                    ? trim($p['form_unit'])
                    : null;

                $medicine = Medicine::query()->create([
                    'tenant_id' => $tenant->id,
                    'category_id' => $category?->id,
                    'name' => $p['name'],
                    'generic_name' => !empty($p['generic']) ? $p['generic'] : null,
                    'manufacturer' => !empty($p['manufacturer']) ? $p['manufacturer'] : 'Lazz Pharma Ltd',
                    'sku' => $sku,
                    'barcode' => $barcode,
                    'dosage_form' => $dosageForm,
                    'strength' => $strength,
                    'unit' => $unit,
                    'units_per_strip' => $unitsPerStrip,
                    'units_per_box' => $unitsPerBox,
                    'reorder_level' => in_array($dosageForm, ['Tablet', 'Capsule']) ? 50 : 15,
                    'requires_prescription' => $requiresPrescription,
                    'default_purchase_price' => $purchasePrice,
                    'box_purchase_price' => $boxPurchasePrice,
                    'default_selling_price' => $sellingPrice,
                    'box_selling_price' => $boxSellingPrice,
                    'is_active' => true,
                ]);
                $createdMedicinesCount++;
            }

            // Seed batches for branches
            foreach ($branches as $bIdx => $branch) {
                $hasBatch = MedicineBatch::withoutGlobalScopes()
                    ->where('tenant_id', $tenant->id)
                    ->where('branch_id', $branch->id)
                    ->where('medicine_id', $medicine->id)
                    ->exists();

                if (!$hasBatch) {
                    // Create authentic batch
                    $batchPrefix = strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $medicine->manufacturer ?? 'LP'), 0, 2));
                    if (strlen($batchPrefix) < 2) $batchPrefix = 'LP';
                    $batchNo = $batchPrefix . '-26' . str_pad(($idx + 1) * 3 + $bIdx, 4, '0', STR_PAD_LEFT);

                    // A few items expiring soon for FEFO warning test
                    if ($idx === 0) {
                        $expiry = Carbon::now()->addDays(22); // 22d left (amber)
                    } elseif ($idx === 1) {
                        $expiry = Carbon::now()->addDays(6);  // 6d left (rose)
                    } else {
                        $expiry = Carbon::now()->addMonths(rand(12, 32));
                    }

                    // Stock quantity: a few low stock for testing
                    if ($idx === 3 && in_array($dosageForm, ['Tablet', 'Capsule'])) {
                        $qtyAvailable = 18; // below reorder level (50)
                        $qtyReceived = 500;
                    } elseif ($idx === 4) {
                        $qtyAvailable = 12; // below reorder level
                        $qtyReceived = 300;
                    } else {
                        $qtyAvailable = in_array($dosageForm, ['Tablet', 'Capsule']) ? rand(200, 800) : rand(20, 120);
                        $qtyReceived = $qtyAvailable + rand(50, 200);
                    }

                    $batch = MedicineBatch::query()->create([
                        'tenant_id' => $tenant->id,
                        'branch_id' => $branch->id,
                        'medicine_id' => $medicine->id,
                        'supplier_id' => $assignedSupplier?->id,
                        'batch_number' => $batchNo,
                        'manufacturing_date' => Carbon::now()->subMonths(rand(2, 6))->toDateString(),
                        'expiry_date' => $expiry->toDateString(),
                        'quantity_received' => $qtyReceived,
                        'quantity_available' => $qtyAvailable,
                        'purchase_price' => $medicine->default_purchase_price,
                        'selling_price' => $medicine->default_selling_price,
                        'rack_location' => in_array($dosageForm, ['Syrup', 'Drop'])
                            ? 'Fridge-' . rand(1, 2)
                            : 'Rack ' . chr(65 + ($idx % 5)) . '-' . str_pad(($idx % 15) + 1, 2, '0', STR_PAD_LEFT),
                        'status' => BatchStatus::ACTIVE->value,
                    ]);

                    // Record initial stock movement
                    StockMovement::query()->create([
                        'tenant_id' => $tenant->id,
                        'branch_id' => $branch->id,
                        'medicine_id' => $medicine->id,
                        'medicine_batch_id' => $batch->id,
                        'user_id' => $actorUser?->id,
                        'movement_type' => StockMovementType::OPENING->value,
                        'quantity_change' => $qtyAvailable,
                        'balance_before' => 0,
                        'balance_after' => $qtyAvailable,
                        'unit_cost' => $medicine->default_purchase_price,
                        'total_cost' => round($medicine->default_purchase_price * $qtyAvailable, 2),
                        'reference_type' => 'Lazz Pharma Catalog Import',
                        'reference_id' => $batch->id,
                        'reason' => 'Opening stock from Lazz Pharma catalog',
                        'occurred_at' => Carbon::now()->subDays(rand(1, 5)),
                    ]);

                    $createdBatchesCount++;
                }
            }
        }

        $this->line("  ✓ Added {$createdMedicinesCount} new medicines and {$createdBatchesCount} new branch batches for {$tenant->name}.");
        \Database\Seeders\CatalogModuleSeeder::seedForTenant($tenant);
    }

    private function normalizeDosageForm(string $raw): string
    {
        $raw = strtolower(trim($raw));
        if (str_contains($raw, 'tab')) return 'Tablet';
        if (str_contains($raw, 'cap')) return 'Capsule';
        if (str_contains($raw, 'syrup') || str_contains($raw, 'susp')) return 'Syrup';
        if (str_contains($raw, 'device') || str_contains($raw, 'surg')) return 'Device';
        if (str_contains($raw, 'wash') || str_contains($raw, 'oral')) return 'Mouthwash';
        if (str_contains($raw, 'soap') || str_contains($raw, 'cream') || str_contains($raw, 'gel')) return 'Topical';
        if (str_contains($raw, 'insulin') || str_contains($raw, 'pen')) return 'Insulin';
        if (str_contains($raw, 'drop')) return 'Drops';
        if (str_contains($raw, 'powder')) return 'Powder';
        if (str_contains($raw, 'food') || str_contains($raw, 'toil')) return 'Consumer';
        return 'Tablet';
    }

    private function determineUnit(string $dosageForm): string
    {
        return match ($dosageForm) {
            'Tablet' => 'Tablet',
            'Capsule' => 'Capsule',
            'Syrup', 'Mouthwash', 'Drops' => 'Bottle',
            'Device', 'Insulin', 'Topical', 'Consumer', 'Powder' => 'Piece',
            default => 'Piece',
        };
    }
}
