<?php

namespace App\Modules\Catalog\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportJobError extends Model
{
    use HasFactory, HasUuids, BelongsToTenant;

    protected $table = 'import_job_errors';

    protected $fillable = [
        'tenant_id',
        'import_job_id',
        'row_no',
        'field',
        'message',
        'row_data',
    ];

    protected function casts(): array
    {
        return [
            'row_no' => 'integer',
            'row_data' => 'array',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(ImportJob::class, 'import_job_id');
    }
}

