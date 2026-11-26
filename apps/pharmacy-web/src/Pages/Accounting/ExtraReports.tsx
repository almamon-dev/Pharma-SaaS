import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Building2, CheckCircle2, Download, Package, Printer, Waves } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import AccountingNav from './components/AccountingNav';
import {
    AccountingBranchOption,
    AccountingPermissions,
    AccountingSettingsData,
    formatPaisa,
    useAccountingLang,
} from './types';

interface ExtraReportsProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    filters: { from: string; to: string; tab: 'cash-flow' | 'branch-comparison' | 'inventory-valuation' };
    cashFlow: {
        from: string;
        to: string;
        opening_cash_paisa: number;
        operating: { inflow_paisa: number; outflow_paisa: number; net_paisa: number };
        investing: { inflow_paisa: number; outflow_paisa: number; net_paisa: number };
        financing: { inflow_paisa: number; outflow_paisa: number; net_paisa: number };
        net_change_paisa: number;
        closing_cash_paisa: number;
        actual_closing_cash_paisa: number;
        reconciled: boolean;
    };
    branchComparison: {
        can_view_profit: boolean;
        rows: Array<{
            branch_id: number;
            branch_name: string;
            branch_code: string;
            revenue_paisa: number;
            cogs_paisa: number | null;
            gross_profit_paisa: number | null;
            operating_expense_paisa: number;
            net_profit_paisa: number | null;
            margin_pct: number | null;
            cash_and_bank_paisa: number;
            receivable_paisa: number;
            payable_paisa: number;
        }>;
    };
    inventoryValuation: {
        accounts: Array<{ account_id: number; code: string; name_en: string; name_bn: string; balance_paisa: number }>;
        ledger_total_paisa: number;
        warehouse_batch_value_paisa: number | null;
        variance_paisa: number | null;
        movements: Array<{ voucher_type: string; added_paisa: number; reduced_paisa: number; net_paisa: number }>;
    };
}

export default function ExtraReports({
    settings,
    permissions,
    branches,
    selectedBranchId,
    filters,
    cashFlow,
    branchComparison,
    inventoryValuation,
}: ExtraReportsProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [tab, setTab] = useState(filters.tab);
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? ''));

    const applyFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            route('accounting.extra-reports'),
            {
                tab,
                from,
                to,
                ...(branchId ? { branch_id: branchId } : {}),
            },
            { preserveState: true, replace: true }
        );
    };

    return (
        <AppLayout title={isBn ? 'ক্যাশ ফ্লো, শাখা তুলনা ও ইনভেন্টরি মূল্যায়ন' : 'Cash Flow & Analytical Reports'}>
            <Head title="Cash Flow & Analytical Reports" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="extra-reports"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                {/* Tabs & Filters */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setTab('cash-flow')}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-[2px] cursor-pointer ${
                                tab === 'cash-flow'
                                    ? 'bg-[#0E5F3F] text-white'
                                    : 'bg-white dark:bg-[#181d25] border border-[#CCCCCC] dark:border-slate-700'
                            }`}
                        >
                            <Waves className="w-3.5 h-3.5" />
                            {isBn ? 'ক্যাশ ফ্লো বিবরণী' : 'Cash Flow Statement'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('branch-comparison')}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-[2px] cursor-pointer ${
                                tab === 'branch-comparison'
                                    ? 'bg-[#0E5F3F] text-white'
                                    : 'bg-white dark:bg-[#181d25] border border-[#CCCCCC] dark:border-slate-700'
                            }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            {isBn ? 'শাখা তুলনা' : 'Branch Comparison'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('inventory-valuation')}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-[2px] cursor-pointer ${
                                tab === 'inventory-valuation'
                                    ? 'bg-[#0E5F3F] text-white'
                                    : 'bg-white dark:bg-[#181d25] border border-[#CCCCCC] dark:border-slate-700'
                            }`}
                        >
                            <Package className="w-3.5 h-3.5" />
                            {isBn ? 'ইনভেন্টরি মূল্যায়ন' : 'Inventory Valuation'}
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <form onSubmit={applyFilter} className="flex flex-wrap items-center gap-2">
                            <input
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                className="h-[32px] px-2 font-mono text-[12px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                            />
                            <input
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className="h-[32px] px-2 font-mono text-[12px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                            />
                            {permissions.all_branches && branches.length > 1 && tab !== 'branch-comparison' && (
                                <select
                                    value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                    className="h-[32px] px-2 text-[12px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                >
                                    <option value="">All branches</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            )}
                            <Button type="submit" size="sm" variant="default">Apply</Button>
                        </form>

                        {tab !== 'inventory-valuation' && (
                            <a
                                href={route('accounting.extra-reports.export', {
                                    report: tab,
                                    from,
                                    to,
                                    ...(selectedBranchId ? { branch_id: selectedBranchId } : {}),
                                })}
                                className="inline-flex items-center gap-1.5 h-[32px] px-2.5 text-[12px] font-semibold rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F5F7F4] dark:bg-slate-800"
                            >
                                <Download className="w-3.5 h-3.5 text-[#0E5F3F]" />
                                CSV
                            </a>
                        )}
                        <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            Print
                        </Button>
                    </div>
                </div>

                {/* Tab 1: Cash Flow Statement */}
                {tab === 'cash-flow' && (
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between">
                            <h2 className="text-[15px] font-bold">
                                {isBn ? 'নগদ প্রবাহ বিবরণী (Direct Cash Flow)' : 'Cash Flow Statement (Direct Method)'}
                            </h2>
                            {cashFlow.reconciled && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Reconciled with Cash & Bank Ledger
                                </span>
                            )}
                        </div>
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left border-collapse text-[13px]">
                                <thead>
                                    <tr className="bg-[#f8fafc] dark:bg-[#161a22] border-b border-slate-200 dark:border-slate-800 font-semibold">
                                        <th className="px-4 py-2.5">Activity</th>
                                        <th className="px-4 py-2.5 text-right">Cash Inflow</th>
                                        <th className="px-4 py-2.5 text-right">Cash Outflow</th>
                                        <th className="px-4 py-2.5 text-right">Net Cash Flow</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                                    <tr className="bg-[#F5F7F4]/70 dark:bg-slate-800/40 font-semibold">
                                        <td className="px-4 py-2.5" colSpan={3}>Opening Cash & Bank Balance ({cashFlow.from})</td>
                                        <td className="px-4 py-2.5 text-right font-mono">{formatPaisa(cashFlow.opening_cash_paisa)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2.5 font-medium">Operating Activities (Sales, Purchases, Expenses, VAT, Payroll)</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[#0E5F3F]">{formatPaisa(cashFlow.operating.inflow_paisa)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[#D9534F]">{formatPaisa(cashFlow.operating.outflow_paisa)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatPaisa(cashFlow.operating.net_paisa)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2.5 font-medium">Investing Activities (Fixed Assets / Equipment)</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[#0E5F3F]">{formatPaisa(cashFlow.investing.inflow_paisa)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[#D9534F]">{formatPaisa(cashFlow.investing.outflow_paisa)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatPaisa(cashFlow.investing.net_paisa)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2.5 font-medium">Financing Activities (Owner Capital, Drawings, Loans)</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[#0E5F3F]">{formatPaisa(cashFlow.financing.inflow_paisa)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono text-[#D9534F]">{formatPaisa(cashFlow.financing.outflow_paisa)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatPaisa(cashFlow.financing.net_paisa)}</td>
                                    </tr>
                                    <tr className="font-bold">
                                        <td className="px-4 py-2.5" colSpan={3}>Net Change in Cash & Bank</td>
                                        <td className="px-4 py-2.5 text-right font-mono">{formatPaisa(cashFlow.net_change_paisa)}</td>
                                    </tr>
                                    <tr className="bg-[#0E5F3F] text-white font-bold">
                                        <td className="px-4 py-2.5" colSpan={3}>Closing Cash & Bank Balance ({cashFlow.to})</td>
                                        <td className="px-4 py-2.5 text-right font-mono">{formatPaisa(cashFlow.closing_cash_paisa)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Tab 2: Branch Comparison */}
                {tab === 'branch-comparison' && (
                    <DataTable
                        tableId="accounting-branch-comparison-table"
                        data={branchComparison.rows}
                        columns={[
                            {
                                id: 'branch_name',
                                label: 'Branch',
                                render: (r) => (
                                    <span className="font-semibold whitespace-nowrap">
                                        {r.branch_name}{' '}
                                        <span className="font-mono text-[11px] text-[#666666]">
                                            ({r.branch_code})
                                        </span>
                                    </span>
                                ),
                            },
                            {
                                id: 'revenue_paisa',
                                label: 'Revenue',
                                className: 'text-right',
                                render: (r) => (
                                    <span className="font-mono whitespace-nowrap">
                                        {formatPaisa(r.revenue_paisa)}
                                    </span>
                                ),
                            },
                            ...(branchComparison.can_view_profit
                                ? [
                                      {
                                          id: 'cogs_paisa',
                                          label: 'COGS',
                                          className: 'text-right',
                                          render: (r: any) => (
                                              <span className="font-mono whitespace-nowrap">
                                                  {formatPaisa(r.cogs_paisa)}
                                              </span>
                                          ),
                                      },
                                      {
                                          id: 'gross_profit_paisa',
                                          label: 'Gross Profit',
                                          className: 'text-right',
                                          render: (r: any) => (
                                              <span className="font-mono text-[#0E5F3F] whitespace-nowrap">
                                                  {formatPaisa(r.gross_profit_paisa)}
                                              </span>
                                          ),
                                      },
                                  ]
                                : []),
                            {
                                id: 'operating_expense_paisa',
                                label: 'Op. Expenses',
                                className: 'text-right',
                                render: (r) => (
                                    <span className="font-mono whitespace-nowrap">
                                        {formatPaisa(r.operating_expense_paisa)}
                                    </span>
                                ),
                            },
                            ...(branchComparison.can_view_profit
                                ? [
                                      {
                                          id: 'net_profit_paisa',
                                          label: 'Net Profit',
                                          className: 'text-right',
                                          render: (r: any) => (
                                              <span
                                                  className={`font-mono font-bold whitespace-nowrap ${
                                                      (r.net_profit_paisa ?? 0) >= 0
                                                          ? 'text-[#0E5F3F]'
                                                          : 'text-[#D9534F]'
                                                  }`}
                                              >
                                                  {formatPaisa(r.net_profit_paisa)}
                                              </span>
                                          ),
                                      },
                                  ]
                                : []),
                            {
                                id: 'cash_and_bank_paisa',
                                label: 'Cash & Bank',
                                className: 'text-right',
                                render: (r) => (
                                    <span className="font-mono whitespace-nowrap">
                                        {formatPaisa(r.cash_and_bank_paisa)}
                                    </span>
                                ),
                            },
                            {
                                id: 'receivable_paisa',
                                label: 'Receivable',
                                className: 'text-right',
                                render: (r) => (
                                    <span className="font-mono whitespace-nowrap">
                                        {formatPaisa(r.receivable_paisa)}
                                    </span>
                                ),
                            },
                            {
                                id: 'payable_paisa',
                                label: 'Payable',
                                className: 'text-right',
                                render: (r) => (
                                    <span className="font-mono whitespace-nowrap">
                                        {formatPaisa(r.payable_paisa)}
                                    </span>
                                ),
                            },
                        ] as Column<any>[]}
                        keyExtractor={(r) => r.branch_id}
                        searchPlaceholder="Search branch..."
                        hideCheckbox
                        hideViewToggle
                        hideFilter
                        hidePagination
                        syncUrlParams={false}
                        headerTabs={
                            <div className="font-bold text-[14px] pb-1.5">
                                {isBn
                                    ? 'শাখাভিত্তিক আর্থিক তুলনা (Branch Comparison)'
                                    : 'Branch Financial Comparison'}
                            </div>
                        }
                    />
                )}

                {/* Tab 3: Inventory Valuation */}
                {tab === 'inventory-valuation' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] font-bold text-[14.5px]">
                                Accounting Inventory Ledger (as of {to})
                            </div>
                            <table className="w-full text-left border-collapse text-[13px]">
                                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                                    {inventoryValuation.accounts.map((a) => (
                                        <tr key={a.account_id}>
                                            <td className="px-4 py-2.5">
                                                <span className="font-mono text-[#0E5F3F] mr-2">{a.code}</span>
                                                {isBn ? a.name_bn : a.name_en}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatPaisa(a.balance_paisa)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-[#EAF5F0] dark:bg-emerald-950/30 font-bold text-[#0E5F3F]">
                                        <td className="px-4 py-2.5">Total Accounting Inventory</td>
                                        <td className="px-4 py-2.5 text-right font-mono">{formatPaisa(inventoryValuation.ledger_total_paisa)}</td>
                                    </tr>
                                    {inventoryValuation.warehouse_batch_value_paisa !== null && (
                                        <>
                                            <tr>
                                                <td className="px-4 py-2.5 text-[#555555]">Live Warehouse Batch Stock Valuation</td>
                                                <td className="px-4 py-2.5 text-right font-mono">{formatPaisa(inventoryValuation.warehouse_batch_value_paisa)}</td>
                                            </tr>
                                            <tr className="font-semibold">
                                                <td className="px-4 py-2.5">Ledger vs Warehouse Variance</td>
                                                <td className="px-4 py-2.5 text-right font-mono">{formatPaisa(inventoryValuation.variance_paisa)}</td>
                                            </tr>
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <DataTable
                            tableId="accounting-inventory-movements-table"
                            data={inventoryValuation.movements}
                            columns={[
                                {
                                    id: 'voucher_type',
                                    label: 'Voucher Type',
                                    render: (m) => (
                                        <span className="capitalize font-medium whitespace-nowrap">
                                            {m.voucher_type.replace('_', ' ')}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'added_paisa',
                                    label: 'Added (Dr)',
                                    className: 'text-right',
                                    render: (m) => (
                                        <span className="font-mono text-[#0E5F3F] whitespace-nowrap">
                                            {formatPaisa(m.added_paisa)}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'reduced_paisa',
                                    label: 'Reduced (Cr)',
                                    className: 'text-right',
                                    render: (m) => (
                                        <span className="font-mono text-[#D9534F] whitespace-nowrap">
                                            {formatPaisa(m.reduced_paisa)}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'net_paisa',
                                    label: 'Net',
                                    className: 'text-right',
                                    render: (m) => (
                                        <span className="font-mono font-semibold whitespace-nowrap">
                                            {formatPaisa(m.net_paisa)}
                                        </span>
                                    ),
                                },
                            ] as Column<any>[]}
                            keyExtractor={(m) => m.voucher_type}
                            hideToolbar
                            hidePagination
                            hideCheckbox
                            syncUrlParams={false}
                            headerTabs={
                                <div className="font-bold text-[14px] pb-1.5">
                                    Inventory Ledger Movements ({from} → {to})
                                </div>
                            }
                            emptyState={<EmptyState title="No inventory movements in this period." />}
                        />
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

