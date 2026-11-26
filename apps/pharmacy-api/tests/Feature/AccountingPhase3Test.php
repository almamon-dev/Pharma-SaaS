<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Core\Models\RolePermission;
use App\Modules\Accounting\Contracts\AccountingPosterInterface;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingSetting;
use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Models\VoucherLine;
use App\Modules\Accounting\Services\AccountingCacheService;
use App\Modules\Accounting\Services\AccountingOverviewService;
use App\Modules\Accounting\Services\FinancialReportService;
use App\Modules\Accounting\Services\FiscalPeriodService;
use App\Modules\Accounting\Services\MoneyPaisa;
use App\Modules\Accounting\Services\VoucherService;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacPermissionCatalogSeeder;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AccountingPhase3Test extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private Branch $branchA;

    private Branch $branchB;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(RbacPermissionCatalogSeeder::class);

        $provisioning = app(TenantProvisioningService::class);
        $this->owner = User::factory()->create(['account_type' => 'admin']);
        $this->tenant = $provisioning->createTenantForUser($this->owner, [
            'name' => 'Phase 3 Multi-Branch Pharmacy',
            'plan_key' => 'growth',
            'branch_name' => 'Dhanmondi HQ',
            'branch_code' => 'DHN',
            'coa_template' => 'pharmacy',
            'accounting_mode' => 'advanced',
        ]);
        $this->branchA = $this->tenant->branches()->firstOrFail();
        $this->branchB = app(CurrentTenant::class)->run($this->tenant, fn () => Branch::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Banani Branch',
            'code' => 'BAN',
            'is_active' => true,
            'is_head_office' => false,
        ]));
    }

    public function test_trial_balance_grand_totals_always_equal_across_mixed_vouchers_and_reversals(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $poster = app(AccountingPosterInterface::class);
            $vouchers = app(VoucherService::class);
            $reports = app(FinancialReportService::class);
            $today = now()->toDateString();

            $v1 = $poster->postCashSale('TB-SALE-1', [
                'branch_id' => $this->branchA->id,
                'date' => $today,
                'net_sales_paisa' => 1000000, // ৳10,000
                'vat_paisa' => 50000,         // ৳500
                'vat_rate_bps' => 500,
                'cogs_paisa' => 650000,       // ৳6,500
                'payment_channel' => 'cash',
            ], $this->owner);

            $v2 = $poster->postCashSale('TB-SALE-2', [
                'branch_id' => $this->branchB->id,
                'date' => $today,
                'net_sales_paisa' => 400000,
                'vat_paisa' => 0,
                'cogs_paisa' => 250000,
                'payment_channel' => 'bank',
            ], $this->owner);

            // Reverse v2 — reversal must keep Trial Balance balanced
            $vouchers->reverse($v2, $this->owner, 'Duplicate entry');

            $tb = $reports->trialBalance($this->tenant->id, null, now()->startOfMonth()->toDateString(), $today);

            $this->assertTrue($tb['balanced']);
            $this->assertSame(0, $tb['difference_paisa']);
            $this->assertSame($tb['totals']['period_debit_paisa'], $tb['totals']['period_credit_paisa']);
            $this->assertSame($tb['totals']['closing_debit_paisa'], $tb['totals']['closing_credit_paisa']);
            $this->assertGreaterThan(0, $tb['totals']['closing_debit_paisa']);
            $this->assertNotNull($v1);
        });
    }

    public function test_approval_workflow_enforces_threshold_and_requires_second_user(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            // Set approval threshold to ৳5,000 (500,000 paisa)
            AccountingSetting::query()->update(['approval_threshold_paisa' => 500000]);

            $cash = Account::query()->where('code', '1010')->firstOrFail();
            $rent = Account::query()->where('code', '6020')->firstOrFail();
            $vouchers = app(VoucherService::class);

            // Create a voucher for ৳8,000 (> ৳5,000 threshold) with post_immediately = true
            $voucher = $vouchers->create([
                'branch_id' => $this->branchA->id,
                'type' => 'journal',
                'date' => now()->toDateString(),
                'narration' => 'High-value shop rent accrual',
                'source_module' => 'manual',
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $rent->id, 'debit_paisa' => 800000, 'credit_paisa' => 0],
                    ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 800000],
                ],
            ], $this->owner);

            $this->assertSame(Voucher::STATUS_PENDING_APPROVAL, $voucher->status);
            $this->assertNull($voucher->number);

            // Creator cannot self-approve
            try {
                $vouchers->approve($voucher, $this->owner);
                $this->fail('Expected DomainException when creator attempts self-approval.');
            } catch (DomainException $e) {
                $this->assertStringContainsString('second user', $e->getMessage());
            }

            // Second user WITHOUT approval permission is denied
            $clerk = $this->createCustomRoleUser('clerk_no_approve', ['accounting.view', 'accounting.voucher.create']);
            try {
                $vouchers->approve($voucher, $clerk);
                $this->fail('Expected AuthorizationException when user lacks accounting.voucher.approve.');
            } catch (AuthorizationException $e) {
                $this->assertNotEmpty($e->getMessage());
            }

            // Second user WITH accounting.voucher.approve succeeds and posts atomically
            $approver = $this->createCustomRoleUser('finance_approver', ['accounting.view', 'accounting.voucher.approve']);
            $approved = $vouchers->approve($voucher, $approver);

            $this->assertSame(Voucher::STATUS_POSTED, $approved->status);
            $this->assertNotNull($approved->number);
            $this->assertSame($approver->id, $approved->approved_by);
            $this->assertTrue(
                AuditLog::query()
                    ->where('tenant_id', $this->tenant->id)
                    ->where('action', 'accounting.voucher.approved')
                    ->where('user_id', $approver->id)
                    ->exists()
            );
        });
    }

    public function test_year_end_closing_transfers_net_profit_to_retained_earnings_and_closes_periods(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $poster = app(AccountingPosterInterface::class);
            $vouchers = app(VoucherService::class);
            $periodSvc = app(FiscalPeriodService::class);
            $reports = app(FinancialReportService::class);

            $today = now()->toDateString();
            $period = $periodSvc->resolveForDate($today);
            /** @var FiscalYear $fy */
            $fy = $period->fiscalYear;

            // Revenue ৳20,000, COGS ৳12,000 => Gross Profit ৳8,000
            $poster->postCashSale('YE-1', [
                'branch_id' => $this->branchA->id,
                'date' => $today,
                'net_sales_paisa' => 2000000,
                'vat_paisa' => 0,
                'cogs_paisa' => 1200000,
                'payment_channel' => 'cash',
            ], $this->owner);

            // Operating Expense: Electricity ৳3,000 => Net Profit = ৳5,000 (500,000 paisa)
            $cash = Account::query()->where('code', '1010')->firstOrFail();
            $elec = Account::query()->where('code', '6030')->firstOrFail();
            $vouchers->create([
                'branch_id' => $this->branchA->id,
                'type' => 'payment',
                'date' => $today,
                'narration' => 'Electricity bill',
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $elec->id, 'debit_paisa' => 300000, 'credit_paisa' => 0],
                    ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 300000],
                ],
            ], $this->owner);

            $result = $periodSvc->closeFiscalYear($fy, $this->owner);

            $this->assertSame(500000, $result['net_profit_paisa']);
            $this->assertNotNull($result['closing_voucher']);
            $this->assertSame('closed', $result['fiscal_year']->status);
            $this->assertSame(0, $result['fiscal_year']->periods()->where('status', 'open')->count());

            // Retained Earnings (3020) now holds exact ৳5,000 credit balance
            $retained = Account::query()->where('code', '3020')->firstOrFail();
            $retainedLedger = $reports->generalLedger($this->tenant->id, $retained->id, null, $fy->start_date->toDateString(), $fy->end_date->toDateString());
            $this->assertSame(500000, $retainedLedger['closing_balance_paisa']);

            // Balance Sheet stays perfectly balanced after year-end close
            $bs = $reports->balanceSheet($this->tenant->id, null, $fy->end_date->toDateString(), true);
            $this->assertTrue($bs['balanced']);
            $this->assertSame(0, $bs['equity']['current_period_profit_paisa']);
        });
    }

    public function test_overview_pnl_totals_exact_and_draft_and_reversed_vouchers_change_nothing(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $poster = app(AccountingPosterInterface::class);
            $vouchers = app(VoucherService::class);
            $today = now()->toDateString();

            // Posted sale: Revenue ৳15,000, COGS ৳9,000
            $poster->postCashSale('OV-1', [
                'branch_id' => $this->branchA->id,
                'date' => $today,
                'net_sales_paisa' => 1500000,
                'vat_paisa' => 0,
                'cogs_paisa' => 900000,
                'payment_channel' => 'cash',
            ], $this->owner);

            // Posted expense: Salary ৳2,000
            $cash = Account::query()->where('code', '1010')->firstOrFail();
            $salary = Account::query()->where('code', '6010')->firstOrFail();
            $sales = Account::query()->where('code', '4010')->firstOrFail();

            $vouchers->create([
                'branch_id' => $this->branchA->id,
                'type' => 'payment',
                'date' => $today,
                'narration' => 'Staff salary',
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $salary->id, 'debit_paisa' => 200000, 'credit_paisa' => 0],
                    ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 200000],
                ],
            ], $this->owner);

            // Draft voucher for ৳99,999 — MUST NOT affect Overview
            $vouchers->create([
                'branch_id' => $this->branchA->id,
                'type' => 'journal',
                'date' => $today,
                'narration' => 'Draft unposted revenue',
                'post_immediately' => false,
                'lines' => [
                    ['account_id' => $cash->id, 'debit_paisa' => 9999900, 'credit_paisa' => 0],
                    ['account_id' => $sales->id, 'debit_paisa' => 0, 'credit_paisa' => 9999900],
                ],
            ], $this->owner);

            // Posted then reversed voucher for ৳50,000 — MUST net to 0 in Overview
            $toReverse = $vouchers->create([
                'branch_id' => $this->branchA->id,
                'type' => 'receipt',
                'date' => $today,
                'narration' => 'Mistaken receipt',
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $cash->id, 'debit_paisa' => 5000000, 'credit_paisa' => 0],
                    ['account_id' => $sales->id, 'debit_paisa' => 0, 'credit_paisa' => 5000000],
                ],
            ], $this->owner);
            $vouchers->reverse($toReverse, $this->owner, 'Posted by mistake', $today);
        });

        $response = $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->getJson(route('accounting.overview', ['period' => 'this_month', 'format' => 'json']));

        $response->assertOk();
        $ov = $response->json('overview');

        $this->assertTrue($ov['has_entries']);
        $this->assertSame(1500000, $ov['kpis']['revenue_paisa']);
        $this->assertSame(900000, $ov['profit_and_loss']['cogs_paisa']);
        $this->assertSame(600000, $ov['kpis']['gross_profit_paisa']);
        $this->assertSame(200000, $ov['profit_and_loss']['operating_expense_total_paisa']);
        $this->assertSame(400000, $ov['kpis']['net_profit_paisa']);
        $this->assertSame(1, $ov['attention']['draft_count']);
        $this->assertTrue($ov['balance_sheet']['balanced']);
    }

    public function test_balance_sheet_balanced_turns_false_when_test_data_corrupted(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $poster = app(AccountingPosterInterface::class);
            $reports = app(FinancialReportService::class);
            $today = now()->toDateString();

            $v = $poster->postCashSale('BS-CORRUPT-1', [
                'branch_id' => $this->branchA->id,
                'date' => $today,
                'net_sales_paisa' => 1000000,
                'vat_paisa' => 50000,
                'cogs_paisa' => 600000,
                'payment_channel' => 'cash',
            ], $this->owner);

            $bsClean = $reports->balanceSheet($this->tenant->id, null, $today, true);
            $this->assertTrue($bsClean['balanced']);
            $this->assertSame(0, $bsClean['difference_paisa']);

            // Deliberately corrupt a single voucher_line directly in DB (bypassing model guards)
            $lineId = VoucherLine::query()->where('voucher_id', $v->id)->where('debit_paisa', '>', 0)->value('id');
            DB::table('voucher_lines')->where('id', $lineId)->update(['debit_paisa' => 9999999]);

            $bsCorrupted = $reports->balanceSheet($this->tenant->id, null, $today, true);
            $this->assertFalse($bsCorrupted['balanced']);
            $this->assertNotSame(0, $bsCorrupted['difference_paisa']);
        });
    }

    public function test_previous_period_comparison_across_month_and_year_boundaries(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $poster = app(AccountingPosterInterface::class);
            $overviewSvc = app(AccountingOverviewService::class);

            // Dec 2025 revenue = ৳10,000
            $poster->postCashSale('YR-DEC-2025', [
                'branch_id' => $this->branchA->id,
                'date' => '2025-12-15',
                'net_sales_paisa' => 1000000,
                'vat_paisa' => 0,
                'cogs_paisa' => 600000,
                'payment_channel' => 'cash',
            ], $this->owner);

            // Jan 2026 revenue = ৳15,000 (+50.0% vs Dec 2025 across year boundary!)
            $poster->postCashSale('YR-JAN-2026', [
                'branch_id' => $this->branchA->id,
                'date' => '2026-01-15',
                'net_sales_paisa' => 1500000,
                'vat_paisa' => 0,
                'cogs_paisa' => 900000,
                'payment_channel' => 'cash',
            ], $this->owner);

            $ovYearBoundary = $overviewSvc->getOverview($this->tenant->id, null, '2026-01-01', '2026-01-31', true, true);
            $this->assertSame('2025-12-01', $ovYearBoundary['period']['prev_from']);
            $this->assertSame('2025-12-31', $ovYearBoundary['period']['prev_to']);
            $this->assertSame(1000000, $ovYearBoundary['kpis']['prev_revenue_paisa']);
            $this->assertSame(1500000, $ovYearBoundary['kpis']['revenue_paisa']);
            $this->assertSame(50.0, $ovYearBoundary['kpis']['revenue_change_pct']);

            // Month boundary check: Mar 1–15, 2026 (15 days) vs Feb 14–28, 2026 (15 days)
            $prevMonthBoundary = $overviewSvc->previousPeriodRange('2026-03-01', '2026-03-15');
            $this->assertSame('2026-02-14', $prevMonthBoundary['prev_from']);
            $this->assertSame('2026-02-28', $prevMonthBoundary['prev_to']);
            $this->assertSame(15, $prevMonthBoundary['days']);
        });
    }

    public function test_user_without_cost_and_profit_permission_gets_null_profit_and_cogs(): void
    {
        $restrictedUser = null;
        app(CurrentTenant::class)->run($this->tenant, function () use (&$restrictedUser): void {
            $poster = app(AccountingPosterInterface::class);
            $poster->postCashSale('PERM-SALE-1', [
                'branch_id' => $this->branchA->id,
                'date' => now()->toDateString(),
                'net_sales_paisa' => 1000000,
                'vat_paisa' => 0,
                'cogs_paisa' => 600000,
                'payment_channel' => 'cash',
            ], $this->owner);

            $restrictedUser = $this->createCustomRoleUser('cashier_reports_only', [
                'accounting.view',
                'accounting.reports.view',
            ]);
        });

        $response = $this->actingAs($restrictedUser)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->getJson(route('accounting.overview', ['period' => 'this_month', 'format' => 'json']));

        $response->assertOk();
        $ov = $response->json('overview');

        $this->assertFalse($ov['can_view_profit']);
        $this->assertSame(1000000, $ov['kpis']['revenue_paisa']);
        $this->assertNull($ov['kpis']['gross_profit_paisa']);
        $this->assertNull($ov['kpis']['gross_margin_pct']);
        $this->assertNull($ov['kpis']['net_profit_paisa']);
        $this->assertNull($ov['kpis']['net_margin_pct']);
        $this->assertNull($ov['profit_and_loss']['cogs_paisa']);
        $this->assertNull($ov['balance_sheet']['equity']['current_period_profit_paisa']);
        $this->assertSame([], $ov['branch_profit']);
    }

    public function test_overview_cache_is_invalidated_after_posting_a_voucher(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $overviewSvc = app(AccountingOverviewService::class);
            $cacheSvc = app(AccountingCacheService::class);
            $poster = app(AccountingPosterInterface::class);

            $from = now()->startOfMonth()->toDateString();
            $to = now()->endOfMonth()->toDateString();

            $vBefore = $cacheSvc->currentVersion($this->tenant->id);
            $first = $overviewSvc->getOverview($this->tenant->id, null, $from, $to, true, true);
            $this->assertSame(0, $first['kpis']['revenue_paisa']);

            // Post a new voucher -> MUST bump cache version and return fresh totals immediately
            $poster->postCashSale('CACHE-1', [
                'branch_id' => $this->branchA->id,
                'date' => now()->toDateString(),
                'net_sales_paisa' => 750000,
                'vat_paisa' => 0,
                'cogs_paisa' => 450000,
                'payment_channel' => 'cash',
            ], $this->owner);

            $this->assertGreaterThan($vBefore, $cacheSvc->currentVersion($this->tenant->id));
            $second = $overviewSvc->getOverview($this->tenant->id, null, $from, $to, true, true);
            $this->assertSame(750000, $second['kpis']['revenue_paisa']);
        });
    }

    public function test_mode_gating_print_voucher_en_bn_and_csv_exports(): void
    {
        $voucherId = null;
        app(CurrentTenant::class)->run($this->tenant, function () use (&$voucherId): void {
            $poster = app(AccountingPosterInterface::class);
            $v = $poster->postCashSale('PRT-1', [
                'branch_id' => $this->branchA->id,
                'date' => now()->toDateString(),
                'net_sales_paisa' => 500000,
                'vat_paisa' => 25000,
                'cogs_paisa' => 300000,
                'payment_channel' => 'cash',
            ], $this->owner);
            $voucherId = $v->id;

            // Switch to Simple Mode -> Journal & Balance Sheet blocked (403)
            AccountingSetting::query()->update(['mode' => 'simple']);
        });

        $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->get(route('accounting.journal.index'))
            ->assertStatus(403);

        $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->get(route('accounting.balance-sheet'))
            ->assertStatus(403);

        // Switch back to Advanced Mode -> Print EN/BN & CSV exports return 200
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            AccountingSetting::query()->update(['mode' => 'advanced']);
        });

        $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->get(route('accounting.vouchers.print', ['voucher' => $voucherId, 'lang' => 'en']))
            ->assertOk()
            ->assertSee('Sales Voucher');

        $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->get(route('accounting.vouchers.print', ['voucher' => $voucherId, 'lang' => 'bn']))
            ->assertOk()
            ->assertSee('বিক্রয় ভাউচার');

        $csvRes = $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->get(route('accounting.export', ['report' => 'trial-balance']));
        $csvRes->assertOk();
        $this->assertStringContainsString('text/csv', (string) $csvRes->headers->get('Content-Type'));
    }

    /**
     * @param  array<int, string>  $permissions
     */
    private function createCustomRoleUser(string $roleKey, array $permissions): User
    {
        $role = Role::query()->create([
            'name' => ucfirst(str_replace('_', ' ', $roleKey)),
            'slug' => $roleKey,
            'is_system' => false,
        ]);

        foreach ($permissions as $perm) {
            RolePermission::create([
                'role_id' => $role->id,
                'permission_key' => $perm,
                'scope' => 'all',
            ]);
        }

        $user = User::factory()->create([
            'account_type' => 'staff',
            'current_tenant_id' => $this->tenant->id,
            'role_id' => $role->id,
            'access_all_branches' => true,
        ]);

        $this->tenant->users()->attach($user->id, [
            'branch_id' => $this->branchA->id,
            'is_owner' => false,
            'role' => $roleKey,
            'roles' => json_encode([$roleKey]),
            'is_active' => true,
        ]);

        return $user;
    }
}
