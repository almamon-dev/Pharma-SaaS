<?php

declare(strict_types=1);

namespace App\Modules\Foundation\Infrastructure\Context;

use App\Modules\Foundation\Application\Ports\TenantContextReader;
use App\Support\TenantContext;

final class LaravelTenantContextReader implements TenantContextReader
{
    public function __construct(
        private readonly TenantContext $tenantContext,
    ) {}

    public function tenantId(): ?int
    {
        return $this->tenantContext->id();
    }

    public function branchId(): ?int
    {
        return $this->tenantContext->branchId();
    }

    public function currencyCode(): string
    {
        return $this->tenantContext->tenant()?->currency_code ?? 'BDT';
    }
}

