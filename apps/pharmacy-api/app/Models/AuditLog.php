<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Tenancy\CurrentTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'action',
        'auditable_type',
        'auditable_id',
        'description',
        'metadata',
        'ip_address',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function record(
        string $action,
        ?string $description = null,
        ?Model $subject = null,
        array $metadata = [],
        ?int $tenantId = null,
        ?int $userId = null,
    ): self {
        $currentTenant = app(CurrentTenant::class);

        $write = fn (int $resolvedTenantId): self => self::create([
            'tenant_id' => $resolvedTenantId,
            'user_id' => $userId ?? auth()->id(),
            'action' => $action,
            'auditable_type' => $subject?->getMorphClass(),
            'auditable_id' => $subject?->getKey(),
            'description' => $description,
            'metadata' => $metadata,
            'ip_address' => request()?->ip(),
            'created_at' => now(),
        ]);

        if ($tenantId !== null && (! $currentTenant->has() || $currentTenant->id() !== $tenantId)) {
            $target = Tenant::findOrFail($tenantId);

            return $currentTenant->run($target, fn () => $write($tenantId));
        }

        return $write($currentTenant->id());
    }
}
