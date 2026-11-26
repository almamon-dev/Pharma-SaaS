<?php

namespace App\Modules\Accounting\Services;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingSetting;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Accounting\Models\Voucher;
use App\Tenancy\CurrentTenant;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Support\Facades\DB;

class FiscalPeriodService
{
    public function __construct(
        private readonly CurrentTenant $currentTenant,
        private readonly AccountingBootstrapService $bootstrapService,
        private readonly AccountingAccessService $accessService,
        private readonly AccountingCacheService $cacheService,
    ) {}

    public function resolveForDate(CarbonImmutable|string $date): FiscalPeriod
    {
        $target = is_string($date) ? CarbonImmutable::parse($date) : $date;
        $tenant = $this->currentTenant->get();

        $period = FiscalPeriod::query()
            ->whereDate('start_date', '<=', $target->toDateString())
            ->whereDate('end_date', '>=', $target->toDateString())
            ->first();

        if (! $period) {
            $startMonth = (int) (AccountingSetting::query()->value('fiscal_year_start_month') ?? 7);
            $this->bootstrapService->ensureFiscalYearForDate($tenant, $target, $startMonth);

            $period = FiscalPeriod::query()
                ->whereDate('start_date', '<=', $target->toDateString())
                ->whereDate('end_date', '>=', $target->toDateString())
                ->firstOrFail();
        }

        return $period;
    }

    public function assertOpenForPosting(FiscalPeriod $period): void
    {
        if ($period->isClosed()) {
            throw new DomainException("Fiscal period '{$period->name}' is closed. Reopen the period before posting entries into it.");
        }

        $fy = $period->fiscalYear;
        if ($fy && $fy->status === 'closed') {
            throw new DomainException("Fiscal year '{$fy->name}' is closed.");
        }
    }

    public function closePeriod(FiscalPeriod $period, User $actor): FiscalPeriod
    {
        $this->accessService->authorize($actor, 'accounting.period.close', 'You do not have permission to close fiscal periods.');

        if ($period->isClosed()) {
            throw new DomainException("Fiscal period '{$period->name}' is already closed.");
        }

        $before = ['status' => $period->status, 'closed_at' => $period->closed_at?->toIso8601String()];

        $period->forceFill([
            'status' => 'closed',
            'closed_at' => now(),
            'closed_by' => $actor->id,
        ])->save();

        $this->cacheService->invalidateTenant($this->currentTenant->id());

        AuditLog::record(
            action: 'accounting.period.closed',
            description: "Closed fiscal period {$period->name} ({$period->start_date->toDateString()} to {$period->end_date->toDateString()}).",
            subject: $period,
            metadata: [
                'entity' => 'fiscal_period',
                'entity_id' => $period->id,
                'before' => $before,
                'after' => ['status' => 'closed', 'closed_at' => $period->closed_at?->toIso8601String()],
            ],
            userId: $actor->id,
        );

        return $period->fresh();
    }

    public function reopenPeriod(FiscalPeriod $period, User $actor, ?string $reason = null): FiscalPeriod
    {
        $this->accessService->authorize($actor, 'accounting.period.reopen', 'You do not have permission to reopen closed fiscal periods.');

        if (! $period->isClosed()) {
            throw new DomainException("Fiscal period '{$period->name}' is already open.");
        }

        $before = ['status' => $period->status, 'closed_at' => $period->closed_at?->toIso8601String()];

        $period->forceFill([
            'status' => 'open',
            'reopened_at' => now(),
            'reopened_by' => $actor->id,
        ])->save();

        $this->cacheService->invalidateTenant($this->currentTenant->id());

        AuditLog::record(
            action: 'accounting.period.reopened',
            description: "Reopened fiscal period {$period->name}".($reason ? " — Reason: {$reason}" : '.'),
            subject: $period,
            metadata: [
                'entity' => 'fiscal_period',
                'entity_id' => $period->id,
                'reason' => $reason,
                'before' => $before,
                'after' => ['status' => 'open', 'reopened_at' => $period->reopened_at?->toIso8601String()],
            ],
            userId: $actor->id,
        );

        return $period->fresh();
    }

    /**
     * Year-end close: transfers net profit/loss of the fiscal year into Retained Earnings (3020),
     * closes all periods in the fiscal year, marks the fiscal year closed, and audit-logs.
     *
     * @return array{fiscal_year: FiscalYear, closing_voucher: Voucher|null, net_profit_paisa: int}
     */
    public function closeFiscalYear(FiscalYear $fiscalYear, User $actor): array
    {
        $this->accessService->authorize($actor, 'accounting.period.close', 'You do not have permission to close fiscal years.');

        if ($fiscalYear->status === 'closed') {
            throw new DomainException("Fiscal year '{$fiscalYear->name}' is already closed.");
        }

        return DB::transaction(function () use ($fiscalYear, $actor): array {
            $tenantId = $this->currentTenant->id();
            $from = $fiscalYear->start_date->toDateString();
            $to = $fiscalYear->end_date->toDateString();

            // Aggregate all income & expense accounts for this fiscal year
            $rows = DB::table('voucher_lines as vl')
                ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
                ->join('accounts as a', 'a.id', '=', 'vl.account_id')
                ->where('v.tenant_id', $tenantId)
                ->where('vl.tenant_id', $tenantId)
                ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
                ->whereDate('v.date', '>=', $from)
                ->whereDate('v.date', '<=', $to)
                ->whereIn('a.type', ['income', 'expense'])
                ->groupBy('a.id', 'a.code', 'a.name_en', 'a.type')
                ->selectRaw('a.id, a.code, a.name_en, a.type, SUM(vl.debit_paisa) as total_debit, SUM(vl.credit_paisa) as total_credit')
                ->get();

            $closingLines = [];
            $netProfitPaisa = 0;

            foreach ($rows as $row) {
                $netCredit = (int) $row->total_credit - (int) $row->total_debit;
                if ($netCredit === 0) {
                    continue;
                }
                // Positive netCredit (income) -> Debit account to zero it out; adds to Net Profit
                // Negative netCredit (expense) -> Credit account to zero it out; subtracts from Net Profit
                $netProfitPaisa += $netCredit;
                if ($netCredit > 0) {
                    $closingLines[] = [
                        'account_id' => (int) $row->id,
                        'debit_paisa' => $netCredit,
                        'credit_paisa' => 0,
                        'narration' => "Year-end close {$fiscalYear->name}: {$row->name_en}",
                    ];
                } else {
                    $closingLines[] = [
                        'account_id' => (int) $row->id,
                        'debit_paisa' => 0,
                        'credit_paisa' => abs($netCredit),
                        'narration' => "Year-end close {$fiscalYear->name}: {$row->name_en}",
                    ];
                }
            }

            $closingVoucher = null;
            if (! empty($closingLines)) {
                $retainedId = (int) (AccountingSetting::query()->value('default_retained_earnings_account_id')
                    ?? Account::query()->where('code', '3020')->value('id'));

                if (! $retainedId) {
                    throw new DomainException('Retained Earnings account (3020) is required for year-end closing.');
                }

                if ($netProfitPaisa > 0) {
                    $closingLines[] = [
                        'account_id' => $retainedId,
                        'debit_paisa' => 0,
                        'credit_paisa' => $netProfitPaisa,
                        'narration' => "Net profit transferred to Retained Earnings ({$fiscalYear->name})",
                    ];
                } elseif ($netProfitPaisa < 0) {
                    $closingLines[] = [
                        'account_id' => $retainedId,
                        'debit_paisa' => abs($netProfitPaisa),
                        'credit_paisa' => 0,
                        'narration' => "Net loss transferred to Retained Earnings ({$fiscalYear->name})",
                    ];
                }

                // Ensure the last period of the FY is open while posting the closing entry
                $lastPeriod = $fiscalYear->periods()->orderByDesc('period_number')->first();
                if ($lastPeriod && $lastPeriod->isClosed()) {
                    $lastPeriod->forceFill(['status' => 'open'])->save();
                }

                $headBranchId = (int) (Branch::query()->where('is_active', true)->orderByDesc('is_head_office')->value('id') ?? 1);
                $closingVoucher = app(VoucherService::class)->create([
                    'branch_id' => $headBranchId,
                    'type' => 'journal',
                    'date' => $to,
                    'narration' => "Year-end closing entry for {$fiscalYear->name}",
                    'source_module' => 'year_end_close',
                    'source_id' => (string) $fiscalYear->id,
                    'source_event' => 'year_end_close',
                    'skip_approval_check' => true,
                    'post_immediately' => true,
                    'lines' => $closingLines,
                ], $actor);
            }

            // Close all periods and the fiscal year itself
            $fiscalYear->periods()->where('status', 'open')->update([
                'status' => 'closed',
                'closed_at' => now(),
                'closed_by' => $actor->id,
                'updated_at' => now(),
            ]);

            $fiscalYear->forceFill([
                'status' => 'closed',
                'closed_at' => now(),
                'closed_by' => $actor->id,
            ])->save();

            $this->cacheService->invalidateTenant($tenantId);

            AuditLog::record(
                action: 'accounting.fiscal_year.closed',
                description: "Closed fiscal year {$fiscalYear->name}. Net profit/loss transferred to Retained Earnings: ".MoneyPaisa::formatBdt($netProfitPaisa).'.',
                subject: $fiscalYear,
                metadata: [
                    'entity' => 'fiscal_year',
                    'entity_id' => $fiscalYear->id,
                    'net_profit_paisa' => $netProfitPaisa,
                    'closing_voucher_id' => $closingVoucher?->id,
                    'closing_voucher_number' => $closingVoucher?->number,
                ],
                userId: $actor->id,
            );

            return [
                'fiscal_year' => $fiscalYear->fresh('periods'),
                'closing_voucher' => $closingVoucher,
                'net_profit_paisa' => $netProfitPaisa,
            ];
        });
    }
}

