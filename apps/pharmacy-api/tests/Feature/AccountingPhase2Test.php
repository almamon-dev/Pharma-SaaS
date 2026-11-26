<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Contracts\AccountingPosterInterface;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\Party;
use App\Modules\Accounting\Models\PostingError;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Models\VoucherLine;
use App\Modules\Accounting\Services\FiscalPeriodService;
use App\Modules\Accounting\Services\MoneyPaisa;
use App\Modules\Accounting\Services\PartyService;
use App\Modules\Accounting\Services\VatService;
use App\Modules\Accounting\Services\VoucherService;
use App\Services\TenantProvisioningService;
use App\Support\TenantContext;
use App\Tenancy\CurrentTenant;
use Carbon\CarbonImmutable;
use Database\Seeders\PlanSeeder;
use Database\Seeders\RbacPermissionCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountingPhase2Test extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private Branch $branch;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(RbacPermissionCatalogSeeder::class);

        $provisioning = app(TenantProvisioningService::class);
        $this->owner = User::factory()->create(['account_type' => 'admin']);
        $this->tenant = $provisioning->createTenantForUser($this->owner, [
            'name' => 'Phase 2 Med Pharmacy',
            'plan_key' => 'growth',
            'branch_name' => 'Head Office',
            'branch_code' => 'HO',
            'coa_template' => 'pharmacy',
            'accounting_mode' => 'advanced',
        ]);
        $this->branch = $this->tenant->branches()->firstOrFail();
    }

    public function test_auto_posting_same_source_twice_creates_one_voucher_only(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $poster = app(AccountingPosterInterface::class);

            $payload = [
                'branch_id' => $this->branch->id,
                'date' => now()->toDateString(),
                'net_sales_paisa' => MoneyPaisa::fromBdt(10000),
                'vat_paisa' => MoneyPaisa::fromBdt(500),
                'vat_rate_bps' => 500,
                'cogs_paisa' => MoneyPaisa::fromBdt(7000),
                'payment_channel' => 'cash',
                'narration' => 'POS Invoice INV-1001',
            ];

            $first = $poster->postCashSale('INV-1001', $payload, $this->owner);
            $second = $poster->postCashSale('INV-1001', $payload, $this->owner);

            $this->assertNotNull($first);
            $this->assertNotNull($second);
            $this->assertSame($first->id, $second->id);
            $this->assertSame(1, Voucher::query()->where('source_id', 'INV-1001')->count());
            // Cash 10,500 + COGS 7,000 = 17,500 total balanced debit & credit
            $this->assertSame(MoneyPaisa::fromBdt(17500), $first->total_debit_paisa);
            $this->assertSame($first->total_debit_paisa, $first->total_credit_paisa);
        });
    }

    public function test_all_auto_posting_handlers_produce_balanced_trial_balance_and_reversible_by_source(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $poster = app(AccountingPosterInterface::class);
            $today = now()->toDateString();

            $customer = Party::query()->create(['type' => 'customer', 'name' => 'Clinic A', 'credit_limit_paisa' => MoneyPaisa::fromBdt(100000)]);
            $supplier = Party::query()->create(['type' => 'supplier', 'name' => 'Square Pharma', 'credit_limit_paisa' => 0]);

            // 1. Credit Sale + COGS + Output VAT
            $cs = $poster->postCreditSale('CS-01', [
                'branch_id' => $this->branch->id,
                'date' => $today,
                'party_id' => $customer->id,
                'net_sales_paisa' => 500000,
                'vat_paisa' => 25000,
                'vat_rate_bps' => 500,
                'cogs_paisa' => 350000,
            ], $this->owner);
            $this->assertNotNull($cs);

            // 2. Credit Purchase + Input VAT
            $cp = $poster->postCreditPurchase('PO-01', [
                'branch_id' => $this->branch->id,
                'date' => $today,
                'party_id' => $supplier->id,
                'inventory_paisa' => 400000,
                'vat_paisa' => 20000,
                'vat_rate_bps' => 500,
            ], $this->owner);
            $this->assertNotNull($cp);

            // 3. Customer Payment
            $this->assertNotNull($poster->postCustomerPayment('CP-01', [
                'branch_id' => $this->branch->id,
                'date' => $today,
                'party_id' => $customer->id,
                'amount_paisa' => 200000,
                'payment_channel' => 'bank',
            ], $this->owner));

            // 4. Supplier Payment
            $this->assertNotNull($poster->postSupplierPayment('SP-01', [
                'branch_id' => $this->branch->id,
                'date' => $today,
                'party_id' => $supplier->id,
                'amount_paisa' => 150000,
                'payment_channel' => 'bank',
            ], $this->owner));

            // 5. Sales Return + COGS Reversal
            $this->assertNotNull($poster->postSalesReturn('SR-01', [
                'branch_id' => $this->branch->id,
                'date' => $today,
                'party_id' => $customer->id,
                'net_return_paisa' => 100000,
                'vat_paisa' => 5000,
                'vat_rate_bps' => 500,
                'cogs_paisa' => 70000,
            ], $this->owner));

            // 6. Purchase Return
            $this->assertNotNull($poster->postPurchaseReturn('PR-01', [
                'branch_id' => $this->branch->id,
                'date' => $today,
                'party_id' => $supplier->id,
                'inventory_paisa' => 50000,
                'vat_paisa' => 2500,
                'vat_rate_bps' => 500,
            ], $this->owner));

            // 7. Expired Stock Write-off
            $this->assertNotNull($poster->postExpiredOrDamagedWriteOff('WO-01', [
                'branch_id' => $this->branch->id,
                'date' => $today,
                'cost_paisa' => 30000,
            ], $this->owner));

            // 8. Payroll (part paid, part payable)
            $this->assertNotNull($poster->postPayroll('PRL-01', [
                'branch_id' => $this->branch->id,
                'date' => $today,
                'gross_salary_paisa' => 600000,
                'paid_now_paisa' => 500000,
                'payment_channel' => 'bank',
            ], $this->owner));

            // Reverse by source when document cancelled
            $rev = $poster->reverseBySource('inventory', 'WO-01', 'expired_writeoff', $this->owner, 'Batch found valid');
            $this->assertNotNull($rev);
            $this->assertSame(Voucher::STATUS_POSTED, $rev->status);

            // Global Trial Balance check: SUM(debit_paisa) === SUM(credit_paisa) across all posted lines
            $totalDebit = (int) VoucherLine::query()
                ->whereHas('voucher', fn ($q) => $q->where('status', Voucher::STATUS_POSTED))
                ->sum('debit_paisa');
            $totalCredit = (int) VoucherLine::query()
                ->whereHas('voucher', fn ($q) => $q->where('status', Voucher::STATUS_POSTED))
                ->sum('credit_paisa');

            $this->assertGreaterThan(0, $totalDebit);
            $this->assertSame($totalDebit, $totalCredit, 'Trial balance debit total must equal credit total.');

            // VAT Summary verification:
            // Output VAT = +25,000 (sale) - 5,000 (return) = 20,000 paisa
            // Input VAT  = +20,000 (purchase) - 2,500 (purchase return) = 17,500 paisa
            // Net VAT Payable = 20,000 - 17,500 = 2,500 paisa (৳25.00)
            $vatSummary = app(VatService::class)->summary($this->tenant->id, null, $today, $today);
            $this->assertSame(20000, $vatSummary['output_vat_paisa']);
            $this->assertSame(17500, $vatSummary['input_vat_paisa']);
            $this->assertSame(2500, $vatSummary['net_vat_payable_paisa']);
        });
    }

    public function test_failed_auto_posting_captures_error_and_retry_resolves_after_period_reopened(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            app(TenantContext::class)->setTenant($this->tenant, $this->branch, ['admin'], null, true);

            $periodService = app(FiscalPeriodService::class);
            $poster = app(AccountingPosterInterface::class);
            $today = now()->toDateString();

            $period = $periodService->resolveForDate($today);
            $periodService->closePeriod($period, $this->owner);

            // Auto-posting into closed period must NOT throw; returns null and records posting_error
            $result = $poster->postCashSale('INV-CLOSED-1', [
                'branch_id' => $this->branch->id,
                'date' => $today,
                'net_sales_paisa' => 250000,
                'vat_paisa' => 0,
                'cogs_paisa' => 0,
                'payment_channel' => 'cash',
            ], $this->owner);

            $this->assertNull($result);

            $err = PostingError::query()->where('source_id', 'INV-CLOSED-1')->first();
            $this->assertNotNull($err);
            $this->assertSame(PostingError::STATUS_PENDING, $err->status);
            $this->assertStringContainsString('closed', strtolower($err->error));

            // Reopen period and retry -> succeeds and resolves error
            $periodService->reopenPeriod($period->fresh(), $this->owner, 'Reopened to retry failed POS posting');
            $retriedVoucher = $poster->retryPostingError($err, $this->owner);

            $this->assertNotNull($retriedVoucher);
            $this->assertSame(Voucher::STATUS_POSTED, $retriedVoucher->status);

            $err->refresh();
            $this->assertSame(PostingError::STATUS_RESOLVED, $err->status);
            $this->assertSame($retriedVoucher->id, $err->resolved_voucher_id);
            $this->assertSame(1, $err->retry_count);
        });
    }

    public function test_party_sync_credit_limit_ledger_and_fifo_ageing_buckets(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $crmCustomer = Customer::query()->create([
                'name' => 'City Care Hospital',
                'phone' => '01711000999',
            ]);
            Supplier::query()->create([
                'name' => 'Incepta Pharma',
                'phone' => '01712000888',
            ]);

            $partyService = app(PartyService::class);
            $partyService->syncFromCrm();

            $party = Party::query()->where('customer_id', $crmCustomer->id)->firstOrFail();
            $partyService->updateCreditLimit($party, MoneyPaisa::fromBdt(50000), $this->owner);
            $this->assertSame(5000000, $partyService->getCustomerCreditLimitPaisa($crmCustomer->id));

            $poster = app(AccountingPosterInterface::class);
            $asOf = CarbonImmutable::today();

            // 4 invoices across all 4 ageing buckets: 100d (৳10,000), 75d (৳20,000), 45d (৳30,000), 10d (৳40,000)
            $poster->postCreditSale('AGE-1', ['branch_id' => $this->branch->id, 'date' => $asOf->subDays(100)->toDateString(), 'party_id' => $party->id, 'net_sales_paisa' => 1000000, 'vat_paisa' => 0, 'cogs_paisa' => 0], $this->owner);
            $poster->postCreditSale('AGE-2', ['branch_id' => $this->branch->id, 'date' => $asOf->subDays(75)->toDateString(), 'party_id' => $party->id, 'net_sales_paisa' => 2000000, 'vat_paisa' => 0, 'cogs_paisa' => 0], $this->owner);
            $poster->postCreditSale('AGE-3', ['branch_id' => $this->branch->id, 'date' => $asOf->subDays(45)->toDateString(), 'party_id' => $party->id, 'net_sales_paisa' => 3000000, 'vat_paisa' => 0, 'cogs_paisa' => 0], $this->owner);
            $poster->postCreditSale('AGE-4', ['branch_id' => $this->branch->id, 'date' => $asOf->subDays(10)->toDateString(), 'party_id' => $party->id, 'net_sales_paisa' => 4000000, 'vat_paisa' => 0, 'cogs_paisa' => 0], $this->owner);

            // Customer pays ৳15,000 -> FIFO settles all of 100d (৳10,000) + ৳5,000 of 75d (leaving ৳15,000 in 61-90d)
            $poster->postCustomerPayment('AGE-PAY-1', [
                'branch_id' => $this->branch->id,
                'date' => $asOf->subDays(2)->toDateString(),
                'party_id' => $party->id,
                'amount_paisa' => 1500000,
                'payment_channel' => 'cash',
            ], $this->owner);

            $ageing = collect($partyService->partyAgeing($this->tenant->id, null, Party::TYPE_CUSTOMER, $asOf->toDateString()))
                ->firstWhere('id', $party->id);

            $this->assertNotNull($ageing);
            $this->assertSame(0, $ageing['bucket_90_plus_paisa']);
            $this->assertSame(1500000, $ageing['bucket_61_90_paisa']);
            $this->assertSame(3000000, $ageing['bucket_31_60_paisa']);
            $this->assertSame(4000000, $ageing['bucket_0_30_paisa']);
            $this->assertSame(8500000, $ageing['total_outstanding_paisa']);
            $this->assertTrue($ageing['over_credit_limit']); // ৳85,000 > ৳50,000 credit limit

            // Party ledger closing balance matches total outstanding (8,500,000 paisa)
            $ledger = $partyService->partyLedger($party, null, $asOf->subDays(120)->toDateString(), $asOf->toDateString());
            $this->assertSame(8500000, $ledger['closing_balance_paisa']);
            $this->assertCount(5, $ledger['entries']);
        });
    }

    public function test_contra_transfer_moves_cash_to_bank_accurately(): void
    {
        app(CurrentTenant::class)->run($this->tenant, function (): void {
            $cash = Account::query()->where('code', '1010')->firstOrFail();
            $bank = Account::query()->where('code', '1020')->firstOrFail();

            $v = app(VoucherService::class)->create([
                'branch_id' => $this->branch->id,
                'type' => 'contra',
                'date' => now()->toDateString(),
                'narration' => 'Deposit cash to bank',
                'post_immediately' => true,
                'lines' => [
                    ['account_id' => $bank->id, 'debit_paisa' => 500000, 'credit_paisa' => 0],
                    ['account_id' => $cash->id, 'debit_paisa' => 0, 'credit_paisa' => 500000],
                ],
            ], $this->owner);

            $this->assertStringStartsWith('CNT-HO-', $v->number);
            $this->assertSame(500000, $v->total_debit_paisa);
            $this->assertSame(500000, $v->total_credit_paisa);
        });
    }
}

