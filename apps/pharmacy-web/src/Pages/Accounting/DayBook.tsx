import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { RotateCcw, X } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import AccountingNav from './components/AccountingNav';
import {
    AccountingBranchOption,
    AccountingPermissions,
    AccountingSettingsData,
    PlainVoucherItem,
    formatPaisa,
    useAccountingLang,
} from './types';

interface DayBookProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    filters: { from: string; to: string; type: string };
    totals: { in_paisa: number; out_paisa: number; net_paisa: number; count: number };
    entries: PlainVoucherItem[];
}

export default function DayBook({
    settings,
    permissions,
    branches,
    selectedBranchId,
    filters,
    totals,
    entries,
}: DayBookProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [type, setType] = useState(filters.type);
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? ''));
    const [reverseTarget, setReverseTarget] = useState<PlainVoucherItem | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const applyFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            route('accounting.day-book'),
            {
                from,
                to,
                ...(type ? { type } : {}),
                ...(branchId ? { branch_id: branchId } : {}),
            },
            { preserveState: true, replace: true }
        );
    };

    const handleReverse = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reverseTarget || reason.trim().length < 4) return;
        setBusy(true);
        router.post(
            route('accounting.vouchers.reverse', reverseTarget.id),
            { reason: reason.trim() },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setReverseTarget(null);
                    setReason('');
                },
                onFinish: () => setBusy(false),
            }
        );
    };

    return (
        <AppLayout title={isBn ? 'দৈনিক খাতা (Day Book)' : 'Day Book'}>
            <Head title={isBn ? 'দৈনিক খাতা' : 'Day Book'} />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="day-book"
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
                    <div>
                        <label className="block text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">
                            {isBn ? 'ধরন' : 'Type'}
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                        >
                            <option value="">{isBn ? 'সব ধরন' : 'All types'}</option>
                            <option value="receipt">{isBn ? 'আয় / প্রাপ্তি (Receipt)' : 'Receipt'}</option>
                            <option value="payment">{isBn ? 'খরচ / প্রদান (Payment)' : 'Payment'}</option>
                            <option value="sales">{isBn ? 'বিক্রয় (Sales)' : 'Sales'}</option>
                            <option value="purchase">{isBn ? 'ক্রয় (Purchase)' : 'Purchase'}</option>
                            <option value="contra">{isBn ? 'কন্ট্রা (Contra)' : 'Contra'}</option>
                            {settings.mode === 'advanced' && (
                                <option value="journal">{isBn ? 'জার্নাল (Journal)' : 'Journal'}</option>
                            )}
                        </select>
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
                        {isBn ? 'ফিল্টার করুন' : 'Apply'}
                    </Button>
                </form>

                {/* Summary Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5">
                        <div className="text-[12px] text-[#555555] dark:text-slate-400">{isBn ? 'মোট প্রাপ্তি' : 'Total inflow'}</div>
                        <div className="font-mono text-[20px] font-bold text-[#0E5F3F] dark:text-emerald-400 mt-1">
                            {formatPaisa(totals.in_paisa)}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5">
                        <div className="text-[12px] text-[#555555] dark:text-slate-400">{isBn ? 'মোট প্রদান' : 'Total outflow'}</div>
                        <div className="font-mono text-[20px] font-bold text-[#C9302C] dark:text-rose-400 mt-1">
                            {formatPaisa(totals.out_paisa)}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5">
                        <div className="text-[12px] text-[#555555] dark:text-slate-400">{isBn ? 'মোট ভাউচার' : 'Entries in range'}</div>
                        <div className="font-mono text-[20px] font-bold text-[#222222] dark:text-white mt-1">
                            {totals.count}
                        </div>
                    </div>
                </div>

                {/* Day Book Table */}
                <DataTable<PlainVoucherItem>
                    tableId="accounting-day-book-table"
                    data={entries}
                    columns={[
                        {
                            id: 'number',
                            label: isBn ? 'তারিখ ও ভাউচার' : 'Date & Voucher #',
                            render: (entry) => (
                                <div className="whitespace-nowrap">
                                    <div className="font-mono font-semibold text-[12px] text-[#222222] dark:text-white">
                                        {entry.number}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                        {entry.date}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'category_en',
                            label: isBn ? 'খাত ও বিবরণ' : 'Category & Description',
                            render: (entry) => (
                                <div>
                                    <div className="font-semibold text-[#222222] dark:text-white">
                                        {isBn ? entry.category_bn : entry.category_en}
                                    </div>
                                    {entry.narration && (
                                        <div className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                            {entry.narration}
                                        </div>
                                    )}
                                    {settings.mode === 'advanced' && entry.lines.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                            {entry.lines.map((l) => (
                                                <span
                                                    key={l.id}
                                                    className="font-mono text-[10.5px] px-1.5 py-0.2 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700 text-[#444444] dark:text-slate-300"
                                                >
                                                    {l.debit_paisa > 0 ? 'Dr' : 'Cr'} {l.account_code}{' '}
                                                    {l.account_name_en}{' '}
                                                    {formatPaisa(l.debit_paisa > 0 ? l.debit_paisa : l.credit_paisa)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                        {
                            id: 'payment_method',
                            label: isBn ? 'মাধ্যম' : 'Payment',
                            render: (entry) => (
                                <span className="whitespace-nowrap text-[#444444] dark:text-slate-300">
                                    {entry.payment_method}
                                </span>
                            ),
                        },
                        {
                            id: 'branch_name',
                            label: isBn ? 'শাখা' : 'Branch',
                            render: (entry) => (
                                <span className="whitespace-nowrap text-[#555555] dark:text-slate-400">
                                    {entry.branch_name}
                                </span>
                            ),
                        },
                        {
                            id: 'amount_paisa',
                            label: isBn ? 'পরিমাণ' : 'Amount',
                            className: 'text-right',
                            render: (entry) => (
                                <span className="font-mono font-bold whitespace-nowrap">
                                    {formatPaisa(entry.amount_paisa)}
                                </span>
                            ),
                        },
                        {
                            id: 'status',
                            label: isBn ? 'অবস্থা' : 'Status',
                            className: 'text-right',
                            render: (entry) => (
                                <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                    <span
                                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-[2px] ${
                                            entry.status === 'reversed'
                                                ? 'bg-rose-50 text-[#C9302C] border border-rose-200'
                                                : 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25'
                                        }`}
                                    >
                                        {entry.status === 'reversed'
                                            ? `Reversed (${entry.reversed_by_number ?? ''})`
                                            : entry.is_reversal
                                              ? `Reversal of ${entry.reversal_of_number ?? ''}`
                                              : 'Posted'}
                                    </span>
                                    {permissions.voucher_reverse &&
                                        entry.status === 'posted' &&
                                        !entry.is_reversal && (
                                            <button
                                                type="button"
                                                onClick={() => setReverseTarget(entry)}
                                                className="p-1 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 text-[#555555] hover:text-[#C9302C] cursor-pointer"
                                                title="Reverse"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                </div>
                            ),
                        },
                    ] as Column<PlainVoucherItem>[]}
                    keyExtractor={(entry) => entry.id}
                    searchPlaceholder={isBn ? 'ভাউচার, খাত বা বিবরণ খুঁজুন...' : 'Search voucher, category, or description...'}
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    emptyState={
                        <EmptyState
                            title={
                                isBn
                                    ? 'এই সময়কালে কোনো পোস্টকৃত এন্ট্রি নেই।'
                                    : 'No posted entries in this period.'
                            }
                        />
                    }
                />
            </div>

            {reverseTarget && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
                    <form
                        onSubmit={handleReverse}
                        className="w-full max-w-md bg-white dark:bg-[#12161c] border border-[#CCCCCC] dark:border-slate-700 rounded-[4px] shadow-xl overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-rose-50 dark:bg-rose-950/30 flex items-center justify-between">
                            <h3 className="text-[14.5px] font-bold text-[#B52B27] dark:text-rose-300">
                                Reverse {reverseTarget.number}
                            </h3>
                            <button type="button" onClick={() => setReverseTarget(null)} className="p-1 cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4">
                            <textarea
                                rows={3}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Reason for reversal (required)"
                                className="w-full p-2.5 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[13px]"
                                required
                                minLength={4}
                            />
                        </div>
                        <div className="px-4 py-3 border-t border-[#D5DBD3] dark:border-slate-800 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setReverseTarget(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="destructive" disabled={busy}>
                                Confirm reversal
                            </Button>
                        </div>
                    </form>
                </div>
            )}
        </AppLayout>
    );
}

