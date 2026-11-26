import React, { useMemo, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import {
 CheckCircle2,
 Clock,
 FileCheck2,
 Plus,
 RotateCcw,
 X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import {
 BrtaField,
 BrtaFormModal,
 brtaInputClass,
 brtaTextareaClass,
} from '@/Components/ui/BrtaForm';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { formatCurrency } from '@/lib/format';

interface ReturnRow {
 id: number;
 return_number: string;
 credit_note_number?: string | null;
 invoice_number: string;
 customer_name: string;
 requested_by: string;
 approved_by?: string | null;
 return_amount: number;
 reason: string;
 notes?: string | null;
 status: 'pending' | 'approved' | 'rejected' | string;
 credit_note_status: 'pending' | 'issued' | 'applied' | 'void' | string;
 created_at?: string | null;
}

interface EligibleSale {
 id: number;
 invoice_number: string;
 customer_name: string;
 total_amount: number;
 sold_at?: string | null;
}

interface ReturnsProps {
 returns: ReturnRow[];
 eligibleSales: EligibleSale[];
 summary: {
 total_requests: number;
 pending_count: number;
 issued_credit_notes: number;
 total_return_value: number;
 };
 canApprove: boolean;
 branchName?: string | null;
 currency: string;
}

export default function SalesReturns({
 returns = [],
 eligibleSales = [],
 summary,
 canApprove = false,
 branchName,
 currency = 'BDT',
}: ReturnsProps) {
 const [modalOpen, setModalOpen] = useState(false);

 const form = useForm({
 sale_id: '',
 return_amount: '',
 reason: 'Damaged / Near-Expiry Medicine',
 notes: '',
 });

 const selectedSale = eligibleSales.find((s) => String(s.id) === String(form.data.sale_id));

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 form.post(route('sales.returns.store'), {
 preserveScroll: true,
 onSuccess: () => {
 setModalOpen(false);
 form.reset();
 },
 });
 };

 const handleStatusAction = (id: number, action: 'approve' | 'reject') => {
 router.post(
 route('sales.returns.status', id),
 { action },
 { preserveScroll: true }
 );
 };

 const returnColumns: Column<ReturnRow>[] = useMemo(
 () => [
 {
 id: 'return_number',
 label: 'Return #',
 sortable: true,
 render: (row) => (
 <div>
 <div className="tabular-nums font-bold text-[#0E5F3F] dark:text-emerald-400">
 {row.return_number}
 </div>
 <div className="tabular-nums text-[10px] text-[#666666] dark:text-slate-400">
 {row.created_at}
 </div>
 </div>
 ),
 },
 {
 id: 'invoice_number',
 label: 'Invoice',
 sortable: true,
 render: (row) => (
 <span className="tabular-nums font-semibold text-[#222222] dark:text-white">
 {row.invoice_number}
 </span>
 ),
 },
 {
 id: 'customer_name',
 label: 'Customer',
 sortable: true,
 render: (row) => (
 <span className="font-medium text-[#222222] dark:text-white">
 {row.customer_name}
 </span>
 ),
 },
 {
 id: 'reason',
 label: 'Reason',
 render: (row) => (
 <div className="max-w-[240px]">
 <div className="truncate font-medium text-[#333333] dark:text-slate-200">
 {row.reason}
 </div>
 {row.notes && (
 <div className="text-[10.5px] text-[#666666] dark:text-slate-400 truncate">
 {row.notes}
 </div>
 )}
 </div>
 ),
 },
 {
 id: 'return_amount',
 label: 'Amount',
 sortable: true,
 className: 'text-right',
 render: (row) => (
 <span className="tabular-nums font-bold text-[#222222] dark:text-white">
 {formatCurrency(row.return_amount, currency)}
 </span>
 ),
 },
 {
 id: 'status',
 label: 'Return Status',
 sortable: true,
 className: 'text-center',
 render: (row) => (
 <span
 className={`px-2 py-0.5 rounded-[2px] text-[10.5px] font-bold ${
 row.status === 'approved'
 ? 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25'
 : row.status === 'rejected'
 ? 'bg-rose-50 text-rose-700 border border-rose-200'
 : 'bg-amber-50 text-amber-700 border border-amber-200'
 }`}
 >
 {row.status}
 </span>
 ),
 },
 {
 id: 'credit_note_number',
 label: 'Credit Note',
 render: (row) => (
 <div>
 <div className="tabular-nums text-[11px] font-bold text-[#222222] dark:text-white">
 {row.credit_note_number || '—'}
 </div>
 <span className="text-[10px] font-semibold text-[#555555] dark:text-slate-400">
 {row.credit_note_status}
 </span>
 </div>
 ),
 },
 ],
 [currency]
 );

 return (
 <AppLayout
 title="Returns & Credit Notes"
 subtitle={`${branchName ?? 'Branch'} · Sales return requests and credit note status tracking`}
 actions={
 <Button
 type="button"
 variant="primary"
 size="sm"
 onClick={() => setModalOpen(true)}
 >
 <Plus className="h-3.5 w-3.5"/>
 <span>New Return Request</span>
 </Button>
 }
 >
 <Head title="Returns & Credit Notes"/>

 <div className="space-y-4">
 {/* KPI Row */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch">
 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Total Requests
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-[#EAF5F0] dark:bg-[#0E5F3F]/20 text-[#0E5F3F] dark:text-emerald-400 flex items-center justify-center">
 <RotateCcw className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5 tabular-nums text-xl font-bold text-[#222222] dark:text-white">
 {summary.total_requests}
 </div>
 </div>

 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Pending Review
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
 <Clock className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5 tabular-nums text-xl font-bold text-amber-700 dark:text-amber-400">
 {summary.pending_count}
 </div>
 </div>

 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Credit Notes Issued
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-[#EAF5F0] dark:bg-[#0E5F3F]/20 text-[#0E5F3F] dark:text-emerald-400 flex items-center justify-center">
 <FileCheck2 className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5 tabular-nums text-xl font-bold text-[#0E5F3F] dark:text-emerald-400">
 {summary.issued_credit_notes}
 </div>
 </div>

 <div className="h-full rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#12161c] p-4 flex flex-col justify-between">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 Total Return Value
 </span>
 <span className="h-7 w-7 rounded-[2px] bg-sky-50 dark:bg-sky-950/40 text-[#337AB7] dark:text-sky-400 flex items-center justify-center">
 <CheckCircle2 className="h-3.5 w-3.5"/>
 </span>
 </div>
 <div className="mt-2.5 tabular-nums text-xl font-bold text-[#222222] dark:text-white">
 {formatCurrency(summary.total_return_value, currency)}
 </div>
 </div>
 </div>

 {/* Returns & Credit Notes DataTable */}
 <DataTable<ReturnRow>
 tableId="sales-returns-table"
 data={returns}
 columns={returnColumns}
 keyExtractor={(row) => row.id}
 searchPlaceholder="Search return #, invoice, customer or reason..."
 hideCheckbox
 hideViewToggle
 hideFilter
 compact
 headerTabs={
 <span className="text-xs font-bold text-[#0E5F3F] dark:text-emerald-400">
 Return Requests & Credit Note Status ({returns.length})
 </span>
 }
 actions={
 canApprove
 ? (row) =>
 row.status === 'pending' ? (
 <div className="inline-flex items-center gap-1.5">
 <Button
 type="button"
 size="sm"
 variant="primary"
 onClick={() => handleStatusAction(row.id, 'approve')}
 className="h-7 px-2.5 text-[11px]"
 >
 Issue CN
 </Button>
 <Button
 type="button"
 size="sm"
 variant="danger"
 onClick={() => handleStatusAction(row.id, 'reject')}
 className="h-7 px-2.5 text-[11px]"
 >
 Reject
 </Button>
 </div>
 ) : (
 <span className="text-[11px] text-[#666666]">
 {row.approved_by || 'Reviewed'}
 </span>
 )
 : undefined
 }
 emptyState={
 <EmptyState
 icon={RotateCcw}
 title="No return requests yet"
 description="Submit a return request to track approval and credit note issuance."
 />
 }
 />
 </div>

 {/* New Return Request Modal */}
 <BrtaFormModal
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 onSubmit={handleSubmit}
 title="Submit Return Request"
 subtitle="Create a sales return request and track approval & credit note issuance"
 icon={<RotateCcw className="h-4 w-4"/>}
 maxWidth="2xl"
 footerProps={{
 submitLabel: 'Submit Request',
 submitting: form.processing,
 }}
 >
 <BrtaField label="Select Invoice" required error={form.errors.sale_id}>
 <select
 required
 value={form.data.sale_id}
 onChange={(e) => {
 const val = String(e.target.value);
 const found = eligibleSales.find((s) => String(s.id) === val);
 form.setData((prev) => ({
 ...prev,
 sale_id: val,
 return_amount: found ? String(found.total_amount) : prev.return_amount,
 }));
 }}
 className={brtaInputClass}
 >
 <option value="">Choose an invoice...</option>
 {eligibleSales.map((s) => (
 <option key={s.id} value={String(s.id)}>
 {s.invoice_number} — {s.customer_name} ({formatCurrency(s.total_amount, currency)})
 </option>
 ))}
 </select>
 </BrtaField>

 <BrtaField label="Return Amount" required error={form.errors.return_amount}>
 <input
 type="number"
 step="0.01"
 min="0.01"
 max={selectedSale?.total_amount}
 required
 value={form.data.return_amount}
 onChange={(e) => form.setData('return_amount', e.target.value)}
 className={`${brtaInputClass} font-mono`}
 />
 </BrtaField>

 <BrtaField label="Return Reason" required error={form.errors.reason}>
 <input
 type="text"
 required
 value={form.data.reason}
 onChange={(e) => form.setData('reason', e.target.value)}
 className={brtaInputClass}
 />
 </BrtaField>

 <BrtaField label="Details / Batch Notes" alignTop error={form.errors.notes}>
 <textarea
 rows={3}
 value={form.data.notes}
 onChange={(e) => form.setData('notes', e.target.value)}
 placeholder="Batch number, quantity returned, or credit note remarks"
 className={brtaTextareaClass}
 />
 </BrtaField>
 </BrtaFormModal>
 </AppLayout>
 );
}

