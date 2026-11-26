<?php

declare(strict_types=1);

namespace App\Modules\CRM\Infrastructure\Persistence;

use App\Models\Supplier;
use App\Modules\CRM\Application\Ports\SupplierRepository;
use App\Modules\CRM\Domain\SupplierProfile;

final class EloquentSupplierRepository implements SupplierRepository
{
    public function listSummaries(): array
    {
        return Supplier::query()
            ->withCount('batches')
            ->orderBy('name')
            ->get()
            ->map(static fn (Supplier $s): array => [
                'id' => $s->id,
                'name' => $s->name,
                'contact_person' => $s->contact_person,
                'phone' => $s->phone,
                'email' => $s->email,
                'address' => $s->address,
                'tax_number' => $s->tax_number,
                'payment_terms' => $s->payment_terms,
                'is_active' => (bool) $s->is_active,
                'batches_count' => (int) $s->batches_count,
            ])
            ->values()
            ->all();
    }

    public function create(SupplierProfile $profile): array
    {
        $supplier = Supplier::query()->create([
            'name' => $profile->name,
            'contact_person' => $profile->contactPerson,
            'phone' => $profile->phone,
            'email' => $profile->email,
            'address' => $profile->address,
            'tax_number' => $profile->taxNumber,
            'payment_terms' => $profile->paymentTerms,
            'is_active' => $profile->isActive,
        ]);

        return ['id' => (int) $supplier->id, 'name' => (string) $supplier->name];
    }

    public function toggleActive(int $supplierId): bool
    {
        $supplier = Supplier::query()->findOrFail($supplierId);
        $next = ! (bool) $supplier->is_active;
        $supplier->update(['is_active' => $next]);

        return $next;
    }
}

