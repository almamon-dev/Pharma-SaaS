import { useEffect, useRef, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
 ArrowDownRight,
 ArrowLeft,
 ArrowUpRight,
 Boxes,
 DollarSign,
 Download,
 History,
 RefreshCw,
 Search,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { AnimatedSearchInput } from '@/Components/ui/AnimatedSearchInput';
import { Select } from '@/Components/ui/Select';
import { Badge, BadgeVariant } from '@/Components/ui/Badge';
import { DataTable, Column, EmptyState, TablePagination } from '@/Components/tables';
import {
 BranchFilterOption,
 PaginatedData,
 StockMovementRow,
 downloadCsv,
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
 per_page?: number;
 sort?: string;
 dir?: string;
 };
}

const sortOptions = [
 { id: 'occurred_at:desc', value: 'occurred_at:desc', name: 'Newest First' },
 { id: 'occurred_at:asc', value: 'occurred_at:asc', name: 'Oldest First' },
 { id: 'quantity_change:desc', value: 'quantity_change:desc', name: 'Qty: Highest (+)' },
 { id: 'quantity_change:asc', value: 'quantity_change:asc', name: 'Qty: Highest (-)' },
 { id: 'total_cost:desc', value: 'total_cost:desc', name: 'Cost Impact: High' },
];

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
 const [sortVal, setSortVal] = useState(`${filters.sort || 'occurred_at'}:${filters.dir || 'desc'}`);
 const [refreshing, setRefreshing] = useState(false);
 const [autoLive, setAutoLive] = useState(false);

 const mountedRef = useRef(false);

 const applyFilters = (overrides?: Partial<typeof filters>) => {
 const nextSortPair = (overrides?.sort && overrides?.dir
 ? `${overrides.sort}:${overrides.dir}`
 : sortVal
 ).split(':');

 const next = {
 q: overrides?.q ?? search,
 movement_type: overrides?.movement_type ?? movementType,
 branch_id: overrides?.branch_id ?? branchId,
 date_from: overrides?.date_from ?? dateFrom,
 date_to: overrides?.date_to ?? dateTo,
 per_page: overrides?.per_page ?? movements.per_page ?? filters.per_page ?? 10,
 sort: overrides?.sort ?? nextSortPair[0] ?? 'occurred_at',
 dir: overrides?.dir ?? nextSortPair[1] ?? 'desc',
 };

 router.get(
 route('inventory.movements'),
 {
 q: next.q || undefined,
 movement_type: next.movement_type || undefined,
 branch_id: next.branch_id || undefined,
 date_from: next.date_from || undefined,
 date_to: next.date_to || undefined,
 per_page: next.per_page,
 sort: next.sort !== 'occurred_at' ? next.sort : undefined,
 dir: next.dir !== 'desc' ? next.dir : undefined,
 },
 { preserveState: true, replace: true }
 );
 };

 // Dynamic debounced search
 useEffect(() => {
 if (!mountedRef.current) {
 mountedRef.current = true;
 return;
 }
 const timer = window.setTimeout(() => {
 applyFilters({ q: search });
 }, 300);
 return () => window.clearTimeout(timer);
 }, [search]);

 // Optional live 30s auto-refresh
 useEffect(() => {
 if (!autoLive) return;
 const interval = window.setInterval(() => {
 router.reload({ only: ['movements', 'summary'] });
 }, 30000);
 return () => window.clearInterval(interval);
 }, [autoLive]);

 const applyDatePreset = (preset: 'today' | '7d' | 'month' | 'all') => {
 const now = new Date();
 const to = now.toISOString().slice(0, 10);
 let from = '';
 let nextTo = to;
 if (preset === 'today') {
 from = to;
 } else if (preset === '7d') {
 const d = new Date(now);
 d.setDate(d.getDate() - 6);
 from = d.toISOString().slice(0, 10);
 } else if (preset === 'month') {
 from = `${to.slice(0, 8)}01`;
 } else {
 from = '';
 nextTo = '';
 }
 setDateFrom(from);
 setDateTo(nextTo);
 applyFilters({ date_from: from, date_to: nextTo });
 };

 const handleRefresh = () => {
 setRefreshing(true);
 router.reload({
 only: ['movements', 'summary'],
 onFinish: () => setRefreshing(false),
 });
 };

 const handleExportCsv = () => {
 downloadCsv(
 `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`,
 ['Occurred At', 'Medicine', 'SKU', 'Batch #', 'Branch', 'Type', 'Qty Change', 'Unit', 'Before', 'After', 'Cost Impact', 'Reason', 'Actor'],
 movements.data.map((m) => [
 m.occurred_at,
 m.medicine_name,
 m.medicine_sku,
 m.batch_number,
 m.branch_code || m.branch_name,
 m.movement_label,
 m.quantity_change,
 m.unit,
 m.balance_before,
 m.balance_after,
 m.total_cost,
 m.reason,
 m.user_name,
 ])
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
 <Button
 type="button"
 variant={autoLive ? 'primary' : 'outline'}
 size="sm"
 onClick={() => setAutoLive((v) => !v)}
 title="Auto-refresh every 30 seconds"
 >
 <span className={`h-2 w-2 rounded-full ${autoLive ? 'bg-white animate-pulse' : 'bg-emerald-500'}`} />
 {autoLive ? 'Live: ON' : 'Live 30s'}
 </Button>
 <Button type="button" variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
 <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
 Refresh
 </Button>
 <Button type="button" variant="outline" size="sm" onClick={handleExportCsv} disabled={movements.data.length === 0}>
 <Download className="h-3.5 w-3.5" />
 CSV
 </Button>
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
 colorClass="bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 text-[#0E5F3F]"
 valueClassName="text-[#0E5F3F]"
 />
 <MetricCard
 title="Moved Cost Valuation"
 value={formatCurrency(summary.totalCostMoved, currency)}
 description="At batch unit purchase cost"
 icon={DollarSign}
 colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
 />
 </div>

 <div className="bg-white dark:bg-[#12161c] rounded-[2px] border border-slate-200 dark:border-slate-800">
 {/* Quick Presets Bar */}
 <div className="px-3.5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
 <div className="flex flex-wrap items-center gap-1.5">
 <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick Range:</span>
 <Button type="button" variant="outline" size="sm" onClick={() => applyDatePreset('today')}>
 Today
 </Button>
 <Button type="button" variant="outline" size="sm" onClick={() => applyDatePreset('7d')}>
 Last 7d
 </Button>
 <Button type="button" variant="outline" size="sm" onClick={() => applyDatePreset('month')}>
 This Month
 </Button>
 <Button type="button" variant="outline" size="sm" onClick={() => applyDatePreset('all')}>
 All Time
 </Button>
 </div>
 {(search || movementType || dateFrom || dateTo || sortVal !== 'occurred_at:desc') && (
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setSearch('');
 setMovementType('');
 setDateFrom('');
 setDateTo('');
 setSortVal('occurred_at:desc');
 applyFilters({
 q: '',
 movement_type: '',
 date_from: '',
 date_to: '',
 sort: 'occurred_at',
 dir: 'desc',
 });
 }}
 >
 Reset Filters
 </Button>
 )}
 </div>

 <form
 onSubmit={(e) => {
 e.preventDefault();
 applyFilters();
 }}
 className="p-3.5 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 items-end"
 >
 <div className="lg:col-span-2">
 <label className="block text-[12px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
 Search Medicine, Batch or Reason
 </label>
 <AnimatedSearchInput
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholders={[
 'Search by medicine name...',
 'Search by SKU or batch #...',
 'Search by invoice or reason...',
 ]}
 icon={<Search className="h-3.5 w-3.5" />}
 wrapperClassName="h-[36px] rounded-[4px]"
 className="h-[36px] rounded-[4px] text-[13px] pl-9 pr-3"
 />
 </div>
 <Select
 label="Branch"
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
 label="Movement Type"
 size="md"
 value={movementType}
 options={typeOptions}
 onChange={(e) => {
 const next = String(e.target.value);
 setMovementType(next);
 applyFilters({ movement_type: next });
 }}
 />
 <Select
 label="Sort By"
 size="md"
 value={sortVal}
 options={sortOptions}
 onChange={(e) => {
 const next = String(e.target.value);
 setSortVal(next);
 const [sort, dir] = next.split(':');
 applyFilters({ sort, dir });
 }}
 />
 <Input
 label="From Date"
 type="date"
 value={dateFrom}
 onChange={(e) => {
 const next = e.target.value;
 setDateFrom(next);
 applyFilters({ date_from: next });
 }}
 />
 <div className="flex items-end gap-2">
 <Input
 label="To Date"
 type="date"
 value={dateTo}
 onChange={(e) => {
 const next = e.target.value;
 setDateTo(next);
 applyFilters({ date_to: next });
 }}
 />
 <Button type="submit" variant="primary" size="md" className="shrink-0">
 Filter
 </Button>
 </div>
 </form>

 <DataTable<StockMovementRow>
 tableId="inventory-movements-table"
 data={movements.data}
 columns={[
 {
 id: 'occurred_at',
 label: 'Occurred At',
 render: (row) => (
 <span className="whitespace-nowrap font-mono text-slate-500">
 {row.occurred_at}
 </span>
 ),
 },
 {
 id: 'medicine_name',
 label: 'Medicine & Batch',
 render: (row) => (
 <div>
 <div className="font-bold text-slate-900 dark:text-slate-200">
 {row.medicine_name}
 </div>
 <div className="text-[10px] font-mono text-slate-400">
 {row.medicine_sku} ·{' '}
 {row.batch_number && row.batch_number !== '—' ? (
 <Link
 href={route('inventory.batches', { q: row.batch_number })}
 className="text-[#0E5F3F] dark:text-emerald-400 hover:underline font-semibold"
 >
 Batch {row.batch_number}
 </Link>
 ) : (
 'No batch'
 )}
 </div>
 </div>
 ),
 },
 {
 id: 'branch_name',
 label: 'Branch',
 render: (row) => (
 <Badge variant="slate">{row.branch_code || row.branch_name}</Badge>
 ),
 },
 {
 id: 'movement_label',
 label: 'Movement',
 render: (row) => (
 <Badge variant={movementBadgeVariant(row.movement_type, row.quantity_change)}>
 {row.movement_label}
 </Badge>
 ),
 },
 {
 id: 'quantity_change',
 label: 'Qty',
 className: 'text-right',
 render: (row) => (
 <span
 className={`font-bold font-mono whitespace-nowrap ${
 row.quantity_change >= 0
 ? 'text-emerald-600 dark:text-emerald-400'
 : 'text-rose-600 dark:text-rose-400'
 }`}
 >
 {row.quantity_change > 0 ? `+${row.quantity_change}` : row.quantity_change}{' '}
 {row.unit}
 </span>
 ),
 },
 {
 id: 'balance_after',
 label: 'Before → After',
 className: 'text-right',
 render: (row) => (
 <span className="font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
 {row.balance_before} →{' '}
 <strong className="text-slate-900 dark:text-slate-100">
 {row.balance_after}
 </strong>
 </span>
 ),
 },
 {
 id: 'total_cost',
 label: 'Cost Impact',
 className: 'text-right',
 render: (row) => (
 <span className="font-mono font-bold whitespace-nowrap text-slate-800 dark:text-slate-200">
 {formatCurrency(row.total_cost, currency)}
 </span>
 ),
 },
 {
 id: 'reason',
 label: 'Reason / Actor',
 render: (row) => (
 <div>
 <div
 className="font-bold text-slate-700 dark:text-slate-200 max-w-[230px] truncate"
 title={row.reason || ''}
 >
 {row.reason || '—'}
 </div>
 <div className="text-[10px] text-slate-400">By {row.user_name}</div>
 </div>
 ),
 },
 ] as Column<StockMovementRow>[]}
 keyExtractor={(row) => row.id}
 hideToolbar
 hidePagination
 hideCheckbox
 syncUrlParams={false}
 emptyState={
 <EmptyState
 icon={History}
 title="No stock movements recorded for the selected filters."
 />
 }
 />

 <TablePagination
 total={movements.total}
 fromIdx={movements.from ?? 0}
 toIdx={movements.to ?? 0}
 perPage={movements.per_page ?? 10}
 currentPage={movements.current_page}
 totalPages={movements.last_page}
 onPerPageChange={(val) => applyFilters({ per_page: val })}
 onPrevPage={() => movements.prev_page_url && router.visit(movements.prev_page_url, { preserveState: true })}
 onNextPage={() => movements.next_page_url && router.visit(movements.next_page_url, { preserveState: true })}
 hasPrev={Boolean(movements.prev_page_url)}
 hasNext={Boolean(movements.next_page_url)}
 variant="table"
 />
 </div>
 </div>
 </AppLayout>
 );
}
