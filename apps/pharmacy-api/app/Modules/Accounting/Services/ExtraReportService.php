<?php

namespace App\Modules\Accounting\Services;

use App\Models\Branch;
use App\Modules\Accounting\Models\Voucher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ExtraReportService
{
    /**
     * Direct-method Cash Flow Statement over [from, to].
     * Guarantees: Opening Cash & Bank + Net Cash Flow === Actual Closing Cash & Bank.
     *
     * @return array<string, mixed>
     */
    public function cashFlowStatement(int $tenantId, ?int $branchId, string $from, string $to): array
    {
        $openingCash = (int) DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereIn('a.report_group', ['cash', 'bank'])
            ->whereDate('v.date', '<', $from)
            ->selectRaw('COALESCE(SUM(vl.debit_paisa - vl.credit_paisa), 0) as bal')
            ->value('bal');

        $actualClosingCash = (int) DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereIn('a.report_group', ['cash', 'bank'])
            ->whereDate('v.date', '<=', $to)
            ->selectRaw('COALESCE(SUM(vl.debit_paisa - vl.credit_paisa), 0) as bal')
            ->value('bal');

        // Pull all lines belonging to vouchers that touched Cash or Bank in [from, to]
        $voucherIds = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->whereIn('a.report_group', ['cash', 'bank'])
            ->whereDate('v.date', '>=', $from)
            ->whereDate('v.date', '<=', $to)
            ->distinct()
            ->pluck('v.id')
            ->all();

        $allLines = empty($voucherIds)
            ? collect()
            : DB::table('voucher_lines as vl')
                ->join('accounts as a', 'a.id', '=', 'vl.account_id')
                ->where('vl.tenant_id', $tenantId)
                ->whereIn('vl.voucher_id', $voucherIds)
                ->select(['vl.voucher_id', 'vl.debit_paisa', 'vl.credit_paisa', 'a.code', 'a.report_group', 'a.type'])
                ->get()
                ->groupBy('voucher_id');

        $operatingIn = 0;
        $operatingOut = 0;
        $investingIn = 0;
        $investingOut = 0;
        $financingIn = 0;
        $financingOut = 0;

        foreach ($allLines as $vLines) {
            $cashDelta = 0;
            $counterGroups = [];
            $counterCodes = [];

            foreach ($vLines as $ln) {
                if (in_array($ln->report_group, ['cash', 'bank'], true)) {
                    $cashDelta += ((int) $ln->debit_paisa - (int) $ln->credit_paisa);
                } else {
                    $counterGroups[] = (string) $ln->report_group;
                    $counterCodes[] = (string) $ln->code;
                }
            }

            // Internal Contra transfers (Cash <-> Bank) have cashDelta === 0
            if ($cashDelta === 0) {
                continue;
            }

            $isInvesting = in_array('fixed_asset', $counterGroups, true);
            $isFinancing = in_array('equity', $counterGroups, true) || in_array('2300', $counterCodes, true);

            if ($isInvesting) {
                if ($cashDelta > 0) {
                    $investingIn += $cashDelta;
                } else {
                    $investingOut += abs($cashDelta);
                }
            } elseif ($isFinancing) {
                if ($cashDelta > 0) {
                    $financingIn += $cashDelta;
                } else {
                    $financingOut += abs($cashDelta);
                }
            } else {
                if ($cashDelta > 0) {
                    $operatingIn += $cashDelta;
                } else {
                    $operatingOut += abs($cashDelta);
                }
            }
        }

        $operatingNet = $operatingIn - $operatingOut;
        $investingNet = $investingIn - $investingOut;
        $financingNet = $financingIn - $financingOut;
        $netChange = $operatingNet + $investingNet + $financingNet;
        $computedClosing = $openingCash + $netChange;

        return [
            'from' => $from,
            'to' => $to,
            'opening_cash_paisa' => $openingCash,
            'operating' => [
                'inflow_paisa' => $operatingIn,
                'outflow_paisa' => $operatingOut,
                'net_paisa' => $operatingNet,
            ],
            'investing' => [
                'inflow_paisa' => $investingIn,
                'outflow_paisa' => $investingOut,
                'net_paisa' => $investingNet,
            ],
            'financing' => [
                'inflow_paisa' => $financingIn,
                'outflow_paisa' => $financingOut,
                'net_paisa' => $financingNet,
            ],
            'net_change_paisa' => $netChange,
            'closing_cash_paisa' => $computedClosing,
            'actual_closing_cash_paisa' => $actualClosingCash,
            'reconciled' => $computedClosing === $actualClosingCash,
        ];
    }

    /**
     * Multi-branch side-by-side financial comparison.
     *
     * @return array<string, mixed>
     */
    public function branchComparison(
        int $tenantId,
        ?int $scopedBranchId,
        string $from,
        string $to,
        bool $canViewProfit,
    ): array {
        $branches = Branch::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->when($scopedBranchId !== null, fn ($q) => $q->where('id', $scopedBranchId))
            ->orderByDesc('is_head_office')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $periodRows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($scopedBranchId !== null, fn ($q) => $q->where('v.branch_id', $scopedBranchId))
            ->whereDate('v.date', '>=', $from)
            ->whereDate('v.date', '<=', $to)
            ->whereIn('a.report_group', ['revenue', 'other_income', 'cogs', 'operating_expense'])
            ->groupBy('v.branch_id', 'a.report_group')
            ->selectRaw('v.branch_id, a.report_group, SUM(vl.debit_paisa) as d, SUM(vl.credit_paisa) as c')
            ->get();

        $asOfRows = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($scopedBranchId !== null, fn ($q) => $q->where('v.branch_id', $scopedBranchId))
            ->whereDate('v.date', '<=', $to)
            ->whereIn('a.report_group', ['cash', 'bank', 'receivable', 'payable'])
            ->groupBy('v.branch_id', 'a.report_group')
            ->selectRaw('v.branch_id, a.report_group, SUM(vl.debit_paisa) as d, SUM(vl.credit_paisa) as c')
            ->get();

        $map = [];
        foreach ($branches as $b) {
            $map[$b->id] = [
                'branch_id' => $b->id,
                'branch_name' => $b->name,
                'branch_code' => $b->code,
                'revenue_paisa' => 0,
                'cogs_paisa' => 0,
                'gross_profit_paisa' => 0,
                'operating_expense_paisa' => 0,
                'net_profit_paisa' => 0,
                'margin_pct' => 0.0,
                'cash_and_bank_paisa' => 0,
                'receivable_paisa' => 0,
                'payable_paisa' => 0,
            ];
        }

        foreach ($periodRows as $r) {
            $bId = (int) $r->branch_id;
            if (! isset($map[$bId])) {
                continue;
            }
            $d = (int) $r->d;
            $c = (int) $r->c;
            if (in_array($r->report_group, ['revenue', 'other_income'], true)) {
                $map[$bId]['revenue_paisa'] += ($c - $d);
            } elseif ($r->report_group === 'cogs') {
                $map[$bId]['cogs_paisa'] += ($d - $c);
            } else {
                $map[$bId]['operating_expense_paisa'] += ($d - $c);
            }
        }

        foreach ($asOfRows as $r) {
            $bId = (int) $r->branch_id;
            if (! isset($map[$bId])) {
                continue;
            }
            $d = (int) $r->d;
            $c = (int) $r->c;
            if (in_array($r->report_group, ['cash', 'bank'], true)) {
                $map[$bId]['cash_and_bank_paisa'] += ($d - $c);
            } elseif ($r->report_group === 'receivable') {
                $map[$bId]['receivable_paisa'] += ($d - $c);
            } elseif ($r->report_group === 'payable') {
                $map[$bId]['payable_paisa'] += ($c - $d);
            }
        }

        $rows = [];
        foreach ($map as $item) {
            $gross = $item['revenue_paisa'] - $item['cogs_paisa'];
            $net = $gross - $item['operating_expense_paisa'];
            $item['gross_profit_paisa'] = $canViewProfit ? $gross : null;
            $item['cogs_paisa'] = $canViewProfit ? $item['cogs_paisa'] : null;
            $item['net_profit_paisa'] = $canViewProfit ? $net : null;
            $item['margin_pct'] = $canViewProfit
                ? ($item['revenue_paisa'] > 0 ? round(($net / $item['revenue_paisa']) * 100, 1) : 0.0)
                : null;
            $rows[] = $item;
        }

        return [
            'from' => $from,
            'to' => $to,
            'can_view_profit' => $canViewProfit,
            'rows' => $rows,
        ];
    }

    /**
     * Inventory Valuation Report reconciling Accounting Inventory Ledger vs Stock Movements & Live Warehouse Batches.
     *
     * @return array<string, mixed>
     */
    public function inventoryValuation(int $tenantId, ?int $branchId, string $from, string $to): array
    {
        $accounts = DB::table('accounts as a')
            ->leftJoin('voucher_lines as vl', function ($join) use ($tenantId): void {
                $join->on('vl.account_id', '=', 'a.id')
                    ->where('vl.tenant_id', '=', $tenantId);
            })
            ->leftJoin('vouchers as v', function ($join) use ($tenantId, $branchId, $to): void {
                $join->on('v.id', '=', 'vl.voucher_id')
                    ->where('v.tenant_id', '=', $tenantId)
                    ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
                    ->whereDate('v.date', '<=', $to);
                if ($branchId !== null) {
                    $join->where('v.branch_id', '=', $branchId);
                }
            })
            ->where('a.tenant_id', $tenantId)
            ->where('a.report_group', 'inventory')
            ->groupBy('a.id', 'a.code', 'a.name_en', 'a.name_bn')
            ->orderBy('a.code')
            ->selectRaw('a.id, a.code, a.name_en, a.name_bn, COALESCE(SUM(CASE WHEN v.id IS NOT NULL THEN vl.debit_paisa - vl.credit_paisa ELSE 0 END), 0) as balance_paisa')
            ->get()
            ->map(fn ($r) => [
                'account_id' => (int) $r->id,
                'code' => $r->code,
                'name_en' => $r->name_en,
                'name_bn' => $r->name_bn,
                'balance_paisa' => (int) $r->balance_paisa,
            ])->values()->all();

        $ledgerTotalPaisa = array_sum(array_column($accounts, 'balance_paisa'));

        // Period movement breakdown on Inventory accounts
        $movements = DB::table('voucher_lines as vl')
            ->join('vouchers as v', 'v.id', '=', 'vl.voucher_id')
            ->join('accounts as a', 'a.id', '=', 'vl.account_id')
            ->where('v.tenant_id', $tenantId)
            ->where('vl.tenant_id', $tenantId)
            ->whereIn('v.status', [Voucher::STATUS_POSTED, Voucher::STATUS_REVERSED])
            ->when($branchId !== null, fn ($q) => $q->where('v.branch_id', $branchId))
            ->where('a.report_group', 'inventory')
            ->whereDate('v.date', '>=', $from)
            ->whereDate('v.date', '<=', $to)
            ->groupBy('v.type')
            ->selectRaw('v.type, SUM(vl.debit_paisa) as added_paisa, SUM(vl.credit_paisa) as reduced_paisa')
            ->get()
            ->map(fn ($r) => [
                'voucher_type' => $r->type,
                'added_paisa' => (int) $r->added_paisa,
                'reduced_paisa' => (int) $r->reduced_paisa,
                'net_paisa' => (int) $r->added_paisa - (int) $r->reduced_paisa,
            ])->values()->all();

        // Optional warehouse batch valuation comparison (read-only cross-check if batches table exists)
        $warehouseBatchValuePaisa = null;
        if (Schema::hasTable('batches')) {
            $rawVal = DB::table('batches')
                ->where('tenant_id', $tenantId)
                ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
                ->where('quantity', '>', 0)
                ->selectRaw('COALESCE(SUM(ROUND(quantity * COALESCE(purchase_price, 0) * 100)), 0) as val_paisa')
                ->value('val_paisa');
            $warehouseBatchValuePaisa = (int) $rawVal;
        }

        return [
            'from' => $from,
            'to' => $to,
            'accounts' => $accounts,
            'ledger_total_paisa' => $ledgerTotalPaisa,
            'warehouse_batch_value_paisa' => $warehouseBatchValuePaisa,
            'variance_paisa' => $warehouseBatchValuePaisa !== null ? ($ledgerTotalPaisa - $warehouseBatchValuePaisa) : null,
            'movements' => $movements,
        ];
    }
}

