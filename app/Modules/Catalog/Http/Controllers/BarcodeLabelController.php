<?php

namespace App\Modules\Catalog\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalog\Services\BarcodeLabelService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class BarcodeLabelController extends Controller
{
    public function __construct(
        protected BarcodeLabelService $labelService
    ) {}

    public function generate(Request $request): Response
    {
        Gate::authorize('barcode.print');

        $validated = $request->validate([
            'preset' => 'nullable|string|in:38x25,50x30,a4_3x8',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|uuid',
            'items.*.copies' => 'nullable|integer|min:1|max:500',
        ]);

        $html = $this->labelService->generateHtml(
            items: $validated['items'],
            preset: $validated['preset'] ?? '38x25'
        );

        return response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }
}

