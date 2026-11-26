<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Contracts\AccountingPosterInterface;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\Party;
use App\Modules\Accounting\Services\MoneyPaisa;
use App\Modules\Accounting\Services\PartyService;
use App\Modules\Accounting\Services\VatService;
use App\Modules\Accounting\Services\VoucherService;
use App\Tenancy\CurrentTenant;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class AccountingPhase2Seeder extends Seeder
{
    public function run(): void
    {
        $currentTenant = app(CurrentTenant::class);
        $partyService = app(PartyService::class);
        $poster = app(AccountingPosterInterface::class);
        $voucherService = app(VoucherService::class);

        foreach (Tenant::query()->get() as $tenant) {
            $currentTenant->run($tenant, function () use ($tenant, $partyService, $poster, $voucherService): void {
                $partyService->syncFromCrm();

                $branch = Branch::query()->where('is_active', true)->orderByDesc('is_head_office')->first();
                if (! $branch) {
                    return;
                }
                $actor = User::query()->find($tenant->owner_id) ?? User::query()->first();

                // Seed realistic B2B credit customers & medicine suppliers with multi-bucket ageing & VAT
                $c1 = Party::query()->firstOrCreate(
                    ['tenant_id' => $tenant->id, 'code' => 'CUS-HOSP-01'],
                    ['type' => 'customer', 'name' => 'Green Life Diagnostic & Hospital', 'phone' => '01711-889901', 'credit_limit_paisa' => MoneyPaisa::fromBdt(150000)]
                );
                $c2 = Party::query()->firstOrCreate(
                    ['tenant_id' => $tenant->id, 'code' => 'CUS-CLIN-02'],
                    ['type' => 'customer', 'name' => 'Dhanmondi Care Clinic', 'phone' => '01819-442211', 'credit_limit_paisa' => MoneyPaisa::fromBdt(75000)]
                );
                $s1 = Party::query()->firstOrCreate(
                    ['tenant_id' => $tenant->id, 'code' => 'SUP-SQ-01'],
                    ['type' => 'supplier', 'name' => 'Square Pharmaceuticals PLC', 'phone' => '01713-001122', 'credit_limit_paisa' => 0]
                );
                $s2 = Party::query()->firstOrCreate(
                    ['tenant_id' => $tenant->id, 'code' => 'SUP-BX-02'],
                    ['type' => 'supplier', 'name' => 'Beximco Pharmaceuticals Ltd.', 'phone' => '01713-334455', 'credit_limit_paisa' => 0]
                );

                $today = CarbonImmutable::today();

                // Credit sales across ageing buckets (15d, 45d, 75d, 105d) with 5% VAT (500 bps)
                $salesSeeds = [
                    ['id' => "DEMO-CS-{$tenant->id}-1", 'party' => $c1, 'daysAgo' => 12, 'net' => 42000, 'cogs' => 30000],
                    ['id' => "DEMO-CS-{$tenant->id}-2", 'party' => $c1, 'daysAgo' => 44, 'net' => 35000, 'cogs' => 25000],
                    ['id' => "DEMO-CS-{$tenant->id}-3", 'party' => $c2, 'daysAgo' => 75, 'net' => 28000, 'cogs' => 20000],
                    ['id' => "DEMO-CS-{$tenant->id}-4", 'party' => $c2, 'daysAgo' => 102, 'net' => 18500, 'cogs' => 13200],
                ];

                foreach ($salesSeeds as $s) {
                    $netPaisa = MoneyPaisa::fromBdt($s['net']);
                    $vatPaisa = VatService::calculateVatPaisa($netPaisa, 500);
                    $poster->postCreditSale($s['id'], [
                        'branch_id' => $branch->id,
                        'date' => $today->subDays($s['daysAgo'])->toDateString(),
                        'party_id' => $s['party']->id,
                        'net_sales_paisa' => $netPaisa,
                        'vat_paisa' => $vatPaisa,
                        'vat_rate_bps' => 500,
                        'cogs_paisa' => MoneyPaisa::fromBdt($s['cogs']),
                        'narration' => "B2B Credit Supply to {$s['party']->name}",
                    ], $actor);
                }

                // Partial customer collection
                $poster->postCustomerPayment("DEMO-CP-{$tenant->id}-1", [
                    'branch_id' => $branch->id,
                    'date' => $today->subDays(5)->toDateString(),
                    'party_id' => $c1->id,
                    'amount_paisa' => MoneyPaisa::fromBdt(20000),
                    'payment_channel' => 'bank',
                    'narration' => "Partial collection from {$c1->name}",
                ], $actor);

                // Credit purchases with 5% Input VAT across buckets
                $purchSeeds = [
                    ['id' => "DEMO-PO-{$tenant->id}-1", 'party' => $s1, 'daysAgo' => 18, 'inv' => 90000],
                    ['id' => "DEMO-PO-{$tenant->id}-2", 'party' => $s2, 'daysAgo' => 52, 'inv' => 65000],
                ];
                foreach ($purchSeeds as $p) {
                    $invPaisa = MoneyPaisa::fromBdt($p['inv']);
                    $vatPaisa = VatService::calculateVatPaisa($invPaisa, 500);
                    $poster->postCreditPurchase($p['id'], [
                        'branch_id' => $branch->id,
                        'date' => $today->subDays($p['daysAgo'])->toDateString(),
                        'party_id' => $p['party']->id,
                        'inventory_paisa' => $invPaisa,
                        'vat_paisa' => $vatPaisa,
                        'vat_rate_bps' => 500,
                        'narration' => "Stock purchase from {$p['party']->name}",
                    ], $actor);
                }

                // Contra transfer Cash -> Bank (idempotent check via source_id)
                $cashId = Account::query()->where('code', '1010')->value('id');
                $bankId = Account::query()->where('code', '1020')->value('id');
                if ($cashId && $bankId && ! \App\Modules\Accounting\Models\Voucher::query()->where('source_id', "DEMO-CNT-{$tenant->id}-1")->exists()) {
                    $voucherService->create([
                        'branch_id' => $branch->id,
                        'type' => 'contra',
                        'date' => $today->subDays(3)->toDateString(),
                        'narration' => 'Cash deposit to Dutch-Bangla Bank account',
                        'source_module' => 'manual',
                        'source_id' => "DEMO-CNT-{$tenant->id}-1",
                        'source_event' => 'contra',
                        'post_immediately' => true,
                        'lines' => [
                            ['account_id' => $bankId, 'debit_paisa' => MoneyPaisa::fromBdt(45000), 'credit_paisa' => 0, 'narration' => 'Bank deposit'],
                            ['account_id' => $cashId, 'debit_paisa' => 0, 'credit_paisa' => MoneyPaisa::fromBdt(45000), 'narration' => 'Cash transferred to bank'],
                        ],
                    ], $actor);
                }
            });
        }
    }
}

