import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    Bell,
    CheckCircle2,
    Lock,
    ShieldAlert,
    ShieldCheck,
    User,
    XCircle,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column } from '@/Components/tables';
import PharmacistMobileNav from './components/PharmacistMobileNav';
import { PharmacistBranchContext, PrescriptionRecord } from './types';

interface VerifyProps {
    context: PharmacistBranchContext;
    prescription: PrescriptionRecord;
}

export default function VerifyPrescription({ context, prescription }: VerifyProps) {
    const [allergyConfirmed, setAllergyConfirmed] = useState(false);
    const [allergyNote, setAllergyNote] = useState('');
    const [controlledConfirmed, setControlledConfirmed] = useState(false);
    const [controlledRef, setControlledRef] = useState('');

    const [approveModalOpen, setApproveModalOpen] = useState(false);
    const [notifyModalOpen, setNotifyModalOpen] = useState(false);
    const [notifyNote, setNotifyNote] = useState(
        prescription.allergy_alert
            ? `Urgent clinical query: ${prescription.allergy_alert.offending_medicine} conflicts with patient ${prescription.allergy_alert.allergen} allergy. Please advise safe alternative.`
            : prescription.interaction_alert
              ? `Clinical review: ${prescription.interaction_alert.pair} interaction detected. Please confirm therapy & monitoring.`
              : 'Clinical clarification requested before dispensing.'
    );
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectError, setRejectError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const hasAllergyAlert = Boolean(prescription.allergy_alert);
    const hasInteractionAlert = Boolean(prescription.interaction_alert);
    const hasControlledDrug = prescription.medicines.some((m) => m.is_controlled);
    const hasExpiredBlocked = prescription.medicines.some((m) => m.is_expired_blocked);
    const isLocked = prescription.status !== 'waiting';

    const allergyCleared = !hasAllergyAlert || allergyConfirmed || prescription.doctor_notified;
    const controlledCleared = !hasControlledDrug || (controlledConfirmed && controlledRef.trim().length > 0);
    const canApprove = !isLocked && !hasExpiredBlocked && allergyCleared && controlledCleared;

    const handleApproveConfirm = () => {
        setProcessing(true);
        router.post(
            route('pharmacist.prescriptions.approve', prescription.id),
            {
                allergy_confirmed: allergyConfirmed || prescription.doctor_notified,
                allergy_override_note: allergyNote,
                controlled_confirmed: controlledConfirmed,
                controlled_register_ref: controlledRef,
            },
            {
                preserveScroll: true,
                onSuccess: () => setApproveModalOpen(false),
                onFinish: () => setProcessing(false),
            }
        );
    };

    const handleNotifySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        router.post(
            route('pharmacist.prescriptions.notify', prescription.id),
            { note: notifyNote },
            {
                preserveScroll: true,
                onSuccess: () => setNotifyModalOpen(false),
                onFinish: () => setProcessing(false),
            }
        );
    };

    const handleRejectSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (rejectReason.trim().length < 5) {
            setRejectError('Please enter a clear rejection reason (at least 5 characters).');
            return;
        }
        setRejectError(null);
        setProcessing(true);
        router.post(
            route('pharmacist.prescriptions.reject', prescription.id),
            { reason: rejectReason.trim() },
            {
                preserveScroll: true,
                onSuccess: () => setRejectModalOpen(false),
                onFinish: () => setProcessing(false),
            }
        );
    };

    return (
        <AppLayout title={`Verify ${prescription.rx_number}`}>
            <Head title={`Verify ${prescription.rx_number}`} />
            <PharmacistMobileNav currentPath="/pharmacist/prescriptions" />

            <div className="w-full space-y-4">
                {/* Top Navigation & Header */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <Link
                            href={route('dashboard')}
                            className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F5F7F4] dark:bg-slate-800 text-[#333333] dark:text-slate-200 hover:bg-slate-200/70"
                            title="Back to Pharmacist Dashboard"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                                    Verify Prescription
                                </h1>
                                <span className="font-mono text-[12.5px] font-bold px-2 py-0.5 rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    {prescription.rx_number}
                                </span>
                                {prescription.urgent && prescription.status === 'waiting' && (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#D9534F] text-white">
                                        Urgent
                                    </span>
                                )}
                                {prescription.status === 'dispensed' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#0E5F3F] text-white">
                                        <Lock className="w-3 h-3" />
                                        Dispensed & Locked
                                    </span>
                                )}
                                {prescription.status === 'rejected' && (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#D9534F] text-white">
                                        Rejected
                                    </span>
                                )}
                            </div>
                            <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                                {context.branch_name} (<span className="font-mono">{context.branch_code}</span>) • Received at{' '}
                                <span className="font-mono">{prescription.received_at}</span> ({prescription.waiting_label} waiting)
                            </p>
                        </div>
                    </div>

                    <Link
                        href={route('pharmacist.prescriptions')}
                        className="text-[12.5px] font-semibold text-[#0E5F3F] dark:text-emerald-400 hover:underline"
                    >
                        Back to Prescription Queue
                    </Link>
                </div>

                {/* Locked Immutable Dispensed Banner OR Rejected Banner */}
                {prescription.status === 'dispensed' && (
                    <div className="p-3.5 rounded-[2px] border border-[#0E5F3F]/30 bg-[#EAF5F0] dark:bg-emerald-950/30 dark:border-emerald-900 flex items-start gap-2.5">
                        <Lock className="w-5 h-5 text-[#0E5F3F] dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="text-[13px] text-[#1f3b2e] dark:text-emerald-200">
                            <div className="font-bold">
                                Dispensed and locked in immutable audit log — record cannot be edited.
                            </div>
                            <div className="text-[12px] mt-0.5">
                                Dispensed by <strong>{prescription.dispensed_by}</strong> on{' '}
                                <span className="font-mono">{prescription.dispensed_at}</span>
                                {prescription.controlled_register_ref && (
                                    <>
                                        {' '}• Controlled Register Ref:{' '}
                                        <span className="font-mono font-semibold">{prescription.controlled_register_ref}</span>
                                    </>
                                )}
                                . To fix any mistake, submit a{' '}
                                <Link
                                    href={route('pharmacist.returns')}
                                    className="font-semibold underline text-[#0E5F3F] dark:text-emerald-300"
                                >
                                    Return or correction entry
                                </Link>
                                .
                            </div>
                        </div>
                    </div>
                )}

                {prescription.status === 'rejected' && (
                    <div className="p-3.5 rounded-[2px] border border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 flex items-start gap-2.5">
                        <XCircle className="w-5 h-5 text-[#C9302C] dark:text-rose-400 shrink-0 mt-0.5" />
                        <div className="text-[13px] text-rose-900 dark:text-rose-200">
                            <div className="font-bold">Prescription Rejected</div>
                            <div className="text-[12.5px] mt-0.5">
                                Reason: <strong>{prescription.rejected_reason}</strong>
                                {prescription.rejected_by && (
                                    <span className="text-[11.5px] ml-2">
                                        (by {prescription.rejected_by} at <span className="font-mono">{prescription.rejected_at}</span>)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Patient Card: Name, Age/Sex, Doctor, Allergy in RED */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-[2px] bg-[#EAF5F0] dark:bg-emerald-950/50 border border-[#0E5F3F]/25 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-[#0E5F3F] dark:text-emerald-400" />
                        </div>
                        <div>
                            <div className="text-[11.5px] text-[#666666] dark:text-slate-400">Patient</div>
                            <div className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                {prescription.patient.name}
                            </div>
                            <div className="font-mono text-[12px] text-[#555555] dark:text-slate-400">
                                {prescription.patient.phone}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="text-[11.5px] text-[#666666] dark:text-slate-400">Age / Sex</div>
                        <div className="text-[14px] font-semibold text-[#222222] dark:text-white mt-0.5">
                            <span className="font-mono">{prescription.patient.age}</span> years / {prescription.patient.sex}
                        </div>
                    </div>

                    <div>
                        <div className="text-[11.5px] text-[#666666] dark:text-slate-400">Prescribing Doctor</div>
                        <div className="text-[13.5px] font-semibold text-[#222222] dark:text-white mt-0.5">
                            {prescription.doctor_name}
                        </div>
                        <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                            {prescription.department}
                        </div>
                    </div>

                    <div>
                        <div className="text-[11.5px] text-[#666666] dark:text-slate-400">Documented Allergy</div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {prescription.patient.allergies.length > 0 ? (
                                prescription.patient.allergies.map((allergy) => (
                                    <span
                                        key={allergy}
                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[12px] font-bold rounded-[2px] bg-[#D9534F] text-white"
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        {allergy}
                                    </span>
                                ))
                            ) : (
                                <span className="inline-flex items-center px-2 py-0.5 text-[12px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    No known drug allergy
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Red Alert: Allergy Conflict */}
                {prescription.allergy_alert && (
                    <div className="p-4 rounded-[2px] border-2 border-[#D9534F] bg-rose-50 dark:bg-rose-950/35 flex items-start gap-3">
                        <ShieldAlert className="w-5 h-5 text-[#C9302C] dark:text-rose-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <div className="text-[14px] font-bold text-[#B52B27] dark:text-rose-300">
                                Allergy Conflict Alert: {prescription.allergy_alert.allergen} allergy + {prescription.allergy_alert.offending_medicine}
                            </div>
                            <p className="text-[13px] text-rose-900 dark:text-rose-200 mt-1">
                                {prescription.allergy_alert.message}
                            </p>
                            {prescription.doctor_notified && (
                                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-white dark:bg-[#12161c] border border-emerald-300 dark:border-emerald-800 text-[12px] font-semibold text-[#0E5F3F] dark:text-emerald-300">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Doctor notified at <span className="font-mono">{prescription.doctor_notified_at}</span> — {prescription.doctor_notified_note}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Amber Alert: Drug-Drug Interaction */}
                {prescription.interaction_alert && (
                    <div className="p-4 rounded-[2px] border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/35 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <div className="text-[14px] font-bold text-amber-900 dark:text-amber-300">
                                Drug-Drug Interaction Alert ({prescription.interaction_alert.severity}): {prescription.interaction_alert.pair}
                            </div>
                            <p className="text-[13px] text-amber-950 dark:text-amber-200 mt-1">
                                {prescription.interaction_alert.message}
                            </p>
                        </div>
                    </div>
                )}

                {/* FEFO Expired Batch Auto-Skip Info */}
                {prescription.expired_skipped_note && (
                    <div className="px-3.5 py-2.5 rounded-[2px] border border-[#0E5F3F]/25 bg-[#EAF5F0]/70 dark:bg-emerald-950/20 dark:border-emerald-900 text-[12.5px] text-[#1f3b2e] dark:text-emerald-200 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#0E5F3F] shrink-0" />
                        <span>{prescription.expired_skipped_note}</span>
                    </div>
                )}

                {/* Medicines Table with Auto-FEFO Batch, Expiry & Check Tag */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h2 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                Prescribed medicines (FEFO auto-selected batches)
                            </h2>
                            <p className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                Earliest non-expired batch selected automatically • Expired batches are blocked from dispensing
                            </p>
                        </div>
                        <span className="font-mono text-[12px] font-semibold text-[#444444] dark:text-slate-300">
                            {prescription.medicines.length} item(s)
                        </span>
                    </div>

                    <DataTable
                        tableId="pharmacist-verify-medicines-table"
                        data={prescription.medicines}
                        columns={[
                            {
                                id: 'name',
                                label: 'Medicine',
                                render: (med) => (
                                    <div className="whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-[#222222] dark:text-white">
                                                {med.name}
                                            </span>
                                            {med.is_controlled && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-[2px] bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300">
                                                    Controlled
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                            {med.generic}
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                id: 'dose',
                                label: 'Dose',
                                render: (med) => (
                                    <span className="whitespace-nowrap text-[#333333] dark:text-slate-200">
                                        {med.dose}
                                    </span>
                                ),
                            },
                            {
                                id: 'duration',
                                label: 'Duration',
                                render: (med) => (
                                    <span className="whitespace-nowrap text-[#333333] dark:text-slate-200">
                                        {med.duration}
                                    </span>
                                ),
                            },
                            {
                                id: 'batch_number',
                                label: 'Batch (FEFO)',
                                render: (med) => (
                                    <span className="font-mono text-[12px] font-semibold px-2 py-0.5 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700 text-[#222222] dark:text-slate-200 whitespace-nowrap">
                                        {med.batch_number}
                                    </span>
                                ),
                            },
                            {
                                id: 'expiry_date',
                                label: 'Expiry Date',
                                render: (med) => (
                                    <span className="font-mono text-[12.5px] text-[#333333] dark:text-slate-200 whitespace-nowrap">
                                        {med.expiry_date}
                                    </span>
                                ),
                            },
                            {
                                id: 'stock_status',
                                label: 'Stock',
                                render: (med) =>
                                    med.stock_status === 'out_of_stock' ? (
                                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200 whitespace-nowrap">
                                            Out of stock
                                        </span>
                                    ) : med.stock_status === 'low' ? (
                                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                                            Low
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 whitespace-nowrap">
                                            In stock
                                        </span>
                                    ),
                            },
                            {
                                id: 'check_status',
                                label: 'Check',
                                className: 'text-right',
                                render: (med) =>
                                    med.is_expired_blocked ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-[2px] bg-[#D9534F] text-white whitespace-nowrap">
                                            <Lock className="w-3 h-3" />
                                            Expired
                                        </span>
                                    ) : med.check_status === 'allergy' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-[2px] bg-[#D9534F] text-white whitespace-nowrap">
                                            Allergy
                                        </span>
                                    ) : med.check_status === 'interaction' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-[2px] bg-amber-600 text-white whitespace-nowrap">
                                            Interaction
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-[2px] bg-[#0E5F3F] text-white whitespace-nowrap">
                                            OK
                                        </span>
                                    ),
                            },
                        ] as Column<any>[]}
                        keyExtractor={(med) => med.id}
                        hideToolbar
                        hidePagination
                        hideCheckbox
                        syncUrlParams={false}
                    />
                </div>

                {/* Mandatory Pharmacist Safety Confirmations (Allergy + Controlled Drug) */}
                {!isLocked && (hasAllergyAlert || hasControlledDrug) && (
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 space-y-3">
                        <h3 className="text-[13.5px] font-bold text-[#222222] dark:text-white">
                            Required clinical safety confirmation
                        </h3>

                        {hasAllergyAlert && !prescription.doctor_notified && (
                            <div className="p-3 rounded-[2px] border border-rose-200 bg-rose-50/70 dark:bg-rose-950/20 dark:border-rose-900 space-y-2">
                                <label className="flex items-start gap-2.5 cursor-pointer text-[13px] text-[#222222] dark:text-slate-100">
                                    <input
                                        type="checkbox"
                                        checked={allergyConfirmed}
                                        onChange={(e) => setAllergyConfirmed(e.target.checked)}
                                        className="table-checkbox mt-0.5 shrink-0"
                                    />
                                    <span>
                                        <strong>Allergy override confirmation:</strong> I have clinically verified this allergy alert with the prescribing doctor or patient record and take responsibility to proceed (or click <em>Notify doctor</em> below first).
                                    </span>
                                </label>
                                {allergyConfirmed && (
                                    <input
                                        type="text"
                                        value={allergyNote}
                                        onChange={(e) => setAllergyNote(e.target.value)}
                                        placeholder="Optional clinical note (e.g., doctor confirmed tolerance on call)"
                                        className="w-full h-[34px] px-3 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[12.5px] text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
                                    />
                                )}
                            </div>
                        )}

                        {hasControlledDrug && (
                            <div className="p-3 rounded-[2px] border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900 space-y-2">
                                <label className="flex items-start gap-2.5 cursor-pointer text-[13px] text-[#222222] dark:text-slate-100">
                                    <input
                                        type="checkbox"
                                        checked={controlledConfirmed}
                                        onChange={(e) => setControlledConfirmed(e.target.checked)}
                                        className="table-checkbox mt-0.5 shrink-0"
                                    />
                                    <span>
                                        <strong>Controlled drug extra confirmation:</strong> Physical prescription copy retained, patient ID verified, and Schedule-X cabinet quantity double-checked.
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    value={controlledRef}
                                    onChange={(e) => setControlledRef(e.target.value)}
                                    placeholder="Controlled drug register serial # (e.g. CTRL-2026-089)"
                                    className="w-full sm:w-[360px] h-[34px] px-3 font-mono rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[12.5px] text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Three Action Buttons: Approve & dispense (green), Notify doctor (blue), Reject (red) */}
                {!isLocked && (
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-[12px] text-[#555555] dark:text-slate-400">
                            {!allergyCleared ? (
                                <span className="text-[#C9302C] dark:text-rose-400 font-semibold">
                                    Approval locked: confirm the allergy alert or notify the doctor first.
                                </span>
                            ) : !controlledCleared ? (
                                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                    Approval locked: complete controlled drug confirmation & enter register serial #.
                                </span>
                            ) : (
                                <span>
                                    Approving creates an immutable dispense audit entry (who, when, FEFO batch).
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                type="button"
                                variant="default"
                                disabled={!canApprove || processing}
                                onClick={() => setApproveModalOpen(true)}
                            >
                                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                Approve & dispense
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                disabled={processing}
                                onClick={() => setNotifyModalOpen(true)}
                            >
                                <Bell className="w-4 h-4 mr-1.5" />
                                Notify doctor
                            </Button>

                            <Button
                                type="button"
                                variant="destructive"
                                disabled={processing}
                                onClick={() => setRejectModalOpen(true)}
                            >
                                <XCircle className="w-4 h-4 mr-1.5" />
                                Reject
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Approve & Dispense Confirmation Modal */}
            {approveModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white dark:bg-[#12161c] border border-[#CCCCCC] dark:border-slate-700 rounded-[4px] shadow-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22]">
                            <h3 className="text-[15px] font-bold text-[#222222] dark:text-white">
                                Confirm Approve & Dispense
                            </h3>
                        </div>
                        <div className="p-4 space-y-2.5 text-[13px] text-[#333333] dark:text-slate-200">
                            <p>
                                You are about to dispense <strong className="font-mono">{prescription.rx_number}</strong> for{' '}
                                <strong>{prescription.patient.name}</strong> ({prescription.medicines.length} item(s)) using the FEFO batches shown.
                            </p>
                            <p className="text-[12px] text-[#555555] dark:text-slate-400">
                                Once dispensed, this record is permanently logged in the audit trail and cannot be edited.
                            </p>
                        </div>
                        <div className="px-4 py-3 border-t border-[#D5DBD3] dark:border-slate-800 flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setApproveModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="button" variant="default" disabled={processing} onClick={handleApproveConfirm}>
                                {processing ? 'Saving...' : 'Confirm & Dispense'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notify Doctor Modal */}
            {notifyModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
                    <form
                        onSubmit={handleNotifySubmit}
                        className="w-full max-w-md bg-white dark:bg-[#12161c] border border-[#CCCCCC] dark:border-slate-700 rounded-[4px] shadow-xl overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22]">
                            <h3 className="text-[15px] font-bold text-[#222222] dark:text-white">
                                Notify Prescribing Doctor
                            </h3>
                        </div>
                        <div className="p-4 space-y-2.5 text-[13px]">
                            <div className="text-[#444444] dark:text-slate-300">
                                Recipient: <strong>{prescription.doctor_name}</strong>
                            </div>
                            <textarea
                                rows={3}
                                value={notifyNote}
                                onChange={(e) => setNotifyNote(e.target.value)}
                                className="w-full p-2.5 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[13px] text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
                                required
                            />
                        </div>
                        <div className="px-4 py-3 border-t border-[#D5DBD3] dark:border-slate-800 flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setNotifyModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="default" disabled={processing}>
                                {processing ? 'Sending...' : 'Send Notification'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Reject Prescription Modal (Reason Mandatory) */}
            {rejectModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
                    <form
                        onSubmit={handleRejectSubmit}
                        className="w-full max-w-md bg-white dark:bg-[#12161c] border border-[#CCCCCC] dark:border-slate-700 rounded-[4px] shadow-xl overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-rose-50 dark:bg-rose-950/30">
                            <h3 className="text-[15px] font-bold text-[#B52B27] dark:text-rose-300">
                                Reject Prescription ({prescription.rx_number})
                            </h3>
                        </div>
                        <div className="p-4 space-y-2.5 text-[13px]">
                            <label className="block font-semibold text-[#333333] dark:text-slate-200">
                                Rejection reason (required)
                            </label>
                            <textarea
                                rows={3}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="e.g., Documented Penicillin allergy conflict with prescribed Amoxicillin 500mg — returned to doctor for safe replacement."
                                className="w-full p-2.5 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[13px] text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#D9534F]"
                                required
                            />
                            {rejectError && (
                                <p className="text-[12px] text-[#C9302C] font-medium">{rejectError}</p>
                            )}
                        </div>
                        <div className="px-4 py-3 border-t border-[#D5DBD3] dark:border-slate-800 flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setRejectModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="destructive" disabled={processing}>
                                {processing ? 'Rejecting...' : 'Confirm Reject'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}
        </AppLayout>
    );
}
