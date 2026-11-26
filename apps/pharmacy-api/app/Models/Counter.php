<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Counter extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'code',
        'name',
        'type',
        'zone',
        'location',
        'status',
        'max_queue_capacity',
        'auto_assignment_enabled',
        'last_assigned_at',
        'current_break_reason',
        'break_started_at',
        'current_user_id',
        'printer_ip',
        'terminal_device_id',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'auto_assignment_enabled' => 'boolean',
            'max_queue_capacity' => 'integer',
            'break_started_at' => 'datetime',
            'last_assigned_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function currentUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'current_user_id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(CounterSession::class);
    }

    public function currentSession(): HasOne
    {
        return $this->hasOne(CounterSession::class)->where('status', 'open')->latestOfMany();
    }

    public function breakLogs(): HasMany
    {
        return $this->hasMany(CounterBreakLog::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function cashierAssignments(): HasMany
    {
        return $this->hasMany(CounterCashier::class);
    }

    public function assignedCashiers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'counter_cashiers')
            ->withPivot(['shift', 'is_primary', 'is_active'])
            ->withTimestamps();
    }

    public function orderAssignments(): HasMany
    {
        return $this->hasMany(CounterAssignment::class);
    }

    public function activeQueue(): HasMany
    {
        return $this->hasMany(Sale::class)
            ->whereIn('order_status', ['assigned', 'waiting', 'processing']);
    }

    public function isOnlineAndReady(): bool
    {
        return $this->is_active
            && $this->status === 'active'
            && $this->current_user_id !== null
            && $this->currentSession()->exists();
    }

    public function isFull(): bool
    {
        $limit = $this->max_queue_capacity ?: 20;

        return $this->activeQueue()->count() >= $limit;
    }
}
