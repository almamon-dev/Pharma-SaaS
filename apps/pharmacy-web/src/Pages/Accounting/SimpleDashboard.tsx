import React, { useEffect, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowUpRight,
    Building2,
    Copy,
    Landmark,
    Layers,
    Plus,
    RotateCcw,
    Trash2,
    TrendingUp,
    Users,
    Wallet,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import {
    BrtaField,
    BrtaFormGrid,
    BrtaFormModal,
    brtaInputClass,
    brtaTextareaClass,
} from '@/Components/ui/BrtaForm';
import AccountingNav from './components/AccountingNav';
import {
    AccountingBranchOption,
    AccountingPermissions,
    AccountingSettingsData,
    PlainVoucherItem,
    SimpleCategoryItem,
    formatPaisa,
    useAccountingLang,
} from './types';

interface MultiEntryRow {
    key: string;
    kind: 'income' | 'expense';
    category_id: string;
    amount: string;
    payment_channel: 'cash' | 'bank' | 'wallet';
    party_name: string;
    note: string;
}

function parseAmountToPaisa(raw: string): number {
    const cleaned = raw.replace(/,/g, '').trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return 0;
    const val = Number(cleaned);
    return Number.isFinite(val) && val > 0 ? Math.round(val * 100) : 0;
}

interface SimpleDashboardProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    summary: {
        today_income_paisa: number;
        today_expense_paisa: number;
        month_income_paisa: number;
        month_expense_paisa: number;
        month_cogs_paisa: number | null;
        month_profit_paisa: number | null;
        cash_in_hand_paisa: number;
        bank_balance_paisa: number;
        customers_owe_paisa: number;
        owed_to_suppliers_paisa: number;
    };
    categories: SimpleCategoryItem[];
    recentEntries: PlainVoucherItem[];
}

export default function SimpleDashboard({
    settings,
    permissions,
    branches,
    selectedBranchId,
    summary,
    categories,
    recentEntries,
}: SimpleDashboardProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';
    const { errors } = usePage<{ errors: Record<string, string> }>().props;

    const [entryModalKind, setEntryModalKind] = useState<'income' | 'expense' | null>(null);
    const [categoryId, setCategoryId] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [paymentChannel, setPaymentChannel] = useState<'cash' | 'bank' | 'wallet'>('cash');
    const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [entryBranchId, setEntryBranchId] = useState<string>(
        String(selectedBranchId ?? branches[0]?.id ?? '')
    );
    const [partyName, setPartyName] = useState('');
    const [note, setNote] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [reverseTarget, setReverseTarget] = useState<PlainVoucherItem | null>(null);
    const [reverseReason, setReverseReason] = useState('');

    const makeMultiRow = (
        kind: 'income' | 'expense' = 'expense',
        seed?: Partial<MultiEntryRow>
    ): MultiEntryRow => {
        const firstCat = categories.find((c) => c.kind === kind);
        return {
            key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            kind,
            category_id: seed?.category_id ?? (firstCat ? String(firstCat.id) : ''),
            amount: seed?.amount ?? '',
            payment_channel: seed?.payment_channel ?? 'cash',
            party_name: seed?.party_name ?? '',
            note: seed?.note ?? '',
        };
    };

    const [multiModalOpen, setMultiModalOpen] = useState(false);
    const [multiDate, setMultiDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [multiBranchId, setMultiBranchId] = useState<string>(
        String(selectedBranchId ?? branches[0]?.id ?? '')
    );
    const [multiRows, setMultiRows] = useState<MultiEntryRow[]>([]);

    const openMultiModal = () => {
        setMultiDate(new Date().toISOString().slice(0, 10));
        setMultiBranchId(String(selectedBranchId ?? branches[0]?.id ?? ''));
        setMultiRows([makeMultiRow('expense'), makeMultiRow('expense')]);
        setMultiModalOpen(true);
    };

    useEffect(() => {
        if (
            permissions.expense_create &&
            typeof window !== 'undefined' &&
            window.location.search.includes('multi=1')
        ) {
            openMultiModal();
        }
    }, [permissions.expense_create]);

    const addMultiRow = (kind: 'income' | 'expense' = 'expense') => {
        setMultiRows((prev) => (prev.length >= 50 ? prev : [...prev, makeMultiRow(kind)]));
    };

    const duplicateMultiRow = (index: number) => {
        setMultiRows((prev) => {
            if (prev.length >= 50) return prev;
            const source = prev[index];
            if (!source) return prev;
            const clone = makeMultiRow(source.kind, { ...source });
            return [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)];
        });
    };

    const removeMultiRow = (key: string) => {
        setMultiRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
    };

    const updateMultiRow = (key: string, patch: Partial<MultiEntryRow>) => {
        setMultiRows((prev) =>
            prev.map((row) => {
                if (row.key !== key) return row;
                const next = { ...row, ...patch };
                if (patch.kind && patch.kind !== row.kind) {
                    const firstCat = categories.find((c) => c.kind === patch.kind);
                    next.category_id = firstCat ? String(firstCat.id) : '';
                }
                return next;
            })
        );
    };

    const multiTotals = multiRows.reduce(
        (acc, row) => {
            const paisa = parseAmountToPaisa(row.amount);
            if (paisa > 0 && row.category_id) {
                acc.validCount += 1;
            }
            if (row.kind === 'income') {
                acc.incomePaisa += paisa;
            } else {
                acc.expensePaisa += paisa;
            }
            return acc;
        },
        { validCount: 0, incomePaisa: 0, expensePaisa: 0 }
    );

    const canSubmitMulti =
        multiRows.length > 0 &&
        multiRows.every((row) => parseAmountToPaisa(row.amount) > 0 && Boolean(row.category_id));

    const handleSubmitMultiEntries = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmitMulti || submitting) return;
        setSubmitting(true);

        router.post(
            route('accounting.simple.entries.bulk'),
            {
                date: multiDate,
                branch_id: multiBranchId || null,
                entries: multiRows.map((row) => ({
                    kind: row.kind,
                    category_id: Number(row.category_id),
                    amount: row.amount.trim(),
                    payment_channel: row.payment_channel,
                    party_name: row.party_name.trim() || null,
                    note: row.note.trim() || null,
                })),
            },
            {
                preserveScroll: true,
                onSuccess: () => setMultiModalOpen(false),
                onFinish: () => setSubmitting(false),
            }
        );
    };

    const openEntryModal = (kind: 'income' | 'expense') => {
        const firstCat = categories.find((c) => c.kind === kind);
        setEntryModalKind(kind);
        setCategoryId(firstCat ? String(firstCat.id) : '');
        setEntryBranchId(String(selectedBranchId ?? branches[0]?.id ?? ''));
        setAmount('');
        setPaymentChannel('cash');
        setPartyName('');
        setNote('');
        setReceiptFile(null);
    };

    const handleBranchChange = (branchVal: string) => {
        router.get(
            route('accounting.dashboard'),
            branchVal ? { branch_id: branchVal } : {},
            { preserveState: true, replace: true }
        );
    };

    const handleSubmitEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!entryModalKind || !categoryId || !amount.trim()) return;
        setSubmitting(true);

        const formData = new FormData();
        formData.append('kind', entryModalKind);
        formData.append('category_id', categoryId);
        formData.append('amount', amount.trim());
        formData.append('payment_channel', paymentChannel);
        formData.append('date', entryDate);
        if (entryBranchId) formData.append('branch_id', entryBranchId);
        if (partyName.trim()) formData.append('party_name', partyName.trim());
        if (note.trim()) formData.append('note', note.trim());
        if (receiptFile) formData.append('receipt', receiptFile);

        router.post(route('accounting.simple.entries.store'), formData, {
            preserveScroll: true,
            onSuccess: () => setEntryModalKind(null),
            onFinish: () => setSubmitting(false),
        });
    };

    const handleReverseSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reverseTarget || reverseReason.trim().length < 4) return;
        setSubmitting(true);
        router.post(
            route('accounting.vouchers.reverse', reverseTarget.id),
            { reason: reverseReason.trim() },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setReverseTarget(null);
                    setReverseReason('');
                },
                onFinish: () => setSubmitting(false),
            }
        );
    };

    const modalCategories = categories.filter((c) => c.kind === entryModalKind);

    return (
        <AppLayout title={isBn ? 'হিসাব ও আয়-ব্যয়' : 'Accounting Dashboard'}>
            <Head title={isBn ? 'হিসাব ও আয়-ব্যয়' : 'Accounting Dashboard'} />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="dashboard"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                {/* Header Bar: Title, Branch Filter, Quick Add Income / Add Expense */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            {isBn ? 'আয়-ব্যয় ও হিসাব সারসংক্ষেপ' : 'Income, Expense & Cash Overview'}
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            {isBn
                                ? 'প্রতিটি এন্ট্রি স্বয়ংক্রিয়ভাবে ব্যালেন্সড ডাবল-এন্ট্রি লেজারে সংরক্ষিত হয়।'
                                : 'Every entry automatically posts a balanced double-entry ledger voucher behind the scenes.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {permissions.all_branches && branches.length > 1 && (
                            <select
                                value={selectedBranchId ?? ''}
                                onChange={(e) => handleBranchChange(e.target.value)}
                                className="h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[#333333] dark:text-slate-100"
                            >
                                <option value="">{isBn ? 'সব শাখা' : 'All branches'}</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name} ({b.code})
                                    </option>
                                ))}
                            </select>
                        )}

                        {permissions.expense_create && (
                            <>
                                <Button size="sm" variant="default" onClick={() => openEntryModal('income')}>
                                    <Plus className="w-4 h-4 mr-1" />
                                    {isBn ? 'আয় যোগ করুন' : 'Add income'}
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => openEntryModal('expense')}>
                                    <Plus className="w-4 h-4 mr-1" />
                                    {isBn ? 'খরচ যোগ করুন' : 'Add expense'}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={openMultiModal}>
                                    <Layers className="w-4 h-4 mr-1" />
                                    {isBn ? 'একাধিক এন্ট্রি' : 'Multi entry'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Row 1: Today's Income, Today's Expense, Profit This Month (with See More -> Simple P&L) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            <span>{isBn ? 'আজকের আয়' : "Today's income"}</span>
                            <ArrowDownLeft className="w-4 h-4 text-[#0E5F3F]" />
                        </div>
                        <div className="mt-2 font-mono text-[24px] font-bold text-[#0E5F3F] dark:text-emerald-400">
                            {formatPaisa(summary.today_income_paisa)}
                        </div>
                        <div className="mt-1 text-[11.5px] text-[#666666] dark:text-slate-400">
                            {isBn ? 'চলতি মাসে মোট আয়:' : 'This month:'}{' '}
                            <span className="font-mono font-semibold text-[#333333] dark:text-slate-200">
                                {formatPaisa(summary.month_income_paisa)}
                            </span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            <span>{isBn ? 'আজকের খরচ' : "Today's expense"}</span>
                            <ArrowUpRight className="w-4 h-4 text-[#C9302C]" />
                        </div>
                        <div className="mt-2 font-mono text-[24px] font-bold text-[#C9302C] dark:text-rose-400">
                            {formatPaisa(summary.today_expense_paisa)}
                        </div>
                        <div className="mt-1 text-[11.5px] text-[#666666] dark:text-slate-400">
                            {isBn ? 'চলতি মাসে পরিচালনা খরচ:' : 'This month operating:'}{' '}
                            <span className="font-mono font-semibold text-[#333333] dark:text-slate-200">
                                {formatPaisa(summary.month_expense_paisa)}
                            </span>
                        </div>
                    </div>

                    {permissions.cost_and_profit_view && summary.month_profit_paisa !== null ? (
                        <div className="bg-white dark:bg-[#12161c] border border-[#0E5F3F]/35 dark:border-emerald-900 rounded-[2px] p-4">
                            <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#0E5F3F] dark:text-emerald-400">
                                <span>{isBn ? 'এই মাসের লাভ' : 'Profit this month'}</span>
                                <TrendingUp className="w-4 h-4" />
                            </div>
                            <div
                                className={`mt-2 font-mono text-[24px] font-bold ${
                                    summary.month_profit_paisa >= 0
                                        ? 'text-[#0E5F3F] dark:text-emerald-400'
                                        : 'text-[#C9302C] dark:text-rose-400'
                                }`}
                            >
                                {formatPaisa(summary.month_profit_paisa)}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[12px]">
                                <span className="text-[#666666] dark:text-slate-400">
                                    {isBn ? 'পোস্টকৃত ভাউচারের ভিত্তিতে' : 'Based on posted entries'}
                                </span>
                                <Link
                                    href={route('accounting.simple-pnl')}
                                    className="font-semibold text-[#0E5F3F] dark:text-emerald-400 hover:underline"
                                >
                                    {isBn ? 'বিস্তারিত দেখুন →' : 'See more →'}
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col justify-center">
                            <div className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                                {isBn ? 'মাসিক রিপোর্ট' : 'Monthly summary'}
                            </div>
                            <div className="mt-1.5 text-[12.5px] text-[#666666] dark:text-slate-400">
                                {isBn
                                    ? 'লাভ-ক্ষতি দেখার অনুমতি নেই (accounting.cost_and_profit.view)।'
                                    : 'Profit figures require cost & profit view permission.'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Row 2: Cash in Hand, Bank & bKash Balance, Customers Owe, Owed to Suppliers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            <span>{isBn ? 'হাতে নগদ (Cash)' : 'Cash in hand'}</span>
                            <Wallet className="w-4 h-4 text-[#0E5F3F]" />
                        </div>
                        <div className="mt-2 font-mono text-[20px] font-bold text-[#222222] dark:text-white">
                            {formatPaisa(summary.cash_in_hand_paisa)}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            <span>{isBn ? 'ব্যাংক ও বিকাশ ব্যালেন্স' : 'Bank & wallet balance'}</span>
                            <Landmark className="w-4 h-4 text-[#337AB7]" />
                        </div>
                        <div className="mt-2 font-mono text-[20px] font-bold text-[#222222] dark:text-white">
                            {formatPaisa(summary.bank_balance_paisa)}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            <span>{isBn ? 'ক্রেতাদের কাছে পাওনা' : 'Customers owe'}</span>
                            <Users className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="mt-2 font-mono text-[20px] font-bold text-amber-700 dark:text-amber-400">
                            {formatPaisa(summary.customers_owe_paisa)}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            <span>{isBn ? 'সরবরাহকারীদের দেনা' : 'Owed to suppliers'}</span>
                            <Building2 className="w-4 h-4 text-[#C9302C]" />
                        </div>
                        <div className="mt-2 font-mono text-[20px] font-bold text-[#C9302C] dark:text-rose-400">
                            {formatPaisa(summary.owed_to_suppliers_paisa)}
                        </div>
                    </div>
                </div>

                {/* Recent Entries in Plain Language */}
                <DataTable<PlainVoucherItem>
                    tableId="accounting-simple-recent-table"
                    data={recentEntries}
                    columns={[
                        {
                            id: 'number',
                            label: isBn ? 'তারিখ ও নম্বর' : 'Date & Voucher #',
                            render: (item) => (
                                <div className="whitespace-nowrap">
                                    <div className="font-mono text-[12px] font-semibold text-[#222222] dark:text-white">
                                        {item.number || `#${item.id}`}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                        {item.date}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'category_en',
                            label: isBn ? 'খাত ও বিবরণ' : 'Category & Note',
                            render: (item) => (
                                <div>
                                    <div className="font-semibold text-[#222222] dark:text-white">
                                        {isBn ? item.category_bn : item.category_en}
                                    </div>
                                    {item.narration && (
                                        <div className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                            {item.narration}
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                        {
                            id: 'payment_method',
                            label: isBn ? 'মাধ্যম' : 'Channel',
                            render: (item) => (
                                <span className="whitespace-nowrap text-[#444444] dark:text-slate-300">
                                    {item.payment_method}
                                </span>
                            ),
                        },
                        {
                            id: 'branch_name',
                            label: isBn ? 'শাখা' : 'Branch',
                            render: (item) => (
                                <span className="whitespace-nowrap text-[#555555] dark:text-slate-400">
                                    {item.branch_name}
                                </span>
                            ),
                        },
                        {
                            id: 'amount_paisa',
                            label: isBn ? 'পরিমাণ' : 'Amount',
                            className: 'text-right',
                            render: (item) => (
                                <span
                                    className={`font-mono font-bold whitespace-nowrap ${
                                        item.direction === 'in'
                                            ? 'text-[#0E5F3F] dark:text-emerald-400'
                                            : item.direction === 'out'
                                              ? 'text-[#C9302C] dark:text-rose-400'
                                              : 'text-[#333333] dark:text-slate-200'
                                    }`}
                                >
                                    {item.direction === 'in' ? '+' : item.direction === 'out' ? '-' : ''}
                                    {formatPaisa(item.amount_paisa)}
                                </span>
                            ),
                        },
                        {
                            id: 'status',
                            label: isBn ? 'অবস্থা' : 'Status',
                            className: 'text-right',
                            render: (item) => (
                                <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                    {item.status === 'reversed' ? (
                                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200">
                                            {isBn ? 'রিভার্সড' : 'Reversed'}
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                            {item.is_reversal
                                                ? isBn
                                                    ? 'রিভার্সাল'
                                                    : 'Reversal'
                                                : isBn
                                                  ? 'পোস্টেড'
                                                  : 'Posted'}
                                        </span>
                                    )}
                                    {permissions.voucher_reverse &&
                                        item.status === 'posted' &&
                                        !item.is_reversal && (
                                            <button
                                                type="button"
                                                onClick={() => setReverseTarget(item)}
                                                title="Reverse voucher"
                                                className="p-1 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 text-[#555555] hover:text-[#C9302C] hover:border-[#D9534F] cursor-pointer"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                </div>
                            ),
                        },
                    ] as Column<PlainVoucherItem>[]}
                    keyExtractor={(item) => item.id}
                    searchPlaceholder={isBn ? 'ভাউচার বা খাত খুঁজুন...' : 'Search voucher, category, or note...'}
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex items-center justify-between gap-2 pb-1.5">
                            <div>
                                <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                    {isBn ? 'সাম্প্রতিক আয়-ব্যয় ও ভাউচার' : 'Recent transactions'}
                                </h2>
                                <p className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                    {isBn
                                        ? 'পোস্টকৃত ভাউচার এডিট বা ডিলিট করা যায় না — ভুল হলে রিভার্সাল ভাউচার করুন।'
                                        : 'Posted entries are immutable — corrections are made via a linked reversal voucher.'}
                                </p>
                            </div>
                            <Link
                                href={route('accounting.day-book')}
                                className="text-[12px] font-semibold text-[#0E5F3F] dark:text-emerald-400 hover:underline whitespace-nowrap"
                            >
                                {isBn ? 'সব দৈনিক খাতা →' : 'Full Day Book →'}
                            </Link>
                        </div>
                    }
                    emptyState={
                        <EmptyState
                            title={
                                isBn
                                    ? 'এখনো কোনো আয় বা খরচ এন্ট্রি করা হয়নি।'
                                    : 'No posted entries yet.'
                            }
                        />
                    }
                />
            </div>

            {/* Add Income / Add Expense Modal (BRTA Horizontal Form — Plain Language) */}
            <BrtaFormModal
                open={Boolean(entryModalKind)}
                onClose={() => setEntryModalKind(null)}
                onSubmit={handleSubmitEntry}
                title={
                    entryModalKind === 'income'
                        ? isBn
                            ? 'নতুন আয় যোগ করুন'
                            : 'Add Income'
                        : isBn
                          ? 'নতুন খরচ যোগ করুন'
                          : 'Add Expense'
                }
                maxWidth="3xl"
                footerProps={{
                    cancelLabel: isBn ? 'বাতিল' : 'Cancel',
                    submitLabel: isBn ? 'সংরক্ষণ করুন' : 'Save Entry',
                    submitting,
                }}
            >
                {Object.keys(errors || {}).length > 0 && (
                    <div className="p-2.5 rounded-[2px] border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 text-[12px] text-[#C9302C] dark:text-rose-300 space-y-0.5">
                        {Object.values(errors).map((msg, idx) => (
                            <div key={idx}>{msg}</div>
                        ))}
                    </div>
                )}

                <BrtaFormGrid>
                    <BrtaField label={isBn ? 'তারিখ' : 'Date'} required>
                        <input
                            type="date"
                            value={entryDate}
                            onChange={(e) => setEntryDate(e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>
                    <BrtaField label={isBn ? 'টাকার পরিমাণ (৳)' : 'Amount (BDT)'} required>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="3200.00"
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>
                    <BrtaField label={isBn ? 'খাত (Category)' : 'Category'} required>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className={brtaInputClass}
                            required
                        >
                            {modalCategories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {isBn ? `${c.name_bn} (${c.name_en})` : `${c.name_en} (${c.name_bn})`}
                                </option>
                            ))}
                        </select>
                    </BrtaField>
                    <BrtaField
                        label={
                            entryModalKind === 'income'
                                ? isBn
                                    ? 'কোথায় জমা হলো'
                                    : 'Received In'
                                : isBn
                                  ? 'কোথা থেকে প্রদান'
                                  : 'Paid From'
                        }
                        required
                    >
                        <select
                            value={paymentChannel}
                            onChange={(e) => setPaymentChannel(e.target.value as 'cash' | 'bank' | 'wallet')}
                            className={brtaInputClass}
                        >
                            <option value="cash">{isBn ? 'নগদ (Cash)' : 'Cash in Hand'}</option>
                            <option value="bank">{isBn ? 'ব্যাংক (Bank)' : 'Bank Account'}</option>
                            <option value="wallet">{isBn ? 'বিকাশ / নগদ' : 'bKash / Nagad'}</option>
                        </select>
                    </BrtaField>
                    {branches.length > 1 && (
                        <BrtaField label={isBn ? 'শাখা' : 'Branch'}>
                            <select
                                value={entryBranchId}
                                onChange={(e) => setEntryBranchId(e.target.value)}
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
                    <BrtaField label={isBn ? 'ব্যক্তি / প্রতিষ্ঠান' : 'Party / Vendor'}>
                        <input
                            type="text"
                            value={partyName}
                            onChange={(e) => setPartyName(e.target.value)}
                            placeholder={isBn ? 'যেমন: ডেসকো, বাড়িওয়ালা' : 'e.g. DESCO, Landlord'}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label={isBn ? 'নোট / বিবরণ' : 'Note'}>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={isBn ? 'সংক্ষিপ্ত বিবরণ লিখুন' : 'Optional short description'}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label={isBn ? 'রসিদ ছবি / PDF' : 'Receipt Attachment'}>
                        <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                            className="w-full text-[12px] text-[#555555] dark:text-slate-300"
                        />
                    </BrtaField>
                </BrtaFormGrid>
            </BrtaFormModal>

            {/* Reverse Voucher Modal */}
            <BrtaFormModal
                open={Boolean(reverseTarget)}
                onClose={() => setReverseTarget(null)}
                onSubmit={handleReverseSubmit}
                title={
                    reverseTarget
                        ? `${isBn ? 'ভাউচার রিভার্স করুন' : 'Reverse Posted Voucher'} (${reverseTarget.number})`
                        : isBn
                          ? 'ভাউচার রিভার্স করুন'
                          : 'Reverse Posted Voucher'
                }
                subtitle={
                    isBn
                        ? 'মূল ভাউচার অপরিবর্তিত থাকবে এবং সমপরিমাণ বিপরীত একটি রিভার্সাল ভাউচার তৈরি হবে।'
                        : 'The original voucher remains immutable and an equal-and-opposite reversal voucher will be posted.'
                }
                icon={<RotateCcw className="h-4 w-4 text-[#D9534F]" />}
                maxWidth="xl"
                footerProps={{
                    cancelLabel: isBn ? 'বাতিল' : 'Cancel',
                    submitLabel: isBn ? 'রিভার্স নিশ্চিত করুন' : 'Confirm Reversal',
                    submitting,
                }}
            >
                <BrtaField label={isBn ? 'রিভার্স করার কারণ' : 'Reversal Reason'} required alignTop>
                    <textarea
                        rows={3}
                        value={reverseReason}
                        onChange={(e) => setReverseReason(e.target.value)}
                        placeholder={
                            isBn
                                ? 'রিভার্স করার কারণ লিখুন (বাধ্যতামূলক)'
                                : 'Reason for reversal (required)'
                        }
                        className={brtaTextareaClass}
                        required
                        minLength={4}
                    />
                </BrtaField>
            </BrtaFormModal>

            {/* Multi-Entry Batch Modal */}
            <BrtaFormModal
                open={multiModalOpen}
                onClose={() => setMultiModalOpen(false)}
                onSubmit={handleSubmitMultiEntries}
                title={isBn ? 'একাধিক আয়-ব্যয় এন্ট্রি' : 'Multi-Entry Batch Posting'}
                subtitle={
                    isBn
                        ? 'একসাথে একাধিক আয় ও খরচের হিসাব যোগ করুন — সবগুলো একসাথে ব্যালেন্সড ভাউচার হিসেবে সেভ হবে।'
                        : 'Enter multiple income and expense lines together — all rows post atomically as balanced vouchers.'
                }
                icon={<Layers className="h-4 w-4 text-[#337AB7]" />}
                maxWidth="4xl"
                footerProps={{
                    cancelLabel: isBn ? 'বাতিল' : 'Cancel',
                    submitLabel: isBn
                        ? `${multiRows.length}টি এন্ট্রি সংরক্ষণ করুন`
                        : `Save ${multiRows.length} Entries`,
                    submitting,
                }}
            >
                <div className="space-y-3">
                    {Object.entries(errors).some(([k]) => k.startsWith('entries') || k === 'date' || k === 'branch_id') && (
                        <div className="px-3 py-2 text-[12px] bg-[#FDF2F2] dark:bg-red-950/30 border border-[#E7B5B3] dark:border-red-800 rounded-[2px] text-[#B91C1C] dark:text-red-300">
                            {Object.entries(errors)
                                .filter(([k]) => k.startsWith('entries') || k === 'date' || k === 'branch_id')
                                .map(([, msg]) => msg)
                                .join(' • ')}
                        </div>
                    )}

                    {/* Top Controls: Shared Date, Branch & Quick Add Row Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 p-2.5 bg-[#F8FAF7] dark:bg-slate-900/60 border border-[#E2E7E0] dark:border-slate-800 rounded-[2px]">
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-[#555555] dark:text-slate-400 mb-1">
                                    {isBn ? 'তারিখ' : 'Date'} *
                                </label>
                                <input
                                    type="date"
                                    value={multiDate}
                                    onChange={(e) => setMultiDate(e.target.value)}
                                    className={`${brtaInputClass} h-[32px] text-[12px]`}
                                    required
                                />
                            </div>
                            {permissions.all_branches && branches.length > 0 && (
                                <div>
                                    <label className="block text-[11px] font-semibold text-[#555555] dark:text-slate-400 mb-1">
                                        {isBn ? 'শাখা' : 'Branch'} *
                                    </label>
                                    <select
                                        value={multiBranchId}
                                        onChange={(e) => setMultiBranchId(e.target.value)}
                                        className={`${brtaInputClass} h-[32px] text-[12px]`}
                                    >
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                type="button"
                                size="sm"
                                variant="default"
                                onClick={() => addMultiRow('income')}
                                disabled={multiRows.length >= 50}
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                {isBn ? 'আয়ের সারি' : 'Income row'}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => addMultiRow('expense')}
                                disabled={multiRows.length >= 50}
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                {isBn ? 'খরচের সারি' : 'Expense row'}
                            </Button>
                        </div>
                    </div>

                    {/* Dynamic Multi-Row Table */}
                    <div className="overflow-x-auto border border-[#D5DBD3] dark:border-slate-800 rounded-[2px]">
                        <table className="w-full text-[12px] border-collapse">
                            <thead className="bg-[#F4F6F3] dark:bg-slate-900 text-[#444444] dark:text-slate-300 border-b border-[#D5DBD3] dark:border-slate-800">
                                <tr>
                                    <th className="py-2 px-2 text-center w-8">#</th>
                                    <th className="py-2 px-2 text-left w-[104px]">{isBn ? 'ধরন' : 'Type'}</th>
                                    <th className="py-2 px-2 text-left min-w-[155px]">{isBn ? 'খাত / ক্যাটাগরি' : 'Category'}</th>
                                    <th className="py-2 px-2 text-left w-[112px]">{isBn ? 'পরিমাণ (৳)' : 'Amount (৳)'}</th>
                                    <th className="py-2 px-2 text-left w-[112px]">{isBn ? 'মাধ্যম' : 'Channel'}</th>
                                    <th className="py-2 px-2 text-left w-[125px]">{isBn ? 'ব্যক্তি / প্রতিষ্ঠান' : 'Party'}</th>
                                    <th className="py-2 px-2 text-left min-w-[130px]">{isBn ? 'নোট' : 'Note'}</th>
                                    <th className="py-2 px-2 text-right w-[68px]">{isBn ? 'অ্যাকশন' : 'Action'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#ECEFEA] dark:divide-slate-800 bg-white dark:bg-[#12161c]">
                                {multiRows.map((row, idx) => {
                                    const rowCategories = categories.filter((c) => c.kind === row.kind);
                                    return (
                                        <tr key={row.key} className="hover:bg-[#FAFBF9] dark:hover:bg-slate-900/40">
                                            <td className="py-1.5 px-2 text-center font-mono text-[#666666] dark:text-slate-400">
                                                {idx + 1}
                                            </td>
                                            <td className="py-1.5 px-1.5">
                                                <select
                                                    value={row.kind}
                                                    onChange={(e) =>
                                                        updateMultiRow(row.key, {
                                                            kind: e.target.value as 'income' | 'expense',
                                                        })
                                                    }
                                                    className={`${brtaInputClass} h-[30px] px-1.5 text-[12px] font-semibold ${
                                                        row.kind === 'income'
                                                            ? 'text-[#0E5F3F] dark:text-emerald-400'
                                                            : 'text-[#C9302C] dark:text-rose-400'
                                                    }`}
                                                >
                                                    <option value="income">{isBn ? 'আয় (+)' : 'Income (+)'}</option>
                                                    <option value="expense">{isBn ? 'খরচ (-)' : 'Expense (-)'}</option>
                                                </select>
                                            </td>
                                            <td className="py-1.5 px-1.5">
                                                <select
                                                    value={row.category_id}
                                                    onChange={(e) =>
                                                        updateMultiRow(row.key, { category_id: e.target.value })
                                                    }
                                                    className={`${brtaInputClass} h-[30px] px-1.5 text-[12px]`}
                                                    required
                                                >
                                                    <option value="">
                                                        {isBn ? 'ক্যাটাগরি নির্বাচন' : 'Select category'}
                                                    </option>
                                                    {rowCategories.map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {isBn ? c.name_bn : c.name_en}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-1.5 px-1.5">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={row.amount}
                                                    onChange={(e) =>
                                                        updateMultiRow(row.key, { amount: e.target.value })
                                                    }
                                                    placeholder="0.00"
                                                    className={`${brtaInputClass} h-[30px] px-2 text-[12px] font-mono text-right`}
                                                    required
                                                />
                                            </td>
                                            <td className="py-1.5 px-1.5">
                                                <select
                                                    value={row.payment_channel}
                                                    onChange={(e) =>
                                                        updateMultiRow(row.key, {
                                                            payment_channel: e.target.value as
                                                                | 'cash'
                                                                | 'bank'
                                                                | 'wallet',
                                                        })
                                                    }
                                                    className={`${brtaInputClass} h-[30px] px-1.5 text-[12px]`}
                                                >
                                                    <option value="cash">{isBn ? 'নগদ ক্যাশ' : 'Cash'}</option>
                                                    <option value="bank">{isBn ? 'ব্যাংক' : 'Bank'}</option>
                                                    <option value="wallet">{isBn ? 'বিকাশ / নগদ' : 'bKash / Nagad'}</option>
                                                </select>
                                            </td>
                                            <td className="py-1.5 px-1.5">
                                                <input
                                                    type="text"
                                                    value={row.party_name}
                                                    onChange={(e) =>
                                                        updateMultiRow(row.key, { party_name: e.target.value })
                                                    }
                                                    placeholder={isBn ? 'যেমন: ডেসকো' : 'Party'}
                                                    className={`${brtaInputClass} h-[30px] px-2 text-[12px]`}
                                                    maxLength={120}
                                                />
                                            </td>
                                            <td className="py-1.5 px-1.5">
                                                <input
                                                    type="text"
                                                    value={row.note}
                                                    onChange={(e) =>
                                                        updateMultiRow(row.key, { note: e.target.value })
                                                    }
                                                    placeholder={isBn ? 'সংক্ষিপ্ত বিবরণ' : 'Short note'}
                                                    className={`${brtaInputClass} h-[30px] px-2 text-[12px]`}
                                                    maxLength={300}
                                                />
                                            </td>
                                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => duplicateMultiRow(idx)}
                                                    title={isBn ? 'কপি করুন' : 'Duplicate row'}
                                                    className="inline-flex items-center justify-center w-6 h-6 rounded-[2px] text-[#337AB7] hover:bg-[#337AB7]/10 mr-1 cursor-pointer"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeMultiRow(row.key)}
                                                    disabled={multiRows.length <= 1}
                                                    title={isBn ? 'মুছুন' : 'Remove row'}
                                                    className="inline-flex items-center justify-center w-6 h-6 rounded-[2px] text-[#D9534F] hover:bg-[#D9534F]/10 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-[#F8FAF7] dark:bg-slate-900/60 border border-[#E2E7E0] dark:border-slate-800 rounded-[2px] text-[12px]">
                        <div className="text-[#555555] dark:text-slate-400">
                            {isBn ? 'মোট সারি:' : 'Rows:'}{' '}
                            <span className="font-mono font-semibold text-[#222222] dark:text-white">
                                {multiRows.length}
                            </span>{' '}
                            <span className="text-[11px] text-[#777777] dark:text-slate-400">
                                ({isBn ? 'প্রস্তুত:' : 'Ready:'} {multiTotals.validCount}/{multiRows.length})
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 font-mono">
                            <span className="text-[#0E5F3F] dark:text-emerald-400 font-semibold">
                                {isBn ? 'আয়:' : 'Income:'} +{formatPaisa(multiTotals.incomePaisa)}
                            </span>
                            <span className="text-[#C9302C] dark:text-rose-400 font-semibold">
                                {isBn ? 'খরচ:' : 'Expense:'} -{formatPaisa(multiTotals.expensePaisa)}
                            </span>
                            <span className="font-bold text-[#222222] dark:text-white">
                                {isBn ? 'নিট:' : 'Net:'}{' '}
                                {formatPaisa(multiTotals.incomePaisa - multiTotals.expensePaisa)}
                            </span>
                        </div>
                    </div>
                </div>
            </BrtaFormModal>
        </AppLayout>
    );
}

