<?php

declare(strict_types=1);

namespace App\Modules\Inventory\Application\Ports;

interface MedicineBarcodeChecker
{
    public function existsForTenant(string $barcode): bool;
}

