import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Lock, Plus, RotateCcw, ShieldAlert } from 'lucide-react';
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
import PharmacistMobileNav from './components/PharmacistMobileNav';
import { PharmacistBranchContext, PrescriptionRecord } from './types';

interface ReturnEntry {
    id: string;
    rx_number: string;
    patient_name: string;
    medicine_name: string;
    batch_number: string;
    quantity: number;
    entry_type: 'patient_return' | 'correction_entry';
    reason: string;
    disposition: 'quarantine' | 'restock_unopened';
    logged_by: string;
    logged_at: string;
}

interface ReturnsProps {
    context: PharmacistBranchContext;
    entries: ReturnEntry[];
    dispensedOptions: PrescriptionRecord[];
}

export default function PharmacistReturns({ context, entries, dispensedOptions }: ReturnsProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [rxNumber, setRxNumber] = useState(dispensedOptions[0]?.rx_number ?? '');
    const [patientName, setPatientName] = useState(dispensedOptions[0]?.patient.name ?? '');
    const [medicineName, setMedicineName] = useState(dispensedOptions[0]?.medicines[0]?.name ?? '');
    const [batchNumber, setBatchNumber] = useState(dispensedOptions[0]?.medicines[0]?.batch_number ?? '');
    const [quantity, setQuantity] = useState('5');
    const [entryType, setEntryType] = useState<'patient_return' | 'correction_entry'>('patient_return');
    const [reason, setReason] = useState('Doctor changed regimen');
    const [disposition, setDisposition] = useState<'quarantine' | 'restock_unopened'>('quarantine');
    const [submitting, setSubmitting] = useState(false);

    const handleSelectDispensed = (rxNo: string) => {
        setRxNumber(rxNo);
        const match = dispensedOptions.find((r) => r.rx_number === rxNo);
        if (match) {
            setPatientName(match.patient.name);
            if (match.medicines[0]) {
                setMedicineName(match.medicines[0].name);
                setBatchNumber(match.medicines[0].batch_number);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        router.post(
            route('pharmacist.returns.store'),
            {
                rx_number: rxNumber,
                patient_name: patientName,
                medicine_name: medicineName,
                batch_number: batchNumber,
                quantity: Math.max(1, Number(quantity) || 1),
                entry_type: entryType,
                reason,
                disposition,
            },
            {
                preserveScroll: true,
                onSuccess: () => setModalOpen(false),
                onFinish: () => setSubmitting(false),
            }
        );
    };

    return (
        <AppLayout title="Returns & Corrections">
            <Head title="Returns & Corrections" />
            <PharmacistMobileNav />

            <div className="w-full space-y-4">
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            Returns & Dispense Correction Entries
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            {context.branch_name} (<span className="font-mono">{context.branch_code}</span>) • Dispensed records are locked — all mistakes & patient returns are logged here
                        </p>
                    </div>
                    <Button size="sm" variant="default" onClick={() => setModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-1.5" />
                        Log return / correction
                    </Button>
                </div>

                {/* Rule Reminder Banner */}
                <div className="p-3 rounded-[2px] border border-[#0E5F3F]/25 bg-[#EAF5F0] dark:bg-emerald-950/25 dark:border-emerald-900 flex items-center gap-2.5 text-[12.5px] text-[#1f3b2e] dark:text-emerald-200">
                    <Lock className="w-4 h-4 text-[#0E5F3F] shrink-0" />
                    <span>
                        <strong>Audit integrity rule:</strong> Original dispense records can never be edited or deleted. Every return or dispensing correction writes a new immutable audit log entry linked to the original Rx # and batch.
                    </span>
                </div>

                {/* Returns Ledger Table */}
                <DataTable<ReturnEntry>
                    tableId="pharmacist-returns-ledger-table"
                    data={entries}
                    columns={[
                        {
                            id: 'id',
                            label: 'Entry # / Rx #',
                            render: (e) => (
                                <div className="whitespace-nowrap">
                                    <div className="font-mono font-bold text-[#0E5F3F] dark:text-emerald-400">
                                        {e.id}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                        Ref: {e.rx_number}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'patient_name',
                            label: 'Patient',
                            render: (e) => (
                                <span className="font-semibold text-[#222222] dark:text-white whitespace-nowrap">
                                    {e.patient_name}
                                </span>
                            ),
                        },
                        {
                            id: 'medicine_name',
                            label: 'Medicine & Batch',
                            render: (e) => (
                                <div>
                                    <div className="font-medium text-[#222222] dark:text-slate-100">
                                        {e.medicine_name}
                                    </div>
                                    <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700">
                                        {e.batch_number}
                                    </span>
                                </div>
                            ),
                        },
                        {
                            id: 'quantity',
                            label: 'Qty',
                            className: 'text-right',
                            render: (e) => (
                                <span className="font-mono font-bold whitespace-nowrap">
                                    {e.quantity}
                                </span>
                            ),
                        },
                        {
                            id: 'entry_type',
                            label: 'Type & Reason',
                            render: (e) => (
                                <div className="max-w-[240px]">
                                    <span
                                        className={`inline-block px-1.5 py-0.2 text-[10.5px] font-semibold rounded-[2px] mb-0.5 ${
                                            e.entry_type === 'correction_entry'
                                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                                : 'bg-slate-100 text-[#333333] border border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                                        }`}
                                    >
                                        {e.entry_type === 'correction_entry'
                                            ? 'Correction entry'
                                            : 'Patient return'}
                                    </span>
                                    <div className="text-[12px] text-[#555555] dark:text-slate-400">
                                        {e.reason}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'disposition',
                            label: 'Disposition',
                            render: (e) =>
                                e.disposition === 'quarantine' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200 whitespace-nowrap">
                                        <ShieldAlert className="w-3 h-3" />
                                        Quarantined
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 whitespace-nowrap">
                                        Restock (Unopened)
                                    </span>
                                ),
                        },
                        {
                            id: 'logged_by',
                            label: 'Logged By',
                            className: 'text-right',
                            render: (e) => (
                                <div className="whitespace-nowrap">
                                    <div className="text-[12px] text-[#222222] dark:text-slate-200">
                                        {e.logged_by}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                        {e.logged_at}
                                    </div>
                                </div>
                            ),
                        },
                    ] as Column<ReturnEntry>[]}
                    keyExtractor={(e) => e.id}
                    searchPlaceholder="Search entry #, Rx #, patient, or medicine..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex items-center gap-2 pb-1.5">
                            <RotateCcw className="w-4 h-4 text-[#0E5F3F]" />
                            <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                Logged returns & correction entries (
                                <span className="font-mono">{entries.length}</span>)
                            </h2>
                        </div>
                    }
                    emptyState={
                        <EmptyState
                            icon={RotateCcw}
                            title="No return or correction entries logged yet."
                        />
                    }
                />
            </div>

            {/* Log Return / Correction Modal */}
            <BrtaFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
                title="Log Patient Return or Correction Entry"
                subtitle="Dispensed records are immutable — corrections are appended as audit entries"
                icon={<RotateCcw className="h-4 w-4" />}
                maxWidth="3xl"
                footerProps={{
                    submitLabel: 'Save Immutable Entry',
                    submitting,
                }}
            >
                <BrtaFormGrid>
                    <BrtaField label="Entry Type">
                        <select
                            value={entryType}
                            onChange={(e) => setEntryType(e.target.value as typeof entryType)}
                            className={brtaInputClass}
                        >
                            <option value="patient_return">Patient Return</option>
                            <option value="correction_entry">Dispensing Correction Entry</option>
                        </select>
                    </BrtaField>

                    <BrtaField label="Original Rx #" required>
                        <input
                            list="dispensed-rx-list"
                            value={rxNumber}
                            onChange={(e) => handleSelectDispensed(e.target.value)}
                            placeholder="RX-2026-0410"
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                        <datalist id="dispensed-rx-list">
                            {dispensedOptions.map((r) => (
                                <option key={r.id} value={r.rx_number}>
                                    {r.patient.name}
                                </option>
                            ))}
                        </datalist>
                    </BrtaField>

                    <BrtaField label="Patient Name" required>
                        <input
                            type="text"
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            className={brtaInputClass}
                            required
                        />
                    </BrtaField>

                    <BrtaField label="Medicine Name" required>
                        <input
                            type="text"
                            value={medicineName}
                            onChange={(e) => setMedicineName(e.target.value)}
                            className={brtaInputClass}
                            required
                        />
                    </BrtaField>

                    <BrtaField label="Batch #" required>
                        <input
                            type="text"
                            value={batchNumber}
                            onChange={(e) => setBatchNumber(e.target.value)}
                            placeholder="SQ-2504C"
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>

                    <BrtaField label="Quantity" required>
                        <input
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>

                    <BrtaField label="Disposition" className="md:col-span-2">
                        <select
                            value={disposition}
                            onChange={(e) => setDisposition(e.target.value as typeof disposition)}
                            className={brtaInputClass}
                        >
                            <option value="quarantine">Quarantine (Do not restock)</option>
                            <option value="restock_unopened">Restock (Unopened valid)</option>
                        </select>
                    </BrtaField>

                    <BrtaField label="Clinical Reason" required alignTop className="md:col-span-2">
                        <textarea
                            rows={2}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className={brtaTextareaClass}
                            required
                        />
                    </BrtaField>
                </BrtaFormGrid>
            </BrtaFormModal>
        </AppLayout>
    );
}

