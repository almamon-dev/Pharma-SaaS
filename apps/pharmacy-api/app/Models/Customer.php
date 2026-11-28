<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Modules\CRM\Models\CrmFollowup;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'customer_code',
        'customer_type',
        'segment',
        'name',
        'phone',
        'email',
        'address',
        'allergies',
        'doctor_name',
        'notes',
        'loyalty_points',
        'credit_limit',
        'last_contacted_at',
    ];

    protected function casts(): array
    {
        return [
            'loyalty_points' => 'integer',
            'credit_limit' => 'decimal:2',
            'last_contacted_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function followups(): HasMany
    {
        return $this->hasMany(CrmFollowup::class, 'customer_id');
    }
}
