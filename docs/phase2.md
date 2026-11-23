# Phase 2: Plans, Features, Limits, and Read-Only Mode Guide

This guide describes how the plan-aware engine works in the Multi-Tenant Pharmacy SaaS platform and how to extend it.

---

## 1. How to Add a New Feature Key

### Step 1: Database Migration / Seeder
Add the feature to `database/seeders/Phase2PlansAndFeaturesSeeder.php` (or a dedicated migration):
```php
Feature::updateOrCreate(
    ['key' => 'new_feature_key'],
    [
        'type' => 'boolean', // 'boolean' | 'limit' | 'level'
        'group_name' => 'Sales',
        'description' => 'Human-friendly description',
        'sort' => 50,
    ]
);
```

### Step 2: Plan Feature Assignment
Assign values for the feature across plans in `Phase2PlansAndFeaturesSeeder.php`:
```php
'new_feature_key' => ['bool_value' => true], // or ['limit_value' => 500] or ['level_value' => 'advanced']
```

### Step 3: Link Permission (Optional)
If this feature gates an RBAC permission, associate it:
```php
Permission::where('name', 'feature.permission.name')->update(['requires_feature' => 'new_feature_key']);
```

### Step 4: UI Display
The Feature Access catalog (`resources/js/Pages/Billing/FeatureAccess.tsx`) automatically groups and displays any feature seeded in `features` by its `group_name` and type.

---

## 2. How to Add a New Limit

### Step 1: Define the Feature Key
Seed a feature with type `'limit'` (e.g. `'max_vouchers_month'`).

### Step 2: Implement Resource Hook or Counter
If the limit is an entity count (e.g. `max_products`), define it in `FeatureManager::used()`:
```php
'max_vouchers_month' => (int) UsageCounter::withoutGlobalScopes()
    ->where('tenant_id', $tenant->id)
    ->where('feature_key', $key)
    ->where('period', now('Asia/Dhaka')->format('Y-m'))
    ->value('used'),
```
Or implement `App\Modules\Billing\Contracts\ResourceLimitHook` for customizable domain evaluation.

### Step 3: Enforce Before Creation
In your Service or Controller:
```php
app(FeatureManager::class)->assertCanUse('max_vouchers_month', 1);
```
If exceeded, it throws `App\Modules\Billing\Exceptions\LimitReachedException`, rendering HTTP 403 JSON:
```json
{
  "error": "limit_reached",
  "feature": "max_vouchers_month",
  "limit": 50,
  "used": 50,
  "remaining": 0,
  "upgrade_url": "/billing/plans"
}
```

---

## 3. How to Add a New Plan

1. Insert into `plans` table with unique code, name, and public visibility flag:
   ```php
   $plan = Plan::create([
       'code' => 'enterprise',
       'name' => 'Enterprise Plus',
       'is_active' => true,
       'is_public' => true,
       'sort' => 4,
   ]);
   ```
2. Attach monthly and yearly prices in `plan_prices`:
   ```php
   PlanPrice::create(['plan_id' => $plan->id, 'billing_cycle' => 'monthly', 'amount' => 14999.00]);
   PlanPrice::create(['plan_id' => $plan->id, 'billing_cycle' => 'yearly', 'amount' => 149990.00]);
   ```
3. Populate all rows in `plan_features` for the new plan ID.

---

## 4. How to Gate Routes and Service Calls

### Route Gating (Middleware)
Use the `feature` middleware in `routes/web.php`:
```php
// Boolean check
Route::get('/pos', [PosController::class, 'index'])->middleware('feature:pos');

// Level check (hierarchical: e.g. 'full' requires rank >= 2)
Route::get('/accounting/ledger', [AccountsController::class, 'index'])
    ->middleware('feature:accounts_level,full');
```

### Service Gating (assertCanUse)
In domain actions and services:
```php
use App\Modules\Billing\Services\FeatureManager;

class StoreMedicineAction
{
    public function __construct(private FeatureManager $featureManager) {}

    public function execute(array $data)
    {
        // Throws LimitReachedException if active medicine count >= max_products
        $this->featureManager->assertCanUse('max_products', 1);

        return Medicine::create($data);
    }
}
```

---

## 5. Read-Only Mode & Route Allowlist

When a tenant subscription is in `read_only`, `grace`, or expired states, `EnsureSubscriptionWritable` blocks all `POST`, `PUT`, `PATCH`, and `DELETE` requests with `SubscriptionReadOnlyException` (HTTP 403), while allowing safe `GET`/`HEAD`/`OPTIONS` operations.

Routes explicitly exempt from write locks are configured in `config/billing.php`:
- `logout`
- `tenant.switch`
- `branch.switch`
- `plans.*` (browsing & upgrading)
- `profile.*`
- Data exports (`*.export`)

