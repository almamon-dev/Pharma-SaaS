<?php

namespace Database\Seeders;

use App\Actions\Tenancy\ProvisionTenantAccess;
use App\Enums\TenantRole;
use App\Models\Module;
use App\Models\Permission;
use App\Models\SaasPlan;
use App\Services\Commercial\SubscriptionService;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $subscriptionService = app(SubscriptionService::class);
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
                'name_bn' => 'স্টার্টার ডিসপেনসারি',
                'description' => 'Essential POS, CRM & inventory control for a single pharmacy business and branch.',
                'description_bn' => 'একক ফার্মেসি ব্যবসা ও শাখার জন্য প্রয়োজনীয় পিওএস, সিআরএম এবং ইনভেন্টরি নিয়ন্ত্রণ।',
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
                'features_bn' => [
                    '১টি ফার্মেসি ব্যবসা এবং হেড অফিস শাখা',
                    'সর্বোচ্চ ৫ জন কর্মী অ্যাকাউন্ট',
                    'ব্যাচ ও মেয়াদোত্তীর্ণ ট্র্যাকিং (FEFO)',
                    'কাস্টমার সিআরএম ও রোগীর অ্যালার্জি প্রোফাইল',
                    'দৈনিক সেলস ও স্ট্যান্ডার্ড পিওএস ইনভয়েস',
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
                'name_bn' => 'গ্রোথ চেইন',
                'description' => 'Run multiple pharmacy tenants & branches with multi-role RBAC, CRM & supplier automation.',
                'description_bn' => 'মাল্টি-রোল RBAC, রোগী সিআরএম ও সরবরাহকারী অটোমেশন সহ একাধিক ফার্মেসি ও শাখা পরিচালনা করুন।',
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
                'features_bn' => [
                    '১টি সাবস্ক্রিপশনে সর্বোচ্চ ৩টি ফার্মেসি ব্যবসা',
                    'সর্বোচ্চ ৮টি শাখা ও আন্তঃশাখা স্টক স্থানান্তর',
                    'মাল্টি-রোল কর্মী নিয়োগ ও কাস্টম রোল তৈরি',
                    'কাস্টমার লয়্যালটি সিআরএম ও সাপ্লায়ার ডিরেক্টরি',
                    'কমপ্লায়েন্স ও ডিসপেনসিং অডিট ট্রেইল',
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
                'name_bn' => 'এন্টারপ্রাইজ হসপিটাল',
                'description' => 'Unlimited pharmacy businesses, branches & teams with dedicated compliance controls.',
                'description_bn' => 'ডেডিকেটেড কমপ্লায়েন্স কন্ট্রোল সহ সীমাহীন ফার্মেসি ব্যবসা, শাখা ও কর্মী পরিচালনার সম্পূর্ণ সমাধান।',
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
                'features_bn' => [
                    'সীমাহীন ফার্মেসি ব্যবসা ও শাখা পরিচালনা',
                    'সীমাহীন কাস্টম রোল ও বিস্তারিত RBAC পারমিশন',
                    'অগ্রাধিকারযুক্ত ২৪/৭ সাপোর্ট ও ডেডিকেটেড অনবোর্ডিং',
                    'সম্পূর্ণ সিআরএম, FEFO ডিসপেনসিং ও লেজার এক্সপোর্ট',
                    'এন্টারপ্রাইজ অডিট ও কমপ্লায়েন্স কন্ট্রোল',
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
            $subscriptionService->syncPlanEntitlementsToSubscribers($plan);
        }
    }
}
