<?php

namespace App\Modules\Accounting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingSetting;
use App\Modules\Accounting\Models\BankStatementLine;
use App\Modules\Accounting\Models\Voucher;
use App\Modules\Accounting\Models\VoucherLine;
use App\Modules\Accounting\Services\AccountingAccessService;
use App\Modules\Accounting\Services\AccountingBootstrapService;
use App\Modules\Accounting\Services\BankReconciliationService;
use App\Modules\Accounting\Services\ExtraReportService;
use App\Modules\Accounting\Services\FinancialReportService;
use App\Modules\Accounting\Services\MoneyPaisa;
use App\Modules\Accounting\Services\VoucherService;
use App\Support\TenantContext;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AccountingPhase4Controller extends Controller
{
    public function __construct(
        private readonly TenantContext $tenantContext,
        private readonly AccountingBootstrapService $bootstrapService,
        private readonly AccountingAccessService $accessService,
        private readonly BankReconciliationService $reconService,
        private readonly ExtraReportService $extraReports,
        private readonly FinancialReportService $reportService,
        private readonly VoucherService $voucherService,
    ) {}

    /**
     * Bank Reconciliation workspace (CSV import, auto-match, manual match, difference summary).
     */
    public function bankReconciliation(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');

        $settings = $this->ensureBootstrapped();
        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);

        $bankAccounts = Account::query()
            ->where('report_group', 'bank')
            ->where('is_active', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name_en', 'name_bn']);

        $accountId = $request->filled('account_id')
            ? (int) $request->input('account_id')
            : ($bankAccounts->first()?->id ?? null);
        $statementId = $request->filled('statement_id') ? (int) $request->input('statement_id') : null;

        $reconciliation = $accountId
            ? $this->reconService->summary($tenantId, $branchId, $accountId, $statementId)
            : null;

        return Inertia::render('Accounting/BankReconciliation', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'bankAccounts' => $bankAccounts,
            'selectedAccountId' => $accountId,
            'reconciliation' => $reconciliation,
        ]);
    }

    public function importBankStatement(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.post', 'You do not have permission to import bank statements.');
        $this->ensureBootstrapped();

        $validated = $request->validate([
            'account_id' => ['required', 'integer'],
            'branch_id' => ['nullable', 'integer'],
            'statement_date' => ['required', 'date'],
            'opening_balance' => ['nullable', 'string', 'regex:/^-?\d+(?:,\d{3})*(?:\.\d{1,2})?$/'],
            'closing_balance' => ['required', 'string', 'regex:/^-?\d+(?:,\d{3})*(?:\.\d{1,2})?$/'],
            'csv_file' => ['nullable', 'file', 'mimes:csv,txt', 'max:4096'],
            'csv_text' => ['nullable', 'string'],
        ]);

        try {
            $csvContent = '';
            $filename = 'statement-'.$validated['statement_date'].'.csv';
            if ($request->hasFile('csv_file')) {
                $file = $request->file('csv_file');
                $filename = $file->getClientOriginalName();
                $csvContent = (string) file_get_contents($file->getRealPath());
            } elseif (! empty($validated['csv_text'])) {
                $csvContent = (string) $validated['csv_text'];
            } else {
                throw new DomainException('Please upload a CSV file or paste CSV lines.');
            }

            $branchId = $request->filled('branch_id')
                ? $this->accessService->resolveWriteBranchId($user, (int) $validated['branch_id'])
                : ($this->accessService->canViewAllBranches($user) ? null : $this->accessService->resolveScopedBranchId($user, null));

            $openingPaisa = ! empty($validated['opening_balance']) ? $this->parseSignedPaisa($validated['opening_balance']) : 0;
            $closingPaisa = $this->parseSignedPaisa($validated['closing_balance']);

            $result = $this->reconService->importCsv(
                (int) $validated['account_id'],
                $branchId,
                $validated['statement_date'],
                $filename,
                $csvContent,
                $openingPaisa,
                $closingPaisa,
                $user,
            );

            return back()->with(
                'success',
                "Imported {$result['total_lines']} bank statement lines: {$result['auto_matched']} auto-matched, {$result['unmatched']} unmatched."
            );
        } catch (DomainException|\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function matchBankLine(Request $request, BankStatementLine $line): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.post');

        $validated = $request->validate([
            'voucher_line_id' => ['required', 'integer'],
        ]);

        try {
            $vl = VoucherLine::query()->findOrFail($validated['voucher_line_id']);
            $this->reconService->manualMatch($line, $vl, $user);

            return back()->with('success', "Matched statement line #{$line->id}.");
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function unmatchBankLine(Request $request, BankStatementLine $line): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.post');

        $this->reconService->unmatch($line, $user);

        return back()->with('success', "Unmatched statement line #{$line->id}.");
    }

    public function ignoreBankLine(Request $request, BankStatementLine $line): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.post');

        $this->reconService->ignoreLine($line, $user);

        return back()->with('success', "Statement line #{$line->id} marked as ignored.");
    }

    /**
     * Payroll, Stock Adjustment / Expired Write-Off, and Opening Balance Vouchers screen.
     */
    public function operations(Request $request): Response
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.view');

        $settings = $this->ensureBootstrapped();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);

        $accounts = Account::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name_en', 'name_bn', 'type', 'report_group']);

        $recent = Voucher::query()
            ->with(['branch:id,name', 'lines.account:id,code,name_en,name_bn', 'creator:id,name'])
            ->whereIn('type', ['payroll', 'stock_adjustment', 'opening_balance'])
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->latest('date')
            ->latest('id')
            ->limit(30)
            ->get()
            ->map(fn (Voucher $v) => [
                'id' => $v->id,
                'number' => $v->number,
                'type' => $v->type,
                'date' => $v->date->toDateString(),
                'status' => $v->status,
                'narration' => $v->narration,
                'branch_name' => $v->branch?->name ?? 'Branch',
                'total_debit_paisa' => (int) $v->total_debit_paisa,
                'created_by' => $v->creator?->name ?? 'System',
                'lines' => $v->lines->map(fn ($l) => [
                    'id' => $l->id,
                    'account_code' => $l->account?->code,
                    'account_name_en' => $l->account?->name_en,
                    'debit_paisa' => (int) $l->debit_paisa,
                    'credit_paisa' => (int) $l->credit_paisa,
                ])->values(),
            ]);

        return Inertia::render('Accounting/OperationsVouchers', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'accounts' => $accounts,
            'recentVouchers' => $recent,
        ]);
    }

    public function storePayrollVoucher(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.create');
        $settings = $this->ensureBootstrapped();

        $validated = $request->validate([
            'date' => ['required', 'date'],
            'branch_id' => ['nullable', 'integer'],
            'mode' => ['required', 'in:pay_now,accrue_only,partial_pay,settle_payable'],
            'gross_salary' => ['required', 'string', 'regex:/^\d+(?:,\d{3})*(?:\.\d{1,2})?$/'],
            'paid_now' => ['nullable', 'string', 'regex:/^\d+(?:,\d{3})*(?:\.\d{1,2})?$/'],
            'payment_channel' => ['required', 'in:cash,bank,wallet'],
            'narration' => ['required', 'string', 'min:3', 'max:300'],
        ]);

        try {
            $branchId = $this->accessService->resolveWriteBranchId(
                $user,
                isset($validated['branch_id']) ? (int) $validated['branch_id'] : null
            );

            $grossPaisa = MoneyPaisa::fromBdt($validated['gross_salary']);
            if ($grossPaisa <= 0) {
                throw new DomainException('Salary amount must be greater than zero.');
            }

            $salaryExpId = (int) Account::query()->where('code', '6010')->value('id');
            $salaryPayableId = (int) Account::query()->where('code', '2200')->value('id');
            $payAccountId = match ($validated['payment_channel']) {
                'bank' => (int) ($settings->default_bank_account_id ?? Account::query()->where('code', '1020')->value('id')),
                'wallet' => (int) ($settings->default_wallet_account_id ?? Account::query()->where('code', '1030')->value('id')),
                default => (int) ($settings->default_cash_account_id ?? Account::query()->where('code', '1010')->value('id')),
            };

            $lines = [];
            if ($validated['mode'] === 'settle_payable') {
                $lines = [
                    ['account_id' => $salaryPayableId, 'debit_paisa' => $grossPaisa, 'credit_paisa' => 0, 'narration' => 'Settled accrued staff salary'],
                    ['account_id' => $payAccountId, 'debit_paisa' => 0, 'credit_paisa' => $grossPaisa, 'narration' => 'Salary disbursement'],
                ];
            } elseif ($validated['mode'] === 'accrue_only') {
                $lines = [
                    ['account_id' => $salaryExpId, 'debit_paisa' => $grossPaisa, 'credit_paisa' => 0, 'narration' => 'Monthly staff salary expense'],
                    ['account_id' => $salaryPayableId, 'debit_paisa' => 0, 'credit_paisa' => $grossPaisa, 'narration' => 'Accrued salary payable'],
                ];
            } elseif ($validated['mode'] === 'partial_pay') {
                $paidNow = ! empty($validated['paid_now']) ? MoneyPaisa::fromBdt($validated['paid_now']) : 0;
                if ($paidNow <= 0 || $paidNow >= $grossPaisa) {
                    throw new DomainException('Paid-now amount must be greater than 0 and less than gross salary.');
                }
                $lines = [
                    ['account_id' => $salaryExpId, 'debit_paisa' => $grossPaisa, 'credit_paisa' => 0, 'narration' => 'Monthly staff salary expense'],
                    ['account_id' => $payAccountId, 'debit_paisa' => 0, 'credit_paisa' => $paidNow, 'narration' => 'Salary paid immediately'],
                    ['account_id' => $salaryPayableId, 'debit_paisa' => 0, 'credit_paisa' => $grossPaisa - $paidNow, 'narration' => 'Remaining salary payable'],
                ];
            } else {
                $lines = [
                    ['account_id' => $salaryExpId, 'debit_paisa' => $grossPaisa, 'credit_paisa' => 0, 'narration' => 'Monthly staff salary expense'],
                    ['account_id' => $payAccountId, 'debit_paisa' => 0, 'credit_paisa' => $grossPaisa, 'narration' => 'Salary paid'],
                ];
            }

            $canPost = $this->accessService->hasPermission($user, 'accounting.voucher.post');
            $voucher = $this->voucherService->create([
                'branch_id' => $branchId,
                'type' => 'payroll',
                'date' => $validated['date'],
                'narration' => trim($validated['narration']),
                'source_module' => 'manual',
                'post_immediately' => $canPost,
                'lines' => $lines,
            ], $user);

            return back()->with('success', "Payroll voucher {$voucher->number} saved (".MoneyPaisa::formatBdt($grossPaisa).').');
        } catch (DomainException|\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function storeStockAdjustmentVoucher(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.create');
        $settings = $this->ensureBootstrapped();

        $validated = $request->validate([
            'date' => ['required', 'date'],
            'branch_id' => ['nullable', 'integer'],
            'reason_kind' => ['required', 'in:expired_damaged,shrinkage_loss,surplus_gain'],
            'inventory_account_id' => ['nullable', 'integer'],
            'amount' => ['required', 'string', 'regex:/^\d+(?:,\d{3})*(?:\.\d{1,2})?$/'],
            'narration' => ['required', 'string', 'min:3', 'max:300'],
        ]);

        try {
            $branchId = $this->accessService->resolveWriteBranchId(
                $user,
                isset($validated['branch_id']) ? (int) $validated['branch_id'] : null
            );

            $costPaisa = MoneyPaisa::fromBdt($validated['amount']);
            if ($costPaisa <= 0) {
                throw new DomainException('Adjustment value must be greater than zero.');
            }

            $invId = ! empty($validated['inventory_account_id'])
                ? (int) $validated['inventory_account_id']
                : (int) ($settings->default_inventory_account_id ?? Account::query()->where('code', '1200')->value('id'));

            $lossCode = $validated['reason_kind'] === 'expired_damaged' ? '5020' : '5030';
            $lossAccountId = (int) Account::query()->where('code', $lossCode)->value('id');

            $lines = $validated['reason_kind'] === 'surplus_gain'
                ? [
                    ['account_id' => $invId, 'debit_paisa' => $costPaisa, 'credit_paisa' => 0, 'narration' => 'Stock audit surplus added'],
                    ['account_id' => $lossAccountId, 'debit_paisa' => 0, 'credit_paisa' => $costPaisa, 'narration' => 'Stock adjustment gain'],
                ]
                : [
                    ['account_id' => $lossAccountId, 'debit_paisa' => $costPaisa, 'credit_paisa' => 0, 'narration' => $validated['reason_kind'] === 'expired_damaged' ? 'Expired/damaged stock loss' : 'Stock shrinkage adjustment'],
                    ['account_id' => $invId, 'debit_paisa' => 0, 'credit_paisa' => $costPaisa, 'narration' => 'Inventory reduction'],
                ];

            $canPost = $this->accessService->hasPermission($user, 'accounting.voucher.post');
            $voucher = $this->voucherService->create([
                'branch_id' => $branchId,
                'type' => 'stock_adjustment',
                'date' => $validated['date'],
                'narration' => trim($validated['narration']),
                'source_module' => 'manual',
                'post_immediately' => $canPost,
                'lines' => $lines,
            ], $user);

            return back()->with('success', "Stock adjustment voucher {$voucher->number} saved (".MoneyPaisa::formatBdt($costPaisa).').');
        } catch (DomainException|\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    public function storeOpeningBalanceVoucher(Request $request): RedirectResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.voucher.create');
        $this->ensureBootstrapped();

        $validated = $request->validate([
            'date' => ['required', 'date'],
            'branch_id' => ['nullable', 'integer'],
            'account_id' => ['required', 'integer'],
            'side' => ['required', 'in:debit,credit'],
            'amount' => ['required', 'string', 'regex:/^\d+(?:,\d{3})*(?:\.\d{1,2})?$/'],
            'narration' => ['required', 'string', 'min:3', 'max:300'],
        ]);

        try {
            $branchId = $this->accessService->resolveWriteBranchId(
                $user,
                isset($validated['branch_id']) ? (int) $validated['branch_id'] : null
            );

            $amountPaisa = MoneyPaisa::fromBdt($validated['amount']);
            if ($amountPaisa <= 0) {
                throw new DomainException('Opening balance amount must be greater than zero.');
            }

            $capitalId = (int) Account::query()->where('code', '3010')->value('id');
            $accountId = (int) $validated['account_id'];
            if ($accountId === $capitalId) {
                throw new DomainException('Select an Asset or Liability account to offset against Owner Capital (3010).');
            }

            $lines = $validated['side'] === 'debit'
                ? [
                    ['account_id' => $accountId, 'debit_paisa' => $amountPaisa, 'credit_paisa' => 0, 'narration' => 'Opening debit balance'],
                    ['account_id' => $capitalId, 'debit_paisa' => 0, 'credit_paisa' => $amountPaisa, 'narration' => 'Opening capital offset'],
                ]
                : [
                    ['account_id' => $capitalId, 'debit_paisa' => $amountPaisa, 'credit_paisa' => 0, 'narration' => 'Opening liability offset'],
                    ['account_id' => $accountId, 'debit_paisa' => 0, 'credit_paisa' => $amountPaisa, 'narration' => 'Opening credit balance'],
                ];

            $canPost = $this->accessService->hasPermission($user, 'accounting.voucher.post');
            $voucher = $this->voucherService->create([
                'branch_id' => $branchId,
                'type' => 'opening_balance',
                'date' => $validated['date'],
                'narration' => trim($validated['narration']),
                'source_module' => 'manual',
                'post_immediately' => $canPost,
                'lines' => $lines,
            ], $user);

            return back()->with('success', "Opening balance voucher {$voucher->number} saved (".MoneyPaisa::formatBdt($amountPaisa).').');
        } catch (DomainException|\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    /**
     * Extra Financial Reports (Cash Flow Statement, Branch Comparison, Inventory Valuation).
     */
    public function extraReports(Request $request): Response
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
        $tab = in_array($request->input('tab'), ['cash-flow', 'branch-comparison', 'inventory-valuation'], true)
            ? (string) $request->input('tab')
            : 'cash-flow';

        $cashFlow = $this->extraReports->cashFlowStatement($tenantId, $branchId, $from, $to);
        $branchComparison = $this->extraReports->branchComparison($tenantId, $branchId, $from, $to, $canViewProfit);
        $inventoryValuation = $this->extraReports->inventoryValuation($tenantId, $branchId, $from, $to);

        return Inertia::render('Accounting/ExtraReports', [
            'settings' => $this->formatSettings($settings),
            'permissions' => $this->permissionFlags($user),
            'branches' => $this->availableBranches($user),
            'selectedBranchId' => $branchId,
            'filters' => ['from' => $from, 'to' => $to, 'tab' => $tab],
            'cashFlow' => $cashFlow,
            'branchComparison' => $branchComparison,
            'inventoryValuation' => $inventoryValuation,
        ]);
    }

    public function exportExtraReport(Request $request, string $report): StreamedResponse
    {
        $user = $request->user();
        $this->accessService->authorize($user, 'accounting.reports.view');
        $this->ensureBootstrapped();

        $tenantId = $this->tenantContext->id();
        $requestedBranch = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;
        $branchId = $this->accessService->resolveScopedBranchId($user, $requestedBranch);
        $canViewProfit = $this->accessService->hasPermission($user, 'accounting.cost_and_profit.view');
        $from = (string) ($request->input('from') ?: CarbonImmutable::today()->startOfMonth()->toDateString());
        $to = (string) ($request->input('to') ?: CarbonImmutable::today()->toDateString());

        if ($report === 'branch-comparison') {
            $data = $this->extraReports->branchComparison($tenantId, $branchId, $from, $to, $canViewProfit);
            $rows = array_map(fn (array $r) => [
                $r['branch_code'],
                $r['branch_name'],
                MoneyPaisa::toDecimalString($r['revenue_paisa']),
                $canViewProfit ? MoneyPaisa::toDecimalString((int) $r['cogs_paisa']) : 'Restricted',
                $canViewProfit ? MoneyPaisa::toDecimalString((int) $r['gross_profit_paisa']) : 'Restricted',
                MoneyPaisa::toDecimalString($r['operating_expense_paisa']),
                $canViewProfit ? MoneyPaisa::toDecimalString((int) $r['net_profit_paisa']) : 'Restricted',
                MoneyPaisa::toDecimalString($r['cash_and_bank_paisa']),
                MoneyPaisa::toDecimalString($r['receivable_paisa']),
                MoneyPaisa::toDecimalString($r['payable_paisa']),
            ], $data['rows']);

            return $this->reportService->exportCsv(
                "branch-comparison-{$from}-to-{$to}.csv",
                ['Code', 'Branch', 'Revenue (BDT)', 'COGS (BDT)', 'Gross Profit (BDT)', 'Operating Expense (BDT)', 'Net Profit (BDT)', 'Cash & Bank (BDT)', 'Receivable (BDT)', 'Payable (BDT)'],
                $rows,
            );
        }

        $cf = $this->extraReports->cashFlowStatement($tenantId, $branchId, $from, $to);
        $rows = [
            ['Opening Cash & Bank', '', '', MoneyPaisa::toDecimalString($cf['opening_cash_paisa'])],
            ['Operating Activities', MoneyPaisa::toDecimalString($cf['operating']['inflow_paisa']), MoneyPaisa::toDecimalString($cf['operating']['outflow_paisa']), MoneyPaisa::toDecimalString($cf['operating']['net_paisa'])],
            ['Investing Activities', MoneyPaisa::toDecimalString($cf['investing']['inflow_paisa']), MoneyPaisa::toDecimalString($cf['investing']['outflow_paisa']), MoneyPaisa::toDecimalString($cf['investing']['net_paisa'])],
            ['Financing Activities', MoneyPaisa::toDecimalString($cf['financing']['inflow_paisa']), MoneyPaisa::toDecimalString($cf['financing']['outflow_paisa']), MoneyPaisa::toDecimalString($cf['financing']['net_paisa'])],
            ['Net Change in Cash & Bank', '', '', MoneyPaisa::toDecimalString($cf['net_change_paisa'])],
            ['Closing Cash & Bank', '', '', MoneyPaisa::toDecimalString($cf['closing_cash_paisa'])],
        ];

        return $this->reportService->exportCsv(
            "cash-flow-{$from}-to-{$to}.csv",
            ['Activity', 'Inflow (BDT)', 'Outflow (BDT)', 'Net / Balance (BDT)'],
            $rows,
        );
    }

    private function parseSignedPaisa(string $raw): int
    {
        $clean = trim($raw);
        $neg = str_starts_with($clean, '-');
        $abs = MoneyPaisa::fromBdt(ltrim($clean, '+-'));

        return $neg ? -$abs : $abs;
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

