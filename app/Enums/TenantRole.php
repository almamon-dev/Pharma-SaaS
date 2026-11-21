<?php

namespace App\Enums;

use App\Models\Role;

enum TenantRole: string
{
    case ADMIN = 'admin';
    case MANAGER = 'manager';
    case PHARMACIST = 'pharmacist';
    case CASHIER = 'cashier';
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
    ];

    public function label(): string
    {
        return match ($this) {
            self::ADMIN => 'Business Admin (Owner)',
            self::MANAGER => 'Branch Manager',
            self::PHARMACIST => 'Licensed Pharmacist',
            self::CASHIER => 'POS Cashier',
            self::INVENTORY_CLERK => 'Inventory & Supply Clerk',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::ADMIN => 'Full business authority across subscription, businesses/tenants, branches, CRM, team & billing.',
            self::MANAGER => 'Manages branch operations, inventory, CRM directory, and assigned branch team members.',
            self::PHARMACIST => 'Dispenses prescriptions, manages FEFO stock intake, and reviews patient allergies.',
            self::CASHIER => 'Operates retail POS counter checkout, customer lookup, and receipts.',
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
                'inventory.view',
                'inventory.manage',
                'inventory.adjust',
                'crm.view',
                'crm.manage',
                'branches.manage',
                'team.manage',
                'settings.manage',
            ],
            self::PHARMACIST => [
                'pos.sell',
                'inventory.view',
                'inventory.manage',
                'inventory.adjust',
                'crm.view',
                'crm.manage',
            ],
            self::CASHIER => [
                'pos.sell',
                'crm.view',
            ],
            self::INVENTORY_CLERK => [
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
            $customRoles = Role::query()
                ->where(function ($query) use ($subscriberAdminId, $tenantId): void {
                    if ($subscriberAdminId) {
                        $query->where('user_id', $subscriberAdminId);
                    }
                    if ($tenantId) {
                        $query->orWhere('tenant_id', $tenantId);
                    }
                })
                ->whereIn('slug', $customSlugs)
                ->get(['permissions']);

            foreach ($customRoles as $customRole) {
                if (is_array($customRole->permissions)) {
                    $permissions = array_merge($permissions, $customRole->permissions);
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
