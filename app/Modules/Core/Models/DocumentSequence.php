<?php

namespace App\Modules\Core\Models;

use App\Models\Branch;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class DocumentSequence extends Model
{
    use BelongsToTenant;

    protected $table = 'document_sequences';

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'doc_type',
        'prefix',
        'next_number',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Atomically generates and increments the next document number.
     * e.g. "INV-DHK-2026-000042"
     */
    public static function nextNumber(
        int $tenantId,
        ?int $branchId,
        string $docType,
        string $defaultPrefix = 'DOC',
        int $padding = 6
    ): string {
        return DB::transaction(function () use ($tenantId, $branchId, $docType, $defaultPrefix, $padding) {
            $seq = static::query()
                ->where('tenant_id', $tenantId)
                ->where('branch_id', $branchId)
                ->where('doc_type', $docType)
                ->lockForUpdate()
                ->first();

            if (! $seq) {
                $seq = static::query()->create([
                    'tenant_id' => $tenantId,
                    'branch_id' => $branchId,
                    'doc_type' => $docType,
                    'prefix' => $defaultPrefix,
                    'next_number' => 1,
                ]);
            }

            $currentNumber = $seq->next_number;
            $seq->next_number = $currentNumber + 1;
            $seq->save();

            $formatted = str_pad((string) $currentNumber, $padding, '0', STR_PAD_LEFT);
            $prefix = $seq->prefix ?: $defaultPrefix;

            return "{$prefix}-{$formatted}";
        });
    }
}

