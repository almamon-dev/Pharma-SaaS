<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Contracts\AccountingPosterInterface;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\BankStatement;
use App\Modules\Accounting\Services\AccountingBootstrapService;
use App\Modules\Accounting\Services\BankReconciliationService;
use App\Modules\Accounting\Services\MoneyPaisa;
use App\Tenancy\CurrentTenant;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class AccountingPhase4Seeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->first();
        if (! $tenant) {
            return;
        }

        $owner = User::query()->where('email', 'admin@pharmacore.test')->first() ?? User::query()->first();
        if (! $owner) {
            return;
        }

        app(AccountingBootstrapService::class)->bootstrapForTenant($tenant, 'pharmacy', 'advanced');

        app(CurrentTenant::class)->run($tenant, function () use ($tenant, $owner): void {
            $poster = app(AccountingPosterInterface::class);
            $recon = app(BankReconciliationService::class);

            // Ensure at least 2 additional branches for multi-branch Profit by Branch & Branch Comparison
            $extraBranches = [
                ['name' => 'Dhanmondi Branch', 'code' => 'DHN', 'address' => 'Satmasjid Road, Dhanmondi, Dhaka'],
                ['name' => 'Banani Branch', 'code' => 'BAN', 'address' => 'Road 11, Banani, Dhaka'],
            ];

            $branches = Branch::query()->where('is_active', true)->get();
            foreach ($extraBranches as $eb) {
                if (! $branches->contains(fn (Branch $b) => $b->code === $eb['code'])) {
                    Branch::query()->create([
                        'tenant_id' => $tenant->id,
                        'name' => $eb['name'],
                        'code' => $eb['code'],
                        'address' => $eb['address'],
                        'is_active' => true,
                        'is_head_office' => false,
                    ]);
                }
            }

            $allBranches = Branch::query()->where('is_active', true)->orderBy('id')->get();
            $today = CarbonImmutable::today();

            // Seed idempotent multi-branch sales, payroll, and expired stock write-off across last 3 months
            foreach ($allBranches->slice(1) as $idx => $branch) {
                for ($m = 0; $m < 3; $m++) {
                    $refDate = $today->subMonthsNoOverflow($m)->startOfMonth()->addDays(10)->toDateString();
                    $tag = "P4-B{$branch->id}-M{$m}";

                    $poster->postCashSale("{$tag}-SALE", [
                        'branch_id' => $branch->id,
                        'date' => $refDate,
                        'net_sales_paisa' => MoneyPaisa::fromBdt(140000 + ($idx * 35000) - ($m * 8000)),
                        'vat_paisa' => MoneyPaisa::fromBdt(7000 + ($idx * 1750)),
                        'vat_rate_bps' => 500,
                        'cogs_paisa' => MoneyPaisa::fromBdt(92000 + ($idx * 22000)),
                        'payment_channel' => $m % 2 === 0 ? 'bank' : 'cash',
                        'narration' => "{$branch->name} pharmacy sales ({$refDate})",
                    ], $owner);

                    $poster->postPayroll("{$tag}-PAY", [
                        'branch_id' => $branch->id,
                        'date' => $refDate,
                        'gross_salary_paisa' => MoneyPaisa::fromBdt(32000 + ($idx * 5000)),
                        'paid_now_paisa' => MoneyPaisa::fromBdt(32000 + ($idx * 5000)),
                        'payment_channel' => 'bank',
                        'narration' => "{$branch->name} staff payroll ({$refDate})",
                    ], $owner);
                }

                $poster->postExpiredOrDamagedWriteOff("P4-EXP-B{$branch->id}", [
                    'branch_id' => $branch->id,
                    'date' => $today->subDays(4)->toDateString(),
                    'cost_paisa' => MoneyPaisa::fromBdt(2450),
                    'narration' => "{$branch->name} expired blister batch write-off",
                ], $owner);
            }

            // Seed a sample Bank Statement for Bank Account (1020) if none exists yet
            $bankAcc = Account::query()->where('code', '1020')->first();
            if ($bankAcc && ! BankStatement::query()->where('account_id', $bankAcc->id)->exists()) {
                $stmtDate = $today->toDateString();
                $sampleDate1 = $today->startOfMonth()->addDays(10)->toDateString();
                $csv = implode("\n", [
                    'date,reference,description,debit,credit',
                    "{$sampleDate1},POS-DEP-01,Dhanmondi Branch Bank Settlement,0,147000.00",
                    "{$sampleDate1},PAY-NOV-01,Dhanmondi Staff Payroll Transfer,32000.00,0",
                    "{$stmtDate},CHG-991,Monthly Bank Maintenance Charge (Unmatched),575.00,0",
                ]);

                $recon->importCsv(
                    $bankAcc->id,
                    null,
                    $stmtDate,
                    "bank-statement-{$today->format('Y-m')}.csv",
                    $csv,
                    0,
                    MoneyPaisa::fromBdt(114425),
                    $owner,
                );
            }
        });
    }
}

