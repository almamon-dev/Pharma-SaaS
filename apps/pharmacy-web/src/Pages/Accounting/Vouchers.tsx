import React, { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { Check, Plus, Printer, RotateCcw, X } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { BrtaField, BrtaFormGrid, BrtaFormModal, BrtaOptionItem, BrtaOptionStrip, brtaInputClass } from '@/Components/ui/BrtaForm';
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

interface PartyOpt {
    id: number;
    type: string;
    code: string | null;
    name: string;
    phone: string | null;
}

interface VoucherRow {
    id: number;
    number: string | null;
    type: string;
    date: string;
    status: string;
    narration: string | null;
    total_debit_paisa: number;
    branch_name: string;
    created_by: string;
    created_by_id?: number | null;
    approved_by?: string | null;
    is_reversal: boolean;
    lines: Array<{
        id: number;
        account_code: string;
        account_name_en: string;
        account_name_bn: string;
        party_name: string | null;
        debit_paisa: number;
        credit_paisa: number;
        vat_type: string | null;
    }>;
}

interface VouchersProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    currentUserId?: number;
    filters: { from: string; to: string; type: string; status?: string };
    vouchers: VoucherRow[];
    accounts: AccountOpt[];
    parties: PartyOpt[];
}

export default function VouchersPage({
    settings,
    permissions,
    branches,
    selectedBranchId,
    currentUserId,
    filters,
    vouchers,
    accounts,
    parties,
}: VouchersProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';
    const { errors } = usePage<{ errors: Record<string, string> }>().props;

    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [typeFilter, setTypeFilter] = useState(filters.type);
    const [statusFilter, setStatusFilter] = useState(filters.status ?? '');
    const [branchFilter, setBranchFilter] = useState(String(selectedBranchId ?? ''));

    // Modal state for Receipt / Payment / Contra
    const [modalType, setModalType] = useState<'receipt' | 'payment' | 'contra' | null>(null);
    const [vDate, setVDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [vBranchId, setVBranchId] = useState(String(selectedBranchId ?? branches[0]?.id ?? ''));
    const [cashBankAccId, setCashBankAccId] = useState('');
    const [counterAccId, setCounterAccId] = useState('');
    const [partyId, setPartyId] = useState('');
    const [amount, setAmount] = useState('');
    const [includeVat, setIncludeVat] = useState(settings.vat_enabled);
    const [vatRate, setVatRate] = useState(String(settings.vat_rate_percent || 5));
    const [narration, setNarration] = useState('');
    const [busy, setBusy] = useState(false);

    const [reverseTarget, setReverseTarget] = useState<VoucherRow | null>(null);
    const [reverseReason, setReverseReason] = useState('');

    const cashBankAccounts = useMemo(
        () => accounts.filter((a) => a.report_group === 'cash' || a.report_group === 'bank'),
        [accounts]
    );

    const counterAccounts = useMemo(() => {
        if (modalType === 'contra') return cashBankAccounts;
        return accounts.filter((a) => a.report_group !== 'cash' && a.report_group !== 'bank');
    }, [accounts, cashBankAccounts, modalType]);

    const openModal = (t: 'receipt' | 'payment' | 'contra') => {
        setModalType(t);
        setVBranchId(String(selectedBranchId ?? branches[0]?.id ?? ''));
        setCashBankAccId(String(cashBankAccounts[0]?.id ?? ''));
        if (t === 'contra') {
            setCounterAccId(String(cashBankAccounts[1]?.id ?? cashBankAccounts[0]?.id ?? ''));
            setIncludeVat(false);
        } else if (t === 'receipt') {
            const ar = accounts.find((a) => a.report_group === 'receivable') ?? accounts[0];
            setCounterAccId(String(ar?.id ?? ''));
            setIncludeVat(settings.vat_enabled);
        } else {
            const ap = accounts.find((a) => a.report_group === 'payable') ?? accounts[0];
            setCounterAccId(String(ap?.id ?? ''));
            setIncludeVat(settings.vat_enabled);
        }
        setPartyId('');
        setAmount('');
        setNarration('');
    };

    const applyFilter = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            route('accounting.vouchers.index'),
            {
                from,
                to,
                ...(typeFilter ? { type: typeFilter } : {}),
                ...(statusFilter ? { status: statusFilter } : {}),
                ...(branchFilter ? { branch_id: branchFilter } : {}),
            },
            { preserveState: true, replace: true }
        );
    };

    const handleSubmitVoucher = (e: React.FormEvent) => {
        e.preventDefault();
        if (!modalType) return;
        setBusy(true);
        router.post(
            route('accounting.vouchers.rpc.store'),
            {
                type: modalType,
                date: vDate,
                branch_id: vBranchId ? Number(vBranchId) : null,
                cash_bank_account_id: Number(cashBankAccId),
                counter_account_id: Number(counterAccId),
                party_id: partyId ? Number(partyId) : null,
                amount: amount.trim(),
                include_vat: modalType !== 'contra' && includeVat,
                vat_rate_percent: Number(vatRate) || 0,
                narration: narration.trim(),
            },
            {
                preserveScroll: true,
                onSuccess: () => setModalType(null),
                onFinish: () => setBusy(false),
            }
        );
    };

    const handleReverse = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reverseTarget || reverseReason.trim().length < 4) return;
        setBusy(true);
        router.post(
            route('accounting.vouchers.reverse', reverseTarget.id),
            { reason: reverseReason.trim() },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setReverseTarget(null);
                    setReverseReason('');
                },
                onFinish: () => setBusy(false),
            }
        );
    };

    return (
        <AppLayout title={isBn ? 'ভাউচার (Receipt / Payment / Contra)' : 'Vouchers'}>
            <Head title="Vouchers" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="vouchers"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                {/* Header & Quick Create Buttons */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            {isBn ? 'রিসিপ্ট, পেমেন্ট ও কন্ট্রা ভাউচার' : 'Receipt, Payment & Contra Vouchers'}
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            {isBn
                                ? 'ক্রেতা থেকে আদায় (Receipt), সরবরাহকারী/খরচ প্রদান (Payment), এবং ক্যাশ ↔ ব্যাংক ট্রান্সফার (Contra)।'
                                : 'Record collections (Receipt), payouts (Payment), and Cash ↔ Bank transfers (Contra) with optional VAT & party link.'}
                        </p>
                    </div>

                    {permissions.voucher_create && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button size="sm" variant="default" onClick={() => openModal('receipt')}>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                {isBn ? 'রিসিপ্ট (Receipt)' : 'New Receipt'}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => openModal('payment')}>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                {isBn ? 'পেমেন্ট (Payment)' : 'New Payment'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openModal('contra')}>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                {isBn ? 'কন্ট্রা (Cash ↔ Bank)' : 'New Contra'}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Filters */}
                <form
                    onSubmit={applyFilter}
                    className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5 flex flex-wrap items-end gap-3"
                >
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
                    <div>
                        <label className="block text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">Type</label>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                        >
                            <option value="">All types</option>
                            <option value="receipt">Receipt</option>
                            <option value="payment">Payment</option>
                            <option value="contra">Contra</option>
                            <option value="sales">Sales</option>
                            <option value="purchase">Purchase</option>
                            <option value="sales_return">Sales Return</option>
                            <option value="purchase_return">Purchase Return</option>
                            <option value="journal">Journal</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                        >
                            <option value="">All statuses</option>
                            <option value="posted">Posted</option>
                            <option value="pending_approval">Pending approval</option>
                            <option value="draft">Draft</option>
                            <option value="reversed">Reversed</option>
                        </select>
                    </div>
                    {permissions.all_branches && branches.length > 1 && (
                        <div>
                            <label className="block text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">Branch</label>
                            <select
                                value={branchFilter}
                                onChange={(e) => setBranchFilter(e.target.value)}
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
                </form>

                {/* Vouchers List */}
                <DataTable<VoucherRow>
                    tableId="accounting-vouchers-table"
                    data={vouchers}
                    columns={[
                        {
                            id: 'number',
                            label: 'Voucher # & Date',
                            render: (v) => (
                                <div className="whitespace-nowrap">
                                    <div className="font-mono font-bold text-[12px] text-[#0E5F3F] dark:text-emerald-400">
                                        {v.number || `Draft #${v.id}`}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                        {v.date}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'type',
                            label: 'Type',
                            render: (v) => (
                                <span className="capitalize whitespace-nowrap font-semibold">
                                    {v.type.replace('_', ' ')}
                                </span>
                            ),
                        },
                        {
                            id: 'narration',
                            label: 'Narration & Entries',
                            render: (v) => (
                                <div>
                                    <div className="font-medium text-[#222222] dark:text-white">
                                        {v.narration || '—'}
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                        {v.lines.map((l) => (
                                            <span
                                                key={l.id}
                                                className="font-mono text-[10.5px] px-1.5 py-0.2 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700"
                                            >
                                                {l.debit_paisa > 0 ? 'Dr' : 'Cr'} {l.account_code}{' '}
                                                {isBn ? l.account_name_bn : l.account_name_en}
                                                {l.party_name ? ` (${l.party_name})` : ''}:{' '}
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
                                <span className="whitespace-nowrap text-[#555555] dark:text-slate-400">
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
                        {
                            id: 'status',
                            label: 'Status',
                            className: 'text-right',
                            render: (v) => (
                                <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                    <span
                                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-[2px] capitalize ${
                                            v.status === 'reversed'
                                                ? 'bg-rose-50 text-[#C9302C] border border-rose-200'
                                                : v.status === 'posted'
                                                  ? 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25'
                                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                                        }`}
                                    >
                                        {v.status.replace('_', ' ')}
                                    </span>
                                    {v.status === 'draft' && permissions.voucher_post && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.post(
                                                    route('accounting.vouchers.post', v.id),
                                                    {},
                                                    { preserveScroll: true }
                                                )
                                            }
                                            className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#0E5F3F] text-white cursor-pointer"
                                            title="Post draft voucher"
                                        >
                                            Post
                                        </button>
                                    )}
                                    {v.status === 'pending_approval' &&
                                        permissions.voucher_approve &&
                                        v.created_by_id !== currentUserId && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    router.post(
                                                        route('accounting.vouchers.approve', v.id),
                                                        {},
                                                        { preserveScroll: true }
                                                    )
                                                }
                                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#5CB85C] text-white cursor-pointer"
                                                title="Approve and post (second user)"
                                            >
                                                <Check className="w-3 h-3" />
                                                Approve
                                            </button>
                                        )}
                                    <a
                                        href={route('accounting.vouchers.print', { voucher: v.id, lang })}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 text-[#555555] hover:text-[#0E5F3F]"
                                        title="Print voucher (EN / বাংলা)"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                    </a>
                                    {permissions.voucher_reverse &&
                                        v.status === 'posted' &&
                                        !v.is_reversal && (
                                            <button
                                                type="button"
                                                onClick={() => setReverseTarget(v)}
                                                className="p-1 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 text-[#555555] hover:text-[#C9302C] cursor-pointer"
                                                title="Reverse voucher"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                </div>
                            ),
                        },
                    ] as Column<VoucherRow>[]}
                    keyExtractor={(v) => v.id}
                    searchPlaceholder="Search voucher #, type, narration, or branch..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    emptyState={<EmptyState title="No vouchers in this range." />}
                />
            </div>

            {/* Create Receipt / Payment / Contra Modal */}
            <BrtaFormModal
                open={Boolean(modalType)}
                onClose={() => setModalType(null)}
                onSubmit={handleSubmitVoucher}
                title={modalType ? `New ${modalType.charAt(0).toUpperCase() + modalType.slice(1)} Voucher` : 'New Voucher'}
                maxWidth="3xl"
                footerProps={{
                    cancelLabel: 'Cancel',
                    submitLabel: 'Post Voucher',
                    submitting: busy,
                }}
            >
                {Object.keys(errors || {}).length > 0 && (
                    <div className="p-2.5 rounded-[2px] border border-rose-200 bg-rose-50 text-[12px] text-[#C9302C]">
                        {Object.values(errors).map((e, i) => (
                            <div key={i}>{e}</div>
                        ))}
                    </div>
                )}

                <BrtaFormGrid>
                    <BrtaField label="Date" required>
                        <input
                            type="date"
                            value={vDate}
                            onChange={(e) => setVDate(e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>
                    <BrtaField label="Amount (BDT)" required>
                        <input
                            type="text"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="10000.00"
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>
                    <BrtaField
                        label={
                            modalType === 'receipt'
                                ? 'Deposit Into'
                                : modalType === 'payment'
                                  ? 'Paid From'
                                  : 'Transfer From'
                        }
                        required
                    >
                        <select
                            value={cashBankAccId}
                            onChange={(e) => setCashBankAccId(e.target.value)}
                            className={brtaInputClass}
                            required
                        >
                            {cashBankAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.code} — {a.name_en}
                                </option>
                            ))}
                        </select>
                    </BrtaField>
                    <BrtaField
                        label={
                            modalType === 'contra'
                                ? 'Transfer To'
                                : modalType === 'receipt'
                                  ? 'Received For'
                                  : 'Paid For'
                        }
                        required
                    >
                        <select
                            value={counterAccId}
                            onChange={(e) => setCounterAccId(e.target.value)}
                            className={brtaInputClass}
                            required
                        >
                            {counterAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.code} — {a.name_en}
                                </option>
                            ))}
                        </select>
                    </BrtaField>
                    {modalType !== 'contra' && (
                        <>
                            <BrtaField label="Party">
                                <select
                                    value={partyId}
                                    onChange={(e) => setPartyId(e.target.value)}
                                    className={brtaInputClass}
                                >
                                    <option value="">None / General</option>
                                    {parties.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.type})
                                        </option>
                                    ))}
                                </select>
                            </BrtaField>
                            <BrtaField label="VAT (%)">
                                <div className="flex items-center gap-2">
                                    <BrtaOptionStrip>
                                        <BrtaOptionItem className="py-1.5 px-2.5">
                                            <input
                                                type="checkbox"
                                                checked={includeVat}
                                                onChange={(e) => setIncludeVat(e.target.checked)}
                                                className="accent-[#337AB7]"
                                            />
                                            <span>VAT</span>
                                        </BrtaOptionItem>
                                    </BrtaOptionStrip>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="50"
                                        disabled={!includeVat}
                                        value={vatRate}
                                        onChange={(e) => setVatRate(e.target.value)}
                                        className={`${brtaInputClass} font-mono`}
                                    />
                                </div>
                            </BrtaField>
                        </>
                    )}
                    {branches.length > 1 && (
                        <BrtaField label="Branch">
                            <select
                                value={vBranchId}
                                onChange={(e) => setVBranchId(e.target.value)}
                                className={brtaInputClass}
                            >
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </BrtaField>
                    )}
                </BrtaFormGrid>

                <BrtaField label="Narration" required>
                    <input
                        type="text"
                        value={narration}
                        onChange={(e) => setNarration(e.target.value)}
                        placeholder="Description of transaction"
                        className={brtaInputClass}
                        required
                    />
                </BrtaField>
            </BrtaFormModal>

            {reverseTarget && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
                    <form
                        onSubmit={handleReverse}
                        className="w-full max-w-md bg-white dark:bg-[#12161c] border border-[#CCCCCC] dark:border-slate-700 rounded-[4px] shadow-xl overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-rose-50 flex items-center justify-between">
                            <h3 className="text-[14.5px] font-bold text-[#B52B27]">Reverse {reverseTarget.number}</h3>
                            <button type="button" onClick={() => setReverseTarget(null)} className="p-1 cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4">
                            <textarea
                                rows={3}
                                value={reverseReason}
                                onChange={(e) => setReverseReason(e.target.value)}
                                placeholder="Reason for reversal (required)"
                                className="w-full p-2.5 rounded-[2px] border border-[#CCCCCC] bg-white dark:bg-[#181d25] text-[13px]"
                                required
                                minLength={4}
                            />
                        </div>
                        <div className="px-4 py-3 border-t border-[#D5DBD3] flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setReverseTarget(null)}>Cancel</Button>
                            <Button type="submit" variant="destructive" disabled={busy}>Confirm reversal</Button>
                        </div>
                    </form>
                </div>
            )}
        </AppLayout>
    );
}

