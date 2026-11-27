import React, { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, Pill, Plus, Search, Stethoscope, User } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { AnimatedSearchInput } from '@/Components/ui/AnimatedSearchInput';
import PharmacistMobileNav from './components/PharmacistMobileNav';
import { PharmacistBranchContext, PrescriptionMedicineItem } from './types';

interface PatientProfile {
    key: string;
    name: string;
    age: number | null;
    sex: string;
    phone: string;
    allergies: string[];
    chronic_conditions: string[];
    prescriptions: Array<{
        id: string;
        rx_number: string;
        date: string;
        doctor_name: string;
        status: string;
        medicines: PrescriptionMedicineItem[];
    }>;
}

interface PatientHistoryProps {
    context: PharmacistBranchContext;
    patients: PatientProfile[];
}

export default function PharmacistPatientHistory({ context, patients }: PatientHistoryProps) {
    const [search, setSearch] = useState('');
    const [selectedKey, setSelectedKey] = useState<string>(patients[0]?.key ?? '');
    const [newAllergy, setNewAllergy] = useState('');
    const [savingAllergy, setSavingAllergy] = useState(false);

    const filteredPatients = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return patients;
        return patients.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.phone.toLowerCase().includes(q) ||
                p.allergies.some((a) => a.toLowerCase().includes(q))
        );
    }, [patients, search]);

    const selectedPatient =
        patients.find((p) => p.key === selectedKey) ?? filteredPatients[0] ?? null;

    const handleAddAllergy = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient || newAllergy.trim().length < 2) return;
        setSavingAllergy(true);
        router.post(
            route('pharmacist.patients.allergy'),
            {
                patient_key: selectedPatient.key,
                patient_name: selectedPatient.name,
                allergy: newAllergy.trim(),
            },
            {
                preserveScroll: true,
                onSuccess: () => setNewAllergy(''),
                onFinish: () => setSavingAllergy(false),
            }
        );
    };

    return (
        <AppLayout title="Patient Medication History">
            <Head title="Patient Medication History" />
            <PharmacistMobileNav />

            <div className="w-full space-y-4">
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            Patient Medication History & Allergy Register
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            {context.branch_name} (<span className="font-mono">{context.branch_code}</span>) • Documented allergies sync automatically to prescription verification
                        </p>
                    </div>
                    <div className="relative w-full md:w-[300px]">
                        <AnimatedSearchInput
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholders={[
                                'Search by patient name...',
                                'Search by phone number...',
                                'Search by documented allergy...',
                            ]}
                            icon={<Search className="w-4 h-4" />}
                            wrapperClassName="h-[36px] rounded-[4px]"
                            className="h-[36px] rounded-[4px] text-[13px] pl-9 pr-3"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Left: Patient List */}
                    <div className="lg:col-span-4 bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between text-[13px] font-bold text-[#222222] dark:text-white">
                            <span>Patients ({filteredPatients.length})</span>
                            <Stethoscope className="w-4 h-4 text-[#0E5F3F]" />
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[560px] overflow-y-auto">
                            {filteredPatients.length === 0 ? (
                                <div className="p-4 text-[12.5px] text-[#666666] text-center">
                                    No patients found.
                                </div>
                            ) : (
                                filteredPatients.map((p) => {
                                    const isActive = selectedPatient?.key === p.key;
                                    return (
                                        <button
                                            key={p.key}
                                            type="button"
                                            onClick={() => setSelectedKey(p.key)}
                                            className={`w-full text-left px-3.5 py-2.5 transition-colors cursor-pointer ${
                                                isActive
                                                    ? 'bg-[#EAF5F0] dark:bg-[#0E5F3F]/20 border-l-3 border-l-[#0E5F3F]'
                                                    : 'hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold text-[13px] text-[#222222] dark:text-white truncate">
                                                    {p.name}
                                                </span>
                                                <span className="font-mono text-[11px] text-[#666666] dark:text-slate-400 shrink-0">
                                                    {p.prescriptions.length} Rx
                                                </span>
                                            </div>
                                            <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400 mt-0.5">
                                                {p.phone}
                                                {p.age ? ` · ${p.age}y ${p.sex}` : ''}
                                            </div>
                                            {p.allergies.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {p.allergies.map((a) => (
                                                        <span
                                                            key={a}
                                                            className="px-1.5 py-0.2 text-[10px] font-bold rounded-[2px] bg-[#D9534F] text-white"
                                                        >
                                                            Allergy: {a}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Selected Patient Clinical Profile & History */}
                    <div className="lg:col-span-8 space-y-4">
                        {selectedPatient ? (
                            <>
                                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-[2px] bg-[#EAF5F0] dark:bg-emerald-950/50 border border-[#0E5F3F]/25 flex items-center justify-center shrink-0">
                                                <User className="w-5 h-5 text-[#0E5F3F] dark:text-emerald-400" />
                                            </div>
                                            <div>
                                                <h2 className="text-[16px] font-bold text-[#222222] dark:text-white">
                                                    {selectedPatient.name}
                                                </h2>
                                                <div className="text-[12.5px] text-[#555555] dark:text-slate-400">
                                                    {selectedPatient.age ? `${selectedPatient.age} years / ` : ''}
                                                    {selectedPatient.sex} •{' '}
                                                    <span className="font-mono">{selectedPatient.phone}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                    {selectedPatient.chronic_conditions.map((c) => (
                                                        <span
                                                            key={c}
                                                            className="px-2 py-0.5 text-[11px] font-medium rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700 text-[#444444] dark:text-slate-300"
                                                        >
                                                            {c}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Documented Allergies + Add Allergy Form */}
                                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <div>
                                            <div className="text-[11.5px] font-semibold text-[#555555] dark:text-slate-400 mb-1">
                                                Documented Drug Allergies
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedPatient.allergies.length > 0 ? (
                                                    selectedPatient.allergies.map((a) => (
                                                        <span
                                                            key={a}
                                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[12px] font-bold rounded-[2px] bg-[#D9534F] text-white"
                                                        >
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                            {a}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 text-[12px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                                        No known drug allergy
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <form onSubmit={handleAddAllergy} className="flex items-center gap-1.5">
                                            <input
                                                type="text"
                                                value={newAllergy}
                                                onChange={(e) => setNewAllergy(e.target.value)}
                                                placeholder="Add drug allergy (e.g. Sulfa)"
                                                className="h-[32px] w-[190px] px-2.5 text-[12px] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[#222222] dark:text-slate-100 focus:outline-none focus:border-[#D9534F]"
                                            />
                                            <Button
                                                type="submit"
                                                size="sm"
                                                variant="destructive"
                                                disabled={savingAllergy || newAllergy.trim().length < 2}
                                                className="h-[32px] px-2.5 text-[11.5px]"
                                            >
                                                <Plus className="w-3.5 h-3.5 mr-1" />
                                                Record
                                            </Button>
                                        </form>
                                    </div>
                                </div>

                                {/* Prescription & Medication Timeline */}
                                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                                    <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] font-bold text-[14px] text-[#222222] dark:text-white">
                                        Medication & Dispense History
                                    </div>
                                    {selectedPatient.prescriptions.length === 0 ? (
                                        <div className="p-6 text-center text-[13px] text-[#666666] dark:text-slate-400">
                                            No recorded prescriptions yet for this patient in {context.branch_name}.
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                                            {selectedPatient.prescriptions.map((rx) => (
                                                <div key={rx.id} className="p-4 space-y-2.5">
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono font-bold text-[13px] text-[#0E5F3F] dark:text-emerald-400">
                                                                {rx.rx_number}
                                                            </span>
                                                            <span className="text-[12.5px] font-medium text-[#222222] dark:text-slate-200">
                                                                {rx.doctor_name}
                                                            </span>
                                                            <span
                                                                className={`px-2 py-0.5 text-[11px] font-semibold rounded-[2px] ${
                                                                    rx.status === 'dispensed'
                                                                        ? 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25'
                                                                        : rx.status === 'rejected'
                                                                          ? 'bg-rose-50 text-[#C9302C] border border-rose-200'
                                                                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                                                                }`}
                                                            >
                                                                {rx.status === 'dispensed'
                                                                    ? 'Dispensed'
                                                                    : rx.status === 'rejected'
                                                                      ? 'Rejected'
                                                                      : 'Waiting'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-[11.5px] text-[#666666] dark:text-slate-400">
                                                                {rx.date}
                                                            </span>
                                                            {rx.status === 'waiting' && (
                                                                <Link href={route('pharmacist.prescriptions.verify', rx.id)}>
                                                                    <Button size="sm" variant="default" className="h-7 px-2 text-[11px]">
                                                                        Verify
                                                                    </Button>
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {rx.medicines.map((m) => (
                                                            <div
                                                                key={m.id}
                                                                className="p-2.5 rounded-[2px] border border-slate-200 dark:border-slate-700 bg-[#fafbfa] dark:bg-[#161a22] text-[12px]"
                                                            >
                                                                <div className="font-semibold text-[#222222] dark:text-white flex items-center gap-1.5">
                                                                    <Pill className="w-3.5 h-3.5 text-[#0E5F3F]" />
                                                                    <span>{m.name}</span>
                                                                </div>
                                                                <div className="text-[#555555] dark:text-slate-400 mt-0.5">
                                                                    {m.generic} • {m.dose} • {m.duration}
                                                                </div>
                                                                <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400 mt-0.5">
                                                                    Batch: {m.batch_number} · Exp: {m.expiry_date}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-8 text-center text-[#666666]">
                                Select a patient to view medication history.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

