<?php

declare(strict_types=1);

namespace App\Modules\Foundation\Application\Ports;

interface SequenceNumberGenerator
{
    /**
     * Atomically generate the next gapless sequential document number per tenant.
     */
    public function nextNumber(
        int $tenantId,
        ?int $branchId,
        string $docType,
        string $defaultPrefix = 'DOC',
        int $padding = 6,
    ): string;
}

