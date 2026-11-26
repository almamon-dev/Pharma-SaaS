<?php

declare(strict_types=1);

namespace App\Modules\Core\Providers;

use App\Models\Permission;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Core\Services\AccessService;
use App\Support\TenantContext;
use App\Tenancy\CurrentTenant;
use Illuminate\Database\Events\TransactionBeginning;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class CoreServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(CurrentTenant::class);
        $this->app->scoped(TenantContext::class, static fn (): TenantContext => new TenantContext);
        $this->app->singleton(AccessService::class);
    }

    public function boot(): void
    {
        // 1. Transaction-level PostgreSQL Row-Level Security tenant binding
        Event::listen(TransactionBeginning::class, function (): void {
            if ($this->app->bound(CurrentTenant::class) && $this->app->make(CurrentTenant::class)->has()) {
                $tenantId = (string) $this->app->make(CurrentTenant::class)->id();
                if (DB::getDriverName() === 'pgsql') {
                    DB::statement("SELECT set_config('app.tenant_id', :id, true)", ['id' => $tenantId]);
                }
            }
        });

        // 2. Central permission & plan-feature authorization gate
        Gate::before(function (User $user, string $ability, array $arguments = []) {
            if ($user->isSuperAdmin()) {
                return true;
            }

            $featureManager = app(FeatureManager::class);
            $accessService = app(AccessService::class);

            if ($user->current_tenant_id && ! $featureManager->tenant()) {
                $tenant = Tenant::withoutGlobalScopes()->find($user->current_tenant_id);
                if ($tenant) {
                    $featureManager->setTenant($tenant);
                }
            }

            if ($accessService->isPermissionKey($ability)) {
                $perm = Permission::where('key', $ability)->orWhere('name', $ability)->first();
                if ($perm && ! empty($perm->requires_feature)) {
                    if (! $featureManager->can($perm->requires_feature)) {
                        return false;
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

