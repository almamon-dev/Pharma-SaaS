<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Modules\Billing\Models\Addon;
use App\Modules\Billing\Models\Feature;
use App\Modules\Billing\Models\Plan;
use App\Modules\Billing\Models\PlanFeature;
use App\Modules\Billing\Models\PlanPrice;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class Phase2PlansAndFeaturesSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Seed Features Catalog
        $features = [
            // Boolean Features
            ['key' => 'pos', 'type' => 'boolean', 'group_name' => 'Sales', 'description' => 'Point of Sale (POS) Terminal & Receipts', 'sort' => 1],
            ['key' => 'inventory', 'type' => 'boolean', 'group_name' => 'Inventory', 'description' => 'Medicine Inventory & Dual Pricing', 'sort' => 2],
            ['key' => 'batch_expiry', 'type' => 'boolean', 'group_name' => 'Inventory', 'description' => 'Batch Management & FEFO Expiry Tracking', 'sort' => 3],
            ['key' => 'stock_transfer', 'type' => 'boolean', 'group_name' => 'Inventory', 'description' => 'Inter-branch Stock Transfers', 'sort' => 4],
            ['key' => 'purchase', 'type' => 'boolean', 'group_name' => 'Purchasing', 'description' => 'Purchase Orders & Supplier Invoices', 'sort' => 5],
            ['key' => 'returns', 'type' => 'boolean', 'group_name' => 'Sales', 'description' => 'Customer & Supplier Returns', 'sort' => 6],
            ['key' => 'import_export', 'type' => 'boolean', 'group_name' => 'Catalog', 'description' => 'Bulk Excel/CSV Import & Export', 'sort' => 7],
            ['key' => 'barcode_labels', 'type' => 'boolean', 'group_name' => 'Catalog', 'description' => 'Barcode Generation & Label Printing', 'sort' => 8],
            ['key' => 'customer_ledger', 'type' => 'boolean', 'group_name' => 'CRM', 'description' => 'Customer Credit Ledger & Due Tracking', 'sort' => 9],
            ['key' => 'supplier_ledger', 'type' => 'boolean', 'group_name' => 'Purchasing', 'description' => 'Supplier Credit & Payment History', 'sort' => 10],
            ['key' => 'sms_alerts', 'type' => 'boolean', 'group_name' => 'Communication', 'description' => 'Automated SMS Notifications to Patients', 'sort' => 11],
            ['key' => 'refill_reminders', 'type' => 'boolean', 'group_name' => 'Communication', 'description' => 'Chronic Medication Refill Reminders', 'sort' => 12],
            ['key' => 'controlled_drug_register', 'type' => 'boolean', 'group_name' => 'Compliance', 'description' => 'Schedule/Narcotics Compliance Register', 'sort' => 13],
            ['key' => 'audit_log_view', 'type' => 'boolean', 'group_name' => 'Compliance', 'description' => 'Detailed Audit Trail & Activity Logs', 'sort' => 14],
            ['key' => 'bank_reconciliation', 'type' => 'boolean', 'group_name' => 'Accounting', 'description' => 'Bank Account Reconciliation', 'sort' => 15],
            ['key' => 'period_closing', 'type' => 'boolean', 'group_name' => 'Accounting', 'description' => 'Financial Month/Year Period Closing', 'sort' => 16],
            ['key' => 'team_rbac', 'type' => 'boolean', 'group_name' => 'Organization', 'description' => 'Team RBAC & Custom Role Matrices', 'sort' => 17],
            ['key' => 'branches', 'type' => 'boolean', 'group_name' => 'Organization', 'description' => 'Multi-Branch Operations & Scopes', 'sort' => 18],

            // Limit Features
            ['key' => 'max_branches', 'type' => 'limit', 'group_name' => 'Organization', 'description' => 'Maximum Pharmacy Branches Allowed', 'sort' => 20],
            ['key' => 'max_users', 'type' => 'limit', 'group_name' => 'Organization', 'description' => 'Maximum Active Employees / Staff', 'sort' => 21],
            ['key' => 'max_products', 'type' => 'limit', 'group_name' => 'Catalog', 'description' => 'Maximum Active Medicine Catalog Items', 'sort' => 22],
            ['key' => 'max_bills_month', 'type' => 'limit', 'group_name' => 'Sales', 'description' => 'Monthly POS Invoice Bill Limit', 'sort' => 23],
            ['key' => 'log_retention_days', 'type' => 'limit', 'group_name' => 'Compliance', 'description' => 'Audit & Stock Movement Log Retention (Days)', 'sort' => 24],
            ['key' => 'sms_quota_month', 'type' => 'limit', 'group_name' => 'Communication', 'description' => 'Monthly SMS Messaging Quota', 'sort' => 25],
            ['key' => 'export_rows_per_file', 'type' => 'limit', 'group_name' => 'Reporting', 'description' => 'Maximum Rows Allowed Per Data Export', 'sort' => 26],

            // Level Features
            ['key' => 'report_level', 'type' => 'level', 'group_name' => 'Reporting', 'description' => 'Analytics and Reporting Depth (basic/detailed/advanced)', 'sort' => 30],
            ['key' => 'accounts_level', 'type' => 'level', 'group_name' => 'Accounting', 'description' => 'Accounting Depth (basic/full)', 'sort' => 31],
        ];

        foreach ($features as $f) {
            Feature::updateOrCreate(['key' => $f['key']], $f);
        }

        // 2. Seed Plans
        $plansData = [
            [
                'code' => 'basic',
                'name' => 'Basic',
                'is_active' => true,
                'is_public' => true,
                'sort' => 1,
                'prices' => [
                    ['billing_cycle' => 'monthly', 'amount' => 999.00],
                    ['billing_cycle' => 'yearly', 'amount' => 9990.00],
                ],
                'features' => [
                    'pos' => ['bool_value' => true],
                    'inventory' => ['bool_value' => true],
                    'batch_expiry' => ['bool_value' => false],
                    'stock_transfer' => ['bool_value' => false],
                    'purchase' => ['bool_value' => true],
                    'returns' => ['bool_value' => true],
                    'import_export' => ['bool_value' => false],
                    'barcode_labels' => ['bool_value' => false],
                    'customer_ledger' => ['bool_value' => true],
                    'supplier_ledger' => ['bool_value' => true],
                    'sms_alerts' => ['bool_value' => false],
                    'refill_reminders' => ['bool_value' => false],
                    'controlled_drug_register' => ['bool_value' => false],
                    'audit_log_view' => ['bool_value' => false],
                    'bank_reconciliation' => ['bool_value' => false],
                    'period_closing' => ['bool_value' => false],
                    'team_rbac' => ['bool_value' => true],
                    'branches' => ['bool_value' => true],

                    'max_branches' => ['limit_value' => 1],
                    'max_users' => ['limit_value' => 2],
                    'max_products' => ['limit_value' => 2000],
                    'max_bills_month' => ['limit_value' => 1500],
                    'log_retention_days' => ['limit_value' => 30],
                    'sms_quota_month' => ['limit_value' => 0],
                    'export_rows_per_file' => ['limit_value' => 500],

                    'report_level' => ['level_value' => 'basic'],
                    'accounts_level' => ['level_value' => 'basic'],
                ],
            ],
            [
                'code' => 'standard',
                'name' => 'Standard',
                'is_active' => true,
                'is_public' => true,
                'sort' => 2,
                'prices' => [
                    ['billing_cycle' => 'monthly', 'amount' => 2499.00],
                    ['billing_cycle' => 'yearly', 'amount' => 24990.00],
                ],
                'features' => [
                    'pos' => ['bool_value' => true],
                    'inventory' => ['bool_value' => true],
                    'batch_expiry' => ['bool_value' => true],
                    'stock_transfer' => ['bool_value' => true],
                    'purchase' => ['bool_value' => true],
                    'returns' => ['bool_value' => true],
                    'import_export' => ['bool_value' => true],
                    'barcode_labels' => ['bool_value' => true],
                    'customer_ledger' => ['bool_value' => true],
                    'supplier_ledger' => ['bool_value' => true],
                    'sms_alerts' => ['bool_value' => false],
                    'refill_reminders' => ['bool_value' => false],
                    'controlled_drug_register' => ['bool_value' => false],
                    'audit_log_view' => ['bool_value' => true],
                    'bank_reconciliation' => ['bool_value' => false],
                    'period_closing' => ['bool_value' => false],
                    'team_rbac' => ['bool_value' => true],
                    'branches' => ['bool_value' => true],

                    'max_branches' => ['limit_value' => 3],
                    'max_users' => ['limit_value' => 5],
                    'max_products' => ['limit_value' => 10000],
                    'max_bills_month' => ['limit_value' => 10000],
                    'log_retention_days' => ['limit_value' => 365],
                    'sms_quota_month' => ['limit_value' => 0],
                    'export_rows_per_file' => ['limit_value' => 5000],

                    'report_level' => ['level_value' => 'detailed'],
                    'accounts_level' => ['level_value' => 'full'],
                ],
            ],
            [
                'code' => 'premium',
                'name' => 'Premium',
                'is_active' => true,
                'is_public' => true,
                'sort' => 3,
                'prices' => [
                    ['billing_cycle' => 'monthly', 'amount' => 4999.00],
                    ['billing_cycle' => 'yearly', 'amount' => 49990.00],
                ],
                'features' => [
                    'pos' => ['bool_value' => true],
                    'inventory' => ['bool_value' => true],
                    'batch_expiry' => ['bool_value' => true],
                    'stock_transfer' => ['bool_value' => true],
                    'purchase' => ['bool_value' => true],
                    'returns' => ['bool_value' => true],
                    'import_export' => ['bool_value' => true],
                    'barcode_labels' => ['bool_value' => true],
                    'customer_ledger' => ['bool_value' => true],
                    'supplier_ledger' => ['bool_value' => true],
                    'sms_alerts' => ['bool_value' => true],
                    'refill_reminders' => ['bool_value' => true],
                    'controlled_drug_register' => ['bool_value' => true],
                    'audit_log_view' => ['bool_value' => true],
                    'bank_reconciliation' => ['bool_value' => true],
                    'period_closing' => ['bool_value' => true],
                    'team_rbac' => ['bool_value' => true],
                    'branches' => ['bool_value' => true],

                    'max_branches' => ['limit_value' => null], // unlimited
                    'max_users' => ['limit_value' => 20],
                    'max_products' => ['limit_value' => null], // unlimited
                    'max_bills_month' => ['limit_value' => null], // unlimited
                    'log_retention_days' => ['limit_value' => null], // unlimited
                    'sms_quota_month' => ['limit_value' => 500],
                    'export_rows_per_file' => ['limit_value' => 50000],

                    'report_level' => ['level_value' => 'advanced'],
                    'accounts_level' => ['level_value' => 'full'],
                ],
            ],
            [
                'code' => 'trial',
                'name' => '14-Day Free Trial',
                'is_active' => true,
                'is_public' => false, // hidden from browse plans
                'sort' => 4,
                'prices' => [
                    ['billing_cycle' => 'monthly', 'amount' => 0.00],
                    ['billing_cycle' => 'yearly', 'amount' => 0.00],
                ],
                'features' => [
                    'pos' => ['bool_value' => true],
                    'inventory' => ['bool_value' => true],
                    'batch_expiry' => ['bool_value' => true],
                    'stock_transfer' => ['bool_value' => true],
                    'purchase' => ['bool_value' => true],
                    'returns' => ['bool_value' => true],
                    'import_export' => ['bool_value' => true],
                    'barcode_labels' => ['bool_value' => true],
                    'customer_ledger' => ['bool_value' => true],
                    'supplier_ledger' => ['bool_value' => true],
                    'sms_alerts' => ['bool_value' => true],
                    'refill_reminders' => ['bool_value' => true],
                    'controlled_drug_register' => ['bool_value' => true],
                    'audit_log_view' => ['bool_value' => true],
                    'bank_reconciliation' => ['bool_value' => true],
                    'period_closing' => ['bool_value' => true],
                    'team_rbac' => ['bool_value' => true],
                    'branches' => ['bool_value' => true],

                    'max_branches' => ['limit_value' => 1],
                    'max_users' => ['limit_value' => 3],
                    'max_products' => ['limit_value' => 1000],
                    'max_bills_month' => ['limit_value' => 1000],
                    'log_retention_days' => ['limit_value' => 365],
                    'sms_quota_month' => ['limit_value' => 0],
                    'export_rows_per_file' => ['limit_value' => 1000],

                    'report_level' => ['level_value' => 'advanced'],
                    'accounts_level' => ['level_value' => 'full'],
                ],
            ],
        ];

        foreach ($plansData as $pData) {
            $plan = Plan::updateOrCreate(
                ['code' => $pData['code']],
                [
                    'name' => $pData['name'],
                    'is_active' => $pData['is_active'],
                    'is_public' => $pData['is_public'],
                    'sort' => $pData['sort'],
                ]
            );

            // Prices
            foreach ($pData['prices'] as $price) {
                PlanPrice::updateOrCreate(
                    ['plan_id' => $plan->id, 'billing_cycle' => $price['billing_cycle']],
                    ['amount' => $price['amount'], 'currency' => 'BDT']
                );
            }

            // Plan Features
            foreach ($pData['features'] as $fKey => $fVals) {
                PlanFeature::updateOrCreate(
                    ['plan_id' => $plan->id, 'feature_key' => $fKey],
                    [
                        'bool_value' => $fVals['bool_value'] ?? null,
                        'limit_value' => $fVals['limit_value'] ?? null,
                        'level_value' => $fVals['level_value'] ?? null,
                    ]
                );
            }
        }

        // 3. Seed Addons
        $addons = [
            ['code' => 'extra_branch', 'name' => 'Extra Branch (+1)', 'feature_key' => 'max_branches', 'extra_limit' => 1, 'price' => 500.00, 'is_active' => true],
            ['code' => 'extra_users_5', 'name' => 'Extra 5 Staff Users', 'feature_key' => 'max_users', 'extra_limit' => 5, 'price' => 1000.00, 'is_active' => true],
            ['code' => 'sms_pack_1000', 'name' => '1,000 SMS Bundle', 'feature_key' => 'sms_quota_month', 'extra_limit' => 1000, 'price' => 400.00, 'is_active' => true],
        ];

        foreach ($addons as $addon) {
            Addon::updateOrCreate(['code' => $addon['code']], $addon);
        }

        // 4. Link Permissions requires_feature (Master Prompt Section 4.3)
        $permLinks = [
            'batch.view' => 'batch_expiry',
            'batch.create' => 'batch_expiry',
            'batch.adjust' => 'batch_expiry',
            'inventory.adjust' => 'batch_expiry',
            'transfer.create' => 'stock_transfer',
            'transfer.approve' => 'stock_transfer',
            'transfer.receive' => 'stock_transfer',
            'purchase.order' => 'purchase',
            'purchase.receive' => 'purchase',
            'purchase.pay' => 'purchase',
            'return.sale' => 'returns',
            'return.purchase' => 'returns',
            'catalog.import' => 'import_export',
            'catalog.export' => 'import_export',
            'catalog.barcode' => 'barcode_labels',
            'audit.view' => 'audit_log_view',
            'accounting.reconcile' => 'bank_reconciliation',
            'accounting.closing' => 'period_closing',
            'controlled_drug.view' => 'controlled_drug_register',
            'controlled_drug.dispense' => 'controlled_drug_register',
        ];

        foreach ($permLinks as $permKey => $featureKey) {
            Permission::where('key', $permKey)
                ->orWhere('name', $permKey)
                ->update(['requires_feature' => $featureKey]);
        }
    }
}

