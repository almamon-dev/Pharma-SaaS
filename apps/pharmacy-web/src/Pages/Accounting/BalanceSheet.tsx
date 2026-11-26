import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Download, Printer } from 'lucide-react';
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

interface AccountLine {
    account_id: number | null;
    code: string;
    name_en: string;
    name_bn: string;
    report_group: string;
    amount_paisa: number;
}

interface BalanceSheetProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    report: {
        as_of: string;
        can_view_profit: boolean;
        assets: { accounts: AccountLine[]; total_paisa: number };
        liabilities: { accounts: AccountLine[]; total_paisa: number };
        equity: {
            accounts: AccountLine[];
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
}

export default function BalanceSheet({
    settings,
    permissions,
    branches,
    selectedBranchId,
    report,
}: BalanceSheetProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [asOf, setAsOf] = useState(report.as_of);
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? ''));

    const applyFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            route('accounting.balance-sheet'),
            { as_of: asOf, ...(branchId ? { branch_id: branchId } : {}) },
            { preserveState: true, replace: true }
        );
    };

    return (
        <AppLayout title={isBn ? 'ব্যালেন্স শিট (Balance Sheet)' : 'Balance Sheet'}>
            <Head title="Balance Sheet" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="balance-sheet"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            {isBn ? 'আর্থিক অবস্থার বিবরণী (Balance Sheet)' : 'Balance Sheet'}
                        </h1>
                        {report.balanced ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11.5px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {isBn ? 'সম্পদ = দায় + স্বত্ব (Balanced)' : 'Balanced (Assets = L + E)'}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11.5px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Mismatch ({formatPaisa(report.difference_paisa)})
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <form onSubmit={applyFilter} className="flex flex-wrap items-center gap-2">
                            <input
                                type="date"
                                value={asOf}
                                onChange={(e) => setAsOf(e.target.value)}
                                className="h-[32px] px-2 font-mono text-[12px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                            />
                            {permissions.all_branches && branches.length > 1 && (
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
                        <a
                            href={route('accounting.export', {
                                report: 'balance-sheet',
                                as_of: report.as_of,
                                ...(selectedBranchId ? { branch_id: selectedBranchId } : {}),
                            })}
                            className="inline-flex items-center gap-1.5 h-[32px] px-2.5 text-[12px] font-semibold rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F5F7F4] dark:bg-slate-800"
                        >
                            <Download className="w-3.5 h-3.5 text-[#0E5F3F]" />
                            CSV
                        </a>
                        <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            Print
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* Left: Assets */}
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] font-bold text-[#0E5F3F] dark:text-emerald-400">
                            {isBn ? 'সম্পদ (Assets)' : 'Assets'} — {report.as_of}
                        </div>
                        <table className="w-full text-left border-collapse text-[13px]">
                            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                                {report.assets.accounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="px-4 py-6 text-center text-[#666666]">
                                            No asset balances.
                                        </td>
                                    </tr>
                                ) : (
                                    report.assets.accounts.map((a, idx) => (
                                        <tr key={`${a.code}-${idx}`}>
                                            <td className="px-4 py-2">
                                                <span className="font-mono text-[11.5px] text-[#666666] mr-2">{a.code}</span>
                                                {isBn ? a.name_bn : a.name_en}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">{formatPaisa(a.amount_paisa)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="bg-[#EAF5F0] dark:bg-emerald-950/30 font-bold text-[#0E5F3F] dark:text-emerald-300">
                                    <td className="px-4 py-2.5">{isBn ? 'মোট সম্পদ (Total Assets)' : 'Total Assets'}</td>
                                    <td className="px-4 py-2.5 text-right font-mono">{formatPaisa(report.total_assets_paisa)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Right: Liabilities & Equity */}
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] font-bold text-[#286090] dark:text-blue-400">
                                {isBn ? 'দায় (Liabilities)' : 'Liabilities'}
                            </div>
                            <table className="w-full text-left border-collapse text-[13px]">
                                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                                    {report.liabilities.accounts.length === 0 ? (
                                        <tr>
                                            <td colSpan={2} className="px-4 py-5 text-center text-[#666666]">
                                                No liabilities.
                                            </td>
                                        </tr>
                                    ) : (
                                        report.liabilities.accounts.map((l, idx) => (
                                            <tr key={`${l.code}-${idx}`}>
                                                <td className="px-4 py-2">
                                                    <span className="font-mono text-[11.5px] text-[#666666] mr-2">{l.code}</span>
                                                    {isBn ? l.name_bn : l.name_en}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono">{formatPaisa(l.amount_paisa)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#F5F7F4] dark:bg-slate-800 font-bold">
                                        <td className="px-4 py-2">{isBn ? 'মোট দায়' : 'Total Liabilities'}</td>
                                        <td className="px-4 py-2 text-right font-mono">{formatPaisa(report.total_liabilities_paisa)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] font-bold text-[#222222] dark:text-white">
                                {isBn ? 'মালিকানা স্বত্ব (Equity)' : 'Equity'}
                            </div>
                            <table className="w-full text-left border-collapse text-[13px]">
                                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                                    {report.equity.accounts.map((e, idx) => (
                                        <tr key={`${e.code}-${idx}`}>
                                            <td className="px-4 py-2">
                                                <span className="font-mono text-[11.5px] text-[#666666] mr-2">{e.code}</span>
                                                {isBn ? e.name_bn : e.name_en}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">{formatPaisa(e.amount_paisa)}</td>
                                        </tr>
                                    ))}
                                    {report.can_view_profit && (
                                        <tr>
                                            <td className="px-4 py-2 font-medium text-[#0E5F3F]">
                                                {isBn ? 'চলতি সময়ের নিট লাভ' : 'Current-Period Net Profit'}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono font-semibold text-[#0E5F3F]">
                                                {formatPaisa(report.equity.current_period_profit_paisa)}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#F5F7F4] dark:bg-slate-800 font-bold">
                                        <td className="px-4 py-2">{isBn ? 'মোট মালিকানা স্বত্ব' : 'Total Equity'}</td>
                                        <td className="px-4 py-2 text-right font-mono">
                                            {report.can_view_profit ? formatPaisa(report.total_equity_paisa) : '—'}
                                        </td>
                                    </tr>
                                    <tr className="bg-[#0E5F3F] text-white font-bold">
                                        <td className="px-4 py-2.5">{isBn ? 'মোট দায় + মালিকানা স্বত্ব' : 'Total Liabilities + Equity'}</td>
                                        <td className="px-4 py-2.5 text-right font-mono">
                                            {formatPaisa(report.total_liabilities_and_equity_paisa)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

