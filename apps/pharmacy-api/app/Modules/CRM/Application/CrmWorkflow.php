<?php

declare(strict_types=1);

namespace App\Modules\CRM\Application;

use App\Modules\CRM\Application\Ports\CustomerRepository;
use App\Modules\CRM\Application\Ports\SupplierRepository;
use App\Modules\CRM\Domain\CustomerProfile;
use App\Modules\CRM\Domain\SupplierProfile;
use App\Modules\Foundation\Application\Ports\AuditLogger;

final class CrmWorkflow
{
    public function __construct(
        private readonly CustomerRepository $customers,
        private readonly SupplierRepository $suppliers,
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function listCustomers(): array
    {
        return $this->customers->listSummaries();
    }

    /**
     * @return array{id: int, name: string}
     */
    public function registerCustomer(CustomerProfile $profile, ?int $actorId = null): array
    {
        $created = $this->customers->create($profile);

        $this->auditLogger->record(
            action: 'crm.customer_created',
            description: "Registered customer \"{$created['name']}\" in CRM.",
            subjectType: 'App\\Models\\Customer',
            subjectId: $created['id'],
            userId: $actorId,
        );

        return $created;
    }

    /**
     * @return array{id: int, name: string}
     */
    public function updateCustomer(int $customerId, CustomerProfile $profile): array
    {
        return $this->customers->update($customerId, $profile);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listSuppliers(): array
    {
        return $this->suppliers->listSummaries();
    }

    /**
     * @return array{id: int, name: string}
     */
    public function registerSupplier(SupplierProfile $profile, ?int $actorId = null): array
    {
        $created = $this->suppliers->create($profile);

        $this->auditLogger->record(
            action: 'crm.supplier_created',
            description: "Added distributor supplier \"{$created['name']}\".",
            subjectType: 'App\\Models\\Supplier',
            subjectId: $created['id'],
            userId: $actorId,
        );

        return $created;
    }

    public function toggleSupplierStatus(int $supplierId): bool
    {
        return $this->suppliers->toggleActive($supplierId);
    }
}

