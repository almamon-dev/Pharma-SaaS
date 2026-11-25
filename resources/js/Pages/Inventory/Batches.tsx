import { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRightLeft,
    Boxes,
    Clock,
    DollarSign,
    History,
    Search,
    SlidersHorizontal,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Badge } from '@/Components/ui/Badge';
import { TablePagination } from '@/Components/tables';
import { BatchAdjustModal } from '@/Components/inventory/BatchAdjustModal';
import { BatchTransferModal } from '@/Components/inventory/BatchTransferModal';
import {
    BatchRow,
    BranchFilterOption,
    PaginatedData,
} from '@/Components/inventory/inventoryTypes';
import { SharedPageProps } from '@/types';
import { formatCurrency } from '@/lib/format';

interface BatchesPageProps {
    batches: PaginatedData<BatchRow>;
    summary: {
        activeBatches: number;
        expiring30: number;
        expiring60: number;
        expiring90: number;
        expiredCount: number;
        expiredLossValue: number;
        activeCostValue: number;
    };
    branches: BranchFilterOption[];
    suppliers: Array<{ id: number; name: string }>;
    activeBranchName: string;
    filters: {
        q: string;
        status: string;
        branch_id: string;
        supplier_id: string;
        per_page?: number;
    };
}

const statusTabs = [
    { key: 'all', label: 'All Batches' },
    { key: 'active', label: 'Sellable Active' },
    { key: 'expiring_30', label: 'Expiring <= 30d' },
    { key: 'expiring_60', label: 'Expiring <= 60d' },
    { key: 'expiring_90', label: 'Expiring <= 90d' },
    { key: 'expired', label: 'Expired Stock' },
    { key: 'damaged_disposed', label: 'Damaged / Disposed' },
    { key: 'depleted', label: 'Depleted' },
];

export default function InventoryBatches({
    batches,
    summary,
    branches,
    suppliers,
    activeBranchName,
    filters,
}: BatchesPageProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const currency = tenant?.currentTenant?.currency_code ?? 'BDT';
    const canAdjust = Boolean(tenant?.canAdjustInventory);

    const [search, setSearch] = useState(filters.q || '');
    const [status, setStatus] = useState(filters.status || 'all');
    const [branchId, setBranchId] = useState(filters.branch_id || 'all');
    const [supplierId, setSupplierId] = useState(filters.supplier_id || '');
    const [adjustingBatch, setAdjustingBatch] = useState<BatchRow | null>(null);
    const [transferringBatch, setTransferringBatch] = useState<BatchRow | null>(null);

    const applyFilters = (overrides?: Partial<typeof filters>) => {
        const next = {
            q: overrides?.q ?? search,
            status: overrides?.status ?? status,
            branch_id: overrides?.branch_id ?? branchId,
            supplier_id: overrides?.supplier_id ?? supplierId,
            per_page: overrides?.per_page ?? batches.per_page ?? filters.per_page ?? 10,
        };

        router.get(
            route('inventory.batches'),
            {
                q: next.q || undefined,
                status: next.status !== 'all' ? next.status : undefined,
                branch_id: next.branch_id || undefined,
                supplier_id: next.supplier_id || undefined,
                per_page: next.per_page,
            },
            { preserveState: true, replace: true }
        );
    };

    const branchOptions = [
        { id: 'all', value: 'all', name: 'All Active Branches' },
        ...branches.map((b) => ({
            id: b.id,
            value: String(b.id),
            name: `${b.name} (${b.code})`,
        })),
    ];

    const supplierOptions = [
        { id: '', value: '', name: 'All Suppliers' },
        ...suppliers.map((s) => ({
            id: s.id,
            value: String(s.id),
            name: s.name,
        })),
    ];

    const renderStatusBadge = (batch: BatchRow) => {
        if (batch.effective_status === 'expired' || batch.is_expired) {
            return <StatusDot variant="rose">Expired</StatusDot>;
        }
        if (batch.effective_status === 'damaged') {
            return <StatusDot variant="rose">Damaged</StatusDot>;
        }
        if (batch.effective_status === 'disposed') {
            return <StatusDot variant="slate">Disposed</StatusDot>;
        }
        if (batch.effective_status === 'depleted' || batch.quantity_available <= 0) {
            return <StatusDot variant="slate">Depleted</StatusDot>;
        }
        if (
            batch.days_remaining !== null &&
            batch.days_remaining !== undefined &&
            batch.days_remaining <= 30
        ) {
            return (
                <StatusDot variant="amber">
                    {batch.days_remaining}d left
                </StatusDot>
            );
        }
        return <StatusDot variant="emerald">Active</StatusDot>;
    };

    return (
        <AppLayout
            title="Batch & Expiry Control"
            subtitle={`FEFO batch shelf monitoring, near-expiry alerts & disposals · Scope: ${activeBranchName}`}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Link href={route('inventory.index')}>
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Catalog
                        </Button>
                    </Link>
                    <Link href={route('inventory.movements')}>
                        <Button variant="outline" size="sm">
                            <History className="h-3.5 w-3.5" />
                            Movements
                        </Button>
                    </Link>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                        title="Active Sellable Batches"
                        value={summary.activeBatches}
                        description={`Cost value ${formatCurrency(summary.activeCostValue, currency)}`}
                        icon={Boxes}
                        colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                    />
                    <MetricCard
                        title="Expiring <= 30 Days"
                        value={summary.expiring30}
                        description={`${summary.expiring60} <=60d · ${summary.expiring90} <=90d`}
                        icon={Clock}
                        colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                        valueClassName={summary.expiring30 > 0 ? 'text-amber-600' : ''}
                    />
                    <MetricCard
                        title="Expired Un-disposed"
                        value={summary.expiredCount}
                        description="Blocked from POS checkout"
                        icon={AlertTriangle}
                        colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                        valueClassName={summary.expiredCount > 0 ? 'text-rose-600' : ''}
                    />
                    <MetricCard
                        title="Expired Cost Risk"
                        value={formatCurrency(summary.expiredLossValue, currency)}
                        description="Remaining expired batch cost"
                        icon={DollarSign}
                        colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                        valueClassName={summary.expiredLossValue > 0 ? 'text-rose-600' : ''}
                    />
                </div>

                <div className="bg-white dark:bg-[#12161c] rounded-[4px] border border-slate-200 dark:border-slate-800">
                    <div className="border-b border-slate-200 dark:border-slate-800 px-4 pt-3 flex items-center gap-3 overflow-x-auto hide-scrollbar">
                        {statusTabs.map((tab) => {
                            const active = status === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => {
                                        setStatus(tab.key);
                                        applyFilters({ status: tab.key });
                                    }}
                                    className={`pb-2.5 px-1 text-[12.5px] whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                                        active
                                            ? 'border-[#FF4A1F] text-[#FF4A1F] font-bold'
                                            : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            applyFilters();
                        }}
                        className="p-3.5 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
                    >
                        <Input
                            label="Search Batch or Medicine"
                            placeholder="Batch #, medicine name, SKU..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            icon={<Search className="h-3.5 w-3.5" />}
                        />
                        <Select
                            label="Branch Scope"
                            size="md"
                            value={branchId}
                            options={branchOptions}
                            onChange={(e) => {
                                const next = String(e.target.value);
                                setBranchId(next);
                                applyFilters({ branch_id: next });
                            }}
                        />
                        <Select
                            label="Supplier"
                            size="md"
                            value={supplierId}
                            options={supplierOptions}
                            onChange={(e) => {
                                const next = String(e.target.value);
                                setSupplierId(next);
                                applyFilters({ supplier_id: next });
                            }}
                        />
                        <div className="flex items-center gap-2">
                            <Button type="submit" variant="primary" size="md">
                                Apply
                            </Button>
                            {(search || supplierId || status !== 'all') && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="md"
                                    onClick={() => {
                                        setSearch('');
                                        setSupplierId('');
                                        setStatus('all');
                                        applyFilters({ q: '', supplier_id: '', status: 'all' });
                                    }}
                                >
                                    Reset
                                </Button>
                            )}
                        </div>
                    </form>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse text-[11.5px]">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#f8fafc] dark:bg-[#151921] text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                    <th className="px-3.5 py-2.5 border-r border-slate-200/80 dark:border-slate-800/80">Batch #</th>
                                    <th className="px-3.5 py-2.5 border-r border-slate-200/80 dark:border-slate-800/80">Medicine</th>
                                    <th className="px-3.5 py-2.5 border-r border-slate-200/80 dark:border-slate-800/80">Branch</th>
                                    <th className="px-3.5 py-2.5 border-r border-slate-200/80 dark:border-slate-800/80">Supplier / Rack</th>
                                    <th className="px-3.5 py-2.5 border-r border-slate-200/80 dark:border-slate-800/80">Mfg / Expiry</th>
                                    <th className="px-3.5 py-2.5 text-right border-r border-slate-200/80 dark:border-slate-800/80">Avail / Rcvd</th>
                                    <th className="px-3.5 py-2.5 text-right border-r border-slate-200/80 dark:border-slate-800/80">Cost Val</th>
                                    <th className={`px-3.5 py-2.5 ${canAdjust ? 'border-r border-slate-200/80 dark:border-slate-800/80' : ''}`}>Status</th>
                                    {canAdjust && (
                                        <th className="px-3.5 py-2.5 text-right">Action</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {batches.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={canAdjust ? 9 : 8}
                                            className="px-4 py-10 text-center text-slate-500"
                                        >
                                            No medicine batches match your current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    batches.data.map((batch, bIdx) => {
                                        const isEven = bIdx % 2 === 1;
                                        const rowBg = isEven ? 'bg-[#f8fafc] dark:bg-[#161a22]' : 'bg-white dark:bg-[#12161c]';
                                        return (
                                        <tr
                                            key={batch.id}
                                            className={`${rowBg} hover:bg-slate-100/70 dark:hover:bg-[#1a202c] border-b border-slate-200/80 dark:border-slate-800/80 transition-colors`}
                                        >
                                            <td className="px-2.5 py-1.5 font-mono font-bold text-[#FF4A1F] text-[11.5px] whitespace-nowrap border-r border-slate-200/80 dark:border-slate-800/80">
                                                {batch.batch_number}
                                            </td>
                                            <td className="px-2.5 py-1.5 border-r border-slate-200/80 dark:border-slate-800/80">
                                                <div className="font-bold text-[11.5px] text-slate-900 dark:text-slate-200">
                                                    {batch.medicine_name}
                                                </div>
                                                <div className="text-[9.5px] font-mono text-slate-400">
                                                    {batch.medicine_sku}
                                                </div>
                                            </td>
                                            <td className="px-2.5 py-1.5 whitespace-nowrap border-r border-slate-200/80 dark:border-slate-800/80">
                                                <Badge variant="slate">
                                                    {batch.branch_code || batch.branch_name}
                                                </Badge>
                                            </td>
                                            <td className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 border-r border-slate-200/80 dark:border-slate-800/80">
                                                <div className="text-[11.5px] font-bold text-slate-900 dark:text-slate-200">{batch.supplier_name || 'Direct / Opening'}</div>
                                                {batch.rack_location && (
                                                    <div className="text-[9.5px] text-slate-400">
                                                        Rack: {batch.rack_location}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-1.5 font-mono whitespace-nowrap font-bold text-[11.5px] text-slate-900 dark:text-slate-200 border-r border-slate-200/80 dark:border-slate-800/80">
                                                <div>Exp: {batch.expiry_date || '—'}</div>
                                                {batch.manufacturing_date && (
                                                    <div className="text-[9.5px] text-slate-400 font-normal">
                                                        Mfg: {batch.manufacturing_date}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap border-r border-slate-200/80 dark:border-slate-800/80">
                                                <span className="font-bold text-[11.5px] text-slate-900 dark:text-slate-200">
                                                    {batch.quantity_available}
                                                </span>
                                                <span className="text-slate-400 text-[11.5px]">
                                                    {' '}/ {batch.quantity_received} {batch.unit}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right tabular-nums whitespace-nowrap font-bold text-[11.5px] text-slate-900 dark:text-slate-200 border-r border-slate-200/80 dark:border-slate-800/80">
                                                {formatCurrency(batch.stock_cost_value ?? 0, currency)}
                                            </td>
                                            <td className={`px-3.5 py-2.5 whitespace-nowrap ${canAdjust ? 'border-r border-slate-200/80 dark:border-slate-800/80' : ''}`}>
                                                {renderStatusBadge(batch)}
                                                {batch.disposal_reason && (
                                                    <div className="text-[10.5px] text-slate-400 max-w-[160px] truncate" title={batch.disposal_reason}>
                                                        {batch.disposal_reason}
                                                    </div>
                                                )}
                                            </td>
                                            {canAdjust && (
                                                <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {!batch.is_expired &&
                                                            batch.quantity_available > 0 &&
                                                            branches.filter((b) => String(b.id) !== 'all').length > 1 && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => setTransferringBatch(batch)}
                                                                    title="Transfer stock to another branch"
                                                                    className="h-7 px-2 text-xs"
                                                                >
                                                                    <ArrowRightLeft className="h-3 w-3 mr-1 text-[#FF4A1F]" />
                                                                    Transfer
                                                                </Button>
                                                            )}
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={batch.is_expired ? 'danger' : 'outline'}
                                                            onClick={() => setAdjustingBatch(batch)}
                                                            className="h-7 px-2 text-xs"
                                                        >
                                                            <SlidersHorizontal className="h-3 w-3" />
                                                            {batch.is_expired ? 'Dispose' : 'Adjust'}
                                                        </Button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <TablePagination
                        total={batches.total}
                        fromIdx={batches.from ?? 0}
                        toIdx={batches.to ?? 0}
                        perPage={batches.per_page ?? 10}
                        currentPage={batches.current_page}
                        totalPages={batches.last_page}
                        onPerPageChange={(val) => applyFilters({ per_page: val })}
                        onPrevPage={() => batches.prev_page_url && router.visit(batches.prev_page_url, { preserveState: true })}
                        onNextPage={() => batches.next_page_url && router.visit(batches.next_page_url, { preserveState: true })}
                        hasPrev={Boolean(batches.prev_page_url)}
                        hasNext={Boolean(batches.next_page_url)}
                        variant="table"
                    />
                </div>
            </div>

            <BatchAdjustModal
                batch={adjustingBatch}
                currency={currency}
                onClose={() => setAdjustingBatch(null)}
            />

            <BatchTransferModal
                batch={transferringBatch}
                branches={branches}
                onClose={() => setTransferringBatch(null)}
            />
        </AppLayout>
    );
}
