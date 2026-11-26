<?php

declare(strict_types=1);

namespace App\Modules\Foundation\Application\Ports;

interface AuditLogger
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function record(
        string $action,
        ?string $description = null,
        ?string $subjectType = null,
        string|int|null $subjectId = null,
        array $metadata = [],
        ?int $tenantId = null,
        ?int $userId = null,
    ): void;
}

