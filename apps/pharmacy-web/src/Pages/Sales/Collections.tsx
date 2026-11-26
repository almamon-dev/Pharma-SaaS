import React, { useMemo, useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import {
 AlertTriangle,
 Banknote,
 CheckCircle2,
 Clock,
 Receipt,
 Search,
 Wallet,
 X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import {
 BrtaField,
 BrtaFormModal,
 BrtaOptionItem,
 BrtaOptionStrip,
 brtaInputClass,
} from '@/Components/ui/BrtaForm';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { formatCurrency } from '@/lib/format';

interface DueSaleRow {
 id: number;
 invoice_number: string;
 customer_id?: number | null;
 customer_name: string;
 customer_phone?: string | null;
 sold_at: string;
 days_due: number;
 ageing_bucket: '0_15' | '16_30' | '31_60' | '60_plus';
 total_amount: number;
 paid_amount: number;
 due_amount: number;
 payment_status: string;
}

interface RecentPaymentRow {
 id: number;
 invoice_number: string;
 customer_name: string;
 payment_method: string;
 amount: number;
 reference_number?: string | null;
 paid_at?: string | null;
}

interface CollectionsProps {
 dueSales: DueSaleRow[];
 recentPayments: RecentPaymentRow[];
 ageing: {
 '0_15': { count: number; amount: number };
 '16_30': { count: number; amount: number };
 '31_60': { count: number; amount: number };
 '60_plus': { count: number; amount: number };
 };
 summary: {
 total_due: number;
 overdue_30_plus: number;
 collected_today: number;
 pending_invoices: number;
 };
 branchName?: string | null;
 currency: string;
}

const BUCKET_META = [
 { key: '0_15' as const, label: '0–15 Days', tone: 'text-[#0E5F3F] dark:text-emerald-400' },
 { key: '16_30' as const, label: '16–30 Days', tone: 'text-[#337AB7] dark:text-sky-400' },
 { key: '31_60' as const, label: '31–60 Days', tone: 'text-amber-700 dark:text-amber-400' },
 { key: '60_plus' as const, label: '60+ Days', tone: 'text-rose-700 dark:text-rose-400' },
];

export default function SalesCollections({
 dueSales = [],
 recentPayments = [],
 ageing,
 summary,
 branchName,
 currency = 'BDT',
}: CollectionsProps) {
 const [bucketFilter, setBucketFilter] = useState<'all' | '0_15' | '16_30' | '31_60' | '60_plus'>('all');
 const [activeSale, setActiveSale] = useState<DueSaleRow | null>(null);

 const form = useForm({
 amount: '',
 payment_method: 'cash',
 reference_number: '',
 notes: '',
 });

 const filteredDues = useMemo(() => {
 if (bucketFilter === 'all') return dueSales;
 return dueSales.filter((row) => row.ageing_bucket === bucketFilter);
 }, [dueSales, bucketFilter]);

 const dueColumns: Column<DueSaleRow>[] = useMemo(
 () => [
 {
 id: 'invoice_number',
 label: 'Invoice',
 sortable: true,
 render: (row) => (
 <span className="tabular-nums font-bold text-[#0E5F3F] dark:text-emerald-400">
 {row.invoice_number}
 </span>
 ),
 },
 {
 id: 'customer_name',
 label: 'Customer',
 sortable: true,
 render: (row) => (
 <div>
 <div className="font-semibold text-[#222222] dark:text-white">
 {row.customer_name}
 </div>
 {row.customer_phone && (
 <div className="tabular-nums text-[10.5px] text-[#666666] dark:text-slate-400">
 {row.customer_phone}
 </div>
 )}
 </div>
 ),
 },
 {
 id: 'sold_at',
 label: 'Invoice Date',
 sortable: true,
 render: (row) => (
 <span className="tabular-nums text-[#555555] dark:text-slate-300">
 {row.sold_at}
 </span>
 ),
 },
 {
 id: 'days_due',
 label: 'Ageing',
 sortable: true,
 className: 'text-center',
 render: (row) => (
 <span
 className={`tabular-nums px-2 py-0.5 rounded-[2px] text-[11px] font-bold ${
 row.days_due > 60
 ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300'
 : row.days_due > 30
 ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300'
 : 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25'
 }`}
 >
 {row.days_due}d
 </span>
 ),
 },
 {
 id: 'total_amount',
 label: 'Total',
 sortable: true,
 className: 'text-right',
 render: (row) => (
 <span className="tabular-nums text-[#333333] dark:text-slate-300">
 {formatCurrency(row.total_amount, currency)}
 </span>
 ),
 },
 {
 id: 'paid_amount',
 label: 'Paid',
 sortable: true,
 className: 'text-right',
 render: (row) => (
 <span className="tabular-nums text-[#0E5F3F] dark:text-emerald-400">
 {formatCurrency(row.paid_amount, currency)}
 </span>
 ),
 },
 {
 id: 'due_amount',
 label: 'Due Balance',
 sortable: true,
 className: 'text-right',
 render: (row) => (
 <span className="tabular-nums font-bold text-rose-700 dark:text-rose-400">
 {formatCurrency(row.due_amount, currency)}
 </span>
 ),
 },
 ],
 [currency]
 );

 const paymentColumns: Column<RecentPaymentRow>[] = useMemo(
 () => [
 {
 id: 'paid_at',
 label: 'Date & Time',
 sortable: true,
 render: (p) => (
 <span className="tabular-nums text-[#555555] dark:text-slate-400">
 {p.paid_at || '—'}
 </span>
 ),
 },
 {
 id: 'invoice_number',
 label: 'Invoice',
 sortable: true,
 render: (p) => (
 <span className="tabular-nums font-semibold text-[#0E5F3F] dark:text-emerald-400">
 {p.invoice_number}
 </span>
 ),
 },
 {
 id: 'customer_name',
 label: 'Customer',
 sortable: true,
 render: (p) => (
 <span className="font-medium text-[#222222] dark:text-white">
 {p.customer_name}
 </span>
 ),
 },
 {
 id: 'payment_method',
 label: 'Method',
 render: (p) => (
 <span className="text-[11px] font-semibold">
 {p.payment_method}
 </span>
 ),
 },
 {
 id: 'reference_number',
 label: 'Reference',
 render: (p) => (
 <span className="tabular-nums text-[#666666] dark:text-slate-400">
 {p.reference_number || '—'}
 </span>
 ),
 },
 {
 id: 'amount',
 label: 'Collected Amount',
 sortable: true,
 className: 'text-right',
 render: (p) => (
 <span className="tabular-nums font-bold text-[#0E5F3F] dark:text-emerald-400">
 {formatCurrency(p.amount, currency)}
 </span>
 ),
 },
 ],
 [currency]
 );

 const openCollectModal = (sale: DueSaleRow) => {
 setActiveSale(sale);
 form.setData({
 amount: String(sale.due_amount),
 payment_method: 'cash',
 reference_number: '',
 notes: '',
 });
 form.clearErrors();
 };

 const handleSubmitCollection = (e: React.FormEvent) => {
 e.preventDefault();
 if (!activeSale) return;

 form.post(route('sales.collections.pay', activeSale.id), {
 preserveScroll: true,
 onSuccess: () => {
 setActiveSale(null);
 form.reset();
 },
 });
 };

 return (
 <AppLayout
 title="Collections & Dues"
 subtitle={`${branchName ?? 'Branch'} · Due ageing tracker and customer collection entry`}
 >
 <Head title="Collections & Dues"/>

 <div className="space-y-4">
 {/* KPI Row */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch">
 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Total Outstanding Due
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 flex items-center justify-center">
 <Wallet className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5 tabular-nums text-xl font-bold text-rose-700 dark:text-rose-400">
 {formatCurrency(summary.total_due, currency)}
 </div>
 </div>

 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Overdue (30+ Days)
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
 <AlertTriangle className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5 tabular-nums text-xl font-bold text-amber-700 dark:text-amber-400">
 {formatCurrency(summary.overdue_30_plus, currency)}
 </div>
 </div>

 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Collected Today
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-[#EAF5F0] dark:bg-[#0E5F3F]/20 text-[#0E5F3F] dark:text-emerald-400 flex items-center justify-center">
 <Banknote className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5 tabular-nums text-xl font-bold text-[#0E5F3F] dark:text-emerald-400">
 {formatCurrency(summary.collected_today, currency)}
 </div>
 </div>

 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Open Due Invoices
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-sky-50 dark:bg-sky-950/40 text-[#337AB7] dark:text-sky-400 flex items-center justify-center">
 <Receipt className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5 tabular-nums text-xl font-bold text-[#222222] dark:text-white">
 {summary.pending_invoices}
 </div>
 </div>
 </div>

 {/* Due Ageing Buckets */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {BUCKET_META.map((b) => {
 const data = ageing[b.key];
 const active = bucketFilter === b.key;
 return (
 <button
 key={b.key}
 type="button"
 onClick={() => setBucketFilter(active ? 'all' : b.key)}
 className={`text-left rounded-[2px] border p-3.5 transition-colors cursor-pointer ${
 active
 ? 'border-[#0E5F3F] bg-[#EAF5F0] dark:bg-[#0E5F3F]/20'
 : 'border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] hover:border-[#0E5F3F]/50'
 }`}
 >
 <div className="flex items-center justify-between text-xs">
 <span className="font-bold text-[#333333] dark:text-slate-200 flex items-center gap-1.5">
 <Clock className="h-3.5 w-3.5 text-[#777777]"/>
 {b.label}
 </span>
 <span className="tabular-nums text-[11px] px-1.5 py-0.5 rounded-[2px] bg-[#EAECE9] dark:bg-slate-800 text-[#333333] dark:text-slate-300 font-semibold">
 {data.count}
 </span>
 </div>
 <div className={`mt-2 tabular-nums text-base font-bold ${b.tone}`}>
 {formatCurrency(data.amount, currency)}
 </div>
 </button>
 );
 })}
 </div>

 {/* Outstanding Dues DataTable */}
 <DataTable<DueSaleRow>
 tableId="sales-collections-dues"
 data={filteredDues}
 columns={dueColumns}
 keyExtractor={(row) => row.id}
 searchPlaceholder="Search invoice or customer..."
 hideCheckbox
 hideViewToggle
 hideFilter
 compact
 headerTabs={
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-[#0E5F3F] dark:text-emerald-400">
 Outstanding Customer Dues ({filteredDues.length})
 </span>
 {bucketFilter !== 'all' && (
 <button
 type="button"
 onClick={() => setBucketFilter('all')}
 className="text-[11px] font-semibold text-[#337AB7] hover:underline cursor-pointer"
 >
 Clear ageing filter
 </button>
 )}
 </div>
 }
 actions={(row) => (
 <Button
 type="button"
 size="sm"
 variant="primary"
 onClick={() => openCollectModal(row)}
 className="h-7 px-2.5 text-[11px]"
 >
 Collect Payment
 </Button>
 )}
 emptyState={
 <EmptyState
 icon={CheckCircle2}
 title="All clear!"
 description="No outstanding due invoices found."
 />
 }
 />

 {/* Recent Collections DataTable */}
 <DataTable<RecentPaymentRow>
 tableId="sales-recent-collections"
 data={recentPayments}
 columns={paymentColumns}
 keyExtractor={(p) => p.id}
 searchPlaceholder="Search recent collections..."
 hideCheckbox
 hideViewToggle
 hideFilter
 compact
 headerTabs={
 <span className="text-xs font-bold text-[#0E5F3F] dark:text-emerald-400">
 Recent Collection Entries ({recentPayments.length})
 </span>
 }
 emptyState={
 <EmptyState
 icon={Banknote}
 title="No collections recorded yet"
 description="Recorded customer due payments will appear here."
 />
 }
 />
 </div>

 {/* Record Collection Modal */}
 <BrtaFormModal
 open={Boolean(activeSale)}
 onClose={() => setActiveSale(null)}
 onSubmit={handleSubmitCollection}
 title="Record Due Collection"
 subtitle={
 activeSale
 ? `${activeSale.invoice_number} · ${activeSale.customer_name}`
 : undefined
 }
 icon={<Banknote className="h-4 w-4"/>}
 maxWidth="xl"
 footerProps={{
 submitLabel: 'Save Collection',
 submitting: form.processing,
 }}
 >
 {activeSale && (
 <div className="rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F8FAF8] dark:bg-[#12161c] px-4 py-2.5 flex items-center justify-between text-xs">
 <span className="font-semibold text-[#555555] dark:text-slate-400">
 Remaining Due
 </span>
 <span className="font-mono text-base font-bold text-[#C9302C] dark:text-rose-400">
 {formatCurrency(activeSale.due_amount, currency)}
 </span>
 </div>
 )}

 <BrtaField label="Collection Amount" required error={form.errors.amount}>
 <input
 type="number"
 step="0.01"
 min="0.01"
 max={activeSale?.due_amount}
 required
 value={form.data.amount}
 onChange={(e) => form.setData('amount', e.target.value)}
 className={`${brtaInputClass} font-mono`}
 />
 </BrtaField>

 <BrtaField label="Payment Method" required>
 <BrtaOptionStrip>
 {([
 ['cash', 'Cash'],
 ['card', 'Card'],
 ['bkash', 'bKash'],
 ['nagad', 'Nagad'],
 ] as const).map(([val, label]) => (
 <BrtaOptionItem key={val}>
 <input
 type="radio"
 name="collection_payment_method"
 checked={form.data.payment_method === val}
 onChange={() => form.setData('payment_method', val)}
 className="text-[#0E5F3F] focus:ring-[#0E5F3F]"
 />
 <span>{label}</span>
 </BrtaOptionItem>
 ))}
 </BrtaOptionStrip>
 </BrtaField>

 <BrtaField
 label="Transaction / Ref #"
 error={form.errors.reference_number}
 >
 <input
 type="text"
 value={form.data.reference_number}
 onChange={(e) => form.setData('reference_number', e.target.value)}
 placeholder="Optional TrxID or slip #"
 className={`${brtaInputClass} font-mono`}
 />
 </BrtaField>

 <BrtaField label="Notes" error={form.errors.notes}>
 <input
 type="text"
 value={form.data.notes}
 onChange={(e) => form.setData('notes', e.target.value)}
 placeholder="Optional collection note"
 className={brtaInputClass}
 />
 </BrtaField>
 </BrtaFormModal>
 </AppLayout>
 );
}

