import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import AccountingNav from './components/AccountingNav';
import {
    AccountingBranchOption,
    AccountingPermissions,
    AccountingSettingsData,
    formatPaisa,
    useAccountingLang,
} from './types';

interface PnlLine {
    account_id: number;
    code: string;
    name_en: string;
    name_bn: string;
    report_group: string;
    amount_paisa: number;
}

interface SimplePnlProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    report: {
        from: string;
        to: string;
        can_view_profit: boolean;
        income_lines: PnlLine[];
        cogs_lines: PnlLine[];
        expense_lines: PnlLine[];
        revenue_paisa: number;
        other_income_paisa: number;
        total_income_paisa: number;
        cogs_paisa: number | null;
        gross_profit_paisa: number | null;
        operating_expense_paisa: number;
        net_profit_paisa: number | null;
    };
}

export default function SimpleProfitLoss({
    settings,
    permissions,
    branches,
    selectedBranchId,
    report,
}: SimplePnlProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [from, setFrom] = useState(report.from);
    const [to, setTo] = useState(report.to);
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? ''));

    const applyFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            route('accounting.simple-pnl'),
            {
                from,
                to,
                ...(branchId ? { branch_id: branchId } : {}),
            },
            { preserveState: true, replace: true }
        );
    };

    const pct = (part: number) => {
        if (report.revenue_paisa <= 0) return '0.0%';
        return `${((part / report.revenue_paisa) * 100).toFixed(1)}%`;
    };

    return (
        <AppLayout title={isBn ? 'লাভ-ক্ষতি বিবরণী' : 'Profit & Loss'}>
            <Head title={isBn ? 'লাভ-ক্ষতি বিবরণী' : 'Profit & Loss'} />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="simple-pnl"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                <form
                    onSubmit={applyFilter}
                    className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-wrap items-end gap-3"
                >
                    <div>
                        <label className="block text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">
                            {isBn ? 'শুরুর তারিখ' : 'From'}
                        </label>
                        <input
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="h-[34px] px-2.5 font-mono text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                        />
                    </div>
                    <div>
                        <label className="block text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">
                            {isBn ? 'শেষ তারিখ' : 'To'}
                        </label>
                        <input
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="h-[34px] px-2.5 font-mono text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                        />
                    </div>
                    {permissions.all_branches && branches.length > 1 && (
                        <div>
                            <label className="block text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">
                                {isBn ? 'শাখা' : 'Branch'}
                            </label>
                            <select
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                className="h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                            >
                                <option value="">{isBn ? 'সব শাখা' : 'All branches'}</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <Button type="submit" size="sm" variant="default">
                        {isBn ? 'রিপোর্ট দেখুন' : 'Update report'}
                    </Button>
                </form>

                {/* Read-Only Profit & Loss Statement */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h1 className="text-[15.5px] font-bold text-[#222222] dark:text-white">
                                {isBn ? 'লাভ-ক্ষতি বিবরণী (শুধু পঠনযোগ্য)' : 'Profit and Loss Statement (Read-Only)'}
                            </h1>
                            <p className="text-[11.5px] text-[#555555] dark:text-slate-400 font-mono">
                                {report.from} → {report.to}
                            </p>
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[13px]">
                            <thead>
                                <tr className="bg-[#f8fafc] dark:bg-[#161a22] border-b border-slate-200 dark:border-slate-800 text-[12px] font-semibold">
                                    <th className="px-4 py-2.5">{isBn ? 'খাত' : 'Account / Group'}</th>
                                    <th className="px-4 py-2.5 text-right whitespace-nowrap">{isBn ? 'পরিমাণ (৳)' : 'Amount (BDT)'}</th>
                                    <th className="px-4 py-2.5 text-right whitespace-nowrap">{isBn ? 'আয়ের %' : '% of Revenue'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                                <tr className="bg-[#EAF5F0]/50 dark:bg-emerald-950/20 font-bold">
                                    <td colSpan={3} className="px-4 py-2 text-[#0E5F3F] dark:text-emerald-400">
                                        {isBn ? 'আয় (Income)' : 'Income'}
                                    </td>
                                </tr>
                                {report.income_lines.map((l) => (
                                    <tr key={l.account_id}>
                                        <td className="px-6 py-2">
                                            <span className="font-mono text-[11.5px] text-[#666666] mr-2">{l.code}</span>
                                            <span>{isBn ? l.name_bn : l.name_en}</span>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono">{formatPaisa(l.amount_paisa)}</td>
                                        <td className="px-4 py-2 text-right font-mono text-[#666666]">{pct(l.amount_paisa)}</td>
                                    </tr>
                                ))}
                                <tr className="font-bold bg-slate-50/70 dark:bg-slate-800/30">
                                    <td className="px-4 py-2.5">{isBn ? 'মোট আয়' : 'Total Income'}</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[#0E5F3F] dark:text-emerald-400">
                                        {formatPaisa(report.total_income_paisa)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono">100.0%</td>
                                </tr>

                                {report.can_view_profit && (
                                    <>
                                        <tr className="bg-amber-50/50 dark:bg-amber-950/20 font-bold">
                                            <td colSpan={3} className="px-4 py-2 text-amber-800 dark:text-amber-300">
                                                {isBn ? 'বিক্রীত পণ্যের ব্যয় (COGS)' : 'Cost of Goods Sold (COGS)'}
                                            </td>
                                        </tr>
                                        {report.cogs_lines.map((l) => (
                                            <tr key={l.account_id}>
                                                <td className="px-6 py-2">
                                                    <span className="font-mono text-[11.5px] text-[#666666] mr-2">{l.code}</span>
                                                    <span>{isBn ? l.name_bn : l.name_en}</span>
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono">{formatPaisa(l.amount_paisa)}</td>
                                                <td className="px-4 py-2 text-right font-mono text-[#666666]">{pct(l.amount_paisa)}</td>
                                            </tr>
                                        ))}
                                        <tr className="font-bold bg-slate-50/70 dark:bg-slate-800/30">
                                            <td className="px-4 py-2.5">{isBn ? 'মোট লাভ (Gross Profit)' : 'Gross Profit'}</td>
                                            <td className="px-4 py-2.5 text-right font-mono">
                                                {formatPaisa(report.gross_profit_paisa)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-mono">
                                                {report.gross_profit_paisa !== null ? pct(report.gross_profit_paisa) : '—'}
                                            </td>
                                        </tr>
                                    </>
                                )}

                                <tr className="bg-rose-50/50 dark:bg-rose-950/20 font-bold">
                                    <td colSpan={3} className="px-4 py-2 text-[#C9302C] dark:text-rose-300">
                                        {isBn ? 'পরিচালনা ব্যয় (Operating Expenses)' : 'Operating Expenses'}
                                    </td>
                                </tr>
                                {report.expense_lines.map((l) => (
                                    <tr key={l.account_id}>
                                        <td className="px-6 py-2">
                                            <span className="font-mono text-[11.5px] text-[#666666] mr-2">{l.code}</span>
                                            <span>{isBn ? l.name_bn : l.name_en}</span>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono">{formatPaisa(l.amount_paisa)}</td>
                                        <td className="px-4 py-2 text-right font-mono text-[#666666]">{pct(l.amount_paisa)}</td>
                                    </tr>
                                ))}
                                <tr className="font-bold bg-slate-50/70 dark:bg-slate-800/30">
                                    <td className="px-4 py-2.5">{isBn ? 'মোট পরিচালনা ব্যয়' : 'Total Operating Expenses'}</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-[#C9302C] dark:text-rose-400">
                                        {formatPaisa(report.operating_expense_paisa)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono">{pct(report.operating_expense_paisa)}</td>
                                </tr>

                                {report.can_view_profit && report.net_profit_paisa !== null && (
                                    <tr className="bg-[#EAF5F0] dark:bg-emerald-950/35 font-bold text-[15px]">
                                        <td className="px-4 py-3 text-[#0E5F3F] dark:text-emerald-300">
                                            {isBn ? 'নিট লাভ / (ক্ষতি)' : 'Net Profit / (Loss)'}
                                        </td>
                                        <td
                                            className={`px-4 py-3 text-right font-mono ${
                                                report.net_profit_paisa >= 0
                                                    ? 'text-[#0E5F3F] dark:text-emerald-300'
                                                    : 'text-[#C9302C] dark:text-rose-400'
                                            }`}
                                        >
                                            {formatPaisa(report.net_profit_paisa)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">
                                            {pct(report.net_profit_paisa)}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

