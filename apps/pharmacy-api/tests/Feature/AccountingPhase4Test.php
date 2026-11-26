<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Contracts\AccountingPosterInterface;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\BankStatement;
use App\Modules\Accounting\Models\BankStatementLine;
use App\Modules\Accounting\Models\VoucherLine;
use App\Modules\Accounting\Services\AccountingOverviewService;
use App\Modules\Accounting\Services\BankReconciliationService;
use App\Modules\Accounting\Services\ExtraReportService;
use App\Modules\Accounting\Services\FinancialReportService;
use App\Modules\Accounting\Services\VoucherService;
use App\Modules\Core\Models\RolePermission;
use App\Services\TenantProvisioningService;
use App\Tenancy\CurrentTenant;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacPermissionCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountingPhase4Test extends TestCase
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
            'name' => 'Phase 4 Complete Pharmacy',
            'plan_key' => 'growth',
            'branch_name' => 'Head Office',
            'branch_code' => 'HO',
            'coa_template' => 'pharmacy',
            'accounting_mode' => 'advanced',
        ]);
        $this->branchA = $this->tenant->branches()->firstOrFail();
        $this->branchB = app(CurrentTenant::class)->run($this->tenant, fn () => Branch::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Uttara Branch',
            'code' => 'UTR',
            'is_active' => true,
            'is_head_office' => false,
        ]));
    }

    public function test_bank_reconciliation_csv_auto_match_manual_match_unmatch_and_overview_attention(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $poster = app(AccountingPosterInterface::class);
            $vouchers = app(VoucherService::class);
            $recon = app(BankReconciliationService::class);
            $overviewSvc = app(AccountingOverviewService::class);

            $bankAcc = Account::query()->where('code', '1020')->firstOrFail();
            $rentAcc = Account::query()->where('code', '6020')->firstOrFail();
            $today = now()->toDateString();
            $tenDaysAgo = now()->subDays(10)->toDateString();

            // 1. Bank deposit today for ৳25,000 (within ±3 days -> should auto-match)
            $poster->postCashSale('BK-DEP-1', [
                'branch_id' => $this->branchA->id,
                'date' => $today,
                'net_sales_paisa' => 2500000,
                'vat_paisa' => 0,
                'cogs_paisa' => 1500000,
                'payment_channel' => 'bank',
            ], $this->owner);

            // 2. Bank rent payment 10 days ago for ৳12,000 (> 3 days from statement date -> should stay unmatched for manual match!)
            $rentVoucher = $vouchers->create([
                'branch_id' => $this->branchA->id,
                'type' => 'payment',
                'date' => $tenDaysAgo,
                'narration' => 'Bank rent cheque',
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $rentAcc->id, 'debit_paisa' => 1200000, 'credit_paisa' => 0],
                    ['account_id' => $bankAcc->id, 'debit_paisa' => 0, 'credit_paisa' => 1200000],
                ],
            ], $this->owner);

            $rentBankLine = VoucherLine::query()
                ->where('voucher_id', $rentVoucher->id)
                ->where('account_id', $bankAcc->id)
                ->firstOrFail();

            $csv = implode("\n", [
                'date,reference,description,debit,credit',
                "{$today},DEP-001,POS Bank Settlement,0,25000.00",
                "{$today},CHQ-778,Cleared Rent Cheque,12000.00,0",
                "{$today},FEE-01,Bank SMS Charge,500.00,0",
            ]);

            $imported = $recon->importCsv(
                $bankAcc->id,
                $this->branchA->id,
                $today,
                'bank-nov.csv',
                $csv,
                0,
                1250000, // ৳12,500 closing statement balance (25,000 - 12,000 - 500)
                $this->owner,
            );

            $this->assertSame(3, $imported['total_lines']);
            $this->assertSame(1, $imported['auto_matched']);
            $this->assertSame(2, $imported['unmatched']);

            // Overview Needs Attention immediately reflects 2 unreconciled bank lines
            $ov = $overviewSvc->getOverview($this->tenant->id, null, now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString(), true, true);
            $this->assertSame(2, $ov['attention']['unreconciled_bank_count']);

            // Manually match the cleared rent cheque (৳12,000) to the ledger line from 10 days ago
            $chqLine = BankStatementLine::query()->where('reference', 'CHQ-778')->firstOrFail();
            $matched = $recon->manualMatch($chqLine, $rentBankLine, $this->owner);
            $this->assertSame(BankStatementLine::STATUS_MATCHED, $matched->status);
            $this->assertSame('manual', $matched->match_method);

            // Ignore the bank SMS charge -> statement becomes fully reconciled!
            $feeLine = BankStatementLine::query()->where('reference', 'FEE-01')->firstOrFail();
            $recon->ignoreLine($feeLine, $this->owner);

            $stmt = BankStatement::query()->findOrFail($imported['statement']->id);
            $this->assertSame(BankStatement::STATUS_RECONCILED, $stmt->status);

            // Overview now reflects 0 unreconciled bank lines
            $ovAfter = $overviewSvc->getOverview($this->tenant->id, null, now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString(), true, true);
            $this->assertSame(0, $ovAfter['attention']['unreconciled_bank_count']);

            // Unmatch returns statement back to in_progress
            $recon->unmatch($chqLine, $this->owner);
            $this->assertSame(BankStatement::STATUS_IN_PROGRESS, $stmt->fresh()->status);

            // Check summary difference: statement closing ৳12,500 vs book balance ৳13,000 (25,000 - 12,000) => diff -৳500
            $summary = $recon->summary($this->tenant->id, $this->branchA->id, $bankAcc->id, $stmt->id);
            $this->assertSame(1250000, $summary['metrics']['statement_closing_paisa']);
            $this->assertSame(1300000, $summary['metrics']['book_balance_paisa']);
            $this->assertSame(-50000, $summary['metrics']['raw_difference_paisa']);
        });
    }

    public function test_payroll_stock_adjustment_and_opening_balance_endpoints_keep_ledger_balanced(): void
    {
        $today = now()->toDateString();

        // 1. Opening balance: Cash ৳100,000
        $cashId = app(CurrentTenant::class)->run($this->tenant, fn () => Account::query()->where('code', '1010')->value('id'));
        $invId = app(CurrentTenant::class)->run($this->tenant, fn () => Account::query()->where('code', '1200')->value('id'));

        $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->post(route('accounting.operations.opening.store'), [
                'date' => $today,
                'branch_id' => $this->branchA->id,
                'account_id' => $cashId,
                'side' => 'debit',
                'amount' => '100000.00',
                'narration' => 'Opening cash balance',
            ])
            ->assertRedirect();

        // 2. Payroll: partial pay (gross ৳40,000, paid now ৳25,000 cash, accrued ৳15,000)
        $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->post(route('accounting.operations.payroll.store'), [
                'date' => $today,
                'branch_id' => $this->branchA->id,
                'mode' => 'partial_pay',
                'gross_salary' => '40000.00',
                'paid_now' => '25000.00',
                'payment_channel' => 'cash',
                'narration' => 'November staff salary',
            ])
            ->assertRedirect();

        // 3. Stock Adjustment: expired medicine write-off ৳3,500
        $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->post(route('accounting.operations.stock.store'), [
                'date' => $today,
                'branch_id' => $this->branchA->id,
                'reason_kind' => 'expired_damaged',
                'inventory_account_id' => $invId,
                'amount' => '3500.00',
                'narration' => 'Expired batch #EXP-01 write-off',
            ])
            ->assertRedirect();

        app(CurrentTenant::class)->run($this->tenant, function () use ($today): void {
            $reports = app(FinancialReportService::class);
            $tb = $reports->trialBalance($this->tenant->id, null, now()->startOfMonth()->toDateString(), $today);
            $bs = $reports->balanceSheet($this->tenant->id, null, $today, true);

            $this->assertTrue($tb['balanced']);
            $this->assertTrue($bs['balanced']);
            $this->assertSame(0, $tb['difference_paisa']);
            $this->assertSame(0, $bs['difference_paisa']);
        });
    }

    public function test_cash_flow_branch_comparison_and_inventory_valuation_reports(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $poster = app(AccountingPosterInterface::class);
            $vouchers = app(VoucherService::class);
            $extra = app(ExtraReportService::class);

            $today = now()->toDateString();
            $from = now()->startOfMonth()->toDateString();
            $cash = Account::query()->where('code', '1010')->firstOrFail();
            $bank = Account::query()->where('code', '1020')->firstOrFail();
            $capital = Account::query()->where('code', '3010')->firstOrFail();
            $equip = Account::query()->where('code', '1500')->firstOrFail();

            // Financing inflow: Owner capital ৳50,000 into Cash
            $vouchers->create([
                'branch_id' => $this->branchA->id,
                'type' => 'receipt',
                'date' => $today,
                'narration' => 'Owner capital injection',
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $cash->id, 'debit_paisa' => 5000000, 'credit_paisa' => 0],
                    ['account_id' => $capital->id, 'debit_paisa' => 0, 'credit_paisa' => 5000000],
                ],
            ], $this->owner);

            // Investing outflow: Bought pharmacy refrigerator ৳15,000 from Cash
            $vouchers->create([
                'branch_id' => $this->branchA->id,
                'type' => 'payment',
                'date' => $today,
                'narration' => 'Vaccine fridge purchase',
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $equip->id, 'debit_paisa' => 1500000, 'credit_paisa' => 0],
                    ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 1500000],
                ],
            ], $this->owner);

            // Contra transfer Cash -> Bank ৳20,000 (MUST NOT affect net cash flow!)
            $vouchers->create([
                'branch_id' => $this->branchA->id,
                'type' => 'contra',
                'date' => $today,
                'narration' => 'Cash deposited into bank',
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $bank->id, 'debit_paisa' => 2000000, 'credit_paisa' => 0],
                    ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 2000000],
                ],
            ], $this->owner);

            // Operating inflow across two branches
            $poster->postCashSale('CF-A', [
                'branch_id' => $this->branchA->id,
                'date' => $today,
                'net_sales_paisa' => 1000000,
                'vat_paisa' => 0,
                'cogs_paisa' => 600000,
                'payment_channel' => 'cash',
            ], $this->owner);

            $poster->postCashSale('CF-B', [
                'branch_id' => $this->branchB->id,
                'date' => $today,
                'net_sales_paisa' => 800000,
                'vat_paisa' => 0,
                'cogs_paisa' => 500000,
                'payment_channel' => 'bank',
            ], $this->owner);

            // 1. Cash Flow Statement exact reconciliation
            $cf = $extra->cashFlowStatement($this->tenant->id, null, $from, $today);
            $this->assertTrue($cf['reconciled']);
            $this->assertSame(5000000, $cf['financing']['net_paisa']);
            $this->assertSame(-1500000, $cf['investing']['net_paisa']);
            $this->assertSame(1800000, $cf['operating']['net_paisa']);
            $this->assertSame(5300000, $cf['closing_cash_paisa']);
            $this->assertSame($cf['closing_cash_paisa'], $cf['actual_closing_cash_paisa']);

            // 2. Branch Comparison with & without profit permission
            $bcFull = $extra->branchComparison($this->tenant->id, null, $from, $today, true);
            $this->assertCount(2, $bcFull['rows']);
            $this->assertSame(400000, $bcFull['rows'][0]['net_profit_paisa']);
            $this->assertSame(300000, $bcFull['rows'][1]['net_profit_paisa']);

            $bcMasked = $extra->branchComparison($this->tenant->id, null, $from, $today, false);
            $this->assertNull($bcMasked['rows'][0]['net_profit_paisa']);
            $this->assertNull($bcMasked['rows'][0]['cogs_paisa']);

            // 3. Inventory Valuation tracks COGS reduction (-৳11,000 total across sales)
            $inv = $extra->inventoryValuation($this->tenant->id, null, $from, $today);
            $this->assertSame(-1100000, $inv['ledger_total_paisa']);
            $this->assertNotEmpty($inv['movements']);
        });

        // Verify Phase 4 HTTP endpoints & CSV exports return 200
        $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->get(route('accounting.bank-reconciliation.index'))
            ->assertOk();

        $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->get(route('accounting.operations.index'))
            ->assertOk();

        $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->get(route('accounting.extra-reports'))
            ->assertOk();

        $csv = $this->actingAs($this->owner)
            ->withSession(['active_tenant_id' => $this->tenant->id])
            ->get(route('accounting.extra-reports.export', ['report' => 'cash-flow']));
        $csv->assertOk();
        $this->assertStringContainsString('text/csv', (string) $csv->headers->get('Content-Type'));
    }
}

