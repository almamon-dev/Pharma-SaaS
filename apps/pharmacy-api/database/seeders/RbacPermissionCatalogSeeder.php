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
            // Dashboard & Approvals
            ['key' => 'dashboard.view', 'module' => 'Dashboard', 'action' => 'view', 'description' => 'View operational dashboard & sales counters', 'is_sensitive' => false, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'dashboard.view_profit', 'module' => 'Dashboard', 'action' => 'view_profit', 'description' => 'View business gross profit & margins', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'approvals.manage', 'module' => 'Approvals', 'action' => 'manage', 'description' => 'Review and decide high-discount, return, and voucher approvals', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => true],

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

            // Accounting Module (Dynamic Permissions — Simple & Advanced Double-Entry)
            ['key' => 'accounting.view', 'module' => 'Accounting', 'action' => 'view', 'description' => 'Access accounting workspace, simple dashboard and books', 'is_sensitive' => false, 'requires_feature' => null, 'supports_scope' => true],
            ['key' => 'accounting.expense.create', 'module' => 'Accounting', 'action' => 'expense_create', 'description' => 'Create simple income/expense entries and receipts', 'is_sensitive' => false, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'accounting.voucher.create', 'module' => 'Accounting', 'action' => 'voucher_create', 'description' => 'Create and edit draft accounting vouchers', 'is_sensitive' => false, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'accounting.voucher.post', 'module' => 'Accounting', 'action' => 'voucher_post', 'description' => 'Post balanced vouchers to the immutable general ledger', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'accounting.voucher.approve', 'module' => 'Accounting', 'action' => 'voucher_approve', 'description' => 'Approve vouchers above threshold amount', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'accounting.voucher.reverse', 'module' => 'Accounting', 'action' => 'voucher_reverse', 'description' => 'Reverse posted vouchers with linked opposite entries', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'accounting.journal.create', 'module' => 'Accounting', 'action' => 'journal_create', 'description' => 'Create manual balanced journal vouchers (Advanced Mode)', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'accounting.coa.manage', 'module' => 'Accounting', 'action' => 'coa_manage', 'description' => 'Create, edit and deactivate Chart of Accounts heads', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'accounting.period.close', 'module' => 'Accounting', 'action' => 'period_close', 'description' => 'Close monthly fiscal periods and fiscal years', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'accounting.period.reopen', 'module' => 'Accounting', 'action' => 'period_reopen', 'description' => 'Reopen closed fiscal periods (audit-logged)', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'accounting.reports.view', 'module' => 'Accounting', 'action' => 'reports_view', 'description' => 'View accounting reports (day book, cash book, trial balance, P&L, balance sheet)', 'is_sensitive' => false, 'requires_feature' => null, 'supports_scope' => true],
            ['key' => 'accounting.settings.manage', 'module' => 'Accounting', 'action' => 'settings_manage', 'description' => 'Manage accounting mode, fiscal year, VAT and default accounts', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],
            ['key' => 'accounting.cost_and_profit.view', 'module' => 'Accounting', 'action' => 'cost_and_profit_view', 'description' => 'View gross/net profit, COGS and cost breakdown figures', 'is_sensitive' => true, 'requires_feature' => null, 'supports_scope' => false],

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

            // Cash Counter & Register Management
            ['key' => 'cash_counters.view', 'module' => 'Counters', 'action' => 'view_counters', 'description' => 'View cash counter stations & queue metrics', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => true],
            ['key' => 'cash_counters.create', 'module' => 'Counters', 'action' => 'create_counter', 'description' => 'Create new cash counter terminals', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'cash_counters.edit', 'module' => 'Counters', 'action' => 'edit_counter', 'description' => 'Edit counter configuration & queue limits', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'cash_counters.delete', 'module' => 'Counters', 'action' => 'delete_counter', 'description' => 'Delete inactive cash counter terminals', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'cash_counters.assign_cashier', 'module' => 'Counters', 'action' => 'assign_cashier', 'description' => 'Assign cashiers & shift schedules to counters', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'cash_counters.activate', 'module' => 'Counters', 'action' => 'activate_counter', 'description' => 'Activate or deactivate cash counters', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'cash_counters.view_all_branches', 'module' => 'Counters', 'action' => 'view_all_counters', 'description' => 'Monitor counter queues across all branches', 'is_sensitive' => true, 'requires_feature' => 'branches', 'supports_scope' => false],
            ['key' => 'cash_register.open', 'module' => 'Counters', 'action' => 'open_register', 'description' => 'Open shift register session with cash float', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'cash_register.close', 'module' => 'Counters', 'action' => 'close_register', 'description' => 'Close shift register session & count cash', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'cash_register.cash_in', 'module' => 'Counters', 'action' => 'cash_in', 'description' => 'Cash float in / register top-up', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'cash_register.cash_out', 'module' => 'Counters', 'action' => 'cash_out', 'description' => 'Cash float withdrawal from register', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'cash_register.reconcile', 'module' => 'Counters', 'action' => 'reconcile', 'description' => 'Review cash drawer discrepancy & Z-Report', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],

            // Sales Orders & Routing
            ['key' => 'sales_orders.create', 'module' => 'Sales', 'action' => 'create_order', 'description' => 'Create medicine order and select batches', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sales_orders.view_own', 'module' => 'Sales', 'action' => 'view_own_orders', 'description' => 'Track own created sales orders & status', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sales_orders.submit', 'module' => 'Sales', 'action' => 'submit_order', 'description' => 'Submit order for automatic counter routing', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sales_orders.cancel', 'module' => 'Sales', 'action' => 'cancel_order', 'description' => 'Cancel pending or unassigned sales orders', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sales_orders.view_assigned', 'module' => 'Sales', 'action' => 'view_assigned_orders', 'description' => 'View incoming order queue assigned to counter', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sales_orders.process', 'module' => 'Sales', 'action' => 'process_order', 'description' => 'Accept and process counter order payment', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sales_orders.reassign', 'module' => 'Sales', 'action' => 'reassign_order', 'description' => 'Manually reassign order between counter queues', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'sales_orders.view_all', 'module' => 'Sales', 'action' => 'view_all_orders', 'description' => 'View all branch order queues & audit history', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => true],

            // Payments & Invoices
            ['key' => 'payments.receive', 'module' => 'Sales', 'action' => 'receive_payment', 'description' => 'Collect cash, card or mobile banking payment', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'payments.view', 'module' => 'Sales', 'action' => 'view_payments', 'description' => 'View payment transaction logs', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'payments.refund', 'module' => 'Sales', 'action' => 'refund_payment', 'description' => 'Process customer payment refund', 'is_sensitive' => true, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'invoices.create', 'module' => 'Sales', 'action' => 'create_invoice', 'description' => 'Issue official sales invoice', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],
            ['key' => 'invoices.print', 'module' => 'Sales', 'action' => 'print_invoice', 'description' => 'Print POS customer receipt invoice', 'is_sensitive' => false, 'requires_feature' => 'pos', 'supports_scope' => false],

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
     * Seed the 6 system default roles and their limits for a tenant.
     */
    public static function seedRolesForTenant(Tenant $tenant): void
    {
        $allPermissions = Permission::pluck('key')->all();

        $roleDefinitions = [
            'Super Admin (Owner)' => [
                'slug' => 'owner',
                'description' => 'Full company-wide authority over branches, approvals, catalog pricing, financials, audit logs, and SaaS billing.',
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
            'Admin (Co-Admin)' => [
                'slug' => 'co_admin',
                'description' => 'Delegated operations head across assigned branches, approvals, counter monitoring, staff, and operational reports (no profit/billing).',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 2,
                'permissions' => [
                    'dashboard.view' => 'all',
                    'approvals.manage' => 'all',
                    'sale.view' => 'all',
                    'sale.return' => 'all',
                    'discount.manage' => 'all',
                    'product.view' => 'all',
                    'stock.view' => 'all',
                    'batch.view' => 'all',
                    'movement.view' => 'all',
                    'purchase.view' => 'all',
                    'purchase.approve' => 'all',
                    'customer.view' => 'all',
                    'supplier.view' => 'all',
                    'accounting.view' => 'all',
                    'accounting.voucher.approve' => 'all',
                    'accounting.reports.view' => 'all',
                    'cash_counters.view' => 'all',
                    'cash_counters.assign_cashier' => 'all',
                    'cash_counters.activate' => 'all',
                    'cash_counters.view_all_branches' => 'all',
                    'cash_register.reconcile' => 'all',
                    'sales_orders.view_all' => 'all',
                    'sales_orders.reassign' => 'all',
                    'payments.view' => 'all',
                    'report.sales' => 'all',
                    'report.stock' => 'all',
                    'report.expiry' => 'all',
                    'branch.manage' => 'all',
                    'user.manage' => 'all',
                    'role.manage' => 'all',
                    'audit.view' => 'all',
                ],
                'limits' => [
                    'discount_percent' => 25.00,
                    'max_refund_amount' => 25000.00,
                    'max_void_amount' => 25000.00,
                    'max_voucher_amount' => 100000.00,
                    'max_stock_adjust_value' => 50000.00,
                    'max_credit_sale_amount' => 50000.00,
                    'backdate_hours' => 48.00,
                    'void_window_hours' => 48.00,
                ],
            ],
            'Branch Manager' => [
                'slug' => 'manager',
                'description' => 'Heads a specific branch: manages branch approvals, sales & live counters, stock & expiry, branch staff, and branch reports.',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 3,
                'permissions' => [
                    'dashboard.view' => 'branch',
                    'approvals.manage' => 'branch',
                    'sale.create' => 'branch',
                    'sale.view' => 'branch',
                    'sale.hold' => 'branch',
                    'sale.void' => 'branch',
                    'sale.return' => 'branch',
                    'sale.reprint' => 'branch',
                    'discount.apply' => 'branch',
                    'discount.manage' => 'branch',
                    'product.view' => 'all',
                    'product.manage' => 'all',
                    'barcode.print' => 'all',
                    'stock.view' => 'branch',
                    'stock.adjust' => 'branch',
                    'stock.count' => 'branch',
                    'batch.view' => 'branch',
                    'batch.manage' => 'branch',
                    'movement.view' => 'branch',
                    'po.manage' => 'branch',
                    'purchase.view' => 'branch',
                    'purchase.create' => 'branch',
                    'purchase.approve' => 'branch',
                    'purchase.return' => 'branch',
                    'customer.view' => 'all',
                    'customer.manage' => 'all',
                    'supplier.view' => 'all',
                    'supplier.manage' => 'all',
                    'accounting.view' => 'branch',
                    'accounting.voucher.approve' => 'branch',
                    'accounting.reports.view' => 'branch',
                    'cash_counters.view' => 'branch',
                    'cash_counters.create' => 'branch',
                    'cash_counters.edit' => 'branch',
                    'cash_counters.assign_cashier' => 'branch',
                    'cash_counters.activate' => 'branch',
                    'cash_register.open' => 'branch',
                    'cash_register.close' => 'branch',
                    'cash_register.reconcile' => 'branch',
                    'sales_orders.create' => 'branch',
                    'sales_orders.view_own' => 'branch',
                    'sales_orders.view_all' => 'branch',
                    'sales_orders.reassign' => 'branch',
                    'sales_orders.process' => 'branch',
                    'payments.receive' => 'branch',
                    'payments.view' => 'branch',
                    'invoices.create' => 'branch',
                    'invoices.print' => 'branch',
                    'report.sales' => 'branch',
                    'report.stock' => 'branch',
                    'report.expiry' => 'branch',
                    'user.manage' => 'branch',
                    'audit.view' => 'branch',
                ],
                'limits' => [
                    'discount_percent' => 15.00,
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
                'slug' => 'pharmacist',
                'description' => 'Clinical Rx verification, dispensed medicines log, FEFO batches, stock adjustments, and supplier purchases & returns.',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 4,
                'permissions' => [
                    'dashboard.view' => 'branch',
                    'sale.create' => 'branch',
                    'sale.view' => 'branch',
                    'sale.return' => 'branch',
                    'product.view' => 'all',
                    'barcode.print' => 'all',
                    'stock.view' => 'branch',
                    'stock.adjust' => 'branch',
                    'batch.view' => 'branch',
                    'batch.manage' => 'branch',
                    'batch.writeoff' => 'branch',
                    'movement.view' => 'branch',
                    'purchase.view' => 'branch',
                    'purchase.create' => 'branch',
                    'purchase.return' => 'branch',
                    'customer.view' => 'all',
                    'supplier.view' => 'all',
                    'sales_orders.view_all' => 'branch',
                    'sales_orders.process' => 'branch',
                    'invoices.create' => 'branch',
                    'invoices.print' => 'branch',
                    'report.stock' => 'branch',
                    'report.expiry' => 'branch',
                ],
                'limits' => [
                    'discount_percent' => 10.00,
                    'max_refund_amount' => 2000.00,
                    'max_stock_adjust_value' => 10000.00,
                ],
            ],
            'Salesman' => [
                'slug' => 'salesman',
                'description' => 'Order creation & cashier routing, order tracking, customer due handling, and daily sales target monitoring.',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 5,
                'permissions' => [
                    'dashboard.view' => 'own',
                    'product.view' => 'all',
                    'stock.view' => 'branch',
                    'batch.view' => 'branch',
                    'customer.view' => 'all',
                    'customer.manage' => 'all',
                    'customer.collect_due' => 'own',
                    'sales_orders.create' => 'own',
                    'sales_orders.view_own' => 'own',
                    'sales_orders.submit' => 'own',
                    'sales_orders.cancel' => 'own',
                    'payments.receive' => 'own',
                ],
                'limits' => [
                    'discount_percent' => 5.00,
                ],
            ],
            'Cashier' => [
                'slug' => 'cashier',
                'description' => 'Cashier station operations, pending order payment collection, direct walk-in POS billing, and register shift reconciliation.',
                'is_locked' => false,
                'is_system' => true,
                'sort' => 6,
                'permissions' => [
                    'dashboard.view' => 'own',
                    'sale.create' => 'own',
                    'sale.view' => 'own',
                    'sale.hold' => 'own',
                    'sale.reprint' => 'own',
                    'discount.apply' => 'own',
                    'product.view' => 'all',
                    'customer.view' => 'all',
                    'cash_counters.view' => 'branch',
                    'cash_register.open' => 'own',
                    'cash_register.close' => 'own',
                    'cash_register.cash_in' => 'own',
                    'cash_register.cash_out' => 'own',
                    'cash_register.reconcile' => 'own',
                    'sales_orders.view_assigned' => 'own',
                    'sales_orders.process' => 'own',
                    'payments.receive' => 'own',
                    'payments.view' => 'own',
                    'invoices.create' => 'own',
                    'invoices.print' => 'own',
                    'shift.open_close' => 'own',
                ],
                'limits' => [
                    'discount_percent' => 5.00,
                    'max_refund_amount' => 500.00,
                    'max_void_amount' => 0.00,
                    'void_window_hours' => 2.00,
                ],
            ],
        ];

        app(\App\Tenancy\CurrentTenant::class)->run($tenant, function () use ($tenant, $roleDefinitions) {
            DB::transaction(function () use ($tenant, $roleDefinitions) {
                $activeSlugs = [];
                foreach ($roleDefinitions as $roleName => $def) {
                    $slug = $def['slug'];
                    $activeSlugs[] = $slug;

                    $existing = Role::withoutGlobalScopes()
                        ->where('tenant_id', $tenant->id)
                        ->where(fn ($q) => $q->where('slug', $slug)->orWhere('name', $roleName))
                        ->first();

                    if ($existing) {
                        $existing->update([
                            'name' => $roleName,
                            'slug' => $slug,
                            'description' => $def['description'],
                            'is_locked' => $def['is_locked'],
                            'is_system' => $def['is_system'],
                            'sort' => $def['sort'],
                        ]);
                        $role = $existing;
                    } else {
                        $role = Role::withoutGlobalScopes()->create([
                            'tenant_id' => $tenant->id,
                            'name' => $roleName,
                            'slug' => $slug,
                            'guard_name' => 'web',
                            'description' => $def['description'],
                            'is_locked' => $def['is_locked'],
                            'is_system' => $def['is_system'],
                            'sort' => $def['sort'],
                        ]);
                    }

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

                // Prune obsolete system roles that have no users attached
                $obsoleteRoles = Role::withoutGlobalScopes()
                    ->where('tenant_id', $tenant->id)
                    ->where('is_system', true)
                    ->whereNotIn('slug', $activeSlugs)
                    ->get();

                foreach ($obsoleteRoles as $obs) {
                    if (! DB::table('users')->where('role_id', $obs->id)->exists()) {
                        RolePermission::where('role_id', $obs->id)->delete();
                        RoleLimit::where('role_id', $obs->id)->delete();
                        $obs->delete();
                    }
                }
            });
        });
    }
}
