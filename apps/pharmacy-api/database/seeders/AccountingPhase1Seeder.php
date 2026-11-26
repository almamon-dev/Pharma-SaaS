<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Services\AccountingBootstrapService;
use App\Modules\Accounting\Services\MoneyPaisa;
use App\Modules\Accounting\Services\VoucherService;
use App\Tenancy\CurrentTenant;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class AccountingPhase1Seeder extends Seeder
{
    public function run(): void
    {
        $bootstrap = app(AccountingBootstrapService::class);
        $voucherService = app(VoucherService::class);
        $currentTenant = app(CurrentTenant::class);

        $tenants = Tenant::query()->get();
        foreach ($tenants as $idx => $tenant) {
            $mode = $idx === 0 ? 'simple' : 'advanced';
            $bootstrap->bootstrapForTenant($tenant, 'pharmacy', $mode, 7);

            $currentTenant->run($tenant, function () use ($tenant, $voucherService): void {
                if (Voucher::query()->exists()) {
                    return;
                }

                $branches = Branch::query()->where('is_active', true)->orderByDesc('is_head_office')->get();
                if ($branches->isEmpty()) {
                    return;
                }

                $actor = User::query()->find($tenant->owner_id) ?? User::query()->first();
                $accounts = Account::query()->get()->keyBy('code');

                $cash = $accounts['1010']->id;
                $bank = $accounts['1020']->id;
                $wallet = $accounts['1030']->id;
                $ar = $accounts['1100']->id;
                $inv = $accounts['1200']->id;
                $ap = $accounts['2010']->id;
                $capital = $accounts['3010']->id;
                $salesMed = $accounts['4010']->id;
                $otherInc = $accounts['4100']->id;
                $cogs = $accounts['5010']->id;
                $salary = $accounts['6010']->id;
                $rent = $accounts['6020']->id;
                $elec = $accounts['6030']->id;
                $transport = $accounts['6040']->id;
                $internet = $accounts['6050']->id;

                $headBranch = $branches->first();
                $now = CarbonImmutable::today();

                // Opening capital & initial inventory funded into head office 5 months ago
                $openingDate = $now->subMonths(5)->startOfMonth()->addDay()->toDateString();
                $voucherService->create([
                    'branch_id' => $headBranch->id,
                    'type' => 'opening_balance',
                    'date' => $openingDate,
                    'narration' => 'Opening capital & cash/bank/inventory balances',
                    'post_immediately' => true,
                    'lines' => [
                        ['account_id' => $cash, 'debit_paisa' => MoneyPaisa::fromBdt(250000), 'credit_paisa' => 0],
                        ['account_id' => $bank, 'debit_paisa' => MoneyPaisa::fromBdt(650000), 'credit_paisa' => 0],
                        ['account_id' => $wallet, 'debit_paisa' => MoneyPaisa::fromBdt(85000), 'credit_paisa' => 0],
                        ['account_id' => $inv, 'debit_paisa' => MoneyPaisa::fromBdt(920000), 'credit_paisa' => 0],
                        ['account_id' => $capital, 'debit_paisa' => 0, 'credit_paisa' => MoneyPaisa::fromBdt(1905000)],
                    ],
                ], $actor);

                // Seed 6 months of realistic monthly pharmacy operations across branches
                for ($m = 5; $m >= 0; $m--) {
                    $monthDate = $m === 0 ? $now : $now->subMonths($m)->startOfMonth()->addDays(12);
                    $d = $monthDate->toDateString();

                    foreach ($branches->take(3) as $bIdx => $branch) {
                        $scale = $bIdx === 0 ? 1.0 : ($bIdx === 1 ? 0.65 : 0.45);
                        $cashSales = (int) round(185000 * $scale) + ($m * 4500);
                        $walletSales = (int) round(62000 * $scale);
                        $creditSales = (int) round(48000 * $scale);
                        $totalSales = $cashSales + $walletSales + $creditSales;
                        $cogsVal = (int) round($totalSales * 0.72);
                        $purchaseCredit = (int) round($cogsVal * 0.95);

                        // Monthly Sales + COGS
                        $voucherService->create([
                            'branch_id' => $branch->id,
                            'type' => 'sales',
                            'date' => $d,
                            'narration' => "Medicine sales — {$branch->name} ({$monthDate->format('M Y')})",
                            'post_immediately' => true,
                            'lines' => [
                                ['account_id' => $cash, 'debit_paisa' => MoneyPaisa::fromBdt($cashSales), 'credit_paisa' => 0],
                                ['account_id' => $wallet, 'debit_paisa' => MoneyPaisa::fromBdt($walletSales), 'credit_paisa' => 0],
                                ['account_id' => $ar, 'debit_paisa' => MoneyPaisa::fromBdt($creditSales), 'credit_paisa' => 0],
                                ['account_id' => $salesMed, 'debit_paisa' => 0, 'credit_paisa' => MoneyPaisa::fromBdt($totalSales)],
                            ],
                        ], $actor);

                        $voucherService->create([
                            'branch_id' => $branch->id,
                            'type' => 'journal',
                            'date' => $d,
                            'narration' => "COGS recognition — {$branch->name} ({$monthDate->format('M Y')})",
                            'post_immediately' => true,
                            'lines' => [
                                ['account_id' => $cogs, 'debit_paisa' => MoneyPaisa::fromBdt($cogsVal), 'credit_paisa' => 0],
                                ['account_id' => $inv, 'debit_paisa' => 0, 'credit_paisa' => MoneyPaisa::fromBdt($cogsVal)],
                            ],
                        ], $actor);

                        // Stock purchase on credit + partial supplier payment
                        $voucherService->create([
                            'branch_id' => $branch->id,
                            'type' => 'purchase',
                            'date' => $d,
                            'narration' => "Medicine restock — Square & Beximco ({$monthDate->format('M Y')})",
                            'post_immediately' => true,
                            'lines' => [
                                ['account_id' => $inv, 'debit_paisa' => MoneyPaisa::fromBdt($purchaseCredit), 'credit_paisa' => 0],
                                ['account_id' => $ap, 'debit_paisa' => 0, 'credit_paisa' => MoneyPaisa::fromBdt($purchaseCredit)],
                            ],
                        ], $actor);

                        $supplierPaid = (int) round($purchaseCredit * 0.80);
                        $voucherService->create([
                            'branch_id' => $branch->id,
                            'type' => 'payment',
                            'date' => $d,
                            'narration' => "Supplier settlement via Bank — {$branch->name}",
                            'post_immediately' => true,
                            'lines' => [
                                ['account_id' => $ap, 'debit_paisa' => MoneyPaisa::fromBdt($supplierPaid), 'credit_paisa' => 0],
                                ['account_id' => $bank, 'debit_paisa' => 0, 'credit_paisa' => MoneyPaisa::fromBdt($supplierPaid)],
                            ],
                        ], $actor);

                        // Operating Expenses (Rent, Salary, Electricity, Transport, Internet)
                        $voucherService->create([
                            'branch_id' => $branch->id,
                            'type' => 'payment',
                            'date' => $d,
                            'narration' => "Shop Rent — {$branch->name}",
                            'post_immediately' => true,
                            'lines' => [
                                ['account_id' => $rent, 'debit_paisa' => MoneyPaisa::fromBdt((int) round(22000 * $scale)), 'credit_paisa' => 0],
                                ['account_id' => $bank, 'debit_paisa' => 0, 'credit_paisa' => MoneyPaisa::fromBdt((int) round(22000 * $scale))],
                            ],
                        ], $actor);

                        $voucherService->create([
                            'branch_id' => $branch->id,
                            'type' => 'payment',
                            'date' => $d,
                            'narration' => "Staff Salary — {$branch->name}",
                            'post_immediately' => true,
                            'lines' => [
                                ['account_id' => $salary, 'debit_paisa' => MoneyPaisa::fromBdt((int) round(28000 * $scale)), 'credit_paisa' => 0],
                                ['account_id' => $bank, 'debit_paisa' => 0, 'credit_paisa' => MoneyPaisa::fromBdt((int) round(28000 * $scale))],
                            ],
                        ], $actor);

                        $voucherService->create([
                            'branch_id' => $branch->id,
                            'type' => 'payment',
                            'date' => $d,
                            'narration' => "Electricity bill (DESCO) — {$branch->name}",
                            'post_immediately' => true,
                            'lines' => [
                                ['account_id' => $elec, 'debit_paisa' => MoneyPaisa::fromBdt((int) round(3800 * $scale)), 'credit_paisa' => 0],
                                ['account_id' => $cash, 'debit_paisa' => 0, 'credit_paisa' => MoneyPaisa::fromBdt((int) round(3800 * $scale))],
                            ],
                        ], $actor);

                        $voucherService->create([
                            'branch_id' => $branch->id,
                            'type' => 'payment',
                            'date' => $d,
                            'narration' => "Internet, phone & courier — {$branch->name}",
                            'post_immediately' => true,
                            'lines' => [
                                ['account_id' => $internet, 'debit_paisa' => MoneyPaisa::fromBdt(1500), 'credit_paisa' => 0],
                                ['account_id' => $transport, 'debit_paisa' => MoneyPaisa::fromBdt(1200), 'credit_paisa' => 0],
                                ['account_id' => $cash, 'debit_paisa' => 0, 'credit_paisa' => MoneyPaisa::fromBdt(2700)],
                            ],
                        ], $actor);
                    }
                }

                // Today's sample other income on head branch
                $voucherService->create([
                    'branch_id' => $headBranch->id,
                    'type' => 'receipt',
                    'date' => $now->toDateString(),
                    'narration' => 'Diagnostic referral commission received',
                    'post_immediately' => true,
                    'lines' => [
                        ['account_id' => $cash, 'debit_paisa' => MoneyPaisa::fromBdt(4500), 'credit_paisa' => 0],
                        ['account_id' => $otherInc, 'debit_paisa' => 0, 'credit_paisa' => MoneyPaisa::fromBdt(4500)],
                    ],
                ], $actor);
            });
        }
    }
}

