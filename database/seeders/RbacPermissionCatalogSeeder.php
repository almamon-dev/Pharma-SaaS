<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Modules\Core\Models\RoleLimit;
use App\Modules\Core\Models\RolePermission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RbacPermissionCatalogSeeder extends Seeder
{
    /**
     * Catalog of all system permissions per Section 4.3.
     */
    public static function permissionsCatalog(): array
    {
        return [
            // Dashboard
            ['key' => 'dashboard.view', 'module' => 'Dashboard', 'action' => 'view', 'description' => 'View operational dashboard & sales counters', 'is_sensitive' => false, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'dashboard.view_profit', 'module' => 'Dashboard', 'action' => 'view_profit', 'description' => 'View business gross profit & margins', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],

            // Sales / POS
            ['key' => 'sale.create', 'module' => 'Sales', 'action' => 'create', 'description' => 'Create POS bill checkout', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sale.view', 'module' => 'Sales', 'action' => 'view', 'description' => 'View sales invoices & history', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => true],
            ['key' => 'sale.hold', 'module' => 'Sales', 'action' => 'hold', 'description' => 'Hold and recall active customer bills', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sale.void', 'module' => 'Sales', 'action' => 'void', 'description' => 'Void an active or completed invoice', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sale.return', 'module' => 'Sales', 'action' => 'return', 'description' => 'Process customer medicine returns', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sale.reprint', 'module' => 'Sales', 'action' => 'reprint', 'description' => 'Reprint thermal receipts (marked DUPLICATE)', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sale.backdate', 'module' => 'Sales', 'action' => 'backdate', 'description' => 'Backdate sales invoices within allowed window', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'credit_sale.create', 'module' => 'Sales', 'action' => 'create_due', 'description' => 'Sell on credit / customer due balance', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'discount.apply', 'module' => 'Sales', 'action' => 'discount', 'description' => 'Apply bill discount within role limit cap', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'discount.manage', 'module' => 'Sales', 'action' => 'manage_discount', 'description' => 'Override discount caps or configure campaigns', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'price.override', 'module' => 'Sales', 'action' => 'price_override', 'description' => 'Manually edit MRP selling price at POS checkout', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'below_cost.approve', 'module' => 'Sales', 'action' => 'below_cost_approve', 'description' => 'Approve sale priced below purchase cost', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],

            // Catalog & Inventory
            ['key' => 'product.view', 'module' => 'Catalog', 'action' => 'view', 'description' => 'View medicine catalog and pricing', 'is_sensitive' => false, 'requires_feature' => 'inventory', 'supports_scope' => false],
            ['key' => 'product.manage', 'module' => 'Catalog', 'action' => 'manage', 'description' => 'Create & edit medicines, strengths & packaging', 'is_sensitive' => false, 'requires_feature' => 'inventory', 'supports_scope' => false],
            ['key' => 'product.delete', 'module' => 'Catalog', 'action' => 'delete', 'description' => 'Archive or soft delete medicines', 'is_sensitive' => true, 'requires_feature' => 'inventory', 'supports_scope' => false],
            ['key' => 'product.import', 'module' => 'Catalog', 'action' => 'import', 'description' => 'Bulk import medicines via Excel/CSV', 'is_sensitive' => false, 'requires_feature' => 'import_export', 'supports_scope' => false],
            ['key' => 'product.export', 'module' => 'Catalog', 'action' => 'export', 'description' => 'Export medicine list to Excel', 'is_sensitive' => false, 'requires_feature' => 'import_export', 'supports_scope' => false],
            ['key' => 'barcode.print', 'module' => 'Catalog', 'action' => 'barcode', 'description' => 'Print barcode labels for medicines', 'is_sensitive' => false, 'requires_feature' => 'barcode_labels', 'supports_scope' => false],
            ['key' => 'cost_price.view', 'module' => 'Catalog', 'action' => 'cost_view', 'description' => 'View supplier purchase cost price', 'is_sensitive' => true, 'requires_feature' => 'inventory', 'supports_scope' => false],
            ['key' => 'stock.view', 'module' => 'Inventory', 'action' => 'view', 'description' => 'View current physical stock quantities', 'is_sensitive' => false, 'requires_feature' => 'inventory', 'supports_scope' => true],
            ['key' => 'stock.adjust', 'module' => 'Inventory', 'action' => 'adjust', 'description' => 'Record stock adjustments & shrinkage write-offs', 'is_sensitive' => true, 'requires_feature' => 'inventory', 'supports_scope' => false],
            ['key' => 'stock.count', 'module' => 'Inventory', 'action' => 'count', 'description' => 'Perform physical stock audits and reconciliation', 'is_sensitive' => false, 'requires_feature' => 'inventory', 'supports_scope' => false],
            ['key' => 'stock.transfer_send', 'module' => 'Inventory', 'action' => 'transfer_send', 'description' => 'Initiate branch stock transfer dispatch', 'is_sensitive' => false, 'requires_feature' => 'stock_transfer', 'supports_scope' => false],
            ['key' => 'stock.transfer_receive', 'module' => 'Inventory', 'action' => 'transfer_receive', 'description' => 'Accept incoming branch stock transfer', 'is_sensitive' => false, 'requires_feature' => 'stock_transfer', 'supports_scope' => false],
            ['key' => 'batch.view', 'module' => 'Inventory', 'action' => 'batch_view', 'description' => 'View batch numbers and expiry dates', 'is_sensitive' => false, 'requires_feature' => 'batch_expiry', 'supports_scope' => false],
            ['key' => 'batch.manage', 'module' => 'Inventory', 'action' => 'batch_manage', 'description' => 'Add opening or restocked medicine batches', 'is_sensitive' => false, 'requires_feature' => 'batch_expiry', 'supports_scope' => false],
            ['key' => 'batch.writeoff', 'module' => 'Inventory', 'action' => 'batch_writeoff', 'description' => 'Write off expired or damaged medicine batches', 'is_sensitive' => true, 'requires_feature' => 'batch_expiry', 'supports_scope' => false],
            ['key' => 'movement.view', 'module' => 'Inventory', 'action' => 'movement_view', 'description' => 'View append-only audit trail of stock movements', 'is_sensitive' => false, 'requires_feature' => 'inventory', 'supports_scope' => true],

            // Purchasing
            ['key' => 'po.manage', 'module' => 'Purchasing', 'action' => 'manage', 'description' => 'Create & manage purchase orders', 'is_sensitive' => false, 'requires_feature' => 'purchase', 'supports_scope' => false],
            ['key' => 'purchase.view', 'module' => 'Purchasing', 'action' => 'view', 'description' => 'View purchase invoices and supplier receipts', 'is_sensitive' => false, 'requires_feature' => 'purchase', 'supports_scope' => false],
            ['key' => 'purchase.create', 'module' => 'Purchasing', 'action' => 'create', 'description' => 'Record stock purchase with bonus units', 'is_sensitive' => false, 'requires_feature' => 'purchase', 'supports_scope' => false],
            ['key' => 'purchase.approve', 'module' => 'Purchasing', 'action' => 'approve', 'description' => 'Approve purchase orders above threshold', 'is_sensitive' => true, 'requires_feature' => 'purchase', 'supports_scope' => false],
            ['key' => 'purchase.return', 'module' => 'Purchasing', 'action' => 'return', 'description' => 'Return medicines to supplier with credit note', 'is_sensitive' => true, 'requires_feature' => 'purchase', 'supports_scope' => false],

            // CRM & Partners
            ['key' => 'customer.view', 'module' => 'CRM', 'action' => 'view', 'description' => 'View patients/customers profile and history', 'is_sensitive' => false, 'requires_feature' => 'crm', 'supports_scope' => false],
            ['key' => 'customer.manage', 'module' => 'CRM', 'action' => 'manage', 'description' => 'Create and edit customer records', 'is_sensitive' => false, 'requires_feature' => 'crm', 'supports_scope' => false],
            ['key' => 'customer.credit_limit', 'module' => 'CRM', 'action' => 'credit_limit', 'description' => 'Set or adjust customer credit limit', 'is_sensitive' => true, 'requires_feature' => 'crm', 'supports_scope' => false],
            ['key' => 'customer.collect_due', 'module' => 'CRM', 'action' => 'collect_due', 'description' => 'Receive customer due payment & issue receipt', 'is_sensitive' => false, 'requires_feature' => 'crm', 'supports_scope' => false],
            ['key' => 'supplier.view', 'module' => 'CRM', 'action' => 'view', 'description' => 'View suppliers directory and contacts', 'is_sensitive' => false, 'requires_feature' => 'crm', 'supports_scope' => false],
            ['key' => 'supplier.manage', 'module' => 'CRM', 'action' => 'manage', 'description' => 'Create and edit medicine distributors/suppliers', 'is_sensitive' => false, 'requires_feature' => 'crm', 'supports_scope' => false],
            ['key' => 'supplier.view_balance', 'module' => 'CRM', 'action' => 'view_balance', 'description' => 'View supplier payable balance and ledger', 'is_sensitive' => true, 'requires_feature' => 'crm', 'supports_scope' => false],
            ['key' => 'supplier.pay', 'module' => 'CRM', 'action' => 'pay', 'description' => 'Make payments to suppliers via cash or bank', 'is_sensitive' => true, 'requires_feature' => 'crm', 'supports_scope' => false],
            ['key' => 'ledger.view', 'module' => 'CRM', 'action' => 'ledger_view', 'description' => 'View customer/supplier statement ledgers', 'is_sensitive' => false, 'requires_feature' => 'crm', 'supports_scope' => false],

            // Accounts (Double-Entry)
            ['key' => 'account.view', 'module' => 'Accounts', 'action' => 'view', 'description' => 'View chart of accounts and balances', 'is_sensitive' => false, 'requires_feature' => 'accounts_level', 'supports_scope' => false],
            ['key' => 'coa.manage', 'module' => 'Accounts', 'action' => 'manage', 'description' => 'Manage accounts hierarchy and head names', 'is_sensitive' => true, 'requires_feature' => 'accounts_level', 'supports_scope' => false],
            ['key' => 'expense.manage', 'module' => 'Accounts', 'action' => 'expense', 'description' => 'Record shop operating expenses and vouchers', 'is_sensitive' => false, 'requires_feature' => 'accounts_level', 'supports_scope' => false],
            ['key' => 'voucher.create', 'module' => 'Accounts', 'action' => 'voucher_create', 'description' => 'Create receipt/payment/journal voucher', 'is_sensitive' => false, 'requires_feature' => 'accounts_level', 'supports_scope' => false],
            ['key' => 'voucher.approve', 'module' => 'Accounts', 'action' => 'voucher_approve', 'description' => 'Approve accounting vouchers for ledger post', 'is_sensitive' => true, 'requires_feature' => 'accounts_level', 'supports_scope' => false],
            ['key' => 'journal.manual', 'module' => 'Accounts', 'action' => 'journal_manual', 'description' => 'Post manual balanced journal entries', 'is_sensitive' => true, 'requires_feature' => 'accounts_level', 'supports_scope' => false],
            ['key' => 'bank.reconcile', 'module' => 'Accounts', 'action' => 'reconcile', 'description' => 'Perform bank account reconciliation', 'is_sensitive' => true, 'requires_feature' => 'bank_reconciliation', 'supports_scope' => false],
            ['key' => 'period.close', 'module' => 'Accounts', 'action' => 'period_close', 'description' => 'Perform month-end and fiscal year closing', 'is_sensitive' => true, 'requires_feature' => 'period_closing', 'supports_scope' => false],
            ['key' => 'shift.open_close', 'module' => 'Accounts', 'action' => 'shift_manage', 'description' => 'Open, declare cash drawer & close register shift', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => true],
            ['key' => 'shift.view_all', 'module' => 'Accounts', 'action' => 'shift_view_all', 'description' => 'View all employee cash shifts across branches', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],

            // Reports
            ['key' => 'report.sales', 'module' => 'Reports', 'action' => 'view_sales', 'description' => 'View sales & register breakdown reports', 'is_sensitive' => false, 'requires_feature' => null, 'supports_scope' => true],
            ['key' => 'report.profit', 'module' => 'Reports', 'action' => 'view_profit', 'description' => 'View profit and loss / margins reports', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'report.stock', 'module' => 'Reports', 'action' => 'view_stock', 'description' => 'View stock valuation and reorder reports', 'is_sensitive' => false, 'requires_feature' => 'inventory', 'supports_scope' => false],
            ['key' => 'report.expiry', 'module' => 'Reports', 'action' => 'view_expiry', 'description' => 'View batch expiry warnings and disposal reports', 'is_sensitive' => false, 'requires_feature' => 'batch_expiry', 'supports_scope' => false],
            ['key' => 'report.accounts', 'module' => 'Reports', 'action' => 'view_accounts', 'description' => 'View trial balance, balance sheet & cash flow', 'is_sensitive' => true, 'requires_feature' => 'accounts_level', 'supports_scope' => false],
            ['key' => 'report.export', 'module' => 'Reports', 'action' => 'export', 'description' => 'Export sensitive financial reports to Excel/PDF', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],

            // Organization & Settings
            ['key' => 'branch.manage', 'module' => 'Organization', 'action' => 'manage_branch', 'description' => 'Create and configure pharmacy branches', 'is_sensitive' => true, 'requires_feature' => 'branches', 'supports_scope' => false],
            ['key' => 'user.manage', 'module' => 'Organization', 'action' => 'manage_user', 'description' => 'Add employees and assign system roles', 'is_sensitive' => true, 'requires_feature' => 'team_rbac', 'supports_scope' => false],
            ['key' => 'role.manage', 'module' => 'Organization', 'action' => 'manage_role', 'description' => 'Configure custom roles, scopes and limits', 'is_sensitive' => true, 'requires_feature' => 'team_rbac', 'supports_scope' => false],
            ['key' => 'settings.manage', 'module' => 'Organization', 'action' => 'manage_settings', 'description' => 'Edit tenant preferences and tax rules', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'billing.manage', 'module' => 'Organization', 'action' => 'manage_billing', 'description' => 'Manage SaaS subscription, invoices and payment', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'plan.view', 'module' => 'Organization', 'action' => 'view_plan', 'description' => 'View plan features, quotas and usage metrics', 'is_sensitive' => false, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'audit.view', 'module' => 'Organization', 'action' => 'view_audit', 'description' => 'View immutable tenant audit trail logs', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'session.manage', 'module' => 'Organization', 'action' => 'manage_session', 'description' => 'Revoke employee login sessions', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'data.export', 'module' => 'Organization', 'action' => 'export_data', 'description' => 'Export complete business database backup', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
        ];
    }

    public function run(): void
    {
        // 1. Seed / update permissions catalog
        foreach (self::permissionsCatalog() as $perm) {
            Permission::query()->updateOrCreate(
                [
                    'name' => $perm['key'],
                    'guard_name' => 'web',
                ],
                [
                    'key' => $perm['key'],
                    'module' => $perm['module'],
                    'action' => $perm['action'],
                    'description' => $perm['description'],
                    'is_sensitive' => $perm['is_sensitive'],
                    'requires_feature' => $perm['requires_feature'],
                    'supports_scope' => $perm['supports_scope'],
                ]
            );
        }

        // 2. Seed default roles for all existing tenants
        $tenants = Tenant::all();
        foreach ($tenants as $tenant) {
            static::seedRolesForTenant($tenant);
        }
    }

    /**
     * Seed 8 system default roles and their limits for a tenant.
     */
    public static function seedRolesForTenant(Tenant $tenant): void
    {
        $allPermissions = Permission::pluck('key')->all();

        $roleDefinitions = [
            'Owner' => [
                'description' => 'Full administrative control over tenant settings, billing, branches, and financials.',
                'is_locked' => true,
                'is_system' => true,
                'sort' => 1,
                'permissions' => array_fill_keys($allPermissions, 'all'),
                'limits' => [
                    'discount_percent' => null,
                    'max_refund_amount' => null,
                    'max_void_amount' => null,
                    'max_voucher_amount' => null,
                    'max_stock_adjust_value' => null,
                    'max_credit_sale_amount' => null,
                    'backdate_hours' => null,
                    'void_window_hours' => null,
                ],
            ],
            'Manager' => [
                'description' => 'Branch operations, POS supervisor approvals, stock transfers and employee management.',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 2,
                'permissions' => [
                    'dashboard.view' => 'all',
                    'dashboard.view_profit' => 'all',
                    'sale.create' => 'all',
                    'sale.view' => 'branch',
                    'sale.hold' => 'all',
                    'sale.void' => 'all',
                    'sale.return' => 'all',
                    'sale.reprint' => 'all',
                    'sale.backdate' => 'all',
                    'credit_sale.create' => 'all',
                    'discount.apply' => 'all',
                    'discount.manage' => 'all',
                    'price.override' => 'all',
                    'below_cost.approve' => 'all',
                    'product.view' => 'all',
                    'product.manage' => 'all',
                    'barcode.print' => 'all',
                    'cost_price.view' => 'all',
                    'stock.view' => 'branch',
                    'stock.adjust' => 'all',
                    'stock.count' => 'all',
                    'stock.transfer_send' => 'all',
                    'stock.transfer_receive' => 'all',
                    'batch.view' => 'all',
                    'batch.manage' => 'all',
                    'batch.writeoff' => 'all',
                    'movement.view' => 'branch',
                    'po.manage' => 'all',
                    'purchase.view' => 'all',
                    'purchase.create' => 'all',
                    'purchase.approve' => 'all',
                    'purchase.return' => 'all',
                    'customer.view' => 'all',
                    'customer.manage' => 'all',
                    'customer.credit_limit' => 'all',
                    'customer.collect_due' => 'all',
                    'supplier.view' => 'all',
                    'supplier.manage' => 'all',
                    'supplier.view_balance' => 'all',
                    'supplier.pay' => 'all',
                    'ledger.view' => 'all',
                    'account.view' => 'all',
                    'expense.manage' => 'all',
                    'voucher.create' => 'all',
                    'voucher.approve' => 'all',
                    'shift.open_close' => 'all',
                    'shift.view_all' => 'all',
                    'report.sales' => 'all',
                    'report.profit' => 'all',
                    'report.stock' => 'all',
                    'report.expiry' => 'all',
                    'report.accounts' => 'all',
                    'report.export' => 'all',
                    'user.manage' => 'all',
                    'branch.manage' => 'all',
                    'settings.manage' => 'all',
                    'plan.view' => 'all',
                    'audit.view' => 'all',
                ],
                'limits' => [
                    'discount_percent' => 20.00,
                    'max_refund_amount' => 10000.00,
                    'max_void_amount' => 10000.00,
                    'max_voucher_amount' => 50000.00,
                    'max_stock_adjust_value' => 25000.00,
                    'max_credit_sale_amount' => 20000.00,
                    'backdate_hours' => 24.00,
                    'void_window_hours' => 24.00,
                ],
            ],
            'Pharmacist' => [
                'description' => 'Licensed medicine dispensing, prescription verification and FEFO stock intake.',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 3,
                'permissions' => [
                    'dashboard.view' => 'all',
                    'sale.create' => 'all',
                    'sale.view' => 'branch',
                    'sale.hold' => 'all',
                    'sale.return' => 'all',
                    'sale.reprint' => 'all',
                    'credit_sale.create' => 'all',
                    'discount.apply' => 'all',
                    'product.view' => 'all',
                    'barcode.print' => 'all',
                    'stock.view' => 'branch',
                    'batch.view' => 'all',
                    'customer.view' => 'all',
                    'customer.manage' => 'all',
                    'customer.collect_due' => 'all',
                    'shift.open_close' => 'own',
                    'report.sales' => 'branch',
                    'report.stock' => 'all',
                    'report.expiry' => 'all',
                    'plan.view' => 'all',
                ],
                'limits' => [
                    'discount_percent' => 10.00,
                    'max_refund_amount' => 2000.00,
                    'max_void_amount' => 0.00,
                    'void_window_hours' => 4.00,
                ],
            ],
            'Cashier' => [
                'description' => 'Front-counter billing, fast POS barcode scanning and customer payment receipt.',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 4,
                'permissions' => [
                    'sale.create' => 'all',
                    'sale.view' => 'own',
                    'sale.hold' => 'all',
                    'sale.return' => 'all',
                    'sale.reprint' => 'all',
                    'discount.apply' => 'all',
                    'product.view' => 'all',
                    'customer.view' => 'all',
                    'customer.manage' => 'all',
                    'customer.collect_due' => 'all',
                    'shift.open_close' => 'own',
                ],
                'limits' => [
                    'discount_percent' => 5.00,
                    'max_refund_amount' => 500.00,
                    'max_void_amount' => 0.00,
                    'void_window_hours' => 2.00,
                ],
            ],
            'Store keeper' => [
                'description' => 'Warehouse stock intake, batch management, cycle counts and branch transfer logistics.',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 5,
                'permissions' => [
                    'product.view' => 'all',
                    'product.manage' => 'all',
                    'barcode.print' => 'all',
                    'cost_price.view' => 'all',
                    'stock.view' => 'branch',
                    'stock.adjust' => 'all',
                    'stock.count' => 'all',
                    'stock.transfer_send' => 'all',
                    'stock.transfer_receive' => 'all',
                    'batch.view' => 'all',
                    'batch.manage' => 'all',
                    'batch.writeoff' => 'all',
                    'movement.view' => 'branch',
                    'purchase.view' => 'all',
                    'purchase.return' => 'all',
                    'report.stock' => 'all',
                    'report.expiry' => 'all',
                ],
                'limits' => [
                    'max_stock_adjust_value' => 5000.00,
                ],
            ],
            'Purchase officer' => [
                'description' => 'Supplier procurement, purchase orders, bonus goods tracking and vendor management.',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 6,
                'permissions' => [
                    'product.view' => 'all',
                    'cost_price.view' => 'all',
                    'stock.view' => 'branch',
                    'batch.view' => 'all',
                    'po.manage' => 'all',
                    'purchase.view' => 'all',
                    'purchase.create' => 'all',
                    'purchase.return' => 'all',
                    'supplier.view' => 'all',
                    'supplier.manage' => 'all',
                    'supplier.view_balance' => 'all',
                    'report.stock' => 'all',
                ],
                'limits' => [
                    'max_voucher_amount' => 50000.00,
                ],
            ],
            'Accountant' => [
                'description' => 'Full double-entry bookkeeping, payment vouchers, bank reconciliation and ledger reports.',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 7,
                'permissions' => [
                    'dashboard.view' => 'all',
                    'dashboard.view_profit' => 'all',
                    'sale.view' => 'all',
                    'credit_sale.create' => 'all',
                    'product.view' => 'all',
                    'cost_price.view' => 'all',
                    'stock.view' => 'all',
                    'purchase.view' => 'all',
                    'customer.view' => 'all',
                    'supplier.view' => 'all',
                    'supplier.view_balance' => 'all',
                    'supplier.pay' => 'all',
                    'ledger.view' => 'all',
                    'account.view' => 'all',
                    'coa.manage' => 'all',
                    'expense.manage' => 'all',
                    'voucher.create' => 'all',
                    'voucher.approve' => 'all',
                    'journal.manual' => 'all',
                    'bank.reconcile' => 'all',
                    'period.close' => 'all',
                    'shift.view_all' => 'all',
                    'report.sales' => 'all',
                    'report.profit' => 'all',
                    'report.accounts' => 'all',
                    'report.export' => 'all',
                    'audit.view' => 'all',
                    'plan.view' => 'all',
                ],
                'limits' => [
                    'max_voucher_amount' => 500000.00,
                ],
            ],
            'Auditor' => [
                'description' => 'Read-only financial and inventory audit review across all branches and ledgers.',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 8,
                'permissions' => [
                    'dashboard.view' => 'all',
                    'dashboard.view_profit' => 'all',
                    'sale.view' => 'all',
                    'product.view' => 'all',
                    'cost_price.view' => 'all',
                    'stock.view' => 'all',
                    'batch.view' => 'all',
                    'movement.view' => 'all',
                    'purchase.view' => 'all',
                    'customer.view' => 'all',
                    'supplier.view' => 'all',
                    'supplier.view_balance' => 'all',
                    'ledger.view' => 'all',
                    'account.view' => 'all',
                    'shift.view_all' => 'all',
                    'report.sales' => 'all',
                    'report.profit' => 'all',
                    'report.stock' => 'all',
                    'report.expiry' => 'all',
                    'report.accounts' => 'all',
                    'audit.view' => 'all',
                ],
                'limits' => [],
            ],
        ];

        app(\App\Tenancy\CurrentTenant::class)->run($tenant, function () use ($tenant, $roleDefinitions) {
            DB::transaction(function () use ($tenant, $roleDefinitions) {
                foreach ($roleDefinitions as $roleName => $def) {
                    $role = Role::withoutGlobalScopes()->updateOrCreate(
                        [
                            'tenant_id' => $tenant->id,
                            'name' => $roleName,
                        ],
                        [
                            'slug' => str($roleName)->slug('_'),
                            'description' => $def['description'],
                            'is_locked' => $def['is_locked'],
                            'is_system' => $def['is_system'],
                            'sort' => $def['sort'],
                        ]
                    );

                    // Sync role_permissions
                    RolePermission::where('role_id', $role->id)->delete();
                    $rpRows = [];
                    foreach ($def['permissions'] as $pKey => $scope) {
                        $rpRows[] = [
                            'role_id' => $role->id,
                            'permission_key' => $pKey,
                            'scope' => $scope,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                    if (! empty($rpRows)) {
                        RolePermission::insert($rpRows);
                    }

                    // Sync role_limits
                    RoleLimit::where('role_id', $role->id)->delete();
                    $rlRows = [];
                    foreach ($def['limits'] as $lKey => $val) {
                        $rlRows[] = [
                            'role_id' => $role->id,
                            'limit_key' => $lKey,
                            'value' => $val,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                    if (! empty($rlRows)) {
                        RoleLimit::insert($rlRows);
                    }
                }
            });
        });
    }
}
