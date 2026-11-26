import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Landmark, Wallet } from 'lucide-react';
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

interface CashBookProps {
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
            voucher_id: number;
            voucher_number: string;
            voucher_type: string;
            date: string;
            narration: string | null;
            account_code: string;
            account_name_en: string;
            account_name_bn: string;
            branch_name: string | null;
            in_paisa: number;
            out_paisa: number;
            running_balance_paisa: number;
        }>;
    };
}

export default function CashBook({
    settings,
    permissions,
    branches,
    selectedBranchId,
    book,
}: CashBookProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [from, setFrom] = useState(book.from);
    const [to, setTo] = useState(book.to);
    const [accountId, setAccountId] = useState(String(book.selected_account_id ?? ''));
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? ''));

    const applyFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            route('accounting.cash-book'),
            {
                from,
                to,
                ...(accountId ? { account_id: accountId } : {}),
                ...(branchId ? { branch_id: branchId } : {}),
            },
            { preserveState: true, replace: true }
        );
    };

    return (
        <AppLayout title={isBn ? 'ক্যাশ ও ব্যাংক বই' : 'Cash & Bank Book'}>
            <Head title={isBn ? 'ক্যাশ ও ব্যাংক বই' : 'Cash & Bank Book'} />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="cash-book"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                {/* Account Balance Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {book.accounts.map((acc) => (
                        <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                                const next = String(book.selected_account_id) === String(acc.id) ? '' : String(acc.id);
                                setAccountId(next);
                                router.get(
                                    route('accounting.cash-book'),
                                    {
                                        from,
                                        to,
                                        ...(next ? { account_id: next } : {}),
                                        ...(branchId ? { branch_id: branchId } : {}),
                                    },
                                    { preserveState: true, replace: true }
                                );
                            }}
                            className={`text-left bg-white dark:bg-[#12161c] border rounded-[2px] p-4 transition-colors cursor-pointer ${
                                book.selected_account_id === acc.id
                                    ? 'border-[#0E5F3F] ring-1 ring-[#0E5F3F]/30'
                                    : 'border-[#D5DBD3] dark:border-slate-800 hover:border-[#0E5F3F]/50'
                            }`}
                        >
                            <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                                <span>{isBn ? acc.name_bn : acc.name_en}</span>
                                {acc.report_group === 'cash' ? (
                                    <Wallet className="w-4 h-4 text-[#0E5F3F]" />
                                ) : (
                                    <Landmark className="w-4 h-4 text-[#337AB7]" />
                                )}
                            </div>
                            <div className="mt-2 font-mono text-[22px] font-bold text-[#222222] dark:text-white">
                                {formatPaisa(acc.balance_paisa)}
                            </div>
                            <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400 mt-0.5">
                                {acc.code}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Filter Bar */}
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
                            {isBn ? 'হিসাব' : 'Account'}
                        </label>
                        <select
                            value={accountId}
                            onChange={(e) => setAccountId(e.target.value)}
                            className="h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                        >
                            <option value="">{isBn ? 'সব ক্যাশ ও ব্যাংক' : 'All Cash & Bank'}</option>
                            {book.accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.code} — {isBn ? a.name_bn : a.name_en}
                                </option>
                            ))}
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
                        {isBn ? 'দেখুন' : 'Apply'}
                    </Button>
                </form>

                {/* Ledger Table */}
                <DataTable
                    tableId="accounting-cash-book-table"
                    data={book.entries}
                    columns={[
                        {
                            id: 'voucher_number',
                            label: isBn ? 'তারিখ ও ভাউচার' : 'Date & Voucher',
                            render: (row) => (
                                <div className="whitespace-nowrap">
                                    <div className="font-mono text-[12px] font-semibold">{row.voucher_number}</div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">{row.date}</div>
                                </div>
                            ),
                        },
                        {
                            id: 'account_name_en',
                            label: isBn ? 'হিসাব' : 'Account',
                            render: (row) => (
                                <span className="font-medium text-[#222222] dark:text-white whitespace-nowrap">
                                    {isBn ? row.account_name_bn : row.account_name_en}
                                </span>
                            ),
                        },
                        {
                            id: 'narration',
                            label: isBn ? 'বিবরণ' : 'Description',
                            render: (row) => (
                                <span className="text-[#444444] dark:text-slate-300">
                                    {row.narration || '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'in_paisa',
                            label: isBn ? 'জমা (In)' : 'In',
                            className: 'text-right',
                            render: (row) => (
                                <span className="font-mono font-semibold text-[#0E5F3F] dark:text-emerald-400 whitespace-nowrap">
                                    {row.in_paisa > 0 ? formatPaisa(row.in_paisa) : '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'out_paisa',
                            label: isBn ? 'প্রদান (Out)' : 'Out',
                            className: 'text-right',
                            render: (row) => (
                                <span className="font-mono font-semibold text-[#C9302C] dark:text-rose-400 whitespace-nowrap">
                                    {row.out_paisa > 0 ? formatPaisa(row.out_paisa) : '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'running_balance_paisa',
                            label: isBn ? 'ব্যালেন্স' : 'Balance',
                            className: 'text-right',
                            render: (row) => (
                                <span className="font-mono font-bold whitespace-nowrap">
                                    {formatPaisa(row.running_balance_paisa)}
                                </span>
                            ),
                        },
                    ] as Column<any>[]}
                    keyExtractor={(row) => row.id}
                    searchPlaceholder={isBn ? 'ভাউচার বা বিবরণ খুঁজুন...' : 'Search voucher, account, or description...'}
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 text-[12.5px]">
                            <span>
                                {isBn ? 'প্রারম্ভিক ব্যালেন্স:' : 'Opening balance:'}{' '}
                                <strong className="font-mono">{formatPaisa(book.opening_balance_paisa)}</strong>
                            </span>
                            <div className="flex items-center gap-4">
                                <span className="text-[#0E5F3F] dark:text-emerald-400">
                                    {isBn ? 'জমা:' : 'In:'}{' '}
                                    <strong className="font-mono">{formatPaisa(book.total_in_paisa)}</strong>
                                </span>
                                <span className="text-[#C9302C] dark:text-rose-400">
                                    {isBn ? 'খরচ:' : 'Out:'}{' '}
                                    <strong className="font-mono">{formatPaisa(book.total_out_paisa)}</strong>
                                </span>
                                <span>
                                    {isBn ? 'সমাপনী ব্যালেন্স:' : 'Closing:'}{' '}
                                    <strong className="font-mono">{formatPaisa(book.closing_balance_paisa)}</strong>
                                </span>
                            </div>
                        </div>
                    }
                    emptyState={
                        <EmptyState
                            icon={Wallet}
                            title={
                                isBn
                                    ? 'এই সময়কালে কোনো ক্যাশ বা ব্যাংক লেনদেন নেই।'
                                    : 'No cash or bank movements in this period.'
                            }
                        />
                    }
                />
            </div>
        </AppLayout>
    );
}

