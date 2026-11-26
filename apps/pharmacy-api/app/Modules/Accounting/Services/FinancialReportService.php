<?php

namespace App\Modules\Accounting\Services;

use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\Voucher;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinancialReportService
{
    /**
     * General Account Ledger for a single account over [from, to].
     *
     * @return array<string, mixed>
     */
    public function generalLedger(
        int $tenantId,
        int $accountId,
        ?int $branchId,
        string $from,
        string $to,
    ): array {
        /** @var Account $account */
        $account = Account::query()
            ->where('tenant_id', $tenantId)
            ->findOrFail($accountId);

        $isCreditNormal = in_array($account->type, ['liability', 'equity', 'income'], true);

        $openingRaw = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->where('vl.account_id', $account->id)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '<', $from)
            ->selectRaw('COALESCE(SUM(vl.debit_paisa), 0) as d, COALESCE(SUM(vl.credit_paisa), 0) as c')
            ->first();

        $openingPaisa = $isCreditNormal
            ? ((int) $openingRaw->c - (int) $openingRaw->d)
            : ((int) $openingRaw->d - (int) $openingRaw->c);

        $rows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->leftJoin('branches as b', 'b.id', '=', 'v.branch_id')
            ->leftJoin('parties as p', 'p.id', '=', 'vl.party_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->where('vl.account_id', $account->id)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '>=', $from)
            ->whereDate('v.date', '<=', $to)
            ->orderBy('v.date')
            ->orderBy('v.id')
            ->orderBy('vl.id')
            ->select([
                'vl.id',
                'v.id as voucher_id',
                'v.number as voucher_number',
                'v.type as voucher_type',
                'v.status as voucher_status',
                'v.date',
                'v.narration as voucher_narration',
                'vl.narration as line_narration',
                'vl.debit_paisa',
                'vl.credit_paisa',
                'b.name as branch_name',
                'p.name as party_name',
            ])
            ->get();

        $running = $openingPaisa;
        $totalDebit = 0;
        $totalCredit = 0;
        $entries = [];

        foreach ($rows as $r) {
            $d = (int) $r->debit_paisa;
            $c = (int) $r->credit_paisa;
            $totalDebit += $d;
            $totalCredit += $c;
            $running += $isCreditNormal ? ($c - $d) : ($d - $c);

            $entries[] = [
                'id' => (int) $r->id,
                'voucher_id' => (int) $r->voucher_id,
                'voucher_number' => $r->voucher_number,
                'voucher_type' => $r->voucher_type,
                'voucher_status' => $r->voucher_status,
                'date' => (string) $r->date,
                'narration' => $r->line_narration ?: $r->voucher_narration,
                'branch_name' => $r->branch_name,
                'party_name' => $r->party_name,
                'debit_paisa' => $d,
                'credit_paisa' => $c,
                'running_balance_paisa' => $running,
            ];
        }

        return [
            'account' => [
                'id' => $account->id,
                'code' => $account->code,
                'name_en' => $account->name_en,
                'name_bn' => $account->name_bn,
                'type' => $account->type,
                'report_group' => $account->report_group,
                'is_credit_normal' => $isCreditNormal,
            ],
            'from' => $from,
            'to' => $to,
            'opening_balance_paisa' => $openingPaisa,
            'total_debit_paisa' => $totalDebit,
            'total_credit_paisa' => $totalCredit,
            'closing_balance_paisa' => $running,
            'entries' => $entries,
        ];
    }

    /**
     * Trial Balance aggregated in SQL from Posted + Reversed vouchers.
     *
     * @return array<string, mixed>
     */
    public function trialBalance(
        int $tenantId,
        ?int $branchId,
        string $from,
        string $to,
    ): array {
        $openingRows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '<', $from)
            ->groupBy('vl.account_id')
            ->selectRaw('vl.account_id, SUM(vl.debit_paisa) as total_debit, SUM(vl.credit_paisa) as total_credit')
            ->get()
            ->keyBy('account_id');

        $periodRows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '>=', $from)
            ->whereDate('v.date', '<=', $to)
            ->groupBy('vl.account_id')
            ->selectRaw('vl.account_id, SUM(vl.debit_paisa) as total_debit, SUM(vl.credit_paisa) as total_credit')
            ->get()
            ->keyBy('account_id');

        $accounts = Account::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('code')
            ->get(['id', 'code', 'name_en', 'name_bn', 'type', 'report_group']);

        $rows = [];
        $totals = [
            'opening_debit_paisa' => 0,
            'opening_credit_paisa' => 0,
            'period_debit_paisa' => 0,
            'period_credit_paisa' => 0,
            'closing_debit_paisa' => 0,
            'closing_credit_paisa' => 0,
        ];

        foreach ($accounts as $acc) {
            $op = $openingRows->get($acc->id);
            $pr = $periodRows->get($acc->id);

            $opNet = ($op ? (int) $op->total_debit - (int) $op->total_credit : 0);
            $opDr = $opNet > 0 ? $opNet : 0;
            $opCr = $opNet < 0 ? abs($opNet) : 0;

            $prDr = $pr ? (int) $pr->total_debit : 0;
            $prCr = $pr ? (int) $pr->total_credit : 0;

            $clNet = $opNet + $prDr - $prCr;
            $clDr = $clNet > 0 ? $clNet : 0;
            $clCr = $clNet < 0 ? abs($clNet) : 0;

            if ($opDr === 0 && $opCr === 0 && $prDr === 0 && $prCr === 0 && $clDr === 0 && $clCr === 0) {
                continue;
            }

            $totals['opening_debit_paisa'] += $opDr;
            $totals['opening_credit_paisa'] += $opCr;
            $totals['period_debit_paisa'] += $prDr;
            $totals['period_credit_paisa'] += $prCr;
            $totals['closing_debit_paisa'] += $clDr;
            $totals['closing_credit_paisa'] += $clCr;

            $rows[] = [
                'account_id' => $acc->id,
                'code' => $acc->code,
                'name_en' => $acc->name_en,
                'name_bn' => $acc->name_bn,
                'type' => $acc->type,
                'report_group' => $acc->report_group,
                'opening_debit_paisa' => $opDr,
                'opening_credit_paisa' => $opCr,
                'period_debit_paisa' => $prDr,
                'period_credit_paisa' => $prCr,
                'closing_debit_paisa' => $clDr,
                'closing_credit_paisa' => $clCr,
            ];
        }

        $diff = $totals['closing_debit_paisa'] - $totals['closing_credit_paisa'];

        return [
            'from' => $from,
            'to' => $to,
            'rows' => $rows,
            'totals' => $totals,
            'difference_paisa' => $diff,
            'balanced' => $diff === 0 && $totals['period_debit_paisa'] === $totals['period_credit_paisa'],
        ];
    }

    /**
     * Balance Sheet as of $asOf date, grouped strictly by report_group.
     * Includes unclosed Current-Period Profit inside Equity so Assets === Liabilities + Equity always holds.
     *
     * @return array<string, mixed>
     */
    public function balanceSheet(
        int $tenantId,
        ?int $branchId,
        string $asOf,
        bool $canViewProfit = true,
    ): array {
        $rows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereDate('v.date', '<=', $asOf)
            ->groupBy('a.id', 'a.code', 'a.name_en', 'a.name_bn', 'a.type', 'a.report_group', 'a.is_contra')
            ->orderBy('a.code')
            ->selectRaw('a.id, a.code, a.name_en, a.name_bn, a.type, a.report_group, a.is_contra, SUM(vl.debit_paisa) as total_debit, SUM(vl.credit_paisa) as total_credit')
            ->get();

        $assetGroupTotals = [
            'cash' => 0,
            'bank' => 0,
            'receivable' => 0,
            'inventory' => 0,
            'other_current_asset' => 0,
            'fixed_asset' => 0,
        ];
        $liabilityGroupTotals = [
            'payable' => 0,
            'other_liability' => 0,
        ];

        $assetAccounts = [];
        $liabilityAccounts = [];
        $equityAccounts = [];

        $vatInputNet = 0;  // debit - credit
        $vatOutputNet = 0; // credit - debit
        $equityBase = 0;
        $currentPeriodProfit = 0; // SUM(credit - debit) across income & expense

        foreach ($rows as $row) {
            $d = (int) $row->total_debit;
            $c = (int) $row->total_credit;
            $rg = (string) $row->report_group;

            if ($rg === 'vat_input') {
                $vatInputNet += ($d - $c);
                continue;
            }
            if ($rg === 'vat_output') {
                $vatOutputNet += ($c - $d);
                continue;
            }

            if (array_key_exists($rg, $assetGroupTotals)) {
                $amount = $d - $c;
                $assetGroupTotals[$rg] += $amount;
                if ($amount !== 0) {
                    $assetAccounts[] = [
                        'account_id' => (int) $row->id,
                        'code' => $row->code,
                        'name_en' => $row->name_en,
                        'name_bn' => $row->name_bn,
                        'report_group' => $rg,
                        'amount_paisa' => $amount,
                    ];
                }
            } elseif (array_key_exists($rg, $liabilityGroupTotals)) {
                $amount = $c - $d;
                $liabilityGroupTotals[$rg] += $amount;
                if ($amount !== 0) {
                    $liabilityAccounts[] = [
                        'account_id' => (int) $row->id,
                        'code' => $row->code,
                        'name_en' => $row->name_en,
                        'name_bn' => $row->name_bn,
                        'report_group' => $rg,
                        'amount_paisa' => $amount,
                    ];
                }
            } elseif ($rg === 'equity') {
                $amount = $c - $d;
                $equityBase += $amount;
                if ($amount !== 0) {
                    $equityAccounts[] = [
                        'account_id' => (int) $row->id,
                        'code' => $row->code,
                        'name_en' => $row->name_en,
                        'name_bn' => $row->name_bn,
                        'report_group' => $rg,
                        'amount_paisa' => $amount,
                    ];
                }
            } elseif (in_array($rg, ['revenue', 'other_income', 'cogs', 'operating_expense'], true)) {
                $currentPeriodProfit += ($c - $d);
            }
        }

        // Net VAT: if Output >= Input, show Net VAT Payable under Liabilities; otherwise Net VAT Refundable under Assets
        $netVatPayable = $vatOutputNet - $vatInputNet;
        $vatAssetPaisa = 0;
        $vatLiabilityPaisa = 0;

        if ($netVatPayable >= 0) {
            $vatLiabilityPaisa = $netVatPayable;
            if ($vatLiabilityPaisa > 0) {
                $liabilityAccounts[] = [
                    'account_id' => null,
                    'code' => 'VAT',
                    'name_en' => 'Net VAT Payable (Output − Input)',
                    'name_bn' => 'নিট ভ্যাট প্রদেয় (আউটপুট − ইনপুট)',
                    'report_group' => 'vat_output',
                    'amount_paisa' => $vatLiabilityPaisa,
                ];
            }
        } else {
            $vatAssetPaisa = abs($netVatPayable);
            $assetAccounts[] = [
                'account_id' => null,
                'code' => 'VAT',
                'name_en' => 'Net Input VAT Receivable',
                'name_bn' => 'নিট ইনপুট ভ্যাট প্রাপ্য',
                'report_group' => 'vat_input',
                'amount_paisa' => $vatAssetPaisa,
            ];
        }

        $assetSummary = [
            ['key' => 'cash_and_bank', 'label_en' => 'Cash & Bank', 'label_bn' => 'নগদ ও ব্যাংক', 'amount_paisa' => $assetGroupTotals['cash'] + $assetGroupTotals['bank']],
            ['key' => 'receivable', 'label_en' => 'Accounts Receivable', 'label_bn' => 'প্রাপ্য হিসাব (বকেয়া)', 'amount_paisa' => $assetGroupTotals['receivable']],
            ['key' => 'inventory', 'label_en' => 'Inventory', 'label_bn' => 'মজুদ পণ্য (ইনভেন্টরি)', 'amount_paisa' => $assetGroupTotals['inventory']],
            ['key' => 'other_current_asset', 'label_en' => 'Other Current Assets', 'label_bn' => 'অন্যান্য চলতি সম্পদ', 'amount_paisa' => $assetGroupTotals['other_current_asset'] + $vatAssetPaisa],
            ['key' => 'fixed_asset', 'label_en' => 'Fixed Assets (Net)', 'label_bn' => 'স্থায়ী সম্পদ (নিট)', 'amount_paisa' => $assetGroupTotals['fixed_asset']],
        ];

        $liabilitySummary = [
            ['key' => 'payable', 'label_en' => 'Accounts Payable', 'label_bn' => 'প্রদেয় হিসাব (সরবরাহকারী)', 'amount_paisa' => $liabilityGroupTotals['payable']],
            ['key' => 'vat_net', 'label_en' => 'VAT Payable (Net)', 'label_bn' => 'ভ্যাট প্রদেয় (নিট)', 'amount_paisa' => $vatLiabilityPaisa],
            ['key' => 'other_liability', 'label_en' => 'Other Liabilities & Loans', 'label_bn' => 'অন্যান্য দায় ও ঋণ', 'amount_paisa' => $liabilityGroupTotals['other_liability']],
        ];

        $totalAssets = array_sum(array_column($assetSummary, 'amount_paisa'));
        $totalLiabilities = array_sum(array_column($liabilitySummary, 'amount_paisa'));
        $totalEquityTrue = $equityBase + $currentPeriodProfit;

        // Fundamental accounting identity check: Assets === Liabilities + Equity
        $difference = $totalAssets - ($totalLiabilities + $totalEquityTrue);
        $balanced = $difference === 0;

        $equitySummary = [
            ['key' => 'capital_and_retained', 'label_en' => 'Owner Capital & Retained Earnings', 'label_bn' => 'মালিকের মূলধন ও সঞ্চিত মুনাফা', 'amount_paisa' => $equityBase],
            ['key' => 'current_profit', 'label_en' => 'Current-Period Net Profit', 'label_bn' => 'চলতি সময়ের নিট লাভ', 'amount_paisa' => $canViewProfit ? $currentPeriodProfit : null],
        ];

        return [
            'as_of' => $asOf,
            'can_view_profit' => $canViewProfit,
            'assets' => [
                'groups' => $assetSummary,
                'accounts' => $assetAccounts,
                'total_paisa' => $totalAssets,
            ],
            'liabilities' => [
                'groups' => $liabilitySummary,
                'accounts' => $liabilityAccounts,
                'total_paisa' => $totalLiabilities,
            ],
            'equity' => [
                'groups' => $equitySummary,
                'accounts' => $equityAccounts,
                'current_period_profit_paisa' => $canViewProfit ? $currentPeriodProfit : null,
                'total_paisa' => $canViewProfit ? $totalEquityTrue : null,
            ],
            'total_assets_paisa' => $totalAssets,
            'total_liabilities_paisa' => $totalLiabilities,
            'total_equity_paisa' => $canViewProfit ? $totalEquityTrue : null,
            'total_liabilities_and_equity_paisa' => $totalLiabilities + $totalEquityTrue,
            'difference_paisa' => $difference,
            'balanced' => $balanced,
        ];
    }

    /**
     * Stream a UTF-8 BOM CSV file (Excel-compatible with Bangla text).
     *
     * @param  array<int, string>  $headers
     * @param  array<int, array<int, string|int|float|null>>  $rows
     */
    public function exportCsv(string $filename, array $headers, array $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($headers, $rows): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }
            // UTF-8 BOM so Microsoft Excel renders Bangla characters cleanly
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}

