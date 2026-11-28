<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Counter;
use App\Models\CounterSession;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\Sale;
use App\Support\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(TenantContext $tenantContext): Response|RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $user = auth()->user();
        $isBusinessOwner = (bool) ($tenantContext->isOwner() || $user?->isSubscriberAdmin());
        $rawRole = $tenantContext->role() ?? ($isBusinessOwner ? 'admin' : 'salesman');
        $isCoAdmin = ! $isBusinessOwner && in_array($rawRole, ['co_admin', 'admin'], true);
        $isManager = ! $isBusinessOwner && ! $isCoAdmin && $rawRole === 'manager';
        $isPharmacist = ! $isBusinessOwner && ! $isCoAdmin && ! $isManager && $rawRole === 'pharmacist';
        $isCashier = ! $isBusinessOwner && ! $isCoAdmin && ! $isManager && $rawRole === 'cashier';
        $isSalesman = ! $isBusinessOwner && ! $isCoAdmin && ! $isManager && ! $isPharmacist && ! $isCashier;

        // Pharmacist -> dedicated clinical dashboard
        if ($isPharmacist) {
            return app(PharmacistPortalController::class)->dashboard($tenantContext);
        }

        // Cashier -> dedicated Cashier Station (today's collection, bills, drawer balance & pending order queue)
        if ($isCashier) {
            return redirect()->route('cashier.dashboard');
        }

        $effectiveRole = $isBusinessOwner
            ? 'owner'
            : ($isCoAdmin ? 'co_admin' : ($isManager ? 'manager' : 'salesman'));

        // Determine branch scope:
        // - Owner: all tenant branches (null)
        // - Co-Admin: assigned branches (or all if none restricted)
        // - Manager / Salesman: single assigned branch
        $scopedBranchIds = null;
        if ($isCoAdmin && $user && ! $user->access_all_branches) {
            $assigned = DB::table('user_branches')
                ->where('user_id', $user->id)
                ->pluck('branch_id')
                ->map(fn ($id) => (int) $id)
                ->all();
            if (! empty($assigned)) {
                $scopedBranchIds = $assigned;
            }
        } elseif (($isManager || $isSalesman) && $tenantContext->branchId()) {
            $scopedBranchIds = [(int) $tenantContext->branchId()];
        }

        $applyBranchScope = function ($query, string $column = 'branch_id') use ($scopedBranchIds): void {
            if ($scopedBranchIds !== null) {
                $query->whereIn($column, $scopedBranchIds);
            }
        };

        $alertDays = (int) ($tenant?->settings['low_stock_alert_days'] ?? 30);
        $cutoffDate = now()->addDays($alertDays)->toDateString();

        // 1. Inventory & SKU metrics (branch-scoped for Manager/Co-Admin)
        $totalMedicines = Medicine::query()->where('is_active', true)->count();
        $activeBatchesQuery = MedicineBatch::query()
            ->where('status', 'active')
            ->tap(fn ($q) => $applyBranchScope($q));
        $totalStockUnits = (int) (clone $activeBatchesQuery)->sum('quantity_available');

        // Confidential valuation (COGS): ONLY visible to Super Admin (Business Owner)
        $inventoryValuation = $isBusinessOwner
            ? (float) (clone $activeBatchesQuery)
                ->selectRaw('COALESCE(SUM(quantity_available * purchase_price), 0) as total')
                ->value('total')
            : null;

        $expiringBatches = $isSalesman ? [] : MedicineBatch::query()
            ->with(['medicine:id,name,sku,unit', 'branch:id,name,code'])
            ->tap(fn ($q) => $applyBranchScope($q))
            ->where('status', 'active')
            ->where('quantity_available', '>', 0)
            ->where('expiry_date', '<=', $cutoffDate)
            ->orderBy('expiry_date')
            ->limit(6)
            ->get()
            ->map(fn (MedicineBatch $batch) => [
                'id' => $batch->id,
                'batch_number' => $batch->batch_number,
                'medicine_name' => $batch->medicine?->name,
                'medicine_sku' => $batch->medicine?->sku,
                'unit' => $batch->medicine?->unit,
                'branch_name' => $batch->branch?->name,
                'branch_code' => $batch->branch?->code,
                'quantity_available' => $batch->quantity_available,
                'expiry_date' => $batch->expiry_date->toDateString(),
                'days_remaining' => (int) now()->startOfDay()->diffInDays($batch->expiry_date, false),
            ]);

        $expiringSoonCount = (int) MedicineBatch::query()
            ->tap(fn ($q) => $applyBranchScope($q))
            ->where('status', 'active')
            ->where('quantity_available', '>', 0)
            ->where('expiry_date', '<=', $cutoffDate)
            ->count();

        $stockSub = DB::table('medicine_batches')
            ->selectRaw('medicine_id, SUM(quantity_available) as available_stock')
            ->where('tenant_id', $tenant?->id)
            ->where('status', 'active')
            ->when($scopedBranchIds !== null, fn ($q) => $q->whereIn('branch_id', $scopedBranchIds))
            ->groupBy('medicine_id');

        $lowStockBaseQuery = Medicine::query()
            ->where('medicines.is_active', true)
            ->leftJoinSub($stockSub, 'mb_sum', 'mb_sum.medicine_id', '=', 'medicines.id')
            ->whereRaw('COALESCE(mb_sum.available_stock, 0) <= medicines.reorder_level');

        $lowStockCount = (int) (clone $lowStockBaseQuery)->count();

        $lowStockMedicines = $isSalesman ? [] : (clone $lowStockBaseQuery)
            ->selectRaw('medicines.id, medicines.name, medicines.sku, medicines.unit, medicines.reorder_level, COALESCE(mb_sum.available_stock, 0) as available_stock')
            ->orderByRaw('COALESCE(mb_sum.available_stock, 0) DESC, medicines.name ASC')
            ->limit(6)
            ->get()
            ->map(fn (Medicine $med) => [
                'id' => $med->id,
                'name' => $med->name,
                'sku' => $med->sku,
                'unit' => $med->unit,
                'available_stock' => (int) ($med->available_stock ?? 0),
                'reorder_level' => $med->reorder_level,
            ]);

        // 2. Sales, Gross Profit, Counters, Discrepancies & Approvals
        $validSalesBase = Sale::query()
            ->tap(fn ($q) => $applyBranchScope($q))
            ->where(function ($q): void {
                $q->whereNull('order_status')
                    ->orWhereNotIn('order_status', ['draft', 'cancelled']);
            });

        $todaySalesQuery = (clone $validSalesBase)->whereDate('sold_at', today());
        $todaySalesTotal = round((float) (clone $todaySalesQuery)->sum('total_amount'), 2);
        $todaySalesCount = (int) (clone $todaySalesQuery)->count();
        $allTimeSalesTotal = round((float) (clone $validSalesBase)->sum('total_amount'), 2);

        // Gross Profit Summary — STRICTLY for Super Admin (Business Owner) ONLY
        $grossProfitSummary = null;
        if ($isBusinessOwner && $tenant) {
            $profitRow = DB::table('sale_items as si')
                ->join('sales as s', 's.id', '=', 'si.sale_id')
                ->leftJoin('medicine_batches as mb', 'mb.id', '=', 'si.medicine_batch_id')
                ->leftJoin('medicines as m', 'm.id', '=', 'si.medicine_id')
                ->where('s.tenant_id', $tenant->id)
                ->where(function ($q): void {
                    $q->whereNull('s.order_status')
                        ->orWhereNotIn('s.order_status', ['draft', 'cancelled']);
                })
                ->selectRaw('
                    COALESCE(SUM(si.line_total), 0) as gross_revenue,
                    COALESCE(SUM(si.quantity * COALESCE(mb.purchase_price, m.default_purchase_price, 0)), 0) as total_cogs,
                    COALESCE(SUM(CASE WHEN DATE(s.sold_at) = CURRENT_DATE THEN si.line_total - (si.quantity * COALESCE(mb.purchase_price, m.default_purchase_price, 0)) ELSE 0 END), 0) as today_profit
                ')
                ->first();

            $totalDiscounts = (float) (clone $validSalesBase)->sum('discount_amount');
            $todayDiscounts = (float) (clone $todaySalesQuery)->sum('discount_amount');
            $netRevenue = max(0.0, (float) ($profitRow->gross_revenue ?? 0) - $totalDiscounts);
            $grossProfit = round($netRevenue - (float) ($profitRow->total_cogs ?? 0), 2);
            $todayGrossProfit = round((float) ($profitRow->today_profit ?? 0) - $todayDiscounts, 2);
            $marginPct = $netRevenue > 0 ? round(($grossProfit / $netRevenue) * 100, 1) : 0.0;

            $grossProfitSummary = [
                'totalGrossProfit' => $grossProfit,
                'todayGrossProfit' => $todayGrossProfit,
                'marginPercent' => $marginPct,
            ];
        }

        // Cash Discrepancy Alerts (for Super Admin)
        $cashDiscrepancyCount = 0;
        $cashDiscrepancyTotal = 0.0;
        if ($isBusinessOwner) {
            $discrepancyQuery = CounterSession::query()
                ->whereNotNull('discrepancy_amount')
                ->whereRaw('ABS(discrepancy_amount) > 0.01');
            $cashDiscrepancyCount = (int) (clone $discrepancyQuery)->count();
            $cashDiscrepancyTotal = round((float) (clone $discrepancyQuery)->sum('discrepancy_amount'), 2);
        }

        // Open Counters & Waiting Queue (for Owner, Co-Admin & Branch Manager)
        $countersQuery = Counter::query()
            ->where('is_active', true)
            ->tap(fn ($q) => $applyBranchScope($q));
        $totalCountersCount = (int) (clone $countersQuery)->count();
        $openCountersCount = (int) (clone $countersQuery)->where('status', 'active')->count();
        $waitingQueueCount = (int) Sale::query()
            ->tap(fn ($q) => $applyBranchScope($q))
            ->whereIn('order_status', ['submitted', 'unassigned', 'assigned', 'waiting', 'processing', 'payment_pending'])
            ->count();

        // Pending Approvals Count
        $pendingApprovalsCount = ($isBusinessOwner || $isCoAdmin || $isManager)
            ? ApprovalsController::pendingCountFor(
                (int) $tenant->id,
                $isManager ? $tenantContext->branchId() : null
            )
            : 0;

        // Branch Performance Breakdown (for Super Admin & Co-Admin)
        $branchPerformance = [];
        if ($isBusinessOwner || $isCoAdmin) {
            $branchesList = Branch::query()
                ->where('is_active', true)
                ->tap(fn ($q) => $applyBranchScope($q, 'id'))
                ->orderByDesc('is_head_office')
                ->orderBy('name')
                ->get(['id', 'name', 'code', 'city']);

            $salesByBranch = Sale::query()
                ->whereIn('branch_id', $branchesList->pluck('id'))
                ->where(function ($q): void {
                    $q->whereNull('order_status')
                        ->orWhereNotIn('order_status', ['draft', 'cancelled']);
                })
                ->selectRaw('
                    branch_id,
                    COUNT(*) as total_bills,
                    COALESCE(SUM(total_amount), 0) as total_sales,
                    COALESCE(SUM(CASE WHEN DATE(sold_at) = CURRENT_DATE THEN total_amount ELSE 0 END), 0) as today_sales
                ')
                ->groupBy('branch_id')
                ->get()
                ->keyBy('branch_id');

            $openCountersByBranch = Counter::query()
                ->whereIn('branch_id', $branchesList->pluck('id'))
                ->where('is_active', true)
                ->selectRaw("branch_id, COUNT(*) as total_counters, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as open_counters")
                ->groupBy('branch_id')
                ->get()
                ->keyBy('branch_id');

            $branchPerformance = $branchesList->map(function (Branch $b) use ($salesByBranch, $openCountersByBranch) {
                $s = $salesByBranch->get($b->id);
                $c = $openCountersByBranch->get($b->id);

                return [
                    'id' => $b->id,
                    'name' => $b->name,
                    'code' => $b->code,
                    'city' => $b->city,
                    'today_sales' => round((float) ($s->today_sales ?? 0), 2),
                    'total_sales' => round((float) ($s->total_sales ?? 0), 2),
                    'total_bills' => (int) ($s->total_bills ?? 0),
                    'open_counters' => (int) ($c->open_counters ?? 0),
                    'total_counters' => (int) ($c->total_counters ?? 0),
                ];
            })->values()->all();
        }

        // Salesman Metrics (own today's sales, target %, awaiting payment orders, recent/top products)
        $myTodaySalesTotal = 0.0;
        $myTodaySalesCount = 0;
        $salesmanDailyTarget = 15000.0;
        $targetAchievementPct = 0.0;
        $awaitingPaymentCount = 0;
        $awaitingPaymentTotal = 0.0;
        $topSellingProducts = [];

        if ($isSalesman && $user) {
            $myOrdersBase = Sale::query()
                ->where(function ($q) use ($user): void {
                    $q->where('salesman_id', $user->id)->orWhere('user_id', $user->id);
                })
                ->where(function ($q): void {
                    $q->whereNull('order_status')
                        ->orWhereNotIn('order_status', ['draft', 'cancelled']);
                });

            $myTodayQuery = (clone $myOrdersBase)->whereDate('created_at', today());
            $myTodaySalesTotal = round((float) (clone $myTodayQuery)->sum('total_amount'), 2);
            $myTodaySalesCount = (int) (clone $myTodayQuery)->count();
            $targetAchievementPct = round(min(100.0, ($myTodaySalesTotal / $salesmanDailyTarget) * 100), 1);

            $awaitingQuery = (clone $myOrdersBase)->where('payment_status', '!=', 'paid');
            $awaitingPaymentCount = (int) (clone $awaitingQuery)->count();
            $awaitingPaymentTotal = round((float) (clone $awaitingQuery)->sum('total_amount'), 2);

            $topSellingProducts = DB::table('sale_items as si')
                ->join('sales as s', 's.id', '=', 'si.sale_id')
                ->join('medicines as m', 'm.id', '=', 'si.medicine_id')
                ->where('s.tenant_id', $tenant?->id)
                ->when($scopedBranchIds !== null, fn ($q) => $q->whereIn('s.branch_id', $scopedBranchIds))
                ->where(function ($q): void {
                    $q->whereNull('s.order_status')
                        ->orWhereNotIn('s.order_status', ['draft', 'cancelled']);
                })
                ->selectRaw('m.id, m.name, m.generic_name, m.sku, m.default_selling_price as unit_price, SUM(si.quantity) as total_qty, SUM(si.line_total) as total_revenue')
                ->groupBy('m.id', 'm.name', 'm.generic_name', 'm.sku', 'm.default_selling_price')
                ->orderByDesc('total_qty')
                ->limit(8)
                ->get()
                ->map(fn ($r) => [
                    'id' => (int) $r->id,
                    'name' => $r->name,
                    'generic_name' => $r->generic_name,
                    'sku' => $r->sku,
                    'unit_price' => round((float) $r->unit_price, 2),
                    'total_qty' => (int) $r->total_qty,
                    'total_revenue' => round((float) $r->total_revenue, 2),
                ])
                ->all();
        }

        // Recent Sales / Orders
        $recentSalesQuery = Sale::query()
            ->tap(fn ($q) => $applyBranchScope($q))
            ->with(['customer:id,name', 'cashier:id,name', 'salesman:id,name', 'branch:id,name,code']);

        if ($isSalesman && $user) {
            $recentSalesQuery->where(function ($q) use ($user): void {
                $q->where('salesman_id', $user->id)->orWhere('user_id', $user->id);
            });
        }

        $recentSales = $recentSalesQuery
            ->latest('id')
            ->limit(6)
            ->get()
            ->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'invoice_number' => $sale->order_number ?: $sale->invoice_number,
                'customer_name' => $sale->customer?->name ?? 'Walk-in Customer',
                'cashier_name' => $sale->cashier?->name ?? $sale->salesman?->name ?? 'Staff',
                'branch_code' => $sale->branch?->code,
                'total_amount' => (float) $sale->total_amount,
                'payment_method' => $sale->payment_method,
                'payment_status' => $sale->payment_status,
                'order_status' => $sale->order_status,
                'sold_at' => ($sale->sold_at ?? $sale->created_at)?->diffForHumans() ?? 'Just now',
            ]);

        // Audit Logs (visible to Super Admin, Co-Admin & Branch Manager)
        $recentAuditLogs = [];
        if ($isBusinessOwner || $isCoAdmin || $isManager) {
            $auditQuery = AuditLog::query()->with('user:id,name');
            if ($isManager && $tenantContext->branchId()) {
                $branchStaffIds = DB::table('tenant_user')
                    ->where('tenant_id', $tenant?->id)
                    ->where('branch_id', $tenantContext->branchId())
                    ->pluck('user_id')
                    ->all();
                $auditQuery->whereIn('user_id', $branchStaffIds);
            } elseif ($isCoAdmin) {
                $auditQuery->where('action', 'NOT LIKE', 'subscription.%')
                    ->where('action', 'NOT LIKE', 'billing.%');
            }

            $recentAuditLogs = $auditQuery
                ->latest('id')
                ->limit(6)
                ->get()
                ->map(fn (AuditLog $log) => [
                    'id' => $log->id,
                    'action' => $log->action,
                    'description' => $log->description,
                    'user_name' => $log->user?->name ?? 'System',
                    'created_at' => $log->created_at?->diffForHumans(),
                ]);
        }

        $branchCount = (int) Branch::query()
            ->where('is_active', true)
            ->tap(fn ($q) => $applyBranchScope($q, 'id'))
            ->count();
        $totalBranchesInCompany = (int) Branch::query()->where('is_active', true)->count();
        $teamCount = $tenant?->users()->wherePivot('is_active', true)->count() ?? 0;

        // Subscription Usage — STRICTLY for Super Admin (Business Owner) ONLY
        $usage = null;
        if ($isBusinessOwner) {
            $subscription = $tenant?->subscriberSubscription();
            $plan = $subscription?->plan;
            $subscriberAdmin = $tenant?->owner;
            $accountUsage = $subscriberAdmin?->subscriptionUsage();
            $customMedicinesUsed = Medicine::query()
                ->where('is_active', true)
                ->where(function ($q): void {
                    $q->whereNull('sku')->orWhere('sku', 'NOT LIKE', 'BD-%');
                })
                ->count();

            $usage = [
                'tenants' => ['used' => $accountUsage['tenants'] ?? 1, 'limit' => $plan?->max_pharmacies ?? 1],
                'branches' => ['used' => $accountUsage['branches'] ?? $totalBranchesInCompany, 'limit' => $plan?->max_branches ?? 1],
                'users' => ['used' => $accountUsage['employees'] ?? $teamCount, 'limit' => $plan?->max_users ?? 5],
                'medicines' => ['used' => $customMedicinesUsed, 'limit' => $plan?->max_medicines ?? 500],
            ];
        }

        $roleContext = [
            'role' => $effectiveRole,
            'label' => match ($effectiveRole) {
                'owner' => 'Super Admin (Business Owner)',
                'co_admin' => 'Admin (Operations Head)',
                'manager' => 'Branch Manager',
                'salesman' => 'Salesman',
                default => ucfirst($effectiveRole),
            },
            'badge' => match ($effectiveRole) {
                'owner' => 'Company Overview',
                'co_admin' => 'Operations Overview',
                'manager' => 'Branch Overview',
                'salesman' => 'Sales Home',
                default => 'Workspace',
            },
            'isOwner' => $isBusinessOwner,
            'isCoAdmin' => $isCoAdmin,
            'isManager' => $isManager,
            'isSalesman' => $isSalesman,
            'canSwitchRole' => true,
            'availableDemoRoles' => [
                ['role' => 'admin', 'name' => 'Super Admin', 'title' => 'Business Owner', 'email' => 'admin@pharmacore.test'],
                ['role' => 'co_admin', 'name' => 'Admin', 'title' => 'Operations Head', 'email' => 'coadmin@pharmacore.test'],
                ['role' => 'manager', 'name' => 'Branch Manager', 'title' => 'Branch Head', 'email' => 'manager@pharmacore.test'],
                ['role' => 'pharmacist', 'name' => 'Pharmacist', 'title' => 'Clinical & Stock', 'email' => 'pharmacist@pharmacore.test'],
                ['role' => 'salesman', 'name' => 'Salesman', 'title' => 'Orders & Customers', 'email' => 'salesman@pharmacore.test'],
                ['role' => 'cashier', 'name' => 'Cashier', 'title' => 'POS & Collection', 'email' => 'cashier@pharmacore.test'],
            ],
        ];

        return Inertia::render('Dashboard', [
            'stats' => [
                'totalMedicines' => $totalMedicines,
                'totalStockUnits' => $totalStockUnits,
                'inventoryValuation' => $inventoryValuation !== null ? round($inventoryValuation, 2) : null,
                'expiringSoonCount' => $expiringSoonCount,
                'lowStockCount' => $lowStockCount,
                'todaySalesTotal' => $todaySalesTotal,
                'todaySalesCount' => $todaySalesCount,
                'allTimeSalesTotal' => $allTimeSalesTotal,
                'pendingApprovalsCount' => $pendingApprovalsCount,
                'cashDiscrepancyCount' => $cashDiscrepancyCount,
                'cashDiscrepancyTotal' => $cashDiscrepancyTotal,
                'openCountersCount' => $openCountersCount,
                'totalCountersCount' => $totalCountersCount,
                'waitingQueueCount' => $waitingQueueCount,
                'myTodaySalesTotal' => $myTodaySalesTotal,
                'myTodaySalesCount' => $myTodaySalesCount,
                'salesmanDailyTarget' => $salesmanDailyTarget,
                'targetAchievementPct' => $targetAchievementPct,
                'awaitingPaymentCount' => $awaitingPaymentCount,
                'awaitingPaymentTotal' => $awaitingPaymentTotal,
                'branchCount' => $branchCount,
                'totalBranchesInCompany' => $totalBranchesInCompany,
                'teamCount' => $teamCount,
            ],
            'grossProfitSummary' => $grossProfitSummary,
            'branchPerformance' => $branchPerformance,
            'topSellingProducts' => $topSellingProducts,
            'expiringBatches' => $expiringBatches,
            'lowStockMedicines' => $lowStockMedicines,
            'recentSales' => $recentSales,
            'recentAuditLogs' => $recentAuditLogs,
            'usage' => $usage,
            'roleContext' => $roleContext,
        ]);
    }
}
