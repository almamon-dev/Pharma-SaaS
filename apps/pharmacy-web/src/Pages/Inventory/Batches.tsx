import { useEffect, useRef, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
 AlertTriangle,
 ArrowLeft,
 ArrowRightLeft,
 Boxes,
 Clock,
 DollarSign,
 Download,
 History,
 Plus,
 RefreshCw,
 Search,
 SlidersHorizontal,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { Button } from '@/Components/ui/Button';
import { AnimatedSearchInput } from '@/Components/ui/AnimatedSearchInput';
import { Select } from '@/Components/ui/Select';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Badge } from '@/Components/ui/Badge';
import { BrtaField, BrtaFormGrid, BrtaFormModal, brtaInputClass, brtaTextareaClass } from '@/Components/ui/BrtaForm';
import { DataTable, Column, EmptyState, TablePagination } from '@/Components/tables';
import { BatchAdjustModal } from '@/Components/inventory/BatchAdjustModal';
import { BatchTransferModal } from '@/Components/inventory/BatchTransferModal';
import {
 BatchRow,
 BranchFilterOption,
 MedicineSearchOption,
 PaginatedData,
 downloadCsv,
} from '@/Components/inventory/inventoryTypes';
import { SharedPageProps } from '@/types';
import { formatCurrency } from '@/lib/format';

interface BatchesPageProps {
 batches: PaginatedData<BatchRow>;
 summary: {
 allCount?: number;
 activeBatches: number;
 expiring30: number;
 expiring60: number;
 expiring90: number;
 expiredCount: number;
 damagedDisposedCount?: number;
 depletedCount?: number;
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
 sort?: string;
 dir?: string;
 };
}

const statusTabs = [
 { key: 'all', label: 'All Batches', countKey: 'allCount' },
 { key: 'active', label: 'Sellable Active', countKey: 'activeBatches' },
 { key: 'expiring_30', label: 'Expiring <= 30d', countKey: 'expiring30' },
 { key: 'expiring_60', label: 'Expiring <= 60d', countKey: 'expiring60' },
 { key: 'expiring_90', label: 'Expiring <= 90d', countKey: 'expiring90' },
 { key: 'expired', label: 'Expired Stock', countKey: 'expiredCount' },
 { key: 'damaged_disposed', label: 'Damaged / Disposed', countKey: 'damagedDisposedCount' },
 { key: 'depleted', label: 'Depleted', countKey: 'depletedCount' },
] as const;

const sortOptions = [
 { id: 'expiry_date:asc', value: 'expiry_date:asc', name: 'Expiry: Soonest First' },
 { id: 'expiry_date:desc', value: 'expiry_date:desc', name: 'Expiry: Latest First' },
 { id: 'quantity_available:asc', value: 'quantity_available:asc', name: 'Qty: Lowest First' },
 { id: 'quantity_available:desc', value: 'quantity_available:desc', name: 'Qty: Highest First' },
 { id: 'stock_cost_value:desc', value: 'stock_cost_value:desc', name: 'Value: Highest First' },
 { id: 'batch_number:asc', value: 'batch_number:asc', name: 'Batch #: A → Z' },
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
 const canReceive = Boolean(tenant?.canEditInventory);

 const [search, setSearch] = useState(filters.q || '');
 const [status, setStatus] = useState(filters.status || 'all');
 const [branchId, setBranchId] = useState(filters.branch_id || 'all');
 const [supplierId, setSupplierId] = useState(filters.supplier_id || '');
 const [sortVal, setSortVal] = useState(`${filters.sort || 'expiry_date'}:${filters.dir || 'asc'}`);
 const [refreshing, setRefreshing] = useState(false);
 const [autoLive, setAutoLive] = useState(false);

 const [adjustingBatch, setAdjustingBatch] = useState<BatchRow | null>(null);
 const [transferringBatch, setTransferringBatch] = useState<BatchRow | null>(null);

 // Receive New Batch modal state
 const [receiveOpen, setReceiveOpen] = useState(false);
 const [medQuery, setMedQuery] = useState('');
 const [medResults, setMedResults] = useState<MedicineSearchOption[]>([]);
 const [medLoading, setMedLoading] = useState(false);
 const [selectedMed, setSelectedMed] = useState<MedicineSearchOption | null>(null);
 const [rxBranchId, setRxBranchId] = useState('');
 const [rxSupplierId, setRxSupplierId] = useState('');
 const [rxBatchNumber, setRxBatchNumber] = useState('');
 const [rxExpiryDate, setRxExpiryDate] = useState('');
 const [rxQty, setRxQty] = useState('10');
 const [rxPurchasePrice, setRxPurchasePrice] = useState('');
 const [rxSellingPrice, setRxSellingPrice] = useState('');
 const [rxRack, setRxRack] = useState('');
 const [rxNotes, setRxNotes] = useState('');
 const [rxSubmitting, setRxSubmitting] = useState(false);

 const mountedRef = useRef(false);

 const applyFilters = (overrides?: Partial<typeof filters>) => {
 const nextSortPair = (overrides?.sort && overrides?.dir
 ? `${overrides.sort}:${overrides.dir}`
 : sortVal
 ).split(':');

 const next = {
 q: overrides?.q ?? search,
 status: overrides?.status ?? status,
 branch_id: overrides?.branch_id ?? branchId,
 supplier_id: overrides?.supplier_id ?? supplierId,
 per_page: overrides?.per_page ?? batches.per_page ?? filters.per_page ?? 10,
 sort: overrides?.sort ?? nextSortPair[0] ?? 'expiry_date',
 dir: overrides?.dir ?? nextSortPair[1] ?? 'asc',
 };

 router.get(
 route('inventory.batches'),
 {
 q: next.q || undefined,
 status: next.status !== 'all' ? next.status : undefined,
 branch_id: next.branch_id || undefined,
 supplier_id: next.supplier_id || undefined,
 per_page: next.per_page,
 sort: next.sort !== 'expiry_date' ? next.sort : undefined,
 dir: next.dir !== 'asc' ? next.dir : undefined,
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
 router.reload({ only: ['batches', 'summary'] });
 }, 30000);
 return () => window.clearInterval(interval);
 }, [autoLive]);

 // Dynamic medicine search for Receive Batch modal
 useEffect(() => {
 if (!receiveOpen) return;
 let active = true;
 const timer = window.setTimeout(async () => {
 setMedLoading(true);
 try {
 const res = await fetch(
 `${route('inventory.medicines.search')}?q=${encodeURIComponent(medQuery.trim())}`,
 { headers: { Accept: 'application/json' } }
 );
 if (res.ok && active) {
 const json = await res.json();
 setMedResults(json.medicines ?? []);
 }
 } catch {
 // Ignore transient network error during typing
 } finally {
 if (active) setMedLoading(false);
 }
 }, 220);
 return () => {
 active = false;
 window.clearTimeout(timer);
 };
 }, [receiveOpen, medQuery]);

 const openReceiveModal = () => {
 setSelectedMed(null);
 setMedQuery('');
 setRxBranchId(
 branchId !== 'all' && branchId
 ? branchId
 : branches[0]?.id
 ? String(branches[0].id)
 : ''
 );
 setRxSupplierId(suppliers[0]?.id ? String(suppliers[0].id) : '');
 setRxBatchNumber(`B-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`);
 const nextYear = new Date();
 nextYear.setFullYear(nextYear.getFullYear() + 1);
 setRxExpiryDate(nextYear.toISOString().slice(0, 10));
 setRxQty('20');
 setRxPurchasePrice('');
 setRxSellingPrice('');
 setRxRack('');
 setRxNotes('');
 setReceiveOpen(true);
 };

 const handleSelectMedicine = (med: MedicineSearchOption) => {
 setSelectedMed(med);
 setRxPurchasePrice(String(med.default_purchase_price ?? 0));
 setRxSellingPrice(String(med.default_selling_price ?? 0));
 };

 const handleSubmitReceive = (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedMed || !rxBatchNumber.trim() || !rxExpiryDate) return;
 setRxSubmitting(true);
 router.post(
 route('inventory.batches.store', selectedMed.id),
 {
 branch_id: rxBranchId ? Number(rxBranchId) : null,
 supplier_id: rxSupplierId ? Number(rxSupplierId) : null,
 batch_number: rxBatchNumber.trim(),
 expiry_date: rxExpiryDate,
 quantity: Number(rxQty) || 1,
 purchase_price: rxPurchasePrice !== '' ? Number(rxPurchasePrice) : undefined,
 selling_price: rxSellingPrice !== '' ? Number(rxSellingPrice) : undefined,
 rack_location: rxRack.trim() || null,
 notes: rxNotes.trim() || null,
 },
 {
 preserveScroll: true,
 onSuccess: () => {
 setReceiveOpen(false);
 setSelectedMed(null);
 },
 onFinish: () => setRxSubmitting(false),
 }
 );
 };

 const handleRefresh = () => {
 setRefreshing(true);
 router.reload({
 only: ['batches', 'summary'],
 onFinish: () => setRefreshing(false),
 });
 };

 const handleExportCsv = () => {
 downloadCsv(
 `batches-${new Date().toISOString().slice(0, 10)}.csv`,
 ['Batch #', 'Medicine', 'SKU', 'Branch', 'Supplier', 'Mfg Date', 'Expiry Date', 'Days Left', 'Available', 'Received', 'Unit', 'Cost Value', 'Status'],
 batches.data.map((b) => [
 b.batch_number,
 b.medicine_name,
 b.medicine_sku,
 b.branch_code || b.branch_name,
 b.supplier_name || 'Direct / Opening',
 b.manufacturing_date,
 b.expiry_date,
 b.days_remaining,
 b.quantity_available,
 b.quantity_received,
 b.unit,
 b.stock_cost_value,
 b.effective_status,
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
 {canReceive && (
 <Button type="button" variant="primary" size="sm" onClick={openReceiveModal}>
 <Plus className="h-3.5 w-3.5" />
 Receive Batch
 </Button>
 )}
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
 <Button type="button" variant="outline" size="sm" onClick={handleExportCsv} disabled={batches.data.length === 0}>
 <Download className="h-3.5 w-3.5" />
 CSV
 </Button>
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
 <button
 type="button"
 onClick={() => {
 setStatus('active');
 applyFilters({ status: 'active' });
 }}
 className="text-left cursor-pointer transition-transform active:scale-[0.99]"
 >
 <MetricCard
 title="Active Sellable Batches"
 value={summary.activeBatches}
 description={`Cost value ${formatCurrency(summary.activeCostValue, currency)}`}
 icon={Boxes}
 colorClass="bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 text-[#0E5F3F]"
 />
 </button>
 <button
 type="button"
 onClick={() => {
 setStatus('expiring_30');
 applyFilters({ status: 'expiring_30' });
 }}
 className="text-left cursor-pointer transition-transform active:scale-[0.99]"
 >
 <MetricCard
 title="Expiring <= 30 Days"
 value={summary.expiring30}
 description={`${summary.expiring60} <=60d · ${summary.expiring90} <=90d`}
 icon={Clock}
 colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
 valueClassName={summary.expiring30 > 0 ? 'text-amber-600' : ''}
 />
 </button>
 <button
 type="button"
 onClick={() => {
 setStatus('expired');
 applyFilters({ status: 'expired' });
 }}
 className="text-left cursor-pointer transition-transform active:scale-[0.99]"
 >
 <MetricCard
 title="Expired Un-disposed"
 value={summary.expiredCount}
 description="Blocked from POS checkout"
 icon={AlertTriangle}
 colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
 valueClassName={summary.expiredCount > 0 ? 'text-rose-600' : ''}
 />
 </button>
 <button
 type="button"
 onClick={() => {
 setStatus('expired');
 applyFilters({ status: 'expired', sort: 'stock_cost_value', dir: 'desc' });
 setSortVal('stock_cost_value:desc');
 }}
 className="text-left cursor-pointer transition-transform active:scale-[0.99]"
 >
 <MetricCard
 title="Expired Cost Risk"
 value={formatCurrency(summary.expiredLossValue, currency)}
 description="Remaining expired batch cost"
 icon={DollarSign}
 colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
 valueClassName={summary.expiredLossValue > 0 ? 'text-rose-600' : ''}
 />
 </button>
 </div>

 <div className="bg-white dark:bg-[#12161c] rounded-[2px] border border-slate-200 dark:border-slate-800">
 <div className="border-b border-slate-200 dark:border-slate-800 px-4 pt-3 flex items-center gap-3 overflow-x-auto hide-scrollbar">
 {statusTabs.map((tab) => {
 const active = status === tab.key;
 const count = summary[tab.countKey];
 return (
 <button
 key={tab.key}
 type="button"
 onClick={() => {
 setStatus(tab.key);
 applyFilters({ status: tab.key });
 }}
 className={`pb-2.5 px-1 text-[12.5px] whitespace-nowrap border-b-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
 active
 ? 'border-[#0E5F3F] text-[#0E5F3F] font-bold'
 : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
 }`}
 >
 <span>{tab.label}</span>
 {typeof count === 'number' && (
 <span
 className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-mono ${
 active
 ? 'bg-[#0E5F3F]/10 text-[#0E5F3F]'
 : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
 }`}
 >
 {count}
 </span>
 )}
 </button>
 );
 })}
 </div>

 <form
 onSubmit={(e) => {
 e.preventDefault();
 applyFilters();
 }}
 className="p-3.5 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
 >
 <div>
 <label className="block text-[12px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
 Search Batch or Medicine
 </label>
 <AnimatedSearchInput
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholders={[
 'Search by Batch #...',
 'Search by medicine name...',
 'Search by SKU...',
 ]}
 icon={<Search className="h-3.5 w-3.5" />}
 wrapperClassName="h-[36px] rounded-[4px]"
 className="h-[36px] rounded-[4px] text-[13px] pl-9 pr-3"
 />
 </div>
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
 <div className="flex items-center gap-2">
 <Button type="submit" variant="primary" size="md">
 Apply
 </Button>
 {(search || supplierId || status !== 'all' || sortVal !== 'expiry_date:asc') && (
 <Button
 type="button"
 variant="outline"
 size="md"
 onClick={() => {
 setSearch('');
 setSupplierId('');
 setStatus('all');
 setSortVal('expiry_date:asc');
 applyFilters({ q: '', supplier_id: '', status: 'all', sort: 'expiry_date', dir: 'asc' });
 }}
 >
 Reset
 </Button>
 )}
 </div>
 </form>

 <DataTable<BatchRow>
 tableId="inventory-batches-table"
 data={batches.data}
 columns={[
 {
 id: 'batch_number',
 label: 'Batch #',
 render: (batch) => (
 <span className="font-sans tabular-nums font-bold tracking-tight text-[#0E5F3F] whitespace-nowrap">
 {batch.batch_number}
 </span>
 ),
 },
 {
 id: 'medicine_name',
 label: 'Medicine',
 render: (batch) => (
 <div className="flex flex-col xl:flex-row xl:items-center xl:gap-1.5 whitespace-nowrap">
 <div className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
 {batch.medicine_name}
 </div>
 <div className="text-[12px] font-sans tabular-nums text-slate-600 dark:text-slate-400">
 <span className="hidden xl:inline text-slate-300 mr-1">·</span>
 {batch.medicine_sku}
 </div>
 </div>
 ),
 },
 {
 id: 'branch_name',
 label: 'Branch',
 render: (batch) => (
 <Badge variant="slate">{batch.branch_code || batch.branch_name}</Badge>
 ),
 },
 {
 id: 'supplier_name',
 label: 'Supplier / Rack',
 render: (batch) => (
 <div className="flex flex-col xl:flex-row xl:items-center xl:gap-1.5 whitespace-nowrap">
 <div className="font-medium text-slate-800 dark:text-slate-200 leading-snug">
 {batch.supplier_name || 'Direct / Opening'}
 </div>
 {batch.rack_location && (
 <div className="text-[12px] text-slate-600 dark:text-slate-400">
 <span className="hidden xl:inline text-slate-300 mr-1">·</span>
 Rack: {batch.rack_location}
 </div>
 )}
 </div>
 ),
 },
 {
 id: 'expiry_date',
 label: 'Mfg / Expiry',
 render: (batch) => (
 <div className="flex flex-col xl:flex-row xl:items-center xl:gap-1.5 font-sans tabular-nums whitespace-nowrap">
 <div className="font-semibold text-slate-900 dark:text-slate-100">
 Exp: {batch.expiry_date || '—'}
 </div>
 {batch.manufacturing_date && (
 <div className="text-[12px] text-slate-600 dark:text-slate-400 font-normal">
 <span className="hidden xl:inline text-slate-300 mr-1">·</span>
 Mfg: {batch.manufacturing_date}
 </div>
 )}
 </div>
 ),
 },
 {
 id: 'quantity_available',
 label: 'Avail / Rcvd',
 className: 'text-right',
 render: (batch) => (
 <span className="font-sans tabular-nums whitespace-nowrap">
 <strong className="font-bold text-slate-900 dark:text-slate-100">
 {batch.quantity_available}
 </strong>
 <span className="text-slate-600 dark:text-slate-400">
 {' '}/ {batch.quantity_received} {batch.unit}
 </span>
 </span>
 ),
 },
 {
 id: 'stock_cost_value',
 label: 'Cost Val',
 className: 'text-right',
 render: (batch) => (
 <span className="font-sans tabular-nums font-bold whitespace-nowrap text-slate-900 dark:text-slate-100">
 {formatCurrency(batch.stock_cost_value ?? 0, currency)}
 </span>
 ),
 },
 {
 id: 'effective_status',
 label: 'Status',
 render: (batch) => (
 <div className="flex flex-col xl:flex-row xl:items-center xl:gap-1.5">
 {renderStatusBadge(batch)}
 {batch.disposal_reason && (
 <div
 className="text-[12px] text-slate-600 dark:text-slate-400 max-w-[160px] truncate"
 title={batch.disposal_reason}
 >
 {batch.disposal_reason}
 </div>
 )}
 </div>
 ),
 },
 ] as Column<BatchRow>[]}
 keyExtractor={(batch) => batch.id}
 hideToolbar
 hidePagination
 hideCheckbox
 syncUrlParams={false}
 actions={(batch) => (
 <div className="flex items-center justify-end gap-1.5">
 <Link href={route('inventory.movements', { q: batch.batch_number })}>
 <Button
 type="button"
 size="sm"
 variant="ghost"
 title="View batch movement history"
 className="h-7 px-2 text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
 >
 <History className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
 </Button>
 </Link>
 {canAdjust &&
 !batch.is_expired &&
 batch.quantity_available > 0 &&
 branches.filter((b) => String(b.id) !== 'all').length > 1 && (
 <Button
 type="button"
 size="sm"
 variant="ghost"
 onClick={() => setTransferringBatch(batch)}
 title="Transfer stock to another branch"
 className="h-7 px-2.5 text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-400"
 >
 <ArrowRightLeft className="h-3.5 w-3.5 text-[#0E5F3F]" />
 Transfer
 </Button>
 )}
 {canAdjust && (
 <Button
 type="button"
 size="sm"
 variant={batch.is_expired ? 'danger' : 'ghost'}
 onClick={() => setAdjustingBatch(batch)}
 className={
 batch.is_expired
 ? 'h-7 px-2.5 text-xs font-medium'
 : 'h-7 px-2.5 text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-400'
 }
 >
 <SlidersHorizontal className="h-3.5 w-3.5" />
 {batch.is_expired ? 'Dispose' : 'Adjust'}
 </Button>
 )}
 </div>
 )}
 actionsColumnClassName="w-[220px] min-w-[220px]"
 emptyState={
 <EmptyState
 icon={Boxes}
 title="No medicine batches match your current filters."
 />
 }
 />

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

 {/* Receive New Batch Modal */}
 <BrtaFormModal
 open={receiveOpen}
 onClose={() => setReceiveOpen(false)}
 onSubmit={handleSubmitReceive}
 title="Receive New Stock Batch"
 subtitle="Search any catalog medicine and add a new FEFO batch directly into branch inventory."
 icon={<Plus className="h-4 w-4 text-[#0E5F3F]" />}
 maxWidth="3xl"
 footerProps={{
 cancelLabel: 'Cancel',
 submitLabel: 'Receive Batch',
 submitting: rxSubmitting,
 submitDisabled: !selectedMed || !rxBatchNumber.trim() || !rxExpiryDate,
 }}
 >
 <div className="space-y-3">
 <div>
 <label className="block text-[12px] font-semibold text-[#333333] dark:text-slate-200 mb-1">
 Search & Select Medicine *
 </label>
 <div className="relative">
 <input
 type="text"
 value={medQuery}
 onChange={(e) => setMedQuery(e.target.value)}
 placeholder="Type medicine name, generic or SKU..."
 className={brtaInputClass}
 />
 {medLoading && (
 <span className="absolute right-3 top-2 text-[11px] text-slate-400">Searching...</span>
 )}
 </div>
 {selectedMed ? (
 <div className="mt-2 p-2.5 rounded-[2px] border border-[#0E5F3F]/35 bg-[#EAF5F0]/60 dark:bg-emerald-950/20 flex items-center justify-between gap-2 text-xs">
 <div>
 <span className="font-bold text-[#0E5F3F] dark:text-emerald-300">
 {selectedMed.name}
 </span>{' '}
 <span className="text-slate-500 font-mono">({selectedMed.sku})</span>
 {selectedMed.generic_name && (
 <div className="text-[11px] text-slate-600 dark:text-slate-400">
 {selectedMed.generic_name} · Unit: {selectedMed.unit}
 </div>
 )}
 </div>
 <Button type="button" variant="outline" size="sm" onClick={() => setSelectedMed(null)}>
 Change
 </Button>
 </div>
 ) : (
 <div className="mt-1.5 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-[2px] divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#12161c]">
 {medResults.length === 0 ? (
 <div className="px-3 py-2 text-xs text-slate-500">
 {medLoading ? 'Searching catalog...' : 'No medicines found. Try another keyword.'}
 </div>
 ) : (
 medResults.map((m) => (
 <button
 key={m.id}
 type="button"
 onClick={() => handleSelectMedicine(m)}
 className="w-full text-left px-3 py-2 hover:bg-[#EAF5F0]/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer flex items-center justify-between gap-2 text-xs"
 >
 <div className="min-w-0">
 <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
 {m.name}
 </div>
 <div className="text-[11px] text-slate-500 truncate">
 {m.sku}
 {m.generic_name ? ` · ${m.generic_name}` : ''}
 </div>
 </div>
 <span className="shrink-0 font-mono text-[11px] text-[#0E5F3F] dark:text-emerald-400">
 Select →
 </span>
 </button>
 ))
 )}
 </div>
 )}
 </div>

 <BrtaFormGrid>
 <BrtaField label="Branch">
 <select
 value={rxBranchId}
 onChange={(e) => setRxBranchId(e.target.value)}
 className={brtaInputClass}
 >
 {branches
 .filter((b) => String(b.id) !== 'all')
 .map((b) => (
 <option key={b.id} value={b.id}>
 {b.name} ({b.code})
 </option>
 ))}
 </select>
 </BrtaField>
 <BrtaField label="Supplier">
 <select
 value={rxSupplierId}
 onChange={(e) => setRxSupplierId(e.target.value)}
 className={brtaInputClass}
 >
 <option value="">Direct / Unassigned</option>
 {suppliers.map((s) => (
 <option key={s.id} value={s.id}>
 {s.name}
 </option>
 ))}
 </select>
 </BrtaField>
 <BrtaField label="Batch Number" required>
 <input
 type="text"
 value={rxBatchNumber}
 onChange={(e) => setRxBatchNumber(e.target.value)}
 className={`${brtaInputClass} font-mono`}
 required
 />
 </BrtaField>
 <BrtaField label="Expiry Date" required>
 <input
 type="date"
 value={rxExpiryDate}
 onChange={(e) => setRxExpiryDate(e.target.value)}
 className={brtaInputClass}
 required
 />
 </BrtaField>
 <BrtaField label={`Quantity (${selectedMed?.unit || 'Units'})`} required>
 <input
 type="number"
 min={1}
 value={rxQty}
 onChange={(e) => setRxQty(e.target.value)}
 className={`${brtaInputClass} font-mono`}
 required
 />
 </BrtaField>
 <BrtaField label="Rack Location">
 <input
 type="text"
 value={rxRack}
 onChange={(e) => setRxRack(e.target.value)}
 placeholder="e.g. R-04 / Shelf B"
 className={brtaInputClass}
 />
 </BrtaField>
 <BrtaField label="Unit Purchase Cost">
 <input
 type="number"
 step="0.01"
 min={0}
 value={rxPurchasePrice}
 onChange={(e) => setRxPurchasePrice(e.target.value)}
 className={`${brtaInputClass} font-mono`}
 />
 </BrtaField>
 <BrtaField label="Unit Selling Price">
 <input
 type="number"
 step="0.01"
 min={0}
 value={rxSellingPrice}
 onChange={(e) => setRxSellingPrice(e.target.value)}
 className={`${brtaInputClass} font-mono`}
 />
 </BrtaField>
 <BrtaField label="Notes" alignTop>
 <textarea
 rows={2}
 value={rxNotes}
 onChange={(e) => setRxNotes(e.target.value)}
 placeholder="Invoice / delivery note"
 className={brtaTextareaClass}
 />
 </BrtaField>
 </BrtaFormGrid>
 </div>
 </BrtaFormModal>
 </AppLayout>
 );
}
