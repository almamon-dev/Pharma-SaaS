import React, { useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Landmark } from 'lucide-react';
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

interface BankBookProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    book: {
        from: string;
        to: string;
        selected_account_id: number | null;
        accounts: Array<{
            id: number;
            code: string;
            name_en: string;
            name_bn: string;
            report_group: string;
            balance_paisa: number;
        }>;
        opening_balance_paisa: number;
        total_in_paisa: number;
        total_out_paisa: number;
        closing_balance_paisa: number;
        entries: Array<{
            id: number;
            voucher_number: string;
            date: string;
            narration: string | null;
            account_name_en: string;
            account_name_bn: string;
            in_paisa: number;
            out_paisa: number;
            running_balance_paisa: number;
        }>;
    };
}

export default function BankBook({ settings, permissions, branches, selectedBranchId, book }: BankBookProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [from, setFrom] = useState(book.from);
    const [to, setTo] = useState(book.to);
    const [accountId, setAccountId] = useState(String(book.selected_account_id ?? ''));
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? ''));

    const columns: Column<BankBookProps['book']['entries'][number]>[] = useMemo(
        () => [
            {
                id: 'voucher_number',
                label: 'Date & Voucher',
                render: (row) => (
                    <div className="whitespace-nowrap">
                        <div className="font-mono font-semibold text-[12px]">{row.voucher_number}</div>
                        <div className="font-mono text-[11px] text-[#666666]">{row.date}</div>
                    </div>
                ),
            },
            {
                id: 'account_name_en',
                label: 'Account',
                render: (row) => (
                    <span className="whitespace-nowrap">
                        {isBn ? row.account_name_bn : row.account_name_en}
                    </span>
                ),
            },
            {
                id: 'narration',
                label: 'Narration',
                render: (row) => <span>{row.narration || '—'}</span>,
            },
            {
                id: 'in_paisa',
                label: 'Deposit',
                className: 'text-right',
                render: (row) => (
                    <span className="font-mono text-[#0E5F3F] whitespace-nowrap">
                        {row.in_paisa > 0 ? formatPaisa(row.in_paisa) : '—'}
                    </span>
                ),
            },
            {
                id: 'out_paisa',
                label: 'Withdrawal',
                className: 'text-right',
                render: (row) => (
                    <span className="font-mono text-[#C9302C] whitespace-nowrap">
                        {row.out_paisa > 0 ? formatPaisa(row.out_paisa) : '—'}
                    </span>
                ),
            },
            {
                id: 'running_balance_paisa',
                label: 'Balance',
                className: 'text-right',
                render: (row) => (
                    <span className="font-mono font-bold whitespace-nowrap">
                        {formatPaisa(row.running_balance_paisa)}
                    </span>
                ),
            },
        ],
        [isBn]
    );

    const applyFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            route('accounting.bank-book'),
            { from, to, ...(accountId ? { account_id: accountId } : {}), ...(branchId ? { branch_id: branchId } : {}) },
            { preserveState: true, replace: true }
        );
    };

    return (
        <AppLayout title={isBn ? 'ব্যাংক ও ওয়ালেট বই' : 'Bank Book'}>
            <Head title="Bank Book" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="bank-book"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {book.accounts.map((acc) => (
                        <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                                setAccountId(String(acc.id));
                                router.get(
                                    route('accounting.bank-book'),
                                    { from, to, account_id: acc.id, ...(branchId ? { branch_id: branchId } : {}) },
                                    { preserveState: true, replace: true }
                                );
                            }}
                            className={`text-left bg-white dark:bg-[#12161c] border rounded-[2px] p-4 cursor-pointer ${
                                book.selected_account_id === acc.id
                                    ? 'border-[#0E5F3F] ring-1 ring-[#0E5F3F]/30'
                                    : 'border-[#D5DBD3] dark:border-slate-800'
                            }`}
                        >
                            <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                                <span>{isBn ? acc.name_bn : acc.name_en}</span>
                                <Landmark className="w-4 h-4 text-[#337AB7]" />
                            </div>
                            <div className="mt-2 font-mono text-[22px] font-bold text-[#222222] dark:text-white">
                                {formatPaisa(acc.balance_paisa)}
                            </div>
                            <div className="font-mono text-[11px] text-[#666666]">{acc.code}</div>
                        </button>
                    ))}
                </div>

                <form onSubmit={applyFilter} className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5 flex flex-wrap items-end gap-3">
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-[34px] px-2.5 font-mono text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]" />
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-[34px] px-2.5 font-mono text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]" />
                    {permissions.all_branches && branches.length > 1 && (
                        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]">
                            <option value="">All branches</option>
                            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    )}
                    <Button type="submit" size="sm" variant="default">Apply</Button>
                </form>

                <DataTable
                    tableId="accounting-bank-book-table"
                    data={book.entries}
                    columns={columns}
                    keyExtractor={(row) => row.id}
                    searchPlaceholder="Search voucher, account, or narration..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 text-[12.5px]">
                            <span>
                                Opening: <strong className="font-mono">{formatPaisa(book.opening_balance_paisa)}</strong>
                            </span>
                            <div className="flex gap-4">
                                <span className="text-[#0E5F3F]">
                                    Deposits: <strong className="font-mono">{formatPaisa(book.total_in_paisa)}</strong>
                                </span>
                                <span className="text-[#C9302C]">
                                    Withdrawals: <strong className="font-mono">{formatPaisa(book.total_out_paisa)}</strong>
                                </span>
                                <span>
                                    Closing: <strong className="font-mono">{formatPaisa(book.closing_balance_paisa)}</strong>
                                </span>
                            </div>
                        </div>
                    }
                    emptyState={
                        <EmptyState icon={Landmark} title="No bank transactions in this period." />
                    }
                />
            </div>
        </AppLayout>
    );
}

