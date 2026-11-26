<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Supplier;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CrmController extends Controller
{
    public function customers(TenantContext $tenantContext): Response
    {
        $customers = Customer::query()
            ->withCount('sales')
            ->withSum('sales as total_spent', 'total_amount')
            ->orderBy('name')
            ->get()
            ->map(fn (Customer $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'phone' => $c->phone,
                'email' => $c->email,
                'address' => $c->address,
                'allergies' => $c->allergies,
                'loyalty_points' => (int) $c->loyalty_points,
                'sales_count' => (int) $c->sales_count,
                'total_spent' => round((float) ($c->total_spent ?? 0), 2),
                'created_at' => $c->created_at?->format('d M Y'),
            ]);

        return Inertia::render('Crm/Customers', [
            'customers' => $customers,
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

        $customer = Customer::query()->create([
            'name' => trim($validated['name']),
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
            'allergies' => $validated['allergies'] ?? null,
            'loyalty_points' => (int) ($validated['loyalty_points'] ?? 0),
        ]);

        AuditLog::record(
            action: 'crm.customer_created',
            description: "Registered customer \"{$customer->name}\" in CRM.",
            subject: $customer,
        );

        return back()->with('success', "Customer \"{$customer->name}\" added to CRM.");
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

        $customer->update($validated);

        return back()->with('success', "Updated customer \"{$customer->name}\".");
    }

    public function suppliers(TenantContext $tenantContext): Response
    {
        $suppliers = Supplier::query()
            ->withCount('batches')
            ->orderBy('name')
            ->get()
            ->map(fn (Supplier $s) => [
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
            ]);

        return Inertia::render('Crm/Suppliers', [
            'suppliers' => $suppliers,
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

        $supplier = Supplier::query()->create([
            'name' => trim($validated['name']),
            'contact_person' => $validated['contact_person'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
            'tax_number' => $validated['tax_number'] ?? null,
            'payment_terms' => $validated['payment_terms'] ?? 'Net-15',
            'is_active' => true,
        ]);

        AuditLog::record(
            action: 'crm.supplier_created',
            description: "Added distributor supplier \"{$supplier->name}\".",
            subject: $supplier,
        );

        return back()->with('success', "Supplier \"{$supplier->name}\" registered.");
    }

    public function toggleSupplier(Supplier $supplier): RedirectResponse
    {
        $supplier->update(['is_active' => ! $supplier->is_active]);

        return back()->with('success', 'Supplier status updated.');
    }
}
