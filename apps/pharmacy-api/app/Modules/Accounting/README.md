# Multi-Tenant Accounting Module (Bangladesh Pharmacy / Hospital / Distributor SaaS)

## Core Architecture
- **Double-Entry Engine Always**: Every transaction — whether entered via Simple Mode ("Add Income / Add Expense") or Advanced Mode ("Journal Voucher", "Receipt/Payment/Contra", "Payroll", "Stock Adjustment", or Auto-Posting) — writes a balanced double-entry `Voucher` + `VoucherLine` set inside an atomic DB transaction (`SUM(debit_paisa) === SUM(credit_paisa)`).
- **Zero-Migration Mode Switching**: Each tenant has `accounting_settings.mode` (`simple` | `advanced`). Switching `simple -> advanced` unlocks full screens immediately with zero migration; switching `advanced -> simple` hides advanced UI without deleting any ledger data.
- **Integer Paisa Only**: All monetary columns are `BIGINT` stored in paisa (`1 BDT = 100 paisa`). Conversion & formatting use `MoneyPaisa` (`fromBdt`, `toDecimalString`, `formatBdt`) — never floating-point arithmetic.
- **Immutability & Reversals**: Posted vouchers and their lines cannot be updated or deleted (enforced in Eloquent `updating`/`deleting` hooks). Corrections are made exclusively through `VoucherService::reverse()`, which generates an equal-and-opposite linked reversal voucher.
- **Gapless Concurrent Numbering**: `VoucherSequenceService` uses `SELECT ... FOR UPDATE` (`lockForUpdate()`) per `(tenant_id, branch_id, voucher_type, fiscal_year_id)`.
- **Strict Tenant Isolation + PostgreSQL RLS**: Every accounting table has `tenant_id`, uses `BelongsToTenant`, and enforces PostgreSQL `ENABLE` + `FORCE ROW LEVEL SECURITY` scoped by `current_setting('app.tenant_id', true)`. Branch-scoped users are locked to their assigned branch.
- **Dynamic Permissions**: All checks go through `AccountingAccessService` against custom role permissions (`accounting.*`) — zero hardcoded role names. Users without `accounting.cost_and_profit.view` receive `null` for COGS, Gross Profit, Net Profit, margins, and branch profit.

## Chart of Accounts Templates
`ChartOfAccountsTemplateService` seeds one of three templates when a tenant is provisioned:
1. `pharmacy` — Retail / Chain Pharmacy (cash, bank, bKash/Nagad, AR, Medicine & Surgical Inventory, Input/Output VAT, AP, Equity, Sales, COGS, Expired/Damaged Loss, Operating Expenses)
2. `distributor` — Medicine Distributor (adds Sales Commission, Delivery Vehicle Expense, Trade Discount Allowed)
3. `hospital_pharmacy` — Hospital Pharmacy (adds IPD Sales Receivable, Insurance/Corporate Receivable)

All reports aggregate strictly by `accounts.report_group`, never by account names.

## Auto-Posting Contract (`AccountingPosterInterface`)
Implemented by `AutoPostingEngine` with idempotency on `(tenant_id, source_module, source_id, source_event)` and failure capture into `posting_errors` (with UI Retry & Ignore):
- `postCashSale()`
- `postCreditSale()`
- `postCreditPurchase()`
- `postCustomerPayment()`
- `postSupplierPayment()`
- `postSalesReturn()`
- `postPurchaseReturn()`
- `postExpiredOrDamagedWriteOff()`
- `postPayroll()`
- `reverseBySource()`

## Dynamic Permissions (`RbacPermissionCatalogSeeder`)
- `accounting.view`
- `accounting.expense.create`
- `accounting.voucher.create`
- `accounting.voucher.post`
- `accounting.voucher.approve` (required for second-user approval above `approval_threshold_paisa`)
- `accounting.voucher.reverse`
- `accounting.journal.create`
- `accounting.coa.manage`
- `accounting.period.close`
- `accounting.period.reopen` (always audit-logged with reason)
- `accounting.reports.view`
- `accounting.settings.manage`
- `accounting.cost_and_profit.view`

## Routes & Screens (`/accounting/*`)
| Route | Description | Mode |
|---|---|---|
| `GET /accounting` | Simple Dashboard (Simple) or redirects to Overview (Advanced) | Both |
| `GET /accounting/overview` | Section 8 Overview (HTML + `?format=json`, 60s auto-invalidated cache) | Advanced (API Both) |
| `GET /accounting/vouchers` | Receipt, Payment, Contra Vouchers + Approval + Bilingual Print | Both |
| `GET /accounting/vouchers/{id}/print?lang=en\|bn` | Printable English & Bangla Voucher with tenant header & signatures | Both |
| `GET /accounting/journal` | Multi-line Double-Entry Journal Voucher Builder | Advanced Only |
| `GET /accounting/operations` | Payroll, Stock Adjustment / Expired Write-Off, Opening Balance | Advanced |
| `GET /accounting/parties` | Unified Customer/Supplier Directory, Credit Limits, FIFO Ageing & Ledger | Both |
| `GET /accounting/day-book`, `/cash-book`, `/bank-book` | Plain-language Day Book, Cash Book, Bank & Wallet Book | Both |
| `GET /accounting/bank-reconciliation` | Bank Statement CSV Upload, Auto-Match (±3d), Manual Match, Differences | Advanced |
| `GET /accounting/ledger` | General Account Ledger with running balance & CSV export | Advanced |
| `GET /accounting/trial-balance` | SQL-aggregated Trial Balance (Dr = Cr check) & CSV export | Advanced |
| `GET /accounting/balance-sheet` | Balance Sheet by `report_group` (`Assets = Liabilities + Equity`) | Advanced Only |
| `GET /accounting/simple-pnl`, `/vat-summary` | Profit & Loss and VAT Summary (Input / Output / Net) | Both |
| `GET /accounting/reports/extra` | Direct Cash Flow Statement, Branch Comparison, Inventory Valuation | Both |
| `GET /accounting/accounts`, `/periods`, `/posting-errors`, `/settings` | COA Manager, Fiscal Periods & Year-End Close, Error Retry, Settings | Advanced / Both |

## Running Tests & Demo Seeders
```bash
# Run full Accounting test suite (Phases 1–4 + Modular Guard)
docker exec pharmacy-saas-app php artisan test \
  tests/Feature/AccountingPhase1Test.php \
  tests/Feature/AccountingPhase2Test.php \
  tests/Feature/AccountingPhase3Test.php \
  tests/Feature/AccountingPhase4Test.php \
  tests/Feature/ModularArchitectureGuardTest.php

# Seed demo multi-branch data & sample bank reconciliation
docker exec pharmacy-saas-app php artisan db:seed --class=AccountingPhase4Seeder
```

