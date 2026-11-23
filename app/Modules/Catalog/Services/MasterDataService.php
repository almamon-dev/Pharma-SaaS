<?php

namespace App\Modules\Catalog\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Catalog\Jobs\RefreshProductSearchText;
use App\Modules\Catalog\Models\Category;
use App\Modules\Catalog\Models\Company;
use App\Modules\Catalog\Models\Generic;
use App\Modules\Catalog\Support\CatalogNormalizer;
use App\Support\TenantContext;
use Illuminate\Validation\ValidationException;

class MasterDataService
{
    public function __construct(
        protected TenantContext $tenantContext
    ) {}

    // ==========================================
    // 1. CATEGORIES
    // ==========================================

    protected function getActiveTenant(): ?\App\Models\Tenant
    {
        $current = app(\App\Tenancy\CurrentTenant::class);
        return ($current->has() ? $current->get() : null) ?? $this->tenantContext->tenant();
    }

    public function createCategory(array $data, ?User $actor = null): Category
    {
        $tenant = $this->getActiveTenant();
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            throw ValidationException::withMessages(['name' => ['Category name is required.']]);
        }

        $parentId = ! empty($data['parent_id']) ? $data['parent_id'] : null;

        // Check uniqueness per tenant + parent
        $exists = Category::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('parent_id', $parentId)
            ->whereRaw('lower(name) = ?', [CatalogNormalizer::normalizeText($name)])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['name' => ["Category '{$name}' already exists under this parent."]]);
        }

        // Validate max depth 3
        if ($parentId) {
            $parent = Category::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->find($parentId);

            if (! $parent) {
                throw ValidationException::withMessages(['parent_id' => ['Parent category not found.']]);
            }

            if ($parent->depth() >= 3) {
                throw ValidationException::withMessages(['parent_id' => ['Category hierarchy cannot exceed maximum depth of 3 levels.']]);
            }
        }

        $category = Category::create([
            'tenant_id' => $tenant->id,
            'parent_id' => $parentId,
            'name' => $name,
            'name_bn' => ! empty($data['name_bn']) ? trim($data['name_bn']) : null,
            'is_active' => (bool) ($data['is_active'] ?? true),
        ]);

        AuditLog::record('category.created', "Created category '{$category->name}'.", $category, [], $tenant->id, $actor?->id);

        return $category;
    }

    public function updateCategory(Category $category, array $data, ?User $actor = null): Category
    {
        $name = isset($data['name']) ? trim($data['name']) : $category->name;
        $parentId = array_key_exists('parent_id', $data) ? $data['parent_id'] : $category->parent_id;

        // Cycle prevention
        if ($parentId) {
            if ($parentId === $category->id) {
                throw ValidationException::withMessages(['parent_id' => ['A category cannot be its own parent.']]);
            }

            $current = Category::withoutGlobalScopes()->find($parentId);
            while ($current) {
                if ($current->id === $category->id) {
                    throw ValidationException::withMessages(['parent_id' => ['Circular category hierarchy detected.']]);
                }
                $current = $current->parent;
            }

            // Max depth 3 check
            $parent = Category::withoutGlobalScopes()->find($parentId);
            if ($parent && $parent->depth() >= 3) {
                throw ValidationException::withMessages(['parent_id' => ['Category hierarchy cannot exceed maximum depth of 3 levels.']]);
            }
        }

        // Uniqueness check
        $exists = Category::withoutGlobalScopes()
            ->where('tenant_id', $category->tenant_id)
            ->where('id', '!=', $category->id)
            ->where('parent_id', $parentId)
            ->whereRaw('lower(name) = ?', [CatalogNormalizer::normalizeText($name)])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['name' => ["Category '{$name}' already exists under this parent."]]);
        }

        $oldName = $category->name;
        $category->name = $name;
        if (array_key_exists('name_bn', $data)) {
            $category->name_bn = ! empty($data['name_bn']) ? trim($data['name_bn']) : null;
        }
        $category->parent_id = $parentId;
        if (array_key_exists('is_active', $data)) {
            $category->is_active = (bool) $data['is_active'];
        }
        $category->save();

        if ($oldName !== $category->name) {
            RefreshProductSearchText::dispatch($category->tenant_id, 'category', $category->id);
        }

        AuditLog::record('category.updated', "Updated category '{$category->name}'.", $category, [], $category->tenant_id, $actor?->id);

        return $category;
    }

    public function deleteCategory(Category $category, ?User $actor = null): void
    {
        // Cannot delete category that has active products or active children without moving them
        $hasProducts = $category->products()->whereNull('deleted_at')->exists();
        $hasChildren = $category->children()->exists();

        if ($hasProducts || $hasChildren) {
            throw ValidationException::withMessages([
                'category' => ["Cannot delete category '{$category->name}' because it contains active products or subcategories. Deactivate it or reassign items first."],
            ]);
        }

        $tenantId = $category->tenant_id;
        $name = $category->name;
        $category->delete();

        AuditLog::record('category.deleted', "Deleted category '{$name}'.", null, [], $tenantId, $actor?->id);
    }

    // ==========================================
    // 2. COMPANIES
    // ==========================================

    public function createCompany(array $data, ?User $actor = null): Company
    {
        $tenant = $this->getActiveTenant();
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            throw ValidationException::withMessages(['name' => ['Company name is required.']]);
        }

        $exists = Company::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereRaw('lower(name) = ?', [CatalogNormalizer::normalizeText($name)])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['name' => ["Company '{$name}' already exists."]]);
        }

        $company = Company::create([
            'tenant_id' => $tenant->id,
            'name' => $name,
            'name_bn' => ! empty($data['name_bn']) ? trim($data['name_bn']) : null,
            'is_active' => (bool) ($data['is_active'] ?? true),
        ]);

        AuditLog::record('company.created', "Created company '{$company->name}'.", $company, [], $tenant->id, $actor?->id);

        return $company;
    }

    public function updateCompany(Company $company, array $data, ?User $actor = null): Company
    {
        $name = isset($data['name']) ? trim($data['name']) : $company->name;

        $exists = Company::withoutGlobalScopes()
            ->where('tenant_id', $company->tenant_id)
            ->where('id', '!=', $company->id)
            ->whereRaw('lower(name) = ?', [CatalogNormalizer::normalizeText($name)])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['name' => ["Company '{$name}' already exists."]]);
        }

        $oldName = $company->name;
        $company->name = $name;
        if (array_key_exists('name_bn', $data)) {
            $company->name_bn = ! empty($data['name_bn']) ? trim($data['name_bn']) : null;
        }
        if (array_key_exists('is_active', $data)) {
            $company->is_active = (bool) $data['is_active'];
        }
        $company->save();

        if ($oldName !== $company->name) {
            RefreshProductSearchText::dispatch($company->tenant_id, 'company', $company->id);
        }

        AuditLog::record('company.updated', "Updated company '{$company->name}'.", $company, [], $company->tenant_id, $actor?->id);

        return $company;
    }

    public function deleteCompany(Company $company, ?User $actor = null): void
    {
        $hasProducts = $company->products()->whereNull('deleted_at')->exists();
        if ($hasProducts) {
            throw ValidationException::withMessages([
                'company' => ["Cannot delete company '{$company->name}' because it has associated products. Deactivate it instead."],
            ]);
        }

        $tenantId = $company->tenant_id;
        $name = $company->name;
        $company->delete();

        AuditLog::record('company.deleted', "Deleted company '{$name}'.", null, [], $tenantId, $actor?->id);
    }

    // ==========================================
    // 3. GENERICS
    // ==========================================

    public function createGeneric(array $data, ?User $actor = null): Generic
    {
        $tenant = $this->getActiveTenant();
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            throw ValidationException::withMessages(['name' => ['Generic name is required.']]);
        }

        $exists = Generic::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereRaw('lower(name) = ?', [CatalogNormalizer::normalizeText($name)])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['name' => ["Generic '{$name}' already exists."]]);
        }

        $generic = Generic::create([
            'tenant_id' => $tenant->id,
            'name' => $name,
            'is_active' => (bool) ($data['is_active'] ?? true),
        ]);

        AuditLog::record('generic.created', "Created generic '{$generic->name}'.", $generic, [], $tenant->id, $actor?->id);

        return $generic;
    }

    public function updateGeneric(Generic $generic, array $data, ?User $actor = null): Generic
    {
        $name = isset($data['name']) ? trim($data['name']) : $generic->name;

        $exists = Generic::withoutGlobalScopes()
            ->where('tenant_id', $generic->tenant_id)
            ->where('id', '!=', $generic->id)
            ->whereRaw('lower(name) = ?', [CatalogNormalizer::normalizeText($name)])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['name' => ["Generic '{$name}' already exists."]]);
        }

        $oldName = $generic->name;
        $generic->name = $name;
        if (array_key_exists('is_active', $data)) {
            $generic->is_active = (bool) $data['is_active'];
        }
        $generic->save();

        if ($oldName !== $generic->name) {
            RefreshProductSearchText::dispatch($generic->tenant_id, 'generic', $generic->id);
        }

        AuditLog::record('generic.updated', "Updated generic '{$generic->name}'.", $generic, [], $generic->tenant_id, $actor?->id);

        return $generic;
    }

    public function deleteGeneric(Generic $generic, ?User $actor = null): void
    {
        $hasProducts = $generic->products()->whereNull('deleted_at')->exists();
        if ($hasProducts) {
            throw ValidationException::withMessages([
                'generic' => ["Cannot delete generic '{$generic->name}' because it has associated products. Deactivate it instead."],
            ]);
        }

        $tenantId = $generic->tenant_id;
        $name = $generic->name;
        $generic->delete();

        AuditLog::record('generic.deleted', "Deleted generic '{$name}'.", null, [], $tenantId, $actor?->id);
    }
}
