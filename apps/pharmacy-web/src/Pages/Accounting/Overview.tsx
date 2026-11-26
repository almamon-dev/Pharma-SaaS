import React, { useEffect, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    Building2,
    CheckCircle2,
    Download,
    Landmark,
    Scale,
    Table2,
    TrendingUp,
    Users,
    Wallet,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column } from '@/Components/tables';
import AccountingNav from './components/AccountingNav';
import {
    AccountingBranchOption,
    AccountingPermissions,
    AccountingSettingsData,
    formatPaisa,
    useAccountingLang,
} from './types';

interface OverviewData {
    generated_at: string;
    period: { from: string; to: string; prev_from: string; prev_to: string; days: number };
    can_view_profit: boolean;
    has_entries: boolean;
    kpis: {
        revenue_paisa: number;
        prev_revenue_paisa: number;
        revenue_change_pct: number | null;
        gross_profit_paisa: number | null;
        gross_margin_pct: number | null;
        net_profit_paisa: number | null;
        net_margin_pct: number | null;
        cash_and_bank_paisa: number;
        cash_paisa: number;
        bank_paisa: number;
    };
    profit_and_loss: {
        revenue_paisa: number;
        other_income_paisa: number;
        total_income_paisa: number;
        cogs_paisa: number | null;
        cogs_pct_of_revenue: number | null;
        gross_profit_paisa: number | null;
        gross_margin_pct: number | null;
        operating_expenses: Array<{
            account_id: number;
            code: string;
            name_en: string;
            name_bn: string;
            amount_paisa: number;
            pct_of_revenue: number;
        }>;
        operating_expense_total_paisa: number;
        operating_expense_pct_of_revenue: number;
        net_profit_paisa: number | null;
        net_margin_pct: number | null;
    };
    balance_sheet: {
        as_of: string;
        assets: { groups: Array<{ key: string; label_en: string; label_bn: string; amount_paisa: number }>; total_paisa: number };
        liabilities: { groups: Array<{ key: string; label_en: string; label_bn: string; amount_paisa: number }>; total_paisa: number };
        equity: {
            groups: Array<{ key: string; label_en: string; label_bn: string; amount_paisa: number | null }>;
            current_period_profit_paisa: number | null;
            total_paisa: number | null;
        };
        total_assets_paisa: number;
        total_liabilities_paisa: number;
        total_equity_paisa: number | null;
        total_liabilities_and_equity_paisa: number;
        difference_paisa: number;
        balanced: boolean;
    };
    monthly_series: Array<{
        month_key: string;
        month_label: string;
        income_paisa: number;
        expense_paisa: number;
    }>;
    expense_breakdown: Array<{
        account_id: number;
        code: string;
        name_en: string;
        name_bn: string;
        amount_paisa: number;
        pct_of_expenses: number;
    }>;
    branch_profit: Array<{
        branch_id: number;
        branch_name: string;
        branch_code: string;
        revenue_paisa: number;
        cogs_paisa: number;
        operating_expense_paisa: number;
        net_profit_paisa: number;
        margin_pct: number;
    }>;
    receivable_payable: {
        customers_owe_paisa: number;
        overdue_60_plus_paisa: number;
        owed_to_suppliers_paisa: number;
        supplier_due_this_week_paisa: number;
    };
    attention: {
        pending_approval_count: number;
        draft_count: number;
        failed_postings_count: number;
        unreconciled_bank_count: number;
        current_period_status: 'open' | 'closed';
        current_period_name: string;
    };
}

interface OverviewProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    isMultiBranch: boolean;
    filters: { period: string; from: string; to: string };
    overview: OverviewData;
}

class CardErrorBoundary extends React.Component<
    { title: string; children: React.ReactNode },
    { hasError: boolean }
> {
    constructor(props: { title: string; children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): { hasError: boolean } {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="bg-white dark:bg-[#12161c] border border-rose-200 dark:border-rose-900 rounded-[2px] p-4 text-[12.5px] text-[#C9302C]">
                    Unable to render section: {this.props.title}. Please refresh or adjust filters.
                </div>
            );
        }
        return this.props.children;
    }
}

function CardSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 animate-pulse space-y-2.5">
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded-[2px]" />
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="h-3.5 w-full bg-slate-100 dark:bg-slate-800 rounded-[2px]" />
            ))}
        </div>
    );
}

export default function Overview({
    settings,
    permissions,
    branches,
    selectedBranchId,
    isMultiBranch,
    filters,
    overview,
}: OverviewProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [period, setPeriod] = useState(filters.period);
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [branchFilter, setBranchFilter] = useState(String(selectedBranchId ?? ''));
    const [loading, setLoading] = useState(false);
    const [chartAsTable, setChartAsTable] = useState(false);
    const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

    useEffect(() => {
        setPeriod(filters.period);
        setFrom(filters.from);
        setTo(filters.to);
        setBranchFilter(String(selectedBranchId ?? ''));
    }, [filters.period, filters.from, filters.to, selectedBranchId]);

    const fetchWithParams = (nextPeriod: string, nextFrom?: string, nextTo?: string, nextBranch?: string) => {
        setLoading(true);
        const branchVal = nextBranch !== undefined ? nextBranch : branchFilter;
        router.get(
            route('accounting.overview'),
            {
                period: nextPeriod,
                ...(nextPeriod === 'custom' && nextFrom && nextTo ? { from: nextFrom, to: nextTo } : {}),
                ...(branchVal ? { branch_id: branchVal } : {}),
            },
            {
                preserveState: true,
                replace: true,
                onFinish: () => setLoading(false),
            }
        );
    };

    const showBranchProfit = isMultiBranch && !selectedBranchId && overview.can_view_profit && overview.branch_profit.length > 0;
    const maxSeriesVal = Math.max(
        1,
        ...overview.monthly_series.flatMap((m) => [Math.max(0, m.income_paisa), Math.max(0, m.expense_paisa)])
    );

    const presets = [
        { key: 'this_month', en: 'This month', bn: 'এই মাস' },
        { key: 'last_month', en: 'Last month', bn: 'গত মাস' },
        { key: 'this_fiscal_year', en: 'This fiscal year', bn: 'চলতি অর্থবছর' },
        { key: 'custom', en: 'Custom', bn: 'কাস্টম' },
    ];

    return (
        <AppLayout title={isBn ? 'হিসাব ওভারভিউ' : 'Accounting Overview'}>
            <Head title="Accounting Overview" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="overview"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                {/* Top Header & Period / Branch Filters */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                    <div>
                        <h1 className="text-[19px] font-bold text-[#222222] dark:text-white">
                            {isBn ? 'হিসাব সারসংক্ষেপ (Overview)' : 'Accounting Overview'}
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5 font-mono">
                            {overview.period.from} → {overview.period.to}
                            <span className="ml-2 font-sans text-[11.5px] text-[#666666] dark:text-slate-500">
                                ({isBn ? 'পূর্ববর্তী সময়কাল:' : 'vs prior:'} {overview.period.prev_from} → {overview.period.prev_to})
                            </span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex border border-[#CCCCCC] dark:border-slate-700 rounded-[2px] overflow-hidden">
                            {presets.map((p) => (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => {
                                        setPeriod(p.key);
                                        if (p.key !== 'custom') {
                                            fetchWithParams(p.key);
                                        }
                                    }}
                                    className={`px-2.5 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors ${
                                        period === p.key
                                            ? 'bg-[#0E5F3F] text-white'
                                            : 'bg-white dark:bg-[#181d25] text-[#444444] dark:text-slate-300 hover:bg-[#F5F7F4] dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {isBn ? p.bn : p.en}
                                </button>
                            ))}
                        </div>

                        {period === 'custom' && (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    fetchWithParams('custom', from, to);
                                }}
                                className="flex items-center gap-1.5"
                            >
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
                                <Button type="submit" size="sm" variant="default">
                                    {isBn ? 'দেখুন' : 'Apply'}
                                </Button>
                            </form>
                        )}

                        {permissions.all_branches && branches.length > 1 && (
                            <select
                                value={branchFilter}
                                onChange={(e) => {
                                    setBranchFilter(e.target.value);
                                    fetchWithParams(period, from, to, e.target.value);
                                }}
                                className="h-[32px] px-2.5 text-[12px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                            >
                                <option value="">{isBn ? 'সকল শাখা' : 'All branches'}</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        )}

                        <a
                            href={route('accounting.export', {
                                report: 'profit-loss',
                                from: overview.period.from,
                                to: overview.period.to,
                                ...(selectedBranchId ? { branch_id: selectedBranchId } : {}),
                            })}
                            className="inline-flex items-center gap-1.5 h-[32px] px-2.5 text-[12px] font-semibold rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F5F7F4] dark:bg-slate-800 text-[#222222] dark:text-slate-200 hover:bg-slate-200/70"
                        >
                            <Download className="w-3.5 h-3.5 text-[#0E5F3F]" />
                            CSV
                        </a>
                    </div>
                </div>

                {/* Empty Period Banner */}
                {!overview.has_entries && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-[2px] px-4 py-3 text-[13px] text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                        <span>
                            {isBn
                                ? 'এই সময়কালে কোনো পোস্ট করা এন্ট্রি নেই (No posted entries in this period)।'
                                : 'No posted entries in this period. Draft and reversed entries are excluded.'}
                        </span>
                        {permissions.voucher_create && (
                            <Link
                                href={route('accounting.vouchers.index')}
                                className="text-[12px] font-semibold text-[#0E5F3F] underline"
                            >
                                {isBn ? 'ভাউচার তৈরি করুন →' : 'Create voucher →'}
                            </Link>
                        )}
                    </div>
                )}

                {/* Row 1: 4 KPI Cards */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        <CardSkeleton rows={2} />
                        <CardSkeleton rows={2} />
                        <CardSkeleton rows={2} />
                        <CardSkeleton rows={2} />
                    </div>
                ) : (
                    <CardErrorBoundary title="KPI Summary">
                        <div
                            className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${
                                overview.can_view_profit ? 'xl:grid-cols-4' : 'xl:grid-cols-2'
                            }`}
                        >
                            {/* Revenue */}
                            <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                                <div className="flex items-center justify-between text-[12px] font-semibold text-[#555555] dark:text-slate-400">
                                    <span>{isBn ? 'মোট আয় (Revenue)' : 'Revenue'}</span>
                                    <TrendingUp className="w-4 h-4 text-[#0E5F3F]" />
                                </div>
                                <div className="mt-1.5 font-mono text-[22px] font-bold text-[#222222] dark:text-white">
                                    {formatPaisa(overview.kpis.revenue_paisa)}
                                </div>
                                <div className="mt-1 text-[11.5px] flex items-center gap-1">
                                    {overview.kpis.revenue_change_pct !== null ? (
                                        <>
                                            {overview.kpis.revenue_change_pct >= 0 ? (
                                                <ArrowUpRight className="w-3.5 h-3.5 text-[#0E5F3F]" />
                                            ) : (
                                                <ArrowDownRight className="w-3.5 h-3.5 text-[#D9534F]" />
                                            )}
                                            <span
                                                className={`font-mono font-bold ${
                                                    overview.kpis.revenue_change_pct >= 0 ? 'text-[#0E5F3F]' : 'text-[#D9534F]'
                                                }`}
                                            >
                                                {overview.kpis.revenue_change_pct >= 0 ? '+' : ''}
                                                {overview.kpis.revenue_change_pct}%
                                            </span>
                                            <span className="text-[#666666] dark:text-slate-400">
                                                {isBn ? 'পূর্ববর্তী সময়ের তুলনায়' : 'vs previous period'}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-[#666666] dark:text-slate-400">
                                            {isBn ? 'পূর্ববর্তী সময়ে কোনো আয় ছিল না' : 'No revenue in prior period'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Gross Profit (permission-gated) */}
                            {overview.can_view_profit && (
                                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                                    <div className="flex items-center justify-between text-[12px] font-semibold text-[#555555] dark:text-slate-400">
                                        <span>{isBn ? 'মোট লাভ (Gross Profit)' : 'Gross Profit'}</span>
                                        <BarChart3 className="w-4 h-4 text-[#0E5F3F]" />
                                    </div>
                                    <div className="mt-1.5 font-mono text-[22px] font-bold text-[#0E5F3F] dark:text-emerald-400">
                                        {formatPaisa(overview.kpis.gross_profit_paisa)}
                                    </div>
                                    <div className="mt-1 text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {isBn ? 'গ্রস মার্জিন:' : 'Gross margin:'}{' '}
                                        <strong className="font-mono text-[#222222] dark:text-slate-200">
                                            {overview.kpis.gross_margin_pct ?? 0}%
                                        </strong>
                                    </div>
                                </div>
                            )}

                            {/* Net Profit (permission-gated) */}
                            {overview.can_view_profit && (
                                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                                    <div className="flex items-center justify-between text-[12px] font-semibold text-[#555555] dark:text-slate-400">
                                        <span>{isBn ? 'নিট লাভ (Net Profit)' : 'Net Profit'}</span>
                                        <Wallet className="w-4 h-4 text-[#0E5F3F]" />
                                    </div>
                                    <div
                                        className={`mt-1.5 font-mono text-[22px] font-bold ${
                                            (overview.kpis.net_profit_paisa ?? 0) >= 0
                                                ? 'text-[#0E5F3F] dark:text-emerald-400'
                                                : 'text-[#D9534F]'
                                        }`}
                                    >
                                        {formatPaisa(overview.kpis.net_profit_paisa)}
                                    </div>
                                    <div className="mt-1 text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {isBn ? 'নিট মার্জিন:' : 'Net margin:'}{' '}
                                        <strong className="font-mono text-[#222222] dark:text-slate-200">
                                            {overview.kpis.net_margin_pct ?? 0}%
                                        </strong>
                                    </div>
                                </div>
                            )}

                            {/* Cash & Bank */}
                            <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                                <div className="flex items-center justify-between text-[12px] font-semibold text-[#555555] dark:text-slate-400">
                                    <span>{isBn ? 'নগদ ও ব্যাংক স্থিতি' : 'Cash & Bank'}</span>
                                    <Landmark className="w-4 h-4 text-[#286090]" />
                                </div>
                                <div className="mt-1.5 font-mono text-[22px] font-bold text-[#222222] dark:text-white">
                                    {formatPaisa(overview.kpis.cash_and_bank_paisa)}
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11.5px] text-[#555555] dark:text-slate-400 font-mono">
                                    <span>
                                        {isBn ? 'ক্যাশ:' : 'Cash:'} {formatPaisa(overview.kpis.cash_paisa)}
                                    </span>
                                    <span>
                                        {isBn ? 'ব্যাংক:' : 'Bank:'} {formatPaisa(overview.kpis.bank_paisa)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardErrorBoundary>
                )}

                {/* Row 2: Profit & Loss + Balance Sheet */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {loading ? (
                        <>
                            <CardSkeleton rows={7} />
                            <CardSkeleton rows={7} />
                        </>
                    ) : (
                        <>
                            {/* Profit & Loss Card */}
                            <CardErrorBoundary title="Profit & Loss">
                                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden flex flex-col">
                                    <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between">
                                        <h2 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                            {isBn ? 'লাভ-ক্ষতি বিবরণী (Profit & Loss)' : 'Profit & Loss'}
                                        </h2>
                                        <Link
                                            href={route('accounting.simple-pnl', {
                                                from: overview.period.from,
                                                to: overview.period.to,
                                                ...(selectedBranchId ? { branch_id: selectedBranchId } : {}),
                                            })}
                                            className="text-[12px] font-semibold text-[#0E5F3F] hover:underline"
                                        >
                                            {isBn ? 'বিস্তারিত →' : 'Full P&L →'}
                                        </Link>
                                    </div>
                                    <div className="overflow-x-auto flex-1">
                                        <table className="w-full text-left border-collapse text-[12.5px]">
                                            <thead>
                                                <tr className="bg-[#f8fafc] dark:bg-[#161a22] border-b border-slate-200 dark:border-slate-800 text-[11.5px] font-semibold">
                                                    <th className="px-4 py-2">{isBn ? 'বিবরণ' : 'Line Item'}</th>
                                                    <th className="px-4 py-2 text-right">{isBn ? 'টাকা' : 'Amount'}</th>
                                                    <th className="px-4 py-2 text-right w-24">{isBn ? '% আয়' : '% of Rev'}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                                                <tr className="font-semibold">
                                                    <td className="px-4 py-2">{isBn ? 'বিক্রয় ও অন্যান্য আয় (Revenue)' : 'Revenue (Total Income)'}</td>
                                                    <td className="px-4 py-2 text-right font-mono">{formatPaisa(overview.profit_and_loss.total_income_paisa)}</td>
                                                    <td className="px-4 py-2 text-right font-mono">100.0%</td>
                                                </tr>
                                                {overview.can_view_profit && (
                                                    <>
                                                        <tr>
                                                            <td className="px-4 py-2 text-[#555555] dark:text-slate-300">
                                                                {isBn ? 'বিক্রিত পণ্যের ব্যয় (COGS)' : 'Cost of Goods Sold (COGS)'}
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono text-[#D9534F]">
                                                                ({formatPaisa(overview.profit_and_loss.cogs_paisa)})
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono">
                                                                {overview.profit_and_loss.cogs_pct_of_revenue ?? 0}%
                                                            </td>
                                                        </tr>
                                                        <tr className="bg-[#EAF5F0]/60 dark:bg-emerald-950/20 font-bold">
                                                            <td className="px-4 py-2 text-[#0E5F3F] dark:text-emerald-300">
                                                                {isBn ? 'মোট লাভ (Gross Profit)' : 'Gross Profit'}
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono text-[#0E5F3F] dark:text-emerald-300">
                                                                {formatPaisa(overview.profit_and_loss.gross_profit_paisa)}
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono text-[#0E5F3F] dark:text-emerald-300">
                                                                {overview.profit_and_loss.gross_margin_pct ?? 0}%
                                                            </td>
                                                        </tr>
                                                    </>
                                                )}

                                                {overview.profit_and_loss.operating_expenses.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-2.5 text-[#666666] text-[12px]">
                                                            {isBn ? 'কোনো পরিচালন ব্যয় নেই।' : 'No operating expenses posted in this period.'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    overview.profit_and_loss.operating_expenses.map((exp) => (
                                                        <tr key={exp.account_id} className="hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40">
                                                            <td className="px-4 py-1.5 pl-6 text-[#444444] dark:text-slate-300">
                                                                <span className="font-mono text-[11px] text-[#666666] mr-1.5">{exp.code}</span>
                                                                {isBn ? exp.name_bn : exp.name_en}
                                                            </td>
                                                            <td className="px-4 py-1.5 text-right font-mono">
                                                                {formatPaisa(exp.amount_paisa)}
                                                            </td>
                                                            <td className="px-4 py-1.5 text-right font-mono text-[#666666]">
                                                                {exp.pct_of_revenue}%
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}

                                                {overview.can_view_profit && (
                                                    <tr className="bg-[#0E5F3F] text-white font-bold">
                                                        <td className="px-4 py-2.5">{isBn ? 'নিট লাভ (Net Profit)' : 'Net Profit'}</td>
                                                        <td className="px-4 py-2.5 text-right font-mono">
                                                            {formatPaisa(overview.profit_and_loss.net_profit_paisa)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-mono">
                                                            {overview.profit_and_loss.net_margin_pct ?? 0}%
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </CardErrorBoundary>

                            {/* Balance Sheet Card */}
                            <CardErrorBoundary title="Balance Sheet">
                                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden flex flex-col">
                                    <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Scale className="w-4 h-4 text-[#0E5F3F]" />
                                            <h2 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                                {isBn ? 'ব্যালেন্স শিট (Balance Sheet)' : 'Balance Sheet'}
                                            </h2>
                                            {overview.balance_sheet.balanced ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {isBn ? 'সুষম (Balanced)' : 'Balanced'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    {isBn ? 'অমিল (Mismatch)' : 'Mismatch'}
                                                </span>
                                            )}
                                        </div>
                                        <Link
                                            href={route('accounting.balance-sheet', {
                                                as_of: overview.period.to,
                                                ...(selectedBranchId ? { branch_id: selectedBranchId } : {}),
                                            })}
                                            className="text-[12px] font-semibold text-[#0E5F3F] hover:underline"
                                        >
                                            {isBn ? 'বিস্তারিত →' : 'Full Sheet →'}
                                        </Link>
                                    </div>

                                    <div className="p-4 space-y-3 text-[12.5px] flex-1">
                                        {/* Assets */}
                                        <div>
                                            <div className="font-bold text-[#0E5F3F] dark:text-emerald-400 border-b border-[#D5DBD3] dark:border-slate-800 pb-1 mb-1.5 flex justify-between">
                                                <span>{isBn ? 'সম্পদ (Assets)' : 'Assets'}</span>
                                                <span className="font-mono">{formatPaisa(overview.balance_sheet.total_assets_paisa)}</span>
                                            </div>
                                            <div className="space-y-1">
                                                {overview.balance_sheet.assets.groups.map((g) => (
                                                    <div key={g.key} className="flex justify-between">
                                                        <span className="text-[#555555] dark:text-slate-300">{isBn ? g.label_bn : g.label_en}</span>
                                                        <span className="font-mono">{formatPaisa(g.amount_paisa)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Liabilities */}
                                        <div>
                                            <div className="font-bold text-[#286090] dark:text-blue-400 border-b border-[#D5DBD3] dark:border-slate-800 pb-1 mb-1.5 flex justify-between">
                                                <span>{isBn ? 'দায় (Liabilities)' : 'Liabilities'}</span>
                                                <span className="font-mono">{formatPaisa(overview.balance_sheet.total_liabilities_paisa)}</span>
                                            </div>
                                            <div className="space-y-1">
                                                {overview.balance_sheet.liabilities.groups.map((g) => (
                                                    <div key={g.key} className="flex justify-between">
                                                        <span className="text-[#555555] dark:text-slate-300">{isBn ? g.label_bn : g.label_en}</span>
                                                        <span className="font-mono">{formatPaisa(g.amount_paisa)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Equity */}
                                        <div>
                                            <div className="font-bold text-[#222222] dark:text-white border-b border-[#D5DBD3] dark:border-slate-800 pb-1 mb-1.5 flex justify-between">
                                                <span>{isBn ? 'মালিকানা স্বত্ব (Equity)' : 'Equity'}</span>
                                                <span className="font-mono">
                                                    {overview.can_view_profit ? formatPaisa(overview.balance_sheet.total_equity_paisa) : '—'}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                {overview.balance_sheet.equity.groups
                                                    .filter((g) => g.amount_paisa !== null)
                                                    .map((g) => (
                                                        <div key={g.key} className="flex justify-between">
                                                            <span className="text-[#555555] dark:text-slate-300">{isBn ? g.label_bn : g.label_en}</span>
                                                            <span className="font-mono">{formatPaisa(g.amount_paisa)}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-[#D5DBD3] dark:border-slate-800 flex justify-between font-bold text-[12.5px]">
                                            <span>{isBn ? 'মোট দায় + মালিকানা স্বত্ব' : 'Total Liabilities + Equity'}</span>
                                            <span className="font-mono">
                                                {formatPaisa(overview.balance_sheet.total_liabilities_and_equity_paisa)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardErrorBoundary>
                        </>
                    )}
                </div>

                {/* Row 3: Income vs Expense (Last 6 Months) + Where the Money Went */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Grouped Bar Chart with Accessible Table Toggle */}
                    <CardErrorBoundary title="Income vs Expense Chart">
                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div>
                                    <h2 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                        {isBn ? 'আয় বনাম ব্যয় (গত ৬ মাস)' : 'Income vs Expense (Last 6 Months)'}
                                    </h2>
                                    <div className="flex items-center gap-3 mt-1 text-[11.5px]">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-[1px] bg-[#0E5F3F]" />
                                            {isBn ? 'আয়' : 'Income'}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-[1px] bg-[#D9534F]" />
                                            {isBn ? 'ব্যয়' : 'Expense'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setChartAsTable((v) => !v)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11.5px] font-semibold rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F5F7F4] dark:bg-slate-800 cursor-pointer"
                                    aria-label="Toggle accessible data table"
                                >
                                    <Table2 className="w-3.5 h-3.5" />
                                    {chartAsTable ? (isBn ? 'চার্ট' : 'Chart') : (isBn ? 'টেবিল' : 'Table')}
                                </button>
                            </div>

                            {chartAsTable ? (
                                <DataTable
                                    tableId="accounting-overview-monthly-table"
                                    data={overview.monthly_series}
                                    columns={[
                                        {
                                            id: 'month_label',
                                            label: isBn ? 'মাস' : 'Month',
                                            render: (m) => <span className="font-medium">{m.month_label}</span>,
                                        },
                                        {
                                            id: 'income_paisa',
                                            label: isBn ? 'আয়' : 'Income',
                                            className: 'text-right',
                                            render: (m) => (
                                                <span className="font-mono text-[#0E5F3F]">
                                                    {formatPaisa(m.income_paisa)}
                                                </span>
                                            ),
                                        },
                                        {
                                            id: 'expense_paisa',
                                            label: isBn ? 'ব্যয়' : 'Expense',
                                            className: 'text-right',
                                            render: (m) => (
                                                <span className="font-mono text-[#D9534F]">
                                                    {formatPaisa(m.expense_paisa)}
                                                </span>
                                            ),
                                        },
                                    ] as Column<any>[]}
                                    keyExtractor={(m) => m.month_key}
                                    hideToolbar
                                    hidePagination
                                    hideCheckbox
                                    syncUrlParams={false}
                                />
                            ) : (
                                <div
                                    className="pt-4"
                                    role="img"
                                    aria-label="Grouped bar chart comparing monthly income and expense over the last 6 months"
                                >
                                    <div className="h-[190px] flex items-end justify-between gap-2 border-b border-[#D5DBD3] dark:border-slate-700 px-2 pb-1">
                                        {overview.monthly_series.map((m) => {
                                            const incPct = Math.max(2, Math.round((Math.max(0, m.income_paisa) / maxSeriesVal) * 100));
                                            const expPct = Math.max(2, Math.round((Math.max(0, m.expense_paisa) / maxSeriesVal) * 100));
                                            const isHover = hoveredMonth === m.month_key;
                                            return (
                                                <div
                                                    key={m.month_key}
                                                    className="flex-1 flex flex-col items-center h-full justify-end relative"
                                                    onMouseEnter={() => setHoveredMonth(m.month_key)}
                                                    onMouseLeave={() => setHoveredMonth(null)}
                                                >
                                                    {isHover && (
                                                        <div className="absolute -top-2 z-10 bg-[#222222] text-white text-[11px] font-mono px-2 py-1 rounded-[2px] whitespace-nowrap shadow-md">
                                                            <div>In: {formatPaisa(m.income_paisa)}</div>
                                                            <div>Out: {formatPaisa(m.expense_paisa)}</div>
                                                        </div>
                                                    )}
                                                    <div className="w-full flex items-end justify-center gap-1.5 h-[160px]">
                                                        <div
                                                            className="w-5 sm:w-6 bg-[#0E5F3F] rounded-t-[2px] transition-all"
                                                            style={{ height: `${m.income_paisa > 0 ? incPct : 2}%` }}
                                                            title={`${m.month_label} Income: ${formatPaisa(m.income_paisa)}`}
                                                        />
                                                        <div
                                                            className="w-5 sm:w-6 bg-[#D9534F] rounded-t-[2px] transition-all"
                                                            style={{ height: `${m.expense_paisa > 0 ? expPct : 2}%` }}
                                                            title={`${m.month_label} Expense: ${formatPaisa(m.expense_paisa)}`}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex justify-between px-2 pt-1.5 text-[11px] font-mono text-[#555555] dark:text-slate-400">
                                        {overview.monthly_series.map((m) => (
                                            <div key={m.month_key} className="flex-1 text-center truncate">
                                                {m.month_label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardErrorBoundary>

                    {/* Where the Money Went (Expense Breakdown Horizontal Bars) */}
                    <CardErrorBoundary title="Where the Money Went">
                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                    {isBn ? 'টাকা কোথায় খরচ হয়েছে (Where the Money Went)' : 'Where the Money Went'}
                                </h2>
                                <span className="font-mono text-[12px] font-semibold text-[#555555] dark:text-slate-400">
                                    {formatPaisa(overview.profit_and_loss.operating_expense_total_paisa)}
                                </span>
                            </div>

                            {overview.expense_breakdown.length === 0 ? (
                                <p className="text-[12.5px] text-[#666666] py-8 text-center">
                                    {isBn ? 'এই সময়কালে কোনো পরিচালন ব্যয় নেই।' : 'No operating expenses recorded in this period.'}
                                </p>
                            ) : (
                                <div className="space-y-2.5">
                                    {overview.expense_breakdown.slice(0, 8).map((row) => (
                                        <div key={row.account_id} className="space-y-1">
                                            <div className="flex items-center justify-between text-[12.5px]">
                                                <span className="font-medium text-[#222222] dark:text-slate-200 truncate pr-2">
                                                    {isBn ? row.name_bn : row.name_en}
                                                </span>
                                                <span className="font-mono text-[12px] whitespace-nowrap">
                                                    {formatPaisa(row.amount_paisa)}{' '}
                                                    <span className="text-[#666666] dark:text-slate-400">({row.pct_of_expenses}%)</span>
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-[#EAECE9] dark:bg-slate-800 rounded-[2px] overflow-hidden">
                                                <div
                                                    className="h-full bg-[#0E5F3F] rounded-[2px]"
                                                    style={{ width: `${Math.min(100, Math.max(2, row.pct_of_expenses))}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardErrorBoundary>
                </div>

                {/* Row 4: Profit by Branch (conditional) + Receivable & Payable + Needs Attention */}
                <div
                    className={`grid grid-cols-1 gap-4 ${
                        showBranchProfit ? 'xl:grid-cols-3' : 'xl:grid-cols-2'
                    }`}
                >
                    {showBranchProfit && (
                        <CardErrorBoundary title="Profit by Branch">
                            <DataTable
                                tableId="accounting-overview-branch-profit"
                                data={overview.branch_profit}
                                columns={[
                                    {
                                        id: 'branch_name',
                                        label: isBn ? 'শাখা' : 'Branch',
                                        render: (b) => <span className="font-medium">{b.branch_name}</span>,
                                    },
                                    {
                                        id: 'revenue_paisa',
                                        label: isBn ? 'আয়' : 'Revenue',
                                        className: 'text-right',
                                        render: (b) => (
                                            <span className="font-mono whitespace-nowrap">
                                                {formatPaisa(b.revenue_paisa)}
                                            </span>
                                        ),
                                    },
                                    {
                                        id: 'net_profit_paisa',
                                        label: isBn ? 'নিট লাভ' : 'Net Profit',
                                        className: 'text-right',
                                        render: (b) => (
                                            <span
                                                className={`font-mono font-bold whitespace-nowrap ${
                                                    b.net_profit_paisa >= 0
                                                        ? 'text-[#0E5F3F]'
                                                        : 'text-[#D9534F]'
                                                }`}
                                            >
                                                {formatPaisa(b.net_profit_paisa)}
                                            </span>
                                        ),
                                    },
                                ] as Column<any>[]}
                                keyExtractor={(b) => b.branch_id}
                                hideToolbar
                                hidePagination
                                hideCheckbox
                                syncUrlParams={false}
                                headerTabs={
                                    <div className="flex items-center gap-2 pb-1.5">
                                        <Building2 className="w-4 h-4 text-[#0E5F3F]" />
                                        <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                            {isBn ? 'শাখা অনুযায়ী লাভ' : 'Profit by Branch'}
                                        </h2>
                                    </div>
                                }
                            />
                        </CardErrorBoundary>
                    )}

                    {/* Receivable & Payable */}
                    <CardErrorBoundary title="Receivable & Payable">
                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-[#0E5F3F]" />
                                    <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                        {isBn ? 'প্রাপ্য ও প্রদেয় (Receivable & Payable)' : 'Receivable & Payable'}
                                    </h2>
                                </div>
                                <Link
                                    href={route('accounting.parties.index')}
                                    className="text-[12px] font-semibold text-[#0E5F3F] hover:underline"
                                >
                                    {isBn ? 'বকেয়া তালিকা →' : 'Ageing →'}
                                </Link>
                            </div>
                            <div className="p-4 space-y-3 text-[13px]">
                                <Link
                                    href={route('accounting.parties.index', { type: 'customer' })}
                                    className="block p-3 rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-[#222222] dark:text-white">
                                            {isBn ? 'ক্রেতাদের কাছে পাওনা' : 'Customers owe us'}
                                        </span>
                                        <span className="font-mono font-bold text-[#0E5F3F]">
                                            {formatPaisa(overview.receivable_payable.customers_owe_paisa)}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[11.5px]">
                                        <span className="text-[#666666] dark:text-slate-400">
                                            {isBn ? '৬০ দিনের বেশি বকেয়া' : 'Overdue > 60 days'}
                                        </span>
                                        <span
                                            className={`font-mono font-bold ${
                                                overview.receivable_payable.overdue_60_plus_paisa > 0
                                                    ? 'text-[#D9534F]'
                                                    : 'text-[#666666]'
                                            }`}
                                        >
                                            {formatPaisa(overview.receivable_payable.overdue_60_plus_paisa)}
                                        </span>
                                    </div>
                                </Link>

                                <Link
                                    href={route('accounting.parties.index', { type: 'supplier' })}
                                    className="block p-3 rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-[#222222] dark:text-white">
                                            {isBn ? 'সরবরাহকারীদের দিতে হবে' : 'Owed to suppliers'}
                                        </span>
                                        <span className="font-mono font-bold text-[#286090] dark:text-blue-400">
                                            {formatPaisa(overview.receivable_payable.owed_to_suppliers_paisa)}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[11.5px]">
                                        <span className="text-[#666666] dark:text-slate-400">
                                            {isBn ? 'এই সপ্তাহে প্রদেয় / মেয়াদোত্তীর্ণ' : 'Due this week / overdue'}
                                        </span>
                                        <span
                                            className={`font-mono font-bold ${
                                                overview.receivable_payable.supplier_due_this_week_paisa > 0
                                                    ? 'text-[#D9534F]'
                                                    : 'text-[#666666]'
                                            }`}
                                        >
                                            {formatPaisa(overview.receivable_payable.supplier_due_this_week_paisa)}
                                        </span>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </CardErrorBoundary>

                    {/* Needs Attention */}
                    <CardErrorBoundary title="Needs Attention">
                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                    {isBn ? 'মনোযোগ প্রয়োজন (Needs Attention)' : 'Needs Attention'}
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-[12.5px]">
                                <Link
                                    href={route('accounting.vouchers.index', { status: 'pending_approval' })}
                                    className="px-4 py-2.5 flex items-center justify-between hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40"
                                >
                                    <span>{isBn ? 'অনুমোদনের অপেক্ষায় ভাউচার' : 'Vouchers waiting approval'}</span>
                                    <span
                                        className={`font-mono font-bold px-2 py-0.5 rounded-[2px] ${
                                            overview.attention.pending_approval_count > 0
                                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                                : 'text-[#666666]'
                                        }`}
                                    >
                                        {overview.attention.pending_approval_count}
                                    </span>
                                </Link>

                                <Link
                                    href={route('accounting.vouchers.index', { status: 'draft' })}
                                    className="px-4 py-2.5 flex items-center justify-between hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40"
                                >
                                    <span>{isBn ? 'খসড়া ভাউচার (পোস্ট হয়নি)' : 'Draft vouchers not posted'}</span>
                                    <span className="font-mono font-bold text-[#555555] dark:text-slate-300">
                                        {overview.attention.draft_count}
                                    </span>
                                </Link>

                                <Link
                                    href={route('accounting.posting-errors.index')}
                                    className="px-4 py-2.5 flex items-center justify-between hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40"
                                >
                                    <span>{isBn ? 'ব্যর্থ অটো-পোস্টিং' : 'Failed auto-postings'}</span>
                                    <span
                                        className={`font-mono font-bold px-2 py-0.5 rounded-[2px] ${
                                            overview.attention.failed_postings_count > 0
                                                ? 'bg-rose-50 text-[#C9302C] border border-rose-200'
                                                : 'text-[#666666]'
                                        }`}
                                    >
                                        {overview.attention.failed_postings_count}
                                    </span>
                                </Link>

                                <Link
                                    href={route('accounting.bank-reconciliation.index')}
                                    className="px-4 py-2.5 flex items-center justify-between hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40"
                                >
                                    <span>{isBn ? 'অমিল ব্যাংক লাইন' : 'Unreconciled bank lines'}</span>
                                    <span
                                        className={`font-mono font-bold px-2 py-0.5 rounded-[2px] ${
                                            overview.attention.unreconciled_bank_count > 0
                                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                                : 'text-[#666666]'
                                        }`}
                                    >
                                        {overview.attention.unreconciled_bank_count}
                                    </span>
                                </Link>

                                <Link
                                    href={route('accounting.periods.index')}
                                    className="px-4 py-2.5 flex items-center justify-between hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40"
                                >
                                    <span>
                                        {isBn ? 'চলতি সময়কাল:' : 'Current period:'} {overview.attention.current_period_name}
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-[2px] ${
                                            overview.attention.current_period_status === 'closed'
                                                ? 'bg-rose-50 text-[#C9302C] border border-rose-200'
                                                : 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25'
                                        }`}
                                    >
                                        {overview.attention.current_period_status === 'closed' ? 'Closed' : 'Open'}
                                    </span>
                                </Link>
                            </div>
                        </div>
                    </CardErrorBoundary>
                </div>
            </div>
        </AppLayout>
    );
}

