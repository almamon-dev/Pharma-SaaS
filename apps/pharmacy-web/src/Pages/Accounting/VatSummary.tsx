import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
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

interface VatSummaryProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    summary: {
        from: string;
        to: string;
        output_vat_paisa: number;
        input_vat_paisa: number;
        net_vat_payable_paisa: number;
        entries: Array<{
            id: number;
            voucher_number: string;
            voucher_type: string;
            date: string;
            narration: string | null;
            vat_kind: 'output' | 'input';
            account_code: string;
            account_name_en: string;
            vat_rate_percent: number;
            amount_paisa: number;
            branch_name: string | null;
        }>;
    };
}

export default function VatSummary({ settings, permissions, branches, selectedBranchId, summary }: VatSummaryProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [from, setFrom] = useState(summary.from);
    const [to, setTo] = useState(summary.to);
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? ''));

    const applyFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            route('accounting.vat-summary'),
            { from, to, ...(branchId ? { branch_id: branchId } : {}) },
            { preserveState: true, replace: true }
        );
    };

    return (
        <AppLayout title={isBn ? 'ভ্যাট সারসংক্ষেপ (VAT Summary)' : 'VAT Summary'}>
            <Head title="VAT Summary" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="vat-summary"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                <form onSubmit={applyFilter} className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-wrap items-end gap-3">
                    <div>
                        <label className="block text-[11.5px] font-semibold text-[#555555] mb-1">From</label>
                        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-[34px] px-2.5 font-mono text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]" />
                    </div>
                    <div>
                        <label className="block text-[11.5px] font-semibold text-[#555555] mb-1">To</label>
                        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-[34px] px-2.5 font-mono text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]" />
                    </div>
                    {permissions.all_branches && branches.length > 1 && (
                        <div>
                            <label className="block text-[11.5px] font-semibold text-[#555555] mb-1">Branch</label>
                            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]">
                                <option value="">All branches</option>
                                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    )}
                    <Button type="submit" size="sm" variant="default">Apply</Button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            {isBn ? 'আউটপুট ভ্যাট (বিক্রয়ে সংগৃহীত)' : 'Output VAT (Collected on Sales)'}
                        </div>
                        <div className="mt-2 font-mono text-[22px] font-bold text-[#222222] dark:text-white">
                            {formatPaisa(summary.output_vat_paisa)}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            {isBn ? 'ইনপুট ভ্যাট (ক্রয়ে প্রদত্ত)' : 'Input VAT (Paid on Purchases)'}
                        </div>
                        <div className="mt-2 font-mono text-[22px] font-bold text-[#0E5F3F] dark:text-emerald-400">
                            {formatPaisa(summary.input_vat_paisa)}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#0E5F3F]/35 rounded-[2px] p-4">
                        <div className="text-[12.5px] font-semibold text-[#0E5F3F] dark:text-emerald-400">
                            {summary.net_vat_payable_paisa >= 0
                                ? isBn
                                    ? 'নিট প্রদেয় ভ্যাট (Payable)'
                                    : 'Net VAT Payable'
                                : isBn
                                  ? 'নিট ভ্যাট ক্রেডিট (Refundable)'
                                  : 'Net VAT Credit'}
                        </div>
                        <div className="mt-2 font-mono text-[22px] font-bold text-[#0E5F3F] dark:text-emerald-400">
                            {formatPaisa(summary.net_vat_payable_paisa)}
                        </div>
                    </div>
                </div>

                <DataTable
                    tableId="accounting-vat-summary-table"
                    data={summary.entries}
                    columns={[
                        {
                            id: 'voucher_number',
                            label: 'Date & Voucher',
                            render: (e) => (
                                <div className="whitespace-nowrap">
                                    <div className="font-mono font-semibold text-[12px]">
                                        {e.voucher_number}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666]">{e.date}</div>
                                </div>
                            ),
                        },
                        {
                            id: 'vat_kind',
                            label: 'VAT Type',
                            render: (e) => (
                                <span
                                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-[2px] whitespace-nowrap ${
                                        e.vat_kind === 'output'
                                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                            : 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25'
                                    }`}
                                >
                                    {e.vat_kind === 'output' ? 'Output VAT' : 'Input VAT'}
                                </span>
                            ),
                        },
                        {
                            id: 'narration',
                            label: 'Narration',
                            render: (e) => <span>{e.narration || '—'}</span>,
                        },
                        {
                            id: 'vat_rate_percent',
                            label: 'Rate',
                            className: 'text-right',
                            render: (e) => (
                                <span className="font-mono whitespace-nowrap">
                                    {e.vat_rate_percent > 0 ? `${e.vat_rate_percent}%` : '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'amount_paisa',
                            label: 'VAT Amount',
                            className: 'text-right',
                            render: (e) => (
                                <span className="font-mono font-bold whitespace-nowrap">
                                    {formatPaisa(e.amount_paisa)}
                                </span>
                            ),
                        },
                    ] as Column<any>[]}
                    keyExtractor={(e) => e.id}
                    searchPlaceholder="Search voucher or narration..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    emptyState={<EmptyState title="No VAT entries posted in this period." />}
                />
            </div>
        </AppLayout>
    );
}

