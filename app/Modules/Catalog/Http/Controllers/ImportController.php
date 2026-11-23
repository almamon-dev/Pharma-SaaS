<?php

namespace App\Modules\Catalog\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Catalog\Models\ImportJob;
use App\Modules\Catalog\Models\ImportJobError;
use App\Modules\Catalog\Services\CatalogExportService;
use App\Modules\Catalog\Services\ImportJobService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportController extends Controller
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected ImportJobService $importService,
        protected CatalogExportService $exportService,
        protected FeatureManager $featureManager
    ) {}

    public function template(): StreamedResponse
    {
        Gate::authorize('product.view');
        return $this->exportService->downloadTemplate();
    }

    public function upload(Request $request): JsonResponse
    {
        Gate::authorize('product.import');

        $request->validate([
            'file' => 'required|file|max:20480|mimes:csv,xlsx,txt',
        ]);

        $job = $this->importService->upload($request->file('file'), $request->user());

        return response()->json([
            'message' => 'File uploaded successfully.',
            'job' => $job,
        ], 201);
    }

    public function map(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.import');

        $tenant = $this->tenantContext->tenant();
        $job = ImportJob::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);

        $validated = $request->validate([
            'column_map' => 'required|array',
            'mode' => 'nullable|string|in:create_only,create_or_update',
        ]);

        $job->update([
            'column_map' => $validated['column_map'],
            'mode' => $validated['mode'] ?? $job->mode,
            'status' => 'mapped',
        ]);

        return response()->json([
            'message' => 'Column mapping saved.',
            'job' => $job,
        ]);
    }

    public function preview(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.import');

        $tenant = $this->tenantContext->tenant();
        $job = ImportJob::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);

        $columnMap = $request->input('column_map', $job->column_map ?? []);
        $mode = $request->input('mode', $job->mode ?? 'create_only');

        $preview = $this->importService->preview($job, $columnMap, $mode);

        return response()->json([
            'job' => $job->fresh(),
            'preview' => $preview,
        ]);
    }

    public function start(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.import');

        $tenant = $this->tenantContext->tenant();
        $job = ImportJob::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);

        $limitRows = $request->filled('limit_rows') ? (int) $request->input('limit_rows') : null;

        $job = $this->importService->process($job, $limitRows);

        return response()->json([
            'message' => 'Import processing complete.',
            'job' => $job,
        ]);
    }

    public function undo(Request $request, string $id): JsonResponse
    {
        Gate::authorize('product.import');

        $tenant = $this->tenantContext->tenant();
        $job = ImportJob::withoutGlobalScopes()->where('tenant_id', $tenant->id)->findOrFail($id);

        $this->importService->undo($job, $request->user());

        return response()->json([
            'message' => 'Import undone successfully. Created products have been removed.',
            'job' => $job->fresh(),
        ]);
    }

    public function show(string $id): JsonResponse
    {
        Gate::authorize('product.import');

        $tenant = $this->tenantContext->tenant();
        $job = ImportJob::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->withCount('errors')
            ->findOrFail($id);

        return response()->json($job);
    }

    public function errors(string $id): JsonResponse
    {
        Gate::authorize('product.import');

        $tenant = $this->tenantContext->tenant();
        $errors = ImportJobError::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('import_job_id', $id)
            ->orderBy('row_no')
            ->limit(200)
            ->get();

        return response()->json($errors);
    }
}

