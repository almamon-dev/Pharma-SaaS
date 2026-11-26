<?php

declare(strict_types=1);

namespace App\Modules\Foundation\Infrastructure\Persistence;

use App\Modules\Core\Models\DocumentSequence;
use App\Modules\Foundation\Application\Ports\SequenceNumberGenerator;

final class EloquentSequenceNumberGenerator implements SequenceNumberGenerator
{
    public function nextNumber(
        int $tenantId,
        ?int $branchId,
        string $docType,
        string $defaultPrefix = 'DOC',
        int $padding = 6,
    ): string {
        return DocumentSequence::nextNumber(
            tenantId: $tenantId,
            branchId: $branchId,
            docType: $docType,
            defaultPrefix: $defaultPrefix,
            padding: $padding,
        );
    }
}

