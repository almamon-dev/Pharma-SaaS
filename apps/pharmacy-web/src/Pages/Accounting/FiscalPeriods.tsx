import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Lock, Unlock } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column } from '@/Components/tables';
import {
    BrtaField,
    BrtaFormModal,
    brtaTextareaClass,
} from '@/Components/ui/BrtaForm';
import AccountingNav from './components/AccountingNav';
import {
    AccountingPermissions,
    AccountingSettingsData,
    useAccountingLang,
} from './types';

interface PeriodItem {
    id: number;
    name: string;
    period_number: number;
    start_date: string;
    end_date: string;
    status: 'open' | 'closed';
    closed_at: string | null;
    closed_by: string | null;
    reopened_at: string | null;
    reopened_by: string | null;
}

interface FiscalYearItem {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    status: 'open' | 'closed';
    periods: PeriodItem[];
}

interface FiscalPeriodsProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    fiscalYears: FiscalYearItem[];
}

export default function FiscalPeriods({
    settings,
    permissions,
    fiscalYears,
}: FiscalPeriodsProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [reopenTarget, setReopenTarget] = useState<PeriodItem | null>(null);
    const [reopenReason, setReopenReason] = useState('');
    const [busy, setBusy] = useState(false);

    const handleClose = (period: PeriodItem) => {
        if (!window.confirm(`Close fiscal period ${period.name}? Posting into a closed period will be blocked.`)) {
            return;
        }
        router.post(route('accounting.periods.close', period.id), {}, { preserveScroll: true });
    };

    const handleReopenSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reopenTarget || reopenReason.trim().length < 4) return;
        setBusy(true);
        router.post(
            route('accounting.periods.reopen', reopenTarget.id),
            { reason: reopenReason.trim() },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setReopenTarget(null);
                    setReopenReason('');
                },
                onFinish: () => setBusy(false),
            }
        );
    };

    const handleCloseYear = (fy: FiscalYearItem) => {
        if (
            !window.confirm(
                `Perform Year-End Close for ${fy.name}? This transfers Net Profit/Loss to Retained Earnings (3020) and locks all periods in ${fy.name}.`
            )
        ) {
            return;
        }
        router.post(route('accounting.fiscal-years.close', fy.id), {}, { preserveScroll: true });
    };

    return (
        <AppLayout title={isBn ? 'আর্থিক সময়কাল' : 'Fiscal Periods'}>
            <Head title="Fiscal Periods" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="periods"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                {fiscalYears.map((fy) => (
                    <DataTable<PeriodItem>
                        key={fy.id}
                        tableId={`accounting-fiscal-periods-${fy.id}`}
                        data={fy.periods}
                        columns={[
                            {
                                id: 'period_number',
                                label: '#',
                                render: (p) => (
                                    <span className="font-mono text-[#666666]">{p.period_number}</span>
                                ),
                            },
                            {
                                id: 'name',
                                label: 'Period',
                                render: (p) => (
                                    <span className="font-semibold text-[#222222] dark:text-white whitespace-nowrap">
                                        {p.name}
                                    </span>
                                ),
                            },
                            {
                                id: 'start_date',
                                label: 'Date Range',
                                render: (p) => (
                                    <span className="font-mono text-[12px] whitespace-nowrap">
                                        {p.start_date} → {p.end_date}
                                    </span>
                                ),
                            },
                            {
                                id: 'status',
                                label: 'Status',
                                render: (p) =>
                                    p.status === 'closed' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200">
                                            <Lock className="w-3 h-3" />
                                            Closed
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                            <Unlock className="w-3 h-3" />
                                            Open
                                        </span>
                                    ),
                            },
                            {
                                id: 'closed_at',
                                label: 'Audit Note',
                                render: (p) => (
                                    <span className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                        {p.status === 'closed' && p.closed_at
                                            ? `Closed by ${p.closed_by ?? 'User'} (${p.closed_at})`
                                            : p.reopened_at
                                              ? `Reopened by ${p.reopened_by ?? 'User'} (${p.reopened_at})`
                                              : 'Accepting postings'}
                                    </span>
                                ),
                            },
                        ] as Column<PeriodItem>[]}
                        keyExtractor={(p) => p.id}
                        hideToolbar
                        hidePagination
                        hideCheckbox
                        syncUrlParams={false}
                        headerTabs={
                            <div className="flex items-center justify-between flex-wrap gap-2 pb-1.5">
                                <div>
                                    <h2 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                        {fy.name}
                                    </h2>
                                    <p className="font-mono text-[11.5px] text-[#555555] dark:text-slate-400">
                                        {fy.start_date} → {fy.end_date}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-[2px] ${
                                            fy.status === 'closed'
                                                ? 'bg-rose-50 text-[#C9302C] border border-rose-200'
                                                : 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25'
                                        }`}
                                    >
                                        {fy.status === 'closed' ? 'Closed' : 'Open'}
                                    </span>
                                    {fy.status === 'open' && permissions.period_close && (
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="h-7 px-2.5 text-[11.5px]"
                                            onClick={() => handleCloseYear(fy)}
                                        >
                                            Year-end close (Transfer to Retained Earnings)
                                        </Button>
                                    )}
                                </div>
                            </div>
                        }
                        actions={(p) => (
                            <div className="inline-flex items-center justify-end gap-1.5">
                                {p.status === 'open' && permissions.period_close && (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 px-2.5 text-[11.5px]"
                                        onClick={() => handleClose(p)}
                                    >
                                        Close period
                                    </Button>
                                )}
                                {p.status === 'closed' && permissions.period_reopen && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2.5 text-[11.5px]"
                                        onClick={() => setReopenTarget(p)}
                                    >
                                        Reopen period
                                    </Button>
                                )}
                            </div>
                        )}
                        actionsColumnClassName="w-[130px] min-w-[130px]"
                    />
                ))}
            </div>

            <BrtaFormModal
                open={Boolean(reopenTarget)}
                onClose={() => setReopenTarget(null)}
                onSubmit={handleReopenSubmit}
                title={reopenTarget ? `Reopen ${reopenTarget.name}` : 'Reopen Fiscal Period'}
                subtitle="Reopening a closed fiscal period is recorded in the audit log"
                icon={<Unlock className="h-4 w-4" />}
                maxWidth="xl"
                footerProps={{
                    submitLabel: 'Confirm Reopen',
                    submitting: busy,
                }}
            >
                <BrtaField label="Reopening Reason" required alignTop>
                    <textarea
                        rows={3}
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        placeholder="Reason for reopening (required)"
                        className={brtaTextareaClass}
                        required
                        minLength={4}
                    />
                </BrtaField>
            </BrtaFormModal>
        </AppLayout>
    );
}

