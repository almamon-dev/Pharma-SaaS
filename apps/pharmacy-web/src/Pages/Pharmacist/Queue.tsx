import React, { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { Clock, Search } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import PharmacistMobileNav from './components/PharmacistMobileNav';
import { PharmacistBranchContext, PrescriptionRecord } from './types';

interface QueueProps {
    context: PharmacistBranchContext;
    prescriptions: PrescriptionRecord[];
}

export default function PharmacistQueue({ context, prescriptions }: QueueProps) {
    const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'urgent' | 'dispensed' | 'rejected'>('waiting');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return prescriptions.filter((rx) => {
            if (statusFilter === 'waiting' && rx.status !== 'waiting') return false;
            if (statusFilter === 'urgent' && !(rx.status === 'waiting' && rx.urgent)) return false;
            if (statusFilter === 'dispensed' && rx.status !== 'dispensed') return false;
            if (statusFilter === 'rejected' && rx.status !== 'rejected') return false;
            if (!q) return true;
            return (
                rx.patient.name.toLowerCase().includes(q) ||
                rx.rx_number.toLowerCase().includes(q) ||
                rx.doctor_name.toLowerCase().includes(q)
            );
        });
    }, [prescriptions, statusFilter, search]);

    const counts = useMemo(
        () => ({
            all: prescriptions.length,
            waiting: prescriptions.filter((r) => r.status === 'waiting').length,
            urgent: prescriptions.filter((r) => r.status === 'waiting' && r.urgent).length,
            dispensed: prescriptions.filter((r) => r.status === 'dispensed').length,
            rejected: prescriptions.filter((r) => r.status === 'rejected').length,
        }),
        [prescriptions]
    );

    return (
        <AppLayout title="Prescription Queue">
            <Head title="Prescription Queue" />
            <PharmacistMobileNav />

            <div className="w-full space-y-4">
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            Prescription Queue
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            {context.branch_name} (<span className="font-mono">{context.branch_code}</span>) • {context.today_display}
                        </p>
                    </div>
                    <div className="relative w-full md:w-[300px]">
                        <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter by patient, Rx # or doctor"
                            className="w-full h-[36px] pl-9 pr-3 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[13px] text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
                        />
                    </div>
                </div>

                <DataTable<PrescriptionRecord>
                    tableId="pharmacist-prescription-queue-table"
                    data={filtered}
                    columns={[
                        {
                            id: 'rx_number',
                            label: 'Patient',
                            render: (rx) => (
                                <div className="whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-[#222222] dark:text-white">
                                            {rx.patient.name}
                                        </span>
                                        {rx.urgent && rx.status === 'waiting' && (
                                            <span className="px-1.5 py-0.5 text-[10.5px] font-semibold rounded-[2px] bg-[#D9534F] text-white">
                                                Urgent
                                            </span>
                                        )}
                                    </div>
                                    <div className="font-mono text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {rx.rx_number} · {rx.patient.age}y {rx.patient.sex}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'doctor_name',
                            label: 'Doctor',
                            render: (rx) => (
                                <div className="whitespace-nowrap">
                                    <div className="font-medium text-[#222222] dark:text-slate-200">
                                        {rx.doctor_name}
                                    </div>
                                    <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {rx.department}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'allergy_alert',
                            label: 'Clinical Checks',
                            sortable: false,
                            render: (rx) => (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {rx.allergy_alert && (
                                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                                            Allergy conflict
                                        </span>
                                    )}
                                    {rx.interaction_alert && (
                                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
                                            Interaction
                                        </span>
                                    )}
                                    {rx.medicines.some((m) => m.is_controlled) && (
                                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-amber-50 text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                                            Controlled drug
                                        </span>
                                    )}
                                    {!rx.allergy_alert &&
                                        !rx.interaction_alert &&
                                        !rx.medicines.some((m) => m.is_controlled) && (
                                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                Clear
                                            </span>
                                        )}
                                </div>
                            ),
                        },
                        {
                            id: 'medicines',
                            label: 'Items',
                            className: 'text-center',
                            sortable: false,
                            render: (rx) => (
                                <span className="font-mono font-semibold whitespace-nowrap">
                                    {rx.medicines.length}
                                </span>
                            ),
                        },
                        {
                            id: 'status',
                            label: 'Waiting / Status',
                            render: (rx) =>
                                rx.status === 'waiting' ? (
                                    <span className="inline-flex items-center gap-1 font-mono text-[12.5px] font-semibold text-[#333333] dark:text-slate-200 whitespace-nowrap">
                                        <Clock className="w-3.5 h-3.5 text-[#666666]" />
                                        {rx.waiting_label}
                                    </span>
                                ) : rx.status === 'dispensed' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 whitespace-nowrap">
                                        Dispensed (Locked)
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200 whitespace-nowrap">
                                        Rejected
                                    </span>
                                ),
                        },
                    ] as Column<PrescriptionRecord>[]}
                    keyExtractor={(rx) => rx.id}
                    hideToolbar
                    hideCheckbox
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex items-center gap-1.5 flex-wrap pb-1.5">
                            {[
                                { id: 'waiting', label: 'Waiting', count: counts.waiting },
                                { id: 'urgent', label: 'Urgent', count: counts.urgent },
                                { id: 'dispensed', label: 'Dispensed', count: counts.dispensed },
                                { id: 'rejected', label: 'Rejected', count: counts.rejected },
                                { id: 'all', label: 'All', count: counts.all },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                                    className={`px-2.5 py-1 text-[12px] font-semibold rounded-[2px] transition-colors cursor-pointer ${
                                        statusFilter === tab.id
                                            ? 'bg-[#0E5F3F] text-white'
                                            : 'bg-white dark:bg-slate-800 text-[#444444] dark:text-slate-300 border border-[#D5DBD3] dark:border-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    {tab.label} (<span className="font-mono">{tab.count}</span>)
                                </button>
                            ))}
                        </div>
                    }
                    actions={(rx) => (
                        <Link href={route('pharmacist.prescriptions.verify', rx.id)}>
                            <Button
                                size="sm"
                                variant={rx.status === 'waiting' ? 'default' : 'outline'}
                            >
                                {rx.status === 'waiting' ? 'Verify' : 'View Record'}
                            </Button>
                        </Link>
                    )}
                    actionsColumnClassName="w-[120px] min-w-[120px]"
                    emptyState={<EmptyState title="No prescriptions match this filter." />}
                />
            </div>
        </AppLayout>
    );
}
