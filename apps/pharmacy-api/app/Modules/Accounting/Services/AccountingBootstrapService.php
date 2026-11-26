<?php

namespace App\Modules\Accounting\Services;

use App\Models\Tenant;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingSetting;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Accounting\Models\SimpleCategory;
use App\Tenancy\CurrentTenant;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class AccountingBootstrapService
{
    public function __construct(
        private readonly CurrentTenant $currentTenant,
        private readonly ChartOfAccountsTemplateService $templateService,
    ) {}

    /**
     * Idempotently bootstrap Chart of Accounts, Fiscal Year + 12 monthly periods,
     * Accounting Settings, and default Simple Categories for a tenant.
     */
    public function bootstrapForTenant(
        Tenant $tenant,
        string $template = ChartOfAccountsTemplateService::TEMPLATE_PHARMACY,
        string $mode = 'simple',
        int $fiscalYearStartMonth = 7,
    ): AccountingSetting {
        return $this->currentTenant->run($tenant, function () use ($tenant, $template, $mode, $fiscalYearStartMonth): AccountingSetting {
            return DB::transaction(function () use ($tenant, $template, $mode, $fiscalYearStartMonth): AccountingSetting {
                // 1. Seed Chart of Accounts from template
                $accountsByCode = [];
                foreach ($this->templateService->accountsForTemplate($template) as $row) {
                    $account = Account::query()->firstOrCreate(
                        [
                            'tenant_id' => $tenant->id,
                            'code' => $row['code'],
                        ],
                        [
                            'name_en' => $row['name_en'],
                            'name_bn' => $row['name_bn'],
                            'type' => $row['type'],
                            'report_group' => $row['report_group'],
                            'is_contra' => (bool) ($row['is_contra'] ?? false),
                            'is_system' => (bool) ($row['is_system'] ?? false),
                            'is_active' => true,
                        ]
                    );
                    $accountsByCode[$account->code] = $account;
                }

                // 2. Seed Accounting Settings with default account mappings
                $settings = AccountingSetting::query()->firstOrCreate(
                    ['tenant_id' => $tenant->id],
                    [
                        'mode' => in_array($mode, ['simple', 'advanced'], true) ? $mode : 'simple',
                        'coa_template' => $template,
                        'fiscal_year_start_month' => max(1, min(12, $fiscalYearStartMonth)),
                        'default_currency' => $tenant->currency_code ?: 'BDT',
                        'vat_enabled' => false,
                        'vat_rate_bps' => 0,
                        'approval_threshold_paisa' => 0,
                        'default_cash_account_id' => $accountsByCode['1010']->id ?? null,
                        'default_bank_account_id' => $accountsByCode['1020']->id ?? null,
                        'default_wallet_account_id' => $accountsByCode['1030']->id ?? null,
                        'default_receivable_account_id' => $accountsByCode['1100']->id ?? null,
                        'default_payable_account_id' => $accountsByCode['2010']->id ?? null,
                        'default_inventory_account_id' => $accountsByCode['1200']->id ?? null,
                        'default_cogs_account_id' => $accountsByCode['5010']->id ?? null,
                        'default_sales_account_id' => $accountsByCode['4010']->id ?? null,
                        'default_sales_return_account_id' => $accountsByCode['4030']->id ?? null,
                        'default_vat_input_account_id' => $accountsByCode['1300']->id ?? null,
                        'default_vat_output_account_id' => $accountsByCode['2100']->id ?? null,
                        'default_retained_earnings_account_id' => $accountsByCode['3020']->id ?? null,
                    ]
                );

                // 3. Seed default Simple Mode Categories
                foreach ($this->templateService->defaultSimpleCategories() as $cat) {
                    SimpleCategory::query()->firstOrCreate(
                        [
                            'tenant_id' => $tenant->id,
                            'kind' => $cat['kind'],
                            'code' => $cat['code'],
                        ],
                        [
                            'name_en' => $cat['name_en'],
                            'name_bn' => $cat['name_bn'],
                            'debit_account_id' => $accountsByCode[$cat['debit_code']]->id ?? null,
                            'credit_account_id' => $accountsByCode[$cat['credit_code']]->id ?? null,
                            'is_system' => true,
                            'is_active' => true,
                        ]
                    );
                }

                // 4. Ensure current & previous fiscal years exist (covers 6+ months lookback safely)
                $now = CarbonImmutable::now();
                $this->ensureFiscalYearForDate($tenant, $now, $settings->fiscal_year_start_month);
                $this->ensureFiscalYearForDate($tenant, $now->subMonths(6), $settings->fiscal_year_start_month);

                return $settings;
            });
        });
    }

    public function ensureFiscalYearForDate(Tenant $tenant, CarbonImmutable $date, int $startMonth = 7): FiscalYear
    {
        $existing = FiscalYear::query()
            ->whereDate('start_date', '<=', $date->toDateString())
            ->whereDate('end_date', '>=', $date->toDateString())
            ->first();

        if ($existing) {
            return $existing;
        }

        $startYear = $date->month >= $startMonth ? $date->year : $date->year - 1;
        $startDate = CarbonImmutable::create($startYear, $startMonth, 1)->startOfDay();
        $endDate = $startDate->addYear()->subDay()->endOfDay();

        $name = $startMonth === 1
            ? "FY {$startYear}"
            : sprintf('FY %d-%d', $startYear, $startYear + 1);

        $fy = FiscalYear::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'name' => $name,
            ],
            [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'status' => 'open',
            ]
        );

        for ($i = 0; $i < 12; $i++) {
            $pStart = $startDate->addMonths($i)->startOfMonth();
            $pEnd = $pStart->endOfMonth();

            FiscalPeriod::query()->firstOrCreate(
                [
                    'tenant_id' => $tenant->id,
                    'fiscal_year_id' => $fy->id,
                    'period_number' => $i + 1,
                ],
                [
                    'name' => $pStart->format('M Y'),
                    'start_date' => $pStart->toDateString(),
                    'end_date' => $pEnd->toDateString(),
                    'status' => 'open',
                ]
            );
        }

        return $fy;
    }
}

