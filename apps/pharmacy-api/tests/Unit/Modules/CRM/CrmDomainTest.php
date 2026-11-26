<?php

declare(strict_types=1);

namespace Tests\Unit\Modules\CRM;

use App\Modules\CRM\Domain\CrmProblem;
use App\Modules\CRM\Domain\CustomerProfile;
use App\Modules\CRM\Domain\SupplierProfile;
use PHPUnit\Framework\TestCase;

final class CrmDomainTest extends TestCase
{
    public function test_customer_profile_trims_fields_and_rejects_invalid_values(): void
    {
        $profile = new CustomerProfile(
            name: '  Rafiqul Islam  ',
            phone: ' 01711223344 ',
            email: '  ',
            allergies: ' Penicillin ',
            loyaltyPoints: 25,
        );

        $this->assertSame('Rafiqul Islam', $profile->name);
        $this->assertSame('01711223344', $profile->phone);
        $this->assertNull($profile->email);
        $this->assertSame('Penicillin', $profile->allergies);
        $this->assertSame(25, $profile->loyaltyPoints);

        $this->expectException(CrmProblem::class);
        new CustomerProfile(name: '   ');
    }

    public function test_supplier_profile_applies_default_payment_terms(): void
    {
        $supplier = new SupplierProfile(name: '  Square Pharma Distributor  ');

        $this->assertSame('Square Pharma Distributor', $supplier->name);
        $this->assertSame('Net-15', $supplier->paymentTerms);
        $this->assertTrue($supplier->isActive);
    }
}

