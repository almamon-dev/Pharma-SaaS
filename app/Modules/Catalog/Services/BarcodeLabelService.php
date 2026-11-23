<?php

namespace App\Modules\Catalog\Services;

use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Catalog\Models\Product;
use App\Support\TenantContext;

class BarcodeLabelService
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected FeatureManager $featureManager
    ) {}

    /**
     * Generate printable barcode labels HTML page with embedded fonts and accurate mm styling.
     *
     * @param  array<int, array{product_id: string, copies: int}>  $items
     * @param  string  $preset  '38x25' | '50x30' | 'a4_3x8'
     */
    public function generateHtml(array $items, string $preset = '38x25'): string
    {
        $tenant = $this->tenantContext->tenant();
        $this->featureManager->setTenant($tenant)->can('barcode_labels') || throw new \App\Modules\Billing\Exceptions\FeatureLockedException('barcode_labels');

        $presets = config('catalog.label_presets', []);
        $cfg = $presets[$preset] ?? $presets['38x25'];

        $labels = [];
        foreach ($items as $item) {
            $productId = $item['product_id'] ?? null;
            $copies = max(1, min(500, (int) ($item['copies'] ?? 1)));
            if (! $productId) {
                continue;
            }

            $product = Product::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->whereNull('deleted_at')
                ->with(['barcodes'])
                ->find($productId);

            if ($product) {
                $barcode = $product->barcodes->first()?->barcode ?? $product->sku ?? 'NO-BARCODE';
                $labelData = [
                    'name' => $product->name,
                    'name_bn' => $product->name_bn,
                    'strength' => $product->strength,
                    'company' => $product->company?->name,
                    'barcode' => $barcode,
                ];

                for ($i = 0; $i < $copies; $i++) {
                    $labels[] = $labelData;
                }
            }
        }

        return view('catalog.labels', [
            'labels' => $labels,
            'preset' => $preset,
            'cfg' => $cfg,
        ])->render();
    }
}

