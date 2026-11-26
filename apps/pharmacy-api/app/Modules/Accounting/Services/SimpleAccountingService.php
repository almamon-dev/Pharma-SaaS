<?php

namespace App\Modules\Accounting\Services;

use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AccountingSetting;
use App\Modules\Accounting\Models\SimpleCategory;
use App\Modules\Accounting\Models\Voucher;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Support\Facades\DB;

class SimpleAccountingService
{
    public function __construct(
        private readonly VoucherService $voucherService,
    ) {}

    /**
     * Record a Simple Mode Income or Expense entry.
     * Internally generates a balanced double-entry voucher (Debit = Credit in integer paisa).
     *
     * Example: Expense "Electricity" ৳3,200 paid from cash:
     *   Dr Electricity Expense (6030)  320,000 paisa
     *   Cr Cash in Hand        (1010)  320,000 paisa
     *
     * @param  array{
     *   kind: 'income'|'expense',
     *   category_id: int,
     *   amount_paisa: int,
     *   payment_channel: 'cash'|'bank'|'wallet',
     *   branch_id: int,
     *   date: string,
     *   note?: string|null,
     *   party_name?: string|null,
     *   attachments?: array<int, string>|null
     * }  $data
     */
    public function recordSimpleEntry(array $data, User $actor): Voucher
    {
        $kind = $data['kind'];
        $amountPaisa = (int) $data['amount_paisa'];
        if ($amountPaisa <= 0) {
            throw new DomainException('Amount must be greater than zero.');
        }

        /** @var SimpleCategory $category */
        $category = SimpleCategory::query()
            ->where('kind', $kind)
            ->where('is_active', true)
            ->findOrFail($data['category_id']);

        $settings = AccountingSetting::query()->firstOrFail();
        $paymentAccountId = $this->resolvePaymentAccountId($settings, (string) ($data['payment_channel'] ?? 'cash'));

        $note = trim((string) ($data['note'] ?? ''));
        $party = trim((string) ($data['party_name'] ?? ''));
        $label = $category->name_en;
        $narrationParts = [$label];
        if ($party !== '') {
            $narrationParts[] = $party;
        }
        if ($note !== '') {
            $narrationParts[] = $note;
        }
        $narration = implode(' — ', $narrationParts);

        if ($kind === 'expense') {
            $expenseAccountId = $category->debit_account_id;
            if (! $expenseAccountId) {
                throw new DomainException("Expense category '{$category->name_en}' is not linked to an expense account.");
            }

            return $this->voucherService->create([
                'branch_id' => (int) $data['branch_id'],
                'type' => 'payment',
                'date' => $data['date'],
                'narration' => $narration,
                'source_module' => 'simple_accounting',
                'attachments' => $data['attachments'] ?? null,
                'post_immediately' => true,
                'lines' => [
                    [
                        'account_id' => $expenseAccountId,
                        'debit_paisa' => $amountPaisa,
                        'credit_paisa' => 0,
                        'narration' => $narration,
                    ],
                    [
                        'account_id' => $paymentAccountId,
                        'debit_paisa' => 0,
                        'credit_paisa' => $amountPaisa,
                        'narration' => $narration,
                    ],
                ],
            ], $actor);
        }

        // Income: Dr Cash/Bank/Wallet, Cr Income Account
        $incomeAccountId = $category->credit_account_id;
        if (! $incomeAccountId) {
            throw new DomainException("Income category '{$category->name_en}' is not linked to an income account.");
        }

        return $this->voucherService->create([
            'branch_id' => (int) $data['branch_id'],
            'type' => 'receipt',
            'date' => $data['date'],
            'narration' => $narration,
            'source_module' => 'simple_accounting',
            'attachments' => $data['attachments'] ?? null,
            'post_immediately' => true,
            'lines' => [
                [
                    'account_id' => $paymentAccountId,
                    'debit_paisa' => $amountPaisa,
                    'credit_paisa' => 0,
                    'narration' => $narration,
                ],
                [
                    'account_id' => $incomeAccountId,
                    'debit_paisa' => 0,
                    'credit_paisa' => $amountPaisa,
                    'narration' => $narration,
                ],
            ],
        ], $actor);
    }

    /**
     * Simple Mode Dashboard summary (computed strictly via report_group from Posted vouchers).
     *
     * @return array<string, int|null>
     */
    public function dashboardSummary(int $tenantId, ?int $branchId, bool $canViewProfit = true): array
    {
        $today = CarbonImmutable::today()->toDateString();
        $monthStart = CarbonImmutable::today()->startOfMonth()->toDateString();
        $monthEnd = CarbonImmutable::today()->endOfMonth()->toDateString();

        $todayGroups = $this->sumByReportGroup($tenantId, $branchId, $today, $today);
        $monthGroups = $this->sumByReportGroup($tenantId, $branchId, $monthStart, $monthEnd);
        $asOfGroups = $this->sumByReportGroup($tenantId, $branchId, null, $today);

        // Income = credit - debit for revenue & other_income (contra-revenue naturally reduces total)
        $todayIncome = ($todayGroups['revenue']['net_credit'] ?? 0) + ($todayGroups['other_income']['net_credit'] ?? 0);
        $todayExpense = ($todayGroups['operating_expense']['net_debit'] ?? 0) + ($todayGroups['cogs']['net_debit'] ?? 0);

        $monthIncome = ($monthGroups['revenue']['net_credit'] ?? 0) + ($monthGroups['other_income']['net_credit'] ?? 0);
        $monthCogs = $monthGroups['cogs']['net_debit'] ?? 0;
        $monthOpEx = $monthGroups['operating_expense']['net_debit'] ?? 0;
        $monthProfit = $monthIncome - $monthCogs - $monthOpEx;

        $cashInHand = $asOfGroups['cash']['net_debit'] ?? 0;
        $bankBalance = $asOfGroups['bank']['net_debit'] ?? 0;
        $customersOwe = $asOfGroups['receivable']['net_debit'] ?? 0;
        $owedToSuppliers = $asOfGroups['payable']['net_credit'] ?? 0;

        return [
            'today_income_paisa' => $todayIncome,
            'today_expense_paisa' => $todayExpense,
            'month_income_paisa' => $monthIncome,
            'month_expense_paisa' => $monthOpEx,
            'month_cogs_paisa' => $canViewProfit ? $monthCogs : null,
            'month_profit_paisa' => $canViewProfit ? $monthProfit : null,
            'cash_in_hand_paisa' => $cashInHand,
            'bank_balance_paisa' => $bankBalance,
            'customers_owe_paisa' => $customersOwe,
            'owed_to_suppliers_paisa' => $owedToSuppliers,
        ];
    }

    /**
     * Read-only Simple Profit & Loss aggregated strictly by report_group from Posted vouchers.
     *
     * @return array<string, mixed>
     */
    public function simpleProfitAndLoss(
        int $tenantId,
        ?int $branchId,
        string $from,
        string $to,
        bool $canViewProfit = true,
    ): array {
        $rows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '>=', $from)
            ->whereDate('v.date', '<=', $to)
            ->whereIn('a.report_group', ['revenue', 'other_income', 'cogs', 'operating_expense'])
            ->groupBy('a.id', 'a.code', 'a.name_en', 'a.name_bn', 'a.report_group', 'a.is_contra')
            ->orderBy('a.code')
            ->selectRaw('a.id, a.code, a.name_en, a.name_bn, a.report_group, a.is_contra, SUM(vl.debit_paisa) as total_debit, SUM(vl.credit_paisa) as total_credit')
            ->get();

        $incomeLines = [];
        $cogsLines = [];
        $expenseLines = [];

        $revenueTotal = 0;
        $otherIncomeTotal = 0;
        $cogsTotal = 0;
        $opExTotal = 0;

        foreach ($rows as $row) {
            $debit = (int) $row->total_debit;
            $credit = (int) $row->total_credit;

            if (in_array($row->report_group, ['revenue', 'other_income'], true)) {
                $amount = $credit - $debit;
                if ($amount === 0) {
                    continue;
                }
                if ($row->report_group === 'revenue') {
                    $revenueTotal += $amount;
                } else {
                    $otherIncomeTotal += $amount;
                }
                $incomeLines[] = [
                    'account_id' => (int) $row->id,
                    'code' => $row->code,
                    'name_en' => $row->name_en,
                    'name_bn' => $row->name_bn,
                    'report_group' => $row->report_group,
                    'amount_paisa' => $amount,
                ];
            } elseif ($row->report_group === 'cogs') {
                $amount = $debit - $credit;
                if ($amount === 0) {
                    continue;
                }
                $cogsTotal += $amount;
                $cogsLines[] = [
                    'account_id' => (int) $row->id,
                    'code' => $row->code,
                    'name_en' => $row->name_en,
                    'name_bn' => $row->name_bn,
                    'report_group' => $row->report_group,
                    'amount_paisa' => $amount,
                ];
            } else {
                $amount = $debit - $credit;
                if ($amount === 0) {
                    continue;
                }
                $opExTotal += $amount;
                $expenseLines[] = [
                    'account_id' => (int) $row->id,
                    'code' => $row->code,
                    'name_en' => $row->name_en,
                    'name_bn' => $row->name_bn,
                    'report_group' => $row->report_group,
                    'amount_paisa' => $amount,
                ];
            }
        }

        $totalIncome = $revenueTotal + $otherIncomeTotal;
        $grossProfit = $revenueTotal - $cogsTotal;
        $netProfit = $totalIncome - $cogsTotal - $opExTotal;

        return [
            'from' => $from,
            'to' => $to,
            'can_view_profit' => $canViewProfit,
            'income_lines' => $incomeLines,
            'cogs_lines' => $canViewProfit ? $cogsLines : [],
            'expense_lines' => $expenseLines,
            'revenue_paisa' => $revenueTotal,
            'other_income_paisa' => $otherIncomeTotal,
            'total_income_paisa' => $totalIncome,
            'cogs_paisa' => $canViewProfit ? $cogsTotal : null,
            'gross_profit_paisa' => $canViewProfit ? $grossProfit : null,
            'operating_expense_paisa' => $opExTotal,
            'net_profit_paisa' => $canViewProfit ? $netProfit : null,
        ];
    }

    /**
     * Cash & Bank balances and ledger lines (report_group IN cash, bank).
     *
     * @return array<string, mixed>
     */
    public function cashAndBankBook(int $tenantId, ?int $branchId, string $from, string $to, ?int $accountId = null): array
    {
        $cashBankAccounts = Account::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('report_group', ['cash', 'bank'])
            ->where('is_active', true)
            ->orderBy('code')
            ->get();

        $accountIds = $cashBankAccounts->pluck('id')->all();

        $balanceRows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '<=', $to)
            ->whereIn('vl.account_id', $accountIds ?: [-1])
            ->groupBy('vl.account_id')
            ->selectRaw('vl.account_id, SUM(vl.debit_paisa - vl.credit_paisa) as balance_paisa')
            ->pluck('balance_paisa', 'account_id');

        $accountsSummary = $cashBankAccounts->map(fn (Account $a) => [
            'id' => $a->id,
            'code' => $a->code,
            'name_en' => $a->name_en,
            'name_bn' => $a->name_bn,
            'report_group' => $a->report_group,
            'balance_paisa' => (int) ($balanceRows[$a->id] ?? 0),
        ])->values()->all();

        $filterIds = ($accountId && in_array($accountId, $accountIds, true)) ? [$accountId] : $accountIds;

        // Opening balance strictly before $from
        $openingPaisa = (int) DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '<', $from)
            ->whereIn('vl.account_id', $filterIds ?: [-1])
            ->selectRaw('COALESCE(SUM(vl.debit_paisa - vl.credit_paisa), 0) as bal')
            ->value('bal');

        $entriesRaw = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->leftJoin('branches as b', 'b.id', '=', 'v.branch_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '>=', $from)
            ->whereDate('v.date', '<=', $to)
            ->whereIn('vl.account_id', $filterIds ?: [-1])
            ->orderBy('v.date')
            ->orderBy('v.id')
            ->orderBy('vl.id')
            ->select([
                'vl.id',
                'v.id as voucher_id',
                'v.number as voucher_number',
                'v.type as voucher_type',
                'v.date',
                'v.narration as voucher_narration',
                'vl.narration as line_narration',
                'vl.debit_paisa',
                'vl.credit_paisa',
                'a.code as account_code',
                'a.name_en as account_name_en',
                'a.name_bn as account_name_bn',
                'b.name as branch_name',
            ])
            ->get();

        $running = $openingPaisa;
        $entries = [];
        $totalIn = 0;
        $totalOut = 0;

        foreach ($entriesRaw as $r) {
            $in = (int) $r->debit_paisa;
            $out = (int) $r->credit_paisa;
            $running += ($in - $out);
            $totalIn += $in;
            $totalOut += $out;

            $entries[] = [
                'id' => (int) $r->id,
                'voucher_id' => (int) $r->voucher_id,
                'voucher_number' => $r->voucher_number,
                'voucher_type' => $r->voucher_type,
                'date' => (string) $r->date,
                'narration' => $r->line_narration ?: $r->voucher_narration,
                'account_code' => $r->account_code,
                'account_name_en' => $r->account_name_en,
                'account_name_bn' => $r->account_name_bn,
                'branch_name' => $r->branch_name,
                'in_paisa' => $in,
                'out_paisa' => $out,
                'running_balance_paisa' => $running,
            ];
        }

        return [
            'from' => $from,
            'to' => $to,
            'selected_account_id' => $accountId,
            'accounts' => $accountsSummary,
            'opening_balance_paisa' => $openingPaisa,
            'total_in_paisa' => $totalIn,
            'total_out_paisa' => $totalOut,
            'closing_balance_paisa' => $running,
            'entries' => $entries,
        ];
    }

    /**
     * @return array<string, array{debit: int, credit: int, net_debit: int, net_credit: int}>
     */
    private function sumByReportGroup(int $tenantId, ?int $branchId, ?string $from, ?string $to): array
    {
        $rows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->when($from !== null, fn ($q) => $q->whereDate('v.date', '>=', $from))
            ->when($to !== null, fn ($q) => $q->whereDate('v.date', '<=', $to))
            ->groupBy('a.report_group')
            ->selectRaw('a.report_group, SUM(vl.debit_paisa) as total_debit, SUM(vl.credit_paisa) as total_credit')
            ->get();

        $out = [];
        foreach ($rows as $r) {
            $d = (int) $r->total_debit;
            $c = (int) $r->total_credit;
            $out[$r->report_group] = [
                'debit' => $d,
                'credit' => $c,
                'net_debit' => $d - $c,
                'net_credit' => $c - $d,
            ];
        }

        return $out;
    }

    private function resolvePaymentAccountId(AccountingSetting $settings, string $channel): int
    {
        $accountId = match ($channel) {
            'bank' => $settings->default_bank_account_id,
            'wallet', 'bkash', 'nagad' => $settings->default_wallet_account_id ?? $settings->default_bank_account_id,
            default => $settings->default_cash_account_id,
        };

        if (! $accountId) {
            $fallbackCode = match ($channel) {
                'bank' => '1020',
                'wallet', 'bkash', 'nagad' => '1030',
                default => '1010',
            };
            $accountId = Account::query()->where('code', $fallbackCode)->value('id');
        }

        if (! $accountId) {
            throw new DomainException("Default payment account for '{$channel}' is not configured.");
        }

        return (int) $accountId;
    }
}

