<?php

namespace App\Enums;

use App\Models\Role;

enum TenantRole: string
{
    case ADMIN = 'admin';
    case MANAGER = 'manager';
    case PHARMACIST = 'pharmacist';
    case CASHIER = 'cashier';
    case SALESMAN = 'salesman';
    case INVENTORY_CLERK = 'inventory_clerk';

    public const PERMISSION_CATALOG = [
        'pos.sell' => 'Operate POS Terminal & Checkout',
        'inventory.view' => 'View Medicine Catalog & Batches',
        'inventory.manage' => 'Add & Replenish Stock Batches',
        'inventory.adjust' => 'Adjust Stock, Record Damage & Dispose Expired',
        'crm.view' => 'View Customers & Suppliers',
        'crm.manage' => 'Manage Customers, Allergies & Suppliers',
        'branches.manage' => 'Create & Toggle Pharmacy Branches',
        'team.manage' => 'Manage Employees & Assign Roles',
        'settings.manage' => 'Edit Business Compliance & Preferences',

        // Cash Counter & Cash Register
        'cash_counters.view' => 'View Cash Counters & Terminals',
        'cash_counters.create' => 'Create Cash Counter Terminals',
        'cash_counters.edit' => 'Configure Counter Location & Capacity',
        'cash_counters.delete' => 'Delete Inactive Cash Counters',
        'cash_counters.assign_cashier' => 'Assign Cashiers to Counter & Shift Schedules',
        'cash_counters.activate' => 'Activate or Deactivate Cash Counters',
        'cash_counters.view_all_branches' => 'Monitor Counter Queues Across All Branches',
        'cash_register.open' => 'Open Shift Register with Opening Cash Float',
        'cash_register.close' => 'Close Shift Register & Count Physical Cash',
        'cash_register.cash_in' => 'Deposit Cash Float / Top-up',
        'cash_register.cash_out' => 'Withdraw Cash from Register',
        'cash_register.reconcile' => 'Reconcile Cash & Review Z-Report Discrepancy',

        // Sales Orders & Routing
        'sales_orders.create' => 'Create Sales Orders & Search Medicines',
        'sales_orders.view_own' => 'Track Own Created Sales Orders',
        'sales_orders.submit' => 'Submit Order for Dynamic Counter Routing',
        'sales_orders.cancel' => 'Cancel Pending Sales Orders',
        'sales_orders.view_assigned' => 'View Orders Assigned to Cashier Counter',
        'sales_orders.process' => 'Accept & Process Counter Sales Orders',
        'sales_orders.reassign' => 'Reassign Orders Between Counters (Manager Override)',
        'sales_orders.view_all' => 'View All Branch Order Queues & History',

        // Payments & Invoicing
        'payments.receive' => 'Collect Cash, Card & Mobile Banking Payments',
        'payments.view' => 'View Transaction & Collection History',
        'payments.refund' => 'Process Order Payment Refunds',
        'invoices.create' => 'Generate Official Sales Invoices',
        'invoices.print' => 'Print & Thermal Reprint Cash Receipts',

        // Accounting (Dynamic Permissions)
        'accounting.view' => 'Access Accounting Workspace & Books',
        'accounting.expense.create' => 'Create Simple Income & Expense Entries',
        'accounting.voucher.create' => 'Create & Edit Draft Vouchers',
        'accounting.voucher.post' => 'Post Balanced Vouchers to Ledger',
        'accounting.voucher.approve' => 'Approve Vouchers Above Threshold',
        'accounting.voucher.reverse' => 'Reverse Posted Vouchers',
        'accounting.journal.create' => 'Create Manual Journal Vouchers',
        'accounting.coa.manage' => 'Manage Chart of Accounts',
        'accounting.period.close' => 'Close Monthly & Annual Fiscal Periods',
        'accounting.period.reopen' => 'Reopen Closed Fiscal Periods',
        'accounting.reports.view' => 'View Accounting & Financial Reports',
        'accounting.settings.manage' => 'Manage Accounting Mode, VAT & Defaults',
        'accounting.cost_and_profit.view' => 'View Profit, Cost & COGS Figures',
    ];

    public function label(): string
    {
        return match ($this) {
            self::ADMIN => 'Business Admin (Owner)',
            self::MANAGER => 'Branch Manager',
            self::PHARMACIST => 'Licensed Pharmacist',
            self::CASHIER => 'POS Cashier',
            self::SALESMAN => 'Pharmacy Salesman',
            self::INVENTORY_CLERK => 'Inventory & Supply Clerk',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::ADMIN => 'Full business authority across subscription, businesses/tenants, branches, CRM, team & billing.',
            self::MANAGER => 'Manages branch operations, inventory, counter assignments, CRM directory, and branch team members.',
            self::PHARMACIST => 'Dispenses prescriptions, verifies orders, manages FEFO stock intake, and reviews patient allergies.',
            self::CASHIER => 'Operates counter terminal, accepts assigned orders, processes multi-channel payments, and prints invoices.',
            self::SALESMAN => 'Creates customer medicine orders, selects batches, uploads prescriptions, and submits for automated counter routing.',
            self::INVENTORY_CLERK => 'Handles supplier procurement, medicine stock batches, and expiry alerts.',
        };
    }

    /**
     * @return array<int, string>
     */
    public function defaultPermissions(): array
    {
        return match ($this) {
            self::ADMIN => array_keys(self::PERMISSION_CATALOG),
            self::MANAGER => [
                'pos.sell',
                'product.view',
                'product.manage',
                'barcode.print',
                'inventory.view',
                'inventory.manage',
                'inventory.adjust',
                'crm.view',
                'crm.manage',
                'branches.manage',
                'team.manage',
                'settings.manage',
                'cash_counters.view',
                'cash_counters.create',
                'cash_counters.edit',
                'cash_counters.delete',
                'cash_counters.assign_cashier',
                'cash_counters.activate',
                'cash_counters.view_all_branches',
                'cash_register.open',
                'cash_register.close',
                'cash_register.reconcile',
                'sales_orders.create',
                'sales_orders.view_all',
                'sales_orders.reassign',
                'sales_orders.process',
                'payments.receive',
                'payments.view',
                'invoices.create',
                'invoices.print',
            ],
            self::PHARMACIST => [
                'pos.sell',
                'product.view',
                'barcode.print',
                'inventory.view',
                'inventory.manage',
                'inventory.adjust',
                'crm.view',
                'crm.manage',
                'sales_orders.create',
                'sales_orders.view_all',
                'sales_orders.process',
                'invoices.create',
                'invoices.print',
            ],
            self::CASHIER => [
                'pos.sell',
                'product.view',
                'crm.view',
                'cash_counters.view',
                'cash_register.open',
                'cash_register.close',
                'cash_register.reconcile',
                'sales_orders.view_assigned',
                'sales_orders.process',
                'payments.receive',
                'payments.view',
                'invoices.create',
                'invoices.print',
            ],
            self::SALESMAN => [
                'product.view',
                'inventory.view',
                'crm.view',
                'sales_orders.create',
                'sales_orders.view_own',
                'sales_orders.submit',
                'sales_orders.cancel',
            ],
            self::INVENTORY_CLERK => [
                'product.view',
                'product.manage',
                'barcode.print',
                'inventory.view',
                'inventory.manage',
                'inventory.adjust',
                'crm.view',
                'crm.manage',
            ],
        };
    }

    public static function normalize(string $slug): string
    {
        return $slug === 'owner' ? self::ADMIN->value : $slug;
    }

    /**
     * @param  array<int, string>  $slugs
     * @return array<int, string>
     */
    public static function permissionsForSlugs(
        array $slugs,
        ?int $subscriberAdminId = null,
        ?int $tenantId = null
    ): array {
        $normalized = array_values(array_unique(array_map(
            fn (string $s) => self::normalize($s),
            array_filter($slugs)
        )));

        $permissions = [];
        $customSlugs = [];

        foreach ($normalized as $slug) {
            $enum = self::tryFrom($slug);
            if ($enum) {
                $permissions = array_merge($permissions, $enum->defaultPermissions());
            } else {
                $customSlugs[] = $slug;
            }
        }

        if (($subscriberAdminId || $tenantId) && ! empty($customSlugs)) {
            $customRoles = Role::withoutGlobalScopes()
                ->where(function ($query) use ($subscriberAdminId, $tenantId): void {
                    if ($subscriberAdminId) {
                        $query->where('user_id', $subscriberAdminId);
                    }
                    if ($tenantId) {
                        $query->orWhere('tenant_id', $tenantId);
                    }
                })
                ->whereIn('slug', $customSlugs)
                ->with('rolePermissions')
                ->get();

            foreach ($customRoles as $customRole) {
                if (is_array($customRole->permissions)) {
                    $permissions = array_merge($permissions, $customRole->permissions);
                }
                if ($customRole->relationLoaded('rolePermissions') && $customRole->rolePermissions->isNotEmpty()) {
                    $permissions = array_merge($permissions, $customRole->rolePermissions->pluck('permission_key')->all());
                }
            }
        }

        return array_values(array_unique($permissions));
    }

    /**
     * @return array<int, array{value: string, label: string, description: string, permissions: array<int, string>, is_system: bool}>
     */
    public static function optionsForSubscriber(?int $subscriberAdminId = null, bool $includeAdmin = false): array
    {
        $builtIn = array_values(array_filter(
            self::cases(),
            fn (self $case) => $includeAdmin || $case !== self::ADMIN
        ));

        $result = array_map(
            fn (self $role) => [
                'value' => $role->value,
                'label' => $role->label(),
                'description' => $role->description(),
                'permissions' => $role->defaultPermissions(),
                'is_system' => true,
            ],
            $builtIn
        );

        if ($subscriberAdminId) {
            $custom = Role::query()
                ->where('user_id', $subscriberAdminId)
                ->orderBy('name')
                ->get();

            foreach ($custom as $role) {
                $result[] = [
                    'value' => $role->slug,
                    'label' => $role->name,
                    'description' => $role->description ?? 'Custom role defined by business admin.',
                    'permissions' => $role->permissions ?? [],
                    'is_system' => false,
                ];
            }
        }

        return $result;
    }

    /**
     * @return array<string, string>
     */
    public static function labels(): array
    {
        $map = [];
        foreach (self::cases() as $case) {
            $map[$case->value] = $case->label();
        }

        return $map;
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    public static function permissionCatalogOptions(): array
    {
        $options = [];
        foreach (self::PERMISSION_CATALOG as $key => $label) {
            $options[] = [
                'value' => $key,
                'label' => $label,
            ];
        }

        return $options;
    }
}
