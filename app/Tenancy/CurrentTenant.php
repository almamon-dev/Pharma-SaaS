<?php

namespace App\Tenancy;

use App\Models\Tenant;
use Closure;
use LogicException;

class CurrentTenant
{
    private ?Tenant $tenant = null;

    public function set(Tenant $tenant): void
    {
        $this->tenant = $tenant;
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
    }

    public function run(Tenant $tenant, Closure $callback): mixed
    {
        $previous = $this->tenant;
        $this->set($tenant);

        try {
            return $callback($tenant);
        } finally {
            $this->tenant = $previous;
        }
    }
}

