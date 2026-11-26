<?php

declare(strict_types=1);

namespace App\Modules\CRM\Application\Ports;

use App\Modules\CRM\Domain\CustomerProfile;

interface CustomerRepository
{
    /**
     * @return list<array<string, mixed>>
     */
    public function listSummaries(): array;

    /**
     * @return array{id: int, name: string}
     */
    public function create(CustomerProfile $profile): array;

    /**
     * @return array{id: int, name: string}
     */
    public function update(int $customerId, CustomerProfile $profile): array;
}

