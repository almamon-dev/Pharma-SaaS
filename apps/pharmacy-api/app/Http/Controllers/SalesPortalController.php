<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Sale;
use App\Models\SalePayment;
use App\Models\SaleReturn;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SalesPortalController extends Controller
{
    public function collections(Request $request, TenantContext $tenantContext): Response
    {
        $tenant = $tenantContext->tenant();
        $branch = $tenantContext->branch();
        $user = $request->user();
        $isSalesmanOnly = $tenantContext->hasRole('salesman') && ! $user?->isSubscriberAdmin() && ! $tenantContext->hasRole(['admin', 'manager']);

        $duesQuery = Sale::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->where('due_amount', '>', 0)
            ->whereNotIn('order_status', ['draft', 'cancelled'])
            ->when($isSalesmanOnly && $user, function ($q) use ($user): void {
                $q->where(function ($sub) use ($user): void {
                    $sub->where('salesman_id', $user->id)
                        ->orWhere('user_id', $user->id)
                        ->orWhereNull('salesman_id');
                });
            })
            ->with(['customer:id,name,phone,customer_code'])
            ->orderByDesc('due_amount')
            ->orderBy('sold_at');

        $dueSales = $duesQuery->get();
        $now = now();

        $ageing = [
            '0_15' => ['count' => 0, 'amount' => 0.0],
            '16_30' => ['count' => 0, 'amount' => 0.0],
            '31_60' => ['count' => 0, 'amount' => 0.0],
            '60_plus' => ['count' => 0, 'amount' => 0.0],
        ];

        $mappedDues = $dueSales->map(function (Sale $sale) use ($now, &$ageing): array {
            $refDate = $sale->sold_at ?? $sale->created_at ?? $now;
            $daysDue = max(0, (int) $refDate->diffInDays($now));
            $dueAmt = (float) $sale->due_amount;

            $bucket = match (true) {
                $daysDue <= 15 => '0_15',
                $daysDue <= 30 => '16_30',
                $daysDue <= 60 => '31_60',
                default => '60_plus',
            };

            $ageing[$bucket]['count']++;
            $ageing[$bucket]['amount'] = round($ageing[$bucket]['amount'] + $dueAmt, 2);

            return [
                'id' => $sale->id,
                'invoice_number' => $sale->invoice_number ?: $sale->order_number ?: ('#'.$sale->id),
                'customer_id' => $sale->customer_id,
                'customer_name' => $sale->customer?->name ?: 'Walk-in Customer',
                'customer_phone' => $sale->customer?->phone,
                'sold_at' => $refDate->format('d M Y'),
                'days_due' => $daysDue,
                'ageing_bucket' => $bucket,
                'total_amount' => (float) $sale->total_amount,
                'paid_amount' => (float) $sale->paid_amount,
                'due_amount' => $dueAmt,
                'payment_status' => (string) ($sale->payment_status ?: 'due'),
            ];
        })->values();

        $recentPayments = SalePayment::query()
            ->whereHas('sale', function ($q) use ($branch): void {
                $q->when($branch, fn ($sub) => $sub->where('branch_id', $branch->id));
            })
            ->with(['sale:id,invoice_number,order_number,customer_id', 'sale.customer:id,name'])
            ->latest('created_at')
            ->limit(15)
            ->get()
            ->map(fn (SalePayment $p) => [
                'id' => $p->id,
                'invoice_number' => $p->sale?->invoice_number ?: $p->sale?->order_number ?: ('#'.$p->sale_id),
                'customer_name' => $p->sale?->customer?->name ?: 'Walk-in Customer',
                'payment_method' => strtolower((string) $p->payment_method),
                'amount' => (float) $p->amount,
                'reference_number' => $p->reference_number,
                'paid_at' => $p->created_at?->format('d M Y, h:i A'),
            ]);

        $collectedToday = (float) SalePayment::query()
            ->whereHas('sale', function ($q) use ($branch): void {
                $q->when($branch, fn ($sub) => $sub->where('branch_id', $branch->id));
            })
            ->whereDate('created_at', today())
            ->sum('amount');

        return Inertia::render('Sales/Collections', [
            'dueSales' => $mappedDues,
            'recentPayments' => $recentPayments,
            'ageing' => $ageing,
            'summary' => [
                'total_due' => round((float) $dueSales->sum('due_amount'), 2),
                'overdue_30_plus' => round($ageing['31_60']['amount'] + $ageing['60_plus']['amount'], 2),
                'collected_today' => round($collectedToday, 2),
                'pending_invoices' => $dueSales->count(),
            ],
            'branchName' => $branch?->name,
            'currency' => $tenant->currency_code ?? 'BDT',
        ]);
    }

    public function recordCollection(Request $request, Sale $sale, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        if (! $tenant || (int) $sale->tenant_id !== (int) $tenant->id) {
            abort(403, 'Unauthorized.');
        }

        $maxDue = (float) $sale->due_amount;
        if ($maxDue <= 0) {
            return back()->with('error', 'This invoice has no remaining due balance.');
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01', 'max:'.$maxDue],
            'payment_method' => ['required', 'string', Rule::in(['cash', 'card', 'bkash', 'nagad'])],
            'reference_number' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($sale, $tenant, $validated, $request): void {
            $amount = round((float) $validated['amount'], 2);

            SalePayment::create([
                'tenant_id' => $tenant->id,
                'sale_id' => $sale->id,
                'payment_method' => $validated['payment_method'],
                'amount' => $amount,
                'reference_number' => $validated['reference_number'] ?: null,
            ]);

            $newPaid = round((float) $sale->paid_amount + $amount, 2);
            $newDue = max(0.0, round((float) $sale->due_amount - $amount, 2));

            $sale->update([
                'paid_amount' => $newPaid,
                'due_amount' => $newDue,
                'payment_status' => $newDue <= 0 ? 'paid' : 'partially_paid',
                'notes' => $validated['notes']
                    ? trim(($sale->notes ? $sale->notes."\n" : '').'Collection: '.$validated['notes'])
                    : $sale->notes,
            ]);

            AuditLog::record(
                'sales.collection_recorded',
                $sale,
                [
                    'amount' => $amount,
                    'payment_method' => $validated['payment_method'],
                    'remaining_due' => $newDue,
                ],
                $request->user()
            );
        });

        return back()->with('success', 'Collection recorded successfully.');
    }

    public function returns(Request $request, TenantContext $tenantContext): Response
    {
        $tenant = $tenantContext->tenant();
        $branch = $tenantContext->branch();
        $user = $request->user();
        $canApprove = $user?->isSubscriberAdmin() || $tenantContext->hasRole(['admin', 'manager', 'pharmacist']);
        $isSalesmanOnly = $tenantContext->hasRole('salesman') && ! $canApprove;

        $returnsQuery = SaleReturn::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->when($isSalesmanOnly && $user, fn ($q) => $q->where('requested_by', $user->id))
            ->with(['sale:id,invoice_number,order_number,total_amount', 'customer:id,name,phone', 'requestedBy:id,name', 'approvedBy:id,name'])
            ->latest('created_at');

        $returns = $returnsQuery->get();

        $eligibleSales = Sale::query()
            ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
            ->whereNotIn('order_status', ['draft', 'cancelled'])
            ->with(['customer:id,name'])
            ->latest('sold_at')
            ->latest('id')
            ->limit(30)
            ->get()
            ->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'invoice_number' => $sale->invoice_number ?: $sale->order_number ?: ('#'.$sale->id),
                'customer_name' => $sale->customer?->name ?: 'Walk-in Customer',
                'total_amount' => (float) $sale->total_amount,
                'sold_at' => ($sale->sold_at ?? $sale->created_at)?->format('d M Y'),
            ]);

        return Inertia::render('Sales/Returns', [
            'returns' => $returns->map(fn (SaleReturn $r) => [
                'id' => $r->id,
                'return_number' => $r->return_number,
                'credit_note_number' => $r->credit_note_number,
                'invoice_number' => $r->sale?->invoice_number ?: $r->sale?->order_number ?: ('#'.$r->sale_id),
                'customer_name' => $r->customer?->name ?: 'Walk-in Customer',
                'requested_by' => $r->requestedBy?->name ?: 'Staff',
                'approved_by' => $r->approvedBy?->name,
                'return_amount' => (float) $r->return_amount,
                'reason' => $r->reason,
                'notes' => $r->notes,
                'status' => $r->status,
                'credit_note_status' => $r->credit_note_status,
                'created_at' => $r->created_at?->format('d M Y, h:i A'),
            ]),
            'eligibleSales' => $eligibleSales,
            'summary' => [
                'total_requests' => $returns->count(),
                'pending_count' => $returns->where('status', 'pending')->count(),
                'issued_credit_notes' => $returns->whereIn('credit_note_status', ['issued', 'applied'])->count(),
                'total_return_value' => round((float) $returns->where('status', '!=', 'rejected')->sum('return_amount'), 2),
            ],
            'canApprove' => $canApprove,
            'branchName' => $branch?->name,
            'currency' => $tenant->currency_code ?? 'BDT',
        ]);
    }

    public function storeReturn(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $branch = $tenantContext->branch();
        $user = $request->user();

        $validated = $request->validate([
            'sale_id' => ['required', 'integer', 'exists:sales,id'],
            'return_amount' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $sale = Sale::query()->where('tenant_id', $tenant->id)->findOrFail($validated['sale_id']);

        if ((float) $validated['return_amount'] > (float) $sale->total_amount) {
            return back()->withErrors([
                'return_amount' => 'Return amount cannot exceed original invoice total.',
            ]);
        }

        $returnNumber = 'RET-'.now()->format('Ymd').'-'.strtoupper(Str::random(4));

        $record = SaleReturn::create([
            'tenant_id' => $tenant->id,
            'branch_id' => $branch?->id ?? $sale->branch_id,
            'sale_id' => $sale->id,
            'customer_id' => $sale->customer_id,
            'requested_by' => $user?->id,
            'return_number' => $returnNumber,
            'return_amount' => round((float) $validated['return_amount'], 2),
            'reason' => $validated['reason'],
            'notes' => $validated['notes'] ?: null,
            'status' => 'pending',
            'credit_note_status' => 'pending',
        ]);

        AuditLog::record('sales.return_requested', $record, [
            'return_number' => $returnNumber,
            'sale_id' => $sale->id,
            'return_amount' => $record->return_amount,
        ], $user);

        return back()->with('success', "Return request {$returnNumber} submitted for credit note review.");
    }

    public function updateReturnStatus(Request $request, SaleReturn $saleReturn, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $user = $request->user();
        $canApprove = $user?->isSubscriberAdmin() || $tenantContext->hasRole(['admin', 'manager', 'pharmacist']);

        if (! $tenant || (int) $saleReturn->tenant_id !== (int) $tenant->id || ! $canApprove) {
            abort(403, 'Unauthorized.');
        }

        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(['approve', 'reject'])],
        ]);

        if ($validated['action'] === 'approve') {
            $cnNumber = $saleReturn->credit_note_number ?: ('CN-'.now()->format('Ymd').'-'.strtoupper(Str::random(4)));
            $saleReturn->update([
                'status' => 'approved',
                'credit_note_status' => 'issued',
                'credit_note_number' => $cnNumber,
                'approved_by' => $user?->id,
                'approved_at' => now(),
            ]);

            return back()->with('success', "Return approved & Credit Note {$cnNumber} issued.");
        }

        $saleReturn->update([
            'status' => 'rejected',
            'credit_note_status' => 'void',
            'approved_by' => $user?->id,
            'approved_at' => now(),
        ]);

        return back()->with('success', 'Return request marked as rejected.');
    }
}

