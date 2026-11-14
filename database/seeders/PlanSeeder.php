<?php

namespace Database\Seeders;

use App\Actions\Tenancy\ProvisionTenantAccess;
use App\Enums\TenantRole;
use App\Models\Module;
use App\Models\Permission;
use App\Models\SaasPlan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $order = 1;
        $moduleIds = [];
        foreach (ProvisionTenantAccess::modulesCatalog() as $key => $definition) {
            $module = Module::query()->updateOrCreate(
                ['key' => $key],
                [
                    'name' => $definition['name'],
                    'description' => $definition['description'],
                    'category' => $definition['category'],
                    'is_core' => $definition['core'],
                    'is_active' => true,
                    'sort_order' => $order++,
                ]
            );
            $moduleIds[$key] = $module->id;
        }

        foreach (array_keys(TenantRole::PERMISSION_CATALOG) as $permissionName) {
            Permission::query()->firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }

        $plans = [
            [
                'key' => 'starter',
                'name' => 'Starter Dispensary',
                'description' => 'Essential POS, CRM & inventory control for a single pharmacy business and branch.',
                'currency_code' => 'USD',
                'monthly_price' => 29.00,
                'annual_price' => 290.00,
                'trial_days' => 14,
                'max_pharmacies' => 1,
                'max_branches' => 1,
                'max_users' => 5,
                'max_medicines' => 1500,
                'storage_limit_mb' => 512,
                'features' => [
                    '1 Business Tenant & Head Office Branch',
                    'Up to 5 Employee Accounts',
                    'Batch & Expiry Date Tracking (FEFO)',
                    'Customer CRM & Allergy Profiles',
                    'Standard Daily Sales & POS Invoices',
                ],
                'module_keys' => ['pos', 'inventory', 'branches', 'crm'],
                'is_popular' => false,
                'is_active' => true,
                'is_public' => true,
                'sort_order' => 1,
            ],
            [
                'key' => 'growth',
                'name' => 'Growth Chain',
                'description' => 'Run multiple pharmacy tenants & branches with multi-role RBAC, CRM & supplier automation.',
                'currency_code' => 'USD',
                'monthly_price' => 79.00,
                'annual_price' => 790.00,
                'trial_days' => 14,
                'max_pharmacies' => 3,
                'max_branches' => 8,
                'max_users' => 25,
                'max_medicines' => 10000,
                'storage_limit_mb' => 2048,
                'features' => [
                    'Up to 3 Business Tenants under 1 Subscription',
                    'Up to 8 Branches & Inter-branch Stock Sync',
                    'Multi-Role Staff Assignment & Custom Roles',
                    'Customers, Loyalty CRM & Suppliers Directory',
                    'Compliance & Dispensing Audit Trail',
                ],
                'module_keys' => ['pos', 'inventory', 'branches', 'crm', 'team_rbac'],
                'is_popular' => true,
                'is_active' => true,
                'is_public' => true,
                'sort_order' => 2,
            ],
            [
                'key' => 'enterprise',
                'name' => 'Enterprise Hospital',
                'description' => 'Unlimited pharmacy businesses, branches & teams with dedicated compliance controls.',
                'currency_code' => 'USD',
                'monthly_price' => 199.00,
                'annual_price' => 1990.00,
                'trial_days' => 14,
                'max_pharmacies' => 999,
                'max_branches' => 999,
                'max_users' => 500,
                'max_medicines' => 100000,
                'storage_limit_mb' => 10240,
                'features' => [
                    'Unlimited Pharmacy Tenants & Branches',
                    'Unlimited Custom Roles & Granular RBAC',
                    'Priority SLA & Dedicated Account Onboarding',
                    'Full CRM, FEFO Dispensing & Ledger Exports',
                    'Enterprise Audit & Compliance Controls',
                ],
                'module_keys' => ['pos', 'inventory', 'branches', 'crm', 'team_rbac'],
                'is_popular' => false,
                'is_active' => true,
                'is_public' => true,
                'sort_order' => 3,
            ],
        ];

        foreach ($plans as $planData) {
            $keys = $planData['module_keys'];
            unset($planData['module_keys']);

            $plan = SaasPlan::query()->updateOrCreate(
                ['key' => $planData['key']],
                $planData
            );

            $syncIds = array_values(array_intersect_key($moduleIds, array_flip($keys)));
            $plan->modules()->sync($syncIds);
        }
    }
}
