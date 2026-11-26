<?php

declare(strict_types=1);

namespace App\Modules\CRM\Infrastructure\Persistence;

use App\Models\Customer;
use App\Modules\CRM\Application\Ports\CustomerRepository;
use App\Modules\CRM\Domain\CustomerProfile;
use PharmaCore\Foundation\Domain\Money;

final class EloquentCustomerRepository implements CustomerRepository
{
    public function listSummaries(): array
    {
        return Customer::query()
            ->withCount('sales')
            ->withSum('sales as total_spent', 'total_amount')
            ->orderBy('name')
            ->get()
            ->map(static fn (Customer $c): array => [
                'id' => $c->id,
                'name' => $c->name,
                'phone' => $c->phone,
                'email' => $c->email,
                'address' => $c->address,
                'allergies' => $c->allergies,
                'loyalty_points' => (int) $c->loyalty_points,
                'sales_count' => (int) $c->sales_count,
                'total_spent' => Money::fromDecimal($c->total_spent ?? 0)->toFloat(),
                'created_at' => $c->created_at?->format('d M Y'),
            ])
            ->values()
            ->all();
    }

    public function create(CustomerProfile $profile): array
    {
        $customer = Customer::query()->create([
            'name' => $profile->name,
            'phone' => $profile->phone,
            'email' => $profile->email,
            'address' => $profile->address,
            'allergies' => $profile->allergies,
            'loyalty_points' => $profile->loyaltyPoints,
        ]);

        return ['id' => (int) $customer->id, 'name' => (string) $customer->name];
    }

    public function update(int $customerId, CustomerProfile $profile): array
    {
        $customer = Customer::query()->findOrFail($customerId);
        $customer->update([
            'name' => $profile->name,
            'phone' => $profile->phone,
            'email' => $profile->email,
            'address' => $profile->address,
            'allergies' => $profile->allergies,
            'loyalty_points' => $profile->loyaltyPoints,
        ]);

        return ['id' => (int) $customer->id, 'name' => (string) $customer->name];
    }
}

