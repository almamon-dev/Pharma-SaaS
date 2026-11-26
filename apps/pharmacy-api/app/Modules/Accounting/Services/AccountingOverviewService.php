<?php

namespace App\Modules\Accounting\Services;

use App\Models\Branch;
use App\Modules\Accounting\Models\FiscalPeriod;
use App\Modules\Accounting\Models\Party;
use App\Modules\Accounting\Models\PostingError;
use App\Modules\Accounting\Models\Voucher;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class AccountingOverviewService
{
    public function __construct(
        private readonly AccountingCacheService $cacheService,
        private readonly SimpleAccountingService $simpleService,
        private readonly FinancialReportService $reportService,
        private readonly PartyService $partyService,
    ) {}

    /**
     * Resolve start/end date from preset (this_month, last_month, this_fiscal_year, custom).
     *
     * @return array{period_preset: string, from: string, to: string}
     */
    public function resolvePeriodDates(
        ?string $preset,
        ?string $fromInput,
        ?string $toInput,
        int $fiscalYearStartMonth = 7,
    ): array {
        $today = CarbonImmutable::today();
        $cleanPreset = in_array($preset, ['this_month', 'last_month', 'this_fiscal_year', 'custom'], true)
            ? $preset
            : (($fromInput && $toInput) ? 'custom' : 'this_month');

        if ($cleanPreset === 'last_month') {
            $ref = $today->subMonthNoOverflow();

            return [
                'period_preset' => 'last_month',
                'from' => $ref->startOfMonth()->toDateString(),
                'to' => $ref->endOfMonth()->toDateString(),
            ];
        }

        if ($cleanPreset === 'this_fiscal_year') {
            $startYear = $today->month >= $fiscalYearStartMonth ? $today->year : $today->year - 1;
            $fyStart = CarbonImmutable::create($startYear, $fiscalYearStartMonth, 1)->startOfDay();
            $fyEnd = $fyStart->addYear()->subDay();

            return [
                'period_preset' => 'this_fiscal_year',
                'from' => $fyStart->toDateString(),
                'to' => $fyEnd->toDateString(),
            ];
        }

        if ($cleanPreset === 'custom' && $fromInput && $toInput) {
            $f = CarbonImmutable::parse($fromInput);
            $t = CarbonImmutable::parse($toInput);
            if ($f->greaterThan($t)) {
                [$f, $t] = [$t, $f];
            }

            return [
                'period_preset' => 'custom',
                'from' => $f->toDateString(),
                'to' => $t->toDateString(),
            ];
        }

        return [
            'period_preset' => 'this_month',
            'from' => $today->startOfMonth()->toDateString(),
            'to' => $today->endOfMonth()->toDateString(),
        ];
    }

    /**
     * Compute the immediately prior period of identical day-length (handles month & year boundaries cleanly).
     *
     * @return array{prev_from: string, prev_to: string, days: int}
     */
    public function previousPeriodRange(string $from, string $to): array
    {
        $fromDate = CarbonImmutable::parse($from)->startOfDay();
        $toDate = CarbonImmutable::parse($to)->startOfDay();
        $spanDays = max(0, (int) $fromDate->diffInDays($toDate));
        $prevTo = $fromDate->subDay();
        $prevFrom = $prevTo->subDays($spanDays);

        return [
            'prev_from' => $prevFrom->toDateString(),
            'prev_to' => $prevTo->toDateString(),
            'days' => $spanDays + 1,
        ];
    }

    /**
     * Section 8 — Accounting Overview API & Page Data (cached 60 seconds, auto-invalidated on post/reverse/period change).
     *
     * @return array<string, mixed>
     */
    public function getOverview(
        int $tenantId,
        ?int $branchId,
        string $from,
        string $to,
        bool $canViewProfit,
        bool $isMultiBranch,
    ): array {
        return $this->cacheService->rememberOverview(
            $tenantId,
            $branchId,
            $from,
            $to,
            $canViewProfit,
            fn () => $this->buildOverviewPayload($tenantId, $branchId, $from, $to, $canViewProfit, $isMultiBranch)
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function buildOverviewPayload(
        int $tenantId,
        ?int $branchId,
        string $from,
        string $to,
        bool $canViewProfit,
        bool $isMultiBranch,
    ): array {
        $prevRange = $this->previousPeriodRange($from, $to);

        // 1. Check whether there are any posted (non-netted or active) vouchers in the period
        $postedCount = (int) DB::table('vouchers')
            ->where('tenant_id', $tenantId)
            ->whereIn('status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->count();

        // 2. Profit & Loss for current period and previous period
        $pnl = $this->simpleService->simpleProfitAndLoss($tenantId, $branchId, $from, $to, $canViewProfit);
        $prevPnl = $this->simpleService->simpleProfitAndLoss($tenantId, $branchId, $prevRange['prev_from'], $prevRange['prev_to'], $canViewProfit);

        $revenuePaisa = (int) $pnl['total_income_paisa'];
        $prevRevenuePaisa = (int) $prevPnl['total_income_paisa'];
        $revenueChangePct = $prevRevenuePaisa !== 0
            ? round((($revenuePaisa - $prevRevenuePaisa) / abs($prevRevenuePaisa)) * 100, 1)
            : null;

        $grossProfitPaisa = $canViewProfit ? $pnl['gross_profit_paisa'] : null;
        $netProfitPaisa = $canViewProfit ? $pnl['net_profit_paisa'] : null;
        $grossMarginPct = ($canViewProfit && $revenuePaisa > 0 && $grossProfitPaisa !== null)
            ? round(($grossProfitPaisa / $revenuePaisa) * 100, 1)
            : ($canViewProfit ? 0.0 : null);
        $netMarginPct = ($canViewProfit && $revenuePaisa > 0 && $netProfitPaisa !== null)
            ? round(($netProfitPaisa / $revenuePaisa) * 100, 1)
            : ($canViewProfit ? 0.0 : null);

        // 3. Cash & Bank balances as of $to
        $cashBankRows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '<=', $to)
            ->whereIn('a.report_group', ['cash', 'bank'])
            ->groupBy('a.report_group')
            ->selectRaw('a.report_group, SUM(vl.debit_paisa - vl.credit_paisa) as bal')
            ->pluck('bal', 'report_group');

        $cashPaisa = (int) ($cashBankRows['cash'] ?? 0);
        $bankPaisa = (int) ($cashBankRows['bank'] ?? 0);

        // 4. Enrich P&L operating expense rows with % of revenue
        $opExRows = array_map(function (array $row) use ($revenuePaisa): array {
            $row['pct_of_revenue'] = $revenuePaisa > 0
                ? round(($row['amount_paisa'] / $revenuePaisa) * 100, 1)
                : 0.0;

            return $row;
        }, $pnl['expense_lines']);

        // 5. Balance Sheet as of $to
        $balanceSheet = $this->reportService->balanceSheet($tenantId, $branchId, $to, $canViewProfit);

        // 6. Income vs Expense — last 6 months ending on month of $to
        $monthlySeries = $this->buildMonthlySeries($tenantId, $branchId, $to, $canViewProfit);

        // 7. Where the Money Went — operating expense breakdown sorted descending
        $expenseBreakdown = $opExRows;
        usort($expenseBreakdown, fn (array $a, array $b) => $b['amount_paisa'] <=> $a['amount_paisa']);
        $totalOpEx = (int) $pnl['operating_expense_paisa'];
        $expenseBreakdown = array_map(function (array $row) use ($totalOpEx): array {
            $row['pct_of_expenses'] = $totalOpEx > 0
                ? round(($row['amount_paisa'] / $totalOpEx) * 100, 1)
                : 0.0;

            return $row;
        }, $expenseBreakdown);

        // 8. Profit by Branch (hidden for single-branch tenants, when filtered to 1 branch, or without cost_and_profit permission)
        $branchProfit = ($isMultiBranch && $branchId === null && $canViewProfit)
            ? $this->buildBranchProfit($tenantId, $from, $to)
            : [];

        // 9. Receivable & Payable summary
        $receivablePayable = $this->buildReceivablePayable($tenantId, $branchId, $to);

        // 10. Needs Attention panel
        $attention = $this->buildNeedsAttention($tenantId, $branchId, $to);

        return [
            'generated_at' => now()->toIso8601String(),
            'period' => [
                'from' => $from,
                'to' => $to,
                'prev_from' => $prevRange['prev_from'],
                'prev_to' => $prevRange['prev_to'],
                'days' => $prevRange['days'],
            ],
            'can_view_profit' => $canViewProfit,
            'has_entries' => $postedCount > 0,
            'kpis' => [
                'revenue_paisa' => $revenuePaisa,
                'prev_revenue_paisa' => $prevRevenuePaisa,
                'revenue_change_pct' => $revenueChangePct,
                'gross_profit_paisa' => $grossProfitPaisa,
                'gross_margin_pct' => $grossMarginPct,
                'net_profit_paisa' => $netProfitPaisa,
                'net_margin_pct' => $netMarginPct,
                'cash_and_bank_paisa' => $cashPaisa + $bankPaisa,
                'cash_paisa' => $cashPaisa,
                'bank_paisa' => $bankPaisa,
            ],
            'profit_and_loss' => [
                'revenue_paisa' => (int) $pnl['revenue_paisa'],
                'other_income_paisa' => (int) $pnl['other_income_paisa'],
                'total_income_paisa' => $revenuePaisa,
                'cogs_paisa' => $canViewProfit ? $pnl['cogs_paisa'] : null,
                'cogs_pct_of_revenue' => ($canViewProfit && $revenuePaisa > 0 && $pnl['cogs_paisa'] !== null)
                    ? round(($pnl['cogs_paisa'] / $revenuePaisa) * 100, 1)
                    : ($canViewProfit ? 0.0 : null),
                'gross_profit_paisa' => $grossProfitPaisa,
                'gross_margin_pct' => $grossMarginPct,
                'operating_expenses' => $opExRows,
                'operating_expense_total_paisa' => $totalOpEx,
                'operating_expense_pct_of_revenue' => $revenuePaisa > 0 ? round(($totalOpEx / $revenuePaisa) * 100, 1) : 0.0,
                'net_profit_paisa' => $netProfitPaisa,
                'net_margin_pct' => $netMarginPct,
            ],
            'balance_sheet' => $balanceSheet,
            'monthly_series' => $monthlySeries,
            'expense_breakdown' => $expenseBreakdown,
            'branch_profit' => $branchProfit,
            'receivable_payable' => $receivablePayable,
            'attention' => $attention,
        ];
    }

    /**
     * Last 6 months Income vs Expense series ending on $to's month.
     *
     * @return array<int, array{month_key: string, month_label: string, income_paisa: int, expense_paisa: int}>
     */
    private function buildMonthlySeries(int $tenantId, ?int $branchId, string $to, bool $canViewProfit): array
    {
        $endMonth = CarbonImmutable::parse($to)->endOfMonth();
        $startMonth = $endMonth->subMonthsNoOverflow(5)->startOfMonth();

        $expenseGroups = $canViewProfit ? ['cogs', 'operating_expense'] : ['operating_expense'];
        $targetGroups = array_merge(['revenue', 'other_income'], $expenseGroups);

        $rows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '>=', $startMonth->toDateString())
            ->whereDate('v.date', '<=', $endMonth->toDateString())
            ->whereIn('a.report_group', $targetGroups)
            ->select(['v.date', 'a.report_group', 'vl.debit_paisa', 'vl.credit_paisa'])
            ->get();

        $buckets = [];
        for ($i = 5; $i >= 0; $i--) {
            $m = $endMonth->subMonthsNoOverflow($i);
            $key = $m->format('Y-m');
            $buckets[$key] = [
                'month_key' => $key,
                'month_label' => $m->format('M Y'),
                'income_paisa' => 0,
                'expense_paisa' => 0,
            ];
        }

        foreach ($rows as $r) {
            $key = substr((string) $r->date, 0, 7);
            if (! isset($buckets[$key])) {
                continue;
            }
            $d = (int) $r->debit_paisa;
            $c = (int) $r->credit_paisa;
            if (in_array($r->report_group, ['revenue', 'other_income'], true)) {
                $buckets[$key]['income_paisa'] += ($c - $d);
            } else {
                $buckets[$key]['expense_paisa'] += ($d - $c);
            }
        }

        return array_values($buckets);
    }

    /**
     * Per-branch Revenue, Expenses, and Net Profit.
     *
     * @return array<int, array<string, mixed>>
     */
    private function buildBranchProfit(int $tenantId, string $from, string $to): array
    {
        $branches = Branch::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderByDesc('is_head_office')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        if ($branches->count() < 2) {
            return [];
        }

        $rows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->whereDate('v.date', '>=', $from)
            ->whereDate('v.date', '<=', $to)
            ->whereIn('a.report_group', ['revenue', 'other_income', 'cogs', 'operating_expense'])
            ->groupBy('v.branch_id', 'a.report_group')
            ->selectRaw('v.branch_id, a.report_group, SUM(vl.debit_paisa) as total_debit, SUM(vl.credit_paisa) as total_credit')
            ->get();

        $byBranch = [];
        foreach ($branches as $b) {
            $byBranch[$b->id] = [
                'branch_id' => $b->id,
                'branch_name' => $b->name,
                'branch_code' => $b->code,
                'revenue_paisa' => 0,
                'cogs_paisa' => 0,
                'operating_expense_paisa' => 0,
                'net_profit_paisa' => 0,
                'margin_pct' => 0.0,
            ];
        }

        foreach ($rows as $r) {
            $bId = (int) $r->branch_id;
            if (! isset($byBranch[$bId])) {
                continue;
            }
            $d = (int) $r->total_debit;
            $c = (int) $r->total_credit;
            if (in_array($r->report_group, ['revenue', 'other_income'], true)) {
                $byBranch[$bId]['revenue_paisa'] += ($c - $d);
            } elseif ($r->report_group === 'cogs') {
                $byBranch[$bId]['cogs_paisa'] += ($d - $c);
            } else {
                $byBranch[$bId]['operating_expense_paisa'] += ($d - $c);
            }
        }

        foreach ($byBranch as &$item) {
            $item['net_profit_paisa'] = $item['revenue_paisa'] - $item['cogs_paisa'] - $item['operating_expense_paisa'];
            $item['margin_pct'] = $item['revenue_paisa'] > 0
                ? round(($item['net_profit_paisa'] / $item['revenue_paisa']) * 100, 1)
                : 0.0;
        }
        unset($item);

        $list = array_values($byBranch);
        usort($list, fn (array $a, array $b) => $b['net_profit_paisa'] <=> $a['net_profit_paisa']);

        return $list;
    }

    /**
     * Receivable & Payable summary with overdue > 60d and supplier bills due this week (23–30d credit cycle or overdue).
     *
     * @return array<string, int>
     */
    private function buildReceivablePayable(int $tenantId, ?int $branchId, string $asOf): array
    {
        $totals = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '<=', $asOf)
            ->whereIn('a.report_group', ['receivable', 'payable'])
            ->groupBy('a.report_group')
            ->selectRaw('a.report_group, SUM(vl.debit_paisa) as d, SUM(vl.credit_paisa) as c')
            ->get()
            ->keyBy('report_group');

        $customersOwe = isset($totals['receivable'])
            ? max(0, (int) $totals['receivable']->d - (int) $totals['receivable']->c)
            : 0;
        $owedToSuppliers = isset($totals['payable'])
            ? max(0, (int) $totals['payable']->c - (int) $totals['payable']->d)
            : 0;

        $customerAgeing = $this->partyService->partyAgeing($tenantId, $branchId, Party::TYPE_CUSTOMER, $asOf);
        $overdue60Plus = array_sum(array_column($customerAgeing, 'overdue_60_plus_paisa'));

        // Supplier invoices aged >= 23 days (assuming standard 30-day supplier credit terms -> due within 7 days or already due)
        $supplierAgeing = $this->partyService->partyAgeing($tenantId, $branchId, Party::TYPE_SUPPLIER, $asOf);
        $supplierDueThisWeek = 0;
        foreach ($supplierAgeing as $row) {
            $supplierDueThisWeek += (int) $row['bucket_31_60_paisa']
                + (int) $row['bucket_61_90_paisa']
                + (int) $row['bucket_90_plus_paisa'];
        }

        // Also check bills in the 23..30 day window if nothing is already >30d
        if ($supplierDueThisWeek === 0 && $owedToSuppliers > 0) {
            $asOfDate = CarbonImmutable::parse($asOf);
            $windowStart = $asOfDate->subDays(30)->toDateString();
            $windowEnd = $asOfDate->subDays(23)->toDateString();
            $dueSoonRaw = (int) DB::table('voucher_lines as vl')
                ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
                ->join('accounts as a', 'a.id', '=', 'vl.account_id')
                ->where('v.tenant_id', $tenantId)
                ->where('vl.tenant_id', $tenantId)
                ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
                ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
                ->where('a.report_group', 'payable')
                ->whereDate('v.date', '>=', $windowStart)
                ->whereDate('v.date', '<=', $windowEnd)
                ->selectRaw('COALESCE(SUM(vl.credit_paisa), 0) as amt')
                ->value('amt');
            $supplierDueThisWeek = min($owedToSuppliers, $dueSoonRaw);
        }

        return [
            'customers_owe_paisa' => $customersOwe,
            'overdue_60_plus_paisa' => $overdue60Plus,
            'owed_to_suppliers_paisa' => $owedToSuppliers,
            'supplier_due_this_week_paisa' => $supplierDueThisWeek,
        ];
    }

    /**
     * Needs Attention counts & current fiscal period status.
     *
     * @return array<string, mixed>
     */
    private function buildNeedsAttention(int $tenantId, ?int $branchId, string $asOf): array
    {
        $pendingApproval = (int) DB::table('vouchers')
            ->where('tenant_id', $tenantId)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->where('status', Voucher::STATUS_PENDING_APPROVAL)
            ->count();

        $drafts = (int) DB::table('vouchers')
            ->where('tenant_id', $tenantId)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->where('status', Voucher::STATUS_DRAFT)
            ->count();

        $failedPostings = (int) DB::table('posting_errors')
            ->where('tenant_id', $tenantId)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->where('status', PostingError::STATUS_PENDING)
            ->count();

        $unreconciledBank = (int) DB::table('bank_statement_lines as bsl')
            ->join('bank_statements as bs', 'bs.id', '=', 'bsl.bank_statement_id')
            ->where('bs.tenant_id', $tenantId)
            ->where('bsl.tenant_id', $tenantId)
            ->when($branchId !== null, fn ($q) => $q->where(fn ($sub) => $sub->where('bs.branch_id', $branchId)->orWhereNull('bs.branch_id')))
            ->where('bsl.status', 'unmatched')
            ->count();

        $period = FiscalPeriod::query()
            ->where('tenant_id', $tenantId)
            ->whereDate('start_date', '<=', $asOf)
            ->whereDate('end_date', '>=', $asOf)
            ->first();

        return [
            'pending_approval_count' => $pendingApproval,
            'draft_count' => $drafts,
            'failed_postings_count' => $failedPostings,
            'unreconciled_bank_count' => $unreconciledBank,
            'current_period_status' => $period?->status ?? 'open',
            'current_period_name' => $period?->name ?? CarbonImmutable::parse($asOf)->format('M Y'),
        ];
    }
}

