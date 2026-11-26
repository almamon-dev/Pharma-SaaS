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
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(TenantContext $tenantContext): Response
    {
        $tenant = $tenantContext->tenant();
        $user = auth()->user();
        $primaryRole = $tenantContext->role() ?? ($user?->isSubscriberAdmin() ? 'admin' : 'staff');
        $isOwnerOrAdmin = $tenantContext->isOwner() || $primaryRole === 'admin' || (bool) $user?->isSubscriberAdmin();
        $isManager = $primaryRole === 'manager';
        $isPharmacist = $primaryRole === 'pharmacist';
        $isCashier = $primaryRole === 'cashier';
        $isClerk = $primaryRole === 'inventory_clerk';

        if ($isPharmacist && ! $isOwnerOrAdmin && ! $isManager) {
            return app(PharmacistPortalController::class)->dashboard($tenantContext);
        }

        $alertDays = (int) ($tenant?->settings['low_stock_alert_days'] ?? 30);
        $cutoffDate = now()->addDays($alertDays)->toDateString();

        // 1. Inventory & SKU metrics
        $totalMedicines = Medicine::query()->where('is_active', true)->count();
        $activeBatchesQuery = MedicineBatch::query()->where('status', 'active');
        $totalStockUnits = (int) (clone $activeBatchesQuery)->sum('quantity_available');

        // Confidential valuation (COGS purchase cost): only visible to Admin / Owner and Branch Manager
        $inventoryValuation = ($isOwnerOrAdmin || $isManager)
            ? (float) (clone $activeBatchesQuery)
                ->selectRaw('COALESCE(SUM(quantity_available * purchase_price), 0) as total')
                ->value('total')
            : null;

        $expiringBatches = MedicineBatch::query()
            ->with(['medicine:id,name,sku,unit', 'branch:id,name,code'])
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

        $expiringSoonCount = MedicineBatch::query()
            ->where('status', 'active')
            ->where('quantity_available', '>', 0)
            ->where('expiry_date', '<=', $cutoffDate)
            ->count();

        $allMedicines = Medicine::query()
            ->where('is_active', true)
            ->withSum(['batches as available_stock' => fn ($q) => $q->where('status', 'active')], 'quantity_available')
            ->orderBy('name')
            ->get(['id', 'name', 'sku', 'unit', 'reorder_level']);

        $lowStockAll = $allMedicines
            ->filter(fn (Medicine $med) => (int) ($med->available_stock ?? 0) <= $med->reorder_level)
            ->values();

        $lowStockMedicines = $lowStockAll->take(6)->map(fn (Medicine $med) => [
            'id' => $med->id,
            'name' => $med->name,
            'sku' => $med->sku,
            'unit' => $med->unit,
            'available_stock' => (int) ($med->available_stock ?? 0),
            'reorder_level' => $med->reorder_level,
        ]);

        // 2. Sales & Checkout metrics
        $todaySalesQuery = Sale::query()->whereDate('sold_at', today());
        $todaySalesTotal = ($isClerk) ? null : (float) (clone $todaySalesQuery)->sum('total_amount');
        $todaySalesCount = ($isClerk) ? null : (int) (clone $todaySalesQuery)->count();

        // Cashier specific sales
        $myTodaySalesTotal = 0.0;
        $myTodaySalesCount = 0;
        if ($isCashier && $user) {
            $mySalesQuery = Sale::query()->whereDate('sold_at', today())->where('user_id', $user->id);
            $myTodaySalesTotal = (float) (clone $mySalesQuery)->sum('total_amount');
            $myTodaySalesCount = (int) (clone $mySalesQuery)->count();
        }

        // Active Counter & Shift for Cashier / Manager
        $activeCounterSession = null;
        if ($user) {
            $activeCounterSession = CounterSession::query()
                ->with('counter')
                ->where('user_id', $user->id)
                ->where('status', 'open')
                ->latest('opened_at')
                ->first();
        }

        $assignedCounter = $activeCounterSession?->counter ?? Counter::query()->where('is_active', true)->first();

        $counterData = $assignedCounter ? [
            'id' => $assignedCounter->id,
            'code' => $assignedCounter->code,
            'name' => $assignedCounter->name,
            'type' => $assignedCounter->type,
            'zone' => $assignedCounter->zone,
            'status' => $assignedCounter->status,
            'has_active_session' => $activeCounterSession !== null,
            'opening_float' => (float) ($activeCounterSession?->opening_float ?? 0),
            'expected_cash' => (float) ($activeCounterSession?->system_expected_cash ?? 0),
            'session_sales' => (float) ($activeCounterSession?->total_sales_amount ?? 0),
            'session_transactions' => (int) ($activeCounterSession?->total_transactions ?? 0),
        ] : null;

        $recentSalesQuery = Sale::query()
            ->with(['customer:id,name', 'cashier:id,name', 'branch:id,name,code']);

        if ($isCashier && $user) {
            $recentSalesQuery->where('user_id', $user->id);
        }

        $recentSales = $isClerk ? [] : $recentSalesQuery
            ->latest('sold_at')
            ->limit(5)
            ->get()
            ->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'invoice_number' => $sale->invoice_number,
                'customer_name' => $sale->customer?->name ?? 'Walk-in Customer',
                'cashier_name' => $sale->cashier?->name ?? 'Staff',
                'branch_code' => $sale->branch?->code,
                'total_amount' => (float) $sale->total_amount,
                'payment_method' => $sale->payment_method,
                'payment_status' => $sale->payment_status,
                'sold_at' => $sale->sold_at->diffForHumans(),
            ]);

        // Audit Logs (only visible to Owner/Admin and Manager)
        $recentAuditLogs = ($isOwnerOrAdmin || $isManager) ? AuditLog::query()
            ->with('user:id,name')
            ->latest('id')
            ->limit(6)
            ->get()
            ->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => $log->description,
                'user_name' => $log->user?->name ?? 'System',
                'created_at' => $log->created_at?->diffForHumans(),
            ]) : [];

        $branchCount = Branch::query()->where('is_active', true)->count();
        $teamCount = $tenant?->users()->wherePivot('is_active', true)->count() ?? 0;

        // Subscription Usage (only for Owner/Admin)
        $subscription = $tenant?->subscriberSubscription();
        $plan = $subscription?->plan;
        $subscriberAdmin = $tenant?->owner;
        $accountUsage = $subscriberAdmin?->subscriptionUsage();

        $usage = $isOwnerOrAdmin ? [
            'tenants' => ['used' => $accountUsage['tenants'] ?? 1, 'limit' => $plan?->max_pharmacies ?? 1],
            'branches' => ['used' => $accountUsage['branches'] ?? $branchCount, 'limit' => $plan?->max_branches ?? 1],
            'users' => ['used' => $accountUsage['employees'] ?? $teamCount, 'limit' => $plan?->max_users ?? 5],
            'medicines' => ['used' => $totalMedicines, 'limit' => $plan?->max_medicines ?? 500],
        ] : null;

        // Role-Specific Context & Testing Switcher
        $roleContext = [
            'role' => $primaryRole,
            'label' => match ($primaryRole) {
                'admin' => 'Business Owner / Admin',
                'manager' => 'Branch Manager',
                'pharmacist' => 'Licensed Pharmacist',
                'cashier' => 'POS Cashier',
                'inventory_clerk' => 'Inventory & Supply Clerk',
                default => ucfirst(str_replace('_', ' ', $primaryRole)),
            },
            'badge' => match ($primaryRole) {
                'admin' => 'Full Business Authority',
                'manager' => 'Branch Operations Supervisor',
                'pharmacist' => 'Clinical Safety & Dispensing',
                'cashier' => 'Point of Sale & Billing',
                'inventory_clerk' => 'Warehouse & Supply Intake',
                default => 'Pharmacy Workspace',
            },
            'description' => match ($primaryRole) {
                'admin' => 'Full business authority across all branches, financial revenues, staff roles, and subscriptions.',
                'manager' => 'Operational control over branch sales, active cashiers, counters, stock-in batches, and shifts.',
                'pharmacist' => 'Clinical dispensing, prescription verification, FEFO batch expiry monitoring, and allergy safety.',
                'cashier' => 'High-speed counter checkout, cash register drawer reconciliation, and customer receipts.',
                'inventory_clerk' => 'Warehouse stock intake, medicine SKU catalog, supplier restock shipments, and batch tracking.',
                default => 'Pharmacy workspace member.',
            },
            'isOwnerOrAdmin' => $isOwnerOrAdmin,
            'isManager' => $isManager,
            'isPharmacist' => $isPharmacist,
            'isCashier' => $isCashier,
            'isClerk' => $isClerk,
            'canSwitchRole' => true,
            'availableDemoRoles' => [
                ['role' => 'admin', 'name' => '👑 Owner', 'title' => 'Owner / Admin', 'email' => 'admin@pharmacore.test'],
                ['role' => 'manager', 'name' => '👔 Manager', 'title' => 'Branch Manager', 'email' => 'manager@pharmacore.test'],
                ['role' => 'pharmacist', 'name' => '💊 Pharmacist', 'title' => 'Licensed Pharmacist', 'email' => 'pharmacist@pharmacore.test'],
                ['role' => 'cashier', 'name' => '🛒 Cashier', 'title' => 'POS Cashier', 'email' => 'cashier@pharmacore.test'],
                ['role' => 'inventory_clerk', 'name' => '📦 Clerk', 'title' => 'Inventory Clerk', 'email' => 'clerk@pharmacore.test'],
            ],
        ];

        return Inertia::render('Dashboard', [
            'stats' => [
                'totalMedicines' => $totalMedicines,
                'totalStockUnits' => $totalStockUnits,
                'inventoryValuation' => $inventoryValuation !== null ? round($inventoryValuation, 2) : null,
                'expiringSoonCount' => $expiringSoonCount,
                'lowStockCount' => $lowStockAll->count(),
                'todaySalesTotal' => $todaySalesTotal !== null ? round($todaySalesTotal, 2) : null,
                'todaySalesCount' => $todaySalesCount,
                'myTodaySalesTotal' => round($myTodaySalesTotal, 2),
                'myTodaySalesCount' => $myTodaySalesCount,
                'branchCount' => $branchCount,
                'teamCount' => $teamCount,
            ],
            'expiringBatches' => $isCashier ? [] : $expiringBatches,
            'lowStockMedicines' => $isCashier ? [] : $lowStockMedicines,
            'recentSales' => $recentSales,
            'recentAuditLogs' => $recentAuditLogs,
            'usage' => $usage,
            'counter' => $counterData,
            'roleContext' => $roleContext,
        ]);
    }
}
