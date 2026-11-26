import React, { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { CheckCircle2, Plus, Printer, Trash2 } from 'lucide-react';
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
    report_group: string;
}

interface PartyOpt {
    id: number;
    type: string;
    code: string | null;
    name: string;
}

interface JournalRow {
    id: number;
    number: string | null;
    date: string;
    status: string;
    narration: string | null;
    total_debit_paisa: number;
    branch_name: string;
    created_by: string;
    created_by_id: number | null;
    approved_by: string | null;
    lines: Array<{
        id: number;
        account_code: string;
        account_name_en: string;
        account_name_bn: string;
        debit_paisa: number;
        credit_paisa: number;
        narration: string | null;
    }>;
}

interface DraftLine {
    account_id: string;
    party_id: string;
    debit: string;
    credit: string;
    narration: string;
}

interface JournalProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    currentUserId: number;
    accounts: AccountOpt[];
    parties: PartyOpt[];
    recentJournals: JournalRow[];
}

function bdtToPaisaSafe(raw: string): number {
    const clean = raw.replace(/,/g, '').trim();
    if (!clean) return 0;
    const match = clean.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) return 0;
    const taka = parseInt(match[1], 10);
    const paisa = parseInt((match[2] ?? '').padEnd(2, '0'), 10);
    return taka * 100 + paisa;
}

export default function JournalVoucher({
    settings,
    permissions,
    branches,
    selectedBranchId,
    currentUserId,
    accounts,
    parties,
    recentJournals,
}: JournalProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';
    const { errors } = usePage<{ errors: Record<string, string> }>().props;

    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [branchId, setBranchId] = useState(String(selectedBranchId ?? branches[0]?.id ?? ''));
    const [narration, setNarration] = useState('');
    const [lines, setLines] = useState<DraftLine[]>([
        { account_id: String(accounts[0]?.id ?? ''), party_id: '', debit: '', credit: '', narration: '' },
        { account_id: String(accounts[1]?.id ?? accounts[0]?.id ?? ''), party_id: '', debit: '', credit: '', narration: '' },
    ]);
    const [busy, setBusy] = useState(false);

    const totals = useMemo(() => {
        let debitPaisa = 0;
        let creditPaisa = 0;
        let invalidLine = false;
        for (const l of lines) {
            const d = bdtToPaisaSafe(l.debit);
            const c = bdtToPaisaSafe(l.credit);
            if (d > 0 && c > 0) invalidLine = true;
            debitPaisa += d;
            creditPaisa += c;
        }
        const diff = debitPaisa - creditPaisa;
        const balanced = debitPaisa > 0 && diff === 0 && !invalidLine;
        return { debitPaisa, creditPaisa, diff, balanced, invalidLine };
    }, [lines]);

    const updateLine = (idx: number, field: keyof DraftLine, value: string) => {
        setLines((prev) =>
            prev.map((row, i) => {
                if (i !== idx) return row;
                const next = { ...row, [field]: value };
                if (field === 'debit' && value.trim() !== '') next.credit = '';
                if (field === 'credit' && value.trim() !== '') next.debit = '';
                return next;
            })
        );
    };

    const addLine = () => {
        setLines((prev) => [
            ...prev,
            { account_id: String(accounts[0]?.id ?? ''), party_id: '', debit: '', credit: '', narration: '' },
        ]);
    };

    const removeLine = (idx: number) => {
        if (lines.length <= 2) return;
        setLines((prev) => prev.filter((_, i) => i !== idx));
    };

    const submitJournal = (saveAsDraft: boolean) => {
        if (!totals.balanced || narration.trim().length < 3) return;
        setBusy(true);
        router.post(
            route('accounting.journal.store'),
            {
                date,
                branch_id: branchId ? Number(branchId) : null,
                narration: narration.trim(),
                save_as_draft: saveAsDraft,
                lines: lines.map((l) => ({
                    account_id: Number(l.account_id),
                    party_id: l.party_id ? Number(l.party_id) : null,
                    debit: l.debit.trim() || '0',
                    credit: l.credit.trim() || '0',
                    narration: l.narration.trim() || null,
                })),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNarration('');
                    setLines([
                        { account_id: String(accounts[0]?.id ?? ''), party_id: '', debit: '', credit: '', narration: '' },
                        { account_id: String(accounts[1]?.id ?? accounts[0]?.id ?? ''), party_id: '', debit: '', credit: '', narration: '' },
                    ]);
                },
                onFinish: () => setBusy(false),
            }
        );
    };

    return (
        <AppLayout title={isBn ? 'জার্নাল ভাউচার' : 'Journal Voucher'}>
            <Head title="Journal Voucher" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="journal"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                {/* Builder Form */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <h1 className="text-[17px] font-bold text-[#222222] dark:text-white">
                                {isBn ? 'নতুন জার্নাল ভাউচার (ডাবল এন্ট্রি)' : 'New Journal Voucher (Double-Entry)'}
                            </h1>
                            <p className="text-[12px] text-[#555555] dark:text-slate-400">
                                {isBn
                                    ? 'মোট ডেবিট এবং মোট ক্রেডিট সমান না হওয়া পর্যন্ত পোস্ট করা যাবে না।'
                                    : 'Total Debit must equal Total Credit before posting. Vouchers above threshold route to second-user approval.'}
                            </p>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={addLine}>
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            {isBn ? 'লাইন যোগ করুন' : 'Add line'}
                        </Button>
                    </div>

                    <div className="p-4 space-y-4">
                        {Object.keys(errors || {}).length > 0 && (
                            <div className="p-2.5 rounded-[2px] border border-rose-200 bg-rose-50 text-[12px] text-[#C9302C]">
                                {Object.values(errors).map((e, i) => <div key={i}>{e}</div>)}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[13px]">
                            <div>
                                <label className="block font-semibold mb-1">{isBn ? 'তারিখ *' : 'Date *'}</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full h-[36px] px-2.5 font-mono rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                />
                            </div>
                            {branches.length > 1 && (
                                <div>
                                    <label className="block font-semibold mb-1">{isBn ? 'শাখা' : 'Branch'}</label>
                                    <select
                                        value={branchId}
                                        onChange={(e) => setBranchId(e.target.value)}
                                        className="w-full h-[36px] px-2.5 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                    >
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className={branches.length > 1 ? 'md:col-span-2' : 'md:col-span-3'}>
                                <label className="block font-semibold mb-1">{isBn ? 'বিবরণ (Narration) *' : 'Narration *'}</label>
                                <input
                                    type="text"
                                    value={narration}
                                    onChange={(e) => setNarration(e.target.value)}
                                    placeholder={isBn ? 'উদাঃ মাসিক অবচয় সমন্বয়' : 'e.g. Monthly depreciation or accrual adjustment'}
                                    className="w-full h-[36px] px-3 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                />
                            </div>
                        </div>

                        <div className="w-full overflow-x-auto border border-[#D5DBD3] dark:border-slate-800 rounded-[2px]">
                            <table className="w-full text-left border-collapse text-[12.5px]">
                                <thead>
                                    <tr className="bg-[#f8fafc] dark:bg-[#161a22] border-b border-slate-200 dark:border-slate-800 font-semibold">
                                        <th className="px-3 py-2 min-w-[220px]">{isBn ? 'হিসাব (Account)' : 'Account'}</th>
                                        <th className="px-3 py-2 min-w-[150px]">{isBn ? 'পার্টি (ঐচ্ছিক)' : 'Party (Optional)'}</th>
                                        <th className="px-3 py-2 min-w-[160px]">{isBn ? 'লাইন নোট' : 'Line Note'}</th>
                                        <th className="px-3 py-2 w-36 text-right">{isBn ? 'ডেবিট (BDT)' : 'Debit (BDT)'}</th>
                                        <th className="px-3 py-2 w-36 text-right">{isBn ? 'ক্রেডিট (BDT)' : 'Credit (BDT)'}</th>
                                        <th className="px-2 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                                    {lines.map((line, idx) => (
                                        <tr key={idx}>
                                            <td className="px-2 py-2">
                                                <select
                                                    value={line.account_id}
                                                    onChange={(e) => updateLine(idx, 'account_id', e.target.value)}
                                                    className="w-full h-[34px] px-2 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                                >
                                                    {accounts.map((a) => (
                                                        <option key={a.id} value={a.id}>
                                                            {a.code} — {isBn ? a.name_bn : a.name_en}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-2 py-2">
                                                <select
                                                    value={line.party_id}
                                                    onChange={(e) => updateLine(idx, 'party_id', e.target.value)}
                                                    className="w-full h-[34px] px-2 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                                >
                                                    <option value="">None</option>
                                                    {parties.map((p) => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    type="text"
                                                    value={line.narration}
                                                    onChange={(e) => updateLine(idx, 'narration', e.target.value)}
                                                    className="w-full h-[34px] px-2 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    type="text"
                                                    value={line.debit}
                                                    onChange={(e) => updateLine(idx, 'debit', e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full h-[34px] px-2 text-right font-mono rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    type="text"
                                                    value={line.credit}
                                                    onChange={(e) => updateLine(idx, 'credit', e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-full h-[34px] px-2 text-right font-mono rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeLine(idx)}
                                                    disabled={lines.length <= 2}
                                                    className="p-1 text-[#666666] hover:text-[#C9302C] disabled:opacity-30 cursor-pointer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#F5F7F4] dark:bg-[#161a22] font-bold">
                                        <td colSpan={3} className="px-3 py-2.5 text-right">
                                            {isBn ? 'সর্বমোট' : 'Totals'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono">{formatPaisa(totals.debitPaisa)}</td>
                                        <td className="px-3 py-2.5 text-right font-mono">{formatPaisa(totals.creditPaisa)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Balance Banner & Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div
                                className={`px-3 py-2 rounded-[2px] text-[12.5px] font-semibold flex items-center gap-2 ${
                                    totals.balanced
                                        ? 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/30'
                                        : 'bg-rose-50 text-[#C9302C] border border-rose-200'
                                }`}
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                {totals.balanced ? (
                                    <span>{isBn ? 'ভাউচার সুষম আছে — পোস্ট করার জন্য প্রস্তুত।' : 'Balanced — ready to post.'}</span>
                                ) : (
                                    <span className="font-mono">
                                        {isBn ? 'পার্থক্য:' : 'Out of balance by:'} {formatPaisa(Math.abs(totals.diff))}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busy || !totals.balanced || narration.trim().length < 3}
                                    onClick={() => submitJournal(true)}
                                >
                                    {isBn ? 'খসড়া সংরক্ষণ' : 'Save as draft'}
                                </Button>
                                {permissions.voucher_post && (
                                    <Button
                                        type="button"
                                        variant="default"
                                        disabled={busy || !totals.balanced || narration.trim().length < 3}
                                        onClick={() => submitJournal(false)}
                                    >
                                        {busy ? 'Saving...' : isBn ? 'জার্নাল পোস্ট করুন' : 'Post journal'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Journal Vouchers */}
                <DataTable<JournalRow>
                    tableId="accounting-recent-journals-table"
                    data={recentJournals}
                    columns={[
                        {
                            id: 'number',
                            label: 'Voucher #',
                            render: (j) => (
                                <div className="whitespace-nowrap">
                                    <div className="font-mono font-bold text-[#0E5F3F] dark:text-emerald-400">
                                        {j.number || `Draft #${j.id}`}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666]">{j.date}</div>
                                </div>
                            ),
                        },
                        {
                            id: 'narration',
                            label: 'Narration & Lines',
                            render: (j) => (
                                <div>
                                    <div className="font-medium">{j.narration}</div>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                        {j.lines.map((l) => (
                                            <span
                                                key={l.id}
                                                className="font-mono text-[10.5px] px-1.5 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700"
                                            >
                                                {l.debit_paisa > 0 ? 'Dr' : 'Cr'} {l.account_code}{' '}
                                                {isBn ? l.account_name_bn : l.account_name_en}:{' '}
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
                            id: 'total_debit_paisa',
                            label: 'Amount',
                            className: 'text-right',
                            render: (j) => (
                                <span className="font-mono font-bold whitespace-nowrap">
                                    {formatPaisa(j.total_debit_paisa)}
                                </span>
                            ),
                        },
                        {
                            id: 'status',
                            label: 'Status & Actions',
                            className: 'text-right',
                            render: (j) => (
                                <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 capitalize">
                                        {j.status.replace('_', ' ')}
                                    </span>
                                    {j.status === 'draft' && permissions.voucher_post && (
                                        <Button
                                            size="sm"
                                            variant="default"
                                            className="h-7 px-2 text-[11px]"
                                            onClick={() =>
                                                router.post(
                                                    route('accounting.vouchers.post', j.id),
                                                    {},
                                                    { preserveScroll: true }
                                                )
                                            }
                                        >
                                            Post
                                        </Button>
                                    )}
                                    {j.status === 'pending_approval' &&
                                        permissions.voucher_approve &&
                                        j.created_by_id !== currentUserId && (
                                            <Button
                                                size="sm"
                                                variant="default"
                                                className="h-7 px-2 text-[11px]"
                                                onClick={() =>
                                                    router.post(
                                                        route('accounting.vouchers.approve', j.id),
                                                        {},
                                                        { preserveScroll: true }
                                                    )
                                                }
                                            >
                                                Approve
                                            </Button>
                                        )}
                                    <a
                                        href={route('accounting.vouchers.print', { voucher: j.id, lang })}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 text-[#444444] hover:text-[#0E5F3F]"
                                        title="Print voucher"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            ),
                        },
                    ] as Column<JournalRow>[]}
                    keyExtractor={(j) => j.id}
                    searchPlaceholder="Search journal voucher # or narration..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <h2 className="text-[14px] font-bold text-[#222222] dark:text-white pb-1.5">
                            {isBn ? 'সাম্প্রতিক জার্নাল ভাউচার' : 'Recent Journal Vouchers'}
                        </h2>
                    }
                    emptyState={<EmptyState title="No journal vouchers yet." />}
                />
            </div>
        </AppLayout>
    );
}

