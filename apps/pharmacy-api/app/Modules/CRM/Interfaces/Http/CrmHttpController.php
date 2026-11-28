<?php

declare(strict_types=1);

namespace App\Modules\CRM\Interfaces\Http;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\Supplier;
use App\Models\User;
use App\Modules\CRM\Application\CrmWorkflow;
use App\Modules\CRM\Domain\SupplierProfile;
use App\Modules\CRM\Models\CrmFollowup;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

final class CrmHttpController extends Controller
{
    public function __construct(
        private readonly CrmWorkflow $workflow,
    ) {}

    public function customers(Request $request, TenantContext $tenantContext): Response
    {
        $tenant = $tenantContext->tenant();
        $branches = Branch::query()
            ->where('is_active', true)
            ->orderByDesc('is_head_office')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $selectedBranchId = $request->filled('branch_id') && $request->input('branch_id') !== 'all'
            ? (int) $request->input('branch_id')
            : null;

        $customers = Customer::query()
            ->with('branch:id,name')
            ->withCount('sales')
            ->withCount(['followups as pending_followups_count' => fn ($q) => $q->whereIn('status', ['pending', 'contacted'])])
            ->withSum('sales as total_spent', 'total_amount')
            ->withSum(['sales as total_due' => fn ($q) => $q->where('due_amount', '>', 0)->whereNotIn('order_status', ['draft', 'cancelled'])], 'due_amount')
            ->when($selectedBranchId !== null, fn ($q) => $q->where('branch_id', $selectedBranchId))
            ->orderBy('name')
            ->get()
            ->map(static fn (Customer $c): array => [
                'id' => $c->id,
                'branch_id' => $c->branch_id,
                'branch_name' => $c->branch?->name ?? 'All Branches',
                'customer_code' => $c->customer_code,
                'segment' => $c->segment ?: 'regular',
                'name' => $c->name,
                'phone' => $c->phone,
                'email' => $c->email,
                'address' => $c->address,
                'allergies' => $c->allergies,
                'doctor_name' => $c->doctor_name,
                'notes' => $c->notes,
                'loyalty_points' => (int) $c->loyalty_points,
                'credit_limit' => (float) ($c->credit_limit ?? 0),
                'sales_count' => (int) $c->sales_count,
                'total_spent' => round((float) ($c->total_spent ?? 0), 2),
                'total_due' => round((float) ($c->total_due ?? 0), 2),
                'pending_followups_count' => (int) $c->pending_followups_count,
                'last_contacted_at' => $c->last_contacted_at?->format('d M Y'),
                'created_at' => $c->created_at?->format('d M Y'),
            ])
            ->values();

        return Inertia::render('Crm/Customers', [
            'customers' => $customers,
            'branches' => $branches,
            'selectedBranchId' => $selectedBranchId,
            'tenantName' => $tenant?->name,
            'currency' => $tenant?->currency_code ?? 'BDT',
        ]);
    }

    public function storeCustomer(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'segment' => ['nullable', 'in:regular,vip,chronic,credit'],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'allergies' => ['nullable', 'string', 'max:500'],
            'doctor_name' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'loyalty_points' => ['nullable', 'integer', 'min:0'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
        ]);

        $branchId = $validated['branch_id'] ?? $tenantContext->branch()?->id;

        $customer = Customer::query()->create([
            'branch_id' => $branchId,
            'segment' => $validated['segment'] ?? 'regular',
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
            'allergies' => $validated['allergies'] ?? null,
            'doctor_name' => $validated['doctor_name'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'loyalty_points' => (int) ($validated['loyalty_points'] ?? 0),
            'credit_limit' => (float) ($validated['credit_limit'] ?? 0),
        ]);

        return back()->with('success', "Customer \"{$customer->name}\" added to CRM.");
    }

    public function updateCustomer(Request $request, Customer $customer): RedirectResponse
    {
        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'segment' => ['nullable', 'in:regular,vip,chronic,credit'],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'allergies' => ['nullable', 'string', 'max:500'],
            'doctor_name' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'loyalty_points' => ['required', 'integer', 'min:0'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
        ]);

        $customer->update([
            'branch_id' => $validated['branch_id'] ?? $customer->branch_id,
            'segment' => $validated['segment'] ?? $customer->segment ?? 'regular',
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
            'allergies' => $validated['allergies'] ?? null,
            'doctor_name' => $validated['doctor_name'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'loyalty_points' => (int) $validated['loyalty_points'],
            'credit_limit' => (float) ($validated['credit_limit'] ?? 0),
        ]);

        return back()->with('success', "Updated customer \"{$customer->name}\".");
    }

    public function customerProfile(Customer $customer): JsonResponse
    {
        $customer->load('branch:id,name');

        $recentSales = Sale::query()
            ->with('branch:id,name')
            ->where('customer_id', $customer->id)
            ->whereNotIn('order_status', ['draft', 'cancelled'])
            ->latest('sold_at')
            ->latest('id')
            ->limit(15)
            ->get()
            ->map(fn (Sale $s) => [
                'id' => $s->id,
                'invoice_number' => $s->invoice_number ?: $s->order_number ?: ('#'.$s->id),
                'branch_name' => $s->branch?->name ?? 'Branch',
                'sold_at' => ($s->sold_at ?? $s->created_at)?->format('d M Y'),
                'total_amount' => (float) $s->total_amount,
                'paid_amount' => (float) $s->paid_amount,
                'due_amount' => (float) $s->due_amount,
                'payment_status' => (string) ($s->payment_status ?: 'paid'),
            ]);

        $followups = CrmFollowup::query()
            ->with(['branch:id,name', 'assignee:id,name'])
            ->where('customer_id', $customer->id)
            ->orderByRaw("CASE WHEN status IN ('pending','contacted') THEN 0 ELSE 1 END")
            ->orderBy('due_date')
            ->limit(15)
            ->get()
            ->map(fn (CrmFollowup $f) => [
                'id' => $f->id,
                'followup_type' => $f->followup_type,
                'title' => $f->title,
                'medicines_summary' => $f->medicines_summary,
                'due_date' => $f->due_date->toDateString(),
                'channel' => $f->channel,
                'status' => $f->status,
                'branch_name' => $f->branch?->name ?? 'All Branches',
                'assignee_name' => $f->assignee?->name,
                'notes' => $f->notes,
                'outcome_notes' => $f->outcome_notes,
            ]);

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'address' => $customer->address,
                'branch_name' => $customer->branch?->name ?? 'All Branches',
                'segment' => $customer->segment ?: 'regular',
                'allergies' => $customer->allergies,
                'doctor_name' => $customer->doctor_name,
                'notes' => $customer->notes,
                'loyalty_points' => (int) $customer->loyalty_points,
                'credit_limit' => (float) ($customer->credit_limit ?? 0),
                'last_contacted_at' => $customer->last_contacted_at?->format('d M Y, h:i A'),
            ],
            'sales' => $recentSales,
            'followups' => $followups,
        ]);
    }

    public function collectDue(Request $request, Customer $customer): RedirectResponse
    {
        $validated = $request->validate([
            'sale_id' => ['required', 'integer', 'exists:sales,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'in:cash,card,bkash,nagad,bank'],
            'reference_number' => ['nullable', 'string', 'max:100'],
        ]);

        $sale = Sale::query()
            ->where('id', (int) $validated['sale_id'])
            ->where('customer_id', $customer->id)
            ->firstOrFail();

        $maxDue = (float) $sale->due_amount;
        $amount = round((float) $validated['amount'], 2);
        if ($maxDue <= 0 || $amount > $maxDue + 0.01) {
            return back()->with('error', "Collection amount exceeds invoice due ({$maxDue}).");
        }

        DB::transaction(function () use ($sale, $customer, $amount, $validated, $request): void {
            SalePayment::query()->create([
                'tenant_id' => $sale->tenant_id,
                'sale_id' => $sale->id,
                'payment_method' => $validated['payment_method'],
                'amount' => $amount,
                'reference_number' => $validated['reference_number'] ?? null,
                'received_by' => $request->user()?->id,
            ]);

            $newPaid = round((float) $sale->paid_amount + $amount, 2);
            $newDue = max(0, round((float) $sale->total_amount - $newPaid, 2));

            $sale->update([
                'paid_amount' => $newPaid,
                'due_amount' => $newDue,
                'payment_status' => $newDue <= 0 ? 'paid' : 'partial',
            ]);

            $customer->update(['last_contacted_at' => now()]);
        });

        return back()->with('success', "Collected {$amount} due payment from {$customer->name}.");
    }

    public function followups(Request $request, TenantContext $tenantContext): Response
    {
        $tenant = $tenantContext->tenant();
        $branches = Branch::query()
            ->where('is_active', true)
            ->orderByDesc('is_head_office')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $selectedBranchId = $request->filled('branch_id') && $request->input('branch_id') !== 'all'
            ? (int) $request->input('branch_id')
            : null;

        $today = now()->toDateString();

        $followups = CrmFollowup::query()
            ->with(['customer:id,name,phone,segment', 'branch:id,name', 'assignee:id,name'])
            ->when($selectedBranchId !== null, fn ($q) => $q->where('branch_id', $selectedBranchId))
            ->orderByRaw("CASE WHEN status IN ('pending','contacted') THEN 0 ELSE 1 END")
            ->orderBy('due_date')
            ->get()
            ->map(fn (CrmFollowup $f) => [
                'id' => $f->id,
                'customer_id' => $f->customer_id,
                'customer_name' => $f->customer?->name ?? 'Customer',
                'customer_phone' => $f->customer?->phone,
                'customer_segment' => $f->customer?->segment ?: 'regular',
                'branch_id' => $f->branch_id,
                'branch_name' => $f->branch?->name ?? 'All Branches',
                'assigned_to' => $f->assigned_to,
                'assignee_name' => $f->assignee?->name ?? 'Unassigned',
                'followup_type' => $f->followup_type,
                'title' => $f->title,
                'medicines_summary' => $f->medicines_summary,
                'due_date' => $f->due_date->toDateString(),
                'is_overdue' => in_array($f->status, ['pending', 'contacted'], true) && $f->due_date->toDateString() < $today,
                'is_today' => in_array($f->status, ['pending', 'contacted'], true) && $f->due_date->toDateString() === $today,
                'channel' => $f->channel,
                'status' => $f->status,
                'notes' => $f->notes,
                'outcome_notes' => $f->outcome_notes,
                'completed_at' => $f->completed_at?->format('d M Y, h:i A'),
            ])
            ->values();

        $customers = Customer::query()
            ->orderBy('name')
            ->get(['id', 'branch_id', 'name', 'phone']);

        $staffUsers = User::query()
            ->whereHas('tenants', fn ($q) => $q->where('tenants.id', $tenant->id))
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Crm/Followups', [
            'followups' => $followups,
            'customers' => $customers,
            'branches' => $branches,
            'staffUsers' => $staffUsers,
            'selectedBranchId' => $selectedBranchId,
            'tenantName' => $tenant?->name,
            'summary' => [
                'overdue' => $followups->where('is_overdue', true)->count(),
                'due_today' => $followups->where('is_today', true)->count(),
                'open_total' => $followups->whereIn('status', ['pending', 'contacted'])->count(),
                'completed' => $followups->where('status', 'completed')->count(),
            ],
        ]);
    }

    public function storeFollowup(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'followup_type' => ['required', 'in:refill_reminder,due_followup,health_check,general'],
            'title' => ['required', 'string', 'max:180'],
            'medicines_summary' => ['nullable', 'string', 'max:300'],
            'due_date' => ['required', 'date'],
            'channel' => ['required', 'in:phone,sms,whatsapp,in_person'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $customer = Customer::query()->findOrFail((int) $validated['customer_id']);

        CrmFollowup::query()->create([
            ...$validated,
            'branch_id' => $validated['branch_id'] ?? $customer->branch_id ?? $tenantContext->branch()?->id,
            'created_by' => $request->user()?->id,
            'status' => 'pending',
        ]);

        return back()->with('success', "Follow-up reminder scheduled for {$customer->name}.");
    }

    public function updateFollowupStatus(Request $request, CrmFollowup $followup): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:pending,contacted,completed,cancelled'],
            'outcome_notes' => ['nullable', 'string', 'max:1000'],
            'due_date' => ['nullable', 'date'],
        ]);

        $followup->update([
            'status' => $validated['status'],
            'outcome_notes' => $validated['outcome_notes'] ?? $followup->outcome_notes,
            'due_date' => $validated['due_date'] ?? $followup->due_date,
            'completed_at' => $validated['status'] === 'completed' ? now() : null,
        ]);

        if (in_array($validated['status'], ['contacted', 'completed'], true) && $followup->customer) {
            $followup->customer->update(['last_contacted_at' => now()]);
        }

        return back()->with('success', "Follow-up #{$followup->id} updated to {$validated['status']}.");
    }

    public function destroyFollowup(CrmFollowup $followup): RedirectResponse
    {
        $followup->delete();

        return back()->with('success', 'Follow-up reminder removed.');
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
