<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingSetting;
use App\Modules\Accounting\Models\SimpleCategory;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Models\VoucherLine;
use App\Modules\Accounting\Services\AccountingAccessService;
use App\Modules\Accounting\Services\AccountingBootstrapService;
use App\Modules\Accounting\Services\ChartOfAccountsTemplateService;
use App\Modules\Accounting\Services\FiscalPeriodService;
use App\Modules\Accounting\Services\MoneyPaisa;
use App\Modules\Accounting\Services\SimpleAccountingService;
use App\Modules\Accounting\Services\VoucherService;
use App\Modules\Core\Models\RolePermission;
use App\Services\TenantProvisioningService;
use App\Support\TenantContext;
use App\Tenancy\CurrentTenant;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacPermissionCatalogSeeder;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use LogicException;
use Tests\TestCase;

class AccountingPhase1Test extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenantA;

    private Branch $branchA1;

    private Branch $branchA2;

    private User $ownerA;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(RbacPermissionCatalogSeeder::class);

        $provisioning = app(TenantProvisioningService::class);
        $this->ownerA = User::factory()->create(['account_type' => 'admin']);
        $this->tenantA = $provisioning->createTenantForUser($this->ownerA, [
            'name' => 'Dhaka Med Pharmacy',
            'plan_key' => 'growth',
            'branch_name' => 'Dhanmondi Main',
            'branch_code' => 'DHM',
            'coa_template' => 'pharmacy',
            'accounting_mode' => 'simple',
        ]);

        $this->branchA1 = $this->tenantA->branches()->firstOrFail();

        $this->branchA2 = app(CurrentTenant::class)->run($this->tenantA, fn () => Branch::query()->create([
            'name' => 'Uttara Branch',
            'code' => 'UTR',
            'is_head_office' => false,
            'is_active' => true,
        ]));
    }

    public function test_three_coa_templates_seed_correctly_and_system_accounts_cannot_be_deleted(): void
    {
        $provisioning = app(TenantProvisioningService::class);

        // Pharmacy template (tenantA)
        app(CurrentTenant::class)->run($this->tenantA, function (): void {
            $codes = Account::query()->pluck('code')->all();
            $this->assertContains('1010', $codes); // Cash in Hand
            $this->assertContains('1200', $codes); // Inventory - Medicines
            $this->assertContains('4030', $codes); // Sales Returns (contra)
            $this->assertContains('5010', $codes); // COGS
            $this->assertContains('6030', $codes); // Electricity

            $cash = Account::query()->where('code', '1010')->firstOrFail();
            $this->assertTrue($cash->is_system);

            $this->expectException(DomainException::class);
            $cash->delete();
        });

        // Distributor template
        $ownerDist = User::factory()->create(['account_type' => 'admin']);
        $distTenant = $provisioning->createTenantForUser($ownerDist, [
            'name' => 'Bengal Med Distributors',
            'plan_key' => 'growth',
            'coa_template' => ChartOfAccountsTemplateService::TEMPLATE_DISTRIBUTOR,
        ]);

        app(CurrentTenant::class)->run($distTenant, function (): void {
            $names = Account::query()->pluck('name_en')->all();
            $this->assertContains('Sales Commission', $names);
            $this->assertContains('Delivery Vehicle Expense', $names);
            $this->assertContains('Trade Discount Allowed', $names);
        });

        // Hospital Pharmacy template
        $ownerHosp = User::factory()->create(['account_type' => 'admin']);
        $hospTenant = $provisioning->createTenantForUser($ownerHosp, [
            'name' => 'City Hospital Pharmacy',
            'plan_key' => 'growth',
            'coa_template' => ChartOfAccountsTemplateService::TEMPLATE_HOSPITAL_PHARMACY,
        ]);

        app(CurrentTenant::class)->run($hospTenant, function (): void {
            $names = Account::query()->pluck('name_en')->all();
            $this->assertContains('IPD Sales Receivable', $names);
            $this->assertContains('Insurance / Corporate Receivable', $names);
        });
    }

    public function test_unbalanced_voucher_is_rejected_and_rolled_back(): void
    {
        app(CurrentTenant::class)->run($this->tenantA, function (): void {
            $cash = Account::query()->where('code', '1010')->firstOrFail();
            $elec = Account::query()->where('code', '6030')->firstOrFail();

            try {
                app(VoucherService::class)->create([
                    'branch_id' => $this->branchA1->id,
                    'type' => 'payment',
                    'date' => now()->toDateString(),
                    'narration' => 'Unbalanced test',
                    'post_immediately' => true,
                    'lines' => [
                        ['account_id' => $elec->id, 'debit_paisa' => 320000, 'credit_paisa' => 0],
                        ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 310000],
                    ],
                ], $this->ownerA);

                $this->fail('Expected DomainException for unbalanced voucher.');
            } catch (DomainException $e) {
                $this->assertStringContainsString('unbalanced', strtolower($e->getMessage()));
            }

            $this->assertSame(0, Voucher::query()->count());
            $this->assertSame(0, VoucherLine::query()->count());
        });
    }

    public function test_posted_voucher_is_immutable_and_reversal_creates_equal_and_opposite_voucher(): void
    {
        app(CurrentTenant::class)->run($this->tenantA, function (): void {
            $cash = Account::query()->where('code', '1010')->firstOrFail();
            $elec = Account::query()->where('code', '6030')->firstOrFail();
            $service = app(VoucherService::class);

            $voucher = $service->create([
                'branch_id' => $this->branchA1->id,
                'type' => 'payment',
                'date' => now()->toDateString(),
                'narration' => 'DESCO bill',
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $elec->id, 'debit_paisa' => 320000, 'credit_paisa' => 0],
                    ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 320000],
                ],
            ], $this->ownerA);

            // Attempt direct edit -> must throw
            $editBlocked = false;
            try {
                $voucher->update(['narration' => 'Tampered']);
            } catch (DomainException) {
                $editBlocked = true;
            }
            $this->assertTrue($editBlocked, 'Posted voucher edit must be blocked.');

            // Attempt direct delete -> must throw
            $deleteBlocked = false;
            try {
                $voucher->delete();
            } catch (DomainException) {
                $deleteBlocked = true;
            }
            $this->assertTrue($deleteBlocked, 'Posted voucher delete must be blocked.');

            // Reverse -> creates equal & opposite voucher linked to original
            $reversal = $service->reverse($voucher, $this->ownerA, 'Entered twice by mistake');

            $voucher->refresh();
            $this->assertSame(Voucher::STATUS_REVERSED, $voucher->status);
            $this->assertSame($reversal->id, $voucher->reversed_voucher_id);
            $this->assertSame($voucher->id, $reversal->reversal_of_voucher_id);
            $this->assertSame(Voucher::STATUS_POSTED, $reversal->status);

            // Net balance across both vouchers for Electricity & Cash must be 0
            $netElec = (int) VoucherLine::query()->where('account_id', $elec->id)->selectRaw('SUM(debit_paisa - credit_paisa) as net')->value('net');
            $netCash = (int) VoucherLine::query()->where('account_id', $cash->id)->selectRaw('SUM(debit_paisa - credit_paisa) as net')->value('net');
            $this->assertSame(0, $netElec);
            $this->assertSame(0, $netCash);

            // Audit log recorded reversal
            $this->assertTrue(AuditLog::query()->where('action', 'accounting.voucher.reversed')->exists());
        });
    }

    public function test_posting_into_closed_period_fails_and_reopen_requires_permission_and_is_logged(): void
    {
        app(CurrentTenant::class)->run($this->tenantA, function (): void {
            app(TenantContext::class)->setTenant($this->tenantA, $this->branchA1, ['admin'], null, true);

            $periodService = app(FiscalPeriodService::class);
            $voucherService = app(VoucherService::class);

            $today = now()->toDateString();
            $period = $periodService->resolveForDate($today);

            // Close period as owner (has accounting.period.close)
            $periodService->closePeriod($period, $this->ownerA);
            $period->refresh();
            $this->assertTrue($period->isClosed());

            $cash = Account::query()->where('code', '1010')->firstOrFail();
            $elec = Account::query()->where('code', '6030')->firstOrFail();

            // Posting into closed period must fail
            $postingBlocked = false;
            try {
                $voucherService->create([
                    'branch_id' => $this->branchA1->id,
                    'type' => 'payment',
                    'date' => $today,
                    'post_immediately' => true,
                    'lines' => [
                        ['account_id' => $elec->id, 'debit_paisa' => 10000, 'credit_paisa' => 0],
                        ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 10000],
                    ],
                ], $this->ownerA);
            } catch (DomainException) {
                $postingBlocked = true;
            }
            $this->assertTrue($postingBlocked, 'Posting into closed period must fail.');

            // Custom role user WITHOUT accounting.period.reopen cannot reopen
            $juniorRole = Role::query()->create([
                'name' => 'Junior Clerk',
                'slug' => 'junior_clerk',
                'is_system' => false,
            ]);
            RolePermission::create([
                'role_id' => $juniorRole->id,
                'permission_key' => 'accounting.view',
                'scope' => 'branch',
            ]);
            $clerk = User::factory()->create([
                'account_type' => 'staff',
                'current_tenant_id' => $this->tenantA->id,
                'role_id' => $juniorRole->id,
            ]);
            app(TenantContext::class)->setTenant($this->tenantA, $this->branchA1, ['junior_clerk'], null, false);

            $reopenDenied = false;
            try {
                $periodService->reopenPeriod($period, $clerk, 'Trying without permission');
            } catch (AuthorizationException) {
                $reopenDenied = true;
            }
            $this->assertTrue($reopenDenied, 'User without accounting.period.reopen must be denied.');

            // Grant accounting.period.reopen dynamically to custom role -> reopen succeeds & is audit-logged
            RolePermission::create([
                'role_id' => $juniorRole->id,
                'permission_key' => 'accounting.period.reopen',
                'scope' => 'all',
            ]);
            $clerk->increment('permission_version');
            $clerk->refresh();

            $reopened = $periodService->reopenPeriod($period, $clerk, 'Late utility bill adjustment');
            $this->assertFalse($reopened->isClosed());

            $audit = AuditLog::query()->where('action', 'accounting.period.reopened')->latest('id')->first();
            $this->assertNotNull($audit);
            $this->assertSame('Late utility bill adjustment', $audit->metadata['reason'] ?? null);

            // Now posting succeeds cleanly
            $posted = $voucherService->create([
                'branch_id' => $this->branchA1->id,
                'type' => 'payment',
                'date' => $today,
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $elec->id, 'debit_paisa' => 10000, 'credit_paisa' => 0],
                    ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 10000],
                ],
            ], $this->ownerA);
            $this->assertSame(Voucher::STATUS_POSTED, $posted->status);
        });
    }

    public function test_sequential_voucher_numbers_have_no_gaps_or_duplicates_per_branch_type_and_fy(): void
    {
        app(CurrentTenant::class)->run($this->tenantA, function (): void {
            $cash = Account::query()->where('code', '1010')->firstOrFail();
            $elec = Account::query()->where('code', '6030')->firstOrFail();
            $service = app(VoucherService::class);

            $numbers = [];
            for ($i = 1; $i <= 5; $i++) {
                $v = $service->create([
                    'branch_id' => $this->branchA1->id,
                    'type' => 'payment',
                    'date' => now()->toDateString(),
                    'narration' => "Batch payment #{$i}",
                    'post_immediately' => true,
                    'lines' => [
                        ['account_id' => $elec->id, 'debit_paisa' => 10000 * $i, 'credit_paisa' => 0],
                        ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 10000 * $i],
                    ],
                ], $this->ownerA);
                $numbers[] = $v->number;
            }

            $this->assertCount(5, array_unique($numbers));
            $this->assertStringEndsWith('-000001', $numbers[0]);
            $this->assertStringEndsWith('-000002', $numbers[1]);
            $this->assertStringEndsWith('-000003', $numbers[2]);
            $this->assertStringEndsWith('-000004', $numbers[3]);
            $this->assertStringEndsWith('-000005', $numbers[4]);

            // Different branch starts its own independent sequence at 000001
            $otherBranchVoucher = $service->create([
                'branch_id' => $this->branchA2->id,
                'type' => 'payment',
                'date' => now()->toDateString(),
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $elec->id, 'debit_paisa' => 5000, 'credit_paisa' => 0],
                    ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 5000],
                ],
            ], $this->ownerA);
            $this->assertStringContainsString('PAY-UTR-', $otherBranchVoucher->number);
            $this->assertStringEndsWith('-000001', $otherBranchVoucher->number);
        });
    }

    public function test_simple_mode_expense_of_3200_bdt_creates_dr_electricity_cr_cash_in_paisa(): void
    {
        app(CurrentTenant::class)->run($this->tenantA, function (): void {
            $electricityCategory = SimpleCategory::query()
                ->where('kind', 'expense')
                ->where('code', 'electricity')
                ->firstOrFail();

            $amountPaisa = MoneyPaisa::fromBdt('3200.00');
            $this->assertSame(320000, $amountPaisa);

            $voucher = app(SimpleAccountingService::class)->recordSimpleEntry([
                'kind' => 'expense',
                'category_id' => $electricityCategory->id,
                'amount_paisa' => $amountPaisa,
                'payment_channel' => 'cash',
                'branch_id' => $this->branchA1->id,
                'date' => now()->toDateString(),
                'party_name' => 'DESCO',
                'note' => 'Monthly electricity bill',
            ], $this->ownerA);

            $this->assertSame(Voucher::STATUS_POSTED, $voucher->status);
            $this->assertSame(320000, $voucher->total_debit_paisa);
            $this->assertSame(320000, $voucher->total_credit_paisa);
            $this->assertCount(2, $voucher->lines);

            $debitLine = $voucher->lines->firstWhere('debit_paisa', '>', 0);
            $creditLine = $voucher->lines->firstWhere('credit_paisa', '>', 0);

            $this->assertSame('6030', $debitLine->account->code);
            $this->assertSame('Electricity', $debitLine->account->name_en);
            $this->assertSame(320000, $debitLine->debit_paisa);
            $this->assertSame(0, $debitLine->credit_paisa);

            $this->assertSame('1010', $creditLine->account->code);
            $this->assertSame('Cash in Hand', $creditLine->account->name_en);
            $this->assertSame(0, $creditLine->debit_paisa);
            $this->assertSame(320000, $creditLine->credit_paisa);
        });
    }

    public function test_money_round_trips_as_integer_paisa_with_no_float_errors(): void
    {
        $a = MoneyPaisa::fromBdt('0.10');
        $b = MoneyPaisa::fromBdt('0.20');
        $this->assertSame(30, $a + $b);
        $this->assertSame('0.30', MoneyPaisa::toDecimalString($a + $b));

        $large = MoneyPaisa::fromBdt('9,876,543.89');
        $this->assertSame(987654389, $large);
        $this->assertSame('9876543.89', MoneyPaisa::toDecimalString($large));
        $this->assertSame('৳9,876,543.89', MoneyPaisa::formatBdt($large));
    }

    public function test_tenant_isolation_and_branch_user_cannot_access_other_branch(): void
    {
        $provisioning = app(TenantProvisioningService::class);
        $ownerB = User::factory()->create(['account_type' => 'admin']);
        $tenantB = $provisioning->createTenantForUser($ownerB, [
            'name' => 'Chattogram Pharma',
            'plan_key' => 'growth',
            'branch_name' => 'Agrabad',
            'branch_code' => 'AGR',
        ]);
        $branchB = $tenantB->branches()->firstOrFail();

        // Post voucher in Tenant A
        app(CurrentTenant::class)->run($this->tenantA, function (): void {
            $cat = SimpleCategory::query()->where('code', 'electricity')->firstOrFail();
            app(SimpleAccountingService::class)->recordSimpleEntry([
                'kind' => 'expense',
                'category_id' => $cat->id,
                'amount_paisa' => 150000,
                'payment_channel' => 'cash',
                'branch_id' => $this->branchA1->id,
                'date' => now()->toDateString(),
            ], $this->ownerA);
        });

        // Tenant B cannot see Tenant A's vouchers or write with Tenant A's tenant_id
        app(CurrentTenant::class)->run($tenantB, function (): void {
            $this->assertSame(0, Voucher::query()->count());

            $crossTenantBlocked = false;
            try {
                Account::query()->create([
                    'tenant_id' => $this->tenantA->id,
                    'code' => '9999',
                    'name_en' => 'Cross Tenant Attempt',
                    'name_bn' => 'ক্রস টেন্যান্ট',
                    'type' => 'expense',
                    'report_group' => 'operating_expense',
                ]);
            } catch (LogicException) {
                $crossTenantBlocked = true;
            }
            $this->assertTrue($crossTenantBlocked, 'Writing another tenant_id must throw LogicException.');
        });

        // Branch-restricted user in Tenant A (assigned ONLY to branchA1) cannot query branchA2
        app(CurrentTenant::class)->run($this->tenantA, function (): void {
            $branchRole = Role::query()->create([
                'name' => 'Branch Accountant',
                'slug' => 'branch_accountant',
                'is_system' => false,
            ]);
            RolePermission::create([
                'role_id' => $branchRole->id,
                'permission_key' => 'accounting.view',
                'scope' => 'branch',
            ]);

            $branchUser = User::factory()->create([
                'account_type' => 'staff',
                'current_tenant_id' => $this->tenantA->id,
                'role_id' => $branchRole->id,
                'access_all_branches' => false,
            ]);
            $this->tenantA->users()->attach($branchUser->id, [
                'branch_id' => $this->branchA1->id,
                'is_owner' => false,
                'role' => 'branch_accountant',
                'roles' => json_encode(['branch_accountant']),
                'is_active' => true,
            ]);

            app(TenantContext::class)->setTenant($this->tenantA, $this->branchA1, ['branch_accountant'], null, false);
            $access = app(AccountingAccessService::class);

            // Default scope locks to branchA1
            $this->assertSame($this->branchA1->id, $access->resolveScopedBranchId($branchUser, null));

            // Attempting to tamper with ?branch_id=branchA2 throws AuthorizationException
            $tamperBlocked = false;
            try {
                $access->resolveScopedBranchId($branchUser, $this->branchA2->id);
            } catch (AuthorizationException) {
                $tamperBlocked = true;
            }
            $this->assertTrue($tamperBlocked, 'Branch user must be blocked from querying another branch.');
        });

        // Direct DB-level PostgreSQL RLS test when running on pgsql
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("DO \$do\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN CREATE ROLE app_user LOGIN PASSWORD 'secret' NOSUPERUSER; END IF; END \$do\$");
            DB::statement('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user');
            DB::statement('SET ROLE app_user');
            try {
                DB::statement("SELECT set_config('app.tenant_id', :id, false)", ['id' => (string) $tenantB->id]);
                $visibleInB = DB::select('SELECT id FROM vouchers');
                $this->assertCount(0, $visibleInB);

                DB::statement("SELECT set_config('app.tenant_id', :id, false)", ['id' => (string) $this->tenantA->id]);
                $visibleInA = DB::select('SELECT id FROM vouchers');
                $this->assertCount(1, $visibleInA);
            } finally {
                DB::statement('RESET ROLE');
            }
        }
    }

    public function test_mode_switch_preserves_data_and_profit_hidden_without_cost_and_profit_permission(): void
    {
        app(CurrentTenant::class)->run($this->tenantA, function (): void {
            $catInc = SimpleCategory::query()->where('code', 'medicine_sales')->firstOrFail();
            $catExp = SimpleCategory::query()->where('code', 'electricity')->firstOrFail();
            $simple = app(SimpleAccountingService::class);

            $simple->recordSimpleEntry([
                'kind' => 'income',
                'category_id' => $catInc->id,
                'amount_paisa' => 1000000, // ৳10,000
                'payment_channel' => 'cash',
                'branch_id' => $this->branchA1->id,
                'date' => now()->toDateString(),
            ], $this->ownerA);

            $simple->recordSimpleEntry([
                'kind' => 'expense',
                'category_id' => $catExp->id,
                'amount_paisa' => 320000, // ৳3,200
                'payment_channel' => 'cash',
                'branch_id' => $this->branchA1->id,
                'date' => now()->toDateString(),
            ], $this->ownerA);

            // Switch mode simple -> advanced -> simple with zero data loss
            $settings = AccountingSetting::query()->firstOrFail();
            $settings->update(['mode' => 'advanced']);
            $this->assertSame(2, Voucher::query()->count());
            $settings->update(['mode' => 'simple']);
            $this->assertSame(2, Voucher::query()->count());

            // With profit permission -> profit = 10,000 - 3,200 = ৳6,800 (680,000 paisa)
            $withProfit = $simple->dashboardSummary($this->tenantA->id, null, true);
            $this->assertSame(680000, $withProfit['month_profit_paisa']);

            // Without accounting.cost_and_profit.view -> profit and COGS are null
            $withoutProfit = $simple->dashboardSummary($this->tenantA->id, null, false);
            $this->assertNull($withoutProfit['month_profit_paisa']);
            $this->assertNull($withoutProfit['month_cogs_paisa']);
        });
    }

    public function test_multi_simple_entries_post_atomically_and_rollback_on_invalid_row(): void
    {
        app(CurrentTenant::class)->run($this->tenantA, function (): void {
            $catInc = SimpleCategory::query()->where('code', 'medicine_sales')->firstOrFail();
            $catExp = SimpleCategory::query()->where('code', 'electricity')->firstOrFail();
            $simple = app(SimpleAccountingService::class);
            $today = now()->toDateString();

            $vouchers = $simple->recordMultipleSimpleEntries([
                [
                    'kind' => 'income',
                    'category_id' => $catInc->id,
                    'amount_paisa' => 500000, // ৳5,000
                    'payment_channel' => 'cash',
                    'party_name' => 'Walk-in Batch',
                    'note' => 'Shift A counter',
                ],
                [
                    'kind' => 'expense',
                    'category_id' => $catExp->id,
                    'amount_paisa' => 120000, // ৳1,200
                    'payment_channel' => 'wallet',
                    'party_name' => 'DESCO',
                    'note' => 'Utility bill',
                ],
            ], $this->branchA1->id, $today, $this->ownerA);

            $this->assertCount(2, $vouchers);
            $this->assertSame(2, Voucher::query()->count());

            $summary = $simple->dashboardSummary($this->tenantA->id, $this->branchA1->id, true);
            $this->assertSame(500000, $summary['today_income_paisa']);
            $this->assertSame(120000, $summary['today_expense_paisa']);

            // If a later row fails, earlier row in the same batch must roll back
            $rolledBack = false;
            try {
                $simple->recordMultipleSimpleEntries([
                    [
                        'kind' => 'income',
                        'category_id' => $catInc->id,
                        'amount_paisa' => 90000,
                        'payment_channel' => 'cash',
                    ],
                    [
                        'kind' => 'expense',
                        'category_id' => 999999,
                        'amount_paisa' => 50000,
                        'payment_channel' => 'cash',
                    ],
                ], $this->branchA1->id, $today, $this->ownerA);
            } catch (DomainException) {
                $rolledBack = true;
            }

            $this->assertTrue($rolledBack, 'Invalid row inside multi-entry batch should throw DomainException.');
            $this->assertSame(2, Voucher::query()->count(), 'Partial multi-entry rows must not persist.');
        });
    }
}

