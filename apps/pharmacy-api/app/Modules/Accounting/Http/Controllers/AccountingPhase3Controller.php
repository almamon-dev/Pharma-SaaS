<?php

namespace App\Modules\Accounting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingSetting;
use App\Modules\Accounting\Models\FiscalYear;
use App\Modules\Accounting\Models\Party;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Services\AccountingAccessService;
use App\Modules\Accounting\Services\AccountingBootstrapService;
use App\Modules\Accounting\Services\AccountingOverviewService;
use App\Modules\Accounting\Services\FinancialReportService;
use App\Modules\Accounting\Services\FiscalPeriodService;
use App\Modules\Accounting\Services\MoneyPaisa;
use App\Modules\Accounting\Services\PartyService;
use App\Modules\Accounting\Services\SimpleAccountingService;
use App\Modules\Accounting\Services\VoucherService;
use App\Support\TenantContext;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AccountingPhase3Controller extends Controller
{
    public function __construct(
        private readonly TenantContext $tenantContext,
        private readonly AccountingBootstrapService $bootstrapService,
        private readonly AccountingAccessService $accessService,
        private readonly AccountingOverviewService $overviewService,
        private readonly FinancialReportService $reportService,
        private readonly SimpleAccountingService $simpleService,
        private readonly VoucherService $voucherService,
        private readonly FiscalPeriodService $fiscalPeriodService,
        private readonly PartyService $partyService,
    ) {}

    /**
     * Section 8 — Accounting Overview (first page of Advanced Mode; supports JSON API & Inertia).
     */
    public function overview(Request $request): Response|JsonResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view', 'You do not have permission to view accounting overview.');

        $settings = $this->ensureBootstrapped();
        $tenantId = $this->tenantContext->id();

        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);
        $canViewProfit = $this->accessService->hasPermission($user, 'accounting.cost_and_profit.view');

        $period = $this->overviewService->resolvePeriodDates(
            $request->input('period'),
            $request->input('from'),
            $request->input('to'),
            (int) $settings->fiscal_year_start_month,
        );

        $branches = $this->availableBranches($user);
        $totalActiveBranches = Branch::query()->where('tenant_id', $tenantId)->where('is_active', true)->count();
        $isMultiBranch = $totalActiveBranches > 1 && $this->accessService->canViewAllBranches($user);

        $overview = $this->overviewService->getOverview(
            $tenantId,
            $branchId,
            $period['from'],
            $period['to'],
            $canViewProfit,
            $isMultiBranch,
        );

        if ($request->wantsJson() || $request->input('format') === 'json') {
            return response()->json([
                'filters' => [
                    'period' => $period['period_preset'],
                    'from' => $period['from'],
                    'to' => $period['to'],
                    'branch_id' => $branchId,
                ],
                'overview' => $overview,
            ]);
        }

        return Inertia::render('Accounting/Overview', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $branches,
            'selectedBranchId' => $branchId,
            'isMultiBranch' => $isMultiBranch,
            'filters' => [
                'period' => $period['period_preset'],
                'from' => $period['from'],
                'to' => $period['to'],
            ],
            'overview' => $overview,
        ]);
    }

    /**
     * Journal Voucher creation & list screen (Advanced Mode ONLY).
     */
    public function journal(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.journal.create', 'You do not have permission to create journal vouchers.');

        $settings = $this->ensureBootstrapped();
        abort_if($settings->mode !== 'advanced', 403, 'Journal vouchers are available in Advanced Mode only.');

        $this->partyService->syncFromCrm();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);

        $accounts = Account::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name_en', 'name_bn', 'type', 'report_group']);

        $parties = Party::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'type', 'code', 'name']);

        $recentJournals = Voucher::query()
            ->with(['branch:id,name,code', 'lines.account:id,code,name_en,name_bn', 'creator:id,name', 'approver:id,name'])
            ->where('type', 'journal')
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->latest('date')
            ->latest('id')
            ->limit(25)
            ->get()
            ->map(fn (Voucher $v) => [
                'id' => $v->id,
                'number' => $v->number,
                'date' => $v->date->toDateString(),
                'status' => $v->status,
                'narration' => $v->narration,
                'total_debit_paisa' => (int) $v->total_debit_paisa,
                'branch_name' => $v->branch?->name ?? 'Branch',
                'created_by' => $v->creator?->name ?? 'System',
                'created_by_id' => $v->created_by,
                'approved_by' => $v->approver?->name,
                'lines' => $v->lines->map(fn ($l) => [
                    'id' => $l->id,
                    'account_code' => $l->account?->code,
                    'account_name_en' => $l->account?->name_en,
                    'account_name_bn' => $l->account?->name_bn,
                    'debit_paisa' => (int) $l->debit_paisa,
                    'credit_paisa' => (int) $l->credit_paisa,
                    'narration' => $l->narration,
                ])->values(),
            ]);

        return Inertia::render('Accounting/JournalVoucher', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'currentUserId' => $user->id,
            'accounts' => $accounts,
            'parties' => $parties,
            'recentJournals' => $recentJournals,
        ]);
    }

    public function storeJournal(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.journal.create', 'You do not have permission to create journal vouchers.');

        $settings = $this->ensureBootstrapped();
        abort_if($settings->mode !== 'advanced', 403, 'Journal vouchers are available in Advanced Mode only.');

        $validated = $request->validate([
            'date' => ['required', 'date'],
            'branch_id' => ['nullable', 'integer'],
            'narration' => ['required', 'string', 'min:3', 'max:300'],
            'save_as_draft' => ['nullable', 'boolean'],
            'lines' => ['required', 'array', 'min:2'],
            'lines.*.account_id' => ['required', 'integer'],
            'lines.*.party_id' => ['nullable', 'integer'],
            'lines.*.debit' => ['nullable', 'string'],
            'lines.*.credit' => ['nullable', 'string'],
            'lines.*.narration' => ['nullable', 'string', 'max:250'],
        ]);

        try {
            $branchId = $this->accessService->resolveWriteBranchId(
                $user,
                isset($validated['branch_id']) ? (int) $validated['branch_id'] : null
            );

            $normalizedLines = [];
            foreach ($validated['lines'] as $line) {
                $debitStr = trim((string) ($line['debit'] ?? ''));
                $creditStr = trim((string) ($line['credit'] ?? ''));
                $debitPaisa = $debitStr !== '' && $debitStr !== '0' ? MoneyPaisa::fromBdt($debitStr) : 0;
                $creditPaisa = $creditStr !== '' && $creditStr !== '0' ? MoneyPaisa::fromBdt($creditStr) : 0;

                if ($debitPaisa === 0 && $creditPaisa === 0) {
                    continue;
                }

                $normalizedLines[] = [
                    'account_id' => (int) $line['account_id'],
                    'party_id' => ! empty($line['party_id']) ? (int) $line['party_id'] : null,
                    'debit_paisa' => $debitPaisa,
                    'credit_paisa' => $creditPaisa,
                    'narration' => $line['narration'] ?? null,
                ];
            }

            $saveAsDraft = (bool) ($validated['save_as_draft'] ?? false);
            $canPost = ! $saveAsDraft && $this->accessService->hasPermission($user, 'accounting.voucher.post');

            $voucher = $this->voucherService->create([
                'branch_id' => $branchId,
                'type' => 'journal',
                'date' => $validated['date'],
                'narration' => trim($validated['narration']),
                'source_module' => 'manual',
                'post_immediately' => $canPost,
                'lines' => $normalizedLines,
            ], $user);

            $statusMsg = match ($voucher->status) {
                Voucher::STATUS_POSTED => "Journal voucher {$voucher->number} posted.",
                Voucher::STATUS_PENDING_APPROVAL => "Journal voucher #{$voucher->id} submitted for second-user approval (exceeds threshold).",
                default => "Journal voucher #{$voucher->id} saved as draft.",
            };

            return back()->with('success', $statusMsg);
        } catch (DomainException|\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function postVoucher(Request $request, Voucher $voucher): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.post', 'You do not have permission to post vouchers.');
        $this->accessService->resolveScopedBranchId($user, (int) $voucher->branch_id);

        try {
            $posted = $this->voucherService->post($voucher, $user);

            return back()->with('success', "Voucher {$posted->number} posted.");
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function approveVoucher(Request $request, Voucher $voucher): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->resolveScopedBranchId($user, (int) $voucher->branch_id);

        try {
            $approved = $this->voucherService->approve($voucher, $user);

            return back()->with('success', "Voucher {$approved->number} approved and posted.");
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Printable Bangla & English Voucher view with tenant header & signature blocks.
     */
    public function printVoucher(Request $request, Voucher $voucher): View
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.view');
        $this->accessService->resolveScopedBranchId($user, (int) $voucher->branch_id);

        $voucher->load(['branch', 'lines.account', 'lines.party', 'creator', 'approver', 'poster']);
        $tenant = $this->tenantContext->tenant();
        $lang = $request->input('lang') === 'bn' ? 'bn' : 'en';

        return view('accounting.voucher-print', [
            'voucher' => $voucher,
            'tenant' => $tenant,
            'lang' => $lang,
        ]);
    }

    /**
     * General Account Ledger.
     */
    public function ledger(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);

        $from = (string) ($request->input('from') ?: CarbonImmutable::today()->startOfMonth()->toDateString());
        $to = (string) ($request->input('to') ?: CarbonImmutable::today()->toDateString());

        $accounts = Account::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name_en', 'name_bn', 'type', 'report_group']);

        $accountId = $request->filled('account_id')
            ? (int) $request->input('account_id')
            : ($accounts->first()?->id ?? null);

        $ledger = $accountId
            ? $this->reportService->generalLedger($tenantId, $accountId, $branchId, $from, $to)
            : null;

        return Inertia::render('Accounting/AccountLedger', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'accounts' => $accounts,
            'selectedAccountId' => $accountId,
            'filters' => ['from' => $from, 'to' => $to],
            'ledger' => $ledger,
        ]);
    }

    /**
     * Trial Balance Report.
     */
    public function trialBalance(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);

        $from = (string) ($request->input('from') ?: CarbonImmutable::today()->startOfMonth()->toDateString());
        $to = (string) ($request->input('to') ?: CarbonImmutable::today()->toDateString());

        $report = $this->reportService->trialBalance($tenantId, $branchId, $from, $to);

        return Inertia::render('Accounting/TrialBalance', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'report' => $report,
        ]);
    }

    /**
     * Balance Sheet Report (Advanced Mode ONLY).
     */
    public function balanceSheet(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        abort_if($settings->mode !== 'advanced', 403, 'Balance Sheet is available in Advanced Mode only.');

        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);
        $canViewProfit = $this->accessService->hasPermission($user, 'accounting.cost_and_profit.view');

        $asOf = (string) ($request->input('as_of') ?: CarbonImmutable::today()->toDateString());
        $report = $this->reportService->balanceSheet($tenantId, $branchId, $asOf, $canViewProfit);

        return Inertia::render('Accounting/BalanceSheet', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'report' => $report,
        ]);
    }

    /**
     * Year-End Close Fiscal Year (transfers Net Profit/Loss to Retained Earnings 3020).
     */
    public function closeFiscalYear(Request $request, FiscalYear $fiscalYear): RedirectResponse
    {
        try {
            $result = $this->fiscalPeriodService->closeFiscalYear($fiscalYear, $request->user());
            $voucherLabel = $result['closing_voucher'] ? " (Closing voucher {$result['closing_voucher']->number})" : '';

            return back()->with(
                'success',
                "Fiscal year {$fiscalYear->name} closed{$voucherLabel}. Transferred to Retained Earnings: "
                .MoneyPaisa::formatBdt($result['net_profit_paisa']).'.'
            );
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * CSV / Excel Export for Trial Balance, Profit & Loss, Balance Sheet, Day Book, and Account Ledger.
     */
    public function export(Request $request, string $report): StreamedResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);
        $canViewProfit = $this->accessService->hasPermission($user, 'accounting.cost_and_profit.view');

        $from = (string) ($request->input('from') ?: CarbonImmutable::today()->startOfMonth()->toDateString());
        $to = (string) ($request->input('to') ?: CarbonImmutable::today()->toDateString());
        $asOf = (string) ($request->input('as_of') ?: $to);

        if ($report === 'trial-balance') {
            $tb = $this->reportService->trialBalance($tenantId, $branchId, $from, $to);
            $rows = array_map(fn (array $r) => [
                $r['code'],
                $r['name_en'],
                $r['name_bn'],
                $r['type'],
                MoneyPaisa::toDecimalString($r['opening_debit_paisa']),
                MoneyPaisa::toDecimalString($r['opening_credit_paisa']),
                MoneyPaisa::toDecimalString($r['period_debit_paisa']),
                MoneyPaisa::toDecimalString($r['period_credit_paisa']),
                MoneyPaisa::toDecimalString($r['closing_debit_paisa']),
                MoneyPaisa::toDecimalString($r['closing_credit_paisa']),
            ], $tb['rows']);

            $rows[] = [
                'TOTAL',
                $tb['balanced'] ? 'Balanced' : 'Mismatch',
                '',
                '',
                MoneyPaisa::toDecimalString($tb['totals']['opening_debit_paisa']),
                MoneyPaisa::toDecimalString($tb['totals']['opening_credit_paisa']),
                MoneyPaisa::toDecimalString($tb['totals']['period_debit_paisa']),
                MoneyPaisa::toDecimalString($tb['totals']['period_credit_paisa']),
                MoneyPaisa::toDecimalString($tb['totals']['closing_debit_paisa']),
                MoneyPaisa::toDecimalString($tb['totals']['closing_credit_paisa']),
            ];

            return $this->reportService->exportCsv(
                "trial-balance-{$from}-to-{$to}.csv",
                ['Code', 'Account (EN)', 'Account (BN)', 'Type', 'Opening Dr (BDT)', 'Opening Cr (BDT)', 'Period Dr (BDT)', 'Period Cr (BDT)', 'Closing Dr (BDT)', 'Closing Cr (BDT)'],
                $rows,
            );
        }

        if ($report === 'balance-sheet') {
            abort_if($settings->mode !== 'advanced', 403, 'Balance Sheet export is available in Advanced Mode only.');
            $bs = $this->reportService->balanceSheet($tenantId, $branchId, $asOf, $canViewProfit);
            $rows = [];
            foreach ($bs['assets']['accounts'] as $a) {
                $rows[] = ['Assets', $a['code'], $a['name_en'], $a['name_bn'], MoneyPaisa::toDecimalString($a['amount_paisa'])];
            }
            $rows[] = ['Assets', 'TOTAL', 'Total Assets', '', MoneyPaisa::toDecimalString($bs['total_assets_paisa'])];
            foreach ($bs['liabilities']['accounts'] as $l) {
                $rows[] = ['Liabilities', $l['code'], $l['name_en'], $l['name_bn'], MoneyPaisa::toDecimalString($l['amount_paisa'])];
            }
            $rows[] = ['Liabilities', 'TOTAL', 'Total Liabilities', '', MoneyPaisa::toDecimalString($bs['total_liabilities_paisa'])];
            foreach ($bs['equity']['accounts'] as $e) {
                $rows[] = ['Equity', $e['code'], $e['name_en'], $e['name_bn'], MoneyPaisa::toDecimalString($e['amount_paisa'])];
            }
            if ($canViewProfit && $bs['equity']['current_period_profit_paisa'] !== null) {
                $rows[] = ['Equity', 'PROFIT', 'Current-Period Net Profit', 'চলতি সময়ের নিট লাভ', MoneyPaisa::toDecimalString($bs['equity']['current_period_profit_paisa'])];
            }
            if ($canViewProfit && $bs['total_equity_paisa'] !== null) {
                $rows[] = ['Equity', 'TOTAL', 'Total Equity', '', MoneyPaisa::toDecimalString($bs['total_equity_paisa'])];
            }

            return $this->reportService->exportCsv(
                "balance-sheet-as-of-{$asOf}.csv",
                ['Section', 'Code', 'Account (EN)', 'Account (BN)', 'Amount (BDT)'],
                $rows,
            );
        }

        if ($report === 'profit-loss') {
            $pnl = $this->simpleService->simpleProfitAndLoss($tenantId, $branchId, $from, $to, $canViewProfit);
            $rows = [];
            foreach ($pnl['income_lines'] as $l) {
                $rows[] = ['Income', $l['code'], $l['name_en'], $l['name_bn'], MoneyPaisa::toDecimalString($l['amount_paisa'])];
            }
            if ($canViewProfit) {
                foreach ($pnl['cogs_lines'] as $l) {
                    $rows[] = ['COGS', $l['code'], $l['name_en'], $l['name_bn'], MoneyPaisa::toDecimalString($l['amount_paisa'])];
                }
            }
            foreach ($pnl['expense_lines'] as $l) {
                $rows[] = ['Operating Expense', $l['code'], $l['name_en'], $l['name_bn'], MoneyPaisa::toDecimalString($l['amount_paisa'])];
            }
            if ($canViewProfit && $pnl['net_profit_paisa'] !== null) {
                $rows[] = ['Summary', 'NET', 'Net Profit', 'নিট লাভ', MoneyPaisa::toDecimalString($pnl['net_profit_paisa'])];
            }

            return $this->reportService->exportCsv(
                "profit-and-loss-{$from}-to-{$to}.csv",
                ['Section', 'Code', 'Account (EN)', 'Account (BN)', 'Amount (BDT)'],
                $rows,
            );
        }

        if ($report === 'ledger') {
            $accountId = (int) $request->input('account_id');
            $ledger = $this->reportService->generalLedger($tenantId, $accountId, $branchId, $from, $to);
            $rows = [
                [$from, '', '', 'Opening Balance', '', '0.00', '0.00', MoneyPaisa::toDecimalString($ledger['opening_balance_paisa'])],
            ];
            foreach ($ledger['entries'] as $e) {
                $rows[] = [
                    $e['date'],
                    $e['voucher_number'],
                    $e['voucher_type'],
                    $e['narration'],
                    $e['branch_name'],
                    MoneyPaisa::toDecimalString($e['debit_paisa']),
                    MoneyPaisa::toDecimalString($e['credit_paisa']),
                    MoneyPaisa::toDecimalString($e['running_balance_paisa']),
                ];
            }

            return $this->reportService->exportCsv(
                "ledger-{$ledger['account']['code']}-{$from}-to-{$to}.csv",
                ['Date', 'Voucher #', 'Type', 'Narration', 'Branch', 'Debit (BDT)', 'Credit (BDT)', 'Running Balance (BDT)'],
                $rows,
            );
        }

        // Default: day-book
        $vouchers = Voucher::query()
            ->with(['branch:id,name'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereIn('status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->orderBy('date')
            ->orderBy('id')
            ->get();

        $rows = $vouchers->map(fn (Voucher $v) => [
            $v->date->toDateString(),
            $v->number,
            $v->type,
            $v->status,
            $v->branch?->name ?? '',
            $v->narration,
            MoneyPaisa::toDecimalString((int) $v->total_debit_paisa),
        ])->all();

        return $this->reportService->exportCsv(
            "day-book-{$from}-to-{$to}.csv",
            ['Date', 'Voucher #', 'Type', 'Status', 'Branch', 'Narration', 'Amount (BDT)'],
            $rows,
        );
    }

    private function ensureBootstrapped(): AccountingSetting
    {
        return AccountingSetting::query()->first()
            ?? $this->bootstrapService->bootstrapForTenant($this->tenantContext->tenant());
    }

    /**
     * @return array<string, mixed>
     */
    private function formatSettings(AccountingSetting $s): array
    {
        return [
            'mode' => $s->mode,
            'coa_template' => $s->coa_template,
            'fiscal_year_start_month' => $s->fiscal_year_start_month,
            'default_currency' => $s->default_currency,
            'vat_enabled' => $s->vat_enabled,
            'vat_rate_bps' => $s->vat_rate_bps,
            'vat_rate_percent' => round($s->vat_rate_bps / 100, 2),
            'approval_threshold_paisa' => (int) $s->approval_threshold_paisa,
            'approval_threshold_bdt' => MoneyPaisa::toDecimalString((int) $s->approval_threshold_paisa),
            'default_cash_account_id' => $s->default_cash_account_id,
            'default_bank_account_id' => $s->default_bank_account_id,
            'default_wallet_account_id' => $s->default_wallet_account_id,
            'default_receivable_account_id' => $s->default_receivable_account_id,
            'default_payable_account_id' => $s->default_payable_account_id,
            'default_inventory_account_id' => $s->default_inventory_account_id,
            'default_cogs_account_id' => $s->default_cogs_account_id,
            'default_sales_account_id' => $s->default_sales_account_id,
            'default_vat_input_account_id' => $s->default_vat_input_account_id,
            'default_vat_output_account_id' => $s->default_vat_output_account_id,
        ];
    }

    /**
     * @return array<string, bool>
     */
    private function permissionFlags($user): array
    {
        return [
            'view' => $this->accessService->hasPermission($user, 'accounting.view'),
            'expense_create' => $this->accessService->hasPermission($user, 'accounting.expense.create'),
            'voucher_create' => $this->accessService->hasPermission($user, 'accounting.voucher.create'),
            'voucher_post' => $this->accessService->hasPermission($user, 'accounting.voucher.post'),
            'voucher_approve' => $this->accessService->hasPermission($user, 'accounting.voucher.approve'),
            'voucher_reverse' => $this->accessService->hasPermission($user, 'accounting.voucher.reverse'),
            'journal_create' => $this->accessService->hasPermission($user, 'accounting.journal.create'),
            'coa_manage' => $this->accessService->hasPermission($user, 'accounting.coa.manage'),
            'period_close' => $this->accessService->hasPermission($user, 'accounting.period.close'),
            'period_reopen' => $this->accessService->hasPermission($user, 'accounting.period.reopen'),
            'reports_view' => $this->accessService->hasPermission($user, 'accounting.reports.view'),
            'settings_manage' => $this->accessService->hasPermission($user, 'accounting.settings.manage'),
            'cost_and_profit_view' => $this->accessService->hasPermission($user, 'accounting.cost_and_profit.view'),
            'all_branches' => $this->accessService->canViewAllBranches($user),
        ];
    }

    /**
     * @return array<int, array{id: int, name: string, code: string}>
     */
    private function availableBranches($user): array
    {
        if ($this->accessService->canViewAllBranches($user)) {
            return Branch::query()
                ->where('is_active', true)
                ->orderByDesc('is_head_office')
                ->orderBy('name')
                ->get(['id', 'name', 'code'])
                ->map(fn (Branch $b) => ['id' => $b->id, 'name' => $b->name, 'code' => $b->code])
                ->all();
        }

        $branchId = $this->accessService->resolveScopedBranchId($user, null);
        $branch = $branchId ? Branch::query()->find($branchId) : null;

        return $branch ? [['id' => $branch->id, 'name' => $branch->name, 'code' => $branch->code]] : [];
    }
}

