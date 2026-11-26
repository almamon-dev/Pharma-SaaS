<?php

namespace App\Modules\Accounting\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Customer;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Party extends Model
{
    use BelongsToTenant;

    public const TYPE_CUSTOMER = 'customer';
    public const TYPE_SUPPLIER = 'supplier';
    public const TYPE_BOTH = 'both';

    protected $fillable = [
        'tenant_id',
        'type',
        'customer_id',
        'supplier_id',
        'code',
        'name',
        'phone',
        'email',
        'address',
        'credit_limit_paisa',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'credit_limit_paisa' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function voucherLines(): HasMany
    {
        return $this->hasMany(VoucherLine::class, 'party_id');
    }
}

