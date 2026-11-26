<?php

namespace App\Modules\Catalog\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalog\Models\ProductDiscountRule;
use App\Modules\Catalog\Services\DiscountRuleService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class DiscountRuleController extends Controller
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected DiscountRuleService $ruleService
    ) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('product.view');

        $tenant = $this->tenantContext->tenant();
        $rules = ProductDiscountRule::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->latest('id')
            ->get();

        return response()->json($rules);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('product.manage');

        $validated = $request->validate([
            'scope' => 'required|string|in:product,category,company',
            'scope_id' => 'required|uuid',
            'type' => 'required|string|in:percent,fixed',
            'value' => 'required|numeric|min:0',
            'starts_on' => 'nullable|date',
            'ends_on' => 'nullable|date',
            'is_active' => 'nullable|boolean',
            'note' => 'nullable|string|max:255',
        ]);

        $rule = $this->ruleService->create($validated, $request->user());

        return response()->json(['message' => 'Discount rule created.', 'rule' => $rule], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $rule = ProductDiscountRule::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);

        $validated = $request->validate([
            'scope' => 'sometimes|string|in:product,category,company',
            'scope_id' => 'sometimes|uuid',
            'type' => 'sometimes|string|in:percent,fixed',
            'value' => 'sometimes|numeric|min:0',
            'starts_on' => 'nullable|date',
            'ends_on' => 'nullable|date',
            'is_active' => 'nullable|boolean',
            'note' => 'nullable|string|max:255',
        ]);

        $rule = $this->ruleService->update($rule, $validated, $request->user());

        return response()->json(['message' => 'Discount rule updated.', 'rule' => $rule]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.manage');

        $tenant = $this->tenantContext->tenant();
        $rule = ProductDiscountRule::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);
        $this->ruleService->delete($rule, $request->user());

        return response()->json(['message' => 'Discount rule deleted.']);
    }
}

