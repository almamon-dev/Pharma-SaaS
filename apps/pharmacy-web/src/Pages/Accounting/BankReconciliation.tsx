import React, { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { CheckCircle2, Link2, Unlink, Upload } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { BrtaField, BrtaFormGrid, BrtaFormModal, brtaInputClass, brtaTextareaClass } from '@/Components/ui/BrtaForm';
import AccountingNav from './components/AccountingNav';
import {
    AccountingBranchOption,
    AccountingPermissions,
    AccountingSettingsData,
    formatPaisa,
    useAccountingLang,
} from './types';

interface BankAccountOpt {
    id: number;
    code: string;
    name_en: string;
    name_bn: string;
}

interface ReconLine {
    id: number;
    line_date: string;
    reference: string | null;
    description: string | null;
    debit_paisa: number;
    credit_paisa: number;
    status: 'unmatched' | 'matched' | 'ignored';
    match_method: string | null;
    matched_voucher_line_id: number | null;
    matched_voucher_number: string | null;
}

interface BookLine {
    id: number;
    voucher_number: string;
    voucher_type: string;
    date: string;
    narration: string | null;
    debit_paisa: number;
    credit_paisa: number;
}

interface ReconData {
    account_id: number;
    statements: Array<{
        id: number;
        statement_date: string;
        filename: string;
        closing_balance_paisa: number;
        status: string;
    }>;
    active_statement: {
        id: number;
        statement_date: string;
        filename: string;
        opening_balance_paisa: number;
        closing_balance_paisa: number;
        status: string;
    } | null;
    metrics: {
        statement_closing_paisa: number;
        book_balance_paisa: number;
        raw_difference_paisa: number;
        unmatched_bank_net_paisa: number;
        unmatched_book_net_paisa: number;
        matched_count: number;
        unmatched_count: number;
    };
    lines: ReconLine[];
    unmatched_book_lines: BookLine[];
}

interface BankReconProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    branches: AccountingBranchOption[];
    selectedBranchId: number | null;
    bankAccounts: BankAccountOpt[];
    selectedAccountId: number | null;
    reconciliation: ReconData | null;
}

export default function BankReconciliation({
    settings,
    permissions,
    branches,
    selectedBranchId,
    bankAccounts,
    selectedAccountId,
    reconciliation,
}: BankReconProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';
    const { errors } = usePage<{ errors: Record<string, string> }>().props;

    const [accountId, setAccountId] = useState(String(selectedAccountId ?? bankAccounts[0]?.id ?? ''));
    const [statementId, setStatementId] = useState(String(reconciliation?.active_statement?.id ?? ''));
    const [showImport, setShowImport] = useState(false);

    // Import form state
    const [stmtDate, setStmtDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [openingBal, setOpeningBal] = useState('0');
    const [closingBal, setClosingBal] = useState('');
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvText, setCsvText] = useState('');
    const [busy, setBusy] = useState(false);

    // Per-line manual match selection
    const [selectedMatch, setSelectedMatch] = useState<Record<number, string>>({});

    const switchContext = (nextAccId: string, nextStmtId?: string) => {
        setAccountId(nextAccId);
        router.get(
            route('accounting.bank-reconciliation.index'),
            {
                account_id: nextAccId,
                ...(nextStmtId ? { statement_id: nextStmtId } : {}),
                ...(selectedBranchId ? { branch_id: selectedBranchId } : {}),
            },
            { preserveState: false }
        );
    };

    const handleImport = (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        const fd = new FormData();
        fd.append('account_id', accountId);
        if (selectedBranchId) fd.append('branch_id', String(selectedBranchId));
        fd.append('statement_date', stmtDate);
        fd.append('opening_balance', openingBal.trim() || '0');
        fd.append('closing_balance', closingBal.trim());
        if (csvFile) {
            fd.append('csv_file', csvFile);
        } else {
            fd.append('csv_text', csvText);
        }

        router.post(route('accounting.bank-reconciliation.import'), fd, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setShowImport(false);
                setCsvFile(null);
                setCsvText('');
            },
            onFinish: () => setBusy(false),
        });
    };

    const handleManualMatch = (lineId: number) => {
        const vlId = selectedMatch[lineId];
        if (!vlId) return;
        router.post(
            route('accounting.bank-reconciliation.match', lineId),
            { voucher_line_id: Number(vlId) },
            { preserveScroll: true }
        );
    };

    return (
        <AppLayout title={isBn ? 'ব্যাংক রিকনসিলিয়েশন' : 'Bank Reconciliation'}>
            <Head title="Bank Reconciliation" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="bank-reconciliation"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                {/* Top Toolbar */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            {isBn ? 'ব্যাংক রিকনসিলিয়েশন (Bank Reconciliation)' : 'Bank Reconciliation'}
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400">
                            {isBn
                                ? 'ব্যাংক স্টেটমেন্ট CSV আপলোড করুন, অটো-ম্যাচ করুন এবং অমিল এন্ট্রি হাতে মিলিয়ে নিন।'
                                : 'Upload bank statement CSV, auto-match against posted bank ledger lines (±3 days, exact paisa), and resolve unmatched differences.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={accountId}
                            onChange={(e) => switchContext(e.target.value)}
                            className="h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                        >
                            {bankAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.code} — {isBn ? a.name_bn : a.name_en}
                                </option>
                            ))}
                        </select>

                        {reconciliation && reconciliation.statements.length > 0 && (
                            <select
                                value={statementId}
                                onChange={(e) => {
                                    setStatementId(e.target.value);
                                    switchContext(accountId, e.target.value);
                                }}
                                className="h-[34px] px-2.5 text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                            >
                                {reconciliation.statements.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.statement_date} — {s.filename} ({s.status})
                                    </option>
                                ))}
                            </select>
                        )}

                        {permissions.voucher_post && (
                            <Button size="sm" variant="default" onClick={() => setShowImport(true)}>
                                <Upload className="w-3.5 h-3.5 mr-1" />
                                {isBn ? 'CSV আমদানি করুন' : 'Import Statement CSV'}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Reconciliation Summary KPIs */}
                {reconciliation && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                            <div className="text-[12px] text-[#555555] dark:text-slate-400">
                                {isBn ? 'ব্যাংক স্টেটমেন্ট ব্যালেন্স' : 'Statement Closing Balance'}
                            </div>
                            <div className="mt-1 font-mono text-[20px] font-bold">
                                {formatPaisa(reconciliation.metrics.statement_closing_paisa)}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                            <div className="text-[12px] text-[#555555] dark:text-slate-400">
                                {isBn ? 'বইয়ের ব্যালেন্স (Book Balance)' : 'Ledger Book Balance'}
                            </div>
                            <div className="mt-1 font-mono text-[20px] font-bold text-[#0E5F3F]">
                                {formatPaisa(reconciliation.metrics.book_balance_paisa)}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                            <div className="text-[12px] text-[#555555] dark:text-slate-400">
                                {isBn ? 'পার্থক্য (Statement − Book)' : 'Difference (Statement − Book)'}
                            </div>
                            <div
                                className={`mt-1 font-mono text-[20px] font-bold ${
                                    reconciliation.metrics.raw_difference_paisa === 0 ? 'text-[#0E5F3F]' : 'text-[#D9534F]'
                                }`}
                            >
                                {formatPaisa(reconciliation.metrics.raw_difference_paisa)}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                            <div className="text-[12px] text-[#555555] dark:text-slate-400">
                                {isBn ? 'ম্যাচিং অবস্থা' : 'Match Status'}
                            </div>
                            <div className="mt-1 flex items-center gap-3 font-mono text-[16px] font-bold">
                                <span className="text-[#0E5F3F]">{reconciliation.metrics.matched_count} matched</span>
                                <span className="text-amber-700">{reconciliation.metrics.unmatched_count} unmatched</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Statement Lines Table */}
                <DataTable<ReconLine>
                    tableId="accounting-bank-recon-lines-table"
                    data={reconciliation?.lines ?? []}
                    columns={[
                        {
                            id: 'line_date',
                            label: 'Date',
                            render: (line) => (
                                <span className="font-mono whitespace-nowrap">{line.line_date}</span>
                            ),
                        },
                        {
                            id: 'description',
                            label: 'Reference & Description',
                            render: (line) => (
                                <div>
                                    <div className="font-medium">{line.description || '—'}</div>
                                    {line.reference && (
                                        <div className="font-mono text-[11px] text-[#666666]">
                                            Ref: {line.reference}
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                        {
                            id: 'debit_paisa',
                            label: 'Withdrawal (Dr)',
                            className: 'text-right',
                            render: (line) => (
                                <span className="font-mono text-[#D9534F] whitespace-nowrap">
                                    {line.debit_paisa > 0 ? formatPaisa(line.debit_paisa) : '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'credit_paisa',
                            label: 'Deposit (Cr)',
                            className: 'text-right',
                            render: (line) => (
                                <span className="font-mono text-[#0E5F3F] whitespace-nowrap">
                                    {line.credit_paisa > 0 ? formatPaisa(line.credit_paisa) : '—'}
                                </span>
                            ),
                        },
                        {
                            id: 'status',
                            label: 'Match',
                            render: (line) => {
                                const candidates = (reconciliation?.unmatched_book_lines ?? []).filter(
                                    (b) =>
                                        (line.credit_paisa > 0 && b.debit_paisa === line.credit_paisa) ||
                                        (line.debit_paisa > 0 && b.credit_paisa === line.debit_paisa)
                                );
                                if (line.status === 'matched') {
                                    return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 font-mono">
                                            {line.matched_voucher_number} ({line.match_method})
                                        </span>
                                    );
                                }
                                if (line.status === 'ignored') {
                                    return (
                                        <span className="px-2 py-0.5 text-[11px] rounded-[2px] bg-slate-100 text-[#666666]">
                                            Ignored
                                        </span>
                                    );
                                }
                                return (
                                    <select
                                        value={selectedMatch[line.id] ?? ''}
                                        onChange={(e) =>
                                            setSelectedMatch((prev) => ({
                                                ...prev,
                                                [line.id]: e.target.value,
                                            }))
                                        }
                                        className="h-[28px] max-w-[220px] px-1.5 text-[11.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25]"
                                    >
                                        <option value="">
                                            {candidates.length > 0
                                                ? `Select ledger match (${candidates.length})`
                                                : 'No exact-amount book match'}
                                        </option>
                                        {candidates.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.date} · {c.voucher_number} (
                                                {c.narration?.slice(0, 28)})
                                            </option>
                                        ))}
                                    </select>
                                );
                            },
                        },
                    ] as Column<ReconLine>[]}
                    keyExtractor={(line) => line.id}
                    searchPlaceholder="Search date, reference, or description..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex items-center justify-between pb-1.5">
                            <h2 className="text-[14px] font-bold">
                                {reconciliation?.active_statement
                                    ? `${reconciliation.active_statement.filename} (${reconciliation.active_statement.statement_date})`
                                    : isBn
                                      ? 'ব্যাংক স্টেটমেন্ট লাইনসমূহ'
                                      : 'Bank Statement Lines'}
                            </h2>
                            {reconciliation?.active_statement?.status === 'reconciled' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Reconciled
                                </span>
                            )}
                        </div>
                    }
                    actions={(line) =>
                        permissions.voucher_post ? (
                            <div className="inline-flex items-center gap-1">
                                {line.status === 'unmatched' && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="default"
                                            className="h-7 px-2 text-[11px]"
                                            disabled={!selectedMatch[line.id]}
                                            onClick={() => handleManualMatch(line.id)}
                                        >
                                            <Link2 className="w-3 h-3 mr-1" />
                                            Match
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-[11px]"
                                            onClick={() =>
                                                router.post(
                                                    route('accounting.bank-reconciliation.ignore', line.id),
                                                    {},
                                                    { preserveScroll: true }
                                                )
                                            }
                                        >
                                            Ignore
                                        </Button>
                                    </>
                                )}
                                {line.status === 'matched' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-[11px]"
                                        onClick={() =>
                                            router.post(
                                                route('accounting.bank-reconciliation.unmatch', line.id),
                                                {},
                                                { preserveScroll: true }
                                            )
                                        }
                                    >
                                        <Unlink className="w-3 h-3 mr-1" />
                                        Unmatch
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                        )
                    }
                    actionsColumnClassName="w-[140px] min-w-[140px]"
                    emptyState={
                        <EmptyState title='No bank statement imported for this account yet. Click "Import Statement CSV" to begin.' />
                    }
                />

                {/* Unmatched Book Entries (Timing Differences) */}
                {reconciliation && reconciliation.unmatched_book_lines.length > 0 && (
                    <DataTable
                        tableId="accounting-bank-recon-book-table"
                        data={reconciliation.unmatched_book_lines.slice(0, 50)}
                        columns={[
                            {
                                id: 'date',
                                label: 'Date',
                                render: (b) => <span className="font-mono whitespace-nowrap">{b.date}</span>,
                            },
                            {
                                id: 'voucher_number',
                                label: 'Voucher #',
                                render: (b) => (
                                    <span className="font-mono font-bold text-[#0E5F3F] whitespace-nowrap">
                                        {b.voucher_number}
                                    </span>
                                ),
                            },
                            {
                                id: 'narration',
                                label: 'Narration',
                                render: (b) => <span>{b.narration || '—'}</span>,
                            },
                            {
                                id: 'debit_paisa',
                                label: 'Book Deposit (Dr)',
                                className: 'text-right',
                                render: (b) => (
                                    <span className="font-mono text-[#0E5F3F] whitespace-nowrap">
                                        {b.debit_paisa > 0 ? formatPaisa(b.debit_paisa) : '—'}
                                    </span>
                                ),
                            },
                            {
                                id: 'credit_paisa',
                                label: 'Book Withdrawal (Cr)',
                                className: 'text-right',
                                render: (b) => (
                                    <span className="font-mono text-[#D9534F] whitespace-nowrap">
                                        {b.credit_paisa > 0 ? formatPaisa(b.credit_paisa) : '—'}
                                    </span>
                                ),
                            },
                        ] as Column<any>[]}
                        keyExtractor={(b) => b.id}
                        searchPlaceholder="Search unreconciled book entries..."
                        hideCheckbox
                        hideViewToggle
                        hideFilter
                        syncUrlParams={false}
                        headerTabs={
                            <h2 className="text-[14px] font-bold pb-1.5">
                                {isBn
                                    ? 'অমিল বইয়ের এন্ট্রি (Deposits in Transit / Outstanding Cheques)'
                                    : 'Unreconciled Book Entries (Deposits in Transit / Outstanding Cheques)'}
                            </h2>
                        }
                    />
                )}
            </div>

            {/* Import CSV Modal */}
            <BrtaFormModal
                open={showImport}
                onClose={() => setShowImport(false)}
                onSubmit={handleImport}
                title="Import Bank Statement CSV"
                icon={<Upload className="w-4 h-4" />}
                maxWidth="3xl"
                footerProps={{
                    cancelLabel: 'Cancel',
                    submitLabel: 'Import & Auto-Match',
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
                    <BrtaField label="Statement Date" required>
                        <input
                            type="date"
                            value={stmtDate}
                            onChange={(e) => setStmtDate(e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>
                    <BrtaField label="Opening Balance">
                        <input
                            type="text"
                            value={openingBal}
                            onChange={(e) => setOpeningBal(e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                    <BrtaField label="Closing Balance" required>
                        <input
                            type="text"
                            value={closingBal}
                            onChange={(e) => setClosingBal(e.target.value)}
                            placeholder="150000.00"
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>
                    <BrtaField label="CSV File">
                        <input
                            type="file"
                            accept=".csv,.txt"
                            onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                            className="w-full text-[12px]"
                        />
                    </BrtaField>
                </BrtaFormGrid>

                <BrtaField label="Or Paste CSV" alignTop hint="Format: date,reference,description,debit,credit">
                    <textarea
                        rows={4}
                        value={csvText}
                        onChange={(e) => setCsvText(e.target.value)}
                        placeholder={
                            'date,reference,description,debit,credit\n2026-11-20,TXN01,POS Bank Deposit,0,25000.00\n2026-11-22,CHQ12,Supplier Payment,12000.00,0'
                        }
                        className={`${brtaTextareaClass} font-mono text-[12px]`}
                    />
                </BrtaField>
            </BrtaFormModal>
        </AppLayout>
    );
}

