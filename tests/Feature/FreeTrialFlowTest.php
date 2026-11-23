<?php

namespace Tests\Feature;

use App\Models\SaasPlan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FreeTrialFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('db:seed');
    }

    public function test_user_can_register_with_plan_and_auto_activate_14_day_free_trial(): void
    {
        $response = $this->post('/register?plan=growth', [
            'business_name' => 'Trial Pharmacy Care',
            'name' => 'Trial Admin User',
            'email' => 'admin@trialpharmacy.test',
            'phone' => '+8801811223344',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
            'plan' => 'growth',
        ]);

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticated();

        $admin = User::where('email', 'admin@trialpharmacy.test')->firstOrFail();
        $this->assertTrue($admin->hasUsableSubscription());

        $sub = $admin->effectiveSubscription();
        $this->assertNotNull($sub);
        $this->assertSame('trialing', $sub->status);
        $this->assertSame('trial', $sub->payment_method);
        $this->assertSame('growth', $sub->plan->key);
        $this->assertNotNull($sub->trial_ends_at);
        $this->assertTrue($sub->trial_ends_at->isFuture());
        $this->assertGreaterThanOrEqual(13, $sub->daysLeft());

        // Full access to dashboard and workspace routes during trial
        $this->actingAs($admin)->get('/dashboard')->assertOk();
        $this->actingAs($admin)->get('/inventory')->assertOk();
        $this->actingAs($admin)->get('/pos')->assertOk();
    }

    public function test_expired_trial_blocks_workspace_and_redirects_to_plans(): void
    {
        $this->post('/register?plan=starter', [
            'business_name' => 'Expired Trial Pharmacy',
            'name' => 'Trial User',
            'email' => 'admin@expiredtrial.test',
            'phone' => '+8801811223345',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
            'plan' => 'starter',
        ])->assertRedirect('/dashboard');

        $admin = User::where('email', 'admin@expiredtrial.test')->firstOrFail();
        $sub = $admin->effectiveSubscription();
        $this->assertNotNull($sub);

        // Simulate 14 days passing by setting trial_ends_at to the past
        $sub->forceFill([
            'trial_ends_at' => now()->subDay(),
            'current_period_ends_at' => now()->subDay(),
        ])->save();

        $this->assertFalse($admin->fresh()->hasUsableSubscription());

        // Workspace protected routes redirect to /plans with error
        $this->actingAs($admin)->get('/dashboard')->assertRedirect('/plans');
        $this->actingAs($admin)->get('/pos')->assertRedirect('/plans');
        $this->actingAs($admin)->get('/inventory')->assertRedirect('/plans');

        // Plans page is accessible
        $this->actingAs($admin)->get('/plans')->assertOk();
    }
}

