import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    Lock,
    Pill,
    Printer,
    RotateCcw,
    ScanBarcode,
    ShieldCheck,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import PharmacistMobileNav from './components/PharmacistMobileNav';
import {
    ExpiringBatchItem,
    PharmacistAuditItem,
    PharmacistBranchContext,
    PrescriptionRecord,
} from './types';

interface DispensingProps {
    context: PharmacistBranchContext;
    summary: {
        waiting_count: number;
        dispensed_today: number;
        controlled_dispensed: number;
        expired_blocked_count: number;
    };
    waitingPrescriptions: PrescriptionRecord[];
    dispensedRecords: PrescriptionRecord[];
    expiredBlockedBatches: ExpiringBatchItem[];
    recentAuditLogs: PharmacistAuditItem[];
}

export default function PharmacistDispensing({
    context,
    summary,
    waitingPrescriptions,
    dispensedRecords,
    expiredBlockedBatches,
    recentAuditLogs,
}: DispensingProps) {
    const [batchInput, setBatchInput] = useState('');
    const [scanResult, setScanResult] = useState<{
        tone: 'ok' | 'blocked' | 'unknown';
        title: string;
        detail: string;
    } | null>(null);
    const [labelRx, setLabelRx] = useState<PrescriptionRecord | null>(null);

    const handleVerifyBatchScan = (e: React.FormEvent) => {
        e.preventDefault();
        const code = batchInput.trim().toUpperCase();
        if (!code) return;

        const expiredMatch = expiredBlockedBatches.find(
            (b) => b.batch_number.toUpperCase() === code
        );
        if (expiredMatch) {
            setScanResult({
                tone: 'blocked',
                title: `BLOCKED — Expired Batch (${expiredMatch.batch_number})`,
                detail: `${expiredMatch.medicine_name} expired on ${expiredMatch.expiry_date}. System has blocked this batch from dispensing automatically.`,
            });
            return;
        }

        for (const rx of [...waitingPrescriptions, ...dispensedRecords]) {
            const med = rx.medicines.find((m) => m.batch_number.toUpperCase() === code);
            if (med) {
                setScanResult({
                    tone: 'ok',
                    title: `Valid FEFO Batch Verified (${med.batch_number})`,
                    detail: `${med.name} (${med.generic}) • Expiry: ${med.expiry_date} • Linked to ${rx.rx_number} (${rx.patient.name}).`,
                });
                return;
            }
        }

        setScanResult({
            tone: 'unknown',
            title: `Batch ${code} not found in active dispense queue`,
            detail: 'Check the batch code on the medicine strip or verify against Stock & Expiry.',
        });
    };

    return (
        <AppLayout title="Dispensing">
            <Head title="Dispensing" />
            <PharmacistMobileNav />

            <div className="w-full space-y-4">
                {/* Header */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            Dispensing Workbench
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            {context.branch_name} (<span className="font-mono">{context.branch_code}</span>) • {context.today_display} • FEFO batch verification & immutable dispense log
                        </p>
                    </div>

                    {/* Quick Batch Barcode / Safety Checker */}
                    <form onSubmit={handleVerifyBatchScan} className="flex items-center gap-2 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-[290px]">
                            <ScanBarcode className="w-4 h-4 text-[#666666] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={batchInput}
                                onChange={(e) => setBatchInput(e.target.value)}
                                placeholder="Verify batch code (try SQ-2408B or BX-2506P)"
                                className="w-full h-[36px] pl-8 pr-3 font-mono text-[12.5px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[#222222] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
                            />
                        </div>
                        <Button type="submit" size="sm" variant="default">
                            Check batch
                        </Button>
                    </form>
                </div>

                {scanResult && (
                    <div
                        className={`p-3.5 rounded-[2px] border flex items-start justify-between gap-3 ${
                            scanResult.tone === 'blocked'
                                ? 'border-[#D9534F] bg-rose-50 dark:bg-rose-950/35 text-rose-900 dark:text-rose-200'
                                : scanResult.tone === 'ok'
                                  ? 'border-[#0E5F3F]/30 bg-[#EAF5F0] dark:bg-emerald-950/30 text-[#1f3b2e] dark:text-emerald-200'
                                  : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                        }`}
                    >
                        <div className="flex items-start gap-2.5">
                            {scanResult.tone === 'blocked' ? (
                                <AlertTriangle className="w-5 h-5 text-[#C9302C] shrink-0 mt-0.5" />
                            ) : (
                                <ShieldCheck className="w-5 h-5 text-[#0E5F3F] shrink-0 mt-0.5" />
                            )}
                            <div>
                                <div className="font-bold text-[13.5px]">{scanResult.title}</div>
                                <div className="text-[12.5px] mt-0.5">{scanResult.detail}</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setScanResult(null)}
                            className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* 4 KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            Waiting to dispense
                        </div>
                        <div className="mt-2 font-mono text-[26px] font-bold text-[#222222] dark:text-white leading-none">
                            {summary.waiting_count}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            Dispensed today
                        </div>
                        <div className="mt-2 font-mono text-[26px] font-bold text-[#0E5F3F] dark:text-emerald-400 leading-none">
                            {summary.dispensed_today}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            Controlled entries logged
                        </div>
                        <div className="mt-2 font-mono text-[26px] font-bold text-[#222222] dark:text-white leading-none">
                            {summary.controlled_dispensed}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            Expired batches auto-blocked
                        </div>
                        <div className="mt-2 font-mono text-[26px] font-bold text-[#C9302C] dark:text-rose-400 leading-none">
                            {summary.expired_blocked_count}
                        </div>
                    </div>
                </div>

                {/* Ready for Verification & Dispensing */}
                <DataTable<PrescriptionRecord>
                    tableId="pharmacist-dispensing-pending-table"
                    data={waitingPrescriptions}
                    columns={[
                        {
                            id: 'rx_number',
                            label: 'Rx #',
                            render: (rx) => (
                                <span className="font-mono font-bold text-[#0E5F3F] dark:text-emerald-400 whitespace-nowrap">
                                    {rx.rx_number}
                                </span>
                            ),
                        },
                        {
                            id: 'patient',
                            label: 'Patient',
                            render: (rx) => (
                                <div className="whitespace-nowrap">
                                    <div className="font-semibold text-[#222222] dark:text-white flex items-center gap-1.5">
                                        <span>{rx.patient.name}</span>
                                        {rx.urgent && (
                                            <span className="px-1.5 py-0.5 text-[10.5px] font-semibold rounded-[2px] bg-[#D9534F] text-white">
                                                Urgent
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {rx.doctor_name}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'medicines',
                            label: 'FEFO Batches Assigned',
                            sortable: false,
                            render: (rx) => (
                                <div className="flex flex-wrap gap-1.5">
                                    {rx.medicines.map((m) => (
                                        <span
                                            key={m.id}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11.5px] rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700"
                                        >
                                            <span>{m.name}</span>
                                            <span className="font-mono font-semibold text-[#0E5F3F] dark:text-emerald-400">
                                                {m.batch_number}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            ),
                        },
                        {
                            id: 'safety',
                            label: 'Safety Check',
                            sortable: false,
                            render: (rx) =>
                                rx.allergy_alert ? (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#D9534F] text-white whitespace-nowrap">
                                        Allergy alert
                                    </span>
                                ) : rx.interaction_alert ? (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-amber-600 text-white whitespace-nowrap">
                                        Interaction
                                    </span>
                                ) : rx.medicines.some((m) => m.is_controlled) ? (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-amber-50 text-amber-900 border border-amber-300 whitespace-nowrap">
                                        Controlled step
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 whitespace-nowrap">
                                        Ready
                                    </span>
                                ),
                        },
                    ] as Column<PrescriptionRecord>[]}
                    keyExtractor={(rx) => rx.id}
                    searchPlaceholder="Search pending Rx # or patient..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    hidePagination
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex items-center justify-between gap-2 pb-1.5">
                            <div className="flex items-center gap-2">
                                <ClipboardCheck className="w-4 h-4 text-[#0E5F3F]" />
                                <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                    Pending prescriptions ready for verification & dispensing
                                </h2>
                            </div>
                            <span className="font-mono text-[12px] text-[#555555] dark:text-slate-400">
                                {waitingPrescriptions.length} waiting
                            </span>
                        </div>
                    }
                    actions={(rx) => (
                        <Link href={route('pharmacist.prescriptions.verify', rx.id)}>
                            <Button size="sm" variant="default">
                                Verify & dispense
                            </Button>
                        </Link>
                    )}
                    actionsColumnClassName="w-[140px] min-w-[140px]"
                    emptyState={<EmptyState title="No pending prescriptions in queue." />}
                />

                {/* Immutable Dispensed Log (No Edit — Print Label or Log Return) */}
                <DataTable<PrescriptionRecord>
                    tableId="pharmacist-dispensed-register-table"
                    data={dispensedRecords}
                    columns={[
                        {
                            id: 'rx_number',
                            label: 'Rx #',
                            render: (rx) => (
                                <span className="font-mono font-bold text-[#222222] dark:text-white whitespace-nowrap">
                                    {rx.rx_number}
                                </span>
                            ),
                        },
                        {
                            id: 'patient',
                            label: 'Patient & Doctor',
                            render: (rx) => (
                                <div className="whitespace-nowrap">
                                    <div className="font-semibold text-[#222222] dark:text-white">
                                        {rx.patient.name}
                                    </div>
                                    <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {rx.doctor_name}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'medicines',
                            label: 'Dispensed Medicines & Batches',
                            sortable: false,
                            render: (rx) => (
                                <div className="space-y-1">
                                    {rx.medicines.map((m) => (
                                        <div
                                            key={m.id}
                                            className="text-[12px] flex items-center gap-1.5 flex-wrap"
                                        >
                                            <Pill className="w-3 h-3 text-[#0E5F3F] shrink-0" />
                                            <span className="font-medium text-[#222222] dark:text-slate-200">
                                                {m.name}
                                            </span>
                                            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700">
                                                {m.batch_number}
                                            </span>
                                            <span className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                                Exp {m.expiry_date}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ),
                        },
                        {
                            id: 'dispensed_at',
                            label: 'Dispensed By / When',
                            render: (rx) => (
                                <div className="whitespace-nowrap">
                                    <div className="font-medium text-[#222222] dark:text-slate-200">
                                        {rx.dispensed_by || context.pharmacist_name}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                        {rx.dispensed_at}
                                    </div>
                                </div>
                            ),
                        },
                    ] as Column<PrescriptionRecord>[]}
                    keyExtractor={(rx) => rx.id}
                    searchPlaceholder="Search dispensed Rx #, patient, or batch..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-1.5">
                            <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4 text-[#0E5F3F]" />
                                <div>
                                    <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                        Immutable dispensed register
                                    </h2>
                                    <p className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                        Locked after dispensing — mistakes must be corrected through Returns or a correction entry
                                    </p>
                                </div>
                            </div>
                            <Link
                                href={route('pharmacist.returns')}
                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0E5F3F] dark:text-emerald-400 hover:underline"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Open Returns & Corrections
                            </Link>
                        </div>
                    }
                    actions={(rx) => (
                        <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                <CheckCircle2 className="w-3 h-3" />
                                Locked
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => setLabelRx(rx)}
                            >
                                <Printer className="w-3 h-3 mr-1" />
                                Label
                            </Button>
                        </div>
                    )}
                    actionsColumnClassName="w-[155px] min-w-[155px]"
                    emptyState={<EmptyState title="No dispensed records yet." />}
                />

                {/* Recent Audit Entries */}
                {recentAuditLogs.length > 0 && (
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] font-bold text-[13.5px] text-[#222222] dark:text-white">
                            Audit trail (who, when, batch)
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {recentAuditLogs.map((log) => (
                                <div key={log.id} className="px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[12.5px]">
                                    <span className="text-[#222222] dark:text-slate-200">
                                        <strong className="text-[#0E5F3F] dark:text-emerald-400 mr-1.5">{log.user_name}:</strong>
                                        {log.description}
                                    </span>
                                    <span className="font-mono text-[11px] text-[#666666] dark:text-slate-400 shrink-0">
                                        {log.created_at}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Dosage Label Preview Modal */}
            {labelRx && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white dark:bg-[#12161c] border border-[#CCCCCC] dark:border-slate-700 rounded-[4px] shadow-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between">
                            <h3 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                Patient Dosage Label ({labelRx.rx_number})
                            </h3>
                            <button
                                type="button"
                                onClick={() => setLabelRx(null)}
                                className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3 text-[12.5px]">
                            <div className="p-3 rounded-[2px] border border-dashed border-[#0E5F3F]/50 bg-[#fafbfa] dark:bg-[#181d25] space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                                    <div>
                                        <div className="font-bold text-[#0E5F3F] dark:text-emerald-400">{context.tenant_name}</div>
                                        <div className="text-[11px] text-[#555555] dark:text-slate-400">{context.branch_name}</div>
                                    </div>
                                    <div className="text-right font-mono text-[11px] text-[#555555] dark:text-slate-400">
                                        <div>{labelRx.rx_number}</div>
                                        <div>{labelRx.dispensed_at}</div>
                                    </div>
                                </div>
                                <div className="text-[#222222] dark:text-slate-100">
                                    <strong>রোগী / Patient:</strong> {labelRx.patient.name} ({labelRx.patient.age}y {labelRx.patient.sex})
                                </div>
                                <div className="space-y-1.5 pt-1">
                                    {labelRx.medicines.map((m) => (
                                        <div key={m.id} className="p-2 rounded-[2px] bg-white dark:bg-[#12161c] border border-slate-200 dark:border-slate-700">
                                            <div className="font-bold text-[#222222] dark:text-white">{m.name}</div>
                                            <div className="text-[#0E5F3F] dark:text-emerald-400 font-semibold">
                                                সেবনবিধি / Dose: {m.dose} • {m.duration}
                                            </div>
                                            <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                                Batch: {m.batch_number} • Exp: {m.expiry_date}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[11px] text-[#666666] dark:text-slate-400 pt-1">
                                    শিশুদের নাগালের বাইরে রাখুন • ডাক্তারের পরামর্শ অনুযায়ী সেবন করুন।
                                </div>
                            </div>
                        </div>
                        <div className="px-4 py-3 border-t border-[#D5DBD3] dark:border-slate-800 flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setLabelRx(null)}>
                                Close
                            </Button>
                            <Button type="button" variant="default" onClick={() => window.print()}>
                                <Printer className="w-3.5 h-3.5 mr-1.5" />
                                Print Label
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

