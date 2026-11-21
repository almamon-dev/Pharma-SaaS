<?php

namespace App\Actions\Tenancy;

use App\Enums\TenantRole;
use App\Models\MedicineCategory;
use App\Models\Module;
use App\Models\Permission;
use App\Models\Tenant;
use App\Tenancy\CurrentTenant;
use Illuminate\Support\Str;

class ProvisionTenantAccess
{
    public function __construct(private readonly CurrentTenant $currentTenant) {}

    /**
     * Catalog of commercial & operational SaaS feature modules.
     *
     * @return array<string, array{name: string, description: string, category: string, core: bool}>
     */
    public static function modulesCatalog(): array
    {
        return [
            'pos' => [
                'name' => 'Point of Sale & FEFO Dispatch',
                'description' => 'Retail billing terminal with automatic earliest-expiry batch deduction.',
                'category' => 'dispensing',
                'core' => true,
            ],
            'inventory' => [
                'name' => 'Medicine Catalog & Batches',
                'description' => 'Batch-tracked stock levels, expiry alerts, and reorder thresholds.',
                'category' => 'inventory',
                'core' => true,
            ],
            'branches' => [
                'name' => 'Multi-Branch Outlets',
                'description' => 'Operate multiple pharmacy locations and outlets under each tenant.',
                'category' => 'branches',
                'core' => false,
            ],
            'crm' => [
                'name' => 'Customer & Supplier CRM',
                'description' => 'Patient allergy profiles, loyalty points, and distributor directory.',
                'category' => 'crm',
                'core' => false,
            ],
            'team_rbac' => [
                'name' => 'Team & Multi-Role RBAC',
                'description' => 'Custom roles, fine-grained permissions, and employee branch assignment.',
                'category' => 'team',
                'core' => false,
            ],
        ];
    }

    public function execute(Tenant $tenant): void
    {
        $catalog = self::modulesCatalog();
        $order = 1;
        $existingModuleIds = $tenant->modules()->pluck('modules.id')->all();

        foreach ($catalog as $key => $definition) {
            $module = Module::query()->updateOrCreate(
                ['key' => $key],
                [
                    'name' => $definition['name'],
                    'description' => $definition['description'],
                    'category' => $definition['category'],
                    'is_core' => $definition['core'],
                    'sort_order' => $order++,
                ]
            );

            if (! in_array($module->id, $existingModuleIds, true)) {
                $tenant->modules()->attach($module->id, [
                    'is_enabled' => $definition['core'] && $module->is_active,
                    'enabled_at' => ($definition['core'] && $module->is_active) ? now() : null,
                ]);
            }
        }

        foreach (array_keys(TenantRole::PERMISSION_CATALOG) as $permissionName) {
            Permission::query()->firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }

        $this->currentTenant->run($tenant, function () use ($tenant): void {
            if (MedicineCategory::query()->count() === 0) {
                $defaultCategories = [
                    'Antibiotics',
                    'Pain & Fever',
                    'Gastrointestinal',
                    'Cardiovascular',
                    'Vitamins & Supplements',
                    'First Aid & OTC',
                ];

                foreach ($defaultCategories as $categoryName) {
                    MedicineCategory::query()->firstOrCreate(
                        [
                            'tenant_id' => $tenant->id,
                            'slug' => Str::slug($categoryName),
                        ],
                        [
                            'name' => $categoryName,
                            'is_active' => true,
                        ]
                    );
                }
            }
        });
    }
}
