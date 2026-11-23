<?php

namespace App\Modules\Catalog\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Billing\Services\FeatureManager;
use App\Modules\Catalog\Contracts\ProductReferenceChecker;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\ProductBarcode;
use App\Modules\Catalog\Models\ProductBranchSetting;
use App\Modules\Catalog\Models\ProductUnit;
use App\Modules\Catalog\Support\CatalogNormalizer;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ProductService
{
    public function __construct(
        protected TenantContext $tenantContext,
        protected FeatureManager $featureManager,
        protected ProductReferenceChecker $referenceChecker
    ) {}

    /**
     * Create a new catalog product within the active tenant.
     *
     * @return array{product: Product, warnings: array<string, mixed>}
     *
     * @throws ValidationException
     * @throws ConflictHttpException
     */
    public function create(array $data, ?User $actor = null): array
    {
        $current = app(\App\Tenancy\CurrentTenant::class);
        $tenant = ($current->has() ? $current->get() : null) ?? $this->tenantContext->tenant();
        if (! $tenant) {
            throw new \LogicException('Active tenant context is required to create catalog products.');
        }

        // 1. Enforce Plan Limits (max_products) race-free
        $this->featureManager->setTenant($tenant)->assertCanUse('max_products', 1);

        // 2. Validate Type & Business Constraints
        $type = $data['type'] ?? 'medicine';
        if (! in_array($type, ['medicine', 'non_medicine'], true)) {
            throw ValidationException::withMessages([
                'type' => ['Product type must be either medicine or non_medicine.'],
            ]);
        }

        $dosageForm = ! empty($data['dosage_form']) ? trim($data['dosage_form']) : null;
        if ($type === 'medicine' && empty($dosageForm)) {
            throw ValidationException::withMessages([
                'dosage_form' => ['Dosage form is required for medicine products.'],
            ]);
        }

        $trackBatch = $type === 'medicine' ? true : (bool) ($data['track_batch'] ?? false);
        $isControlled = $type === 'medicine' ? (bool) ($data['is_controlled'] ?? false) : false;

        $name = trim($data['name'] ?? '');
        if ($name === '') {
            throw ValidationException::withMessages([
                'name' => ['Product name is required.'],
            ]);
        }

        $strength = ! empty($data['strength']) ? CatalogNormalizer::normalizeStrength($data['strength']) : null;
        $companyId = ! empty($data['company_id']) ? $data['company_id'] : null;
        $genericId = ! empty($data['generic_id']) ? $data['generic_id'] : null;
        $categoryId = ! empty($data['category_id']) ? $data['category_id'] : null;
        $baseUnit = strtolower(trim($data['base_unit'] ?? 'pcs')) ?: 'pcs';

        // 3. Exact Duplicate Prevention via Dedupe Key
        $dedupeKey = CatalogNormalizer::dedupeKey($name, $strength, $dosageForm, $companyId);
        $existing = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->where('dedupe_key', $dedupeKey)
            ->first();

        if ($existing) {
            throw new ConflictHttpException(
                "A product with the same name, strength, dosage form, and company already exists: '{$existing->displayName()}'.",
                null,
                409
            );
        }

        // 4. SKU Uniqueness check
        $sku = ! empty($data['sku']) ? trim($data['sku']) : null;
        if ($sku !== null) {
            $skuExists = Product::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->whereNull('deleted_at')
                ->whereRaw('lower(sku) = ?', [strtolower($sku)])
                ->exists();

            if ($skuExists) {
                throw ValidationException::withMessages([
                    'sku' => ["SKU '{$sku}' is already assigned to another product."],
                ]);
            }
        }

        // 5. Units validation
        $unitsInput = $data['units'] ?? [
            [
                'unit_name' => $baseUnit,
                'conversion_to_base' => 1,
                'is_sale_unit' => true,
                'is_purchase_unit' => true,
                'is_default_sale' => true,
            ],
        ];
        $validatedUnits = ProductUnitsValidator::validate($baseUnit, $unitsInput);

        // 6. Near Duplicate Warning Detection
        $warnings = $this->detectNearDuplicates($tenant->id, $name, $strength, $dosageForm);

        // 7. Atomic Persist inside Transaction
        $product = DB::transaction(function () use (
            $tenant,
            $data,
            $type,
            $name,
            $strength,
            $dosageForm,
            $companyId,
            $genericId,
            $categoryId,
            $baseUnit,
            $trackBatch,
            $isControlled,
            $sku,
            $dedupeKey,
            $validatedUnits,
            $actor
        ) {
            $product = new Product();
            $product->tenant_id = $tenant->id;
            $product->type = $type;
            $product->name = $name;
            $product->name_bn = ! empty($data['name_bn']) ? trim($data['name_bn']) : null;
            $product->generic_id = $genericId;
            $product->company_id = $companyId;
            $product->category_id = $categoryId;
            $product->strength = $strength;
            $product->dosage_form = $dosageForm;
            $product->sku = $sku;
            $product->description = $data['description'] ?? null;
            $product->base_unit = $baseUnit;
            $product->track_batch = $trackBatch;
            $product->is_controlled = $isControlled;
            $product->default_discount_type = $data['default_discount_type'] ?? null;
            $product->default_discount_value = (float) ($data['default_discount_value'] ?? 0);
            $product->vat_rate = (float) ($data['vat_rate'] ?? 0);
            $product->is_active = (bool) ($data['is_active'] ?? true);
            $product->import_job_id = $data['import_job_id'] ?? null;
            $product->dedupe_key = $dedupeKey;
            $product->search_text = ''; // Temporary, populated after relations
            $product->created_by = $actor?->id;
            $product->updated_by = $actor?->id;
            $product->save();

            // Insert Units
            foreach ($validatedUnits as $u) {
                ProductUnit::create([
                    'tenant_id' => $tenant->id,
                    'product_id' => $product->id,
                    'unit_name' => $u['unit_name'],
                    'conversion_to_base' => $u['conversion_to_base'],
                    'is_sale_unit' => $u['is_sale_unit'],
                    'is_purchase_unit' => $u['is_purchase_unit'],
                    'is_default_sale' => $u['is_default_sale'],
                ]);
            }

            // Insert Barcodes
            if (! empty($data['barcodes']) && is_array($data['barcodes'])) {
                foreach ($data['barcodes'] as $b) {
                    $code = is_array($b) ? trim($b['barcode'] ?? '') : trim((string) $b);
                    $source = is_array($b) ? ($b['source'] ?? 'manufacturer') : 'manufacturer';
                    if ($code !== '') {
                        ProductBarcode::create([
                            'tenant_id' => $tenant->id,
                            'product_id' => $product->id,
                            'barcode' => $code,
                            'source' => $source,
                        ]);
                    }
                }
            }

            // Insert Branch Settings
            if (! empty($data['branch_settings']) && is_array($data['branch_settings'])) {
                foreach ($data['branch_settings'] as $bs) {
                    if (! empty($bs['branch_id'])) {
                        ProductBranchSetting::create([
                            'tenant_id' => $tenant->id,
                            'product_id' => $product->id,
                            'branch_id' => $bs['branch_id'],
                            'min_stock' => (int) ($bs['min_stock'] ?? 0),
                            'reorder_qty' => (int) ($bs['reorder_qty'] ?? 0),
                            'shelf_location' => $bs['shelf_location'] ?? null,
                        ]);
                    }
                }
            }

            // Compute & save search_text
            $product->load(['generic', 'company', 'category']);
            $product->search_text = ProductSearchIndexer::build($product);
            $product->save();

            AuditLog::record(
                action: 'product.created',
                description: "Created product '{$product->displayName()}'.",
                subject: $product,
                metadata: [
                    'sku' => $product->sku,
                    'base_unit' => $product->base_unit,
                    'units_count' => count($validatedUnits),
                ],
                tenantId: $tenant->id,
                userId: $actor?->id
            );

            return $product->fresh(['generic', 'company', 'category', 'units', 'barcodes', 'branchSettings']);
        });

        return [
            'product' => $product,
            'warnings' => $warnings,
        ];
    }

    /**
     * Update an existing product.
     *
     * @return array{product: Product, warnings: array<string, mixed>}
     */
    public function update(Product $product, array $data, ?User $actor = null): array
    {
        $current = app(\App\Tenancy\CurrentTenant::class);
        $tenant = ($current->has() ? $current->get() : null) ?? $this->tenantContext->tenant();
        $tenantId = $tenant?->id ?? $product->tenant_id;

        $beforeState = $product->only([
            'name', 'type', 'strength', 'dosage_form', 'sku', 'base_unit', 'is_active', 'vat_rate'
        ]);

        $type = $data['type'] ?? $product->type;
        $name = isset($data['name']) ? trim($data['name']) : $product->name;
        $strength = isset($data['strength']) ? CatalogNormalizer::normalizeStrength($data['strength']) : $product->strength;
        $dosageForm = isset($data['dosage_form']) ? trim($data['dosage_form']) : $product->dosage_form;
        $companyId = array_key_exists('company_id', $data) ? $data['company_id'] : $product->company_id;
        $genericId = array_key_exists('generic_id', $data) ? $data['generic_id'] : $product->generic_id;
        $categoryId = array_key_exists('category_id', $data) ? $data['category_id'] : $product->category_id;
        $baseUnit = isset($data['base_unit']) ? strtolower(trim($data['base_unit'])) : $product->base_unit;

        if ($type === 'medicine' && empty($dosageForm)) {
            throw ValidationException::withMessages([
                'dosage_form' => ['Dosage form is required for medicine products.'],
            ]);
        }

        // Dedupe check if name/strength/form/company changed
        $dedupeKey = CatalogNormalizer::dedupeKey($name, $strength, $dosageForm, $companyId);
        if ($dedupeKey !== $product->dedupe_key) {
            $existing = Product::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->where('id', '!=', $product->id)
                ->whereNull('deleted_at')
                ->where('dedupe_key', $dedupeKey)
                ->first();

            if ($existing) {
                throw new ConflictHttpException(
                    "Another product already exists with the same name, strength, dosage form, and company: '{$existing->displayName()}'.",
                    null,
                    409
                );
            }
        }

        // SKU check
        if (isset($data['sku']) && $data['sku'] !== $product->sku) {
            $sku = trim($data['sku']);
            if ($sku !== '') {
                $skuExists = Product::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->where('id', '!=', $product->id)
                    ->whereNull('deleted_at')
                    ->whereRaw('lower(sku) = ?', [strtolower($sku)])
                    ->exists();

                if ($skuExists) {
                    throw ValidationException::withMessages([
                        'sku' => ["SKU '{$sku}' is already assigned to another product."],
                    ]);
                }
            }
        }

        // Validate units if provided
        $validatedUnits = null;
        if (isset($data['units'])) {
            $validatedUnits = ProductUnitsValidator::validate($baseUnit, $data['units']);

            // Verify if any removed unit or modified conversion is referenced in historical records
            foreach ($product->units as $existingUnit) {
                $stillExists = collect($validatedUnits)->firstWhere('unit_name', $existingUnit->unit_name);
                if (! $stillExists || (int) $stillExists['conversion_to_base'] !== (int) $existingUnit->conversion_to_base) {
                    if ($this->referenceChecker->isUnitReferenced($product, $existingUnit->unit_name)) {
                        throw ValidationException::withMessages([
                            'units' => ["Cannot modify or remove unit '{$existingUnit->unit_name}' because it is referenced in transactions."],
                        ]);
                    }
                }
            }
        }

        $warnings = $this->detectNearDuplicates($tenantId, $name, $strength, $dosageForm, $product->id);

        $product = DB::transaction(function () use (
            $product,
            $data,
            $tenantId,
            $type,
            $name,
            $strength,
            $dosageForm,
            $companyId,
            $genericId,
            $categoryId,
            $baseUnit,
            $dedupeKey,
            $validatedUnits,
            $actor,
            $beforeState
        ) {
            $product->type = $type;
            $product->name = $name;
            if (array_key_exists('name_bn', $data)) {
                $product->name_bn = ! empty($data['name_bn']) ? trim($data['name_bn']) : null;
            }
            $product->generic_id = $genericId;
            $product->company_id = $companyId;
            $product->category_id = $categoryId;
            $product->strength = $strength;
            $product->dosage_form = $dosageForm;
            if (array_key_exists('sku', $data)) {
                $product->sku = ! empty($data['sku']) ? trim($data['sku']) : null;
            }
            if (array_key_exists('description', $data)) {
                $product->description = $data['description'];
            }
            $product->base_unit = $baseUnit;
            $product->track_batch = $type === 'medicine' ? true : (bool) ($data['track_batch'] ?? $product->track_batch);
            $product->is_controlled = $type === 'medicine' ? (bool) ($data['is_controlled'] ?? $product->is_controlled) : false;
            if (array_key_exists('default_discount_type', $data)) {
                $product->default_discount_type = $data['default_discount_type'];
            }
            if (array_key_exists('default_discount_value', $data)) {
                $product->default_discount_value = (float) $data['default_discount_value'];
            }
            if (array_key_exists('vat_rate', $data)) {
                $product->vat_rate = (float) $data['vat_rate'];
            }
            if (array_key_exists('is_active', $data)) {
                $product->is_active = (bool) $data['is_active'];
            }
            $product->dedupe_key = $dedupeKey;
            $product->updated_by = $actor?->id;
            $product->save();

            // Sync Units if supplied
            if ($validatedUnits !== null) {
                ProductUnit::withoutGlobalScopes()
                    ->where('product_id', $product->id)
                    ->delete();

                foreach ($validatedUnits as $u) {
                    ProductUnit::create([
                        'tenant_id' => $tenantId,
                        'product_id' => $product->id,
                        'unit_name' => $u['unit_name'],
                        'conversion_to_base' => $u['conversion_to_base'],
                        'is_sale_unit' => $u['is_sale_unit'],
                        'is_purchase_unit' => $u['is_purchase_unit'],
                        'is_default_sale' => $u['is_default_sale'],
                    ]);
                }
            }

            // Sync Barcodes if supplied
            if (isset($data['barcodes']) && is_array($data['barcodes'])) {
                ProductBarcode::withoutGlobalScopes()
                    ->where('product_id', $product->id)
                    ->delete();

                foreach ($data['barcodes'] as $b) {
                    $code = is_array($b) ? trim($b['barcode'] ?? '') : trim((string) $b);
                    $source = is_array($b) ? ($b['source'] ?? 'manufacturer') : 'manufacturer';
                    if ($code !== '') {
                        ProductBarcode::create([
                            'tenant_id' => $tenantId,
                            'product_id' => $product->id,
                            'barcode' => $code,
                            'source' => $source,
                        ]);
                    }
                }
            }

            // Sync Branch Settings if supplied
            if (isset($data['branch_settings']) && is_array($data['branch_settings'])) {
                ProductBranchSetting::withoutGlobalScopes()
                    ->where('product_id', $product->id)
                    ->delete();

                foreach ($data['branch_settings'] as $bs) {
                    if (! empty($bs['branch_id'])) {
                        ProductBranchSetting::create([
                            'tenant_id' => $tenantId,
                            'product_id' => $product->id,
                            'branch_id' => $bs['branch_id'],
                            'min_stock' => (int) ($bs['min_stock'] ?? 0),
                            'reorder_qty' => (int) ($bs['reorder_qty'] ?? 0),
                            'shelf_location' => $bs['shelf_location'] ?? null,
                        ]);
                    }
                }
            }

            // Refresh search text
            $product->load(['generic', 'company', 'category']);
            $product->search_text = ProductSearchIndexer::build($product);
            $product->save();

            AuditLog::record(
                action: 'product.updated',
                description: "Updated product '{$product->displayName()}'.",
                subject: $product,
                metadata: [
                    'before' => $beforeState,
                    'after' => $product->only(['name', 'type', 'strength', 'dosage_form', 'sku', 'base_unit', 'is_active', 'vat_rate']),
                ],
                tenantId: $tenantId,
                userId: $actor?->id
            );

            return $product->fresh(['generic', 'company', 'category', 'units', 'barcodes', 'branchSettings']);
        });

        return [
            'product' => $product,
            'warnings' => $warnings,
        ];
    }

    /**
     * Deactivate product (hides from default search).
     */
    public function deactivate(Product $product, ?User $actor = null): Product
    {
        $product->is_active = false;
        $product->updated_by = $actor?->id;
        $product->save();

        AuditLog::record(
            action: 'product.deactivated',
            description: "Deactivated product '{$product->displayName()}'.",
            subject: $product,
            tenantId: $product->tenant_id,
            userId: $actor?->id
        );

        return $product;
    }

    /**
     * Activate product.
     */
    public function activate(Product $product, ?User $actor = null): Product
    {
        $product->is_active = true;
        $product->updated_by = $actor?->id;
        $product->save();

        AuditLog::record(
            action: 'product.activated',
            description: "Activated product '{$product->displayName()}'.",
            subject: $product,
            tenantId: $product->tenant_id,
            userId: $actor?->id
        );

        return $product;
    }

    /**
     * Soft delete product if unreferenced, otherwise throw exception.
     *
     * @throws ValidationException
     */
    public function delete(Product $product, ?User $actor = null): void
    {
        if ($this->referenceChecker->isReferenced($product)) {
            throw ValidationException::withMessages([
                'product' => ["Product '{$product->displayName()}' is referenced in inventory batches, purchases, or sales. Deactivate it instead of deleting."],
            ]);
        }

        $tenantId = $product->tenant_id;
        $displayName = $product->displayName();

        $product->delete();

        AuditLog::record(
            action: 'product.deleted',
            description: "Soft deleted unreferenced product '{$displayName}'.",
            subject: $product,
            tenantId: $tenantId,
            userId: $actor?->id
        );
    }

    /**
     * Detect near-duplicates using trigram similarity > 0.6 with same strength and form.
     *
     * @return array<int, array{id: string, name: string, display_name: string, similarity: float}>
     */
    protected function detectNearDuplicates(
        int $tenantId,
        string $name,
        ?string $strength,
        ?string $dosageForm,
        ?string $excludeProductId = null
    ): array {
        if (DB::getDriverName() !== 'pgsql') {
            return [];
        }

        $normName = CatalogNormalizer::normalizeText($name);

        $query = Product::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->when($excludeProductId, fn ($q) => $q->where('id', '!=', $excludeProductId))
            ->when($dosageForm, fn ($q) => $q->where('dosage_form', $dosageForm))
            ->when($strength, fn ($q) => $q->where('strength', $strength))
            ->whereRaw('similarity(lower(name), ?) > 0.6', [$normName])
            ->select(['id', 'name', 'strength', 'dosage_form'])
            ->selectRaw('similarity(lower(name), ?) as sim_score', [$normName])
            ->orderByDesc('sim_score')
            ->limit(5);

        return $query->get()->map(fn (Product $p) => [
            'id' => $p->id,
            'name' => $p->name,
            'display_name' => $p->displayName(),
            'similarity' => round((float) ($p->sim_score ?? 0), 2),
        ])->all();
    }
}
