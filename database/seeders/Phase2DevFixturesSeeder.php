<?php

namespace Database\Seeders;

use App\Actions\Tenancy\ProvisionTenantAccess;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Billing\Models\Plan;
use App\Modules\Billing\Models\Subscription;
use App\Modules\Billing\Models\SubscriptionEvent;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class Phase2DevFixturesSeeder extends Seeder
{
    public function run(): void
    {
        $basicPlan = Plan::where('code', 'basic')->firstOrFail();
        $standardPlan = Plan::where('code', 'standard')->firstOrFail();
        $premiumPlan = Plan::where('code', 'premium')->firstOrFail();
        $trialPlan = Plan::where('code', 'trial')->firstOrFail();

        $fixtures = [
            [
                'tenant_name' => 'Popular Pharmacy (Basic)',
                'slug' => 'demo-basic',
                'owner_name' => 'Basic Pharmacy Owner',
                'owner_email' => 'owner.basic@pharma.test',
                'plan' => $basicPlan,
                'status' => Subscription::STATUS_ACTIVE,
                'billing_cycle' => 'monthly',
                'starts_at' => now()->subDays(10),
                'ends_at' => now()->addDays(20),
            ],
            [
                'tenant_name' => 'MedLife Pharma (Standard)',
                'slug' => 'demo-standard',
                'owner_name' => 'Standard Pharmacy Owner',
                'owner_email' => 'owner.standard@pharma.test',
                'plan' => $standardPlan,
                'status' => Subscription::STATUS_ACTIVE,
                'billing_cycle' => 'yearly',
                'starts_at' => now()->subMonths(2),
                'ends_at' => now()->addMonths(10),
            ],
            [
                'tenant_name' => 'Arogya Super Pharmacy (Premium)',
                'slug' => 'demo-premium',
                'owner_name' => 'Premium Pharmacy Owner',
                'owner_email' => 'owner.premium@pharma.test',
                'plan' => $premiumPlan,
                'status' => Subscription::STATUS_ACTIVE,
                'billing_cycle' => 'yearly',
                'starts_at' => now()->subMonth(),
                'ends_at' => now()->addMonths(11),
            ],
            [
                'tenant_name' => 'CarePoint Pharmacy (Trial)',
                'slug' => 'demo-trial',
                'owner_name' => 'Trial Pharmacy Owner',
                'owner_email' => 'owner.trial@pharma.test',
                'plan' => $trialPlan,
                'status' => Subscription::STATUS_TRIAL,
                'billing_cycle' => 'monthly',
                'starts_at' => now()->subDays(3),
                'ends_at' => now()->addDays(11),
                'trial_ends_at' => now()->addDays(11),
            ],
            [
                'tenant_name' => 'Square Health (Grace Period)',
                'slug' => 'demo-grace',
                'owner_name' => 'Grace Pharmacy Owner',
                'owner_email' => 'owner.grace@pharma.test',
                'plan' => $standardPlan,
                'status' => Subscription::STATUS_GRACE,
                'billing_cycle' => 'monthly',
                'starts_at' => now()->subDays(35),
                'ends_at' => now()->subDays(5),
                'grace_until' => now()->addDays(5),
            ],
            [
                'tenant_name' => 'City Drug House (Read-Only)',
                'slug' => 'demo-readonly',
                'owner_name' => 'ReadOnly Pharmacy Owner',
                'owner_email' => 'owner.readonly@pharma.test',
                'plan' => $basicPlan,
                'status' => Subscription::STATUS_READ_ONLY,
                'billing_cycle' => 'monthly',
                'starts_at' => now()->subDays(60),
                'ends_at' => now()->subDays(15),
                'read_only_since' => now()->subDays(5),
            ],
        ];

        foreach ($fixtures as $fixture) {
            $owner = User::updateOrCreate(
                ['email' => $fixture['owner_email']],
                [
                    'name' => $fixture['owner_name'],
                    'password' => Hash::make('Password@1234'),
                    'account_type' => 'admin',
                    'status' => 'active',
                ]
            );

            $tenant = Tenant::updateOrCreate(
                ['slug' => $fixture['slug']],
                [
                    'name' => $fixture['tenant_name'],
                    'owner_id' => $owner->id,
                    'status' => 'active',
                ]
            );

            $owner->current_tenant_id = $tenant->id;
            $owner->save();

            // Link owner in tenant_user if not exists
            if (! $tenant->users()->where('users.id', $owner->id)->exists()) {
                $tenant->users()->attach($owner->id, [
                    'is_owner' => true,
                    'role' => 'admin',
                    'roles' => json_encode(['admin']),
                    'is_active' => true,
                    'joined_at' => now(),
                ]);
            }

            // Provision tenant roles
            app(ProvisionTenantAccess::class)->execute($tenant);

            // Create subscription within tenant context
            app(\App\Tenancy\CurrentTenant::class)->run($tenant, function () use ($tenant, $fixture) {
                $sub = Subscription::updateOrCreate(
                    ['tenant_id' => $tenant->id, 'plan_id' => $fixture['plan']->id],
                    [
                        'billing_cycle' => $fixture['billing_cycle'],
                        'status' => $fixture['status'],
                        'starts_at' => $fixture['starts_at'],
                        'ends_at' => $fixture['ends_at'],
                        'trial_ends_at' => $fixture['trial_ends_at'] ?? null,
                        'grace_until' => $fixture['grace_until'] ?? null,
                        'read_only_since' => $fixture['read_only_since'] ?? null,
                        'auto_renew' => $fixture['status'] === Subscription::STATUS_ACTIVE,
                    ]
                );

                SubscriptionEvent::create([
                    'tenant_id' => $tenant->id,
                    'subscription_id' => $sub->id,
                    'from_status' => null,
                    'to_status' => $fixture['status'],
                    'reason' => 'Seeded fixture subscription for Phase 2 dev/test',
                    'actor_type' => 'Seeder',
                    'actor_id' => null,
                    'created_at' => now(),
                ]);
            });
        }
    }
}
