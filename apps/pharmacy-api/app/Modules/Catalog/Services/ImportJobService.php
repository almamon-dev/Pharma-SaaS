<?php

namespace App\Modules\Catalog\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Catalog\Contracts\ProductReferenceChecker;
use App\Modules\Catalog\Models\Category;
use App\Modules\Catalog\Models\Company;
use App\Modules\Catalog\Models\Generic;
use App\Modules\Catalog\Models\ImportJob;
use App\Modules\Catalog\Models\ImportJobError;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\ProductBarcode;
use App\Modules\Catalog\Models\ProductBranchSetting;
use App\Modules\Catalog\Models\ProductUnit;
use App\Modules\Catalog\Support\CatalogNormalizer;
use App\Support\TenantContext;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ImportJobService
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected FeatureManager $featureManager,
        protected ProductReferenceChecker $referenceChecker
    ) {}

    protected function getActiveTenant(): ?\App\Models\Tenant
    {
        $current = app(\App\Tenancy\CurrentTenant::class);
        return ($current->has() ? $current->get() : null) ?? $this->tenantContext->tenant();
    }

    /**
     * Upload an import file and auto-detect column mapping.
     */
    public function upload(UploadedFile $file, ?User $actor = null): ImportJob
    {
        $tenant = $this->getActiveTenant();
        $this->featureManager->setTenant($tenant)->can('import_export') || throw new \App\Modules\Billing\Exceptions\FeatureLockedException('import_export');

        $ext = strtolower($file->getClientOriginalExtension());
        if (! in_array($ext, ['csv', 'xlsx', 'txt'], true)) {
            throw ValidationException::withMessages(['file' => ['File must be a CSV or XLSX spreadsheet.']]);
        }

        $id = (string) Str::uuid();
        $filename = "{$tenant->id}_{$id}.{$ext}";
        $path = $file->storeAs('imports', $filename, 'local');
        $fullPath = \Illuminate\Support\Facades\Storage::disk('local')->path($path);

        $rows = SpreadsheetParser::parse($fullPath);
        $headers = $rows[0] ?? [];
        $totalRows = max(0, count($rows) - 1);

        if ($totalRows > 50000) {
            @unlink($fullPath);
            throw ValidationException::withMessages(['file' => ['File exceeds maximum limit of 50,000 rows.']]);
        }

        $columnMap = $this->autoDetectColumnMap($headers);

        return ImportJob::create([
            'id' => $id,
            'tenant_id' => $tenant->id,
            'type' => 'products',
            'file_path' => $fullPath,
            'original_name' => $file->getClientOriginalName(),
            'mode' => 'create_only',
            'status' => 'uploaded',
            'column_map' => $columnMap,
            'total_rows' => $totalRows,
            'created_by' => $actor?->id,
        ]);
    }

    /**
     * Auto-detect column mapping by English and Bengali header names.
     */
    public function autoDetectColumnMap(array $headers): array
    {
        $map = [];
        $headerPatterns = [
            'type' => ['type', 'product_type', 'ধরন', 'প্রকার'],
            'name' => ['name', 'product_name', 'title', 'নাম', 'ওষুধের নাম'],
            'name_bn' => ['name_bn', 'bengali_name', 'bangla_name', 'বাংলা নাম'],
            'generic' => ['generic', 'generic_name', 'জেনেরিক'],
            'company' => ['company', 'manufacturer', 'brand', 'কোম্পানি'],
            'category' => ['category', 'group', 'ক্যাটাগরি'],
            'strength' => ['strength', 'power', 'শক্তি', 'পাওয়ার'],
            'dosage_form' => ['dosage_form', 'form', 'dosage', 'ফর্ম'],
            'base_unit' => ['base_unit', 'unit', 'মূল ইউনিট'],
            'units' => ['units', 'conversions', 'pack_units', 'ইউনিট কনভার্সন'],
            'barcodes' => ['barcodes', 'barcode', 'upc', 'ean', 'বারকোড'],
            'sku' => ['sku', 'code', 'product_code', 'এসকেইউ'],
            'track_batch' => ['track_batch', 'batch_tracking', 'ব্যাচ ট্র্যাকিং'],
            'is_controlled' => ['is_controlled', 'controlled', 'schedule', 'নিয়ন্ত্রিত'],
            'discount_type' => ['discount_type', 'ডিসকাউন্ট টাইপ'],
            'discount_value' => ['discount_value', 'discount', 'ডিসকাউন্ট'],
            'vat_rate' => ['vat_rate', 'vat', 'ভ্যাট'],
            'min_stock' => ['min_stock', 'ন্যূনতম স্টক'],
            'reorder_qty' => ['reorder_qty', 'রিঅর্ডার পরিমাণ'],
            'shelf_location' => ['shelf_location', 'shelf', 'তাক / লোকেশন'],
        ];

        foreach ($headers as $index => $rawHeader) {
            $h = mb_strtolower(trim((string) $rawHeader), 'UTF-8');
            foreach ($headerPatterns as $field => $patterns) {
                if (in_array($h, $patterns, true)) {
                    $map[$field] = $index;
                    break;
                }
            }
        }

        return $map;
    }

    /**
     * Dry-run validation and preview without altering database products.
     */
    public function preview(ImportJob $job, array $columnMap, string $mode = 'create_only'): array
    {
        $tenantId = $job->tenant_id;
        $rows = SpreadsheetParser::parse($job->file_path);
        $dataRows = array_slice($rows, 1);

        // Clear previous error entries
        ImportJobError::withoutGlobalScopes()->where('import_job_id', $job->id)->delete();

        $willCreate = 0;
        $willUpdate = 0;
        $willSkip = 0;
        $errorCount = 0;
        $previewRows = [];
        $newCompanies = [];
        $newGenerics = [];
        $newCategories = [];
        $seenFileBarcodes = [];

        // Preload tenant lookup maps
        $existingCompanies = Company::withoutGlobalScopes()->where('tenant_id', $tenantId)->pluck('id', 'name')->mapWithKeys(fn ($id, $k) => [CatalogNormalizer::normalizeText($k) => $id])->all();
        $existingGenerics = Generic::withoutGlobalScopes()->where('tenant_id', $tenantId)->pluck('id', 'name')->mapWithKeys(fn ($id, $k) => [CatalogNormalizer::normalizeText($k) => $id])->all();
        $existingCategories = Category::withoutGlobalScopes()->where('tenant_id', $tenantId)->pluck('id', 'name')->mapWithKeys(fn ($id, $k) => [CatalogNormalizer::normalizeText($k) => $id])->all();

        foreach ($dataRows as $i => $row) {
            $rowNo = $i + 2;
            $rowErrors = [];

            $name = trim($this->getVal($row, $columnMap, 'name') ?? '');
            $type = strtolower(trim($this->getVal($row, $columnMap, 'type') ?? 'medicine')) ?: 'medicine';
            $dosageForm = trim($this->getVal($row, $columnMap, 'dosage_form') ?? '');
            $strength = CatalogNormalizer::normalizeStrength($this->getVal($row, $columnMap, 'strength'));
            $companyName = trim($this->getVal($row, $columnMap, 'company') ?? '');
            $genericName = trim($this->getVal($row, $columnMap, 'generic') ?? '');
            $categoryName = trim($this->getVal($row, $columnMap, 'category') ?? '');
            $rawBarcodes = trim($this->getVal($row, $columnMap, 'barcodes') ?? '');
            $sku = trim($this->getVal($row, $columnMap, 'sku') ?? '');
            $baseUnit = strtolower(trim($this->getVal($row, $columnMap, 'base_unit') ?? 'pcs')) ?: 'pcs';

            if ($name === '') {
                $rowErrors[] = ['field' => 'name', 'message' => 'Product name is required.'];
            }
            if ($type === 'medicine' && $dosageForm === '') {
                $rowErrors[] = ['field' => 'dosage_form', 'message' => 'Dosage form is required for medicine products.'];
            }

            // Barcodes check
            $barcodes = array_filter(array_map('trim', explode(';', $rawBarcodes)), fn ($b) => $b !== '');
            foreach ($barcodes as $bc) {
                if (isset($seenFileBarcodes[$bc])) {
                    $rowErrors[] = ['field' => 'barcodes', 'message' => "Duplicate barcode '{$bc}' in import file."];
                }
                $seenFileBarcodes[$bc] = true;
            }

            // Collect auto-created masters
            if ($companyName !== '' && ! isset($existingCompanies[CatalogNormalizer::normalizeText($companyName)])) {
                $newCompanies[$companyName] = true;
            }
            if ($genericName !== '' && ! isset($existingGenerics[CatalogNormalizer::normalizeText($genericName)])) {
                $newGenerics[$genericName] = true;
            }
            if ($categoryName !== '' && ! isset($existingCategories[CatalogNormalizer::normalizeText($categoryName)])) {
                $newCategories[$categoryName] = true;
            }

            // Check match for create / update / skip
            $dedupeKey = CatalogNormalizer::dedupeKey($name, $strength, $dosageForm, $companyName !== '' ? $companyName : null);
            $matchedProduct = null;

            if (! empty($barcodes)) {
                $matchedProduct = Product::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereNull('deleted_at')
                    ->whereHas('barcodes', fn ($q) => $q->whereIn('barcode', $barcodes))
                    ->first();
            }

            if (! $matchedProduct && $sku !== '') {
                $matchedProduct = Product::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereNull('deleted_at')
                    ->whereRaw('lower(sku) = ?', [strtolower($sku)])
                    ->first();
            }

            if (! $matchedProduct) {
                $matchedProduct = Product::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereNull('deleted_at')
                    ->where('dedupe_key', $dedupeKey)
                    ->first();
            }

            if (! empty($rowErrors)) {
                $errorCount++;
                foreach ($rowErrors as $re) {
                    ImportJobError::create([
                        'tenant_id' => $tenantId,
                        'import_job_id' => $job->id,
                        'row_no' => $rowNo,
                        'field' => $re['field'],
                        'message' => $re['message'],
                        'row_data' => $row,
                    ]);
                }
            } else {
                if ($matchedProduct) {
                    if ($mode === 'create_or_update') {
                        $willUpdate++;
                    } else {
                        $willSkip++;
                    }
                } else {
                    $willCreate++;
                }

                if (count($previewRows) < 50) {
                    $previewRows[] = [
                        'row_no' => $rowNo,
                        'action' => $matchedProduct ? ($mode === 'create_or_update' ? 'update' : 'skip') : 'create',
                        'name' => $name,
                        'type' => $type,
                        'strength' => $strength,
                        'dosage_form' => $dosageForm,
                        'company' => $companyName,
                        'generic' => $genericName,
                        'base_unit' => $baseUnit,
                        'barcodes' => implode(', ', $barcodes),
                    ];
                }
            }
        }

        // Limit Check (max_products)
        $tenant = $this->getActiveTenant();
        $this->featureManager->setTenant($tenant);
        $maxLimit = $this->featureManager->limit('max_products');
        $usedCount = $this->featureManager->used('max_products');
        $remainingLimit = $this->featureManager->remaining('max_products');

        $limitExceeded = ($remainingLimit !== null) && ($willCreate > $remainingLimit);

        $job->update([
            'mode' => $mode,
            'status' => 'previewed',
            'column_map' => $columnMap,
            'total_rows' => count($dataRows),
            'ok_rows' => $willCreate + $willUpdate,
            'skipped_rows' => $willSkip,
            'error_rows' => $errorCount,
            'created_count' => $willCreate,
            'updated_count' => $willUpdate,
            'limit_note' => $limitExceeded ? "Plan limit allows {$remainingLimit} new items. File has {$willCreate}." : null,
        ]);

        return [
            'total_rows' => count($dataRows),
            'will_create' => $willCreate,
            'will_update' => $willUpdate,
            'will_skip' => $willSkip,
            'error_rows' => $errorCount,
            'limit_exceeded' => $limitExceeded,
            'max_allowed' => $remainingLimit,
            'preview_rows' => $previewRows,
            'new_masters' => [
                'companies' => array_keys($newCompanies),
                'generics' => array_keys($newGenerics),
                'categories' => array_keys($newCategories),
            ],
        ];
    }

    /**
     * Process import synchronously or chunked via background jobs.
     */
    public function process(ImportJob $job, ?int $limitRows = null): ImportJob
    {
        $tenant = $this->getActiveTenant();
        $tenantId = $job->tenant_id;
        $job->update(['status' => 'processing', 'started_at' => now()]);

        $rows = SpreadsheetParser::parse($job->file_path);
        $dataRows = array_slice($rows, 1);
        $columnMap = $job->column_map ?? [];
        $mode = $job->mode;

        $created = 0;
        $updated = 0;
        $skipped = 0;

        DB::transaction(function () use (
            $job,
            $dataRows,
            $columnMap,
            $mode,
            $tenantId,
            $limitRows,
            &$created,
            &$updated,
            &$skipped
        ) {
            foreach ($dataRows as $i => $row) {
                if ($limitRows !== null && $created >= $limitRows) {
                    $skipped++;
                    continue;
                }

                $name = trim($this->getVal($row, $columnMap, 'name') ?? '');
                if ($name === '') {
                    continue;
                }

                $type = strtolower(trim($this->getVal($row, $columnMap, 'type') ?? 'medicine')) ?: 'medicine';
                $dosageForm = trim($this->getVal($row, $columnMap, 'dosage_form') ?? '');
                if ($type === 'medicine' && $dosageForm === '') {
                    $skipped++;
                    continue;
                }
                $strength = CatalogNormalizer::normalizeStrength($this->getVal($row, $columnMap, 'strength'));
                $companyName = trim($this->getVal($row, $columnMap, 'company') ?? '');
                $genericName = trim($this->getVal($row, $columnMap, 'generic') ?? '');
                $categoryName = trim($this->getVal($row, $columnMap, 'category') ?? '');
                $rawBarcodes = trim($this->getVal($row, $columnMap, 'barcodes') ?? '');
                $sku = trim($this->getVal($row, $columnMap, 'sku') ?? '');
                $baseUnit = strtolower(trim($this->getVal($row, $columnMap, 'base_unit') ?? 'pcs')) ?: 'pcs';
                $nameBn = trim($this->getVal($row, $columnMap, 'name_bn') ?? '');

                // Auto-create missing masters
                $companyId = null;
                if ($companyName !== '') {
                    $comp = Company::withoutGlobalScopes()
                        ->where('tenant_id', $tenantId)
                        ->whereRaw('lower(name) = ?', [CatalogNormalizer::normalizeText($companyName)])
                        ->first();
                    if (! $comp) {
                        $comp = Company::create(['tenant_id' => $tenantId, 'name' => $companyName, 'is_active' => true]);
                    }
                    $companyId = $comp->id;
                }

                $genericId = null;
                if ($genericName !== '') {
                    $gen = Generic::withoutGlobalScopes()
                        ->where('tenant_id', $tenantId)
                        ->whereRaw('lower(name) = ?', [CatalogNormalizer::normalizeText($genericName)])
                        ->first();
                    if (! $gen) {
                        $gen = Generic::create(['tenant_id' => $tenantId, 'name' => $genericName, 'is_active' => true]);
                    }
                    $genericId = $gen->id;
                }

                $categoryId = null;
                if ($categoryName !== '') {
                    $cat = Category::withoutGlobalScopes()
                        ->where('tenant_id', $tenantId)
                        ->whereRaw('lower(name) = ?', [CatalogNormalizer::normalizeText($categoryName)])
                        ->first();
                    if (! $cat) {
                        $cat = Category::create(['tenant_id' => $tenantId, 'name' => $categoryName, 'is_active' => true]);
                    }
                    $categoryId = $cat->id;
                }

                $barcodes = array_filter(array_map('trim', explode(';', $rawBarcodes)), fn ($b) => $b !== '');
                $dedupeKey = CatalogNormalizer::dedupeKey($name, $strength, $dosageForm, $companyId);

                // Find existing match
                $matchedProduct = null;
                if (! empty($barcodes)) {
                    $matchedProduct = Product::withoutGlobalScopes()
                        ->where('tenant_id', $tenantId)
                        ->whereNull('deleted_at')
                        ->whereHas('barcodes', fn ($q) => $q->whereIn('barcode', $barcodes))
                        ->first();
                }
                if (! $matchedProduct && $sku !== '') {
                    $matchedProduct = Product::withoutGlobalScopes()
                        ->where('tenant_id', $tenantId)
                        ->whereNull('deleted_at')
                        ->whereRaw('lower(sku) = ?', [strtolower($sku)])
                        ->first();
                }
                if (! $matchedProduct) {
                    $matchedProduct = Product::withoutGlobalScopes()
                        ->where('tenant_id', $tenantId)
                        ->whereNull('deleted_at')
                        ->where('dedupe_key', $dedupeKey)
                        ->first();
                }

                if ($matchedProduct) {
                    if ($mode === 'create_or_update') {
                        $matchedProduct->update([
                            'name' => $name,
                            'name_bn' => $nameBn ?: $matchedProduct->name_bn,
                            'strength' => $strength,
                            'dosage_form' => $dosageForm,
                            'company_id' => $companyId ?? $matchedProduct->company_id,
                            'generic_id' => $genericId ?? $matchedProduct->generic_id,
                            'category_id' => $categoryId ?? $matchedProduct->category_id,
                            'sku' => $sku ?: $matchedProduct->sku,
                        ]);
                        $updated++;
                    } else {
                        $skipped++;
                    }
                } else {
                    $product = Product::create([
                        'tenant_id' => $tenantId,
                        'type' => $type,
                        'name' => $name,
                        'name_bn' => $nameBn ?: null,
                        'generic_id' => $genericId,
                        'company_id' => $companyId,
                        'category_id' => $categoryId,
                        'strength' => $strength,
                        'dosage_form' => $dosageForm,
                        'sku' => $sku ?: null,
                        'base_unit' => $baseUnit,
                        'track_batch' => $type === 'medicine' ? true : false,
                        'is_controlled' => false,
                        'is_active' => true,
                        'import_job_id' => $job->id,
                        'dedupe_key' => $dedupeKey,
                        'search_text' => '',
                        'created_by' => $job->created_by,
                    ]);

                    // Default unit
                    ProductUnit::create([
                        'tenant_id' => $tenantId,
                        'product_id' => $product->id,
                        'unit_name' => $baseUnit,
                        'conversion_to_base' => 1,
                        'is_sale_unit' => true,
                        'is_purchase_unit' => true,
                        'is_default_sale' => true,
                    ]);

                    // Additional units from format: box=100;strip=10
                    $unitsStr = trim($this->getVal($row, $columnMap, 'units') ?? '');
                    if ($unitsStr !== '') {
                        foreach (explode(';', $unitsStr) as $uPart) {
                            if (str_contains($uPart, '=')) {
                                [$uName, $conv] = explode('=', $uPart, 2);
                                $uName = strtolower(trim($uName));
                                $conv = (int) CatalogNormalizer::normalizeDigits($conv);
                                if ($uName !== '' && $conv > 1 && $uName !== $baseUnit) {
                                    ProductUnit::create([
                                        'tenant_id' => $tenantId,
                                        'product_id' => $product->id,
                                        'unit_name' => $uName,
                                        'conversion_to_base' => $conv,
                                        'is_sale_unit' => true,
                                        'is_purchase_unit' => true,
                                        'is_default_sale' => false,
                                    ]);
                                }
                            }
                        }
                    }

                    // Barcodes
                    foreach ($barcodes as $bc) {
                        ProductBarcode::create([
                            'tenant_id' => $tenantId,
                            'product_id' => $product->id,
                            'barcode' => $bc,
                            'source' => 'manufacturer',
                        ]);
                    }

                    $product->load(['generic', 'company', 'category']);
                    $product->search_text = ProductSearchIndexer::build($product);
                    $product->save();

                    $created++;
                }
            }
        });

        $job->update([
            'status' => 'done',
            'created_count' => $created,
            'updated_count' => $updated,
            'skipped_rows' => $skipped,
            'finished_at' => now(),
            'undo_until' => now()->addHours(24),
        ]);

        AuditLog::record(
            action: 'import.completed',
            description: "Completed import: created {$created}, updated {$updated}, skipped {$skipped} products.",
            subject: $job,
            tenantId: $tenantId,
            userId: $job->created_by
        );

        return $job;
    }

    /**
     * Undo a completed import within 24 hours.
     *
     * @throws ValidationException
     */
    public function undo(ImportJob $job, ?User $actor = null): void
    {
        if (! $job->canUndo()) {
            throw ValidationException::withMessages([
                'import' => ['This import cannot be undone. 24-hour undo window has expired or import was already undone.'],
            ]);
        }

        $tenantId = $job->tenant_id;
        $products = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->where('import_job_id', $job->id)
            ->whereNull('deleted_at')
            ->get();

        // Check if any product is referenced elsewhere
        foreach ($products as $p) {
            if ($this->referenceChecker->isReferenced($p)) {
                throw ValidationException::withMessages([
                    'import' => ["Cannot undo import because product '{$p->displayName()}' is referenced in inventory batches, purchases, or sales."],
                ]);
            }
        }

        DB::transaction(function () use ($job, $products, $tenantId) {
            foreach ($products as $p) {
                $p->delete();
            }

            // Remove master records created by this tenant that are now completely unused
            Company::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->whereDoesntHave('products')
                ->delete();

            Generic::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->whereDoesntHave('products')
                ->delete();

            Category::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->whereDoesntHave('products')
                ->whereDoesntHave('children')
                ->delete();

            $job->update([
                'status' => 'undone',
                'undone_at' => now(),
            ]);
        });

        AuditLog::record(
            action: 'import.undone',
            description: "Undid import #{$job->id}: removed {$products->count()} created products.",
            subject: $job,
            tenantId: $tenantId,
            userId: $actor?->id
        );
    }

    protected function getVal(array $row, array $map, string $key): ?string
    {
        if (! isset($map[$key])) {
            return null;
        }
        $colIdx = $map[$key];
        return isset($row[$colIdx]) ? trim((string) $row[$colIdx]) : null;
    }
}
