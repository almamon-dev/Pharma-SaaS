<?php

namespace App\Modules\Catalog\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Services\CatalogExportService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected CatalogExportService $exportService,
        protected FeatureManager $featureManager
    ) {}

    public function export(Request $request): StreamedResponse
    {
        Gate::authorize('product.export');

        $tenant = $this->tenantContext->tenant();
        $this->featureManager->setTenant($tenant)->can('import_export') || throw new \App\Modules\Billing\Exceptions\FeatureLockedException('import_export');

        $query = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at');

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

        return $this->exportService->exportCsv($query);
    }
}

