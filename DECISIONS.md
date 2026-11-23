# Pharmacy SaaS Architecture Decisions (DECISIONS.md)

This document records the architectural standards and defaults selected for the Multi-Tenant Pharmacy SaaS platform per the Master Prompt.

## 1. Modular Layout (`app/Modules/`)
- Every domain has a dedicated module under `app/Modules/`:
  - **Core**: Tenancy, RBAC, Users, Branches, Settings, Audit Logs, RLS Enforcement.
  - **Billing**: Plans, Subscriptions, Invoices, Payments, Addons, Overrides.
  - **Catalog**: Products, Generics, Companies, Categories, Units, Barcodes, Trigram Search.
  - **Inventory**: Batches, Stock Movements (append-only), FEFO Allocation, Stock Adjustments, Counts, Transfers.
  - **Purchasing**: Suppliers, Purchase Orders, Purchases (Bonus Qty), Purchase Returns.
  - **Sales**: POS, Invoices, Sale Items, Mixed Payments, Due Sales, Returns, Cash Shifts.
  - **CRM**: Customers/Patients, Dues, Ledgers.
  - **Accounting**: Double-entry Journal, Chart of Accounts, Vouchers, Financial Accounts, Period Closing, Reconciliation.
  - **Reporting**: Daily Sales Summary, Financial Statements, Operational Reports.
  - **Demo**: Template tenant, demo cloning, guided tours, session limits.

## 2. Tenancy & PostgreSQL Row Level Security (RLS)
- **Multi-Tenant Isolation**: Enforced in three independent defense layers:
  1. **Eloquent Global Scope (`BelongsToTenant`)**: Automatically appends `WHERE tenant_id = :current_tenant_id` to queries and auto-fills `tenant_id` on model creation.
  2. **Connection State (`set_config('app.tenant_id', :id, true)`)**: Executed inside `CurrentTenant::run()` and HTTP middleware. Transaction-local (`is_local=true`) so connection pooling / PgBouncer never leaks tenant IDs across requests.
  3. **PostgreSQL RLS (`FORCE ROW LEVEL SECURITY`)**: Enabled with table policies: `tenant_id::text = current_setting('app.tenant_id', true)`. Even direct raw SQL queries cannot leak cross-tenant rows. Super-admin maintenance scripts can explicitly enable `app.bypass_rls = 'on'`.

## 3. RBAC & Access Control (Section 3.8)
- **Centralized Evaluation (`AccessService` & `Gate::before`)**:
  - `Effective Permission = (Role Permission || User Override) && (Plan Feature Enabled) && (Subscription State Allows Writes) && (Branch Access) && (Data Scope)`.
- **System Default Roles**:
  - `Owner` (System locked, full tenant control, cannot be deleted or demoted if last owner).
  - `Manager` (Branch management, 20% discount cap, approvals).
  - `Pharmacist` (Prescription verification, FEFO dispensing, 10% discount cap, no cost visibility).
  - `Cashier` (Fast POS, 5% discount cap, own bill scope, no cost visibility).
  - `Store keeper` (Inventory, stock count, transfer receive, cost visible).
  - `Purchase officer` (Supplier orders, purchase receive, cost visible).
  - `Accountant` (Full accounting, vouchers, journals, financial reports).
  - `Auditor` (Read-only access to all reports, audit logs, journals, stock).
- **Limits Per Role (`role_limits`)**:
  - `discount_percent`, `max_refund_amount`, `max_void_amount`, `max_voucher_amount`, `max_stock_adjust_value`, `max_credit_sale_amount`, `backdate_hours`, `void_window_hours`.
- **Branch & Data Scopes**:
  - `own`: Returns only records created by the authenticated user.
  - `branch`: Filtered to assigned active user branches.
  - `all`: Unrestricted across the tenant.
- **Cache & Versioning**:
  - Cached in Redis/Cache per user. Any role, permission, override or branch change increments `users.permission_version`, instantly invalidating cache.

## 4. Financial & Stock Safety Rules
- **Money**: `NUMERIC(12,2)` / `DECIMAL(12,2)`, never IEEE float.
- **Stock**: Integer pieces in base unit. All stock writes pass strictly through `StockService`.
- **Append-only Ledgers**: `stock_movements`, `journal_entries`, `audit_logs` are immutable and write-only.

## 5. Phase 2: Plans, Features & Subscription Limits Decisions

### 5.1 Why Features Live in DB, Not Config Files
- **Dynamic Super-Admin Management**: Platform administrators can introduce, reclassify, or adjust feature definitions without redeploying code.
- **Granular Per-Tenant Overrides & Addons**: Overrides and add-ons (`tenant_overrides`, `tenant_addons`) attach directly via foreign keys with expiration timestamps and audit logs.
- **Relational Integrity**: Foreign keys ensure that plan feature assignments and permission dependencies (`permissions.requires_feature`) remain consistent and discoverable.

### 5.2 Why Effective Features Are a DB View (`tenant_effective_features`)
- **Single Source of Truth**: Resolves Plan Defaults + Addon Extra Limits + Tenant Overrides in one standard SQL query.
- **Atomic Precedence**: Implements explicit business logic: `COALESCE(o.bool_value, pf.bool_value)` and `COALESCE(pf.limit_value + extra_addon_limit, NULL)`. Expired overrides (`expires_at <= NOW()`) are automatically ignored.
- **Redis Cache Priming**: Cache loader reads a flat list from the view in one round-trip and caches `tenant:{id}:features` with anti-stampede locks.

### 5.3 Why PostgreSQL Advisory Locks + Atomic UPSERT for Limits (Not Simple Redis Decrement)
- **Data Integrity & Crash Safety**: Redis in-memory counters can drift during network partitions, server restarts, or failed database transactions.
- **Strict Concurrency Protection**: Advisory lock `pg_advisory_xact_lock(crc32('tenant_usage_...'))` serializes parallel limit checks inside the database transaction.
- **Atomic UPSERT**: Increments usage counters via `INSERT ... ON CONFLICT (tenant_id, feature_key, period) DO UPDATE SET used = usage_counters.used + :inc`. If the transaction rolls back, the increment rolls back automatically.

### 5.4 Why Read-Only Mode Keeps GET Working (No Hard Lockout Screen)
- **Clinical & Operational Safety**: In a pharmacy, completely locking out a terminal when a subscription expires during evening rush hour could endanger patients needing emergency medication verification or billing review.
- **Operational Continuation**: Cashiers and pharmacists can finish shifts, look up patient histories, inspect medicine stock, and export ledgers.
- **Write Prevention**: Non-safe HTTP verbs (`POST`, `PUT`, `PATCH`, `DELETE`) are strictly rejected with an informative banner and 403 response directing owners to upgrade.

### 5.5 How Downgrades Preserve Historical Data
- **No Data Deletion**: Downgrading a plan (e.g. Premium with 5 branches to Basic with 1 branch) **never** deletes existing branches, employees, medicines, or transactions.
- **Creation Gating**: Future additions are blocked because `used >= new_limit`. Existing records remain read-only or active per business rules.
- **Impact Warning**: `PlanChangeImpact::evaluate()` runs prior to downgrade, detailing resource excess warnings to the owner.

## 6. Phase 3: Product Catalog, Trigram Search, Units & Import/Export Decisions

### 6.1 Composite Trigram Indexing (`tenant_id, search_text gin_trgm_ops`)
- Enabled `btree_gin` alongside `pg_trgm` to index `(tenant_id, search_text gin_trgm_ops)` in a single composite GIN index.
- Prevents PostgreSQL's query optimizer from falling back to sequential scans or B-tree scans on `tenant_id` when evaluating `search_text` expressions with `LIMIT`.
- p95 search latency achieved: **32.32 ms** on 50,000 synthetic products (Target: < 200 ms).

### 6.2 Search Query Strategy: Two-Pass Hybrid Execution
- **Pass 1 (Exact & Substring Trigram)**: Uses `search_text LIKE '%token%'` (or word-start `LIKE 'token%'` for 1-2 chars) directly against the GIN index. Extremely fast (0.2 ms - 2 ms).
- **Pass 2 (Fuzzy Typo Fallback)**: If Pass 1 returns 0 results, executes `search_text % token` using the `%` similarity operator to handle misspelled names (e.g. `Zimaax` matching `Zimax`).

### 6.3 Units and Conversions
- Exactly one base unit per product (`conversion_to_base = 1`).
- All conversion factors are positive integers > 1.
- Selling prices and quantities in POS/stock are stored and calculated in integer base units.

### 6.4 Streaming Import & 24-Hour Rollback
- Pure PHP streaming parser via `ZipArchive` and `SimpleXMLElement` for `.xlsx` and `fgetcsv` for `.csv`, eliminating heavy external dependencies without requiring `ext-gd`.
- Imports can be rolled back within 24 hours provided products have not been referenced in other transactions (enforced by `ProductReferenceChecker`).



