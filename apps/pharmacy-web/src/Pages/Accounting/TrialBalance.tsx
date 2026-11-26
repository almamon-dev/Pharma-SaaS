import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Download, Printer } from 'lucide-react';
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

interface TrialBalanceRow {
    account_id: number;
    code: string;
    name_en: string;
    name_bn: string;
    type: string;
    opening_debit_paisa: number;
    opening_credit_paisa: number;
    period_debit_paisa: number;
    period_credit_paisa: number;
    closing_debit_paisa: number;
    closing_credit_paisa: number;
}

interface TrialBalanceProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    report: {
        from: string;
        to: string;
        rows: TrialBalanceRow[];
        totals: {
            opening_debit_paisa: number;
            opening_credit_paisa: number;
            period_debit_paisa: number;
            period_credit_paisa: number;
            closing_debit_paisa: number;
            closing_credit_paisa: number;
        };
        difference_paisa: number;
        balanced: boolean;
    };
}

export default function TrialBalance({
    settings,
    permissions,
    branches,
    selectedBranchId,
    report,
}: TrialBalanceProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [from, setFrom] = useState(report.from);
    const [to, setTo] = useState(report.to);
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? ''));

    const applyFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            route('accounting.trial-balance'),
            { from, to, ...(branchId ? { branch_id: branchId } : {}) },
            { preserveState: true, replace: true }
        );
    };

    return (
        <AppLayout title={isBn ? 'রেওয়ামিল (Trial Balance)' : 'Trial Balance'}>
            <Head title="Trial Balance" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="trial-balance"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            {isBn ? 'রেওয়ামিল (Trial Balance)' : 'Trial Balance'}
                        </h1>
                        {report.balanced ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11.5px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {isBn ? 'ডেবিট = ক্রেডিট (Balanced)' : 'Balanced (Dr = Cr)'}
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
                                report: 'trial-balance',
                                from: report.from,
                                to: report.to,
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

                <DataTable<TrialBalanceRow>
                    tableId="accounting-trial-balance-table"
                    data={report.rows}
                    columns={[
                        {
                            id: 'code',
                            label: 'Code',
                            render: (r) => (
                                <span className="font-mono font-semibold text-[#0E5F3F] whitespace-nowrap">
                                    {r.code}
                                </span>
                            ),
                        },
                        {
                            id: 'name_en',
                            label: 'Account',
                            render: (r) => (
                                <Link
                                    href={route('accounting.ledger', {
                                        account_id: r.account_id,
                                        from: report.from,
                                        to: report.to,
                                    })}
                                    className="font-medium hover:text-[#0E5F3F] hover:underline"
                                >
                                    {isBn ? r.name_bn : r.name_en}
                                </Link>
                            ),
                        },
                        {
                            id: 'opening_debit_paisa',
                            label: 'Opening Dr',
                            className: 'text-right',
                            render: (r) => (
                                <span className="font-mono whitespace-nowrap">
                                    {r.opening_debit_paisa > 0 ? formatPaisa(r.opening_debit_paisa) : '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'opening_credit_paisa',
                            label: 'Opening Cr',
                            className: 'text-right',
                            render: (r) => (
                                <span className="font-mono whitespace-nowrap">
                                    {r.opening_credit_paisa > 0 ? formatPaisa(r.opening_credit_paisa) : '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'period_debit_paisa',
                            label: 'Period Dr',
                            className: 'text-right',
                            render: (r) => (
                                <span className="font-mono whitespace-nowrap">
                                    {r.period_debit_paisa > 0 ? formatPaisa(r.period_debit_paisa) : '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'period_credit_paisa',
                            label: 'Period Cr',
                            className: 'text-right',
                            render: (r) => (
                                <span className="font-mono whitespace-nowrap">
                                    {r.period_credit_paisa > 0 ? formatPaisa(r.period_credit_paisa) : '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'closing_debit_paisa',
                            label: 'Closing Dr',
                            className: 'text-right',
                            render: (r) => (
                                <span className="font-mono font-semibold whitespace-nowrap">
                                    {r.closing_debit_paisa > 0 ? formatPaisa(r.closing_debit_paisa) : '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'closing_credit_paisa',
                            label: 'Closing Cr',
                            className: 'text-right',
                            render: (r) => (
                                <span className="font-mono font-semibold whitespace-nowrap">
                                    {r.closing_credit_paisa > 0 ? formatPaisa(r.closing_credit_paisa) : '—'}
                                </span>
                            ),
                        },
                    ] as Column<TrialBalanceRow>[]}
                    keyExtractor={(r) => r.account_id}
                    searchPlaceholder="Search account code or name..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    hidePagination
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 text-[12px]">
                            <span className="font-bold text-[#0E5F3F] dark:text-emerald-400">
                                Grand Total — Closing Dr: <span className="font-mono">{formatPaisa(report.totals.closing_debit_paisa)}</span> · Closing Cr: <span className="font-mono">{formatPaisa(report.totals.closing_credit_paisa)}</span>
                            </span>
                            <span className="font-mono text-[#555555] dark:text-slate-400">
                                Period Dr: {formatPaisa(report.totals.period_debit_paisa)} · Period Cr: {formatPaisa(report.totals.period_credit_paisa)}
                            </span>
                        </div>
                    }
                    emptyState={<EmptyState title="No posted balances in this period." />}
                />
            </div>
        </AppLayout>
    );
}

