<?php

namespace App\Modules\Catalog\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportJob extends Model
{
    use HasFactory, HasUuids, BelongsToTenant;

    protected $table = 'import_jobs';

    protected $fillable = [
        'tenant_id',
        'type',
        'file_path',
        'original_name',
        'mode', // 'create_only', 'create_or_update'
        'status', // 'uploaded', 'mapped', 'previewed', 'processing', 'done', 'failed', 'undone', 'cancelled'
        'column_map',
        'total_rows',
        'ok_rows',
        'skipped_rows',
        'error_rows',
        'created_count',
        'updated_count',
        'limit_note',
        'created_by',
        'started_at',
        'finished_at',
        'undo_until',
        'undone_at',
    ];

    protected function casts(): array
    {
        return [
            'column_map' => 'array',
            'total_rows' => 'integer',
            'ok_rows' => 'integer',
            'skipped_rows' => 'integer',
            'error_rows' => 'integer',
            'created_count' => 'integer',
            'updated_count' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'undo_until' => 'datetime',
            'undone_at' => 'datetime',
        ];
    }

    public function errors(): HasMany
    {
        return $this->hasMany(ImportJobError::class, 'import_job_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'import_job_id');
    }

    public function canUndo(): bool
    {
        return $this->status === 'done'
            && $this->undo_until !== null
            && $this->undo_until->isFuture()
            && $this->undone_at === null;
    }
}

