<?php

namespace App\Modules\Catalog\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use HasFactory, HasUuids, BelongsToTenant;

    protected $table = 'categories';

    protected $fillable = [
        'tenant_id',
        'parent_id',
        'name',
        'name_bn',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'category_id');
    }

    /**
     * Calculate tree depth of this category (root = 1).
     */
    public function depth(): int
    {
        $depth = 1;
        $current = $this;
        while ($current->parent_id && $depth < 10) {
            $depth++;
            $current = $current->parent;
            if (! $current) {
                break;
            }
        }

        return $depth;
    }
}

