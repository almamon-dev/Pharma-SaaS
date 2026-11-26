import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Download, Printer } from 'lucide-react';
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

interface AccountOpt {
    id: number;
    code: string;
    name_en: string;
    name_bn: string;
    type: string;
}

interface LedgerData {
    account: AccountOpt & { is_credit_normal: boolean };
    from: string;
    to: string;
    opening_balance_paisa: number;
    total_debit_paisa: number;
    total_credit_paisa: number;
    closing_balance_paisa: number;
    entries: Array<{
        id: number;
        voucher_id: number;
        voucher_number: string;
        voucher_type: string;
        date: string;
        narration: string | null;
        branch_name: string | null;
        party_name: string | null;
        debit_paisa: number;
        credit_paisa: number;
        running_balance_paisa: number;
    }>;
}

interface AccountLedgerProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    accounts: AccountOpt[];
    selectedAccountId: number | null;
    filters: { from: string; to: string };
    ledger: LedgerData | null;
}

export default function AccountLedger({
    settings,
    permissions,
    branches,
    selectedBranchId,
    accounts,
    selectedAccountId,
    filters,
    ledger,
}: AccountLedgerProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [accountId, setAccountId] = useState(String(selectedAccountId ?? accounts[0]?.id ?? ''));
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? ''));

    const applyFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            route('accounting.ledger'),
            {
                account_id: accountId,
                from,
                to,
                ...(branchId ? { branch_id: branchId } : {}),
            },
            { preserveState: true, replace: true }
        );
    };

    return (
        <AppLayout title={isBn ? 'সাধারণ খতিয়ান (General Ledger)' : 'Account Ledger'}>
            <Head title="Account Ledger" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="ledger"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                <form
                    onSubmit={applyFilter}
                    className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-wrap items-end justify-between gap-3"
                >
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[240px]">
                            <label className="block text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">
                                {isBn ? 'হিসাব নির্বাচন করুন' : 'Account'}
                            </label>
                            <select
                                value={accountId}
                                onChange={(e) => setAccountId(e.target.value)}
                                className="w-full h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                            >
                                {accounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.code} — {isBn ? a.name_bn : a.name_en}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">From</label>
                            <input
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                className="h-[34px] px-2.5 font-mono text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                            />
                        </div>
                        <div>
                            <label className="block text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">To</label>
                            <input
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className="h-[34px] px-2.5 font-mono text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                            />
                        </div>
                        {permissions.all_branches && branches.length > 1 && (
                            <div>
                                <label className="block text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">Branch</label>
                                <select
                                    value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                    className="h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                >
                                    <option value="">All branches</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <Button type="submit" size="sm" variant="default">Apply</Button>
                    </div>

                    {ledger && (
                        <a
                            href={route('accounting.export', {
                                report: 'ledger',
                                account_id: ledger.account.id,
                                from: ledger.from,
                                to: ledger.to,
                                ...(selectedBranchId ? { branch_id: selectedBranchId } : {}),
                            })}
                            className="inline-flex items-center gap-1.5 h-[34px] px-3 text-[12px] font-semibold rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F5F7F4] dark:bg-slate-800 text-[#222222] dark:text-slate-200"
                        >
                            <Download className="w-3.5 h-3.5 text-[#0E5F3F]" />
                            Export CSV
                        </a>
                    )}
                </form>

                {ledger && (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5">
                                <div className="text-[11.5px] text-[#555555] dark:text-slate-400">Opening Balance</div>
                                <div className="font-mono text-[18px] font-bold mt-1">{formatPaisa(ledger.opening_balance_paisa)}</div>
                            </div>
                            <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5">
                                <div className="text-[11.5px] text-[#555555] dark:text-slate-400">Period Debit</div>
                                <div className="font-mono text-[18px] font-bold mt-1 text-[#0E5F3F]">{formatPaisa(ledger.total_debit_paisa)}</div>
                            </div>
                            <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5">
                                <div className="text-[11.5px] text-[#555555] dark:text-slate-400">Period Credit</div>
                                <div className="font-mono text-[18px] font-bold mt-1 text-[#286090]">{formatPaisa(ledger.total_credit_paisa)}</div>
                            </div>
                            <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5">
                                <div className="text-[11.5px] text-[#555555] dark:text-slate-400">Closing Balance</div>
                                <div className="font-mono text-[18px] font-bold mt-1">{formatPaisa(ledger.closing_balance_paisa)}</div>
                            </div>
                        </div>

                        <DataTable
                            tableId="accounting-general-ledger-table"
                            data={ledger.entries}
                            columns={[
                                {
                                    id: 'date',
                                    label: 'Date',
                                    render: (e) => (
                                        <span className="font-mono text-[12px] whitespace-nowrap">
                                            {e.date}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'voucher_number',
                                    label: 'Voucher #',
                                    render: (e) => (
                                        <span className="font-mono font-bold text-[12px] text-[#0E5F3F] whitespace-nowrap">
                                            {e.voucher_number}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'narration',
                                    label: 'Narration',
                                    render: (e) => (
                                        <div>
                                            <div>{e.narration || '—'}</div>
                                            {e.party_name && (
                                                <div className="text-[11px] text-[#666666]">
                                                    {e.party_name}
                                                </div>
                                            )}
                                        </div>
                                    ),
                                },
                                {
                                    id: 'branch_name',
                                    label: 'Branch',
                                    render: (e) => (
                                        <span className="text-[#555555] whitespace-nowrap">
                                            {e.branch_name || '—'}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'debit_paisa',
                                    label: 'Debit',
                                    className: 'text-right',
                                    render: (e) => (
                                        <span className="font-mono whitespace-nowrap">
                                            {e.debit_paisa > 0 ? formatPaisa(e.debit_paisa) : '—'}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'credit_paisa',
                                    label: 'Credit',
                                    className: 'text-right',
                                    render: (e) => (
                                        <span className="font-mono whitespace-nowrap">
                                            {e.credit_paisa > 0 ? formatPaisa(e.credit_paisa) : '—'}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'running_balance_paisa',
                                    label: 'Balance',
                                    className: 'text-right',
                                    render: (e) => (
                                        <span className="font-mono font-bold whitespace-nowrap">
                                            {formatPaisa(e.running_balance_paisa)}
                                        </span>
                                    ),
                                },
                            ] as Column<any>[]}
                            keyExtractor={(e) => e.id}
                            searchPlaceholder="Search voucher #, narration, or party..."
                            hideCheckbox
                            hideViewToggle
                            hideFilter
                            syncUrlParams={false}
                            headerTabs={
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 text-[13px] font-bold">
                                    <span>
                                        <span className="font-mono text-[#0E5F3F] mr-2">
                                            {ledger.account.code}
                                        </span>
                                        {isBn ? ledger.account.name_bn : ledger.account.name_en}
                                    </span>
                                    <span className="text-[12px] font-semibold text-[#555555] dark:text-slate-300">
                                        Opening ({ledger.from}):{' '}
                                        <strong className="font-mono text-[#0E5F3F]">
                                            {formatPaisa(ledger.opening_balance_paisa)}
                                        </strong>
                                    </span>
                                </div>
                            }
                            actions={(e) => (
                                <a
                                    href={route('accounting.vouchers.print', { voucher: e.voucher_id, lang })}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex p-1 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 text-[#444444] hover:text-[#0E5F3F]"
                                    title="Print voucher"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                </a>
                            )}
                            actionsColumnClassName="w-[64px] min-w-[64px]"
                            emptyState={<EmptyState title="No ledger transactions in this range." />}
                        />
                    </>
                )}
            </div>
        </AppLayout>
    );
}

