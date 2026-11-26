<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Tenant;
use App\Modules\Catalog\Models\Category;
use App\Modules\Catalog\Models\Company;
use App\Modules\Catalog\Models\Generic;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\ProductBarcode;
use App\Modules\Catalog\Models\ProductBranchSetting;
use App\Modules\Catalog\Models\ProductUnit;
use App\Modules\Catalog\Services\ProductSearchIndexer;
use App\Modules\Catalog\Support\CatalogNormalizer;
use App\Tenancy\CurrentTenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CatalogModuleSeeder extends Seeder
{
    /**
     * Run the database seeds for all tenants.
     */
    public function run(): void
    {
        $tenants = Tenant::all();
        foreach ($tenants as $tenant) {
            static::seedForTenant($tenant);
        }
    }

    /**
     * Seed comprehensive categories, companies, generics, and products for a tenant.
     */
    public static function seedForTenant(Tenant $tenant): void
    {
        $currentTenant = app(CurrentTenant::class);

        $currentTenant->run($tenant, function () use ($tenant) {
            // 1. Seed Pharmaceutical Companies / Manufacturers
            $companiesData = [
                ['name' => 'Square Pharmaceuticals Ltd', 'name_bn' => 'স্কয়ার ফার্মাসিউটিক্যালস লি.'],
                ['name' => 'Beximco Pharmaceuticals Ltd', 'name_bn' => 'বেক্সিমকো ফার্মা'],
                ['name' => 'Incepta Pharmaceuticals Ltd', 'name_bn' => 'ইনসেপ্টা ফার্মাসিউটিক্যালস'],
                ['name' => 'Healthcare Pharmaceuticals Ltd', 'name_bn' => 'হেলথকেয়ার ফার্মাসিউটিক্যালস'],
                ['name' => 'Renata Limited', 'name_bn' => 'রেনাটা লিমিটেড'],
                ['name' => 'Opsonin Pharma Ltd', 'name_bn' => 'অপসোনি ফার্মা'],
                ['name' => 'ACI Limited', 'name_bn' => 'এসিআই লিমিটেড'],
                ['name' => 'Aristopharma Ltd', 'name_bn' => 'অ্যারিস্টোফার্মা'],
                ['name' => 'Eskayef Pharmaceuticals Ltd', 'name_bn' => 'এসকেএফ ফার্মা'],
                ['name' => 'The ACME Laboratories Ltd', 'name_bn' => 'একমি ল্যাবরেটরিজ'],
                ['name' => 'Drug International Ltd', 'name_bn' => 'ড্রাগ ইন্টারন্যাশনাল'],
                ['name' => 'Popular Pharmaceuticals Ltd', 'name_bn' => 'পপুলার ফার্মাসিউটিক্যালস'],
                ['name' => 'Lazz Pharma Ltd', 'name_bn' => 'লাজ ফার্মা'],
                ['name' => 'Roche Diagnostics', 'name_bn' => 'রোশ ডায়াগনস্টিকস'],
                ['name' => 'Omron Healthcare', 'name_bn' => 'ওমরন হেলথকেয়ার'],
            ];

            $companies = [];
            foreach ($companiesData as $c) {
                $comp = Company::withoutGlobalScopes()
                    ->where('tenant_id', $tenant->id)
                    ->where('name', $c['name'])
                    ->first();

                if (! $comp) {
                    $comp = Company::create([
                        'tenant_id' => $tenant->id,
                        'name' => $c['name'],
                        'name_bn' => $c['name_bn'],
                        'is_active' => true,
                    ]);
                }
                $companies[$c['name']] = $comp;
            }

            // 2. Seed Generics
            $genericsData = [
                'Paracetamol',
                'Paracetamol + Caffeine',
                'Omeprazole',
                'Esomeprazole Magnesium',
                'Pantoprazole',
                'Rabeprazole',
                'Azithromycin',
                'Cefixime',
                'Ciprofloxacin',
                'Amoxicillin + Clavulanic Acid',
                'Metformin Hydrochloride',
                'Amlodipine',
                'Amlodipine + Olmesartan',
                'Losartan Potassium',
                'Rosuvastatin',
                'Atorvastatin',
                'Montelukast',
                'Fexofenadine Hydrochloride',
                'Cetirizine Dihydrochloride',
                'Ascorbic Acid (Vitamin C)',
                'Calcium Carbonate + Vitamin D3',
                'Metronidazole',
                'Blood Glucose Test System',
                'Blood Pressure Monitor Digital',
                'Chlorhexidine Gluconate + Cetrimide',
            ];

            $generics = [];
            foreach ($genericsData as $genName) {
                $gen = Generic::withoutGlobalScopes()
                    ->where('tenant_id', $tenant->id)
                    ->where('name', $genName)
                    ->first();

                if (! $gen) {
                    $gen = Generic::create([
                        'tenant_id' => $tenant->id,
                        'name' => $genName,
                        'is_active' => true,
                    ]);
                }
                $generics[$genName] = $gen;
            }

            // 3. Seed Hierarchy Categories
            $rootCategoriesData = [
                [
                    'name' => 'Prescription Medicine',
                    'name_bn' => 'প্রেসক্রিপশন ওষুধ',
                    'children' => [
                        ['name' => 'Antibiotics & Antimicrobials', 'name_bn' => 'অ্যান্টিবায়োটিক'],
                        ['name' => 'Cardiovascular & Hypertension', 'name_bn' => 'হৃদরোগ ও রক্তচাপ'],
                        ['name' => 'Gastrointestinal & Antacids', 'name_bn' => 'গ্যাস্ট্রোইন্টেস্টাইনাল'],
                        ['name' => 'Respiratory & Antiallergic', 'name_bn' => 'শ্বাসতন্ত্র ও অ্যালার্জি'],
                        ['name' => 'Pain, Fever & Analgesics', 'name_bn' => 'ব্যথানাশক ও জ্বর'],
                        ['name' => 'Antidiabetic Care', 'name_bn' => 'ডায়াবেটিস নিয়ন্ত্রণ'],
                        ['name' => 'Central Nervous System', 'name_bn' => 'স্নায়ুতন্ত্র ও নিউরো'],
                    ],
                ],
                [
                    'name' => 'Over The Counter (OTC)',
                    'name_bn' => 'ওটিসি সাধারণ ওষুধ',
                    'children' => [
                        ['name' => 'Vitamins & Dietary Supplements', 'name_bn' => 'ভিটামিন ও পুষ্টি'],
                        ['name' => 'Dermatology & Skin Care', 'name_bn' => 'চর্মরোগ ও স্কিন কেয়ার'],
                        ['name' => 'Eye & Ear Drops', 'name_bn' => 'চোখ ও কানের ড্রপ'],
                        ['name' => 'First Aid & Antiseptics', 'name_bn' => 'ফার্স্ট এইড ও জীবাণুনাশক'],
                    ],
                ],
                [
                    'name' => 'Healthcare & Medical Devices',
                    'name_bn' => 'চিকিৎসা ও ডায়াগনস্টিক সামগ্রী',
                    'children' => [
                        ['name' => 'Blood Glucose Monitoring', 'name_bn' => 'গ্লুকোজ মনিটর'],
                        ['name' => 'Blood Pressure Monitors', 'name_bn' => 'বিপি মেশিন'],
                        ['name' => 'Nebulizers & Inhalers', 'name_bn' => 'নেবুলাইজার ও ইনহেলার'],
                    ],
                ],
                [
                    'name' => 'Mother & Baby Health',
                    'name_bn' => 'মা ও শিশু স্বাস্থ্য',
                    'children' => [
                        ['name' => 'Baby Nutrition & Diapers', 'name_bn' => 'শিশুর পুষ্টি ও ডায়াপার'],
                    ],
                ],
            ];

            $categories = [];
            foreach ($rootCategoriesData as $root) {
                $rootCat = Category::withoutGlobalScopes()
                    ->where('tenant_id', $tenant->id)
                    ->where('name', $root['name'])
                    ->first();

                if (! $rootCat) {
                    $rootCat = Category::create([
                        'tenant_id' => $tenant->id,
                        'parent_id' => null,
                        'name' => $root['name'],
                        'name_bn' => $root['name_bn'],
                        'is_active' => true,
                    ]);
                }
                $categories[$root['name']] = $rootCat;

                if (! empty($root['children'])) {
                    foreach ($root['children'] as $child) {
                        $childCat = Category::withoutGlobalScopes()
                            ->where('tenant_id', $tenant->id)
                            ->where('name', $child['name'])
                            ->first();

                        if (! $childCat) {
                            $childCat = Category::create([
                                'tenant_id' => $tenant->id,
                                'parent_id' => $rootCat->id,
                                'name' => $child['name'],
                                'name_bn' => $child['name_bn'],
                                'is_active' => true,
                            ]);
                        }
                        $categories[$child['name']] = $childCat;
                    }
                }
            }

            // 4. Seed Standard Catalog Products
            $branches = Branch::withoutGlobalScope(\App\Models\Scopes\TenantScope::class)
                ->where('tenant_id', $tenant->id)
                ->where('is_active', true)
                ->get();

            $productsData = [
                [
                    'name' => 'Napa 500mg',
                    'name_bn' => 'নাপা ৫০০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Paracetamol',
                    'company' => 'Beximco Pharmaceuticals Ltd',
                    'category' => 'Pain, Fever & Analgesics',
                    'strength' => '500mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1001',
                    'barcode' => '8941100100019',
                    'base_unit' => 'pcs',
                    'price' => 1.20,
                ],
                [
                    'name' => 'Napa Extra 500/65mg',
                    'name_bn' => 'নাপা এক্সট্রা',
                    'type' => 'medicine',
                    'generic' => 'Paracetamol + Caffeine',
                    'company' => 'Beximco Pharmaceuticals Ltd',
                    'category' => 'Pain, Fever & Analgesics',
                    'strength' => '500mg/65mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1002',
                    'barcode' => '8941100100026',
                    'base_unit' => 'pcs',
                    'price' => 2.50,
                ],
                [
                    'name' => 'Napa Extend 665mg',
                    'name_bn' => 'নাপা এক্সটেন্ড ৬৬৫ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Paracetamol',
                    'company' => 'Beximco Pharmaceuticals Ltd',
                    'category' => 'Pain, Fever & Analgesics',
                    'strength' => '665mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1003',
                    'barcode' => '8941100100033',
                    'base_unit' => 'pcs',
                    'price' => 2.00,
                ],
                [
                    'name' => 'Seclo 20mg Capsule',
                    'name_bn' => 'সেকলো ২০ মিগ্রা ক্যাপসুল',
                    'type' => 'medicine',
                    'generic' => 'Omeprazole',
                    'company' => 'Square Pharmaceuticals Ltd',
                    'category' => 'Gastrointestinal & Antacids',
                    'strength' => '20mg',
                    'dosage_form' => 'capsule',
                    'sku' => 'MED-1004',
                    'barcode' => '8941100100040',
                    'base_unit' => 'pcs',
                    'price' => 6.00,
                ],
                [
                    'name' => 'Sergel 20mg Capsule',
                    'name_bn' => 'সারজেল ২০ মিগ্রা ক্যাপসুল',
                    'type' => 'medicine',
                    'generic' => 'Esomeprazole Magnesium',
                    'company' => 'Healthcare Pharmaceuticals Ltd',
                    'category' => 'Gastrointestinal & Antacids',
                    'strength' => '20mg',
                    'dosage_form' => 'capsule',
                    'sku' => 'MED-1005',
                    'barcode' => '8941100100057',
                    'base_unit' => 'pcs',
                    'price' => 7.00,
                ],
                [
                    'name' => 'Maxpro 20mg Capsule',
                    'name_bn' => 'ম্যাক্সপ্রো ২০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Esomeprazole Magnesium',
                    'company' => 'Square Pharmaceuticals Ltd',
                    'category' => 'Gastrointestinal & Antacids',
                    'strength' => '20mg',
                    'dosage_form' => 'capsule',
                    'sku' => 'MED-1006',
                    'barcode' => '8941100100064',
                    'base_unit' => 'pcs',
                    'price' => 7.00,
                ],
                [
                    'name' => 'Pantonix 20mg Tablet',
                    'name_bn' => 'প্যান্টোনিক্স ২০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Pantoprazole',
                    'company' => 'Incepta Pharmaceuticals Ltd',
                    'category' => 'Gastrointestinal & Antacids',
                    'strength' => '20mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1007',
                    'barcode' => '8941100100071',
                    'base_unit' => 'pcs',
                    'price' => 7.00,
                ],
                [
                    'name' => 'Ceevit 250mg Chewable',
                    'name_bn' => 'সিভিট ২৫০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Ascorbic Acid (Vitamin C)',
                    'company' => 'Square Pharmaceuticals Ltd',
                    'category' => 'Vitamins & Dietary Supplements',
                    'strength' => '250mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1008',
                    'barcode' => '8941100100088',
                    'base_unit' => 'pcs',
                    'price' => 1.90,
                ],
                [
                    'name' => 'Ace Plus 500/65mg',
                    'name_bn' => 'এইস প্লাস',
                    'type' => 'medicine',
                    'generic' => 'Paracetamol + Caffeine',
                    'company' => 'Square Pharmaceuticals Ltd',
                    'category' => 'Pain, Fever & Analgesics',
                    'strength' => '500mg/65mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1009',
                    'barcode' => '8941100100095',
                    'base_unit' => 'pcs',
                    'price' => 2.50,
                ],
                [
                    'name' => 'Fexo 120mg Tablet',
                    'name_bn' => 'ফেক্সো ১২০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Fexofenadine Hydrochloride',
                    'company' => 'Square Pharmaceuticals Ltd',
                    'category' => 'Respiratory & Antiallergic',
                    'strength' => '120mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1010',
                    'barcode' => '8941100100101',
                    'base_unit' => 'pcs',
                    'price' => 9.00,
                ],
                [
                    'name' => 'Alatrol 10mg Tablet',
                    'name_bn' => 'অ্যালাট্রোল ১০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Cetirizine Dihydrochloride',
                    'company' => 'Square Pharmaceuticals Ltd',
                    'category' => 'Respiratory & Antiallergic',
                    'strength' => '10mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1011',
                    'barcode' => '8941100100118',
                    'base_unit' => 'pcs',
                    'price' => 3.50,
                ],
                [
                    'name' => 'Monas 10mg Tablet',
                    'name_bn' => 'মোনাস ১০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Montelukast',
                    'company' => 'The ACME Laboratories Ltd',
                    'category' => 'Respiratory & Antiallergic',
                    'strength' => '10mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1012',
                    'barcode' => '8941100100125',
                    'base_unit' => 'pcs',
                    'price' => 16.00,
                ],
                [
                    'name' => 'Zimax 500mg Tablet',
                    'name_bn' => 'জিম্যাক্স ৫০০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Azithromycin',
                    'company' => 'Square Pharmaceuticals Ltd',
                    'category' => 'Antibiotics & Antimicrobials',
                    'strength' => '500mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1013',
                    'barcode' => '8941100100132',
                    'base_unit' => 'pcs',
                    'price' => 35.00,
                ],
                [
                    'name' => 'Cef-3 200mg Capsule',
                    'name_bn' => 'সেফ-৩ ২০০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Cefixime',
                    'company' => 'Square Pharmaceuticals Ltd',
                    'category' => 'Antibiotics & Antimicrobials',
                    'strength' => '200mg',
                    'dosage_form' => 'capsule',
                    'sku' => 'MED-1014',
                    'barcode' => '8941100100149',
                    'base_unit' => 'pcs',
                    'price' => 45.00,
                ],
                [
                    'name' => 'Bizoran 5/20mg Tablet',
                    'name_bn' => 'বিজোরান ৫/২০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Amlodipine + Olmesartan',
                    'company' => 'Beximco Pharmaceuticals Ltd',
                    'category' => 'Cardiovascular & Hypertension',
                    'strength' => '5mg/20mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1015',
                    'barcode' => '8941100100156',
                    'base_unit' => 'pcs',
                    'price' => 18.00,
                ],
                [
                    'name' => 'Osartil 50mg Tablet',
                    'name_bn' => 'ওসারটিল ৫০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Losartan Potassium',
                    'company' => 'Incepta Pharmaceuticals Ltd',
                    'category' => 'Cardiovascular & Hypertension',
                    'strength' => '50mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1016',
                    'barcode' => '8941100100163',
                    'base_unit' => 'pcs',
                    'price' => 8.00,
                ],
                [
                    'name' => 'Lipicon 10mg Tablet',
                    'name_bn' => 'লিপিকন ১০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Atorvastatin',
                    'company' => 'Square Pharmaceuticals Ltd',
                    'category' => 'Cardiovascular & Hypertension',
                    'strength' => '10mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1017',
                    'barcode' => '8941100100170',
                    'base_unit' => 'pcs',
                    'price' => 12.00,
                ],
                [
                    'name' => 'Gluconor 500mg Tablet',
                    'name_bn' => 'গ্লুকোনোর ৫০০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Metformin Hydrochloride',
                    'company' => 'Square Pharmaceuticals Ltd',
                    'category' => 'Antidiabetic Care',
                    'strength' => '500mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1018',
                    'barcode' => '8941100100187',
                    'base_unit' => 'pcs',
                    'price' => 5.00,
                ],
                [
                    'name' => 'Coralcal-D Tablet',
                    'name_bn' => 'কোরালক্যাল-ডি',
                    'type' => 'medicine',
                    'generic' => 'Calcium Carbonate + Vitamin D3',
                    'company' => 'Renata Limited',
                    'category' => 'Vitamins & Dietary Supplements',
                    'strength' => '500mg/200IU',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1019',
                    'barcode' => '8941100100194',
                    'base_unit' => 'pcs',
                    'price' => 8.00,
                ],
                [
                    'name' => 'Amodis 400mg Tablet',
                    'name_bn' => 'অ্যামোডিস ৪০০ মিগ্রা',
                    'type' => 'medicine',
                    'generic' => 'Metronidazole',
                    'company' => 'Square Pharmaceuticals Ltd',
                    'category' => 'Gastrointestinal & Antacids',
                    'strength' => '400mg',
                    'dosage_form' => 'tablet',
                    'sku' => 'MED-1020',
                    'barcode' => '8941100100200',
                    'base_unit' => 'pcs',
                    'price' => 2.50,
                ],
                [
                    'name' => 'Accu-Chek Active Glucose Meter',
                    'name_bn' => 'আকু-চেক অ্যাক্টিভ গ্লুকোমিটার',
                    'type' => 'non_medicine',
                    'generic' => 'Blood Glucose Test System',
                    'company' => 'Roche Diagnostics',
                    'category' => 'Blood Glucose Monitoring',
                    'strength' => null,
                    'dosage_form' => null,
                    'sku' => 'DEV-2001',
                    'barcode' => '8941100200018',
                    'base_unit' => 'pcs',
                    'price' => 1850.00,
                ],
                [
                    'name' => 'Omron Digital BP Monitor HEM-7120',
                    'name_bn' => 'ওমরন ডিজিটাল বিপি মনিটর',
                    'type' => 'non_medicine',
                    'generic' => 'Blood Pressure Monitor Digital',
                    'company' => 'Omron Healthcare',
                    'category' => 'Blood Pressure Monitors',
                    'strength' => null,
                    'dosage_form' => null,
                    'sku' => 'DEV-2002',
                    'barcode' => '8941100200025',
                    'base_unit' => 'pcs',
                    'price' => 2450.00,
                ],
                [
                    'name' => 'Savlon Antiseptic Liquid 100ml',
                    'name_bn' => 'স্যাভলন অ্যান্টিসেপটিক লিকুইড ১০০ মি.লি.',
                    'type' => 'non_medicine',
                    'generic' => 'Chlorhexidine Gluconate + Cetrimide',
                    'company' => 'ACI Limited',
                    'category' => 'First Aid & Antiseptics',
                    'strength' => '100ml',
                    'dosage_form' => 'liquid',
                    'sku' => 'OTC-3001',
                    'barcode' => '8941100300015',
                    'base_unit' => 'bottle',
                    'price' => 45.00,
                ],
            ];

            foreach ($productsData as $pData) {
                $comp = $companies[$pData['company']] ?? null;
                $gen = ! empty($pData['generic']) ? ($generics[$pData['generic']] ?? null) : null;
                $cat = $categories[$pData['category']] ?? null;

                $normStrength = ! empty($pData['strength']) ? CatalogNormalizer::normalizeStrength($pData['strength']) : null;
                $dedupeKey = CatalogNormalizer::dedupeKey($pData['name'], $normStrength, $pData['dosage_form'], $comp?->id);

                $product = Product::withoutGlobalScopes()
                    ->where('tenant_id', $tenant->id)
                    ->where('sku', $pData['sku'])
                    ->first();

                $mrp = (float) ($pData['price'] ?? 0);
                $sellingPrice = $mrp;
                $purchasePrice = round($mrp * 0.85, 2);

                if (! $product) {
                    $product = Product::create([
                        'tenant_id' => $tenant->id,
                        'type' => $pData['type'],
                        'name' => $pData['name'],
                        'name_bn' => $pData['name_bn'],
                        'generic_id' => $gen?->id,
                        'company_id' => $comp?->id,
                        'category_id' => $cat?->id,
                        'strength' => $pData['strength'],
                        'dosage_form' => $pData['dosage_form'],
                        'sku' => $pData['sku'],
                        'base_unit' => $pData['base_unit'],
                        'mrp' => $mrp,
                        'selling_price' => $sellingPrice,
                        'purchase_price' => $purchasePrice,
                        'track_batch' => $pData['type'] === 'medicine',
                        'is_controlled' => false,
                        'vat_rate' => 0.00,
                        'is_active' => true,
                        'dedupe_key' => $dedupeKey,
                        'search_text' => '',
                    ]);

                    // Add units
                    ProductUnit::create([
                        'tenant_id' => $tenant->id,
                        'product_id' => $product->id,
                        'unit_name' => $pData['base_unit'],
                        'conversion_to_base' => 1,
                        'is_sale_unit' => true,
                        'is_purchase_unit' => true,
                        'is_default_sale' => true,
                    ]);

                    if ($pData['type'] === 'medicine') {
                        ProductUnit::create([
                            'tenant_id' => $tenant->id,
                            'product_id' => $product->id,
                            'unit_name' => 'strip',
                            'conversion_to_base' => 10,
                            'is_sale_unit' => true,
                            'is_purchase_unit' => true,
                            'is_default_sale' => false,
                        ]);
                        ProductUnit::create([
                            'tenant_id' => $tenant->id,
                            'product_id' => $product->id,
                            'unit_name' => 'box',
                            'conversion_to_base' => 100,
                            'is_sale_unit' => true,
                            'is_purchase_unit' => true,
                            'is_default_sale' => false,
                        ]);
                    }

                    // Add barcode
                    if (! empty($pData['barcode'])) {
                        ProductBarcode::create([
                            'tenant_id' => $tenant->id,
                            'product_id' => $product->id,
                            'barcode' => $pData['barcode'],
                            'source' => 'manufacturer',
                        ]);
                    }

                    // Branch settings
                    foreach ($branches as $branch) {
                        ProductBranchSetting::updateOrCreate(
                            [
                                'tenant_id' => $tenant->id,
                                'product_id' => $product->id,
                                'branch_id' => $branch->id,
                            ],
                            [
                                'min_stock' => 50,
                                'reorder_qty' => 200,
                                'shelf_location' => 'Rack A-1',
                            ]
                        );
                    }

                    // Build search_text
                    $product->load(['generic', 'company', 'category']);
                    $product->search_text = ProductSearchIndexer::build($product);
                    $product->save();
                } elseif ((float) $product->mrp <= 0 && $mrp > 0) {
                    $product->update([
                        'mrp' => $mrp,
                        'selling_price' => (float) $product->selling_price > 0 ? $product->selling_price : $sellingPrice,
                        'purchase_price' => (float) $product->purchase_price > 0 ? $product->purchase_price : $purchasePrice,
                    ]);
                }
            }
        });
    }
}

