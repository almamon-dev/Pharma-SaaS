<?php

namespace App\Modules\Accounting\Providers;

use App\Modules\Accounting\Contracts\AccountingPosterInterface;
use App\Modules\Accounting\Services\AccountingAccessService;
use App\Modules\Accounting\Services\AccountingBootstrapService;
use App\Modules\Accounting\Services\AccountingCacheService;
use App\Modules\Accounting\Services\AccountingOverviewService;
use App\Modules\Accounting\Services\AutoPostingEngine;
use App\Modules\Accounting\Services\BankReconciliationService;
use App\Modules\Accounting\Services\ChartOfAccountsTemplateService;
use App\Modules\Accounting\Services\ExtraReportService;
use App\Modules\Accounting\Services\FinancialReportService;
use App\Modules\Accounting\Services\FiscalPeriodService;
use App\Modules\Accounting\Services\PartyService;
use App\Modules\Accounting\Services\SimpleAccountingService;
use App\Modules\Accounting\Services\VatService;
use App\Modules\Accounting\Services\VoucherSequenceService;
use App\Modules\Accounting\Services\VoucherService;
use Illuminate\Support\ServiceProvider;

class AccountingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AccountingCacheService::class);
        $this->app->singleton(ChartOfAccountsTemplateService::class);
        $this->app->singleton(AccountingBootstrapService::class);
        $this->app->singleton(FiscalPeriodService::class);
        $this->app->singleton(VoucherSequenceService::class);
        $this->app->singleton(VoucherService::class);
        $this->app->singleton(SimpleAccountingService::class);
        $this->app->singleton(AccountingAccessService::class);
        $this->app->singleton(PartyService::class);
        $this->app->singleton(VatService::class);
        $this->app->singleton(AutoPostingEngine::class);
        $this->app->singleton(FinancialReportService::class);
        $this->app->singleton(AccountingOverviewService::class);
        $this->app->singleton(BankReconciliationService::class);
        $this->app->singleton(ExtraReportService::class);
        $this->app->bind(AccountingPosterInterface::class, AutoPostingEngine::class);
    }

    public function boot(): void
    {
        //
    }
}

