<?php

namespace App\Models\Concerns;

use App\Models\Scopes\TenantScope;
use App\Models\Tenant;
use App\Tenancy\CurrentTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope);

        static::creating(function (Model $model): void {
            $context = app(CurrentTenant::class);

            if (! $context->has()) {
                throw new LogicException('A tenant context is required to create a tenant-owned record.');
            }

            if ($model->getAttribute('tenant_id') !== null
                && (int) $model->getAttribute('tenant_id') !== $context->id()) {
                throw new LogicException('The record tenant_id does not match the current tenant context.');
            }

            $model->setAttribute('tenant_id', $context->id());
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function scopeForTenant(Builder $query, Tenant|int $tenant): Builder
    {
        $tenantId = $tenant instanceof Tenant ? $tenant->getKey() : $tenant;

        return $query->withoutGlobalScope(TenantScope::class)
            ->where($this->qualifyColumn('tenant_id'), $tenantId);
    }

    public function resolveRouteBinding($value, $field = null)
    {
        if (! app(CurrentTenant::class)->has()) {
            $tenantId = session('active_tenant_id') ?? auth()->user()?->current_tenant_id;
            if ($tenantId) {
                $tenant = Tenant::find($tenantId);
                if ($tenant) {
                    app(CurrentTenant::class)->set($tenant);
                }
            }
        }

        return parent::resolveRouteBinding($value, $field);
    }
}

