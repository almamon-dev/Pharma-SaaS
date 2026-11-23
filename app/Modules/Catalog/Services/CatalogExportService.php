<?php

namespace App\Modules\Catalog\Services;

use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Catalog\Models\Product;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CatalogExportService
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected FeatureManager $featureManager
    ) {}

    /**
     * Download standard catalog import template CSV.
     */
    public function downloadTemplate(): StreamedResponse
    {
        $headers = [
            'type',
            'name',
            'name_bn',
            'generic',
            'company',
            'category',
            'strength',
            'dosage_form',
            'base_unit',
            'units',
            'barcodes',
            'sku',
            'track_batch',
            'is_controlled',
            'discount_type',
            'discount_value',
            'vat_rate',
            'min_stock',
            'reorder_qty',
            'shelf_location',
        ];

        $exampleRows = [
            [
                'type' => 'medicine',
                'name' => 'Napa Extra',
                'name_bn' => 'নাপা এক্সট্রা',
                'generic' => 'Paracetamol + Caffeine',
                'company' => 'Beximco Pharmaceuticals Ltd',
                'category' => 'Analgesic',
                'strength' => '500mg+65mg',
                'dosage_form' => 'tablet',
                'base_unit' => 'pcs',
                'units' => 'box=120;strip=12',
                'barcodes' => '8941100501234',
                'sku' => 'NAPA-EXT-500',
                'track_batch' => '1',
                'is_controlled' => '0',
                'discount_type' => 'percent',
                'discount_value' => '5.00',
                'vat_rate' => '0.00',
                'min_stock' => '50',
                'reorder_qty' => '200',
                'shelf_location' => 'Rack-A1',
            ],
            [
                'type' => 'medicine',
                'name' => 'Seclo',
                'name_bn' => 'সেকলো',
                'generic' => 'Omeprazole',
                'company' => 'Square Pharmaceuticals Ltd',
                'category' => 'Anti-ulcerant',
                'strength' => '20mg',
                'dosage_form' => 'capsule',
                'base_unit' => 'pcs',
                'units' => 'box=100;strip=10',
                'barcodes' => '8941100509876',
                'sku' => 'SECLO-20',
                'track_batch' => '1',
                'is_controlled' => '0',
                'discount_type' => 'percent',
                'discount_value' => '0.00',
                'vat_rate' => '0.00',
                'min_stock' => '30',
                'reorder_qty' => '100',
                'shelf_location' => 'Rack-B3',
            ],
            [
                'type' => 'non_medicine',
                'name' => 'Surgical Face Mask (3-Ply)',
                'name_bn' => 'সার্জিক্যাল ফেস মাস্ক',
                'generic' => '',
                'company' => 'Getwell',
                'category' => 'Surgical & Hygiene',
                'strength' => '',
                'dosage_form' => '',
                'base_unit' => 'pcs',
                'units' => 'box=50',
                'barcodes' => '8942200112233',
                'sku' => 'MASK-SURG-50',
                'track_batch' => '0',
                'is_controlled' => '0',
                'discount_type' => 'fixed',
                'discount_value' => '0.00',
                'vat_rate' => '5.00',
                'min_stock' => '100',
                'reorder_qty' => '500',
                'shelf_location' => 'Front-Counter',
            ],
        ];

        return new StreamedResponse(function () use ($headers, $exampleRows) {
            $out = fopen('php://output', 'w');
            // Write UTF-8 BOM
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
            fputcsv($out, $headers);
            foreach ($exampleRows as $row) {
                fputcsv($out, array_values($row));
            }
            fclose($out);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="product_catalog_import_template.csv"',
        ]);
    }

    /**
     * Export products to CSV respecting tenant plan limit export_rows_per_file.
     */
    public function exportCsv(Builder $query): StreamedResponse
    {
        $tenant = $this->tenantContext->tenant();
        $this->featureManager->setTenant($tenant);

        $limit = $this->featureManager->limit('export_rows_per_file') ?? 50000;
        $products = $query->limit($limit)->with(['generic', 'company', 'category', 'units', 'barcodes'])->get();

        $headers = [
            'type',
            'name',
            'name_bn',
            'generic',
            'company',
            'category',
            'strength',
            'dosage_form',
            'base_unit',
            'units',
            'barcodes',
            'sku',
            'track_batch',
            'is_controlled',
            'default_discount_type',
            'default_discount_value',
            'vat_rate',
            'is_active',
        ];

        return new StreamedResponse(function () use ($headers, $products) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
            fputcsv($out, $headers);

            foreach ($products as $p) {
                $unitsStr = $p->units
                    ->filter(fn ($u) => (int) $u->conversion_to_base > 1)
                    ->map(fn ($u) => "{$u->unit_name}={$u->conversion_to_base}")
                    ->implode(';');

                $barcodesStr = $p->barcodes->pluck('barcode')->implode(';');

                fputcsv($out, [
                    $p->type,
                    $p->name,
                    $p->name_bn,
                    $p->generic?->name,
                    $p->company?->name,
                    $p->category?->name,
                    $p->strength,
                    $p->dosage_form,
                    $p->base_unit,
                    $unitsStr,
                    $barcodesStr,
                    $p->sku,
                    $p->track_batch ? '1' : '0',
                    $p->is_controlled ? '1' : '0',
                    $p->default_discount_type,
                    $p->default_discount_value,
                    $p->vat_rate,
                    $p->is_active ? '1' : '0',
                ]);
            }
            fclose($out);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="products_export_'.date('Ymd_His').'.csv"',
        ]);
    }
}

