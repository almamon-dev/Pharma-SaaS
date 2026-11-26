<?php

namespace App\Modules\Accounting\Models;

use App\Models\Branch;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostingError extends Model
{
    use BelongsToTenant;

    public const STATUS_PENDING = 'pending';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_IGNORED = 'ignored';

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'source_module',
        'source_id',
        'source_event',
        'payload',
        'error',
        'retry_count',
        'status',
        'resolved_voucher_id',
        'last_retried_at',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'retry_count' => 'integer',
            'last_retried_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function resolvedVoucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class, 'resolved_voucher_id');
    }
}

