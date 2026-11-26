import React, { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { PackageMinus, Printer, Scale, Users } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { BrtaField, BrtaFormFooter, BrtaFormGrid, brtaInputClass } from '@/Components/ui/BrtaForm';
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
    report_group: string;
}

interface RecentOpVoucher {
    id: number;
    number: string | null;
    type: string;
    date: string;
    status: string;
    narration: string | null;
    branch_name: string;
    total_debit_paisa: number;
    created_by: string;
    lines: Array<{
        id: number;
        account_code: string;
        account_name_en: string;
        debit_paisa: number;
        credit_paisa: number;
    }>;
}

interface OperationsProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    accounts: AccountOpt[];
    recentVouchers: RecentOpVoucher[];
}

export default function OperationsVouchers({
    settings,
    permissions,
    branches,
    selectedBranchId,
    accounts,
    recentVouchers,
}: OperationsProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';
    const { errors } = usePage<{ errors: Record<string, string> }>().props;

    const [tab, setTab] = useState<'payroll' | 'stock' | 'opening'>('payroll');
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? branches[0]?.id ?? ''));
    const [busy, setBusy] = useState(false);

    // Payroll fields
    const [payMode, setPayMode] = useState<'pay_now' | 'accrue_only' | 'partial_pay' | 'settle_payable'>('pay_now');
    const [grossSalary, setGrossSalary] = useState('');
    const [paidNow, setPaidNow] = useState('');
    const [payChannel, setPayChannel] = useState<'cash' | 'bank' | 'wallet'>('bank');
    const [payNarration, setPayNarration] = useState('');

    // Stock adjustment fields
    const inventoryAccounts = useMemo(() => accounts.filter((a) => a.report_group === 'inventory'), [accounts]);
    const [stockReason, setStockReason] = useState<'expired_damaged' | 'shrinkage_loss' | 'surplus_gain'>('expired_damaged');
    const [invAccountId, setInvAccountId] = useState(String(inventoryAccounts[0]?.id ?? ''));
    const [stockAmount, setStockAmount] = useState('');
    const [stockNarration, setStockNarration] = useState('');

    // Opening balance fields
    const bsAccounts = useMemo(
        () => accounts.filter((a) => ['asset', 'liability'].includes(a.type)),
        [accounts]
    );
    const [openAccountId, setOpenAccountId] = useState(String(bsAccounts[0]?.id ?? ''));
    const [openSide, setOpenSide] = useState<'debit' | 'credit'>('debit');
    const [openAmount, setOpenAmount] = useState('');
    const [openNarration, setOpenNarration] = useState('Opening balance setup');

    const submitPayroll = (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        router.post(
            route('accounting.operations.payroll.store'),
            {
                date,
                branch_id: branchId ? Number(branchId) : null,
                mode: payMode,
                gross_salary: grossSalary.trim(),
                paid_now: paidNow.trim() || null,
                payment_channel: payChannel,
                narration: payNarration.trim(),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setGrossSalary('');
                    setPaidNow('');
                    setPayNarration('');
                },
                onFinish: () => setBusy(false),
            }
        );
    };

    const submitStock = (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        router.post(
            route('accounting.operations.stock.store'),
            {
                date,
                branch_id: branchId ? Number(branchId) : null,
                reason_kind: stockReason,
                inventory_account_id: invAccountId ? Number(invAccountId) : null,
                amount: stockAmount.trim(),
                narration: stockNarration.trim(),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setStockAmount('');
                    setStockNarration('');
                },
                onFinish: () => setBusy(false),
            }
        );
    };

    const submitOpening = (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        router.post(
            route('accounting.operations.opening.store'),
            {
                date,
                branch_id: branchId ? Number(branchId) : null,
                account_id: Number(openAccountId),
                side: openSide,
                amount: openAmount.trim(),
                narration: openNarration.trim(),
            },
            {
                preserveScroll: true,
                onSuccess: () => setOpenAmount(''),
                onFinish: () => setBusy(false),
            }
        );
    };

    return (
        <AppLayout title={isBn ? 'বেতন, স্টক সমন্বয় ও প্রারম্ভিক স্থিতি' : 'Payroll & Stock Vouchers'}>
            <Head title="Payroll & Stock Vouchers" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="operations"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                {/* Tabs & Form */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setTab('payroll')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-[2px] cursor-pointer ${
                                    tab === 'payroll'
                                        ? 'bg-[#0E5F3F] text-white'
                                        : 'bg-white dark:bg-[#181d25] border border-[#CCCCCC] dark:border-slate-700'
                                }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                {isBn ? 'বেতন (Payroll)' : 'Payroll Voucher'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setTab('stock')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-[2px] cursor-pointer ${
                                    tab === 'stock'
                                        ? 'bg-[#0E5F3F] text-white'
                                        : 'bg-white dark:bg-[#181d25] border border-[#CCCCCC] dark:border-slate-700'
                                }`}
                            >
                                <PackageMinus className="w-3.5 h-3.5" />
                                {isBn ? 'স্টক সমন্বয় / মেয়াদোত্তীর্ণ' : 'Stock Adjustment & Write-Off'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setTab('opening')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-[2px] cursor-pointer ${
                                    tab === 'opening'
                                        ? 'bg-[#0E5F3F] text-white'
                                        : 'bg-white dark:bg-[#181d25] border border-[#CCCCCC] dark:border-slate-700'
                                }`}
                            >
                                <Scale className="w-3.5 h-3.5" />
                                {isBn ? 'প্রারম্ভিক স্থিতি' : 'Opening Balance'}
                            </button>
                        </div>

                        <div className="flex items-center gap-2 text-[12.5px]">
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="h-[32px] px-2 font-mono rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                            />
                            {branches.length > 1 && (
                                <select
                                    value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                    className="h-[32px] px-2 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                >
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="text-[13px]">
                        {Object.keys(errors || {}).length > 0 && (
                            <div className="mx-5 mt-4 p-2.5 rounded-[2px] border border-rose-200 bg-rose-50 text-[12px] text-[#C9302C]">
                                {Object.values(errors).map((e, i) => <div key={i}>{e}</div>)}
                            </div>
                        )}

                        {tab === 'payroll' && (
                            <form onSubmit={submitPayroll}>
                                <div className="p-5 space-y-4">
                                    <BrtaFormGrid>
                                        <BrtaField label="Payroll Mode" required>
                                            <select
                                                value={payMode}
                                                onChange={(e) => setPayMode(e.target.value as any)}
                                                className={brtaInputClass}
                                            >
                                                <option value="pay_now">Pay Immediately (Dr 6010 / Cr Cash-Bank)</option>
                                                <option value="accrue_only">Accrue Only (Dr 6010 / Cr 2200 Payable)</option>
                                                <option value="partial_pay">Partial Pay + Accrue Remaining</option>
                                                <option value="settle_payable">Settle Accrued Salary (Dr 2200 / Cr Cash-Bank)</option>
                                            </select>
                                        </BrtaField>
                                        <BrtaField label="Gross Salary (BDT)" required>
                                            <input
                                                type="text"
                                                value={grossSalary}
                                                onChange={(e) => setGrossSalary(e.target.value)}
                                                placeholder="85000.00"
                                                className={`${brtaInputClass} font-mono`}
                                                required
                                            />
                                        </BrtaField>
                                        {payMode === 'partial_pay' && (
                                            <BrtaField label="Paid Now (BDT)" required>
                                                <input
                                                    type="text"
                                                    value={paidNow}
                                                    onChange={(e) => setPaidNow(e.target.value)}
                                                    placeholder="50000.00"
                                                    className={`${brtaInputClass} font-mono`}
                                                    required
                                                />
                                            </BrtaField>
                                        )}
                                        <BrtaField label="Payment Channel">
                                            <select
                                                value={payChannel}
                                                onChange={(e) => setPayChannel(e.target.value as any)}
                                                className={brtaInputClass}
                                            >
                                                <option value="bank">Bank Account (1020)</option>
                                                <option value="cash">Cash in Hand (1010)</option>
                                                <option value="wallet">bKash / Nagad (1030)</option>
                                            </select>
                                        </BrtaField>
                                        <BrtaField label="Narration" required>
                                            <input
                                                type="text"
                                                value={payNarration}
                                                onChange={(e) => setPayNarration(e.target.value)}
                                                placeholder="Staff salary for November 2026"
                                                className={brtaInputClass}
                                                required
                                            />
                                        </BrtaField>
                                    </BrtaFormGrid>
                                </div>
                                <BrtaFormFooter
                                    submitLabel="Post Payroll Voucher"
                                    submitting={busy}
                                    submitDisabled={!permissions.voucher_create}
                                />
                            </form>
                        )}

                        {tab === 'stock' && (
                            <form onSubmit={submitStock}>
                                <div className="p-5 space-y-4">
                                    <BrtaFormGrid>
                                        <BrtaField label="Adjustment Type" required>
                                            <select
                                                value={stockReason}
                                                onChange={(e) => setStockReason(e.target.value as any)}
                                                className={brtaInputClass}
                                            >
                                                <option value="expired_damaged">Expired / Damaged Write-Off (Dr 5020 / Cr Inv)</option>
                                                <option value="shrinkage_loss">Stock Shrinkage Loss (Dr 5030 / Cr Inv)</option>
                                                <option value="surplus_gain">Audit Surplus Found (Dr Inv / Cr 5030)</option>
                                            </select>
                                        </BrtaField>
                                        <BrtaField label="Inventory Account">
                                            <select
                                                value={invAccountId}
                                                onChange={(e) => setInvAccountId(e.target.value)}
                                                className={brtaInputClass}
                                            >
                                                {inventoryAccounts.map((a) => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.code} — {isBn ? a.name_bn : a.name_en}
                                                    </option>
                                                ))}
                                            </select>
                                        </BrtaField>
                                        <BrtaField label="Cost Value (BDT)" required>
                                            <input
                                                type="text"
                                                value={stockAmount}
                                                onChange={(e) => setStockAmount(e.target.value)}
                                                placeholder="4500.00"
                                                className={`${brtaInputClass} font-mono`}
                                                required
                                            />
                                        </BrtaField>
                                        <BrtaField label="Reason / Batch Note" required>
                                            <input
                                                type="text"
                                                value={stockNarration}
                                                onChange={(e) => setStockNarration(e.target.value)}
                                                placeholder="Expired batch #B2024 write-off"
                                                className={brtaInputClass}
                                                required
                                            />
                                        </BrtaField>
                                    </BrtaFormGrid>
                                </div>
                                <BrtaFormFooter
                                    submitLabel="Post Stock Adjustment"
                                    submitting={busy}
                                    submitDisabled={!permissions.voucher_create}
                                />
                            </form>
                        )}

                        {tab === 'opening' && (
                            <form onSubmit={submitOpening}>
                                <div className="p-5 space-y-4">
                                    <BrtaFormGrid>
                                        <BrtaField label="Account" required>
                                            <select
                                                value={openAccountId}
                                                onChange={(e) => setOpenAccountId(e.target.value)}
                                                className={brtaInputClass}
                                            >
                                                {bsAccounts.map((a) => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.code} — {isBn ? a.name_bn : a.name_en} ({a.type})
                                                    </option>
                                                ))}
                                            </select>
                                        </BrtaField>
                                        <BrtaField label="Normal Side">
                                            <select
                                                value={openSide}
                                                onChange={(e) => setOpenSide(e.target.value as any)}
                                                className={brtaInputClass}
                                            >
                                                <option value="debit">Debit (Assets — offsets Cr 3010 Capital)</option>
                                                <option value="credit">Credit (Liabilities — offsets Dr 3010 Capital)</option>
                                            </select>
                                        </BrtaField>
                                        <BrtaField label="Amount (BDT)" required>
                                            <input
                                                type="text"
                                                value={openAmount}
                                                onChange={(e) => setOpenAmount(e.target.value)}
                                                placeholder="250000.00"
                                                className={`${brtaInputClass} font-mono`}
                                                required
                                            />
                                        </BrtaField>
                                        <BrtaField label="Narration" required>
                                            <input
                                                type="text"
                                                value={openNarration}
                                                onChange={(e) => setOpenNarration(e.target.value)}
                                                className={brtaInputClass}
                                                required
                                            />
                                        </BrtaField>
                                    </BrtaFormGrid>
                                </div>
                                <BrtaFormFooter
                                    submitLabel="Post Opening Balance"
                                    submitting={busy}
                                    submitDisabled={!permissions.voucher_create}
                                />
                            </form>
                        )}
                    </div>
                </div>

                {/* Recent Operations Vouchers */}
                <DataTable<RecentOpVoucher>
                    tableId="accounting-operations-vouchers-table"
                    data={recentVouchers}
                    columns={[
                        {
                            id: 'number',
                            label: 'Voucher #',
                            render: (v) => (
                                <div className="font-mono whitespace-nowrap">
                                    <div className="font-bold text-[#0E5F3F]">
                                        {v.number || `Draft #${v.id}`}
                                    </div>
                                    <div className="text-[11px] text-[#666666]">{v.date}</div>
                                </div>
                            ),
                        },
                        {
                            id: 'type',
                            label: 'Type',
                            render: (v) => (
                                <span className="capitalize font-semibold whitespace-nowrap">
                                    {v.type.replace('_', ' ')}
                                </span>
                            ),
                        },
                        {
                            id: 'narration',
                            label: 'Narration & Entries',
                            render: (v) => (
                                <div>
                                    <div>{v.narration}</div>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                        {v.lines.map((l) => (
                                            <span
                                                key={l.id}
                                                className="font-mono text-[10.5px] px-1.5 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700"
                                            >
                                                {l.debit_paisa > 0 ? 'Dr' : 'Cr'} {l.account_code}{' '}
                                                {l.account_name_en}:{' '}
                                                {formatPaisa(
                                                    l.debit_paisa > 0 ? l.debit_paisa : l.credit_paisa
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'branch_name',
                            label: 'Branch',
                            render: (v) => (
                                <span className="text-[#555555] whitespace-nowrap">
                                    {v.branch_name}
                                </span>
                            ),
                        },
                        {
                            id: 'total_debit_paisa',
                            label: 'Amount',
                            className: 'text-right',
                            render: (v) => (
                                <span className="font-mono font-bold whitespace-nowrap">
                                    {formatPaisa(v.total_debit_paisa)}
                                </span>
                            ),
                        },
                    ] as Column<RecentOpVoucher>[]}
                    keyExtractor={(v) => v.id}
                    searchPlaceholder="Search voucher #, type, or narration..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <div className="font-bold text-[14px] pb-1.5">
                            {isBn
                                ? 'সাম্প্রতিক বেতন, স্টক ও প্রারম্ভিক ভাউচার'
                                : 'Recent Payroll, Stock Adjustment & Opening Balance Vouchers'}
                        </div>
                    }
                    actions={(v) => (
                        <a
                            href={route('accounting.vouchers.print', { voucher: v.id, lang })}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex p-1 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 text-[#444444] hover:text-[#0E5F3F]"
                            title="Print voucher"
                        >
                            <Printer className="w-3.5 h-3.5" />
                        </a>
                    )}
                    actionsColumnClassName="w-[64px] min-w-[64px]"
                    emptyState={
                        <EmptyState title="No payroll, stock adjustment, or opening balance vouchers yet." />
                    }
                />
            </div>
        </AppLayout>
    );
}

