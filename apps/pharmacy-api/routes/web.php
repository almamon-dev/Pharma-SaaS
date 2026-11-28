<?php

use App\Http\Controllers\Admin\SuperAdminController;
use App\Http\Controllers\ApprovalsController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Billing\FeatureAccessController;
use App\Http\Controllers\Billing\PlanBrowseController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\CashierDashboardController;
use App\Http\Controllers\CounterController;
use App\Http\Controllers\CrmController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\PharmacistPortalController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\PrescriptionScanController;
use App\Http\Controllers\SalesOrderController;
use App\Http\Controllers\SalesPortalController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\TenantController;
use App\Http\Controllers\TenantSwitchController;
use App\Http\Controllers\WelcomeController;
use App\Modules\Accounting\Http\Controllers\AccountingPhase1Controller;
use App\Modules\Accounting\Http\Controllers\AccountingPhase2Controller;
use Illuminate\Support\Facades\Route;

Route::get('/', WelcomeController::class)->name('welcome');
Route::get('/pricing', fn () => \Inertia\Inertia::render('Pricing/Index'))->name('pricing.index');
Route::get('/workspace/lookup', [WelcomeController::class, 'lookupWorkspace'])->name('workspace.lookup');
Route::match(['get', 'post'], '/demo/enter', [AuthenticatedSessionController::class, 'demoEnter'])->name('demo.enter');

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store']);

    Route::get('/register', [RegisteredUserController::class, 'create'])->name('register');
    Route::post('/register', [RegisteredUserController::class, 'store']);
});

Route::middleware('auth')->group(function (): void {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

    // Dedicated Subscription Plans Selection Page (separate from registration & billing ledger)
    Route::get('/plans', [SubscriptionController::class, 'plans'])->name('plans.index');
    Route::get('/billing/plans', [PlanBrowseController::class, 'index'])->name('plans.browse');
    Route::get('/billing/plans/{plan}/impact', [PlanBrowseController::class, 'impact'])->name('plans.impact');

    // Subscription Status, Quota & Ledger History
    Route::get('/subscription', [SubscriptionController::class, 'index'])->name('subscription.index');
    Route::post('/subscription', [SubscriptionController::class, 'store'])->name('subscription.store');

    // Profile Settings
    Route::get('/settings/profile', [SettingsController::class, 'profile'])->name('settings.profile');
    Route::put('/settings/profile', [SettingsController::class, 'updateProfile'])->name('settings.profile.update');
    Route::put('/settings/password', [SettingsController::class, 'updatePassword'])->name('settings.password.update');
});

// SaaS Platform Business Owner / Super Admin Portal
Route::middleware(['auth', 'super_admin'])->prefix('admin')->name('admin.')->group(function (): void {
    Route::get('/', [SuperAdminController::class, 'dashboard'])->name('dashboard');
    Route::get('/plans', [SuperAdminController::class, 'plans'])->name('plans');
    Route::post('/plans', [SuperAdminController::class, 'storePlan'])->name('plans.store');
    Route::put('/plans/{plan}', [SuperAdminController::class, 'updatePlan'])->name('plans.update');
    Route::patch('/plans/{plan}/toggle', [SuperAdminController::class, 'togglePlan'])->name('plans.toggle');

    Route::get('/features', [SuperAdminController::class, 'features'])->name('features');
    Route::post('/features', [SuperAdminController::class, 'storeFeature'])->name('features.store');
    Route::put('/features/{module}', [SuperAdminController::class, 'updateFeature'])->name('features.update');
    Route::patch('/features/{module}/toggle', [SuperAdminController::class, 'toggleFeature'])->name('features.toggle');

    Route::get('/subscribers', [SuperAdminController::class, 'subscribers'])->name('subscribers');
    Route::patch('/subscribers/{user}', [SuperAdminController::class, 'updateSubscriber'])->name('subscribers.update');

    Route::get('/demo-roles', [SuperAdminController::class, 'demoRoles'])->name('demo_roles');
    Route::put('/demo-roles/{demoRole}', [SuperAdminController::class, 'updateDemoRole'])->name('demo_roles.update');
    Route::patch('/demo-roles/{demoRole}/toggle', [SuperAdminController::class, 'toggleDemoRole'])->name('demo_roles.toggle');
    Route::post('/demo-roles/reset', [SuperAdminController::class, 'resetDemoRoles'])->name('demo_roles.reset');
});

// Subscriber Admin Businesses / Tenants Management (available once subscribed)
Route::middleware(['auth', 'subscription.active'])->group(function (): void {
    Route::get('/tenants', [TenantController::class, 'index'])->name('tenants.index');
    Route::post('/tenants', [TenantController::class, 'store'])->name('tenants.store');
    Route::put('/tenants/{tenant}', [TenantController::class, 'update'])->name('tenants.update');

    Route::post('/tenant/switch', [TenantSwitchController::class, 'switchTenant'])->name('tenant.switch');
});

// Tenant Operations Workspace (requires Active Subscription + Active Tenant Context + Writable Mode)
Route::middleware(['auth', 'subscription.active', 'tenant', 'subscription.writable'])->group(function (): void {
    Route::post('/branch/switch', [TenantSwitchController::class, 'switchBranch'])->name('branch.switch');

    Route::get('/dashboard', DashboardController::class)->name('dashboard');

    // Unified Approvals Center (Super Admin, Co-Admin & Branch Manager)
    Route::get('/approvals', [ApprovalsController::class, 'index'])
        ->middleware('tenant.role:approvals.manage,discount.manage,admin,co_admin,manager')
        ->name('approvals.index');
    Route::post('/approvals/discounts/{sale}/decide', [ApprovalsController::class, 'decideDiscount'])
        ->middleware('tenant.role:approvals.manage,discount.manage,admin,co_admin,manager')
        ->name('approvals.discounts.decide');
    Route::post('/approvals/returns/{saleReturn}/decide', [ApprovalsController::class, 'decideReturn'])
        ->middleware('tenant.role:approvals.manage,sale.return,admin,co_admin,manager')
        ->name('approvals.returns.decide');
    Route::post('/approvals/vouchers/{voucher}/decide', [ApprovalsController::class, 'decideVoucher'])
        ->middleware('tenant.role:approvals.manage,accounting.voucher.approve,admin,co_admin,manager')
        ->name('approvals.vouchers.decide');
    Route::get('/billing/features', [FeatureAccessController::class, 'index'])->name('billing.features');
    Route::get('/feature-access', [FeatureAccessController::class, 'index'])->name('billing.features.alias');
    Route::get('/features', [SubscriptionController::class, 'features'])->name('features.index');

    Route::get('/pos', [PosController::class, 'index'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,admin,manager,pharmacist,cashier'])
        ->name('pos.index');
    Route::post('/pos/checkout', [PosController::class, 'checkout'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,admin,manager,pharmacist,cashier'])
        ->name('pos.checkout');

    Route::post('/sales/scan-document', [PrescriptionScanController::class, 'scan'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,sales_orders.create,admin,manager,pharmacist,cashier,salesman'])
        ->name('sales.scan-document');

    Route::get('/counters', [CounterController::class, 'index'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,admin,manager,cashier'])
        ->name('counters.index');
    Route::post('/counters', [CounterController::class, 'store'])
        ->middleware(['feature:pos', 'tenant.role:admin,manager'])
        ->name('counters.store');
    Route::put('/counters/{counter}', [CounterController::class, 'update'])
        ->middleware(['feature:pos', 'tenant.role:admin,manager'])
        ->name('counters.update');
    Route::delete('/counters/sessions/{session}', [CounterController::class, 'destroySession'])
        ->whereNumber('session')
        ->middleware(['feature:pos', 'tenant.role:admin,manager'])
        ->name('counters.sessions.destroy');
    Route::delete('/counters/{counter}', [CounterController::class, 'destroy'])
        ->whereNumber('counter')
        ->middleware(['feature:pos', 'tenant.role:admin,manager'])
        ->name('counters.destroy');
    Route::post('/counters/{counter}/open-session', [\App\Modules\CashCounter\Interfaces\Http\ShiftOperationsController::class, 'openSession'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,admin,manager,pharmacist,cashier'])
        ->name('counters.open-session');
    Route::post('/counters/{counter}/take-break', [CounterController::class, 'takeBreak'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,admin,manager,pharmacist,cashier'])
        ->name('counters.take-break');
    Route::post('/counters/{counter}/resume-service', [CounterController::class, 'resumeService'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,admin,manager,pharmacist,cashier'])
        ->name('counters.resume-service');
    Route::post('/counters/{counter}/close-session', [\App\Modules\CashCounter\Interfaces\Http\ShiftOperationsController::class, 'closeSession'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,admin,manager,pharmacist,cashier'])
        ->name('counters.close-session');
    Route::post('/counters/{counter}/force-close-session', [\App\Modules\CashCounter\Interfaces\Http\ShiftOperationsController::class, 'forceCloseSession'])
        ->middleware(['feature:pos', 'tenant.role:admin,manager'])
        ->name('counters.force-close-session');
    Route::post('/counters/{counter}/cash-movement', [\App\Modules\CashCounter\Interfaces\Http\ShiftOperationsController::class, 'recordCashMovement'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,cash_register.cash_in,cash_register.cash_out,admin,manager,pharmacist,cashier'])
        ->name('counters.cash-movement');
    Route::get('/counters/sessions/{session}/z-report', [\App\Modules\CashCounter\Interfaces\Http\ShiftOperationsController::class, 'zReport'])
        ->whereNumber('session')
        ->middleware(['feature:pos', 'tenant.role:pos.sell,cash_register.reconcile,admin,manager,pharmacist,cashier'])
        ->name('counters.sessions.z-report');
    Route::post('/counters/{counter}/cash-movement', [CounterController::class, 'recordCashMovement'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,cash_register.cash_in,cash_register.cash_out,admin,manager,pharmacist,cashier'])
        ->name('counters.cash-movement');
    Route::get('/counters/sessions/{session}/z-report', [CounterController::class, 'zReport'])
        ->whereNumber('session')
        ->middleware(['feature:pos', 'tenant.role:pos.sell,cash_register.reconcile,admin,manager,pharmacist,cashier'])
        ->name('counters.sessions.z-report');
    Route::post('/counters/{counter}/assign-cashier', [CounterController::class, 'assignCashier'])
        ->middleware(['feature:pos', 'tenant.role:admin,manager'])
        ->name('counters.assign-cashier');
    Route::delete('/counters/{counter}/cashiers/{cashier}', [CounterController::class, 'unassignCashier'])
        ->middleware(['feature:pos', 'tenant.role:admin,manager'])
        ->name('counters.unassign-cashier');
    Route::get('/counters/monitoring', [CounterController::class, 'monitoring'])
        ->middleware(['feature:pos', 'tenant.role:cash_counters.view,cash_counters.view_all_branches,admin,co_admin,manager'])
        ->name('counters.monitoring');
    Route::post('/counters/orders/{sale}/reassign', [CounterController::class, 'reassign'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.reassign,admin,co_admin,manager'])
        ->name('counters.orders.reassign');
    Route::post('/counters/retry-unassigned', [CounterController::class, 'retryUnassigned'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.reassign,admin,co_admin,manager'])
        ->name('counters.retry-unassigned');

    // Salesman Order Management & Dynamic Routing
    Route::get('/sales/orders', fn () => redirect()->route('sales.orders.create'))
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,sales_orders.view_own,admin,manager,salesman']);
    Route::get('/sales/order/create', fn () => redirect()->route('sales.orders.create'))
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,admin,manager,salesman']);
    Route::get('/sales', fn () => redirect()->route('sales.orders.create'))
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,sales_orders.view_own,admin,manager,salesman']);
    Route::get('/orders', fn () => redirect()->route('sales.orders.create'))
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,sales_orders.view_own,admin,manager,salesman']);
    Route::get('/salesman', fn () => redirect()->route('sales.orders.create'))
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,sales_orders.view_own,admin,manager,salesman']);
    Route::get('/salesman/orders', fn () => redirect()->route('sales.orders.my-orders'))
        ->middleware(['feature:pos', 'tenant.role:sales_orders.view_own,admin,manager,salesman']);
    Route::get('/sales/orders/create', [SalesOrderController::class, 'create'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,admin,manager,salesman'])
        ->name('sales.orders.create');
    Route::post('/sales/orders', [SalesOrderController::class, 'store'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,admin,manager,salesman'])
        ->name('sales.orders.store');
    Route::get('/sales/orders/my-orders', [SalesOrderController::class, 'myOrders'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.view_own,sales_orders.view_all,admin,co_admin,manager,salesman'])
        ->name('sales.orders.my-orders');
    Route::get('/sales/orders/{sale}/track', [SalesOrderController::class, 'track'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.view_own,sales_orders.create,admin,manager,salesman,cashier'])
        ->name('sales.orders.track');
    Route::post('/sales/orders/{sale}/cancel', [SalesOrderController::class, 'cancel'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.cancel,admin,manager,salesman'])
        ->name('sales.orders.cancel');
    Route::post('/sales/customers/quick-store', [SalesOrderController::class, 'quickStoreCustomer'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,admin,manager,salesman,cashier'])
        ->name('sales.customers.quick-store');
    Route::delete('/sales/orders/{sale}/draft', [SalesOrderController::class, 'destroyDraft'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,sales_orders.view_own,admin,manager,salesman'])
        ->name('sales.orders.destroy-draft');
    Route::post('/sales/orders/{sale}/approve-discount', [SalesOrderController::class, 'approveDiscount'])
        ->middleware(['feature:pos', 'tenant.role:admin,manager'])
        ->name('sales.orders.approve-discount');

    // Sales Portal: Collections & Dues + Returns & Credit Notes
    Route::get('/sales/collections', [SalesPortalController::class, 'collections'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,sales_orders.view_own,payments.receive,salesman,cashier,admin,manager'])
        ->name('sales.collections.index');
    Route::post('/sales/collections/{sale}/pay', [SalesPortalController::class, 'recordCollection'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,payments.receive,salesman,cashier,admin,manager'])
        ->name('sales.collections.pay');
    Route::get('/sales/returns', [SalesPortalController::class, 'returns'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,sales_orders.view_own,salesman,pharmacist,admin,manager'])
        ->name('sales.returns.index');
    Route::post('/sales/returns', [SalesPortalController::class, 'storeReturn'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.create,salesman,pharmacist,admin,manager'])
        ->name('sales.returns.store');
    Route::post('/sales/returns/{saleReturn}/status', [SalesPortalController::class, 'updateReturnStatus'])
        ->middleware(['feature:pos', 'tenant.role:admin,manager,pharmacist'])
        ->name('sales.returns.status');
    Route::post('/sales/orders/{sale}/reject-discount', [SalesOrderController::class, 'rejectDiscount'])
        ->middleware(['feature:pos', 'tenant.role:admin,manager'])
        ->name('sales.orders.reject-discount');

    // Accounting Module (Phase 1: Double-Entry Core, Simple Mode, COA, Fiscal Periods, Settings)
    Route::prefix('accounting')
        ->name('accounting.')
        ->group(function (): void {
            Route::get('/', [AccountingPhase1Controller::class, 'dashboard'])->name('dashboard');
            Route::post('/simple/entries', [AccountingPhase1Controller::class, 'storeSimpleEntry'])->name('simple.entries.store');
            Route::post('/simple/entries/bulk', [AccountingPhase1Controller::class, 'storeMultipleSimpleEntries'])->name('simple.entries.bulk');
            Route::post('/simple/categories', [AccountingPhase1Controller::class, 'storeSimpleCategory'])->name('simple.categories.store');
            Route::get('/day-book', [AccountingPhase1Controller::class, 'dayBook'])->name('day-book');
            Route::get('/cash-book', [AccountingPhase1Controller::class, 'cashBook'])->name('cash-book');
            Route::get('/simple-pnl', [AccountingPhase1Controller::class, 'simpleProfitAndLoss'])->name('simple-pnl');
            Route::get('/accounts', [AccountingPhase1Controller::class, 'accounts'])->name('accounts.index');
            Route::post('/accounts', [AccountingPhase1Controller::class, 'storeAccount'])->name('accounts.store');
            Route::patch('/accounts/{account}/toggle', [AccountingPhase1Controller::class, 'toggleAccount'])->name('accounts.toggle');
            Route::delete('/accounts/{account}', [AccountingPhase1Controller::class, 'destroyAccount'])->name('accounts.destroy');
            Route::get('/periods', [AccountingPhase1Controller::class, 'periods'])->name('periods.index');
            Route::post('/periods/{period}/close', [AccountingPhase1Controller::class, 'closePeriod'])->name('periods.close');
            Route::post('/periods/{period}/reopen', [AccountingPhase1Controller::class, 'reopenPeriod'])->name('periods.reopen');
            Route::post('/vouchers/{voucher}/reverse', [AccountingPhase1Controller::class, 'reverseVoucher'])->name('vouchers.reverse');
            Route::get('/settings', [AccountingPhase1Controller::class, 'settings'])->name('settings.index');
            Route::put('/settings', [AccountingPhase1Controller::class, 'updateSettings'])->name('settings.update');

            // Phase 2: Receipt/Payment/Contra Vouchers, Parties & Ageing, Bank Book, VAT, Auto-Posting Errors
            Route::get('/vouchers', [AccountingPhase2Controller::class, 'vouchers'])->name('vouchers.index');
            Route::post('/vouchers/rpc', [AccountingPhase2Controller::class, 'storeRpcVoucher'])->name('vouchers.rpc.store');
            Route::get('/parties', [AccountingPhase2Controller::class, 'parties'])->name('parties.index');
            Route::post('/parties', [AccountingPhase2Controller::class, 'storeParty'])->name('parties.store');
            Route::put('/parties/{party}/credit-limit', [AccountingPhase2Controller::class, 'updatePartyCreditLimit'])->name('parties.credit-limit');
            Route::get('/parties/{party}/ledger', [AccountingPhase2Controller::class, 'partyLedger'])->name('parties.ledger');
            Route::get('/bank-book', [AccountingPhase2Controller::class, 'bankBook'])->name('bank-book');
            Route::get('/vat-summary', [AccountingPhase2Controller::class, 'vatSummary'])->name('vat-summary');
            Route::get('/posting-errors', [AccountingPhase2Controller::class, 'postingErrors'])->name('posting-errors.index');
            Route::post('/posting-errors/{postingError}/retry', [AccountingPhase2Controller::class, 'retryPostingError'])->name('posting-errors.retry');
            Route::post('/posting-errors/{postingError}/ignore', [AccountingPhase2Controller::class, 'ignorePostingError'])->name('posting-errors.ignore');

            // Phase 3: Overview (Section 8), Journal Voucher, General Ledger, Trial Balance, Balance Sheet, Approval, Year-End Close, Print & Export
            Route::get('/overview', [\App\Modules\Accounting\Http\Controllers\AccountingPhase3Controller::class, 'overview'])->name('overview');
            Route::get('/journal', [\App\Modules\Accounting\Http\Controllers\AccountingPhase3Controller::class, 'journal'])->name('journal.index');
            Route::post('/journal', [\App\Modules\Accounting\Http\Controllers\AccountingPhase3Controller::class, 'storeJournal'])->name('journal.store');
            Route::post('/vouchers/{voucher}/post', [\App\Modules\Accounting\Http\Controllers\AccountingPhase3Controller::class, 'postVoucher'])->name('vouchers.post');
            Route::post('/vouchers/{voucher}/approve', [\App\Modules\Accounting\Http\Controllers\AccountingPhase3Controller::class, 'approveVoucher'])->name('vouchers.approve');
            Route::get('/vouchers/{voucher}/print', [\App\Modules\Accounting\Http\Controllers\AccountingPhase3Controller::class, 'printVoucher'])->name('vouchers.print');
            Route::get('/ledger', [\App\Modules\Accounting\Http\Controllers\AccountingPhase3Controller::class, 'ledger'])->name('ledger');
            Route::get('/trial-balance', [\App\Modules\Accounting\Http\Controllers\AccountingPhase3Controller::class, 'trialBalance'])->name('trial-balance');
            Route::get('/balance-sheet', [\App\Modules\Accounting\Http\Controllers\AccountingPhase3Controller::class, 'balanceSheet'])->name('balance-sheet');
            Route::post('/fiscal-years/{fiscalYear}/close', [\App\Modules\Accounting\Http\Controllers\AccountingPhase3Controller::class, 'closeFiscalYear'])->name('fiscal-years.close');
            Route::get('/export/{report}', [\App\Modules\Accounting\Http\Controllers\AccountingPhase3Controller::class, 'export'])->name('export');

            // Phase 4: Bank Reconciliation, Payroll & Stock Adjustment Vouchers, Cash Flow / Branch / Inventory Valuation Reports
            Route::get('/bank-reconciliation', [\App\Modules\Accounting\Http\Controllers\AccountingPhase4Controller::class, 'bankReconciliation'])->name('bank-reconciliation.index');
            Route::post('/bank-reconciliation/import', [\App\Modules\Accounting\Http\Controllers\AccountingPhase4Controller::class, 'importBankStatement'])->name('bank-reconciliation.import');
            Route::post('/bank-reconciliation/lines/{line}/match', [\App\Modules\Accounting\Http\Controllers\AccountingPhase4Controller::class, 'matchBankLine'])->name('bank-reconciliation.match');
            Route::post('/bank-reconciliation/lines/{line}/unmatch', [\App\Modules\Accounting\Http\Controllers\AccountingPhase4Controller::class, 'unmatchBankLine'])->name('bank-reconciliation.unmatch');
            Route::post('/bank-reconciliation/lines/{line}/ignore', [\App\Modules\Accounting\Http\Controllers\AccountingPhase4Controller::class, 'ignoreBankLine'])->name('bank-reconciliation.ignore');
            Route::get('/operations', [\App\Modules\Accounting\Http\Controllers\AccountingPhase4Controller::class, 'operations'])->name('operations.index');
            Route::post('/operations/payroll', [\App\Modules\Accounting\Http\Controllers\AccountingPhase4Controller::class, 'storePayrollVoucher'])->name('operations.payroll.store');
            Route::post('/operations/stock-adjustment', [\App\Modules\Accounting\Http\Controllers\AccountingPhase4Controller::class, 'storeStockAdjustmentVoucher'])->name('operations.stock.store');
            Route::post('/operations/opening-balance', [\App\Modules\Accounting\Http\Controllers\AccountingPhase4Controller::class, 'storeOpeningBalanceVoucher'])->name('operations.opening.store');
            Route::get('/reports/extra', [\App\Modules\Accounting\Http\Controllers\AccountingPhase4Controller::class, 'extraReports'])->name('extra-reports');
            Route::get('/reports/extra/export/{report}', [\App\Modules\Accounting\Http\Controllers\AccountingPhase4Controller::class, 'exportExtraReport'])->name('extra-reports.export');
        });

    // Pharmacist Clinical Workspace (All 9 Live Modules: Dashboard, Queue, Verify, Dispensing, Search, History, Stock/Expiry, Purchase Request, Returns, Controlled Drugs)
    Route::prefix('pharmacist')
        ->name('pharmacist.')
        ->middleware(['tenant.role:pharmacist,admin,manager'])
        ->group(function (): void {
            Route::get('/dashboard', [PharmacistPortalController::class, 'dashboard'])->name('dashboard');
            Route::get('/prescriptions', [PharmacistPortalController::class, 'queue'])->name('prescriptions');
            Route::get('/prescriptions/{rxId}/verify', [PharmacistPortalController::class, 'verify'])->name('prescriptions.verify');
            Route::post('/prescriptions/{rxId}/approve', [PharmacistPortalController::class, 'approve'])->name('prescriptions.approve');
            Route::post('/prescriptions/{rxId}/notify-doctor', [PharmacistPortalController::class, 'notifyDoctor'])->name('prescriptions.notify');
            Route::post('/prescriptions/{rxId}/reject', [PharmacistPortalController::class, 'reject'])->name('prescriptions.reject');

            Route::get('/dispensing', [PharmacistPortalController::class, 'dispensing'])->name('dispensing');
            Route::get('/medicine-search', [PharmacistPortalController::class, 'medicineSearch'])->name('medicine-search');

            Route::get('/patient-history', [PharmacistPortalController::class, 'patientHistory'])->name('patient-history');
            Route::post('/patients/allergy', [PharmacistPortalController::class, 'addPatientAllergy'])->name('patients.allergy');

            Route::get('/stock-expiry', [PharmacistPortalController::class, 'stockExpiry'])->name('stock-expiry');
            Route::post('/stock-expiry/quarantine', [PharmacistPortalController::class, 'quarantineBatch'])->name('stock-expiry.quarantine');

            Route::get('/purchase-requests', [PharmacistPortalController::class, 'purchaseRequests'])->name('purchase-requests');
            Route::post('/purchase-requests', [PharmacistPortalController::class, 'requestPurchase'])->name('purchase-requests.store');

            Route::get('/returns', [PharmacistPortalController::class, 'returns'])->name('returns');
            Route::post('/returns', [PharmacistPortalController::class, 'storeReturnEntry'])->name('returns.store');

            Route::get('/controlled-drugs', [PharmacistPortalController::class, 'controlledDrugs'])->name('controlled-drugs');
            Route::post('/controlled-drugs/entry', [PharmacistPortalController::class, 'storeControlledEntry'])->name('controlled-drugs.entry');
            Route::post('/controlled-drugs/reconcile', [PharmacistPortalController::class, 'reconcileControlled'])->name('controlled-drugs.reconcile');
        });

    // Cashier Workstation & Dynamic Queue Dashboard
    Route::get('/cashier/dashboard', [CashierDashboardController::class, 'dashboard'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.process,cashier,admin,manager'])
        ->name('cashier.dashboard');
    Route::post('/cashier/shift/auto-open', [CashierDashboardController::class, 'autoOpenShift'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.process,cashier,admin,manager'])
        ->name('cashier.shift.auto-open');
    Route::post('/cashier/shift/resume', [CashierDashboardController::class, 'resumeShift'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.process,cashier,admin,manager'])
        ->name('cashier.shift.resume');
    Route::post('/cashier/orders/{sale}/accept', [CashierDashboardController::class, 'accept'])
        ->middleware(['feature:pos', 'tenant.role:sales_orders.process,cashier,admin,manager'])
        ->name('cashier.orders.accept');
    Route::post('/cashier/orders/{sale}/pay', [CashierDashboardController::class, 'processPayment'])
        ->middleware(['feature:pos', 'tenant.role:payments.receive,cashier,admin,manager'])
        ->name('cashier.orders.pay');
    Route::post('/cashier/orders/{sale}/process-payment', [CashierDashboardController::class, 'processPayment'])
        ->middleware(['feature:pos', 'tenant.role:payments.receive,cashier,admin,manager'])
        ->name('cashier.orders.process-payment');
    Route::post('/cashier/orders/{sale}/request-reassign', [CashierDashboardController::class, 'requestReassign'])
        ->middleware(['feature:pos', 'tenant.role:cashier,admin,manager'])
        ->name('cashier.orders.request-reassign');
    Route::get('/cashier/orders/{sale}/invoice', [CashierDashboardController::class, 'invoice'])
        ->middleware(['feature:pos', 'tenant.role:invoices.print,cashier,admin,manager'])
        ->name('cashier.orders.invoice');

    Route::get('/inventory', [InventoryController::class, 'index'])
        ->middleware(['feature:inventory', 'tenant.role:inventory.view,inventory.manage,inventory.adjust,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.index');
    Route::get('/inventory/batches', [InventoryController::class, 'batches'])
        ->middleware(['feature:batch_expiry', 'tenant.role:inventory.view,inventory.manage,inventory.adjust,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.batches');
    Route::get('/inventory/movements', [InventoryController::class, 'movements'])
        ->middleware(['feature:batch_expiry', 'tenant.role:inventory.view,inventory.manage,inventory.adjust,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.movements');
    Route::get('/inventory/medicines/search', [InventoryController::class, 'searchMedicines'])
        ->middleware(['feature:inventory', 'tenant.role:inventory.view,inventory.manage,inventory.adjust,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.medicines.search');
    Route::get('/inventory/{medicineId}/batches', [InventoryController::class, 'medicineBatches'])
        ->whereNumber('medicineId')
        ->middleware(['feature:batch_expiry', 'tenant.role:inventory.view,inventory.manage,inventory.adjust,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.medicine.batches');

    Route::get('/catalog', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'uiIndex'])
        ->middleware(['feature:inventory', 'tenant.role:product.view,inventory.view,inventory.manage,inventory.adjust,admin,manager,pharmacist,inventory_clerk'])
        ->name('catalog.ui');

    // Phase 3: Catalog API Routes
    Route::prefix('api/catalog')->name('catalog.')->group(function (): void {
        Route::get('/products/search', [\App\Modules\Catalog\Http\Controllers\ProductSearchController::class, 'search'])->name('products.search');
        Route::get('/products/by-barcode/{code}', [\App\Modules\Catalog\Http\Controllers\ProductSearchController::class, 'byBarcode'])->name('products.by-barcode');

        Route::get('/products', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'index'])->name('products.index');
        Route::post('/products', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'store'])->name('products.store');
        Route::get('/products/{id}', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'show'])->name('products.show');
        Route::put('/products/{id}', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'update'])->name('products.update');
        Route::delete('/products/{id}', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'destroy'])->name('products.destroy');
        Route::post('/products/{id}/activate', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'activate'])->name('products.activate');
        Route::post('/products/{id}/deactivate', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'deactivate'])->name('products.deactivate');
        Route::post('/products/bulk', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'bulk'])->name('products.bulk');

        Route::get('/products/{id}/branch-settings', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'getBranchSettings'])->name('products.branch-settings.get');
        Route::put('/products/{id}/branch-settings', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'updateBranchSettings'])->name('products.branch-settings.update');

        Route::post('/products/{id}/barcodes', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'storeBarcode'])->name('products.barcodes.store');
        Route::delete('/products/{id}/barcodes/{barcodeId}', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'deleteBarcode'])->name('products.barcodes.destroy');
        Route::post('/products/{id}/barcodes/generate', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'generateInternalBarcode'])->name('products.barcodes.generate');
        Route::post('/products/barcodes/bulk-generate', [\App\Modules\Catalog\Http\Controllers\ProductController::class, 'bulkGenerateBarcodes'])->name('products.barcodes.bulk-generate');

        Route::get('/categories', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'categories'])->name('categories.index');
        Route::post('/categories', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'storeCategory'])->name('categories.store');
        Route::put('/categories/{id}', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'updateCategory'])->name('categories.update');
        Route::delete('/categories/{id}', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'deleteCategory'])->name('categories.destroy');

        Route::get('/companies', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'companies'])->name('companies.index');
        Route::post('/companies', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'storeCompany'])->name('companies.store');
        Route::put('/companies/{id}', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'updateCompany'])->name('companies.update');
        Route::delete('/companies/{id}', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'deleteCompany'])->name('companies.destroy');

        Route::get('/generics', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'generics'])->name('generics.index');
        Route::post('/generics', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'storeGeneric'])->name('generics.store');
        Route::put('/generics/{id}', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'updateGeneric'])->name('generics.update');
        Route::delete('/generics/{id}', [\App\Modules\Catalog\Http\Controllers\MasterDataController::class, 'deleteGeneric'])->name('generics.destroy');

        Route::get('/discount-rules', [\App\Modules\Catalog\Http\Controllers\DiscountRuleController::class, 'index'])->name('discount-rules.index');
        Route::post('/discount-rules', [\App\Modules\Catalog\Http\Controllers\DiscountRuleController::class, 'store'])->name('discount-rules.store');
        Route::put('/discount-rules/{id}', [\App\Modules\Catalog\Http\Controllers\DiscountRuleController::class, 'update'])->name('discount-rules.update');
        Route::delete('/discount-rules/{id}', [\App\Modules\Catalog\Http\Controllers\DiscountRuleController::class, 'destroy'])->name('discount-rules.destroy');

        Route::get('/imports/template', [\App\Modules\Catalog\Http\Controllers\ImportController::class, 'template'])->name('imports.template');
        Route::post('/imports', [\App\Modules\Catalog\Http\Controllers\ImportController::class, 'upload'])->name('imports.upload');
        Route::post('/imports/{id}/map', [\App\Modules\Catalog\Http\Controllers\ImportController::class, 'map'])->name('imports.map');
        Route::post('/imports/{id}/preview', [\App\Modules\Catalog\Http\Controllers\ImportController::class, 'preview'])->name('imports.preview');
        Route::post('/imports/{id}/start', [\App\Modules\Catalog\Http\Controllers\ImportController::class, 'start'])->name('imports.start');
        Route::post('/imports/{id}/undo', [\App\Modules\Catalog\Http\Controllers\ImportController::class, 'undo'])->name('imports.undo');
        Route::get('/imports/{id}', [\App\Modules\Catalog\Http\Controllers\ImportController::class, 'show'])->name('imports.show');
        Route::get('/imports/{id}/errors', [\App\Modules\Catalog\Http\Controllers\ImportController::class, 'errors'])->name('imports.errors');

        Route::post('/exports', [\App\Modules\Catalog\Http\Controllers\ExportController::class, 'export'])->name('exports.export');
        Route::post('/labels', [\App\Modules\Catalog\Http\Controllers\BarcodeLabelController::class, 'generate'])->name('labels.generate');
    });
    Route::post('/inventory', [InventoryController::class, 'store'])
        ->middleware(['feature:inventory', 'tenant.role:inventory.manage,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.store');
    Route::put('/inventory/{medicineId}', [InventoryController::class, 'update'])
        ->whereNumber('medicineId')
        ->middleware(['feature:inventory', 'tenant.role:inventory.manage,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.update');
    Route::patch('/inventory/{medicineId}/toggle', [InventoryController::class, 'toggleArchive'])
        ->whereNumber('medicineId')
        ->middleware(['feature:inventory', 'tenant.role:inventory.manage,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.toggle');
    Route::post('/inventory/categories', [InventoryController::class, 'storeCategory'])
        ->middleware(['feature:inventory', 'tenant.role:inventory.manage,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.categories.store');
    Route::post('/inventory/{medicineId}/batches', [InventoryController::class, 'storeBatch'])
        ->whereNumber('medicineId')
        ->middleware(['feature:inventory', 'tenant.role:inventory.manage,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.batches.store');
    Route::post('/inventory/batches/{batchId}/adjust', [InventoryController::class, 'adjustBatch'])
        ->whereNumber('batchId')
        ->middleware(['feature:inventory', 'tenant.role:inventory.adjust,stock.adjust,admin,manager,pharmacist'])
        ->name('inventory.batches.adjust');
    Route::post('/inventory/batches/{batchId}/transfer', [InventoryController::class, 'transferBatch'])
        ->whereNumber('batchId')
        ->middleware(['feature:stock_transfer', 'tenant.role:inventory.adjust,admin,manager'])
        ->name('inventory.batches.transfer');

    Route::get('/branches', [BranchController::class, 'index'])
        ->middleware(['feature:branches', 'tenant.role:branch.manage,branches.manage,admin,co_admin'])
        ->name('branches.index');
    Route::post('/branches', [BranchController::class, 'store'])
        ->middleware(['feature:branches', 'tenant.role:branch.manage,branches.manage,admin,co_admin'])
        ->name('branches.store');
    Route::patch('/branches/{branch}/toggle', [BranchController::class, 'toggleStatus'])
        ->middleware(['feature:branches', 'tenant.role:branch.manage,branches.manage,admin,co_admin'])
        ->name('branches.toggle');

    Route::get('/team', [TeamController::class, 'index'])
        ->middleware(['feature:team_rbac', 'tenant.role:user.manage,role.manage,audit.view,admin,co_admin,manager'])
        ->name('team.index');
    Route::post('/team', [TeamController::class, 'store'])
        ->middleware(['feature:team_rbac', 'tenant.role:user.manage,admin,co_admin,manager'])
        ->name('team.store');
    Route::put('/team/memberships/{membership}', [TeamController::class, 'updateMembership'])
        ->middleware(['feature:team_rbac', 'tenant.role:user.manage,admin,co_admin,manager'])
        ->name('team.memberships.update');
    Route::post('/team/roles', [TeamController::class, 'storeRole'])
        ->middleware(['feature:team_rbac', 'tenant.role:role.manage,admin'])
        ->name('team.roles.store');
    Route::put('/team/roles/{role}/permissions', [TeamController::class, 'updateRolePermissions'])
        ->middleware(['feature:team_rbac', 'tenant.role:role.manage,admin'])
        ->name('team.roles.permissions.update');
    Route::put('/team/roles/{role}/limits', [TeamController::class, 'updateRoleLimits'])
        ->middleware(['feature:team_rbac', 'tenant.role:role.manage,admin'])
        ->name('team.roles.limits.update');
    Route::delete('/team/roles/{role}', [TeamController::class, 'deleteRole'])
        ->middleware(['feature:team_rbac', 'tenant.role:role.manage,admin'])
        ->name('team.roles.delete');
    Route::post('/team/users/{targetUser}/overrides', [TeamController::class, 'storeOverride'])
        ->middleware(['feature:team_rbac', 'tenant.role:user.manage,role.manage,admin'])
        ->name('team.users.overrides.store');
    Route::delete('/team/overrides/{override}', [TeamController::class, 'deleteOverride'])
        ->middleware(['feature:team_rbac', 'tenant.role:user.manage,role.manage,admin'])
        ->name('team.overrides.delete');
    Route::post('/team/users/{targetUser}/pin', [TeamController::class, 'setPin'])
        ->middleware(['feature:team_rbac', 'tenant.role:user.manage,admin,manager'])
        ->name('team.users.pin');
    Route::post('/team/users/{targetUser}/reset-password', [TeamController::class, 'resetPassword'])
        ->middleware(['feature:team_rbac', 'tenant.role:user.manage,admin,manager'])
        ->name('team.users.reset-password');

    Route::get('/crm/customers', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'customers'])
        ->middleware(['feature:crm', 'tenant.role:crm.view,crm.manage,admin,manager,pharmacist,cashier,salesman'])
        ->name('crm.customers');
    Route::post('/crm/customers', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'storeCustomer'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,admin,manager,pharmacist'])
        ->name('crm.customers.store');
    Route::put('/crm/customers/{customer}', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'updateCustomer'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,admin,manager,pharmacist'])
        ->name('crm.customers.update');
    Route::get('/crm/customers/{customer}/profile', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'customerProfile'])
        ->middleware(['feature:crm', 'tenant.role:crm.view,crm.manage,admin,manager,pharmacist,cashier,salesman'])
        ->name('crm.customers.profile');
    Route::post('/crm/customers/{customer}/collect-due', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'collectDue'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,payments.receive,admin,manager,cashier,salesman'])
        ->name('crm.customers.collect-due');

    Route::get('/crm/followups', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'followups'])
        ->middleware(['feature:crm', 'tenant.role:crm.view,crm.manage,admin,manager,pharmacist,cashier,salesman'])
        ->name('crm.followups');
    Route::post('/crm/followups', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'storeFollowup'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,crm.view,admin,manager,pharmacist,salesman'])
        ->name('crm.followups.store');
    Route::patch('/crm/followups/{followup}/status', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'updateFollowupStatus'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,crm.view,admin,manager,pharmacist,salesman'])
        ->name('crm.followups.status');
    Route::delete('/crm/followups/{followup}', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'destroyFollowup'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,admin,manager'])
        ->name('crm.followups.destroy');

    Route::get('/crm/suppliers', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'suppliers'])
        ->middleware(['feature:crm', 'tenant.role:crm.view,crm.manage,admin,manager,inventory_clerk,pharmacist'])
        ->name('crm.suppliers');
    Route::post('/crm/suppliers', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'storeSupplier'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,admin,manager,inventory_clerk'])
        ->name('crm.suppliers.store');
    Route::patch('/crm/suppliers/{supplier}/toggle', [\App\Modules\CRM\Interfaces\Http\CrmHttpController::class, 'toggleSupplier'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,admin,manager,inventory_clerk'])
        ->name('crm.suppliers.toggle');

    Route::get('/settings/business', [SettingsController::class, 'business'])
        ->middleware('tenant.role:settings.manage,admin,manager')
        ->name('settings.business');
    Route::put('/settings/business', [SettingsController::class, 'updateBusiness'])
        ->middleware('tenant.role:settings.manage,admin,manager')
        ->name('settings.business.update');
});
