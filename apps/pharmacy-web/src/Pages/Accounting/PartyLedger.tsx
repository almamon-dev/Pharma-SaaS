import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
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

interface PartyLedgerProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    party: {
        id: number;
        code: string | null;
        type: string;
        name: string;
        phone: string | null;
        credit_limit_paisa: number;
    };
    ledger: {
        from: string;
        to: string;
        is_payable: boolean;
        opening_balance_paisa: number;
        total_debit_paisa: number;
        total_credit_paisa: number;
        closing_balance_paisa: number;
        entries: Array<{
            id: number;
            voucher_number: string;
            voucher_type: string;
            date: string;
            narration: string | null;
            account_code: string;
            account_name_en: string;
            branch_name: string | null;
            debit_paisa: number;
            credit_paisa: number;
            running_balance_paisa: number;
        }>;
    };
}

export default function PartyLedger({
    settings,
    permissions,
    party,
    ledger,
}: PartyLedgerProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [from, setFrom] = useState(ledger.from);
    const [to, setTo] = useState(ledger.to);

    const applyFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(route('accounting.parties.ledger', party.id), { from, to }, { preserveState: true, replace: true });
    };

    return (
        <AppLayout title={`${party.name} — Party Ledger`}>
            <Head title={`${party.name} Ledger`} />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="parties"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <Link
                            href={route('accounting.parties.index', { type: party.type === 'supplier' ? 'supplier' : 'customer' })}
                            className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-[2px] border border-[#CCCCCC] bg-[#F5F7F4] dark:bg-slate-800"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div>
                            <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">{party.name}</h1>
                            <p className="text-[12.5px] text-[#555555] dark:text-slate-400">
                                <span className="font-mono">{party.code}</span> • {party.type} • {party.phone || 'No phone'}
                                {party.credit_limit_paisa > 0 && (
                                    <> • Credit limit: <strong className="font-mono">{formatPaisa(party.credit_limit_paisa)}</strong></>
                                )}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={applyFilter} className="flex items-center gap-2 flex-wrap">
                        <input
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="h-[34px] px-2.5 font-mono text-[12px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                        />
                        <input
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="h-[34px] px-2.5 font-mono text-[12px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                        />
                        <Button type="submit" size="sm" variant="default">{isBn ? 'দেখুন' : 'Apply'}</Button>
                    </form>
                </div>

                <DataTable
                    tableId="accounting-party-ledger-table"
                    data={ledger.entries}
                    columns={[
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
                            id: 'narration',
                            label: 'Narration',
                            render: (row) => <span>{row.narration || '—'}</span>,
                        },
                        {
                            id: 'branch_name',
                            label: 'Branch',
                            render: (row) => (
                                <span className="whitespace-nowrap text-[#555555]">
                                    {row.branch_name || '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'debit_paisa',
                            label: 'Debit',
                            className: 'text-right',
                            render: (row) => (
                                <span className="font-mono whitespace-nowrap">
                                    {row.debit_paisa > 0 ? formatPaisa(row.debit_paisa) : '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'credit_paisa',
                            label: 'Credit',
                            className: 'text-right',
                            render: (row) => (
                                <span className="font-mono whitespace-nowrap">
                                    {row.credit_paisa > 0 ? formatPaisa(row.credit_paisa) : '—'}
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
                    ] as Column<any>[]}
                    keyExtractor={(row) => row.id}
                    searchPlaceholder="Search voucher or narration..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex flex-wrap justify-between gap-2 pb-1.5 text-[12.5px]">
                            <span>
                                Opening balance:{' '}
                                <strong className="font-mono">{formatPaisa(ledger.opening_balance_paisa)}</strong>
                            </span>
                            <div className="flex gap-4">
                                <span>
                                    Debit: <strong className="font-mono">{formatPaisa(ledger.total_debit_paisa)}</strong>
                                </span>
                                <span>
                                    Credit: <strong className="font-mono">{formatPaisa(ledger.total_credit_paisa)}</strong>
                                </span>
                                <span>
                                    Closing:{' '}
                                    <strong className="font-mono text-[#0E5F3F] dark:text-emerald-400">
                                        {formatPaisa(ledger.closing_balance_paisa)}
                                    </strong>
                                </span>
                            </div>
                        </div>
                    }
                    emptyState={<EmptyState title="No ledger transactions in this period." />}
                />
            </div>
        </AppLayout>
    );
}

