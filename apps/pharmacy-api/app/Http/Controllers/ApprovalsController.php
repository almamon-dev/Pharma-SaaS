<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Sale;
use App\Models\SaleReturn;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Services\VoucherService;
use App\Services\SalesOrderService;
use App\Support\TenantContext;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ApprovalsController extends Controller
{
    public static function pendingCountFor(int $tenantId, ?int $branchId = null): int
    {
        try {
            $discounts = (int) Sale::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
                ->where('discount_status', 'pending_approval')
                ->whereNotIn('order_status', ['cancelled'])
                ->count();

            $returns = Schema::hasTable('sale_returns')
                ? (int) SaleReturn::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
                    ->where('status', 'pending')
                    ->count()
                : 0;

            $vouchers = Schema::hasTable('vouchers')
                ? (int) Voucher::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
                    ->where('status', Voucher::STATUS_PENDING_APPROVAL)
                    ->count()
                : 0;

            return $discounts + $returns + $vouchers;
        } catch (\Throwable) {
            return 0;
        }
    }

    public function index(Request $request, TenantContext $tenantContext): Response
    {
        $tenant = $tenantContext->tenant();
        $user = $request->user();
        $isOwner = $tenantContext->isOwner() || (bool) $user?->isSubscriberAdmin();
        $primaryRole = $tenantContext->role() ?? 'manager';
        $isCoAdmin = ! $isOwner && in_array($primaryRole, ['co_admin', 'admin'], true);
        $isManagerOnly = ! $isOwner && ! $isCoAdmin;

        // Resolve allowed branches
        $branchesQuery = Branch::query()
            ->where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderByDesc('is_head_office')
            ->orderBy('name');

        if ($isCoAdmin && ! $user->access_all_branches) {
            $assignedBranchIds = DB::table('user_branches')
                ->where('user_id', $user->id)
                ->pluck('branch_id')
                ->map(fn ($id) => (int) $id)
                ->all();

            if (! empty($assignedBranchIds)) {
                $branchesQuery->whereIn('id', $assignedBranchIds);
            }
        } elseif ($isManagerOnly && $tenantContext->branchId()) {
            $branchesQuery->where('id', $tenantContext->branchId());
        }

        $branches = $branchesQuery->get(['id', 'name', 'code']);
        $allowedBranchIds = $branches->pluck('id')->map(fn ($id) => (int) $id)->all();

        // Selected branch filter
        $selectedBranchId = null;
        if ($isManagerOnly) {
            $selectedBranchId = $tenantContext->branchId();
        } elseif ($request->filled('branch_id') && $request->input('branch_id') !== 'all') {
            $reqBranch = (int) $request->input('branch_id');
            if (in_array($reqBranch, $allowedBranchIds, true)) {
                $selectedBranchId = $reqBranch;
            }
        }

        $branchScope = function ($query) use ($selectedBranchId, $isOwner, $allowedBranchIds): void {
            if ($selectedBranchId !== null) {
                $query->where('branch_id', $selectedBranchId);
            } elseif (! $isOwner && ! empty($allowedBranchIds)) {
                $query->whereIn('branch_id', $allowedBranchIds);
            }
        };

        // 1. High-Discount Order Approvals
        $discountRows = Sale::query()
            ->tap($branchScope)
            ->whereIn('discount_status', ['pending_approval', 'approved', 'rejected'])
            ->where('discount_amount', '>', 0)
            ->with([
                'branch:id,name,code',
                'customer:id,name,phone',
                'salesman:id,name',
            ])
            ->latest('updated_at')
            ->limit(50)
            ->get()
            ->map(function (Sale $s) {
                $status = match ($s->discount_status) {
                    'pending_approval' => 'pending',
                    'approved' => 'approved',
                    'rejected' => 'rejected',
                    default => 'pending',
                };

                return [
                    'uid' => 'discount-'.$s->id,
                    'entity_id' => $s->id,
                    'category' => 'discount',
                    'category_label' => 'Discount Override',
                    'reference' => $s->order_number ?: $s->invoice_number ?: ('#'.$s->id),
                    'branch_name' => $s->branch?->name ?? 'Main Branch',
                    'branch_code' => $s->branch?->code ?? 'HQ',
                    'requested_by' => $s->salesman?->name ?? 'Sales Staff',
                    'party_name' => $s->customer?->name ?? 'Walk-in Customer',
                    'amount' => round((float) $s->discount_amount, 2),
                    'total_context' => round((float) $s->total_amount, 2),
                    'summary' => number_format((float) $s->discount_percentage, 1).'% discount on bill ('.($s->notes ?: 'Over standard role cap').')',
                    'status' => $status,
                    'created_at' => ($s->created_at ?? now())->format('d M Y, h:i A'),
                    'sort_ts' => ($s->created_at ?? now())->timestamp,
                ];
            });

        // 2. Sales Return & Credit Note Approvals
        $returnRows = Schema::hasTable('sale_returns')
            ? SaleReturn::query()
                ->tap($branchScope)
                ->whereIn('status', ['pending', 'approved', 'rejected'])
                ->with([
                    'sale:id,invoice_number,order_number,total_amount,branch_id',
                    'sale.branch:id,name,code',
                    'customer:id,name',
                    'requestedBy:id,name',
                ])
                ->latest('created_at')
                ->limit(50)
                ->get()
                ->map(function (SaleReturn $r) use ($branches) {
                    $branch = $r->sale?->branch ?? $branches->firstWhere('id', (int) $r->branch_id);

                    return [
                        'uid' => 'return-'.$r->id,
                        'entity_id' => $r->id,
                        'category' => 'return',
                        'category_label' => 'Sales Return',
                        'reference' => $r->return_number,
                        'branch_name' => $branch?->name ?? 'Main Branch',
                        'branch_code' => $branch?->code ?? 'HQ',
                        'requested_by' => $r->requestedBy?->name ?? 'Counter Staff',
                        'party_name' => $r->customer?->name ?? 'Walk-in Customer',
                        'amount' => round((float) $r->return_amount, 2),
                        'total_context' => round((float) ($r->sale?->total_amount ?? $r->return_amount), 2),
                        'summary' => $r->reason.($r->sale ? ' · Inv: '.($r->sale->invoice_number ?: $r->sale->order_number) : ''),
                        'status' => $r->status,
                        'created_at' => ($r->created_at ?? now())->format('d M Y, h:i A'),
                        'sort_ts' => ($r->created_at ?? now())->timestamp,
                    ];
                })
            : collect();

        // 3. Accounting Voucher Approvals
        $voucherRows = Schema::hasTable('vouchers')
            ? Voucher::query()
                ->tap($branchScope)
                ->where(function ($q): void {
                    $q->where('status', Voucher::STATUS_PENDING_APPROVAL)
                        ->orWhereNotNull('approved_by');
                })
                ->with(['branch:id,name,code', 'creator:id,name'])
                ->latest('updated_at')
                ->limit(50)
                ->get()
                ->map(function (Voucher $v) {
                    $amountBdt = round(((int) $v->total_debit_paisa) / 100, 2);
                    $status = $v->status === Voucher::STATUS_PENDING_APPROVAL
                        ? 'pending'
                        : ($v->status === Voucher::STATUS_POSTED ? 'approved' : 'rejected');

                    return [
                        'uid' => 'voucher-'.$v->id,
                        'entity_id' => $v->id,
                        'category' => 'voucher',
                        'category_label' => 'Accounting Voucher',
                        'reference' => $v->number ?: ('VCH-#'.$v->id),
                        'branch_name' => $v->branch?->name ?? 'Main Branch',
                        'branch_code' => $v->branch?->code ?? 'HQ',
                        'requested_by' => $v->creator?->name ?? 'Accounts Staff',
                        'party_name' => ucfirst(str_replace('_', ' ', (string) $v->type)).' Voucher',
                        'amount' => $amountBdt,
                        'total_context' => $amountBdt,
                        'summary' => $v->narration ?: 'Threshold voucher awaiting second-user approval',
                        'status' => $status,
                        'created_at' => ($v->created_at ?? now())->format('d M Y, h:i A'),
                        'sort_ts' => ($v->created_at ?? now())->timestamp,
                    ];
                })
            : collect();

        $allItems = $discountRows
            ->concat($returnRows)
            ->concat($voucherRows)
            ->sortByDesc(fn ($row) => ($row['status'] === 'pending' ? 1_000_000_000 : 0) + $row['sort_ts'])
            ->values();

        $pendingItems = $allItems->where('status', 'pending');

        return Inertia::render('Approvals/Index', [
            'items' => $allItems,
            'stats' => [
                'pendingTotal' => $pendingItems->count(),
                'pendingDiscounts' => $pendingItems->where('category', 'discount')->count(),
                'pendingReturns' => $pendingItems->where('category', 'return')->count(),
                'pendingVouchers' => $pendingItems->where('category', 'voucher')->count(),
                'pendingValue' => round((float) $pendingItems->sum('amount'), 2),
                'resolvedCount' => $allItems->whereIn('status', ['approved', 'rejected'])->count(),
            ],
            'branches' => $branches,
            'selectedBranchId' => $selectedBranchId ? (string) $selectedBranchId : 'all',
            'canFilterBranches' => ! $isManagerOnly && $branches->count() > 1,
            'roleLevel' => $isOwner ? 'owner' : ($isCoAdmin ? 'co_admin' : 'manager'),
            'currency' => $tenant->currency_code ?? 'BDT',
        ]);
    }

    public function decideDiscount(
        Request $request,
        Sale $sale,
        SalesOrderService $salesOrderService,
        TenantContext $tenantContext
    ): RedirectResponse {
        $this->authorizeBranch($sale->branch_id, $tenantContext, $request->user());

        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(['approve', 'reject'])],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        if ($validated['action'] === 'approve') {
            $salesOrderService->approveDiscount($sale, $request->user());

            return back()->with('success', "Discount override for {$sale->order_number} approved.");
        }

        $reason = trim((string) ($validated['reason'] ?: 'Discount exceeds approved policy limit.'));
        $salesOrderService->rejectDiscount($sale, $request->user(), $reason);

        return back()->with('success', "Discount override for {$sale->order_number} rejected.");
    }

    public function decideReturn(
        Request $request,
        SaleReturn $saleReturn,
        TenantContext $tenantContext
    ): RedirectResponse {
        $this->authorizeBranch($saleReturn->branch_id, $tenantContext, $request->user());

        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(['approve', 'reject'])],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();

        if ($validated['action'] === 'approve') {
            $cnNumber = $saleReturn->credit_note_number ?: ('CN-'.now()->format('Ymd').'-'.strtoupper(Str::random(4)));
            $saleReturn->update([
                'status' => 'approved',
                'credit_note_status' => 'issued',
                'credit_note_number' => $cnNumber,
                'approved_by' => $user?->id,
                'approved_at' => now(),
            ]);

            AuditLog::record(
                action: 'sales.return_approved',
                description: "Approved return {$saleReturn->return_number} and issued Credit Note {$cnNumber}.",
                subject: $saleReturn,
                userId: $user?->id
            );

            return back()->with('success', "Return {$saleReturn->return_number} approved & Credit Note {$cnNumber} issued.");
        }

        $saleReturn->update([
            'status' => 'rejected',
            'credit_note_status' => 'void',
            'notes' => $validated['reason']
                ? trim(($saleReturn->notes ? $saleReturn->notes.' | ' : '').'Rejected: '.$validated['reason'])
                : $saleReturn->notes,
            'approved_by' => $user?->id,
            'approved_at' => now(),
        ]);

        AuditLog::record(
            action: 'sales.return_rejected',
            description: "Rejected return {$saleReturn->return_number}.",
            subject: $saleReturn,
            userId: $user?->id
        );

        return back()->with('success', "Return {$saleReturn->return_number} marked as rejected.");
    }

    public function decideVoucher(
        Request $request,
        Voucher $voucher,
        VoucherService $voucherService,
        TenantContext $tenantContext
    ): RedirectResponse {
        $this->authorizeBranch($voucher->branch_id, $tenantContext, $request->user());

        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(['approve', 'reject'])],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();

        try {
            if ($validated['action'] === 'approve') {
                $approved = $voucherService->approve($voucher, $user);

                return back()->with('success', "Voucher {$approved->number} approved and posted.");
            }

            if ($voucher->status !== Voucher::STATUS_PENDING_APPROVAL) {
                return back()->with('error', 'Only pending vouchers can be rejected.');
            }

            $voucher->forceFill([
                'status' => Voucher::STATUS_DRAFT,
                'narration' => trim($voucher->narration.' [Returned to draft: '.($validated['reason'] ?: 'Rejected during approval').']'),
            ])->save();

            AuditLog::record(
                action: 'accounting.voucher.rejected',
                description: "Returned pending voucher #{$voucher->id} to draft.",
                subject: $voucher,
                userId: $user?->id
            );

            return back()->with('success', 'Voucher returned to draft.');
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    private function authorizeBranch(?int $entityBranchId, TenantContext $tenantContext, $user): void
    {
        if (! $entityBranchId || $tenantContext->isOwner() || $user?->isSubscriberAdmin()) {
            return;
        }

        $role = $tenantContext->role();
        if (in_array($role, ['co_admin', 'admin'], true)) {
            if ($user->access_all_branches) {
                return;
            }
            $assigned = DB::table('user_branches')->where('user_id', $user->id)->pluck('branch_id')->map(fn ($i) => (int) $i)->all();
            if (empty($assigned) || in_array((int) $entityBranchId, $assigned, true)) {
                return;
            }
            abort(403, 'This approval belongs to an unassigned branch.');
        }

        if ($tenantContext->branchId() && (int) $tenantContext->branchId() !== (int) $entityBranchId) {
            abort(403, 'You can only approve requests belonging to your assigned branch.');
        }
    }
}
