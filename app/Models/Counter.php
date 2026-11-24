<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
        'status',
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
            'break_started_at' => 'datetime',
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
}

