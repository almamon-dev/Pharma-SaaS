<?php

namespace App\Tenancy;

use App\Models\Tenant;
use Closure;
use Illuminate\Support\Facades\DB;
use LogicException;

class CurrentTenant
{
    private ?Tenant $tenant = null;

    public function set(Tenant $tenant): void
    {
        $this->tenant = $tenant;

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("SELECT set_config('app.tenant_id', :id, false)", [
                'id' => (string) $tenant->getKey(),
            ]);
        }
    }

    public function get(): Tenant
    {
        return $this->tenant ?? throw new LogicException('No tenant has been resolved for the current context.');
    }

    public function id(): int
    {
        return (int) $this->get()->getKey();
    }

    public function has(): bool
    {
        return $this->tenant !== null;
    }

    public function clear(): void
    {
        $this->tenant = null;

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("SELECT set_config('app.tenant_id', '', false)");
        }
    }

    public function run(Tenant $tenant, Closure $callback): mixed
    {
        $previous = $this->tenant;
        $this->set($tenant);

        try {
            return $callback($tenant);
        } finally {
            if ($previous !== null) {
                $this->set($previous);
            } else {
                $this->clear();
            }
        }
    }
}


