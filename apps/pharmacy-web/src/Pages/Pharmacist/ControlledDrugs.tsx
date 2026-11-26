import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { CheckCircle2, Lock, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column } from '@/Components/tables';
import {
    BrtaField,
    BrtaFormGrid,
    BrtaFormModal,
    brtaInputClass,
} from '@/Components/ui/BrtaForm';
import PharmacistMobileNav from './components/PharmacistMobileNav';
import { PharmacistBranchContext } from './types';

interface CabinetItem {
    id: string;
    medicine_name: string;
    generic_name: string;
    batch_number: string;
    expiry_date: string;
    opening_qty: number;
    dispensed_today: number;
    closing_qty: number;
    unit: string;
    physical_matched: boolean;
    last_verified_at: string;
}

interface ControlledEntry {
    id: string;
    register_serial: string;
    medicine_name: string;
    generic_name: string;
    batch_number: string;
    rx_number: string;
    patient_name: string;
    doctor_name: string;
    opening_qty: number;
    change_qty: number;
    closing_qty: number;
    pharmacist: string;
    logged_at: string;
    verified: boolean;
}

interface ControlledDrugsProps {
    context: PharmacistBranchContext;
    cabinetBalances: CabinetItem[];
    entries: ControlledEntry[];
    lastReconciledAt: string;
    lastReconciledBy: string;
}

export default function PharmacistControlledDrugs({
    context,
    cabinetBalances,
    entries,
    lastReconciledAt,
    lastReconciledBy,
}: ControlledDrugsProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [cabinetId, setCabinetId] = useState(cabinetBalances[0]?.id ?? '');
    const [registerSerial, setRegisterSerial] = useState(`CTRL-2026-0${89 + entries.length}`);
    const [rxNumber, setRxNumber] = useState('');
    const [patientName, setPatientName] = useState('');
    const [doctorName, setDoctorName] = useState('');
    const [quantity, setQuantity] = useState('2');
    const [confirmed, setConfirmed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reconciling, setReconciling] = useState(false);

    const totalDispensedToday = cabinetBalances.reduce((sum, c) => sum + c.dispensed_today, 0);
    const allMatched = cabinetBalances.every((c) => c.physical_matched);

    const handleReconcile = () => {
        setReconciling(true);
        router.post(
            route('pharmacist.controlled-drugs.reconcile'),
            {},
            {
                preserveScroll: true,
                onFinish: () => setReconciling(false),
            }
        );
    };

    const handleLogEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmed) return;
        setSubmitting(true);
        router.post(
            route('pharmacist.controlled-drugs.entry'),
            {
                cabinet_id: cabinetId,
                register_serial: registerSerial,
                rx_number: rxNumber,
                patient_name: patientName,
                doctor_name: doctorName,
                quantity: Math.max(1, Number(quantity) || 1),
                confirmed,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setModalOpen(false);
                    setRxNumber('');
                    setPatientName('');
                    setDoctorName('');
                    setQuantity('2');
                    setConfirmed(false);
                },
                onFinish: () => setSubmitting(false),
            }
        );
    };

    return (
        <AppLayout title="Controlled Drugs Log">
            <Head title="Controlled Drugs Log" />
            <PharmacistMobileNav />

            <div className="w-full space-y-4">
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                                Controlled Drugs Log (Narcotics / Schedule-X)
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                {allMatched ? 'Cabinet count matched' : 'Verification needed'}
                            </span>
                        </div>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            {context.branch_name} (<span className="font-mono">{context.branch_code}</span>) • Last physical verification: <span className="font-mono">{lastReconciledAt}</span> ({lastReconciledBy})
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" disabled={reconciling} onClick={handleReconcile}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            {reconciling ? 'Verifying...' : 'Verify cabinet count'}
                        </Button>
                        <Button size="sm" variant="default" onClick={() => setModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-1.5" />
                            Log controlled dispense
                        </Button>
                    </div>
                </div>

                {/* 4 KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            Tracked controlled drugs
                        </div>
                        <div className="mt-2 font-mono text-[26px] font-bold text-[#222222] dark:text-white leading-none">
                            {cabinetBalances.length}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            Units dispensed today
                        </div>
                        <div className="mt-2 font-mono text-[26px] font-bold text-[#222222] dark:text-white leading-none">
                            {totalDispensedToday}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            Register entries
                        </div>
                        <div className="mt-2 font-mono text-[26px] font-bold text-[#0E5F3F] dark:text-emerald-400 leading-none">
                            {entries.length}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            Shift cabinet check
                        </div>
                        <div className="mt-2 text-[16px] font-bold text-[#0E5F3F] dark:text-emerald-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-5 h-5" />
                            <span>Matched</span>
                        </div>
                    </div>
                </div>

                {/* Cabinet Shift Balance Table */}
                <DataTable<CabinetItem>
                    tableId="pharmacist-controlled-cabinet-table"
                    data={cabinetBalances}
                    columns={[
                        {
                            id: 'medicine_name',
                            label: 'Controlled Medicine',
                            render: (c) => (
                                <div>
                                    <div className="font-semibold text-[#222222] dark:text-white">
                                        {c.medicine_name}
                                    </div>
                                    <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {c.generic_name}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'batch_number',
                            label: 'Batch # & Expiry',
                            render: (c) => (
                                <div className="whitespace-nowrap">
                                    <span className="font-mono text-[12px] font-semibold px-2 py-0.5 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700">
                                        {c.batch_number}
                                    </span>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400 mt-0.5">
                                        Exp: {c.expiry_date}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'opening_qty',
                            label: 'Opening',
                            className: 'text-right',
                            render: (c) => (
                                <span className="font-mono whitespace-nowrap">
                                    {c.opening_qty} {c.unit}
                                </span>
                            ),
                        },
                        {
                            id: 'dispensed_today',
                            label: 'Dispensed',
                            className: 'text-right',
                            render: (c) => (
                                <span className="font-mono text-[#C9302C] dark:text-rose-400">
                                    -{c.dispensed_today}
                                </span>
                            ),
                        },
                        {
                            id: 'closing_qty',
                            label: 'Closing Balance',
                            className: 'text-right',
                            render: (c) => (
                                <span className="font-mono font-bold text-[#222222] dark:text-white whitespace-nowrap">
                                    {c.closing_qty} {c.unit}
                                </span>
                            ),
                        },
                        {
                            id: 'last_verified_at',
                            label: 'Physical Check',
                            className: 'text-right',
                            render: (c) => (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 whitespace-nowrap">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Matched ({c.last_verified_at})
                                </span>
                            ),
                        },
                    ] as Column<CabinetItem>[]}
                    keyExtractor={(c) => c.id}
                    hideToolbar
                    hidePagination
                    hideCheckbox
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex items-center gap-2 pb-1.5">
                            <ShieldAlert className="w-4 h-4 text-[#0E5F3F]" />
                            <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                Shift Schedule-X / Controlled Cabinet Reconciliation
                            </h2>
                        </div>
                    }
                />

                {/* Immutable Controlled Drug Register */}
                <DataTable<ControlledEntry>
                    tableId="pharmacist-controlled-register-table"
                    data={entries}
                    columns={[
                        {
                            id: 'register_serial',
                            label: 'Register Serial #',
                            render: (entry) => (
                                <span className="font-mono font-bold text-[#0E5F3F] dark:text-emerald-400 whitespace-nowrap">
                                    {entry.register_serial}
                                </span>
                            ),
                        },
                        {
                            id: 'medicine_name',
                            label: 'Medicine & Batch',
                            render: (entry) => (
                                <div>
                                    <div className="font-semibold text-[#222222] dark:text-white">
                                        {entry.medicine_name}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                        Batch: {entry.batch_number}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'patient_name',
                            label: 'Patient / Doctor / Rx',
                            render: (entry) => (
                                <div>
                                    <div className="font-medium text-[#222222] dark:text-slate-100">
                                        {entry.patient_name}{' '}
                                        <span className="font-mono text-[11.5px] text-[#0E5F3F] dark:text-emerald-400">
                                            ({entry.rx_number})
                                        </span>
                                    </div>
                                    <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {entry.doctor_name}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'closing_qty',
                            label: 'Balance (Open → Close)',
                            className: 'text-right',
                            render: (entry) => (
                                <span className="font-mono whitespace-nowrap">
                                    <span>{entry.opening_qty}</span>
                                    <span className="text-[#C9302C] font-bold mx-1.5">
                                        ({entry.change_qty})
                                    </span>
                                    <span>→</span>
                                    <strong className="ml-1.5 text-[#222222] dark:text-white">
                                        {entry.closing_qty}
                                    </strong>
                                </span>
                            ),
                        },
                        {
                            id: 'logged_at',
                            label: 'Pharmacist & Time',
                            className: 'text-right',
                            render: (entry) => (
                                <div className="whitespace-nowrap">
                                    <div className="text-[12px] text-[#222222] dark:text-slate-200">
                                        {entry.pharmacist}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                        {entry.logged_at}
                                    </div>
                                </div>
                            ),
                        },
                    ] as Column<ControlledEntry>[]}
                    keyExtractor={(entry) => entry.id}
                    searchPlaceholder="Search serial #, medicine, patient, or Rx #..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex items-center gap-2 pb-1.5">
                            <Lock className="w-4 h-4 text-[#0E5F3F]" />
                            <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                Immutable Controlled Substance Register
                            </h2>
                        </div>
                    }
                />
            </div>

            {/* Extra-Confirmation Controlled Drug Entry Modal */}
            <BrtaFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleLogEntry}
                title="Log Controlled Drug Dispense"
                subtitle="Double verification required — Schedule-X / Narcotic register entry"
                icon={<ShieldAlert className="h-4 w-4 text-amber-600" />}
                maxWidth="3xl"
                footerProps={{
                    submitLabel: 'Confirm & Log Entry',
                    submitting,
                    submitDisabled: !confirmed,
                }}
            >
                <BrtaFormGrid>
                    <BrtaField label="Controlled Medicine" required>
                        <select
                            value={cabinetId}
                            onChange={(e) => setCabinetId(e.target.value)}
                            className={brtaInputClass}
                        >
                            {cabinetBalances.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.medicine_name} (Bal: {c.closing_qty})
                                </option>
                            ))}
                        </select>
                    </BrtaField>

                    <BrtaField label="Register Serial #" required>
                        <input
                            type="text"
                            value={registerSerial}
                            onChange={(e) => setRegisterSerial(e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>

                    <BrtaField label="Rx / Ward Order #" required>
                        <input
                            type="text"
                            value={rxNumber}
                            onChange={(e) => setRxNumber(e.target.value)}
                            placeholder="RX-2026-0415"
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>

                    <BrtaField label="Patient / Ward" required>
                        <input
                            type="text"
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            placeholder="Patient name"
                            className={brtaInputClass}
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

                    <BrtaField label="Prescribing Doctor" required>
                        <input
                            type="text"
                            value={doctorName}
                            onChange={(e) => setDoctorName(e.target.value)}
                            placeholder="e.g. Dr. Rezaul Karim (Surgery)"
                            className={brtaInputClass}
                            required
                        />
                    </BrtaField>
                </BrtaFormGrid>

                <label className="flex items-start gap-2.5 p-3 rounded-[2px] border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 cursor-pointer text-[12.5px]">
                    <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="table-checkbox mt-0.5 shrink-0"
                        required
                    />
                    <span>
                        <strong>Extra confirmation step:</strong> I confirm the physical signed
                        prescription is retained, patient identity is verified, and the Schedule-X
                        cabinet balance matches.
                    </span>
                </label>
            </BrtaFormModal>
        </AppLayout>
    );
}

