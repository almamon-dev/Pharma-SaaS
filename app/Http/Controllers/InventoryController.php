<?php

namespace App\Http\Controllers;

use App\Enums\BatchStatus;
use App\Enums\StockMovementType;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Models\MedicineCategory;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Services\InventoryService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function __construct(
        private readonly InventoryService $inventoryService,
    ) {}

    public function index(Request $request, TenantContext $tenantContext): Response
    {
        $branchScope = $this->resolveBranchScope($request, $tenantContext);
        $branchFilterId = $branchScope['branchFilterId'];

        $search = trim((string) $request->query('q', ''));
        $filter = (string) $request->query('filter', 'all');
        $categoryId = $request->query('category_id');

        $allMedicines = Medicine::query()
            ->with([
                'category:id,name',
                'batches' => function ($query) use ($branchFilterId): void {
                    if ($branchFilterId !== null) {
                        $query->where('branch_id', $branchFilterId);
                    }
                    $query->orderBy('expiry_date');
                },
            ])
            ->when($search !== '', function ($query) use ($search): void {
                $needle = mb_strtolower($search);
                $query->where(function ($sub) use ($needle): void {
                    $sub->whereRaw('LOWER(name) LIKE ?', ["%{$needle}%"])
                        ->orWhereRaw('LOWER(COALESCE(generic_name, \'\')) LIKE ?', ["%{$needle}%"])
                        ->orWhereRaw('LOWER(sku) LIKE ?', ["%{$needle}%"])
                        ->orWhereRaw('LOWER(COALESCE(barcode, \'\')) LIKE ?', ["%{$needle}%"]);
                });
            })
            ->when($categoryId, fn ($query) => $query->where('category_id', (int) $categoryId))
            ->orderBy('name')
            ->get();

        $today = now()->startOfDay();
        $canViewCost = $request->user()->isSuperAdmin() || $request->user()->hasPermission('cost_price.view');

        $mappedAll = $allMedicines->map(function (Medicine $medicine) use ($today, $canViewCost): array {
            $batches = $medicine->batches;

            $sellableBatches = $batches->filter(
                fn (MedicineBatch $batch): bool => $batch->status === BatchStatus::ACTIVE->value
                    && (int) $batch->quantity_available > 0
                    && ! $batch->isExpired()
            )->sortBy('expiry_date')->values();

            $expiredUnwrittenBatches = $batches->filter(
                fn (MedicineBatch $batch): bool => (int) $batch->quantity_available > 0
                    && ($batch->isExpired() || $batch->status === BatchStatus::EXPIRED->value)
                    && ! in_array($batch->status, [BatchStatus::DAMAGED->value, BatchStatus::DISPOSED->value], true)
            )->sortBy('expiry_date')->values();

            $availableStock = (int) $sellableBatches->sum('quantity_available');
            $expiredStock = (int) $expiredUnwrittenBatches->sum('quantity_available');
            $nextBatch = $sellableBatches->first() ?? $expiredUnwrittenBatches->first();

            $purchaseVal = (float) $sellableBatches->sum(
                fn (MedicineBatch $batch): float => (int) $batch->quantity_available * (float) $batch->purchase_price
            );
            $retailVal = (float) $sellableBatches->sum(
                fn (MedicineBatch $batch): float => (int) $batch->quantity_available * (float) ($batch->selling_price ?: $medicine->default_selling_price)
            );
            $expiredVal = (float) $expiredUnwrittenBatches->sum(
                fn (MedicineBatch $batch): float => (int) $batch->quantity_available * (float) $batch->purchase_price
            );

            $daysToExpiry = $nextBatch?->expiry_date
                ? (int) $today->diffInDays($nextBatch->expiry_date, false)
                : null;

            return [
                'id' => $medicine->id,
                'category_id' => $medicine->category_id ? (string) $medicine->category_id : '',
                'name' => $medicine->name,
                'generic_name' => $medicine->generic_name,
                'manufacturer' => $medicine->manufacturer,
                'sku' => $medicine->sku,
                'barcode' => $medicine->barcode,
                'dosage_form' => $medicine->dosage_form,
                'strength' => $medicine->strength,
                'description' => $medicine->description,
                'unit' => $medicine->unit,
                'units_per_strip' => (int) ($medicine->units_per_strip ?: 1),
                'units_per_box' => (int) ($medicine->units_per_box ?: 1),
                'category_name' => $medicine->category?->name ?? 'Uncategorized',
                'reorder_level' => (int) $medicine->reorder_level,
                'requires_prescription' => (bool) $medicine->requires_prescription,
                'default_purchase_price' => $canViewCost ? (float) $medicine->default_purchase_price : null,
                'box_purchase_price' => $canViewCost ? $medicine->resolvedBoxPurchasePrice() : null,
                'default_selling_price' => (float) $medicine->default_selling_price,
                'box_selling_price' => $medicine->resolvedBoxSellingPrice(),
                'is_active' => (bool) $medicine->is_active,
                'available_stock' => $availableStock,
                'expired_stock' => $expiredStock,
                'is_low_stock' => (bool) $medicine->is_active && $availableStock <= (int) $medicine->reorder_level,
                'nearest_expiry' => $nextBatch?->expiry_date?->toDateString(),
                'days_to_expiry' => $daysToExpiry,
                'batch_count' => $sellableBatches->count(),
                'total_batch_count' => $batches->count(),
                'stock_purchase_value' => $canViewCost ? round($purchaseVal, 2) : null,
                'stock_retail_value' => round($retailVal, 2),
                'expired_stock_value' => $canViewCost ? round($expiredVal, 2) : null,
            ];
        });

        $activeCatalog = $mappedAll->where('is_active', true)->values();
        $archivedCatalog = $mappedAll->where('is_active', false)->values();

        $lowStockItems = $activeCatalog->where('is_low_stock', true)->values();
        $expiring30Items = $activeCatalog->filter(
            fn (array $item): bool => $item['days_to_expiry'] !== null && $item['days_to_expiry'] >= 0 && $item['days_to_expiry'] <= 30
        )->values();
        $expiring90Items = $activeCatalog->filter(
            fn (array $item): bool => $item['days_to_expiry'] !== null && $item['days_to_expiry'] >= 0 && $item['days_to_expiry'] <= 90
        )->values();
        $expiredItems = $mappedAll->where('expired_stock', '>', 0)->values();

        $filteredMedicines = match ($filter) {
            'low_stock' => $lowStockItems,
            'expiring' => $expiring30Items,
            'expiring_90' => $expiring90Items,
            'expired' => $expiredItems,
            'archived' => $archivedCatalog,
            default => $activeCatalog,
        };

        $batchStatsQuery = MedicineBatch::query()
            ->when($branchFilterId !== null, fn ($q) => $q->where('branch_id', $branchFilterId));

        $expiredBatchCount = (clone $batchStatsQuery)
            ->where('quantity_available', '>', 0)
            ->whereDate('expiry_date', '<', today()->toDateString())
            ->whereNotIn('status', [BatchStatus::DAMAGED->value, BatchStatus::DISPOSED->value])
            ->count();

        $expiring60Count = (clone $batchStatsQuery)
            ->where('status', BatchStatus::ACTIVE->value)
            ->where('quantity_available', '>', 0)
            ->whereDate('expiry_date', '>=', today()->toDateString())
            ->whereDate('expiry_date', '<=', now()->addDays(60)->toDateString())
            ->count();

        return Inertia::render('Inventory/Index', [
            'medicines' => $filteredMedicines->values(),
            'categories' => MedicineCategory::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'suppliers' => Supplier::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'branches' => $branchScope['branches'],
            'filters' => [
                'q' => $search,
                'filter' => $filter,
                'category_id' => $categoryId ? (string) $categoryId : '',
                'branch_id' => $branchScope['selectedBranchId'],
            ],
            'activeBranchName' => $branchScope['scopeLabel'],
            'tabCounts' => [
                'all' => $activeCatalog->count(),
                'low_stock' => $lowStockItems->count(),
                'expiring' => $expiring30Items->count(),
                'expiring_90' => $expiring90Items->count(),
                'expired' => $expiredItems->count(),
                'archived' => $archivedCatalog->count(),
            ],
            'metrics' => [
                'totalSkus' => $activeCatalog->count(),
                'totalSellableUnits' => (int) $activeCatalog->sum('available_stock'),
                'lowStockCount' => $lowStockItems->count(),
                'expiring30Count' => $expiring30Items->count(),
                'expiring60Count' => $expiring60Count,
                'expiring90Count' => $expiring90Items->count(),
                'expiredBatchCount' => $expiredBatchCount,
                'purchaseValuation' => round((float) $activeCatalog->sum('stock_purchase_value'), 2),
                'retailValuation' => round((float) $activeCatalog->sum('stock_retail_value'), 2),
                'expiredValuation' => round((float) $mappedAll->sum('expired_stock_value'), 2),
                'archivedCount' => $archivedCatalog->count(),
            ],
        ]);
    }

    public function batches(Request $request, TenantContext $tenantContext): Response
    {
        $branchScope = $this->resolveBranchScope($request, $tenantContext);
        $branchFilterId = $branchScope['branchFilterId'];

        $search = trim((string) $request->query('q', ''));
        $statusFilter = (string) $request->query('status', 'all');
        $supplierId = $request->query('supplier_id');

        $baseQuery = MedicineBatch::query()
            ->when($branchFilterId !== null, fn ($q) => $q->where('branch_id', $branchFilterId));

        $canViewCost = $request->user()->isSuperAdmin() || $request->user()->hasPermission('cost_price.view');

        $summary = [
            'activeBatches' => (clone $baseQuery)->sellable()->count(),
            'expiring30' => (clone $baseQuery)->sellable()->whereDate('expiry_date', '<=', now()->addDays(30)->toDateString())->count(),
            'expiring60' => (clone $baseQuery)->sellable()->whereDate('expiry_date', '<=', now()->addDays(60)->toDateString())->count(),
            'expiring90' => (clone $baseQuery)->sellable()->whereDate('expiry_date', '<=', now()->addDays(90)->toDateString())->count(),
            'expiredCount' => (clone $baseQuery)
                ->where('quantity_available', '>', 0)
                ->whereDate('expiry_date', '<', today()->toDateString())
                ->whereNotIn('status', [BatchStatus::DAMAGED->value, BatchStatus::DISPOSED->value])
                ->count(),
            'expiredLossValue' => $canViewCost ? round((float) ((clone $baseQuery)
                ->where('quantity_available', '>', 0)
                ->whereDate('expiry_date', '<', today()->toDateString())
                ->whereNotIn('status', [BatchStatus::DAMAGED->value, BatchStatus::DISPOSED->value])
                ->selectRaw('COALESCE(SUM(quantity_available * purchase_price), 0) as total')
                ->value('total')), 2) : 0,
            'activeCostValue' => $canViewCost ? round((float) ((clone $baseQuery)
                ->sellable()
                ->selectRaw('COALESCE(SUM(quantity_available * purchase_price), 0) as total')
                ->value('total')), 2) : 0,
        ];

        $query = (clone $baseQuery)
            ->with([
                'medicine:id,name,generic_name,sku,unit,units_per_box,requires_prescription,is_active',
                'branch:id,name,code',
                'supplier:id,name',
                'disposer:id,name',
            ])
            ->when($search !== '', function ($q) use ($search): void {
                $needle = mb_strtolower($search);
                $q->where(function ($sub) use ($needle): void {
                    $sub->whereRaw('LOWER(batch_number) LIKE ?', ["%{$needle}%"])
                        ->orWhereHas('medicine', function ($medQuery) use ($needle): void {
                            $medQuery->whereRaw('LOWER(name) LIKE ?', ["%{$needle}%"])
                                ->orWhereRaw('LOWER(COALESCE(generic_name, \'\')) LIKE ?', ["%{$needle}%"])
                                ->orWhereRaw('LOWER(sku) LIKE ?', ["%{$needle}%"]);
                        });
                });
            })
            ->when($supplierId, fn ($q) => $q->where('supplier_id', (int) $supplierId));

        match ($statusFilter) {
            'active' => $query->sellable(),
            'expiring_30' => $query->sellable()->whereDate('expiry_date', '<=', now()->addDays(30)->toDateString()),
            'expiring_60' => $query->sellable()->whereDate('expiry_date', '<=', now()->addDays(60)->toDateString()),
            'expiring_90' => $query->sellable()->whereDate('expiry_date', '<=', now()->addDays(90)->toDateString()),
            'expired' => $query->where('quantity_available', '>', 0)
                ->whereDate('expiry_date', '<', today()->toDateString())
                ->whereNotIn('status', [BatchStatus::DAMAGED->value, BatchStatus::DISPOSED->value]),
            'damaged_disposed' => $query->whereIn('status', [BatchStatus::DAMAGED->value, BatchStatus::DISPOSED->value]),
            'depleted' => $query->where('status', BatchStatus::DEPLETED->value),
            default => null,
        };

        $today = now()->startOfDay();
        $paginated = $query
            ->orderBy('expiry_date')
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString()
            ->through(function (MedicineBatch $batch) use ($today, $canViewCost): array {
                $daysRemaining = $batch->expiry_date
                    ? (int) $today->diffInDays($batch->expiry_date, false)
                    : null;
                $isExpiredDate = $daysRemaining !== null && $daysRemaining < 0;

                return [
                    'id' => $batch->id,
                    'medicine_id' => $batch->medicine_id,
                    'medicine_name' => $batch->medicine?->name ?? 'Unknown Medicine',
                    'medicine_sku' => $batch->medicine?->sku ?? '',
                    'unit' => $batch->medicine?->unit ?? 'Pcs',
                    'branch_id' => $batch->branch_id,
                    'branch_name' => $batch->branch?->name ?? 'Branch',
                    'branch_code' => $batch->branch?->code ?? '',
                    'supplier_name' => $batch->supplier?->name,
                    'batch_number' => $batch->batch_number,
                    'manufacturing_date' => $batch->manufacturing_date?->toDateString(),
                    'expiry_date' => $batch->expiry_date?->toDateString(),
                    'days_remaining' => $daysRemaining,
                    'is_expired' => $batch->isExpired(),
                    'effective_status' => $isExpiredDate && $batch->status === BatchStatus::ACTIVE->value
                        ? BatchStatus::EXPIRED->value
                        : $batch->status,
                    'quantity_received' => (int) $batch->quantity_received,
                    'quantity_available' => (int) $batch->quantity_available,
                    'purchase_price' => $canViewCost ? (float) $batch->purchase_price : null,
                    'selling_price' => (float) $batch->selling_price,
                    'stock_cost_value' => $canViewCost ? round((int) $batch->quantity_available * (float) $batch->purchase_price, 2) : null,
                    'rack_location' => $batch->rack_location,
                    'status' => $batch->status,
                    'disposal_reason' => $batch->disposal_reason,
                    'disposed_at' => $batch->disposed_at?->format('d M Y H:i'),
                    'disposed_by_name' => $batch->disposer?->name,
                    'notes' => $batch->notes,
                ];
            });

        return Inertia::render('Inventory/Batches', [
            'batches' => $paginated,
            'summary' => $summary,
            'branches' => $branchScope['branches'],
            'suppliers' => Supplier::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'activeBranchName' => $branchScope['scopeLabel'],
            'filters' => [
                'q' => $search,
                'status' => $statusFilter,
                'branch_id' => $branchScope['selectedBranchId'],
                'supplier_id' => $supplierId ? (string) $supplierId : '',
            ],
        ]);
    }

    public function movements(Request $request, TenantContext $tenantContext): Response
    {
        $branchScope = $this->resolveBranchScope($request, $tenantContext);
        $branchFilterId = $branchScope['branchFilterId'];

        $search = trim((string) $request->query('q', ''));
        $movementType = (string) $request->query('movement_type', '');
        $dateFrom = (string) $request->query('date_from', '');
        $dateTo = (string) $request->query('date_to', '');

        $filteredQuery = StockMovement::query()
            ->when($branchFilterId !== null, fn ($q) => $q->where('branch_id', $branchFilterId))
            ->when($movementType !== '', fn ($q) => $q->where('movement_type', $movementType))
            ->when($dateFrom !== '', fn ($q) => $q->whereDate('occurred_at', '>=', $dateFrom))
            ->when($dateTo !== '', fn ($q) => $q->whereDate('occurred_at', '<=', $dateTo))
            ->when($search !== '', function ($q) use ($search): void {
                $needle = mb_strtolower($search);
                $q->where(function ($sub) use ($needle): void {
                    $sub->whereRaw('LOWER(COALESCE(reason, \'\')) LIKE ?', ["%{$needle}%"])
                        ->orWhereHas('medicine', function ($medQuery) use ($needle): void {
                            $medQuery->withTrashed()
                                ->whereRaw('LOWER(name) LIKE ?', ["%{$needle}%"])
                                ->orWhereRaw('LOWER(sku) LIKE ?', ["%{$needle}%"]);
                        })
                        ->orWhereHas('batch', function ($batchQuery) use ($needle): void {
                            $batchQuery->whereRaw('LOWER(batch_number) LIKE ?', ["%{$needle}%"]);
                        });
                });
            });

        $summary = [
            'totalRecords' => (int) (clone $filteredQuery)->count(),
            'inboundUnits' => (int) (clone $filteredQuery)->where('quantity_change', '>', 0)->sum('quantity_change'),
            'outboundUnits' => (int) abs((int) (clone $filteredQuery)->where('quantity_change', '<', 0)->sum('quantity_change')),
            'totalCostMoved' => round((float) (clone $filteredQuery)->sum('total_cost'), 2),
        ];

        $movements = $filteredQuery
            ->with([
                'medicine:id,name,sku,unit,deleted_at',
                'branch:id,name,code',
                'batch:id,batch_number,expiry_date',
                'user:id,name',
            ])
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate(30)
            ->withQueryString()
            ->through(function (StockMovement $movement): array {
                $enum = StockMovementType::tryFrom($movement->movement_type);

                return [
                    'id' => $movement->id,
                    'occurred_at' => $movement->occurred_at?->format('d M Y, h:i A'),
                    'medicine_id' => $movement->medicine_id,
                    'medicine_name' => $movement->medicine?->name ?? 'Archived Medicine',
                    'medicine_sku' => $movement->medicine?->sku ?? '',
                    'unit' => $movement->medicine?->unit ?? 'Pcs',
                    'batch_number' => $movement->batch?->batch_number ?? '—',
                    'branch_name' => $movement->branch?->name ?? 'Branch',
                    'branch_code' => $movement->branch?->code ?? '',
                    'movement_type' => $movement->movement_type,
                    'movement_label' => $enum?->label() ?? ucfirst(str_replace('_', ' ', $movement->movement_type)),
                    'direction' => $movement->quantity_change >= 0 ? 'in' : 'out',
                    'quantity_change' => (int) $movement->quantity_change,
                    'balance_before' => (int) $movement->balance_before,
                    'balance_after' => (int) $movement->balance_after,
                    'unit_cost' => (float) $movement->unit_cost,
                    'total_cost' => (float) $movement->total_cost,
                    'reason' => $movement->reason,
                    'notes' => $movement->notes,
                    'user_name' => $movement->user?->name ?? 'System',
                ];
            });

        return Inertia::render('Inventory/Movements', [
            'movements' => $movements,
            'summary' => $summary,
            'movementTypes' => StockMovementType::filterOptions(),
            'branches' => $branchScope['branches'],
            'activeBranchName' => $branchScope['scopeLabel'],
            'filters' => [
                'q' => $search,
                'movement_type' => $movementType,
                'branch_id' => $branchScope['selectedBranchId'],
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
        ]);
    }

    public function medicineBatches(int $medicineId, Request $request, TenantContext $tenantContext): JsonResponse
    {
        $medicine = Medicine::query()
            ->with('category:id,name')
            ->findOrFail($medicineId);

        $branchScope = $this->resolveBranchScope($request, $tenantContext);
        $branchFilterId = $branchScope['branchFilterId'];
        $today = now()->startOfDay();

        $batches = MedicineBatch::query()
            ->with(['branch:id,name,code', 'supplier:id,name', 'disposer:id,name'])
            ->where('medicine_id', $medicine->id)
            ->when($branchFilterId !== null, fn ($q) => $q->where('branch_id', $branchFilterId))
            ->orderBy('expiry_date')
            ->orderByDesc('id')
            ->get()
            ->map(function (MedicineBatch $batch) use ($today): array {
                $daysRemaining = $batch->expiry_date
                    ? (int) $today->diffInDays($batch->expiry_date, false)
                    : null;

                return [
                    'id' => $batch->id,
                    'batch_number' => $batch->batch_number,
                    'branch_id' => $batch->branch_id,
                    'branch_name' => $batch->branch?->name ?? 'Branch',
                    'branch_code' => $batch->branch?->code ?? '',
                    'supplier_id' => $batch->supplier_id,
                    'supplier_name' => $batch->supplier?->name,
                    'expiry_date' => $batch->expiry_date?->toDateString(),
                    'days_remaining' => $daysRemaining,
                    'is_expired' => $batch->isExpired(),
                    'effective_status' => ($daysRemaining !== null && $daysRemaining < 0 && $batch->status === BatchStatus::ACTIVE->value)
                        ? BatchStatus::EXPIRED->value
                        : $batch->status,
                    'status' => $batch->status,
                    'quantity_received' => (int) $batch->quantity_received,
                    'quantity_available' => (int) $batch->quantity_available,
                    'purchase_price' => (float) $batch->purchase_price,
                    'selling_price' => (float) $batch->selling_price,
                    'rack_location' => $batch->rack_location,
                    'disposal_reason' => $batch->disposal_reason,
                    'disposed_at' => $batch->disposed_at?->format('d M Y H:i'),
                    'disposed_by_name' => $batch->disposer?->name,
                    'notes' => $batch->notes,
                ];
            })
            ->values();

        $recentMovements = StockMovement::query()
            ->with(['batch:id,batch_number', 'user:id,name', 'branch:id,code'])
            ->where('medicine_id', $medicine->id)
            ->when($branchFilterId !== null, fn ($q) => $q->where('branch_id', $branchFilterId))
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->limit(20)
            ->get()
            ->map(function (StockMovement $movement): array {
                $enum = StockMovementType::tryFrom($movement->movement_type);

                return [
                    'id' => $movement->id,
                    'occurred_at' => $movement->occurred_at?->format('d M Y, h:i A'),
                    'batch_number' => $movement->batch?->batch_number ?? '—',
                    'branch_code' => $movement->branch?->code ?? '',
                    'movement_type' => $movement->movement_type,
                    'movement_label' => $enum?->label() ?? $movement->movement_type,
                    'quantity_change' => (int) $movement->quantity_change,
                    'balance_before' => (int) $movement->balance_before,
                    'balance_after' => (int) $movement->balance_after,
                    'unit_cost' => (float) $movement->unit_cost,
                    'total_cost' => (float) $movement->total_cost,
                    'reason' => $movement->reason,
                    'user_name' => $movement->user?->name ?? 'System',
                ];
            })
            ->values();

        return response()->json([
            'medicine' => [
                'id' => $medicine->id,
                'name' => $medicine->name,
                'sku' => $medicine->sku,
                'unit' => $medicine->unit,
                'units_per_box' => (int) ($medicine->units_per_box ?: 1),
            ],
            'batches' => $batches,
            'movements' => $recentMovements,
        ]);
    }

    public function store(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $branch = $tenantContext->branch();

        $subscription = $tenant?->subscriberSubscription();
        $maxMedicines = $subscription?->plan?->max_medicines ?? 500;

        if (Medicine::query()->count() >= $maxMedicines) {
            return back()->with('error', "Plan limit reached ({$maxMedicines} medicines). Upgrade your subscription to add more SKUs.");
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'sku' => [
                'required',
                'string',
                'max:64',
                Rule::unique('medicines', 'sku')->where('tenant_id', $tenant->id),
            ],
            'barcode' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('medicines', 'barcode')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at'),
            ],
            'category_id' => [
                'nullable',
                Rule::exists('medicine_categories', 'id')->where('tenant_id', $tenant->id),
            ],
            'supplier_id' => [
                'nullable',
                Rule::exists('suppliers', 'id')->where('tenant_id', $tenant->id),
            ],
            'dosage_form' => ['required', 'string', 'max:50'],
            'strength' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string', 'max:1000'],
            'unit' => ['required', 'string', 'max:32'],
            'units_per_strip' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'units_per_box' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'reorder_level' => ['required', 'integer', 'min:0'],
            'requires_prescription' => ['boolean'],
            'purchase_price' => ['required_without:box_purchase_price', 'nullable', 'numeric', 'min:0'],
            'box_purchase_price' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['required_without:box_selling_price', 'nullable', 'numeric', 'min:0'],
            'box_selling_price' => ['nullable', 'numeric', 'min:0'],
            'batch_number' => ['nullable', 'string', 'max:64'],
            'manufacturing_date' => ['nullable', 'date'],
            'quantity' => ['nullable', 'integer', 'min:0'],
            'expiry_date' => ['nullable', 'date'],
            'rack_location' => ['nullable', 'string', 'max:64'],
        ]);

        $this->inventoryService->createMedicine($tenant, $branch, $validated, $request->user());

        return back()->with('success', 'Medicine saved to tenant inventory catalog.');
    }

    public function update(Request $request, int $medicineId, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $medicine = Medicine::query()->findOrFail($medicineId);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'sku' => [
                'required',
                'string',
                'max:64',
                Rule::unique('medicines', 'sku')
                    ->where('tenant_id', $tenant->id)
                    ->ignore($medicine->id),
            ],
            'barcode' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('medicines', 'barcode')
                    ->where('tenant_id', $tenant->id)
                    ->whereNull('deleted_at')
                    ->ignore($medicine->id),
            ],
            'category_id' => [
                'nullable',
                Rule::exists('medicine_categories', 'id')->where('tenant_id', $tenant->id),
            ],
            'dosage_form' => ['required', 'string', 'max:50'],
            'strength' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string', 'max:1000'],
            'unit' => ['required', 'string', 'max:32'],
            'units_per_strip' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'units_per_box' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'reorder_level' => ['required', 'integer', 'min:0'],
            'requires_prescription' => ['boolean'],
            'purchase_price' => ['required_without:box_purchase_price', 'nullable', 'numeric', 'min:0'],
            'box_purchase_price' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['required_without:box_selling_price', 'nullable', 'numeric', 'min:0'],
            'box_selling_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $this->inventoryService->updateMedicine($medicine, $validated, $request->user());

        return back()->with('success', "Updated medicine \"{$medicine->name}\".");
    }

    public function toggleArchive(Request $request, int $medicineId): RedirectResponse
    {
        $medicine = Medicine::query()->findOrFail($medicineId);
        $updated = $this->inventoryService->toggleArchiveMedicine($medicine, $request->user());

        $verb = $updated->is_active ? 'restored to active catalog' : 'archived (historical transactions preserved)';

        return back()->with('success', "Medicine \"{$updated->name}\" {$verb}.");
    }

    public function storeCategory(Request $request, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $name = trim($validated['name']);
        $slug = Str::slug($name);
        if ($slug === '') {
            $slug = 'cat-'.Str::lower(Str::random(6));
        }

        if (MedicineCategory::query()->where('slug', $slug)->exists()) {
            return back()->with('error', "Category \"{$name}\" already exists.");
        }

        $category = MedicineCategory::query()->create([
            'name' => $name,
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'is_active' => true,
        ]);

        AuditLog::record(
            action: 'inventory.category_created',
            description: "Added medicine category \"{$category->name}\" for {$tenant->name}.",
            subject: $category,
        );

        return back()->with('success', "Category \"{$category->name}\" added.");
    }

    public function storeBatch(Request $request, int $medicineId, TenantContext $tenantContext): RedirectResponse
    {
        $tenant = $tenantContext->tenant();
        $medicine = Medicine::query()->findOrFail($medicineId);

        $validated = $request->validate([
            'branch_id' => [
                'nullable',
                'integer',
                Rule::exists('branches', 'id')
                    ->where('tenant_id', $tenant->id)
                    ->where('is_active', true),
            ],
            'supplier_id' => [
                'nullable',
                'integer',
                Rule::exists('suppliers', 'id')->where('tenant_id', $tenant->id),
            ],
            'batch_number' => ['required', 'string', 'max:64'],
            'manufacturing_date' => ['nullable', 'date'],
            'quantity' => ['required', 'integer', 'min:1'],
            'expiry_date' => ['required', 'date', 'after_or_equal:today'],
            'purchase_price' => ['nullable', 'numeric', 'min:0'],
            'box_purchase_price' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'box_selling_price' => ['nullable', 'numeric', 'min:0'],
            'rack_location' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $targetBranch = ! empty($validated['branch_id'])
            ? Branch::query()->findOrFail((int) $validated['branch_id'])
            : $tenantContext->branch();

        if (! $targetBranch) {
            return back()->with('error', 'Select an active branch before adding a stock batch.');
        }

        $batch = $this->inventoryService->addBatch(
            branch: $targetBranch,
            medicine: $medicine,
            validated: $validated,
            movementType: StockMovementType::RESTOCK,
            actor: $request->user(),
        );

        return back()->with('success', "Restocked batch {$batch->batch_number} (+{$batch->quantity_received} {$medicine->unit}) in {$targetBranch->name}.");
    }

    public function adjustBatch(Request $request, int $batchId): RedirectResponse
    {
        $batch = MedicineBatch::query()->findOrFail($batchId);

        $validated = $request->validate([
            'adjustment_type' => [
                'required',
                Rule::in([
                    StockMovementType::ADJUSTMENT_IN->value,
                    StockMovementType::ADJUSTMENT_OUT->value,
                    StockMovementType::DAMAGE->value,
                    StockMovementType::EXPIRY_DISPOSAL->value,
                    StockMovementType::SUPPLIER_RETURN->value,
                ]),
            ],
            'quantity' => ['nullable', 'integer', 'min:0'],
            'dispose_entire_batch' => ['boolean'],
            'reason' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $movementType = StockMovementType::from($validated['adjustment_type']);
        $disposeAll = (bool) ($validated['dispose_entire_batch'] ?? false);

        if (! $disposeAll && (int) ($validated['quantity'] ?? 0) < 1) {
            return back()->withErrors([
                'quantity' => 'Enter a valid quantity of at least 1 unit (or dispose the full remaining batch).',
            ]);
        }

        $updated = $this->inventoryService->adjustBatch(
            batch: $batch,
            movementType: $movementType,
            quantity: (int) ($validated['quantity'] ?? 0),
            reason: $validated['reason'],
            notes: $validated['notes'] ?? null,
            actor: $request->user(),
            disposeEntireBatch: $disposeAll,
        );

        return back()->with('success', "Updated batch {$updated->batch_number} ({$updated->quantity_available} remaining · status: {$updated->status}).");
    }

    public function transferBatch(Request $request, int $batchId): RedirectResponse
    {
        $batch = MedicineBatch::query()->findOrFail($batchId);

        $validated = $request->validate([
            'target_branch_id' => [
                'required',
                'integer',
                Rule::exists('branches', 'id')->where('tenant_id', $batch->tenant_id),
            ],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $targetBranch = Branch::query()->findOrFail((int) $validated['target_branch_id']);

        $res = $this->inventoryService->transferBatchStock(
            sourceBatch: $batch,
            targetBranch: $targetBranch,
            quantity: (int) $validated['quantity'],
            reason: $validated['reason'] ?? null,
            notes: $validated['notes'] ?? null,
            actor: $request->user(),
        );

        return back()->with('success', "Transferred {$validated['quantity']} units to {$targetBranch->name}.");
    }

    /**
     * Resolve branch filter within the current tenant context strictly.
     *
     * @return array{
     *     selectedBranchId: string,
     *     branchFilterId: ?int,
     *     scopeLabel: string,
     *     branches: Collection<int, Branch>
     * }
     */
    private function resolveBranchScope(Request $request, TenantContext $tenantContext): array
    {
        $branches = Branch::query()
            ->where('is_active', true)
            ->orderByDesc('is_head_office')
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'is_head_office']);

        $requested = $request->query('branch_id');
        if ($requested === 'all') {
            return [
                'selectedBranchId' => 'all',
                'branchFilterId' => null,
                'scopeLabel' => 'All Active Branches',
                'branches' => $branches,
            ];
        }

        if ($requested !== null && $requested !== '') {
            $matched = $branches->firstWhere('id', (int) $requested);
            if ($matched) {
                return [
                    'selectedBranchId' => (string) $matched->id,
                    'branchFilterId' => (int) $matched->id,
                    'scopeLabel' => $matched->name,
                    'branches' => $branches,
                ];
            }
        }

        $activeBranch = $tenantContext->branch();

        return [
            'selectedBranchId' => $activeBranch ? (string) $activeBranch->id : 'all',
            'branchFilterId' => $activeBranch?->id,
            'scopeLabel' => $activeBranch?->name ?? 'All Active Branches',
            'branches' => $branches,
        ];
    }
}
