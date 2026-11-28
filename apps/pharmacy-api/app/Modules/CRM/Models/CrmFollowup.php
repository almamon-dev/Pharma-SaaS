<?php

declare(strict_types=1);

namespace App\Modules\CRM\Models;

use App\Models\Branch;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CrmFollowup extends Model
{
    use BelongsToTenant;

    protected $table = 'crm_followups';

    protected $fillable = [
        'tenant_id',
        'branch_id',
        'customer_id',
        'assigned_to',
        'created_by',
        'followup_type',
        'title',
        'medicines_summary',
        'due_date',
        'channel',
        'status',
        'notes',
        'outcome_notes',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

