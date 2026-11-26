import React, { useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    Lock,
    Package,
    Search,
    ShieldAlert,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import PharmacistMobileNav from './components/PharmacistMobileNav';
import { ExpiringBatchItem, PharmacistBranchContext } from './types';

interface StockMedItem {
    id: number;
    key: string;
    name: string;
    generic_name: string;
    dosage_form: string;
    manufacturer: string;
    stock_status: 'in_stock' | 'low' | 'out_of_stock';
}

interface StockExpiryProps {
    context: PharmacistBranchContext;
    summary: {
        in_stock: number;
        low_stock: number;
        out_of_stock: number;
        expiring_60_days: number;
        expired_blocked: number;
    };
    medicines: StockMedItem[];
    expiringBatches: Array<ExpiringBatchItem & { quarantined?: boolean }>;
    requestedKeys: string[];
}

export default function PharmacistStockExpiry({
    context,
    summary,
    medicines,
    expiringBatches,
    requestedKeys,
}: StockExpiryProps) {
    const [activeTab, setActiveTab] = useState<'expiry' | 'stock'>('expiry');
    const [search, setSearch] = useState('');
    const [bucket, setBucket] = useState<'all' | 'expired' | '15' | '30' | '60'>('all');
    const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low' | 'out_of_stock'>('all');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [localRequested, setLocalRequested] = useState<Record<string, boolean>>({});

    const q = search.trim().toLowerCase();

    const filteredBatches = useMemo(() => {
        return expiringBatches.filter((b) => {
            if (bucket === 'expired' && b.days_left > 0) return false;
            if (bucket === '15' && !(b.days_left > 0 && b.days_left <= 15)) return false;
            if (bucket === '30' && !(b.days_left > 15 && b.days_left <= 30)) return false;
            if (bucket === '60' && !(b.days_left > 30 && b.days_left <= 60)) return false;
            if (!q) return true;
            return (
                b.medicine_name.toLowerCase().includes(q) ||
                b.batch_number.toLowerCase().includes(q) ||
                b.generic_name.toLowerCase().includes(q)
            );
        });
    }, [expiringBatches, bucket, q]);

    const filteredMedicines = useMemo(() => {
        return medicines.filter((m) => {
            if (stockStatusFilter !== 'all' && m.stock_status !== stockStatusFilter) return false;
            if (!q) return true;
            return (
                m.name.toLowerCase().includes(q) ||
                m.generic_name.toLowerCase().includes(q) ||
                m.manufacturer.toLowerCase().includes(q)
            );
        });
    }, [medicines, stockStatusFilter, q]);

    const handleQuarantine = (b: ExpiringBatchItem) => {
        setBusyId(b.id);
        router.post(
            route('pharmacist.stock-expiry.quarantine'),
            {
                batch_id: b.id,
                batch_number: b.batch_number,
                medicine_name: b.medicine_name,
            },
            {
                preserveScroll: true,
                onFinish: () => setBusyId(null),
            }
        );
    };

    const handleQuickRequest = (m: StockMedItem) => {
        setBusyId(m.key);
        router.post(
            route('pharmacist.purchase-requests.store'),
            {
                item_key: m.key,
                medicine_name: m.name,
                generic_name: m.generic_name,
                requested_qty: 50,
                priority: m.stock_status === 'out_of_stock' ? 'urgent' : 'normal',
            },
            {
                preserveScroll: true,
                onSuccess: () => setLocalRequested((prev) => ({ ...prev, [m.key]: true })),
                onFinish: () => setBusyId(null),
            }
        );
    };

    return (
        <AppLayout title="Stock & Expiry">
            <Head title="Stock & Expiry" />
            <PharmacistMobileNav />

            <div className="w-full space-y-4">
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            Stock & Expiry Monitor (View & Alerts Only)
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            {context.branch_name} (<span className="font-mono">{context.branch_code}</span>) • Status only (In stock / Low / Out of stock) — purchase cost & valuation hidden
                        </p>
                    </div>
                    <div className="relative w-full md:w-[300px]">
                        <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search medicine, generic or batch..."
                            className="w-full h-[36px] pl-9 pr-3 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[13px] text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
                        />
                    </div>
                </div>

                {/* 4 KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            <span>In stock</span>
                            <Package className="w-4 h-4 text-[#0E5F3F]" />
                        </div>
                        <div className="mt-2 font-mono text-[26px] font-bold text-[#0E5F3F] dark:text-emerald-400 leading-none">
                            {summary.in_stock}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            <span>Low stock</span>
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="mt-2 font-mono text-[26px] font-bold text-amber-700 dark:text-amber-400 leading-none">
                            {summary.low_stock}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            <span>Out of stock</span>
                            <ShieldAlert className="w-4 h-4 text-[#C9302C]" />
                        </div>
                        <div className="mt-2 font-mono text-[26px] font-bold text-[#C9302C] dark:text-rose-400 leading-none">
                            {summary.out_of_stock}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4">
                        <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#555555] dark:text-slate-400">
                            <span>Expiring in 60 days</span>
                            <CalendarClock className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="font-mono text-[26px] font-bold text-[#222222] dark:text-white leading-none">
                                {summary.expiring_60_days}
                            </span>
                            {summary.expired_blocked > 0 && (
                                <span className="px-1.5 py-0.5 text-[10.5px] font-semibold rounded-[2px] bg-[#D9534F] text-white">
                                    <span className="font-mono">{summary.expired_blocked}</span> blocked
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabbed Table */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setActiveTab('expiry')}
                                className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-[2px] cursor-pointer ${
                                    activeTab === 'expiry'
                                        ? 'bg-[#0E5F3F] text-white'
                                        : 'bg-white dark:bg-slate-800 text-[#444444] dark:text-slate-300 border border-[#D5DBD3] dark:border-slate-700'
                                }`}
                            >
                                Expiry Watchlist (<span className="font-mono">{expiringBatches.length}</span>)
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('stock')}
                                className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-[2px] cursor-pointer ${
                                    activeTab === 'stock'
                                        ? 'bg-[#0E5F3F] text-white'
                                        : 'bg-white dark:bg-slate-800 text-[#444444] dark:text-slate-300 border border-[#D5DBD3] dark:border-slate-700'
                                }`}
                            >
                                Branch Stock Status (<span className="font-mono">{medicines.length}</span>)
                            </button>
                        </div>

                        {activeTab === 'expiry' ? (
                            <div className="flex items-center gap-1 flex-wrap">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'expired', label: 'Expired' },
                                    { id: '15', label: '1–15d' },
                                    { id: '30', label: '16–30d' },
                                    { id: '60', label: '31–60d' },
                                ].map((b) => (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => setBucket(b.id as typeof bucket)}
                                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-[2px] cursor-pointer ${
                                            bucket === b.id
                                                ? 'bg-[#337AB7] text-white'
                                                : 'bg-white dark:bg-slate-800 text-[#555555] dark:text-slate-300 border border-[#D5DBD3] dark:border-slate-700'
                                        }`}
                                    >
                                        {b.label}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'out_of_stock', label: 'Out of stock' },
                                    { id: 'low', label: 'Low' },
                                    { id: 'in_stock', label: 'In stock' },
                                ].map((st) => (
                                    <button
                                        key={st.id}
                                        type="button"
                                        onClick={() => setStockStatusFilter(st.id as typeof stockStatusFilter)}
                                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-[2px] cursor-pointer ${
                                            stockStatusFilter === st.id
                                                ? 'bg-[#337AB7] text-white'
                                                : 'bg-white dark:bg-slate-800 text-[#555555] dark:text-slate-300 border border-[#D5DBD3] dark:border-slate-700'
                                        }`}
                                    >
                                        {st.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {activeTab === 'expiry' ? (
                        <DataTable<ExpiringBatchItem & { quarantined?: boolean }>
                            tableId="pharmacist-expiry-batches-table"
                            data={filteredBatches}
                            columns={[
                                {
                                    id: 'medicine_name',
                                    label: 'Medicine',
                                    render: (b) => (
                                        <div>
                                            <div className="font-semibold text-[#222222] dark:text-white">
                                                {b.medicine_name}
                                            </div>
                                            {b.generic_name && (
                                                <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                                    {b.generic_name}
                                                </div>
                                            )}
                                        </div>
                                    ),
                                },
                                {
                                    id: 'batch_number',
                                    label: 'Batch Number',
                                    render: (b) => (
                                        <span className="font-mono text-[12px] font-semibold px-2 py-0.5 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700 whitespace-nowrap">
                                            {b.batch_number}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'expiry_date',
                                    label: 'Expiry Date',
                                    render: (b) => (
                                        <span className="font-mono text-[12.5px] whitespace-nowrap">
                                            {b.expiry_date}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'days_left',
                                    label: 'Days Left',
                                    className: 'text-right',
                                    render: (b) => (
                                        <span
                                            className={`font-mono font-bold whitespace-nowrap ${
                                                b.days_left <= 15
                                                    ? 'text-[#C9302C] dark:text-rose-400'
                                                    : 'text-amber-700 dark:text-amber-400'
                                            }`}
                                        >
                                            {b.days_left <= 0 ? 'Expired' : `${b.days_left}d`}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'status',
                                    label: 'Status',
                                    render: (b) =>
                                        b.status === 'expired_blocked' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#D9534F] text-white whitespace-nowrap">
                                                <Lock className="w-3 h-3" />
                                                Blocked
                                            </span>
                                        ) : b.status === 'critical' ? (
                                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200 whitespace-nowrap">
                                                Critical
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                                                Expiring soon
                                            </span>
                                        ),
                                },
                            ] as Column<ExpiringBatchItem>[]}
                            keyExtractor={(b) => b.id}
                            hideToolbar
                            hideCheckbox
                            syncUrlParams={false}
                            actions={(b) =>
                                b.quarantined || b.days_left <= 0 ? (
                                    <span className="text-[11.5px] font-semibold text-[#C9302C] dark:text-rose-400 whitespace-nowrap">
                                        Quarantined
                                    </span>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 px-2 text-[11px]"
                                        disabled={busyId === b.id}
                                        onClick={() => handleQuarantine(b)}
                                    >
                                        Flag quarantine
                                    </Button>
                                )
                            }
                            actionsColumnClassName="w-[130px] min-w-[130px]"
                            emptyState={<EmptyState title="No batches in this expiry bucket." />}
                        />
                    ) : (
                        <DataTable<StockMedItem>
                            tableId="pharmacist-stock-status-table"
                            data={filteredMedicines}
                            columns={[
                                {
                                    id: 'name',
                                    label: 'Medicine',
                                    render: (m) => (
                                        <span className="font-semibold text-[#222222] dark:text-white">
                                            {m.name}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'generic_name',
                                    label: 'Generic',
                                    render: (m) => (
                                        <span className="text-[#0E5F3F] dark:text-emerald-400">
                                            {m.generic_name}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'manufacturer',
                                    label: 'Manufacturer & Form',
                                    render: (m) => (
                                        <span className="text-[#555555] dark:text-slate-400">
                                            {m.manufacturer} · {m.dosage_form}
                                        </span>
                                    ),
                                },
                                {
                                    id: 'stock_status',
                                    label: 'Stock Status',
                                    render: (m) =>
                                        m.stock_status === 'out_of_stock' ? (
                                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200 whitespace-nowrap">
                                                Out of stock
                                            </span>
                                        ) : m.stock_status === 'low' ? (
                                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                                                Low
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 whitespace-nowrap">
                                                In stock
                                            </span>
                                        ),
                                },
                            ] as Column<StockMedItem>[]}
                            keyExtractor={(m) => m.id}
                            hideToolbar
                            hideCheckbox
                            syncUrlParams={false}
                            actions={(m) => {
                                const isReq =
                                    requestedKeys.includes(m.key) || Boolean(localRequested[m.key]);
                                if (m.stock_status === 'in_stock') {
                                    return (
                                        <span className="text-[12px] text-[#666666] dark:text-slate-500">
                                            Sufficient
                                        </span>
                                    );
                                }
                                if (isReq) {
                                    return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Requested
                                        </span>
                                    );
                                }
                                return (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-[11px]"
                                        disabled={busyId === m.key}
                                        onClick={() => handleQuickRequest(m)}
                                    >
                                        Request purchase
                                    </Button>
                                );
                            }}
                            actionsColumnClassName="w-[140px] min-w-[140px]"
                            emptyState={<EmptyState title="No medicines match this filter." />}
                        />
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

