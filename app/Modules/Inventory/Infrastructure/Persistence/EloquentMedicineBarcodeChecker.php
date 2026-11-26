<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Infrastructure\Persistence;

use App\Models\Medicine;
use App\Modules\Inventory\Application\Ports\MedicineBarcodeChecker;

final class EloquentMedicineBarcodeChecker implements MedicineBarcodeChecker
{
    public function existsForTenant(string $barcode): bool
    {
        return Medicine::query()->withTrashed()->where('barcode', $barcode)->exists();
    }
}

