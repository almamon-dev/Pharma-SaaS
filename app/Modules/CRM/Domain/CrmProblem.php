<?php

declare(strict_types=1);

namespace App\Modules\CRM\Domain;

use PharmaCore\Foundation\Domain\DomainProblem;

final class CrmProblem extends DomainProblem
{
    public static function emptyCustomerName(): self
    {
        return new self('EMPTY_CUSTOMER_NAME', 'Customer name cannot be empty.', 422, 'name');
    }

    public static function negativeLoyaltyPoints(): self
    {
        return new self('NEGATIVE_LOYALTY_POINTS', 'Loyalty points cannot be negative.', 422, 'loyalty_points');
    }

    public static function emptySupplierName(): self
    {
        return new self('EMPTY_SUPPLIER_NAME', 'Supplier name cannot be empty.', 422, 'name');
    }
}

