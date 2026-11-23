<?php

namespace App\Providers;

use App\Models\Permission;
use App\Models\User;
use App\Modules\Billing\Contracts\ResourceLimitHook;
use App\Modules\Billing\Events\AddonChanged;
use App\Modules\Billing\Events\OverrideChanged;
use App\Modules\Billing\Events\PlanChanged;
use App\Modules\Billing\Events\SubscriptionStatusChanged;
use App\Modules\Billing\Listeners\InvalidateTenantFeatureCache;
use App\Modules\Billing\Services\DefaultResourceLimitHook;
use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Core\Services\AccessService;
use App\Support\TenantContext;
use App\Tenancy\CurrentTenant;
use Illuminate\Database\Events\TransactionBeginning;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped(CurrentTenant::class);
        $this->app->scoped(TenantContext::class, fn (): TenantContext => new TenantContext);
        $this->app->singleton(AccessService::class);
        $this->app->bind(FeatureManager::class);
        $this->app->singleton(ResourceLimitHook::class, DefaultResourceLimitHook::class);
        $this->app->singleton(\App\Modules\Catalog\Contracts\ProductReferenceChecker::class, \App\Modules\Catalog\Services\DefaultProductReferenceChecker::class);
        $this->app->singleton(\App\Modules\Catalog\Contracts\StockInfoProvider::class, \App\Modules\Catalog\Services\NullStockInfoProvider::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 1. Transaction-level RLS setting
        Event::listen(TransactionBeginning::class, function () {
            if ($this->app->bound(CurrentTenant::class) && $this->app->make(CurrentTenant::class)->has()) {
                $tenantId = (string) $this->app->make(CurrentTenant::class)->id();
                if (DB::getDriverName() === 'pgsql') {
                    DB::statement("SELECT set_config('app.tenant_id', :id, true)", ['id' => $tenantId]);
                }
            }
        });

        // 2. Billing feature cache invalidation listeners
        Event::listen(PlanChanged::class, InvalidateTenantFeatureCache::class);
        Event::listen(OverrideChanged::class, InvalidateTenantFeatureCache::class);
        Event::listen(AddonChanged::class, InvalidateTenantFeatureCache::class);
        Event::listen(SubscriptionStatusChanged::class, InvalidateTenantFeatureCache::class);

        // 3. Register Artisan commands
        if ($this->app->runningInConsole()) {
            $this->commands([
                \App\Modules\Billing\Commands\SetTenantPlanCommand::class,
                \App\Modules\Billing\Commands\SetTenantOverrideCommand::class,
                \App\Modules\Catalog\Commands\SeedCatalogLoadTestCommand::class,
            ]);
        }

        // 3. Central authorization gate
        Gate::before(function (User $user, string $ability, array $arguments = []) {
            if ($user->isSuperAdmin()) {
                return true;
            }

            $featureManager = app(FeatureManager::class);
            $accessService = app(AccessService::class);

            if ($user->current_tenant_id && ! $featureManager->tenant()) {
                $tenant = \App\Models\Tenant::withoutGlobalScopes()->find($user->current_tenant_id);
                if ($tenant) {
                    $featureManager->setTenant($tenant);
                }
            }

            // If the ability is a known permission, verify feature dependency first
            if ($accessService->isPermissionKey($ability)) {
                $perm = Permission::where('key', $ability)->orWhere('name', $ability)->first();
                if ($perm && ! empty($perm->requires_feature)) {
                    if (! $featureManager->can($perm->requires_feature)) {
                        return false; // Denied by plan feature gating
                    }
                }

                $scope = $arguments['scope'] ?? null;
                $branchId = $arguments['branch_id'] ?? session('active_branch_id');

                return $accessService->hasPermission($user, $ability, $scope, $branchId);
            }

            return null;
        });
    }
}
