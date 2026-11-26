<?php

namespace Database\Seeders;

use App\Actions\Tenancy\ProvisionTenantAccess;
use App\Enums\StockMovementType;
use App\Enums\TenantRole;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Counter;
use App\Models\CounterSession;
use App\Models\Customer;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\MedicineCategory;
use App\Models\Role;
use App\Models\SaasPlan;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\User;
use App\Services\Commercial\SubscriptionService;
use App\Tenancy\CurrentTenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DemoPharmacySeeder extends Seeder
{
    public function run(): void
    {
        $currentTenant = app(CurrentTenant::class);
        $provisionAccess = app(ProvisionTenantAccess::class);
        $subscriptionService = app(SubscriptionService::class);

        $growthPlan = SaasPlan::query()->where('key', 'growth')->first();
        $starterPlan = SaasPlan::query()->where('key', 'starter')->first();

        // 1. SaaS Platform Business Owner (Super Admin)
        User::query()->updateOrCreate(
            ['email' => 'superadmin@pharmacore.test'],
            [
                'name' => 'Platform Business Owner',
                'phone' => '+880 1700-000001',
                'password' => Hash::make('password'),
                'is_super_admin' => true,
                'account_type' => 'super_admin',
                'platform_compliance_role' => 'owner',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        // 2. Subscriber Admin 1 (owns GreenLife Pharmacy & CarePlus Medico tenants under 1 Growth subscription)
        $admin = User::query()->updateOrCreate(
            ['email' => 'admin@pharmacore.test'],
            [
                'name' => 'Dr. Mahmudul Hasan',
                'phone' => '+880 1711-000101',
                'password' => Hash::make('password'),
                'is_super_admin' => false,
                'account_type' => 'admin',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $manager = User::query()->updateOrCreate(
            ['email' => 'manager@pharmacore.test'],
            [
                'name' => 'Tariqul Islam',
                'phone' => '+880 1711-000155',
                'password' => Hash::make('password'),
                'account_type' => 'staff',
                'subscriber_id' => $admin->id,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $pharmacist = User::query()->updateOrCreate(
            ['email' => 'pharmacist@pharmacore.test'],
            [
                'name' => 'Nusrat Jahan, B.Pharm',
                'phone' => '+880 1711-000202',
                'password' => Hash::make('password'),
                'account_type' => 'staff',
                'subscriber_id' => $admin->id,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $cashier = User::query()->updateOrCreate(
            ['email' => 'cashier@pharmacore.test'],
            [
                'name' => 'Rafiqul Islam',
                'phone' => '+880 1711-000303',
                'password' => Hash::make('password'),
                'account_type' => 'staff',
                'subscriber_id' => $admin->id,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $clerk = User::query()->updateOrCreate(
            ['email' => 'clerk@pharmacore.test'],
            [
                'name' => 'Kabir Hossain',
                'phone' => '+880 1711-000404',
                'password' => Hash::make('password'),
                'account_type' => 'staff',
                'subscriber_id' => $admin->id,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $salesman = User::query()->updateOrCreate(
            ['email' => 'salesman@pharmacore.test'],
            [
                'name' => 'Mahbub Hossain',
                'phone' => '+880 1711-000505',
                'password' => Hash::make('password'),
                'account_type' => 'staff',
                'subscriber_id' => $admin->id,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        // Tenant 1: GreenLife Pharmacy & Diagnostics
        $greenlife = Tenant::query()->updateOrCreate(
            ['slug' => 'greenlife-pharmacy'],
            [
                'owner_id' => $admin->id,
                'name' => 'GreenLife Pharmacy & Diagnostics',
                'license_number' => 'DGDA-DHK-2026-4418',
                'tax_id' => 'BIN-004829104-0201',
                'email' => 'hello@greenlifepharma.bd',
                'phone' => '+880 2-9841220',
                'address' => 'House 42, Road 11, Banani Commercial Area',
                'city' => 'Dhaka',
                'country' => 'Bangladesh',
                'currency_code' => 'BDT',
                'timezone' => 'Asia/Dhaka',
                'status' => 'active',
                'settings' => [
                    'low_stock_alert_days' => 30,
                    'default_tax_rate' => 0,
                    'require_prescription_verification' => true,
                    'fefo_enabled' => true,
                ],
            ]
        );

        TenantDomain::setPrimaryForTenant($greenlife);
        TenantDomain::setPrimaryForTenant($greenlife, TenantDomain::defaultSubdomain('demo'), false);

        // Custom Role under Admin & Tenant 1
        $currentTenant->run($greenlife, function () use ($greenlife, $admin) {
            Role::query()->updateOrCreate(
                ['tenant_id' => $greenlife->id, 'slug' => 'crm_specialist', 'guard_name' => 'web'],
                [
                    'user_id' => $admin->id,
                    'name' => 'CRM & Loyalty Specialist',
                    'description' => 'Handles customer medical profiles, loyalty points & distributor follow-ups.',
                    'permissions' => ['crm.view', 'crm.manage', 'inventory.view'],
                    'is_system' => false,
                ]
            );
        });

        [$bananiBranch, $dhanmondiBranch] = $currentTenant->run($greenlife, function () use ($greenlife): array {
            $banani = Branch::query()->updateOrCreate(
                ['tenant_id' => $greenlife->id, 'code' => 'DHK-01'],
                [
                    'name' => 'Banani Head Office',
                    'phone' => '+880 1711-889900',
                    'email' => 'banani@greenlifepharma.bd',
                    'address' => 'House 42, Road 11, Banani',
                    'city' => 'Dhaka',
                    'is_head_office' => true,
                    'is_active' => true,
                ]
            );

            $dhanmondi = Branch::query()->updateOrCreate(
                ['tenant_id' => $greenlife->id, 'code' => 'DHK-02'],
                [
                    'name' => 'Dhanmondi 27 Care Point',
                    'phone' => '+880 1711-889901',
                    'email' => 'dhanmondi@greenlifepharma.bd',
                    'address' => 'Plot 18, Satmasjid Road, Dhanmondi',
                    'city' => 'Dhaka',
                    'is_head_office' => false,
                    'is_active' => true,
                ]
            );

            return [$banani, $dhanmondi];
        });

        $greenlife->users()->syncWithoutDetaching([
            $admin->id => [
                'branch_id' => $bananiBranch->id,
                'is_owner' => true,
                'role' => TenantRole::ADMIN->value,
                'roles' => json_encode([TenantRole::ADMIN->value]),
                'is_active' => true,
                'joined_at' => now()->subMonths(4),
            ],
            $manager->id => [
                'branch_id' => null,
                'is_owner' => false,
                'role' => TenantRole::MANAGER->value,
                'roles' => json_encode([TenantRole::MANAGER->value, 'crm_specialist']),
                'is_active' => true,
                'joined_at' => now()->subMonths(3),
            ],
            $pharmacist->id => [
                'branch_id' => $bananiBranch->id,
                'is_owner' => false,
                'role' => TenantRole::PHARMACIST->value,
                'roles' => json_encode([TenantRole::PHARMACIST->value, TenantRole::INVENTORY_CLERK->value]),
                'is_active' => true,
                'joined_at' => now()->subMonths(2),
            ],
            $cashier->id => [
                'branch_id' => $dhanmondiBranch->id,
                'is_owner' => false,
                'role' => TenantRole::CASHIER->value,
                'roles' => json_encode([TenantRole::CASHIER->value]),
                'is_active' => true,
                'joined_at' => now()->subWeeks(3),
            ],
            $clerk->id => [
                'branch_id' => $bananiBranch->id,
                'is_owner' => false,
                'role' => TenantRole::INVENTORY_CLERK->value,
                'roles' => json_encode([TenantRole::INVENTORY_CLERK->value]),
                'is_active' => true,
                'joined_at' => now()->subMonth(),
            ],
            $salesman->id => [
                'branch_id' => $bananiBranch->id,
                'is_owner' => false,
                'role' => TenantRole::SALESMAN->value,
                'roles' => json_encode([TenantRole::SALESMAN->value]),
                'is_active' => true,
                'joined_at' => now()->subMonth(),
            ],
        ]);

        // Tenant 2 under same Subscriber Admin 1: CarePlus Medico Hub
        $careplus = Tenant::query()->updateOrCreate(
            ['slug' => 'careplus-medico'],
            [
                'owner_id' => $admin->id,
                'name' => 'CarePlus Medico Hub',
                'license_number' => 'DGDA-CTG-2026-8821',
                'tax_id' => 'BIN-009182301-0501',
                'email' => 'support@careplusmedico.bd',
                'phone' => '+880 31-654210',
                'address' => '108 O.R. Nizam Road, GEC Circle',
                'city' => 'Chattogram',
                'country' => 'Bangladesh',
                'currency_code' => 'BDT',
                'timezone' => 'Asia/Dhaka',
                'status' => 'active',
                'settings' => [
                    'low_stock_alert_days' => 45,
                    'default_tax_rate' => 0,
                    'require_prescription_verification' => true,
                    'fefo_enabled' => true,
                ],
            ]
        );

        TenantDomain::setPrimaryForTenant($careplus);

        $ctgBranch = $currentTenant->run($careplus, function () use ($careplus): Branch {
            return Branch::query()->updateOrCreate(
                ['tenant_id' => $careplus->id, 'code' => 'CTG-01'],
                [
                    'name' => 'GEC Circle Head Office',
                    'phone' => '+880 1819-221100',
                    'email' => 'gec@careplusmedico.bd',
                    'address' => '108 O.R. Nizam Road, GEC Circle',
                    'city' => 'Chattogram',
                    'is_head_office' => true,
                    'is_active' => true,
                ]
            );
        });

        $careplus->users()->syncWithoutDetaching([
            $admin->id => [
                'branch_id' => $ctgBranch->id,
                'is_owner' => true,
                'role' => TenantRole::ADMIN->value,
                'roles' => json_encode([TenantRole::ADMIN->value]),
                'is_active' => true,
                'joined_at' => now()->subDays(10),
            ],
        ]);

        // Set current tenant defaults for Admin 1 & Team
        $admin->update(['current_tenant_id' => $greenlife->id]);
        $manager->update(['current_tenant_id' => $greenlife->id]);
        $pharmacist->update(['current_tenant_id' => $greenlife->id]);
        $cashier->update(['current_tenant_id' => $greenlife->id]);
        $salesman->update(['current_tenant_id' => $greenlife->id]);

        $provisionAccess->execute($greenlife);
        $provisionAccess->execute($careplus);

        if ($growthPlan) {
            $growthSub = $subscriptionService->activate(
                admin: $admin,
                plan: $growthPlan,
                billingCycle: 'monthly',
                paymentMethod: 'card',
                primaryTenant: $greenlife,
                idempotencyKey: 'seed-growth-admin-1',
            );

            $subscriptionService->syncModulesForTenant($greenlife, $growthPlan, $growthSub->status);
            $subscriptionService->syncModulesForTenant($careplus, $growthPlan, $growthSub->status);
        }

        // Phase 2 Plan & Features Subscription: Unlock POS, FEFO, Batches, Catalog for Demo Tenant
        $phase2PremiumPlan = \App\Modules\Billing\Models\Plan::where('code', 'premium')->first();
        if ($phase2PremiumPlan) {
            foreach ([$greenlife, $careplus] as $t) {
                $currentTenant->run($t, function () use ($t, $phase2PremiumPlan) {
                    \App\Modules\Billing\Models\Subscription::updateOrCreate(
                        ['tenant_id' => $t->id],
                        [
                            'plan_id' => $phase2PremiumPlan->id,
                            'billing_cycle' => 'yearly',
                            'status' => \App\Modules\Billing\Models\Subscription::STATUS_ACTIVE,
                            'starts_at' => now()->subMonths(1),
                            'ends_at' => now()->addYears(2),
                            'auto_renew' => true,
                        ]
                    );
                });
            }
        }

        // Seed default roles and bind role_id for demo users
        RbacPermissionCatalogSeeder::seedRolesForTenant($greenlife);
        RbacPermissionCatalogSeeder::seedRolesForTenant($careplus);

        $ownerRole = Role::withoutGlobalScopes()->where('tenant_id', $greenlife->id)->where('slug', 'owner')->first();
        $managerRole = Role::withoutGlobalScopes()->where('tenant_id', $greenlife->id)->where('slug', 'manager')->first();
        $pharmacistRole = Role::withoutGlobalScopes()->where('tenant_id', $greenlife->id)->where('slug', 'pharmacist')->first();
        $cashierRole = Role::withoutGlobalScopes()->where('tenant_id', $greenlife->id)->where('slug', 'cashier')->first();

        $admin->update(['role_id' => $ownerRole?->id]);
        $manager->update(['role_id' => $managerRole?->id]);
        $pharmacist->update(['role_id' => $pharmacistRole?->id]);
        $cashier->update(['role_id' => $cashierRole?->id]);

        // 3. Independent Second Subscriber Admin (Metro Health Pharma)
        $subscriberTwo = User::query()->updateOrCreate(
            ['email' => 'metro@pharmacore.test'],
            [
                'name' => 'Farzana Chowdhury',
                'phone' => '+880 1912-334455',
                'password' => Hash::make('password'),
                'account_type' => 'admin',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $metroTenant = Tenant::query()->updateOrCreate(
            ['slug' => 'metro-health-pharma'],
            [
                'owner_id' => $subscriberTwo->id,
                'name' => 'Metro Health Pharma',
                'license_number' => 'DGDA-SYL-2026-1190',
                'email' => 'hello@metrohealth.bd',
                'phone' => '+880 821-719201',
                'address' => 'Zindabazar Main Road, Sylhet',
                'city' => 'Sylhet',
                'country' => 'Bangladesh',
                'currency_code' => 'BDT',
                'timezone' => 'Asia/Dhaka',
                'status' => 'active',
                'settings' => [
                    'low_stock_alert_days' => 30,
                    'default_tax_rate' => 0,
                    'require_prescription_verification' => true,
                    'fefo_enabled' => true,
                ],
            ]
        );

        TenantDomain::setPrimaryForTenant($metroTenant);

        $sylhetBranch = $currentTenant->run($metroTenant, function () use ($metroTenant): Branch {
            return Branch::query()->updateOrCreate(
                ['tenant_id' => $metroTenant->id, 'code' => 'SYL-01'],
                [
                    'name' => 'Zindabazar Head Office',
                    'city' => 'Sylhet',
                    'is_head_office' => true,
                    'is_active' => true,
                ]
            );
        });

        $metroTenant->users()->syncWithoutDetaching([
            $subscriberTwo->id => [
                'branch_id' => $sylhetBranch->id,
                'is_owner' => true,
                'role' => TenantRole::ADMIN->value,
                'roles' => json_encode([TenantRole::ADMIN->value]),
                'is_active' => true,
                'joined_at' => now()->subDays(3),
            ],
        ]);

        $subscriberTwo->update(['current_tenant_id' => $metroTenant->id]);
        $provisionAccess->execute($metroTenant);

        if ($starterPlan) {
            $starterSub = $subscriptionService->activate(
                admin: $subscriberTwo,
                plan: $starterPlan,
                billingCycle: 'monthly',
                paymentMethod: 'trial',
                primaryTenant: $metroTenant,
                idempotencyKey: 'seed-starter-metro-1',
            );

            $subscriptionService->syncModulesForTenant($metroTenant, $starterPlan, $starterSub->status);
        }

        RbacPermissionCatalogSeeder::seedRolesForTenant($metroTenant);
        $metroOwnerRole = Role::withoutGlobalScopes()->where('tenant_id', $metroTenant->id)->where('slug', 'owner')->first();
        $subscriberTwo->update(['role_id' => $metroOwnerRole?->id]);

        // Seed inventory, customers, suppliers & sample invoices inside TenantScope
        $currentTenant->run($greenlife, fn () => $this->seedPrimaryTenantInventory($greenlife, $bananiBranch, $admin));
        $currentTenant->run($careplus, fn () => $this->seedCarePlusInventory($careplus, $ctgBranch, $admin));
    }

    private function seedPrimaryTenantInventory(Tenant $tenant, Branch $branch, User $user): void
    {
        $categories = [];
        foreach (['Antibiotics', 'Pain & Fever', 'Gastrointestinal', 'Cardiovascular', 'Vitamins & Supplements'] as $name) {
            $categories[$name] = MedicineCategory::query()->updateOrCreate(
                ['tenant_id' => $tenant->id, 'slug' => Str::slug($name)],
                ['name' => $name, 'is_active' => true]
            );
        }

        $supplier = Supplier::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Square Pharmaceuticals Distributors'],
            [
                'contact_person' => 'Kamrul Hasan',
                'phone' => '+880 1713-456789',
                'email' => 'orders@squaredist.bd',
                'address' => 'Tejgaon Industrial Area, Dhaka',
                'tax_number' => 'BIN-SQ-771204',
                'payment_terms' => 'Net-15',
                'is_active' => true,
            ]
        );

        Supplier::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Beximco Healthcare Logistics'],
            [
                'contact_person' => 'Sabbir Ahmed',
                'phone' => '+880 1711-334499',
                'email' => 'supply@beximcopharma.bd',
                'address' => 'Tongi Industrial Estate, Gazipur',
                'tax_number' => 'BIN-BX-221901',
                'payment_terms' => 'Net-30',
                'is_active' => true,
            ]
        );

        $medicinesData = [
            [
                'sku' => 'MED-1001',
                'barcode' => '8941100100011',
                'name' => 'Napa Extend 665mg',
                'generic_name' => 'Paracetamol',
                'manufacturer' => 'Beximco Pharma',
                'category' => 'Pain & Fever',
                'dosage_form' => 'Tablet',
                'strength' => '665 mg',
                'unit' => 'Tablet',
                'units_per_strip' => 10,
                'units_per_box' => 100,
                'reorder_level' => 100,
                'requires_prescription' => false,
                'purchase' => 1.50,
                'box_purchase' => 150.00,
                'selling' => 2.00,
                'box_selling' => 195.00,
                'batch' => 'B-2601A',
                'qty' => 420,
                'expiry_days' => 240,
                'rack' => 'A-12',
            ],
            [
                'sku' => 'MED-1002',
                'barcode' => '8941100100028',
                'name' => 'Seclo 20mg Capsule',
                'generic_name' => 'Omeprazole',
                'manufacturer' => 'Square Pharma',
                'category' => 'Gastrointestinal',
                'dosage_form' => 'Capsule',
                'strength' => '20 mg',
                'unit' => 'Capsule',
                'units_per_strip' => 10,
                'units_per_box' => 60,
                'reorder_level' => 80,
                'requires_prescription' => false,
                'purchase' => 4.20,
                'box_purchase' => 252.00,
                'selling' => 6.00,
                'box_selling' => 350.00,
                'batch' => 'SQ-8812',
                'qty' => 35,
                'expiry_days' => 190,
                'rack' => 'B-04',
            ],
            [
                'sku' => 'MED-1003',
                'barcode' => '8941100100035',
                'name' => 'Zimax 500mg Tablet',
                'generic_name' => 'Azithromycin',
                'manufacturer' => 'Square Pharma',
                'category' => 'Antibiotics',
                'dosage_form' => 'Tablet',
                'strength' => '500 mg',
                'unit' => 'Tablet',
                'units_per_strip' => 6,
                'units_per_box' => 30,
                'reorder_level' => 60,
                'requires_prescription' => true,
                'purchase' => 26.00,
                'box_purchase' => 780.00,
                'selling' => 35.00,
                'box_selling' => 1020.00,
                'batch' => 'AZ-4091',
                'qty' => 90,
                'expiry_days' => 18,
                'rack' => 'RX-02',
            ],
            [
                'sku' => 'MED-1004',
                'barcode' => '8941100100042',
                'name' => 'Bizoran 5/20mg',
                'generic_name' => 'Amlodipine + Olmesartan',
                'manufacturer' => 'Beximco Pharma',
                'category' => 'Cardiovascular',
                'dosage_form' => 'Tablet',
                'strength' => '5mg / 20mg',
                'unit' => 'Tablet',
                'units_per_strip' => 10,
                'units_per_box' => 30,
                'reorder_level' => 50,
                'requires_prescription' => true,
                'purchase' => 14.00,
                'box_purchase' => 420.00,
                'selling' => 18.00,
                'box_selling' => 525.00,
                'batch' => 'CV-1102',
                'qty' => 18,
                'expiry_days' => 25,
                'rack' => 'RX-09',
            ],
            [
                'sku' => 'MED-1005',
                'barcode' => '8941100100059',
                'name' => 'Ceevit Vitamin C 250mg',
                'generic_name' => 'Ascorbic Acid',
                'manufacturer' => 'Square Pharma',
                'category' => 'Vitamins & Supplements',
                'dosage_form' => 'Chewable Tablet',
                'strength' => '250 mg',
                'unit' => 'Tablet',
                'units_per_strip' => 10,
                'units_per_box' => 250,
                'reorder_level' => 150,
                'requires_prescription' => false,
                'purchase' => 1.35,
                'box_purchase' => 337.50,
                'selling' => 1.90,
                'box_selling' => 460.00,
                'batch' => 'VC-5520',
                'qty' => 650,
                'expiry_days' => 340,
                'rack' => 'C-01',
            ],
        ];

        $firstMed = null;
        $firstBatch = null;

        foreach ($medicinesData as $idx => $item) {
            $medicine = Medicine::query()->updateOrCreate(
                ['tenant_id' => $tenant->id, 'sku' => $item['sku']],
                [
                    'category_id' => $categories[$item['category']]->id,
                    'barcode' => $item['barcode'],
                    'name' => $item['name'],
                    'generic_name' => $item['generic_name'],
                    'manufacturer' => $item['manufacturer'],
                    'dosage_form' => $item['dosage_form'],
                    'strength' => $item['strength'],
                    'unit' => $item['unit'],
                    'units_per_strip' => $item['units_per_strip'],
                    'units_per_box' => $item['units_per_box'],
                    'reorder_level' => $item['reorder_level'],
                    'requires_prescription' => $item['requires_prescription'],
                    'default_purchase_price' => $item['purchase'],
                    'box_purchase_price' => $item['box_purchase'],
                    'default_selling_price' => $item['selling'],
                    'box_selling_price' => $item['box_selling'],
                    'is_active' => true,
                ]
            );

            $batch = MedicineBatch::query()->updateOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'branch_id' => $branch->id,
                    'medicine_id' => $medicine->id,
                    'batch_number' => $item['batch'],
                ],
                [
                    'supplier_id' => $supplier->id,
                    'expiry_date' => now()->addDays($item['expiry_days'])->toDateString(),
                    'quantity_received' => $item['qty'] + 50,
                    'quantity_available' => $item['qty'],
                    'purchase_price' => $item['purchase'],
                    'selling_price' => $item['selling'],
                    'rack_location' => $item['rack'],
                    'status' => 'active',
                ]
            );

            if (! StockMovement::query()->where('medicine_batch_id', $batch->id)->exists()) {
                StockMovement::query()->create([
                    'branch_id' => $branch->id,
                    'medicine_id' => $medicine->id,
                    'medicine_batch_id' => $batch->id,
                    'user_id' => $user->id,
                    'movement_type' => StockMovementType::OPENING->value,
                    'quantity_change' => (int) $batch->quantity_received,
                    'balance_before' => 0,
                    'balance_after' => (int) $batch->quantity_received,
                    'unit_cost' => (float) $batch->purchase_price,
                    'total_cost' => round((int) $batch->quantity_received * (float) $batch->purchase_price, 2),
                    'reference_type' => MedicineBatch::class,
                    'reference_id' => $batch->id,
                    'reason' => 'Seeded opening FEFO batch',
                    'occurred_at' => now()->subDays(5),
                ]);
            }

            if ($idx === 0) {
                $firstMed = $medicine;
                $firstBatch = $batch;
            }
        }

        $customer = Customer::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'phone' => '+880 1811-223344'],
            [
                'name' => 'Tanvir Ahmed',
                'email' => 'tanvir.ahmed@example.com',
                'address' => 'Banani Block C, Dhaka',
                'allergies' => 'Penicillin sensitivity',
                'loyalty_points' => 140,
            ]
        );

        Customer::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'phone' => '+880 1715-667788'],
            [
                'name' => 'Samira Hossain',
                'email' => 'samira.h@example.com',
                'address' => 'Gulshan-2, Dhaka',
                'allergies' => 'Sulfa drugs',
                'loyalty_points' => 85,
            ]
        );

        if ($firstMed && $firstBatch && ! Sale::query()->where('invoice_number', 'INV-2026-0001')->exists()) {
            $sale = Sale::query()->create([
                'branch_id' => $branch->id,
                'customer_id' => $customer->id,
                'user_id' => $user->id,
                'invoice_number' => 'INV-2026-0001',
                'subtotal' => 240.00,
                'discount_amount' => 0,
                'tax_amount' => 0,
                'total_amount' => 240.00,
                'paid_amount' => 240.00,
                'payment_method' => 'cash',
                'payment_status' => 'paid',
                'sold_at' => now()->subHours(3),
            ]);

            SaleItem::query()->create([
                'sale_id' => $sale->id,
                'medicine_id' => $firstMed->id,
                'medicine_batch_id' => $firstBatch->id,
                'quantity' => 120,
                'unit_price' => 2.00,
                'line_total' => 240.00,
            ]);
        }

        // Seed branch counters & active session
        $c1 = Counter::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'code' => 'C-01'],
            [
                'name' => 'Main OPD Dispensing',
                'type' => 'opd',
                'zone' => 'Ground Floor Area A',
                'status' => 'active',
                'current_user_id' => $user->id,
                'is_active' => true,
            ]
        );

        $session1 = CounterSession::query()->firstOrCreate(
            ['counter_id' => $c1->id, 'status' => 'open'],
            [
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'user_id' => $user->id,
                'opened_at' => now()->subHours(4),
                'opening_float' => 2000.00,
                'system_expected_cash' => 2240.00,
                'total_sales_amount' => 240.00,
                'total_transactions' => 1,
            ]
        );

        if (isset($sale)) {
            $sale->update([
                'counter_id' => $c1->id,
                'counter_session_id' => $session1->id,
            ]);
        }

        Counter::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'code' => 'C-02'],
            [
                'name' => 'Cashier & Billing Station',
                'type' => 'billing',
                'zone' => 'Central Cash Counter',
                'status' => 'closed',
                'is_active' => true,
            ]
        );

        Counter::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'code' => 'C-03'],
            [
                'name' => 'Express & Baby Care',
                'type' => 'express',
                'zone' => 'Retail Wing',
                'status' => 'closed',
                'is_active' => true,
            ]
        );

        Counter::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'code' => 'C-04'],
            [
                'name' => 'Emergency 24/7 Counter',
                'type' => 'emergency',
                'zone' => 'Emergency Wing',
                'status' => 'closed',
                'is_active' => true,
            ]
        );

        if (! AuditLog::query()->where('action', 'inventory.batch_verified')->exists()) {
            AuditLog::record(
                action: 'inventory.batch_verified',
                description: 'Verified initial FEFO stock batches for Banani Head Office.',
                metadata: ['branch' => 'DHK-01'],
                tenantId: $tenant->id,
                userId: $user->id,
            );
        }
    }

    private function seedCarePlusInventory(Tenant $tenant, Branch $branch, User $user): void
    {
        $category = MedicineCategory::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'slug' => 'antibiotics'],
            ['name' => 'Antibiotics', 'is_active' => true]
        );

        $med = Medicine::query()->updateOrCreate(
            ['tenant_id' => $tenant->id, 'sku' => 'CP-2001'],
            [
                'category_id' => $category->id,
                'barcode' => '8941100200018',
                'name' => 'Sergel 20mg Capsule',
                'generic_name' => 'Esomeprazole',
                'manufacturer' => 'Healthcare Pharma',
                'dosage_form' => 'Capsule',
                'strength' => '20 mg',
                'unit' => 'Capsule',
                'units_per_strip' => 10,
                'units_per_box' => 60,
                'reorder_level' => 50,
                'requires_prescription' => false,
                'default_purchase_price' => 5.00,
                'box_purchase_price' => 300.00,
                'default_selling_price' => 7.00,
                'box_selling_price' => 410.00,
            ]
        );

        $cpBatch = MedicineBatch::query()->updateOrCreate(
            [
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'medicine_id' => $med->id,
                'batch_number' => 'CPB-091',
            ],
            [
                'expiry_date' => now()->addMonths(8)->toDateString(),
                'quantity_received' => 300,
                'quantity_available' => 280,
                'purchase_price' => 5.00,
                'selling_price' => 7.00,
                'rack_location' => 'G-02',
                'status' => 'active',
            ]
        );

        if (! StockMovement::query()->where('medicine_batch_id', $cpBatch->id)->exists()) {
            StockMovement::query()->create([
                'branch_id' => $branch->id,
                'medicine_id' => $med->id,
                'medicine_batch_id' => $cpBatch->id,
                'user_id' => $user->id,
                'movement_type' => StockMovementType::OPENING->value,
                'quantity_change' => 300,
                'balance_before' => 0,
                'balance_after' => 300,
                'unit_cost' => 5.00,
                'total_cost' => 1500.00,
                'reference_type' => MedicineBatch::class,
                'reference_id' => $cpBatch->id,
                'reason' => 'Seeded opening FEFO batch',
                'occurred_at' => now()->subDays(4),
            ]);
        }

        if (! AuditLog::query()->where('action', 'tenant.initialized')->exists()) {
            AuditLog::record(
                action: 'tenant.initialized',
                description: 'Initialized CarePlus Medico Hub tenant under Growth subscription.',
                metadata: ['branch' => 'CTG-01'],
                tenantId: $tenant->id,
                userId: $user->id,
            );
        }
    }
}
