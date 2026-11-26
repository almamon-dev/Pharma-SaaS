<?php

declare(strict_types=1);

namespace App\Modules\CRM\Interfaces\Http;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Supplier;
use App\Modules\CRM\Application\CrmWorkflow;
use App\Modules\CRM\Domain\CustomerProfile;
use App\Modules\CRM\Domain\SupplierProfile;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class CrmHttpController extends Controller
{
    public function __construct(
        private readonly CrmWorkflow $workflow,
    ) {}

    public function customers(TenantContext $tenantContext): Response
    {
        return Inertia::render('Crm/Customers', [
            'customers' => $this->workflow->listCustomers(),
            'tenantName' => $tenantContext->tenant()?->name,
        ]);
    }

    public function storeCustomer(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'allergies' => ['nullable', 'string', 'max:500'],
            'loyalty_points' => ['nullable', 'integer', 'min:0'],
        ]);

        $created = $this->workflow->registerCustomer(
            profile: new CustomerProfile(
                name: (string) $validated['name'],
                phone: $validated['phone'] ?? null,
                email: $validated['email'] ?? null,
                address: $validated['address'] ?? null,
                allergies: $validated['allergies'] ?? null,
                loyaltyPoints: (int) ($validated['loyalty_points'] ?? 0),
            ),
            actorId: $request->user()?->id,
        );

        return back()->with('success', "Customer \"{$created['name']}\" added to CRM.");
    }

    public function updateCustomer(Request $request, Customer $customer): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'allergies' => ['nullable', 'string', 'max:500'],
            'loyalty_points' => ['required', 'integer', 'min:0'],
        ]);

        $updated = $this->workflow->updateCustomer(
            customerId: (int) $customer->id,
            profile: new CustomerProfile(
                name: (string) $validated['name'],
                phone: $validated['phone'] ?? null,
                email: $validated['email'] ?? null,
                address: $validated['address'] ?? null,
                allergies: $validated['allergies'] ?? null,
                loyaltyPoints: (int) $validated['loyalty_points'],
            ),
        );

        return back()->with('success', "Updated customer \"{$updated['name']}\".");
    }

    public function suppliers(TenantContext $tenantContext): Response
    {
        return Inertia::render('Crm/Suppliers', [
            'suppliers' => $this->workflow->listSuppliers(),
            'tenantName' => $tenantContext->tenant()?->name,
        ]);
    }

    public function storeSupplier(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'tax_number' => ['nullable', 'string', 'max:100'],
            'payment_terms' => ['nullable', 'string', 'max:100'],
        ]);

        $created = $this->workflow->registerSupplier(
            profile: new SupplierProfile(
                name: (string) $validated['name'],
                contactPerson: $validated['contact_person'] ?? null,
                phone: $validated['phone'] ?? null,
                email: $validated['email'] ?? null,
                address: $validated['address'] ?? null,
                taxNumber: $validated['tax_number'] ?? null,
                paymentTerms: $validated['payment_terms'] ?? null,
                isActive: true,
            ),
            actorId: $request->user()?->id,
        );

        return back()->with('success', "Supplier \"{$created['name']}\" registered.");
    }

    public function toggleSupplier(Supplier $supplier): RedirectResponse
    {
        $this->workflow->toggleSupplierStatus((int) $supplier->id);

        return back()->with('success', 'Supplier status updated.');
    }
}

