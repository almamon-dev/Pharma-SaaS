import React, { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    ClipboardCheck,
    Clock,
    Lock,
    Package,
    Search,
    ShieldAlert,
    ShieldCheck,
    ShoppingBag,
    Stethoscope,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { AnimatedSearchInput } from '@/Components/ui/AnimatedSearchInput';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import PharmacistMobileNav from './components/PharmacistMobileNav';
import {
    ExpiringBatchItem,
    LowStockItem,
    MedicineDirectoryItem,
    PharmacistAlertItem,
    PharmacistAuditItem,
    PharmacistBranchContext,
    PharmacistKpis,
    PrescriptionRecord,
} from './types';

interface DashboardProps {
    context: PharmacistBranchContext;
    kpis: PharmacistKpis;
    prescriptionQueue: PrescriptionRecord[];
    alerts: PharmacistAlertItem[];
    lowStockList: LowStockItem[];
    expiringSoonList: ExpiringBatchItem[];
    medicineDirectory: MedicineDirectoryItem[];
    recentAuditLogs: PharmacistAuditItem[];
}

function stockBadge(status: 'in_stock' | 'low' | 'out_of_stock') {
    if (status === 'out_of_stock') {
        return (
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60">
                Out of stock
            </span>
        );
    }
    if (status === 'low') {
        return (
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60">
                Low
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60">
            In stock
        </span>
    );
}

export default function PharmacistDashboard({
    context,
    kpis,
    prescriptionQueue,
    alerts,
    lowStockList,
    expiringSoonList,
    medicineDirectory,
    recentAuditLogs,
}: DashboardProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [requestingKey, setRequestingKey] = useState<string | null>(null);
    const [requestedKeys, setRequestedKeys] = useState<Record<string, boolean>>({});

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const searchMatches = useMemo(() => {
        if (!normalizedQuery) return [];
        return medicineDirectory
            .filter(
                (m) =>
                    m.name.toLowerCase().includes(normalizedQuery) ||
                    m.generic_name.toLowerCase().includes(normalizedQuery) ||
                    m.manufacturer.toLowerCase().includes(normalizedQuery)
            )
            .slice(0, 6);
    }, [medicineDirectory, normalizedQuery]);

    const filteredLowStock = useMemo(() => {
        if (!normalizedQuery) return lowStockList;
        return lowStockList.filter(
            (i) =>
                i.medicine_name.toLowerCase().includes(normalizedQuery) ||
                i.generic_name.toLowerCase().includes(normalizedQuery)
        );
    }, [lowStockList, normalizedQuery]);

    const filteredExpiring = useMemo(() => {
        if (!normalizedQuery) return expiringSoonList;
        return expiringSoonList.filter(
            (b) =>
                b.medicine_name.toLowerCase().includes(normalizedQuery) ||
                b.generic_name.toLowerCase().includes(normalizedQuery) ||
                b.batch_number.toLowerCase().includes(normalizedQuery)
        );
    }, [expiringSoonList, normalizedQuery]);

    const handleRequestPurchase = (item: LowStockItem) => {
        setRequestingKey(item.key);
        const suggestedQty = Math.max(20, item.reorder_level * 2 - item.current_qty);
        router.post(
            route('pharmacist.purchase-requests.store'),
            {
                item_key: item.key,
                medicine_name: item.medicine_name,
                requested_qty: suggestedQty,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setRequestedKeys((prev) => ({ ...prev, [item.key]: true }));
                },
                onFinish: () => setRequestingKey(null),
            }
        );
    };

    return (
        <AppLayout title="Pharmacist Dashboard">
            <Head title="Pharmacist Dashboard" />

            <PharmacistMobileNav />

            <div className="w-full space-y-4">
                {/* 1. Header: Title, Branch Name, Date + Search Box */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-[18px] font-bold text-[#222222] dark:text-white leading-tight">
                                Pharmacist Dashboard
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <Stethoscope className="w-3 h-3" />
                                Clinical Verification & Safety
                            </span>
                        </div>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[#222222] dark:text-slate-200">
                                {context.branch_name}
                            </span>
                            <span className="font-mono text-[11.5px] px-1.5 py-0.2 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700 text-[#444444] dark:text-slate-300">
                                {context.branch_code}
                            </span>
                            <span>•</span>
                            <span>{context.tenant_name}</span>
                            <span>•</span>
                            <span className="font-mono text-[12px]">{context.today_display}</span>
                        </p>
                    </div>

                    {/* Medicine Search Box (Brand or Generic — Availability Only) */}
                    <div className="relative w-full lg:w-[380px]">
                        <AnimatedSearchInput
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholders={[
                                'Search medicine name...',
                                'Search by brand or generic...',
                                'Check live branch availability...',
                            ]}
                            icon={<Search className="w-4 h-4" />}
                            wrapperClassName="h-[36px] rounded-[4px]"
                            className="h-[36px] rounded-[4px] text-[13px] pl-9 pr-12"
                            rightIcon={
                                searchQuery ? (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="text-[11px] font-semibold text-[#666666] hover:text-[#222222] dark:text-slate-400 cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                ) : undefined
                            }
                        />

                        {normalizedQuery.length > 0 && (
                            <div className="absolute right-0 left-0 top-full mt-1 z-30 bg-white dark:bg-[#181d25] border border-[#CCCCCC] dark:border-slate-700 rounded-[4px] shadow-lg overflow-hidden">
                                <div className="px-3 py-1.5 bg-[#F5F7F4] dark:bg-slate-800/80 border-b border-[#D5DBD3] dark:border-slate-700 flex items-center justify-between text-[11px] text-[#555555] dark:text-slate-400">
                                    <span>Branch stock status ({context.branch_name})</span>
                                    <span className="font-mono">{searchMatches.length} found</span>
                                </div>
                                {searchMatches.length === 0 ? (
                                    <div className="px-3 py-3 text-[12.5px] text-[#666666] dark:text-slate-400">
                                        No matching medicine found in this branch.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {searchMatches.map((med) => (
                                            <div
                                                key={med.id}
                                                className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#F5F7F4] dark:hover:bg-slate-800/50"
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-[12.5px] font-semibold text-[#222222] dark:text-slate-100 truncate">
                                                        {med.name}
                                                    </div>
                                                    <div className="text-[11px] text-[#555555] dark:text-slate-400 truncate">
                                                        {med.generic_name} · {med.manufacturer}
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-1.5">
                                                    {med.requires_prescription && (
                                                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-[2px] bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                                            Rx
                                                        </span>
                                                    )}
                                                    {stockBadge(med.stock_status)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Four KPI Cards (Full Width Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                                Prescriptions waiting
                            </span>
                            <ClipboardCheck className="w-4 h-4 text-[#0E5F3F]" />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between gap-2">
                            <span className="font-mono text-[26px] font-bold text-[#222222] dark:text-white leading-none">
                                {kpis.prescriptions_waiting}
                            </span>
                            {kpis.urgent_waiting > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                                    <span className="font-mono">{kpis.urgent_waiting}</span> urgent
                                </span>
                            ) : (
                                <span className="text-[11.5px] text-[#0E5F3F] font-medium">
                                    0 urgent
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                                Dispensed today
                            </span>
                            <CheckCircle2 className="w-4 h-4 text-[#0E5F3F]" />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between gap-2">
                            <span className="font-mono text-[26px] font-bold text-[#0E5F3F] dark:text-emerald-400 leading-none">
                                {kpis.dispensed_today}
                            </span>
                            <span className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                Audit-logged
                            </span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                                Low stock
                            </span>
                            <Package className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between gap-2">
                            <span className="font-mono text-[26px] font-bold text-amber-700 dark:text-amber-400 leading-none">
                                {kpis.low_stock_count}
                            </span>
                            <span className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                Below reorder level
                            </span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                                Expiring in 60 days
                            </span>
                            <CalendarClock className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between gap-2">
                            <span className="font-mono text-[26px] font-bold text-[#222222] dark:text-white leading-none">
                                {kpis.expiring_60_days}
                            </span>
                            <span className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                Branch batches
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Main Two Columns: Prescription Queue (Wider Left) + Alerts Panel (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Left (8 cols): Prescription Queue — Oldest First */}
                    <div className="lg:col-span-8 bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between gap-2 flex-wrap">
                            <div>
                                <h2 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                    Prescription queue
                                </h2>
                                <p className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                    Oldest first • FEFO batch verification & allergy/interaction check
                                </p>
                            </div>
                            <Link
                                href={route('pharmacist.prescriptions')}
                                className="text-[12px] font-semibold text-[#0E5F3F] dark:text-emerald-400 hover:underline"
                            >
                                View all prescriptions
                            </Link>
                        </div>

                        <DataTable<PrescriptionRecord>
                            tableId="pharmacist-dashboard-queue-table"
                            data={prescriptionQueue}
                            columns={[
                                {
                                    id: 'rx_number',
                                    label: 'Patient',
                                    render: (rx) => (
                                        <div className="whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-semibold text-[#222222] dark:text-slate-100">
                                                    {rx.patient.name}
                                                </span>
                                                {rx.urgent && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10.5px] font-semibold rounded-[2px] bg-[#D9534F] text-white">
                                                        Urgent
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[11.5px] text-[#666666] dark:text-slate-400 mt-0.5">
                                                <span className="font-mono">{rx.rx_number}</span>
                                                {rx.allergy_alert && (
                                                    <span className="text-[#C9302C] dark:text-rose-400 font-semibold">
                                                        • Allergy conflict
                                                    </span>
                                                )}
                                                {rx.interaction_alert && (
                                                    <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                                        • Interaction alert
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    id: 'doctor_name',
                                    label: 'Doctor',
                                    render: (rx) => (
                                        <div className="whitespace-nowrap">
                                            <div className="text-[#222222] dark:text-slate-200 font-medium">
                                                {rx.doctor_name}
                                            </div>
                                            <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                                {rx.department}
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    id: 'medicines',
                                    label: 'Items',
                                    className: 'text-center',
                                    sortable: false,
                                    render: (rx) => (
                                        <span className="font-mono font-semibold px-2 py-0.5 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700 text-[#222222] dark:text-slate-200 whitespace-nowrap">
                                            {rx.medicines.length}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'waiting_label',
                                    label: 'Waiting Time',
                                    render: (rx) => (
                                        <div className="whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1 font-mono text-[12.5px] font-semibold text-[#333333] dark:text-slate-200">
                                                <Clock className="w-3.5 h-3.5 text-[#666666]" />
                                                <span>{rx.waiting_label}</span>
                                            </div>
                                            <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                                {rx.received_at}
                                            </div>
                                        </div>
                                    ),
                                },
                            ] as Column<PrescriptionRecord>[]}
                            keyExtractor={(rx) => rx.id}
                            hideToolbar
                            hidePagination
                            hideCheckbox
                            syncUrlParams={false}
                            actions={(rx) => (
                                <Link href={route('pharmacist.prescriptions.verify', rx.id)}>
                                    <Button size="sm" variant="default">
                                        Verify
                                    </Button>
                                </Link>
                            )}
                            actionsColumnClassName="w-[90px] min-w-[90px]"
                            emptyState={
                                <EmptyState title="All prescriptions in this branch have been verified." />
                            }
                        />
                    </div>

                    {/* Right (4 cols): Alerts Panel */}
                    <div className="lg:col-span-4 bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between">
                            <div>
                                <h2 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                    Alerts
                                </h2>
                                <p className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                    Safety, stock & controlled register
                                </p>
                            </div>
                            <ShieldAlert className="w-4 h-4 text-[#0E5F3F]" />
                        </div>

                        <div className="p-3 space-y-2.5">
                            {alerts.map((alert) => {
                                const toneStyles =
                                    alert.tone === 'red'
                                        ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/25'
                                        : alert.tone === 'amber'
                                          ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/25'
                                          : 'border-[#0E5F3F]/25 bg-[#EAF5F0]/80 dark:border-emerald-900/60 dark:bg-emerald-950/25';

                                const badgeStyles =
                                    alert.tone === 'red'
                                        ? 'bg-[#D9534F] text-white'
                                        : alert.tone === 'amber'
                                          ? 'bg-amber-600 text-white'
                                          : 'bg-[#0E5F3F] text-white';

                                const iconColor =
                                    alert.tone === 'red'
                                        ? 'text-[#C9302C] dark:text-rose-400'
                                        : alert.tone === 'amber'
                                          ? 'text-amber-700 dark:text-amber-400'
                                          : 'text-[#0E5F3F] dark:text-emerald-400';

                                return (
                                    <div
                                        key={alert.id}
                                        className={`p-3 rounded-[2px] border ${toneStyles}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-1.5 font-semibold text-[12.5px] text-[#222222] dark:text-slate-100">
                                                {alert.tone === 'green' ? (
                                                    <ShieldCheck className={`w-4 h-4 shrink-0 ${iconColor}`} />
                                                ) : (
                                                    <AlertTriangle className={`w-4 h-4 shrink-0 ${iconColor}`} />
                                                )}
                                                <span>{alert.title}</span>
                                            </div>
                                            <span
                                                className={`shrink-0 px-1.5 py-0.5 text-[10.5px] font-mono font-semibold rounded-[2px] ${badgeStyles}`}
                                            >
                                                {alert.meta}
                                            </span>
                                        </div>
                                        <p className="text-[12px] text-[#444444] dark:text-slate-300 mt-1 leading-snug">
                                            {alert.detail}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 4. Bottom Two Columns: Low Stock + Expiring Soon */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                    {/* Left: Low Stock List */}
                    <div className="min-w-0 bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <h2 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                    Low stock
                                </h2>
                                <p className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                    Branch items at or below reorder threshold
                                </p>
                            </div>
                            <ShoppingBag className="w-4 h-4 text-[#0E5F3F] shrink-0" />
                        </div>

                        <DataTable<LowStockItem>
                            tableId="pharmacist-dashboard-low-stock-table"
                            data={filteredLowStock}
                            columns={[
                                {
                                    id: 'medicine_name',
                                    label: 'Item',
                                    render: (item) => (
                                        <div>
                                            <div className="font-semibold text-[#222222] dark:text-slate-100 leading-snug">
                                                {item.medicine_name}
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                <span className="text-[11px] text-[#666666] dark:text-slate-400">
                                                    {item.generic_name}
                                                </span>
                                                {stockBadge(item.stock_status)}
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    id: 'reorder_level',
                                    label: 'Reorder',
                                    className: 'text-right',
                                    render: (item) => (
                                        <span className="font-mono text-[#444444] dark:text-slate-300 whitespace-nowrap">
                                            {item.reorder_level}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'current_qty',
                                    label: 'Qty',
                                    className: 'text-right',
                                    render: (item) => (
                                        <span
                                            className={`font-mono font-bold whitespace-nowrap ${
                                                item.current_qty <= 0
                                                    ? 'text-[#C9302C] dark:text-rose-400'
                                                    : 'text-amber-700 dark:text-amber-400'
                                            }`}
                                        >
                                            {item.current_qty}
                                        </span>
                                    ),
                                },
                            ] as Column<LowStockItem>[]}
                            keyExtractor={(item) => item.key}
                            hideToolbar
                            hidePagination
                            hideCheckbox
                            syncUrlParams={false}
                            actions={(item) => {
                                const isRequested = item.requested || Boolean(requestedKeys[item.key]);
                                return isRequested ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 dark:bg-emerald-950/40 dark:text-emerald-300 whitespace-nowrap">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Requested
                                    </span>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-[11px]"
                                        disabled={requestingKey === item.key}
                                        onClick={() => handleRequestPurchase(item)}
                                    >
                                        {requestingKey === item.key ? 'Sending...' : 'Request purchase'}
                                    </Button>
                                );
                            }}
                            actionsColumnClassName="w-[130px] min-w-[130px]"
                            emptyState={<EmptyState title="No matching low-stock items." />}
                        />
                    </div>

                    {/* Right: Expiring Soon List */}
                    <div className="min-w-0 bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <h2 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                    Expiring soon
                                </h2>
                                <p className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                    Batches within 60 days • Expired batches auto-blocked
                                </p>
                            </div>
                            <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
                        </div>

                        <DataTable<ExpiringBatchItem>
                            tableId="pharmacist-dashboard-expiring-table"
                            data={filteredExpiring}
                            columns={[
                                {
                                    id: 'medicine_name',
                                    label: 'Medicine',
                                    render: (batch) => (
                                        <div>
                                            <div className="font-semibold text-[#222222] dark:text-slate-100 leading-snug">
                                                {batch.medicine_name}
                                            </div>
                                            <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                                Exp: {batch.expiry_date}
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    id: 'batch_number',
                                    label: 'Batch',
                                    render: (batch) => (
                                        <span className="font-mono text-[11.5px] font-semibold px-1.5 py-0.5 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700 text-[#222222] dark:text-slate-200 whitespace-nowrap">
                                            {batch.batch_number}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'days_left',
                                    label: 'Left',
                                    className: 'text-right',
                                    render: (batch) => (
                                        <span
                                            className={`font-mono font-bold whitespace-nowrap ${
                                                batch.days_left <= 15
                                                    ? 'text-[#C9302C] dark:text-rose-400'
                                                    : 'text-amber-700 dark:text-amber-400'
                                            }`}
                                        >
                                            {batch.days_left <= 0 ? 'Expired' : `${batch.days_left}d`}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'status',
                                    label: 'Status',
                                    className: 'text-right',
                                    render: (batch) =>
                                        batch.status === 'expired_blocked' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#D9534F] text-white whitespace-nowrap">
                                                <Lock className="w-3 h-3" />
                                                Blocked
                                            </span>
                                        ) : batch.status === 'critical' ? (
                                            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 whitespace-nowrap">
                                                Critical
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 whitespace-nowrap">
                                                Expiring soon
                                            </span>
                                        ),
                                },
                            ] as Column<ExpiringBatchItem>[]}
                            keyExtractor={(batch) => batch.id}
                            hideToolbar
                            hidePagination
                            hideCheckbox
                            syncUrlParams={false}
                            emptyState={<EmptyState title="No batches expiring within 60 days." />}
                        />
                    </div>
                </div>

                {/* 5. Immutable Dispense Audit Trail & Clinical Safeguards */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-[#0E5F3F]" />
                            <h2 className="text-[13.5px] font-bold text-[#222222] dark:text-white">
                                Recent clinical dispense & safety audit log
                            </h2>
                        </div>
                        <span className="text-[11.5px] text-[#555555] dark:text-slate-400">
                            Immutable log • Dispensed records cannot be edited (use Returns for corrections)
                        </span>
                    </div>
                    {recentAuditLogs.length === 0 ? (
                        <div className="px-4 py-4 text-[12.5px] text-[#666666] dark:text-slate-400">
                            No clinical dispensing actions logged yet in this shift. Verify a prescription above to record an immutable audit entry.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {recentAuditLogs.map((log) => (
                                <div
                                    key={log.id}
                                    className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[12.5px]"
                                >
                                    <div className="text-[#222222] dark:text-slate-200">
                                        <span className="font-semibold text-[#0E5F3F] dark:text-emerald-400 mr-1.5">
                                            {log.user_name}:
                                        </span>
                                        <span>{log.description}</span>
                                    </div>
                                    <span className="font-mono text-[11px] text-[#666666] dark:text-slate-400 shrink-0">
                                        {log.created_at}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
