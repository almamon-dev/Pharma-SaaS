import { useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import AccountingNav from './components/AccountingNav';
import {
    AccountingPermissions,
    AccountingSettingsData,
    useAccountingLang,
} from './types';

interface PostingErrorRow {
    id: number;
    source_module: string;
    source_id: string;
    source_event: string;
    branch_name: string;
    error: string;
    retry_count: number;
    status: 'pending' | 'resolved' | 'ignored';
    resolved_voucher_number: string | null;
    created_at: string | null;
    last_retried_at: string | null;
}

interface PostingErrorsProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    statusFilter: string;
    errorsList: PostingErrorRow[];
}

export default function PostingErrors({ settings, permissions, statusFilter, errorsList }: PostingErrorsProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const columns: Column<PostingErrorRow>[] = useMemo(
        () => [
            {
                id: 'source_module',
                label: 'Source',
                render: (err) => (
                    <div className="whitespace-nowrap">
                        <div className="font-mono font-bold text-[12px]">
                            {err.source_module}:{err.source_id}
                        </div>
                        <div className="text-[11px] text-[#666666]">
                            {err.source_event} · {err.branch_name}
                        </div>
                    </div>
                ),
            },
            {
                id: 'error',
                label: 'Error Message',
                render: (err) => (
                    <div className="flex items-start gap-1.5 text-[#C9302C] dark:text-rose-400">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{err.error}</span>
                    </div>
                ),
            },
            {
                id: 'retry_count',
                label: 'Retries',
                className: 'text-center',
                render: (err) => <span className="font-mono">{err.retry_count}</span>,
            },
            {
                id: 'status',
                label: 'Status',
                render: (err) => (
                    <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-[2px] capitalize whitespace-nowrap ${
                            err.status === 'resolved'
                                ? 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25'
                                : err.status === 'pending'
                                  ? 'bg-rose-50 text-[#C9302C] border border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                    >
                        {err.status}
                        {err.resolved_voucher_number ? ` (${err.resolved_voucher_number})` : ''}
                    </span>
                ),
            },
        ],
        []
    );

    const switchStatus = (st: string) => {
        router.get(route('accounting.posting-errors.index'), { status: st }, { preserveState: true, replace: true });
    };

    const handleRetry = (id: number) => {
        router.post(route('accounting.posting-errors.retry', id), {}, { preserveScroll: true });
    };

    const handleIgnore = (id: number) => {
        if (!window.confirm('Mark this posting error as ignored?')) return;
        router.post(route('accounting.posting-errors.ignore', id), {}, { preserveScroll: true });
    };

    return (
        <AppLayout title={isBn ? 'অটো-পোস্টিং ত্রুটি' : 'Auto-Posting Errors'}>
            <Head title="Auto-Posting Errors" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="posting-errors"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            {isBn ? 'অটো-পোস্টিং ত্রুটি ও পুনঃচেষ্টা' : 'Auto-Posting Errors Queue'}
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            Failed postings from Sales, Purchasing, Inventory, or Payroll are captured here without blocking source documents.
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {['pending', 'resolved', 'ignored', 'all'].map((st) => (
                            <button
                                key={st}
                                type="button"
                                onClick={() => switchStatus(st)}
                                className={`px-2.5 py-1 text-[12px] font-semibold rounded-[2px] capitalize cursor-pointer ${
                                    statusFilter === st
                                        ? 'bg-[#0E5F3F] text-white'
                                        : 'bg-[#F5F7F4] dark:bg-slate-800 text-[#444444] dark:text-slate-300 border border-[#D5DBD3] dark:border-slate-700'
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                </div>

                <DataTable<PostingErrorRow>
                    tableId="accounting-posting-errors-table"
                    data={errorsList}
                    columns={columns}
                    keyExtractor={(err) => err.id}
                    searchPlaceholder="Search module, source ID, or error..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    actions={(err) =>
                        err.status === 'pending' ? (
                            <div className="inline-flex items-center gap-1.5">
                                <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => handleRetry(err.id)}
                                >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Retry
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => handleIgnore(err.id)}
                                >
                                    Ignore
                                </Button>
                            </div>
                        ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                        )
                    }
                    actionsColumnClassName="w-[150px] min-w-[150px]"
                    emptyState={
                        <EmptyState
                            icon={CheckCircle2}
                            title="No posting errors in this queue."
                        />
                    }
                />
            </div>
        </AppLayout>
    );
}

