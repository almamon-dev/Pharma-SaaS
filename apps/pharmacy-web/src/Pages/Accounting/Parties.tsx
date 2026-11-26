import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
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

interface PartyAgeingRow {
    id: number;
    code: string | null;
    type: string;
    name: string;
    phone: string | null;
    credit_limit_paisa: number;
    bucket_0_30_paisa: number;
    bucket_31_60_paisa: number;
    bucket_61_90_paisa: number;
    bucket_90_plus_paisa: number;
    total_outstanding_paisa: number;
    overdue_60_plus_paisa: number;
    over_credit_limit: boolean;
}

interface PartiesProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    filters: { type: 'customer' | 'supplier'; as_of: string };
    totals: { b0_30: number; b31_60: number; b61_90: number; b90_plus: number; total: number };
    parties: PartyAgeingRow[];
}

export default function PartiesPage({
    settings,
    permissions,
    branches,
    selectedBranchId,
    filters,
    totals,
    parties,
}: PartiesProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [asOf, setAsOf] = useState(filters.as_of);
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? ''));
    const [modalOpen, setModalOpen] = useState(false);
    const [pType, setPType] = useState<'customer' | 'supplier'>(filters.type);
    const [pName, setPName] = useState('');
    const [pPhone, setPPhone] = useState('');
    const [pLimit, setPLimit] = useState('50000');
    const [busy, setBusy] = useState(false);

    const switchType = (nextType: 'customer' | 'supplier') => {
        router.get(
            route('accounting.parties.index'),
            { type: nextType, as_of: asOf, ...(branchId ? { branch_id: branchId } : {}) },
            { preserveState: true, replace: true }
        );
    };

    const handleCreateParty = (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        router.post(
            route('accounting.parties.store'),
            {
                type: pType,
                name: pName,
                phone: pPhone || null,
                credit_limit_bdt: pLimit || '0',
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setModalOpen(false);
                    setPName('');
                    setPPhone('');
                },
                onFinish: () => setBusy(false),
            }
        );
    };

    return (
        <AppLayout title={isBn ? 'পার্টি ও বকেয়া বিশ্লেষণ (Ageing)' : 'Parties & Ageing'}>
            <Head title="Parties & Ageing" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="parties"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            {filters.type === 'customer'
                                ? isBn
                                    ? 'ক্রেতা পাওনা ও বকেয়া (Receivable Ageing)'
                                    : 'Customer Receivables & Ageing'
                                : isBn
                                  ? 'সরবরাহকারী দেনা ও বকেয়া (Payable Ageing)'
                                  : 'Supplier Payables & Ageing'}
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            FIFO ageing buckets (0–30, 31–60, 61–90, 90+ days) as of <span className="font-mono">{filters.as_of}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => switchType('customer')}
                            className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-[2px] cursor-pointer ${
                                filters.type === 'customer'
                                    ? 'bg-[#0E5F3F] text-white'
                                    : 'bg-[#F5F7F4] dark:bg-slate-800 text-[#444444] dark:text-slate-300 border border-[#D5DBD3] dark:border-slate-700'
                            }`}
                        >
                            {isBn ? 'ক্রেতা (Customers)' : 'Customers'}
                        </button>
                        <button
                            type="button"
                            onClick={() => switchType('supplier')}
                            className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-[2px] cursor-pointer ${
                                filters.type === 'supplier'
                                    ? 'bg-[#0E5F3F] text-white'
                                    : 'bg-[#F5F7F4] dark:bg-slate-800 text-[#444444] dark:text-slate-300 border border-[#D5DBD3] dark:border-slate-700'
                            }`}
                        >
                            {isBn ? 'সরবরাহকারী (Suppliers)' : 'Suppliers'}
                        </button>
                        <input
                            type="date"
                            value={asOf}
                            onChange={(e) => {
                                setAsOf(e.target.value);
                                router.get(
                                    route('accounting.parties.index'),
                                    { type: filters.type, as_of: e.target.value, ...(branchId ? { branch_id: branchId } : {}) },
                                    { preserveState: true, replace: true }
                                );
                            }}
                            className="h-[34px] px-2.5 font-mono text-[12px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                        />
                        {permissions.all_branches && branches.length > 1 && (
                            <select
                                value={branchId}
                                onChange={(e) => {
                                    setBranchId(e.target.value);
                                    router.get(
                                        route('accounting.parties.index'),
                                        { type: filters.type, as_of: asOf, ...(e.target.value ? { branch_id: e.target.value } : {}) },
                                        { preserveState: true, replace: true }
                                    );
                                }}
                                className="h-[34px] px-2.5 text-[12px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                            >
                                <option value="">All branches</option>
                                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        )}
                        {permissions.voucher_create && (
                            <Button size="sm" variant="default" onClick={() => setModalOpen(true)}>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add party
                            </Button>
                        )}
                    </div>
                </div>

                {/* Ageing Summary KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5">
                        <div className="text-[11.5px] text-[#555555] dark:text-slate-400">0–30 days</div>
                        <div className="font-mono text-[18px] font-bold mt-1">{formatPaisa(totals.b0_30)}</div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5">
                        <div className="text-[11.5px] text-[#555555] dark:text-slate-400">31–60 days</div>
                        <div className="font-mono text-[18px] font-bold text-amber-700 dark:text-amber-400 mt-1">{formatPaisa(totals.b31_60)}</div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5">
                        <div className="text-[11.5px] text-[#555555] dark:text-slate-400">61–90 days</div>
                        <div className="font-mono text-[18px] font-bold text-[#C9302C] dark:text-rose-400 mt-1">{formatPaisa(totals.b61_90)}</div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-3.5">
                        <div className="text-[11.5px] text-[#555555] dark:text-slate-400">90+ days</div>
                        <div className="font-mono text-[18px] font-bold text-[#C9302C] dark:text-rose-400 mt-1">{formatPaisa(totals.b90_plus)}</div>
                    </div>
                    <div className="col-span-2 lg:col-span-1 bg-white dark:bg-[#12161c] border border-[#0E5F3F]/35 rounded-[2px] p-3.5">
                        <div className="text-[11.5px] font-semibold text-[#0E5F3F] dark:text-emerald-400">Total outstanding</div>
                        <div className="font-mono text-[18px] font-bold text-[#0E5F3F] dark:text-emerald-400 mt-1">{formatPaisa(totals.total)}</div>
                    </div>
                </div>

                {/* Ageing Table */}
                <DataTable<PartyAgeingRow>
                    tableId="accounting-parties-ageing-table"
                    data={parties}
                    columns={[
                        {
                            id: 'name',
                            label: 'Party',
                            render: (p) => (
                                <div>
                                    <div className="font-semibold text-[#222222] dark:text-white flex items-center gap-1.5">
                                        <span>{p.name}</span>
                                        {p.over_credit_limit && (
                                            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-[2px] bg-[#D9534F] text-white">
                                                Over limit
                                            </span>
                                        )}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                        {p.code} {p.phone ? `· ${p.phone}` : ''}
                                    </div>
                                </div>
                            ),
                        },
                        ...(filters.type === 'customer'
                            ? [
                                  {
                                      id: 'credit_limit_paisa',
                                      label: 'Credit Limit',
                                      className: 'text-right',
                                      render: (p: PartyAgeingRow) => (
                                          <span className="font-mono text-[12px] whitespace-nowrap">
                                              {p.credit_limit_paisa > 0
                                                  ? formatPaisa(p.credit_limit_paisa)
                                                  : '—'}
                                          </span>
                                      ),
                                  },
                              ]
                            : []),
                        {
                            id: 'bucket_0_30_paisa',
                            label: '0–30d',
                            className: 'text-right',
                            render: (p) => (
                                <span className="font-mono whitespace-nowrap">
                                    {formatPaisa(p.bucket_0_30_paisa)}
                                </span>
                            ),
                        },
                        {
                            id: 'bucket_31_60_paisa',
                            label: '31–60d',
                            className: 'text-right',
                            render: (p) => (
                                <span className="font-mono text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                    {formatPaisa(p.bucket_31_60_paisa)}
                                </span>
                            ),
                        },
                        {
                            id: 'bucket_61_90_paisa',
                            label: '61–90d',
                            className: 'text-right',
                            render: (p) => (
                                <span className="font-mono text-[#C9302C] dark:text-rose-400 whitespace-nowrap">
                                    {formatPaisa(p.bucket_61_90_paisa)}
                                </span>
                            ),
                        },
                        {
                            id: 'bucket_90_plus_paisa',
                            label: '90+d',
                            className: 'text-right',
                            render: (p) => (
                                <span className="font-mono text-[#C9302C] dark:text-rose-400 whitespace-nowrap">
                                    {formatPaisa(p.bucket_90_plus_paisa)}
                                </span>
                            ),
                        },
                        {
                            id: 'total_outstanding_paisa',
                            label: 'Total',
                            className: 'text-right',
                            render: (p) => (
                                <span className="font-mono font-bold whitespace-nowrap">
                                    {formatPaisa(p.total_outstanding_paisa)}
                                </span>
                            ),
                        },
                    ] as Column<PartyAgeingRow>[]}
                    keyExtractor={(p) => p.id}
                    searchPlaceholder="Search party name, code, or phone..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    actions={(p) => (
                        <Link href={route('accounting.parties.ledger', p.id)}>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                                Ledger
                            </Button>
                        </Link>
                    )}
                    actionsColumnClassName="w-[86px] min-w-[86px]"
                    emptyState={<EmptyState title="No parties found." />}
                />
            </div>

            <BrtaFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleCreateParty}
                title="Add Accounting Party"
                maxWidth="3xl"
                footerProps={{
                    cancelLabel: 'Cancel',
                    submitLabel: 'Save Party',
                    submitting: busy,
                }}
            >
                <BrtaField label="Party Type" required>
                    <BrtaOptionStrip>
                        <BrtaOptionItem>
                            <input
                                type="radio"
                                name="acct_party_type"
                                checked={pType === 'customer'}
                                onChange={() => setPType('customer')}
                                className="accent-[#337AB7]"
                            />
                            <span>Customer (ক্রেতা)</span>
                        </BrtaOptionItem>
                        <BrtaOptionItem>
                            <input
                                type="radio"
                                name="acct_party_type"
                                checked={pType === 'supplier'}
                                onChange={() => setPType('supplier')}
                                className="accent-[#337AB7]"
                            />
                            <span>Supplier (সরবরাহকারী)</span>
                        </BrtaOptionItem>
                    </BrtaOptionStrip>
                </BrtaField>

                <BrtaFormGrid>
                    <BrtaField label="Party Name" required>
                        <input
                            type="text"
                            value={pName}
                            onChange={(e) => setPName(e.target.value)}
                            className={brtaInputClass}
                            required
                        />
                    </BrtaField>
                    <BrtaField label="Phone Number">
                        <input
                            type="text"
                            value={pPhone}
                            onChange={(e) => setPPhone(e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                    <BrtaField label="Credit Limit (BDT)">
                        <input
                            type="text"
                            value={pLimit}
                            onChange={(e) => setPLimit(e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                </BrtaFormGrid>
            </BrtaFormModal>
        </AppLayout>
    );
}

