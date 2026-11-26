<?php

declare(strict_types=1);

namespace App\Modules\Billing\Providers;

use App\Modules\Billing\Commands\SetTenantOverrideCommand;
use App\Modules\Billing\Commands\SetTenantPlanCommand;
use App\Modules\Billing\Contracts\ResourceLimitHook;
use App\Modules\Billing\Events\AddonChanged;
use App\Modules\Billing\Events\OverrideChanged;
use App\Modules\Billing\Events\PlanChanged;
use App\Modules\Billing\Events\SubscriptionStatusChanged;
use App\Modules\Billing\Listeners\InvalidateTenantFeatureCache;
use App\Modules\Billing\Services\DefaultResourceLimitHook;
use App\Modules\Billing\Services\FeatureManager;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

final class BillingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(FeatureManager::class);
        $this->app->singleton(ResourceLimitHook::class, DefaultResourceLimitHook::class);
    }

    public function boot(): void
    {
        Event::listen(PlanChanged::class, InvalidateTenantFeatureCache::class);
        Event::listen(OverrideChanged::class, InvalidateTenantFeatureCache::class);
        Event::listen(AddonChanged::class, InvalidateTenantFeatureCache::class);
        Event::listen(SubscriptionStatusChanged::class, InvalidateTenantFeatureCache::class);

        if ($this->app->runningInConsole()) {
            $this->commands([
                SetTenantPlanCommand::class,
                SetTenantOverrideCommand::class,
            ]);
        }
    }
}

