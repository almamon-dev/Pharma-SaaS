<?php

declare(strict_types=1);

namespace App\Modules\CRM\Application\Ports;

use App\Modules\CRM\Domain\SupplierProfile;

interface SupplierRepository
{
    /**
     * @return list<array<string, mixed>>
     */
    public function listSummaries(): array;

    /**
     * @return array{id: int, name: string}
     */
    public function create(SupplierProfile $profile): array;

    public function toggleActive(int $supplierId): bool;
}

