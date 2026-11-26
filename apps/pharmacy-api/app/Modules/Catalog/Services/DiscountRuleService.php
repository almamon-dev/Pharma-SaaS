<?php

namespace App\Modules\Catalog\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Catalog\Models\Category;
use App\Modules\Catalog\Models\Company;
use App\Modules\Catalog\Models\Product;
use App\Modules\Catalog\Models\ProductDiscountRule;
use App\Support\TenantContext;
use Illuminate\Validation\ValidationException;

class DiscountRuleService
{
    public function __construct(
        protected TenantContext $tenantContext
    ) {}

    public function create(array $data, ?User $actor = null): ProductDiscountRule
    {
        $tenant = $this->tenantContext->tenant();
        $this->validateRule($data, $tenant->id);

        $rule = ProductDiscountRule::create([
            'tenant_id' => $tenant->id,
            'scope' => $data['scope'],
            'scope_id' => $data['scope_id'],
            'type' => $data['type'],
            'value' => (float) $data['value'],
            'starts_on' => $data['starts_on'] ?? null,
            'ends_on' => $data['ends_on'] ?? null,
            'is_active' => (bool) ($data['is_active'] ?? true),
            'note' => $data['note'] ?? null,
        ]);

        AuditLog::record('discount_rule.created', "Created {$rule->type} discount rule for {$rule->scope}.", $rule, [], $tenant->id, $actor?->id);

        return $rule;
    }

    public function update(ProductDiscountRule $rule, array $data, ?User $actor = null): ProductDiscountRule
    {
        $merged = array_merge($rule->toArray(), $data);
        $this->validateRule($merged, $rule->tenant_id);

        $rule->update([
            'scope' => $data['scope'] ?? $rule->scope,
            'scope_id' => $data['scope_id'] ?? $rule->scope_id,
            'type' => $data['type'] ?? $rule->type,
            'value' => isset($data['value']) ? (float) $data['value'] : $rule->value,
            'starts_on' => array_key_exists('starts_on', $data) ? $data['starts_on'] : $rule->starts_on,
            'ends_on' => array_key_exists('ends_on', $data) ? $data['ends_on'] : $rule->ends_on,
            'is_active' => isset($data['is_active']) ? (bool) $data['is_active'] : $rule->is_active,
            'note' => array_key_exists('note', $data) ? $data['note'] : $rule->note,
        ]);

        AuditLog::record('discount_rule.updated', "Updated {$rule->type} discount rule for {$rule->scope}.", $rule, [], $rule->tenant_id, $actor?->id);

        return $rule;
    }

    public function delete(ProductDiscountRule $rule, ?User $actor = null): void
    {
        $tenantId = $rule->tenant_id;
        $rule->delete();

        AuditLog::record('discount_rule.deleted', "Deleted discount rule #{$rule->id}.", null, [], $tenantId, $actor?->id);
    }

    protected function validateRule(array $data, int $tenantId): void
    {
        $scope = $data['scope'] ?? null;
        if (! in_array($scope, ['product', 'category', 'company'], true)) {
            throw ValidationException::withMessages(['scope' => ['Scope must be product, category, or company.']]);
        }

        $scopeId = $data['scope_id'] ?? null;
        if (empty($scopeId)) {
            throw ValidationException::withMessages(['scope_id' => ['Scope entity ID is required.']]);
        }

        $exists = match ($scope) {
            'product' => Product::withoutGlobalScopes()->where('tenant_id', $tenantId)->whereNull('deleted_at')->where('id', $scopeId)->exists(),
            'category' => Category::withoutGlobalScopes()->where('tenant_id', $tenantId)->where('id', $scopeId)->exists(),
            'company' => Company::withoutGlobalScopes()->where('tenant_id', $tenantId)->where('id', $scopeId)->exists(),
            default => false,
        };

        if (! $exists) {
            throw ValidationException::withMessages(['scope_id' => ["Referenced {$scope} was not found in your tenant."]]);
        }

        $type = $data['type'] ?? null;
        if (! in_array($type, ['percent', 'fixed'], true)) {
            throw ValidationException::withMessages(['type' => ['Discount type must be either percent or fixed.']]);
        }

        $value = (float) ($data['value'] ?? 0);
        if ($value < 0) {
            throw ValidationException::withMessages(['value' => ['Discount value cannot be negative.']]);
        }

        if ($type === 'percent' && $value > 100) {
            throw ValidationException::withMessages(['value' => ['Percentage discount cannot exceed 100%.']]);
        }

        $startsOn = ! empty($data['starts_on']) ? $data['starts_on'] : null;
        $endsOn = ! empty($data['ends_on']) ? $data['ends_on'] : null;

        if ($startsOn && $endsOn && $endsOn < $startsOn) {
            throw ValidationException::withMessages(['ends_on' => ['End date must be greater than or equal to start date.']]);
        }
    }
}

