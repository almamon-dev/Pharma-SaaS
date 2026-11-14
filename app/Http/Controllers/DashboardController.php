<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Branch;
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
        $alertDays = (int) ($tenant?->settings['low_stock_alert_days'] ?? 30);

        $totalMedicines = Medicine::query()->where('is_active', true)->count();

        $activeBatchesQuery = MedicineBatch::query()->where('status', 'active');
        $totalStockUnits = (int) (clone $activeBatchesQuery)->sum('quantity_available');
        $inventoryValuation = (float) (clone $activeBatchesQuery)
            ->selectRaw('COALESCE(SUM(quantity_available * purchase_price), 0) as total')
            ->value('total');

        $cutoffDate = now()->addDays($alertDays)->toDateString();

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

        $todaySalesQuery = Sale::query()->whereDate('sold_at', today());
        $todaySalesTotal = (float) (clone $todaySalesQuery)->sum('total_amount');
        $todaySalesCount = (int) (clone $todaySalesQuery)->count();

        $recentSales = Sale::query()
            ->with(['customer:id,name', 'cashier:id,name', 'branch:id,name,code'])
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

        $recentAuditLogs = AuditLog::query()
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
            ]);

        $branchCount = Branch::query()->where('is_active', true)->count();
        $teamCount = $tenant?->users()->wherePivot('is_active', true)->count() ?? 0;

        $subscription = $tenant?->subscriberSubscription();
        $plan = $subscription?->plan;
        $subscriberAdmin = $tenant?->owner;
        $accountUsage = $subscriberAdmin?->subscriptionUsage();

        return Inertia::render('Dashboard', [
            'stats' => [
                'totalMedicines' => $totalMedicines,
                'totalStockUnits' => $totalStockUnits,
                'inventoryValuation' => round($inventoryValuation, 2),
                'expiringSoonCount' => $expiringSoonCount,
                'lowStockCount' => $lowStockAll->count(),
                'todaySalesTotal' => round($todaySalesTotal, 2),
                'todaySalesCount' => $todaySalesCount,
                'branchCount' => $branchCount,
                'teamCount' => $teamCount,
            ],
            'expiringBatches' => $expiringBatches,
            'lowStockMedicines' => $lowStockMedicines,
            'recentSales' => $recentSales,
            'recentAuditLogs' => $recentAuditLogs,
            'usage' => [
                'tenants' => ['used' => $accountUsage['tenants'] ?? 1, 'limit' => $plan?->max_pharmacies ?? 1],
                'branches' => ['used' => $accountUsage['branches'] ?? $branchCount, 'limit' => $plan?->max_branches ?? 1],
                'users' => ['used' => $accountUsage['employees'] ?? $teamCount, 'limit' => $plan?->max_users ?? 5],
                'medicines' => ['used' => $totalMedicines, 'limit' => $plan?->max_medicines ?? 500],
            ],
        ]);
    }
}
