<?php

namespace App\Modules\Core\Models;

use App\Models\Role;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoleLimit extends Model
{
    protected $table = 'role_limits';

    public $incrementing = false;

    protected $primaryKey = ['role_id', 'limit_key'];

    protected $fillable = [
        'role_id',
        'limit_key',
        'value',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'float',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }
}

