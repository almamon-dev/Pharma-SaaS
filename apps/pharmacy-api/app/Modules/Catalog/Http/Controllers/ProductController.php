<?php

namespace App\Modules\Catalog\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\ProductBarcode;
use App\Modules\Catalog\Models\ProductBranchSetting;
use App\Modules\Catalog\Services\InternalBarcodeGenerator;
use App\Modules\Catalog\Services\ProductSearchService;
use App\Modules\Catalog\Services\ProductService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ProductController extends Controller
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected ProductService $productService,
        protected InternalBarcodeGenerator $barcodeGenerator,
        protected FeatureManager $featureManager
    ) {}

    /**
     * Inertia UI view for Catalog management.
     */
    public function uiIndex(Request $request): \Inertia\Response
    {
        Gate::authorize('product.view');

        $tenant = $this->tenantContext->tenant();
        $branch = $this->tenantContext->branch();
        $user = $request->user();
        if ($tenant) {
            $this->featureManager->setTenant($tenant);
        }

        // Salesman / view-only catalog roles receive the dedicated sales-focused Product Catalog
        $isViewOnlyCatalog = ! Gate::allows('product.manage')
            || ($this->tenantContext->hasRole('salesman') && ! $user?->isSubscriberAdmin() && ! $this->tenantContext->hasRole(['admin', 'manager']));

        if ($isViewOnlyCatalog && $tenant) {
            return $this->renderSalesmanCatalog($tenant, $branch, $user);
        }

        $limit = $this->featureManager->limit('max_products');
        $used = $this->featureManager->used('max_products');
        $isUnlimited = $limit === null;
        $allowed = $isUnlimited || $used < $limit;

        $canImport = $this->featureManager->can('import_export');
        $canExport = $this->featureManager->can('import_export');
        $canPrintLabels = $this->featureManager->can('barcode_labels');

        $categories = \App\Modules\Catalog\Models\Category::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name', 'name_bn', 'is_active']);

        $companies = \App\Modules\Catalog\Models\Company::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get(['id', 'name', 'name_bn', 'is_active']);

        $generics = \App\Modules\Catalog\Models\Generic::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get(['id', 'name', 'is_active']);

        $branches = $tenant->branches()->where('is_active', true)->get(['id', 'name', 'code']);

        $rawStats = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->selectRaw("
                COUNT(*) as total_all,
                COUNT(CASE WHEN type = 'medicine' THEN 1 END) as total_medicine,
                COUNT(CASE WHEN type <> 'medicine' THEN 1 END) as total_non_medicine,
                COUNT(CASE WHEN is_active = true THEN 1 END) as total_active,
                COUNT(CASE WHEN is_active = false THEN 1 END) as total_inactive
            ")
            ->first();

        return inertia('Catalog/Index', [
            'categories' => $categories,
            'companies' => $companies,
            'generics' => $generics,
            'branches' => $branches,
            'productStats' => [
                'all' => (int) ($rawStats->total_all ?? 0),
                'medicine' => (int) ($rawStats->total_medicine ?? 0),
                'non_medicine' => (int) ($rawStats->total_non_medicine ?? 0),
                'active' => (int) ($rawStats->total_active ?? 0),
                'inactive' => (int) ($rawStats->total_inactive ?? 0),
            ],
            'planLimit' => [
                'allowed' => $allowed,
                'used' => $used,
                'limit' => $limit ?? 0,
                'isUnlimited' => $isUnlimited,
            ],
            'canImport' => $canImport,
            'canExport' => $canExport,
            'canPrintLabels' => $canPrintLabels,
        ]);
    }

    /**
     * Render the view-only Salesman Product Catalog with live stock, FEFO expiry, offers,
     * contract pricing tiers, product details, and generic alternatives.
     */
    protected function renderSalesmanCatalog(
        \App\Models\Tenant $tenant,
        ?\App\Models\Branch $branch,
        ?\App\Models\User $user
    ): \Inertia\Response {
        $today = now()->startOfDay();
        $settings = is_array($tenant->settings) ? $tenant->settings : [];
        $showExactStock = (bool) ($settings['salesman_show_exact_stock'] ?? false);

        $medicines = \App\Models\Medicine::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->with([
                'batches' => function ($q) use ($branch, $today): void {
                    $q->when($branch, fn ($sub) => $sub->where('branch_id', $branch->id))
                        ->where('status', 'active')
                        ->where('quantity_available', '>', 0)
                        ->whereDate('expiry_date', '>=', $today)
                        ->orderBy('expiry_date');
                },
            ])
            ->orderBy('name')
            ->get();

        // Map any active product-level discount rules by SKU/name
        $catalogProducts = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->get(['sku', 'name', 'name_bn', 'default_discount_type', 'default_discount_value']);

        $catalogBySku = $catalogProducts->filter(fn ($p) => ! empty($p->sku))->keyBy('sku');

        $items = $medicines->map(function (\App\Models\Medicine $m) use ($today, $showExactStock, $catalogBySku): array {
            $activeBatches = $m->batches;
            $totalStock = (int) $activeBatches->sum('quantity_available');
            $reorderLevel = max(10, (int) ($m->reorder_level ?: 15));

            $stockStatus = match (true) {
                $totalStock <= 0 => 'out_of_stock',
                $totalStock <= $reorderLevel => 'low_stock',
                default => 'in_stock',
            };

            $nearestBatch = $activeBatches->first();
            $nearestExpiry = $nearestBatch?->expiry_date;
            $daysToExpiry = $nearestExpiry ? (int) $today->diffInDays($nearestExpiry, false) : null;
            $expiryAlert = match (true) {
                $daysToExpiry === null => 'none',
                $daysToExpiry <= 30 => 'critical',
                $daysToExpiry <= 90 => 'warning',
                default => 'ok',
            };

            $mrp = (float) ($m->default_selling_price ?? 0);
            $tradePrice = (float) ($m->default_purchase_price ?? 0);
            if ($tradePrice <= 0 && $mrp > 0) {
                $tradePrice = round($mrp * 0.88, 2);
            }

            $unitsPerStrip = (int) ($m->units_per_strip ?: 0);
            $unitsPerBox = (int) ($m->units_per_box ?: 0);
            $boxPrice = (float) ($m->box_selling_price ?? 0);

            // Detect active discount or box-rate offer
            $matchedProduct = $m->sku ? $catalogBySku->get($m->sku) : null;
            $offerLabel = null;
            $offerDiscountPct = 0.0;

            if ($matchedProduct && (float) $matchedProduct->default_discount_value > 0) {
                $val = (float) $matchedProduct->default_discount_value;
                if ($matchedProduct->default_discount_type === 'percentage') {
                    $offerDiscountPct = $val;
                    $offerLabel = "{$val}% Off";
                } else {
                    $offerLabel = "৳{$val} Off";
                }
            } elseif ($boxPrice > 0 && $unitsPerBox > 1 && $mrp > 0) {
                $regularBox = $mrp * $unitsPerBox;
                if ($boxPrice < $regularBox) {
                    $savePct = round((($regularBox - $boxPrice) / $regularBox) * 100, 1);
                    if ($savePct >= 1) {
                        $offerDiscountPct = $savePct;
                        $offerLabel = "Box Save {$savePct}%";
                    }
                }
            }

            $formLower = strtolower((string) ($m->dosage_form ?? ''));
            $storageRule = match (true) {
                str_contains($formLower, 'insulin') || str_contains($formLower, 'injection') || str_contains($formLower, 'vaccine') => 'Cold chain: Store at 2°C – 8°C (Refrigerated, do not freeze)',
                str_contains($formLower, 'syrup') || str_contains($formLower, 'drop') || str_contains($formLower, 'suspension') => 'Cool & dry place below 25°C. Keep tightly closed.',
                str_contains($formLower, 'device') || str_contains($formLower, 'surgical') => 'Store in dry, dust-free area at room temperature.',
                default => 'Store below 30°C in a dry place, away from direct sunlight.',
            };

            $packParts = [];
            if ($unitsPerStrip > 0) {
                $packParts[] = "{$unitsPerStrip} {$m->unit}/strip";
            }
            if ($unitsPerBox > 0) {
                $packParts[] = "{$unitsPerBox} {$m->unit}/box";
            }
            $packSize = ! empty($packParts) ? implode(' · ', $packParts) : "1 {$m->unit}";

            return [
                'id' => $m->id,
                'name' => $m->name,
                'name_bn' => $matchedProduct?->name_bn,
                'generic_name' => $m->generic_name ?: 'General',
                'company' => $m->manufacturer ?: 'Standard Pharma',
                'dosage_form' => $m->dosage_form ?: 'Medicine',
                'strength' => $m->strength,
                'unit' => $m->unit ?: 'pcs',
                'pack_size' => $packSize,
                'sku' => $m->sku,
                'barcode' => $m->barcode,
                'requires_prescription' => (bool) $m->requires_prescription,
                'mrp' => round($mrp, 2),
                'trade_price' => round($tradePrice, 2),
                'box_price' => $boxPrice > 0 ? round($boxPrice, 2) : null,
                'stock_status' => $stockStatus,
                'stock_qty' => $showExactStock ? $totalStock : null,
                'nearest_expiry' => $nearestExpiry?->format('d M Y'),
                'days_to_expiry' => $daysToExpiry,
                'expiry_alert' => $expiryAlert,
                'rack_location' => $nearestBatch?->rack_location,
                'storage_rule' => $storageRule,
                'description' => $m->description,
                'offer_label' => $offerLabel,
                'offer_discount_pct' => $offerDiscountPct,
            ];
        })->values();

        $customers = \App\Models\Customer::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->limit(100)
            ->get(['id', 'name', 'customer_type', 'phone'])
            ->map(function ($c): array {
                $type = strtolower((string) ($c->customer_type ?: 'retail'));
                $contractPct = match ($type) {
                    'hospital', 'corporate', 'institutional' => 8.0,
                    'wholesale', 'pharmacy', 'clinic' => 5.0,
                    default => 0.0,
                };

                return [
                    'id' => $c->id,
                    'name' => $c->name,
                    'customer_type' => $c->customer_type ?: 'Retail',
                    'contract_discount_pct' => $contractPct,
                ];
            })->values();

        return inertia('Catalog/SalesmanCatalog', [
            'products' => $items,
            'customers' => $customers,
            'showExactStock' => $showExactStock,
            'branchName' => $branch?->name,
            'currency' => $tenant->currency_code ?? 'BDT',
            'tenantId' => $tenant->id,
            'userId' => $user?->id,
        ]);
    }

    /**
     * List products with server-side filters, sorting, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('product.view');

        $tenant = $this->tenantContext->tenant();
        $query = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at');

        // Filters
        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->query('category_id'));
        }
        if ($request->filled('company_id')) {
            $query->where('company_id', $request->query('company_id'));
        }
        if ($request->filled('generic_id')) {
            $query->where('generic_id', $request->query('generic_id'));
        }
        if ($request->has('is_active') && $request->query('is_active') !== '') {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->has('is_controlled') && $request->query('is_controlled') !== '') {
            $query->where('is_controlled', filter_var($request->query('is_controlled'), FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->filled('import_job_id')) {
            $query->where('import_job_id', $request->query('import_job_id'));
        }
        if ($request->filled('created_from')) {
            $query->whereDate('created_at', '>=', $request->query('created_from'));
        }
        if ($request->filled('created_to')) {
            $query->whereDate('created_at', '<=', $request->query('created_to'));
        }
        if ($request->has('has_barcode') && $request->query('has_barcode') !== '') {
            $hasBc = filter_var($request->query('has_barcode'), FILTER_VALIDATE_BOOLEAN);
            if ($hasBc) {
                $query->has('barcodes');
            } else {
                $query->doesntHave('barcodes');
            }
        }
        if ($request->filled('q')) {
            $search = mb_strtolower(trim($request->query('q')), 'UTF-8');
            $query->where('search_text', 'LIKE', "%{$search}%");
        }

        // Sorting
        $sortBy = $request->query('sort_by', 'created_at');
        $sortOrder = $request->query('sort_order', 'desc');
        $allowedSorts = ['name', 'created_at', 'sku', 'strength', 'dosage_form'];
        if (in_array($sortBy, $allowedSorts, true)) {
            $query->orderBy($sortBy, $sortOrder === 'asc' ? 'asc' : 'desc');
        } else {
            $query->latest('id');
        }

        $perPage = max(10, min(100, (int) $request->query('per_page', 25)));
        $products = $query->with(['generic', 'company', 'category', 'units', 'barcodes'])
            ->paginate($perPage);

        return response()->json($products);
    }

    /**
     * Store new product.
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('product.manage');

        $validated = $request->validate([
            'type' => 'required|string|in:medicine,non_medicine',
            'name' => 'required|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'generic_id' => 'nullable|uuid',
            'company_id' => 'nullable|uuid',
            'category_id' => 'nullable|uuid',
            'strength' => 'nullable|string|max:100',
            'dosage_form' => 'nullable|string|max:100',
            'sku' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'base_unit' => 'nullable|string|max:50',
            'mrp' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'track_batch' => 'nullable|boolean',
            'is_controlled' => 'nullable|boolean',
            'default_discount_type' => 'nullable|string|in:percent,fixed',
            'default_discount_value' => 'nullable|numeric|min:0',
            'vat_rate' => 'nullable|numeric|min:0|max:100',
            'is_active' => 'nullable|boolean',
            'units' => 'nullable|array',
            'units.*.unit_name' => 'required_with:units|string',
            'units.*.conversion_to_base' => 'required_with:units|integer|min:1',
            'units.*.is_sale_unit' => 'nullable|boolean',
            'units.*.is_purchase_unit' => 'nullable|boolean',
            'units.*.is_default_sale' => 'nullable|boolean',
            'barcodes' => 'nullable|array',
            'branch_settings' => 'nullable|array',
        ]);

        $res = $this->productService->create($validated, $request->user());

        return response()->json([
            'message' => "Product '{$res['product']->displayName()}' created successfully.",
            'product' => $res['product'],
            'warnings' => $res['warnings'],
        ], 201);
    }

    /**
     * Show single product details.
     */
    public function show(string $id): JsonResponse
    {
        Gate::authorize('product.view');

        $tenant = $this->tenantContext->tenant();
        $product = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->with(['generic', 'company', 'category', 'units', 'barcodes', 'branchSettings'])
            ->findOrFail($id);

        return response()->json($product);
    }

    /**
     * Update product.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $product = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->findOrFail($id);

        $validated = $request->validate([
            'type' => 'sometimes|string|in:medicine,non_medicine',
            'name' => 'sometimes|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'generic_id' => 'nullable|uuid',
            'company_id' => 'nullable|uuid',
            'category_id' => 'nullable|uuid',
            'strength' => 'nullable|string|max:100',
            'dosage_form' => 'nullable|string|max:100',
            'sku' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'base_unit' => 'sometimes|string|max:50',
            'mrp' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'track_batch' => 'nullable|boolean',
            'is_controlled' => 'nullable|boolean',
            'default_discount_type' => 'nullable|string|in:percent,fixed',
            'default_discount_value' => 'nullable|numeric|min:0',
            'vat_rate' => 'nullable|numeric|min:0|max:100',
            'is_active' => 'nullable|boolean',
            'units' => 'nullable|array',
            'barcodes' => 'nullable|array',
            'branch_settings' => 'nullable|array',
        ]);

        $res = $this->productService->update($product, $validated, $request->user());

        return response()->json([
            'message' => "Product '{$res['product']->displayName()}' updated successfully.",
            'product' => $res['product'],
            'warnings' => $res['warnings'],
        ]);
    }

    /**
     * Soft delete product.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.delete');

        $tenant = $this->tenantContext->tenant();
        $product = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->findOrFail($id);

        $this->productService->delete($product, $request->user());

        return response()->json([
            'message' => "Product '{$product->displayName()}' deleted successfully.",
        ]);
    }

    public function activate(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $product = Product::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);
        $this->productService->activate($product, $request->user());

        return response()->json(['message' => "Product activated.", 'product' => $product]);
    }

    public function deactivate(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $product = Product::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);
        $this->productService->deactivate($product, $request->user());

        return response()->json(['message' => "Product deactivated.", 'product' => $product]);
    }

    /**
     * Bulk actions across multiple products.
     */
    public function bulk(Request $request): JsonResponse
    {
        Gate::authorize('product.manage');

        $validated = $request->validate([
            'action' => 'required|string|in:activate,deactivate,set_category,set_company',
            'product_ids' => 'required|array|min:1',
            'product_ids.*' => 'required|uuid',
            'category_id' => 'required_if:action,set_category|nullable|uuid',
            'company_id' => 'required_if:action,set_company|nullable|uuid',
        ]);

        $tenant = $this->tenantContext->tenant();
        $products = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereIn('id', $validated['product_ids'])
            ->whereNull('deleted_at')
            ->get();

        $action = $validated['action'];
        $results = [];

        foreach ($products as $p) {
            try {
                match ($action) {
                    'activate' => $this->productService->activate($p, $request->user()),
                    'deactivate' => $this->productService->deactivate($p, $request->user()),
                    'set_category' => $this->productService->update($p, ['category_id' => $validated['category_id']], $request->user()),
                    'set_company' => $this->productService->update($p, ['company_id' => $validated['company_id']], $request->user()),
                };
                $results[] = ['id' => $p->id, 'status' => 'ok'];
            } catch (\Throwable $e) {
                $results[] = ['id' => $p->id, 'status' => 'error', 'message' => $e->getMessage()];
            }
        }

        return response()->json([
            'message' => "Bulk action '{$action}' processed for ".count($products)." products.",
            'results' => $results,
        ]);
    }

    /**
     * Get branch settings for product.
     */
    public function getBranchSettings(string $id): JsonResponse
    {
        Gate::authorize('product.view');

        $tenant = $this->tenantContext->tenant();
        $settings = ProductBranchSetting::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('product_id', $id)
            ->with('branch')
            ->get();

        return response()->json($settings);
    }

    /**
     * Update branch settings for product.
     */
    public function updateBranchSettings(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.branch_id' => 'required|integer',
            'settings.*.min_stock' => 'nullable|integer|min:0',
            'settings.*.reorder_qty' => 'nullable|integer|min:0',
            'settings.*.shelf_location' => 'nullable|string|max:100',
        ]);

        $tenant = $this->tenantContext->tenant();
        $product = Product::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);

        foreach ($validated['settings'] as $bs) {
            ProductBranchSetting::updateOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'product_id' => $product->id,
                    'branch_id' => $bs['branch_id'],
                ],
                [
                    'min_stock' => (int) ($bs['min_stock'] ?? 0),
                    'reorder_qty' => (int) ($bs['reorder_qty'] ?? 0),
                    'shelf_location' => $bs['shelf_location'] ?? null,
                ]
            );
        }

        return response()->json(['message' => 'Branch settings updated.']);
    }

    /**
     * Add single barcode to product.
     */
    public function storeBarcode(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $validated = $request->validate([
            'barcode' => 'required|string|max:100',
            'source' => 'nullable|string|in:manufacturer,internal',
        ]);

        $tenant = $this->tenantContext->tenant();
        $product = Product::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);

        $exists = ProductBarcode::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('barcode', $validated['barcode'])
            ->exists();

        if ($exists) {
            return response()->json(['message' => "Barcode '{$validated['barcode']}' is already assigned to a product."], 422);
        }

        $barcode = ProductBarcode::create([
            'tenant_id' => $tenant->id,
            'product_id' => $product->id,
            'barcode' => $validated['barcode'],
            'source' => $validated['source'] ?? 'manufacturer',
        ]);

        return response()->json(['message' => 'Barcode added.', 'barcode' => $barcode], 201);
    }

    /**
     * Delete barcode from product.
     */
    public function deleteBarcode(string $id, string $barcodeId): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $bc = ProductBarcode::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('product_id', $id)
            ->findOrFail($barcodeId);

        $bc->delete();

        return response()->json(['message' => 'Barcode deleted.']);
    }

    /**
     * Generate unique internal EAN-13 barcode for a single product.
     */
    public function generateInternalBarcode(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $product = Product::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);

        $barcode = $this->barcodeGenerator->generateForTenant($tenant->id);

        $newBc = ProductBarcode::create([
            'tenant_id' => $tenant->id,
            'product_id' => $product->id,
            'barcode' => $barcode,
            'source' => 'internal',
        ]);

        return response()->json([
            'message' => "Generated internal barcode {$barcode}.",
            'barcode' => $newBc,
        ]);
    }

    /**
     * Bulk generate internal barcodes for all products without any barcode.
     */
    public function bulkGenerateBarcodes(Request $request): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $productsWithoutBarcodes = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->doesntHave('barcodes')
            ->get();

        $count = 0;
        foreach ($productsWithoutBarcodes as $p) {
            $code = $this->barcodeGenerator->generateForTenant($tenant->id);
            ProductBarcode::create([
                'tenant_id' => $tenant->id,
                'product_id' => $p->id,
                'barcode' => $code,
                'source' => 'internal',
            ]);
            $count++;
        }

        return response()->json([
            'message' => "Generated internal barcodes for {$count} products.",
            'generated_count' => $count,
        ]);
    }
}
