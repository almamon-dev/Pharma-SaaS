<?php

use App\Http\Controllers\Admin\SuperAdminController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\CrmController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\TenantController;
use App\Http\Controllers\TenantSwitchController;
use App\Http\Controllers\WelcomeController;
use Illuminate\Support\Facades\Route;

Route::get('/', WelcomeController::class)->name('welcome');
Route::get('/workspace/lookup', [WelcomeController::class, 'lookupWorkspace'])->name('workspace.lookup');

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
});

// Subscriber Admin Businesses / Tenants Management (available once subscribed)
Route::middleware(['auth', 'subscription.active'])->group(function (): void {
    Route::get('/tenants', [TenantController::class, 'index'])->name('tenants.index');
    Route::post('/tenants', [TenantController::class, 'store'])->name('tenants.store');
    Route::put('/tenants/{tenant}', [TenantController::class, 'update'])->name('tenants.update');

    Route::post('/tenant/switch', [TenantSwitchController::class, 'switchTenant'])->name('tenant.switch');
});

// Tenant Operations Workspace (requires Active Subscription + Active Tenant Context)
Route::middleware(['auth', 'subscription.active', 'tenant'])->group(function (): void {
    Route::post('/branch/switch', [TenantSwitchController::class, 'switchBranch'])->name('branch.switch');

    Route::get('/dashboard', DashboardController::class)->name('dashboard');
    Route::get('/features', [SubscriptionController::class, 'features'])->name('features.index');

    Route::get('/pos', [PosController::class, 'index'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,admin,manager,pharmacist,cashier'])
        ->name('pos.index');
    Route::post('/pos/checkout', [PosController::class, 'checkout'])
        ->middleware(['feature:pos', 'tenant.role:pos.sell,admin,manager,pharmacist,cashier'])
        ->name('pos.checkout');

    Route::get('/inventory', [InventoryController::class, 'index'])
        ->middleware(['feature:inventory', 'tenant.role:inventory.view,inventory.manage,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.index');
    Route::post('/inventory', [InventoryController::class, 'store'])
        ->middleware(['feature:inventory', 'tenant.role:inventory.manage,admin,manager,pharmacist,inventory_clerk'])
        ->name('inventory.store');

    Route::get('/branches', [BranchController::class, 'index'])
        ->middleware('feature:branches')
        ->name('branches.index');
    Route::post('/branches', [BranchController::class, 'store'])
        ->middleware(['feature:branches', 'tenant.role:branches.manage,admin,manager'])
        ->name('branches.store');
    Route::patch('/branches/{branch}/toggle', [BranchController::class, 'toggleStatus'])
        ->middleware(['feature:branches', 'tenant.role:branches.manage,admin,manager'])
        ->name('branches.toggle');

    Route::get('/team', [TeamController::class, 'index'])
        ->middleware(['feature:team_rbac', 'tenant.role:team.manage,admin,manager'])
        ->name('team.index');
    Route::post('/team', [TeamController::class, 'store'])
        ->middleware(['feature:team_rbac', 'tenant.role:team.manage,admin,manager'])
        ->name('team.store');
    Route::put('/team/memberships/{membership}', [TeamController::class, 'updateMembership'])
        ->middleware(['feature:team_rbac', 'tenant.role:team.manage,admin,manager'])
        ->name('team.memberships.update');
    Route::post('/team/roles', [TeamController::class, 'storeRole'])
        ->middleware(['feature:team_rbac', 'tenant.role:admin'])
        ->name('team.roles.store');

    Route::get('/crm/customers', [CrmController::class, 'customers'])
        ->middleware(['feature:crm', 'tenant.role:crm.view,crm.manage,admin,manager,pharmacist,cashier'])
        ->name('crm.customers');
    Route::post('/crm/customers', [CrmController::class, 'storeCustomer'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,admin,manager,pharmacist'])
        ->name('crm.customers.store');
    Route::put('/crm/customers/{customer}', [CrmController::class, 'updateCustomer'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,admin,manager,pharmacist'])
        ->name('crm.customers.update');

    Route::get('/crm/suppliers', [CrmController::class, 'suppliers'])
        ->middleware(['feature:crm', 'tenant.role:crm.view,crm.manage,admin,manager,inventory_clerk,pharmacist'])
        ->name('crm.suppliers');
    Route::post('/crm/suppliers', [CrmController::class, 'storeSupplier'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,admin,manager,inventory_clerk'])
        ->name('crm.suppliers.store');
    Route::patch('/crm/suppliers/{supplier}/toggle', [CrmController::class, 'toggleSupplier'])
        ->middleware(['feature:crm', 'tenant.role:crm.manage,admin,manager,inventory_clerk'])
        ->name('crm.suppliers.toggle');

    Route::get('/settings/business', [SettingsController::class, 'business'])
        ->middleware('tenant.role:settings.manage,admin,manager')
        ->name('settings.business');
    Route::put('/settings/business', [SettingsController::class, 'updateBusiness'])
        ->middleware('tenant.role:settings.manage,admin,manager')
        ->name('settings.business.update');
});
