<?php

declare(strict_types=1);

namespace App\Modules\Foundation\Application\Ports;

interface TenantContextReader
{
    public function tenantId(): ?int;

    public function branchId(): ?int;

    public function currencyCode(): string;
}

