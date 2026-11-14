<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TenantSubscription extends Model
{
    use HasFactory;

    protected $table = 'tenant_subscriptions';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'saas_plan_id',
        'status',
        'billing_cycle',
        'currency_code',
        'unit_price',
        'discount_amount',
        'tax_percent',
        'payment_method',
        'transaction_ref',
        'trial_ends_at',
        'current_period_starts_at',
        'current_period_ends_at',
        'grace_ends_at',
        'cancelled_at',
        'internal_notes',
        'version',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_percent' => 'decimal:2',
            'trial_ends_at' => 'datetime',
            'current_period_starts_at' => 'datetime',
            'current_period_ends_at' => 'datetime',
            'grace_ends_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function subscriber(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SaasPlan::class, 'saas_plan_id');
    }

    public function ledger(): HasMany
    {
        return $this->hasMany(SubscriptionLedger::class);
    }

    public function recurringAmount(): float
    {
        return max(
            0,
            round(((float) $this->unit_price - (float) $this->discount_amount) * (1 + ((float) $this->tax_percent / 100)), 2)
        );
    }

    public function isUsable(): bool
    {
        if (! in_array($this->status, ['active', 'trialing'], true)) {
            return false;
        }

        if ($this->status === 'trialing') {
            return $this->trial_ends_at === null || $this->trial_ends_at->isFuture();
        }

        return $this->current_period_ends_at === null || $this->current_period_ends_at->isFuture();
    }

    public function daysLeft(): int
    {
        $endDate = $this->status === 'trialing'
            ? ($this->trial_ends_at ?? $this->current_period_ends_at)
            : $this->current_period_ends_at;

        if (! $endDate || $endDate->isPast()) {
            return 0;
        }

        return (int) now()->startOfDay()->diffInDays($endDate, false);
    }
}

