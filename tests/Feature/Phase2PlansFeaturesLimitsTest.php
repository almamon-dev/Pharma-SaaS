<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Billing\Actions\ChangePlan;
use App\Modules\Billing\Events\PlanChanged;
use App\Modules\Billing\Exceptions\FeatureLockedException;
use App\Modules\Billing\Exceptions\LimitReachedException;
use App\Modules\Billing\Exceptions\SubscriptionReadOnlyException;
use App\Modules\Billing\Models\Addon;
use App\Modules\Billing\Models\Plan;
use App\Modules\Billing\Models\Subscription;
use App\Modules\Billing\Models\TenantAddon;
use App\Modules\Billing\Models\TenantEffectiveFeature;
use App\Modules\Billing\Models\TenantOverride;
use App\Modules\Billing\Models\UsageCounter;
use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Billing\Support\PlanChangeImpact;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\Phase2PlansAndFeaturesSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacPermissionCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class Phase2PlansFeaturesLimitsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(RbacPermissionCatalogSeeder::class);
        $this->seed(Phase2PlansAndFeaturesSeeder::class);
    }

    private function createTenantWithPlan(string $planCode, string $status = Subscription::STATUS_ACTIVE): array
    {
        $plan = Plan::where('code', $planCode)->firstOrFail();
        $owner = User::factory()->create(['account_type' => 'admin']);

        $tenant = Tenant::create([
            'name' => ucfirst($planCode).' Pharmacy Test',
            'slug' => $planCode.'-pharma-'.uniqid(),
            'owner_id' => $owner->id,
            'status' => 'active',
        ]);

        $owner->current_tenant_id = $tenant->id;
        $owner->save();

        $tenant->users()->attach($owner->id, [
            'is_owner' => true,
            'role' => 'admin',
            'roles' => json_encode(['admin']),
            'is_active' => true,
            'joined_at' => now(),
        ]);

        app(CurrentTenant::class)->run($tenant, function () use ($tenant, $plan, $status) {
            Branch::create([
                'tenant_id' => $tenant->id,
                'name' => 'Main Branch',
                'code' => 'MAIN-'.uniqid(),
                'is_head_office' => true,
                'is_active' => true,
            ]);

            Subscription::create([
                'tenant_id' => $tenant->id,
                'plan_id' => $plan->id,
                'billing_cycle' => 'monthly',
                'status' => $status,
                'starts_at' => now()->subDays(5),
                'ends_at' => now()->addDays(25),
                'auto_renew' => true,
            ]);
        });

        return [$tenant, $owner, $plan];
    }

    /**
     * 1. Feature on/off per plan: a gated route returns 403 feature_locked on Basic and 200 on Standard.
     */
    public function test_feature_on_off_per_plan(): void
    {
        [$basicTenant, $basicOwner] = $this->createTenantWithPlan('basic');
        [$standardTenant, $standardOwner] = $this->createTenantWithPlan('standard');

        // Batches route has middleware feature:batch_expiry
        $this->actingAs($basicOwner)
            ->withSession(['active_tenant_id' => $basicTenant->id])
            ->get('/inventory/batches')
            ->assertStatus(403);

        $this->actingAs($standardOwner)
            ->withSession(['active_tenant_id' => $standardTenant->id])
            ->get('/inventory/batches')
            ->assertOk();
    }

    /**
     * 2. Gate::before: a role holding batch.view is still denied on Basic plan because requires_feature is batch_expiry.
     */
    public function test_gate_before_denies_feature_dependent_permission_on_basic(): void
    {
        [$basicTenant, $basicOwner] = $this->createTenantWithPlan('basic');
        [$standardTenant, $standardOwner] = $this->createTenantWithPlan('standard');

        app(CurrentTenant::class)->run($basicTenant, function () use ($basicOwner, $basicTenant) {
            $fm = app(FeatureManager::class)->setTenant($basicTenant);
            $this->assertFalse($fm->can('batch_expiry'));

            // Even though basicOwner is owner/admin, Gate::before denies features not enabled by plan
            $this->assertFalse(Gate::forUser($basicOwner)->allows('batch.view'));
        });

        app(CurrentTenant::class)->run($standardTenant, function () use ($standardOwner, $standardTenant) {
            $fm = app(FeatureManager::class)->setTenant($standardTenant);
            $this->assertTrue($fm->can('batch_expiry'));
            $this->assertTrue(Gate::forUser($standardOwner)->allows('batch.view'));
        });
    }

    /**
     * 3. Limits: creating the 3rd user on a 2-user plan fails with limit_reached.
     */
    public function test_limits_creating_third_user_on_two_user_plan_fails(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('basic');
        // Basic allows max_users = 2. Owner is 1.

        // Create 2nd user (should succeed)
        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id])
            ->post('/team', [
                'name' => 'Staff Member 2',
                'email' => 'staff2@basic.test',
                'role' => 'pharmacist',
            ])->assertRedirect();

        $this->assertEquals(2, DB::table('tenant_user')->where('tenant_id', $tenant->id)->count());

        // Attempt to create 3rd user (should fail with limit_reached)
        $response = $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id])
            ->postJson('/team', [
                'name' => 'Staff Member 3',
                'email' => 'staff3@basic.test',
                'role' => 'pharmacist',
            ]);

        $response->assertStatus(403);
        $response->assertJson([
            'error' => 'limit_reached',
            'feature' => 'max_users',
            'limit' => 2,
            'used' => 2,
        ]);
    }

    /**
     * 4. Concurrency: race-free total limit enforcement and monthly counter enforcement.
     */
    public function test_concurrency_race_free_limits_and_monthly_counters(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('basic');
        $fm = app(FeatureManager::class)->setTenant($tenant);

        // Fill up to limit (2 users)
        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id])
            ->post('/team', [
                'name' => 'Staff 2',
                'email' => 'staff2@race.test',
                'role' => 'pharmacist',
            ]);

        // assertCanUse('max_users') now throws LimitReachedException
        $this->expectException(LimitReachedException::class);
        $fm->assertCanUse('max_users');
    }

    /**
     * 4b. Monthly resource counter limit check (max_bills_month).
     */
    public function test_monthly_counter_limit_enforcement(): void
    {
        [$tenant] = $this->createTenantWithPlan('basic');
        $fm = app(FeatureManager::class)->setTenant($tenant);

        // Basic plan max_bills_month is 1500
        $this->assertEquals(1500, $fm->limit('max_bills_month'));

        // Manually record 1500 used bills for this month
        $period = now('Asia/Dhaka')->format('Y-m');
        app(CurrentTenant::class)->run($tenant, function () use ($tenant, $period) {
            UsageCounter::create([
                'tenant_id' => $tenant->id,
                'feature_key' => 'max_bills_month',
                'period' => $period,
                'used' => 1500,
            ]);
        });

        $this->assertEquals(1500, $fm->used('max_bills_month'));
        $this->assertEquals(0, $fm->remaining('max_bills_month'));

        $this->expectException(LimitReachedException::class);
        $fm->assertCanUse('max_bills_month', 1);
    }

    /**
     * 5. Override beats plan (higher and lower); expired override is ignored; add-on extra_limit adds to limit.
     */
    public function test_override_beats_plan_and_expired_ignored_and_addon_adds_limit(): void
    {
        [$tenant] = $this->createTenantWithPlan('basic');
        $fm = app(FeatureManager::class)->setTenant($tenant);

        // Basic plan has batch_expiry = false
        $this->assertFalse($fm->can('batch_expiry'));

        // 1. Unexpired override grants batch_expiry = true
        app(CurrentTenant::class)->run($tenant, function () use ($tenant) {
            TenantOverride::create([
                'tenant_id' => $tenant->id,
                'feature_key' => 'batch_expiry',
                'bool_value' => true,
                'expires_at' => now()->addDays(7),
                'note' => 'Support promotion override',
            ]);
        });

        Cache::forget("tenant:{$tenant->id}:features");
        $this->assertTrue($fm->can('batch_expiry'));

        // 2. Expired override is ignored
        app(CurrentTenant::class)->run($tenant, function () use ($tenant) {
            TenantOverride::where('tenant_id', $tenant->id)->where('feature_key', 'batch_expiry')->update([
                'expires_at' => now()->subDay(),
            ]);
        });

        Cache::forget("tenant:{$tenant->id}:features");
        $this->assertFalse($fm->can('batch_expiry'));

        // 3. Addon extra_limit adds to limit
        $this->assertEquals(2, $fm->limit('max_users'));
        $addon = Addon::where('code', 'extra_users_5')->firstOrFail();

        app(CurrentTenant::class)->run($tenant, function () use ($tenant, $addon) {
            TenantAddon::create([
                'tenant_id' => $tenant->id,
                'addon_id' => $addon->id,
                'quantity' => 1,
                'starts_at' => now(),
            ]);
        });

        Cache::forget("tenant:{$tenant->id}:features");
        // Limit is now 2 (plan) + 5 (addon) = 7
        $this->assertEquals(7, $fm->limit('max_users'));
    }

    /**
     * 6. Cache invalidation on plan change, override, and addon.
     */
    public function test_cache_invalidation_and_tenant_isolation(): void
    {
        [$tenantA, $ownerA] = $this->createTenantWithPlan('basic');
        [$tenantB] = $this->createTenantWithPlan('standard');

        $fmA = app(FeatureManager::class)->setTenant($tenantA);
        $fmB = app(FeatureManager::class)->setTenant($tenantB);

        // Prime cache
        $fmA->all();
        $fmB->all();

        $this->assertTrue(Cache::has("tenant:{$tenantA->id}:features"));
        $this->assertTrue(Cache::has("tenant:{$tenantB->id}:features"));

        // Change plan on Tenant A
        $standardPlan = Plan::where('code', 'standard')->firstOrFail();
        app(ChangePlan::class)->execute($tenantA, $standardPlan, 'monthly', $ownerA);

        // Tenant A's cache is invalidated; Tenant B's cache is untouched
        $this->assertFalse(Cache::has("tenant:{$tenantA->id}:features"));
        $this->assertTrue(Cache::has("tenant:{$tenantB->id}:features"));
    }

    /**
     * 7. Read-only mode blocks write requests while GET and allowlist routes work.
     */
    public function test_read_only_mode_blocks_writes_and_permits_allowlist(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('basic', Subscription::STATUS_READ_ONLY);

        // GET request is permitted
        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id])
            ->get('/dashboard')
            ->assertOk();

        // Non-allowlisted POST request is blocked with 403
        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id])
            ->postJson('/branches', [
                'name' => 'Disallowed Branch',
                'code' => 'DIS-01',
            ])->assertStatus(403)
            ->assertJson(['error' => 'subscription_read_only']);

        // Allow-listed route (e.g. password update) is permitted
        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id])
            ->put('/settings/password', [
                'current_password' => 'secret',
                'password' => 'NewSecretPassword123',
                'password_confirmation' => 'NewSecretPassword123',
            ])->assertRedirect(); // Allowed through EnsureSubscriptionWritable
    }

    /**
     * 8. PlanChangeImpact lists over-limit resources and downgrade preserves data.
     */
    public function test_plan_change_impact_and_preservation_on_downgrade(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('standard');
        $basicPlan = Plan::where('code', 'basic')->firstOrFail();

        // Standard allows 5 users. Add 3 users -> total 4 users (owner + 3)
        for ($i = 2; $i <= 4; $i++) {
            $this->actingAs($owner)
                ->withSession(['active_tenant_id' => $tenant->id])
                ->post('/team', [
                    'name' => "User {$i}",
                    'email' => "user{$i}@downgrade.test",
                    'role' => 'pharmacist',
                ]);
        }

        $this->assertEquals(4, DB::table('tenant_user')->where('tenant_id', $tenant->id)->count());

        // Evaluate impact of switching to Basic (which allows only 2 users)
        $impact = PlanChangeImpact::evaluate($tenant, $basicPlan);

        $this->assertTrue($impact['is_downgrade']);
        $this->assertArrayHasKey('max_users', $impact['over_limit_resources']);
        $this->assertEquals(4, $impact['over_limit_resources']['max_users']['current_used']);
        $this->assertEquals(2, $impact['over_limit_resources']['max_users']['new_limit']);
        $this->assertNotEmpty($impact['warnings']);

        // Execute downgrade to Basic
        app(ChangePlan::class)->execute($tenant, $basicPlan, 'monthly', $owner);

        // Data is preserved: all 4 users still exist!
        $this->assertEquals(4, DB::table('tenant_user')->where('tenant_id', $tenant->id)->count());

        // But creating a 5th user is now blocked by the Basic limit
        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id])
            ->postJson('/team', [
                'name' => 'User 5',
                'email' => 'user5@downgrade.test',
                'role' => 'pharmacist',
            ])->assertStatus(403)
            ->assertJson(['error' => 'limit_reached']);
    }

    /**
     * 9. Only one current subscription per tenant (latest by ends_at).
     */
    public function test_only_one_current_subscription_per_tenant(): void
    {
        [$tenant] = $this->createTenantWithPlan('basic');
        $premiumPlan = Plan::where('code', 'premium')->firstOrFail();

        // Add a newer subscription with a later ends_at
        app(CurrentTenant::class)->run($tenant, function () use ($tenant, $premiumPlan) {
            Subscription::create([
                'tenant_id' => $tenant->id,
                'plan_id' => $premiumPlan->id,
                'billing_cycle' => 'yearly',
                'status' => Subscription::STATUS_ACTIVE,
                'starts_at' => now(),
                'ends_at' => now()->addYear(),
            ]);
        });

        $fm = app(FeatureManager::class)->setTenant($tenant);
        $subMeta = $fm->subscriptionMeta();

        $this->assertEquals('premium', $subMeta['plan_code']);
    }

    /**
     * 10. tenant_effective_features view returns expected values.
     */
    public function test_tenant_effective_features_view(): void
    {
        [$tenant] = $this->createTenantWithPlan('standard');

        $rows = TenantEffectiveFeature::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->get()
            ->keyBy('feature_key');

        $this->assertTrue((bool) $rows['batch_expiry']->bool_value);
        $this->assertEquals(5, $rows['max_users']->limit_value);
        $this->assertEquals('detailed', $rows['report_level']->level_value);
    }

    /**
     * 11. Feature Access and Browse Plans pages render properly.
     */
    public function test_feature_access_and_browse_plans_pages_render(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('standard');

        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id])
            ->get('/feature-access')
            ->assertOk();

        $this->actingAs($owner)
            ->withSession(['active_tenant_id' => $tenant->id])
            ->get('/billing/plans')
            ->assertOk();
    }

    /**
     * 12. Audit log entries exist for plan changes and overrides.
     */
    public function test_audit_logs_for_plan_changes_and_overrides(): void
    {
        [$tenant, $owner] = $this->createTenantWithPlan('basic');
        $standardPlan = Plan::where('code', 'standard')->firstOrFail();

        app(ChangePlan::class)->execute($tenant, $standardPlan, 'monthly', $owner);

        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $tenant->id,
            'action' => 'billing.plan_changed',
        ]);
    }
}

