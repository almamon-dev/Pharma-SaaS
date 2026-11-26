<?php

declare(strict_types=1);

namespace App\Modules\CRM\Domain;

final readonly class CustomerProfile
{
    public string $name;

    public ?string $phone;

    public ?string $email;

    public ?string $address;

    public ?string $allergies;

    public int $loyaltyPoints;

    public function __construct(
        string $name,
        ?string $phone = null,
        ?string $email = null,
        ?string $address = null,
        ?string $allergies = null,
        int $loyaltyPoints = 0,
    ) {
        $trimmed = trim($name);
        if ($trimmed === '') {
            throw CrmProblem::emptyCustomerName();
        }
        if ($loyaltyPoints < 0) {
            throw CrmProblem::negativeLoyaltyPoints();
        }

        $this->name = $trimmed;
        $this->phone = $phone !== null && trim($phone) !== '' ? trim($phone) : null;
        $this->email = $email !== null && trim($email) !== '' ? trim($email) : null;
        $this->address = $address !== null && trim($address) !== '' ? trim($address) : null;
        $this->allergies = $allergies !== null && trim($allergies) !== '' ? trim($allergies) : null;
        $this->loyaltyPoints = $loyaltyPoints;
    }
}

