import { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    ArrowDownRight,
    ArrowLeft,
    ArrowUpRight,
    Boxes,
    DollarSign,
    History,
    Search,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { Badge, BadgeVariant } from '@/Components/ui/Badge';
import {
    BranchFilterOption,
    PaginatedData,
    StockMovementRow,
} from '@/Components/inventory/inventoryTypes';
import { SharedPageProps } from '@/types';
import { formatCurrency } from '@/lib/format';

interface MovementsPageProps {
    movements: PaginatedData<StockMovementRow>;
    summary: {
        totalRecords: number;
        inboundUnits: number;
        outboundUnits: number;
        totalCostMoved: number;
    };
    movementTypes: Array<{ value: string; label: string; direction: string }>;
    branches: BranchFilterOption[];
    activeBranchName: string;
    filters: {
        q: string;
        movement_type: string;
        branch_id: string;
        date_from: string;
        date_to: string;
    };
}

function movementBadgeVariant(type: string, qtyChange: number): BadgeVariant {
    if (type === 'damage' || type === 'expiry_disposal') return 'rose';
    if (type === 'sale') return 'brand';
    if (type === 'adjustment_out' || type === 'transfer_out') return 'amber';
    if (qtyChange >= 0) return 'emerald';
    return 'slate';
}

export default function InventoryMovements({
    movements,
    summary,
    movementTypes,
    branches,
    activeBranchName,
    filters,
}: MovementsPageProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const currency = tenant?.currentTenant?.currency_code ?? 'BDT';

    const [search, setSearch] = useState(filters.q || '');
    const [movementType, setMovementType] = useState(filters.movement_type || '');
    const [branchId, setBranchId] = useState(filters.branch_id || 'all');
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');

    const applyFilters = (overrides?: Partial<typeof filters>) => {
        const next = {
            q: overrides?.q ?? search,
            movement_type: overrides?.movement_type ?? movementType,
            branch_id: overrides?.branch_id ?? branchId,
            date_from: overrides?.date_from ?? dateFrom,
            date_to: overrides?.date_to ?? dateTo,
        };

        router.get(
            route('inventory.movements'),
            {
                q: next.q || undefined,
                movement_type: next.movement_type || undefined,
                branch_id: next.branch_id || undefined,
                date_from: next.date_from || undefined,
                date_to: next.date_to || undefined,
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

    const typeOptions = [
        { id: '', value: '', name: 'All Movement Types' },
        ...movementTypes.map((opt) => ({
            id: opt.value,
            value: opt.value,
            name: opt.label,
        })),
    ];

    return (
        <AppLayout
            title="Stock Movement Audit Ledger"
            subtitle={`Immutable per-batch inventory trail for every sale, restock, adjustment & disposal · Scope: ${activeBranchName}`}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Link href={route('inventory.index')}>
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Catalog
                        </Button>
                    </Link>
                    <Link href={route('inventory.batches')}>
                        <Button variant="outline" size="sm">
                            <Boxes className="h-3.5 w-3.5" />
                            Batches
                        </Button>
                    </Link>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                        title="Movement Entries"
                        value={summary.totalRecords}
                        description="Traceable ledger records"
                        icon={History}
                        colorClass="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    />
                    <MetricCard
                        title="Inbound Units (+)"
                        value={`+${summary.inboundUnits}`}
                        description="Opening, restocks & returns"
                        icon={ArrowUpRight}
                        colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                        valueClassName="text-emerald-600"
                    />
                    <MetricCard
                        title="Outbound Units (-)"
                        value={`-${summary.outboundUnits}`}
                        description="Sales, adjustments & disposals"
                        icon={ArrowDownRight}
                        colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                        valueClassName="text-[#FF4A1F]"
                    />
                    <MetricCard
                        title="Moved Cost Valuation"
                        value={formatCurrency(summary.totalCostMoved, currency)}
                        description="At batch unit purchase cost"
                        icon={DollarSign}
                        colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                    />
                </div>

                <div className="bg-white dark:bg-[#12161c] rounded-[4px] border border-slate-200 dark:border-slate-800">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            applyFilters();
                        }}
                        className="p-3.5 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
                    >
                        <div className="lg:col-span-2">
                            <Input
                                label="Search Medicine, Batch or Reason"
                                placeholder="Medicine, SKU, batch #, invoice..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                icon={<Search className="h-3.5 w-3.5" />}
                            />
                        </div>
                        <Select
                            label="Branch"
                            size="sm"
                            value={branchId}
                            options={branchOptions}
                            onChange={(e) => {
                                const next = String(e.target.value);
                                setBranchId(next);
                                applyFilters({ branch_id: next });
                            }}
                        />
                        <Select
                            label="Movement Type"
                            size="sm"
                            value={movementType}
                            options={typeOptions}
                            onChange={(e) => {
                                const next = String(e.target.value);
                                setMovementType(next);
                                applyFilters({ movement_type: next });
                            }}
                        />
                        <Input
                            label="From Date"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                        <div className="flex items-end gap-2">
                            <Input
                                label="To Date"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                            <Button type="submit" variant="primary" size="sm" className="shrink-0">
                                Filter
                            </Button>
                        </div>
                    </form>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse text-[12.5px]">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151921] text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="px-3.5 py-2.5">Occurred At</th>
                                    <th className="px-3.5 py-2.5">Medicine & Batch</th>
                                    <th className="px-3.5 py-2.5">Branch</th>
                                    <th className="px-3.5 py-2.5">Movement</th>
                                    <th className="px-3.5 py-2.5 text-right">Qty</th>
                                    <th className="px-3.5 py-2.5 text-right">Before → After</th>
                                    <th className="px-3.5 py-2.5 text-right">Cost Impact</th>
                                    <th className="px-3.5 py-2.5">Reason / Actor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {movements.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={8}
                                            className="px-4 py-10 text-center text-slate-500"
                                        >
                                            No stock movements recorded for the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    movements.data.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="hover:bg-slate-50/70 dark:hover:bg-[#161b22]"
                                        >
                                            <td className="px-3.5 py-2.5 whitespace-nowrap text-[11.5px] text-slate-500">
                                                {row.occurred_at}
                                            </td>
                                            <td className="px-3.5 py-2.5">
                                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                                    {row.medicine_name}
                                                </div>
                                                <div className="text-[11px] font-mono text-slate-400">
                                                    {row.medicine_sku} · Batch {row.batch_number}
                                                </div>
                                            </td>
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                <Badge variant="slate">
                                                    {row.branch_code || row.branch_name}
                                                </Badge>
                                            </td>
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                <Badge
                                                    variant={movementBadgeVariant(
                                                        row.movement_type,
                                                        row.quantity_change
                                                    )}
                                                >
                                                    {row.movement_label}
                                                </Badge>
                                            </td>
                                            <td
                                                className={`px-3.5 py-2.5 text-right font-bold tabular-nums whitespace-nowrap ${
                                                    row.quantity_change >= 0
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-rose-600 dark:text-rose-400'
                                                }`}
                                            >
                                                {row.quantity_change > 0
                                                    ? `+${row.quantity_change}`
                                                    : row.quantity_change}{' '}
                                                {row.unit}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-right font-mono text-[11.5px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                {row.balance_before} →{' '}
                                                <strong className="text-slate-900 dark:text-slate-100">
                                                    {row.balance_after}
                                                </strong>
                                            </td>
                                            <td className="px-3.5 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                                                {formatCurrency(row.total_cost, currency)}
                                            </td>
                                            <td className="px-3.5 py-2.5">
                                                <div className="text-slate-700 dark:text-slate-200 max-w-[230px] truncate" title={row.reason || ''}>
                                                    {row.reason || '—'}
                                                </div>
                                                <div className="text-[11px] text-slate-400">
                                                    By {row.user_name}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {movements.last_page > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                            <span>
                                Showing {movements.from ?? 0}–{movements.to ?? 0} of {movements.total} movements
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={!movements.prev_page_url}
                                    onClick={() => movements.prev_page_url && router.visit(movements.prev_page_url)}
                                >
                                    Previous
                                </Button>
                                <span>
                                    Page {movements.current_page} / {movements.last_page}
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={!movements.next_page_url}
                                    onClick={() => movements.next_page_url && router.visit(movements.next_page_url)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
