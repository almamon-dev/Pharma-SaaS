<?php

namespace App\Modules\Billing\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subscription extends Model
{
    use BelongsToTenant, HasFactory;

    protected $table = 'subscriptions';

    public const STATUS_TRIAL = 'trial';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_GRACE = 'grace';
    public const STATUS_READ_ONLY = 'read_only';
    public const STATUS_ARCHIVED = 'archived';
    public const STATUS_PENDING_DELETE = 'pending_delete';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'tenant_id',
        'plan_id',
        'billing_cycle',
        'status',
        'starts_at',
        'ends_at',
        'trial_ends_at',
        'grace_until',
        'read_only_since',
        'archive_at',
        'data_delete_after',
        'converted_at',
        'trial_extended_count',
        'auto_renew',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'trial_ends_at' => 'datetime',
            'grace_until' => 'datetime',
            'read_only_since' => 'datetime',
            'archive_at' => 'datetime',
            'data_delete_after' => 'datetime',
            'converted_at' => 'datetime',
            'trial_extended_count' => 'integer',
            'auto_renew' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(SubscriptionEvent::class, 'subscription_id');
    }

    public function isWritable(): bool
    {
        return in_array($this->status, [
            self::STATUS_TRIAL,
            self::STATUS_ACTIVE,
            self::STATUS_GRACE,
        ], true);
    }

    public function isReadOnly(): bool
    {
        return in_array($this->status, [
            self::STATUS_READ_ONLY,
            self::STATUS_ARCHIVED,
            self::STATUS_PENDING_DELETE,
            self::STATUS_CANCELLED,
        ], true);
    }

    public function daysLeft(): int
    {
        $target = $this->status === self::STATUS_TRIAL && $this->trial_ends_at
            ? $this->trial_ends_at
            : $this->ends_at;

        if (! $target) {
            return 0;
        }

        return max(0, (int) now()->diffInDays($target, false));
    }
}

