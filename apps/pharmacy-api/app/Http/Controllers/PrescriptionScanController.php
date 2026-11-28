<?php

namespace App\Http\Controllers;

use App\Services\PrescriptionScanService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrescriptionScanController extends Controller
{
    public function __construct(
        private readonly PrescriptionScanService $scanService
    ) {}

    public function scan(Request $request, TenantContext $tenantContext): JsonResponse
    {
        $validated = $request->validate([
            'document' => [
                'required',
                'file',
                'mimes:pdf,jpg,jpeg,png,webp',
                'max:10240', // 10 MB
            ],
            'force_ai' => ['nullable', 'boolean'],
        ]);

        $result = $this->scanService->scan(
            $validated['document'],
            $tenantContext->branchId(),
            (bool) ($validated['force_ai'] ?? false)
        );

        return response()->json($result);
    }
}

