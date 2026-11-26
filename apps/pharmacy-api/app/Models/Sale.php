<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Sale extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'counter_id',
        'counter_session_id',
        'customer_id',
        'user_id',
        'salesman_id',
        'cashier_id',
        'order_number',
        'order_status', // 'draft', 'submitted', 'unassigned', 'assigned', 'waiting', 'processing', 'payment_pending', 'partially_paid', 'paid', 'completed', 'cancelled', 'reassigned'
        'invoice_number',
        'subtotal',
        'discount_amount',
        'tax_amount',
        'total_amount',
        'paid_amount',
        'due_amount',
        'change_amount',
        'payment_method',
        'payment_status',
        'doctor_name',
        'prescription_notes',
        'prescription_reference',
        'prescription_file',
        'requires_verification',
        'verification_status', // 'not_required', 'pending', 'approved', 'rejected'
        'verified_by',
        'discount_percentage',
        'discount_status', // 'none', 'approved', 'pending_approval', 'rejected'
        'discount_requested_by',
        'discount_approved_by',
        'discount_approved_at',
        'discount_rejection_reason',
        'notes',
        'internal_notes',
        'sold_at',
        'assigned_at',
        'processing_started_at',
        'completed_at',
        'cancelled_at',
        'cancellation_reason',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'discount_percentage' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'due_amount' => 'decimal:2',
            'change_amount' => 'decimal:2',
            'sold_at' => 'datetime',
            'assigned_at' => 'datetime',
            'processing_started_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'discount_approved_at' => 'datetime',
            'requires_verification' => 'boolean',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function counter(): BelongsTo
    {
        return $this->belongsTo(Counter::class);
    }

    public function counterSession(): BelongsTo
    {
        return $this->belongsTo(CounterSession::class, 'counter_session_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function salesman(): BelongsTo
    {
        return $this->belongsTo(User::class, 'salesman_id');
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function discountRequestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'discount_requested_by');
    }

    public function discountApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'discount_approved_by');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SalePayment::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(CounterAssignment::class);
    }

    public function latestAssignment(): HasOne
    {
        return $this->hasOne(CounterAssignment::class)->latestOfMany();
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(SaleStatusHistory::class)->orderBy('created_at', 'desc');
    }

    public function recordStatus(string $toStatus, ?User $user = null, ?string $reason = null, ?array $metadata = null): void
    {
        $fromStatus = $this->order_status;
        $this->order_status = $toStatus;
        $this->save();

        SaleStatusHistory::query()->create([
            'tenant_id' => $this->tenant_id,
            'sale_id' => $this->id,
            'user_id' => $user?->id ?? auth()->id(),
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'reason' => $reason,
            'metadata' => $metadata,
            'created_at' => now(),
        ]);
    }

    public function scopeActiveQueue(Builder $query): Builder
    {
        return $query->whereIn('order_status', ['assigned', 'waiting', 'processing']);
    }

    public function scopeUnassigned(Builder $query): Builder
    {
        return $query->where('order_status', 'unassigned');
    }
}
