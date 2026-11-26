<?php

declare(strict_types=1);

namespace App\Modules\CRM\Domain;

final readonly class SupplierProfile
{
    public string $name;

    public ?string $contactPerson;

    public ?string $phone;

    public ?string $email;

    public ?string $address;

    public ?string $taxNumber;

    public string $paymentTerms;

    public bool $isActive;

    public function __construct(
        string $name,
        ?string $contactPerson = null,
        ?string $phone = null,
        ?string $email = null,
        ?string $address = null,
        ?string $taxNumber = null,
        ?string $paymentTerms = null,
        bool $isActive = true,
    ) {
        $trimmed = trim($name);
        if ($trimmed === '') {
            throw CrmProblem::emptySupplierName();
        }

        $this->name = $trimmed;
        $this->contactPerson = $contactPerson !== null && trim($contactPerson) !== '' ? trim($contactPerson) : null;
        $this->phone = $phone !== null && trim($phone) !== '' ? trim($phone) : null;
        $this->email = $email !== null && trim($email) !== '' ? trim($email) : null;
        $this->address = $address !== null && trim($address) !== '' ? trim($address) : null;
        $this->taxNumber = $taxNumber !== null && trim($taxNumber) !== '' ? trim($taxNumber) : null;
        $this->paymentTerms = $paymentTerms !== null && trim($paymentTerms) !== '' ? trim($paymentTerms) : 'Net-15';
        $this->isActive = $isActive;
    }
}

