<?php

namespace App\Modules\Billing\Commands;

use App\Models\Tenant;
use App\Modules\Billing\Actions\ChangePlan;
use App\Modules\Billing\Models\Plan;
use Illuminate\Console\Command;

class SetTenantPlanCommand extends Command
{
    protected $signature = 'tenant:set-plan
                            {tenant : The ID or slug/code of the tenant}
                            {plan : The code or ID of the plan}
                            {cycle=monthly : Billing cycle (monthly or yearly)}';

    protected $description = 'Change the subscription plan for a pharmacy tenant';

    public function handle(ChangePlan $changePlan): int
    {
        $tenantInput = $this->argument('tenant');
        $planInput = $this->argument('plan');
        $cycle = strtolower((string) $this->argument('cycle'));

        if (! in_array($cycle, ['monthly', 'yearly'], true)) {
            $this->error("Invalid billing cycle '{$cycle}'. Must be 'monthly' or 'yearly'.");
            return 1;
        }

        $tenant = is_numeric($tenantInput)
            ? Tenant::find($tenantInput)
            : Tenant::where('slug', $tenantInput)->orWhere('name', $tenantInput)->first();

        if (! $tenant) {
            $this->error("Tenant '{$tenantInput}' not found.");
            return 1;
        }

        $plan = is_numeric($planInput)
            ? Plan::find($planInput)
            : Plan::where('code', $planInput)->orWhere('name', $planInput)->first();

        if (! $plan) {
            $this->error("Plan '{$planInput}' not found.");
            return 1;
        }

        $this->info("Evaluating impact for {$tenant->name} switching to {$plan->name} ({$cycle})...");

        $sub = $changePlan->execute(
            tenant: $tenant,
            newPlan: $plan,
            billingCycle: $cycle,
            actor: null,
            reason: 'Artisan CLI manual update'
        );

        $this->info("Successfully updated tenant {$tenant->name} to plan {$plan->name} ({$cycle}).");
        $this->line("Subscription ID: {$sub->id}, Status: {$sub->status}, Ends At: {$sub->ends_at}");

        return 0;
    }
}

