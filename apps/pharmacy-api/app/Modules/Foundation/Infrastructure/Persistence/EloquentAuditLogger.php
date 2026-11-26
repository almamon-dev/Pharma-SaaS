<?php

declare(strict_types=1);

namespace App\Modules\Foundation\Infrastructure\Persistence;

use App\Models\AuditLog;
use App\Models\Tenant;
use App\Modules\Foundation\Application\Ports\AuditLogger;
use App\Tenancy\CurrentTenant;

final class EloquentAuditLogger implements AuditLogger
{
    public function __construct(
        private readonly CurrentTenant $currentTenant,
    ) {}

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
    ): void {
        $write = static function (int $resolvedTenantId) use ($action, $description, $subjectType, $subjectId, $metadata, $userId): void {
            AuditLog::query()->create([
                'tenant_id' => $resolvedTenantId,
                'user_id' => $userId ?? auth()->id(),
                'action' => $action,
                'auditable_type' => $subjectType,
                'auditable_id' => $subjectId !== null ? (string) $subjectId : null,
                'description' => $description,
                'metadata' => $metadata,
                'ip_address' => request()?->ip(),
                'created_at' => now(),
            ]);
        };

        if ($tenantId !== null && (! $this->currentTenant->has() || $this->currentTenant->id() !== $tenantId)) {
            $target = Tenant::query()->findOrFail($tenantId);
            $this->currentTenant->run($target, fn () => $write($tenantId));

            return;
        }

        $write($this->currentTenant->id());
    }
}

