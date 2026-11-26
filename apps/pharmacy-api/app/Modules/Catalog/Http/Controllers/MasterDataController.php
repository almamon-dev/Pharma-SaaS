<?php

namespace App\Modules\Catalog\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalog\Models\Category;
use App\Modules\Catalog\Models\Company;
use App\Modules\Catalog\Models\Generic;
use App\Modules\Catalog\Services\MasterDataService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class MasterDataController extends Controller
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected MasterDataService $masterDataService
    ) {}

    // ==========================================
    // CATEGORIES
    // ==========================================

    public function categories(Request $request): JsonResponse
    {
        Gate::authorize('product.view');

        $tenant = $this->tenantContext->tenant();
        $cats = Category::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->with(['parent', 'children'])
            ->withCount(['products' => fn ($q) => $q->whereNull('deleted_at')])
            ->orderBy('name')
            ->get();

        return response()->json($cats);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        Gate::authorize('product.manage');

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'parent_id' => 'nullable|uuid',
            'is_active' => 'nullable|boolean',
        ]);

        $cat = $this->masterDataService->createCategory($validated, $request->user());

        return response()->json(['message' => 'Category created.', 'category' => $cat], 201);
    }

    public function updateCategory(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $cat = Category::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'parent_id' => 'nullable|uuid',
            'is_active' => 'nullable|boolean',
        ]);

        $cat = $this->masterDataService->updateCategory($cat, $validated, $request->user());

        return response()->json(['message' => 'Category updated.', 'category' => $cat]);
    }

    public function deleteCategory(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $cat = Category::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);
        $this->masterDataService->deleteCategory($cat, $request->user());

        return response()->json(['message' => 'Category deleted.']);
    }

    // ==========================================
    // COMPANIES
    // ==========================================

    public function companies(Request $request): JsonResponse
    {
        Gate::authorize('product.view');

        $tenant = $this->tenantContext->tenant();
        $companies = Company::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->withCount(['products' => fn ($q) => $q->whereNull('deleted_at')])
            ->orderBy('name')
            ->get();

        return response()->json($companies);
    }

    public function storeCompany(Request $request): JsonResponse
    {
        Gate::authorize('product.manage');

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $company = $this->masterDataService->createCompany($validated, $request->user());

        return response()->json(['message' => 'Company created.', 'company' => $company], 201);
    }

    public function updateCompany(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $company = Company::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'name_bn' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $company = $this->masterDataService->updateCompany($company, $validated, $request->user());

        return response()->json(['message' => 'Company updated.', 'company' => $company]);
    }

    public function deleteCompany(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $company = Company::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);
        $this->masterDataService->deleteCompany($company, $request->user());

        return response()->json(['message' => 'Company deleted.']);
    }

    // ==========================================
    // GENERICS
    // ==========================================

    public function generics(Request $request): JsonResponse
    {
        Gate::authorize('product.view');

        $tenant = $this->tenantContext->tenant();
        $generics = Generic::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->withCount(['products' => fn ($q) => $q->whereNull('deleted_at')])
            ->orderBy('name')
            ->get();

        return response()->json($generics);
    }

    public function storeGeneric(Request $request): JsonResponse
    {
        Gate::authorize('product.manage');

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $generic = $this->masterDataService->createGeneric($validated, $request->user());

        return response()->json(['message' => 'Generic created.', 'generic' => $generic], 201);
    }

    public function updateGeneric(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $generic = Generic::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $generic = $this->masterDataService->updateGeneric($generic, $validated, $request->user());

        return response()->json(['message' => 'Generic updated.', 'generic' => $generic]);
    }

    public function deleteGeneric(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $generic = Generic::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);
        $this->masterDataService->deleteGeneric($generic, $request->user());

        return response()->json(['message' => 'Generic deleted.']);
    }
}

