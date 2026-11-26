<?php

namespace App\Modules\Catalog\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalog\Services\ProductSearchService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ProductSearchController extends Controller
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected ProductSearchService $searchService
    ) {}

    /**
     * Highly optimized fast product search endpoint for POS and Catalog.
     */
    public function search(Request $request): JsonResponse
    {
        Gate::authorize('product.view');

        $tenant = $this->tenantContext->tenant();
        $q = (string) $request->query('q', '');
        $limit = (int) $request->query('limit', 20);
        $type = $request->query('type');
        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $branchId = $request->filled('branch_id') ? (int) $request->query('branch_id') : session('active_branch_id');

        $results = $this->searchService->search(
            tenantId: $tenant->id,
            query: $q,
            limit: $limit,
            type: $type,
            includeInactive: $includeInactive,
            branchId: $branchId
        );

        return response()->json($results);
    }

    /**
     * Dedicated direct barcode scan lookup.
     */
    public function byBarcode(Request $request, string $code): JsonResponse
    {
        Gate::authorize('product.view');

        $tenant = $this->tenantContext->tenant();
        $branchId = $request->filled('branch_id') ? (int) $request->query('branch_id') : session('active_branch_id');

        $product = $this->searchService->findByBarcode(
            tenantId: $tenant->id,
            barcode: $code,
            branchId: $branchId
        );

        if (! $product) {
            return response()->json(['message' => "No product found with barcode '{$code}'."], 404);
        }

        return response()->json($product);
    }
}

