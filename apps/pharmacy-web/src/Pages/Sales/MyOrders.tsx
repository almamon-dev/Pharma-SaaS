import React, { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
 Activity,
 AlertCircle,
 Ban,
 CheckCircle2,
 ChevronDown,
 Clock,
 Package,
 Plus,
 RefreshCw,
 Search,
 ShoppingCart,
 User,
 X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { AnimatedSearchInput } from '@/Components/ui/AnimatedSearchInput';
import { Column, DataTable } from '@/Components/tables';
import { formatCurrency } from '@/lib/format';

interface OrderItem {
 medicine_name?: string;
 quantity: number;
 sale_unit?: string;
 line_total: number;
}

export interface MyOrderRecord {
 id: number;
 order_number: string;
 invoice_number?: string | null;
 customer_name: string;
 customer_phone?: string | null;
 counter_id?: number | null;
 counter_name?: string | null;
 counter_code?: string | null;
 order_status: string;
 payment_status: string;
 subtotal?: number;
 discount_amount?: number;
 discount_status?: string;
 discount_percentage?: number;
 tax_amount?: number;
 total_amount: number;
 paid_amount: number;
 items_count: number;
 notes?: string | null;
 internal_notes?: string | null;
 prescription_reference?: string | null;
 created_at?: string;
 assigned_at?: string;
 completed_at?: string;
 prescription_file?: string | null;
 items: OrderItem[];
}

interface PaginatedOrders {
 data: MyOrderRecord[];
 current_page: number;
 last_page: number;
 per_page: number;
 total: number;
 links: Array<{ url: string | null; label: string; active: boolean }>;
}

interface MyOrdersProps {
 orders: PaginatedOrders;
 filters: {
 status?: string;
 search?: string;
 };
 currency: string;
 branchName?: string;
}

interface TrackData {
 order_number: string;
 order_status: string;
 counter?: {
 id: number;
 name: string;
 code: string;
 status: string;
 } | null;
 cashier_name?: string | null;
 total_amount: number;
 timeline: Array<{
 status: string;
 user?: string | null;
 reason?: string | null;
 timestamp?: string;
 }>;
}

export default function MyOrders({
 orders,
 filters,
 currency = 'BDT',
 branchName,
}: MyOrdersProps) {
 const [activeStatus, setActiveStatus] = useState(filters.status || 'all');
 const [searchQuery, setSearchQuery] = useState(filters.search || '');

 // Tracking Modal State
 const [trackingOrder, setTrackingOrder] = useState<MyOrderRecord | null>(null);
 const [trackData, setTrackData] = useState<TrackData | null>(null);
 const [trackLoading, setTrackLoading] = useState(false);

 // Cancel Modal State
 const [cancelOrderTarget, setCancelOrderTarget] = useState<MyOrderRecord | null>(null);
 const [cancelReason, setCancelReason] = useState('');
 const [cancelSubmitting, setCancelSubmitting] = useState(false);

 // Order Items Preview Modal
 const [viewingItemsOrder, setViewingItemsOrder] = useState<MyOrderRecord | null>(null);

 // Extract list from paginator or array
 const orderList = useMemo(() => {
 return Array.isArray(orders) ? orders : orders?.data ?? [];
 }, [orders]);

 const handleFilterChange = (status: string) => {
 setActiveStatus(status);
 router.get(
 route('sales.orders.my-orders'),
 {
 status: status !== 'all' ? status : undefined,
 search: searchQuery.trim() || undefined,
 },
 { preserveState: true }
 );
 };

 const handleSearchSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 router.get(
 route('sales.orders.my-orders'),
 {
 status: activeStatus !== 'all' ? activeStatus : undefined,
 search: searchQuery.trim() || undefined,
 },
 { preserveState: true }
 );
 };

 const openTracker = async (order: MyOrderRecord) => {
 setTrackingOrder(order);
 setTrackLoading(true);
 try {
 const resp = await fetch(route('sales.orders.track', order.id));
 if (resp.ok) {
 const data = await resp.json();
 setTrackData(data);
 }
 } catch (e) {
 console.error('Failed to track order', e);
 } finally {
 setTrackLoading(false);
 }
 };

 const handleConfirmCancel = (e: React.FormEvent) => {
 e.preventDefault();
 if (!cancelOrderTarget || !cancelReason.trim()) return;

 setCancelSubmitting(true);
 router.post(
 route('sales.orders.cancel', cancelOrderTarget.id),
 { reason: cancelReason.trim() },
 {
 onSuccess: () => {
 setCancelSubmitting(false);
 setCancelOrderTarget(null);
 setCancelReason('');
 },
 onError: (errs) => {
 setCancelSubmitting(false);
 alert(Object.values(errs)[0] || 'Failed to cancel order.');
 },
 }
 );
 };

 // Columns Definition matching Cashier Station style exactly
 const columns: Column<MyOrderRecord>[] = [
 {
 id: 'order_number',
 label: 'Order ID',
 className: 'w-[130px]',
 render: (order) => (
 <div className="flex items-center gap-1.5">
 <span className="font-bold tabular-nums text-[#0E5F3F] text-[11.5px]">
 {order.order_number}
 </span>
 {order.prescription_file && (
 <span className="text-[9.5px] px-1 py-0.2 rounded-[2px] bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
 Rx
 </span>
 )}
 </div>
 ),
 },
 {
 id: 'customer',
 label: 'Customer',
 className: 'min-w-[150px]',
 render: (order) => (
 <div className="flex items-center gap-2">
 <div className="w-6.5 h-6.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center shrink-0">
 <User className="h-3.5 w-3.5"/>
 </div>
 <div className="truncate">
 <div className="font-bold text-[11.5px] text-slate-900 dark:text-slate-200 leading-tight truncate">
 {order.customer_name}
 </div>
 {order.customer_phone ? (
 <div className="text-[9.5px] text-slate-500 tabular-nums font-medium leading-tight">
 {order.customer_phone}
 </div>
 ) : null}
 </div>
 </div>
 ),
 },
 {
 id: 'counter',
 label: 'Assigned Counter',
 className: 'min-w-[140px]',
 render: (order) => {
 if (order.counter_code) {
 return (
 <div className="flex items-center gap-1.5 truncate">
 <span className="px-1.5 py-0.5 rounded-[2px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 text-[9.5px] font-bold tabular-nums shrink-0 whitespace-nowrap">
 {order.counter_code}
 </span>
 <span className="text-[11.5px] text-slate-800 dark:text-slate-200 truncate font-semibold">
 {order.counter_name}
 </span>
 </div>
 );
 }
 if (order.order_status === 'draft') {
 return <span className="text-slate-500 text-[11.5px] italic font-medium">Unsubmitted Draft</span>;
 }
 return (
 <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[9.5px] font-bold">
 <AlertCircle className="h-3 w-3"/>
 Unassigned
 </span>
 );
 },
 },
 {
 id: 'items',
 label: 'Items',
 className: 'w-[90px]',
 render: (order) => (
 <button
 type="button"
 onClick={() => setViewingItemsOrder(order)}
 className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300 hover:text-[#0E5F3F] hover:underline cursor-pointer"
 >
 {order.items_count} items
 </button>
 ),
 },
 {
 id: 'total_amount',
 label: 'Payable Amount',
 className: 'w-[120px]',
 render: (order) => (
 <span className="font-bold text-slate-900 dark:text-slate-200 text-[11.5px]">
 {formatCurrency(order.total_amount, currency)}
 </span>
 ),
 },
 {
 id: 'assigned_time',
 label: 'Assigned Time',
 className: 'min-w-[130px]',
 render: (order) => (
 <div>
 <div className="text-[11.5px] font-medium text-slate-800 dark:text-slate-200">
 {order.assigned_at || order.created_at}
 </div>
 <div className="text-[9.5px] font-medium text-slate-500">
 {order.order_status === 'completed' ? 'Finished' : 'In queue'}
 </div>
 </div>
 ),
 },
 {
 id: 'status',
 label: 'Status',
 className: 'w-[120px]',
 render: (order) => {
 if (order.order_status === 'completed' || order.order_status === 'paid') {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium">
 <CheckCircle2 className="h-3 w-3"/>
 <span>Completed</span>
 </span>
 );
 }
 if (order.order_status === 'processing') {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-medium">
 <Activity className="h-3 w-3"/>
 <span>Processing</span>
 </span>
 );
 }
 if (order.order_status === 'unassigned') {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-medium">
 <AlertCircle className="h-3 w-3"/>
 <span>Unassigned</span>
 </span>
 );
 }
 if (order.order_status === 'cancelled') {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-medium">
 <Ban className="h-3 w-3"/>
 <span>Cancelled</span>
 </span>
 );
 }
 return (
 <div className="flex flex-col gap-0.5">
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-medium">
 <Clock className="h-3 w-3"/>
 <span>Waiting</span>
 </span>
 {order.discount_status === 'pending_approval' && (
 <span className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400">
 Disc. Pending Approval
 </span>
 )}
 </div>
 );
 },
 },
 {
 id: 'action',
 label: 'Action',
 className: 'w-[185px] text-right',
 render: (order) => {
 if (order.order_status === 'draft') {
 return (
 <div className="flex items-center justify-end gap-1.5">
 <Link href={route('sales.orders.create', { draft_id: order.id })}>
 <Button
 type="button"
 variant="primary"
 size="sm"
 className="h-6.5 px-2.5 text-xs bg-[#5CB85C] hover:bg-[#449D44] border border-[#4CAE4C] hover:bg-[#e03d15] text-white font-bold rounded-[2px] flex items-center gap-1 cursor-pointer shrink-0"
 >
 <span>Resume</span>
 </Button>
 </Link>
 <button
 type="button"
 onClick={() => {
 if (confirm(`Delete draft order #${order.order_number}?`)) {
 router.delete(route('sales.orders.destroy-draft', order.id));
 }
 }}
 className="h-6.5 w-6.5 rounded-[2px] bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800/70 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
 title="Delete Draft"
 >
 <X className="h-3.5 w-3.5 stroke-[2.2]"/>
 </button>
 </div>
 );
 }

 const isCompleted = order.order_status === 'completed' || order.order_status === 'paid';
 const isCancelled = order.order_status === 'cancelled';
 const canCancel = !isCompleted && !isCancelled;

 return (
 <div className="flex items-center justify-end gap-1.5">
 <button
 type="button"
 onClick={() => setViewingItemsOrder(order)}
 className="h-6.5 px-2 text-xs border border-slate-200 dark:border-slate-700 rounded-[2px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 font-medium cursor-pointer shrink-0"
 >
 <span>View Order</span>
 <ChevronDown className="h-3 w-3 text-slate-400"/>
 </button>
 <Button
 type="button"
 variant="primary"
 size="sm"
 onClick={() => openTracker(order)}
 className="h-6.5 px-2.5 text-xs bg-[#0E5F3F] hover:bg-[#e03d15] text-white font-bold rounded-[2px] flex items-center gap-1 cursor-pointer shrink-0"
 >
 <span>Track</span>
 </Button>
 {canCancel && (
 <button
 type="button"
 onClick={() => {
 setCancelOrderTarget(order);
 setCancelReason('');
 }}
 className="h-6.5 w-6.5 rounded-[2px] bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800/70 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
 title="Cancel Order"
 >
 <X className="h-3.5 w-3.5 stroke-[2.2]"/>
 </button>
 )}
 </div>
 );
 },
 },
 ];

 return (
 <AppLayout
 title="My Sales Orders"
 subtitle={`${branchName ?? 'Banani Head Office'} · Track created customer orders and counter queue status`}
 actions={
 <Link href={route('sales.orders.create')}>
 <Button
 type="button"
 variant="primary"
 size="sm"
 className="gap-1.5 bg-[#5CB85C] hover:bg-[#449D44] border border-[#4CAE4C] hover:bg-[#e03d15] text-white text-xs font-semibold rounded-[2px]"
 >
 <Plus className="h-3.5 w-3.5"/>
 <span>New Sales Order</span>
 </Button>
 </Link>
 }
 >
 <Head title="My Sales Orders"/>

 <div className="space-y-3.5 w-full pb-12">
 {/* Clean Status Tabs & Search Bar */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
 <div className="inline-flex items-center gap-1 bg-slate-100/80 dark:bg-[#181d26] p-0.5 rounded-[2px] border border-slate-200/60 dark:border-slate-800/60 overflow-x-auto text-xs">
 {[
 { id: 'all', label: 'All Orders' },
 { id: 'unassigned', label: 'Unassigned Queue' },
 { id: 'assigned', label: 'Assigned' },
 { id: 'processing', label: 'Processing' },
 { id: 'completed', label: 'Completed' },
 { id: 'draft', label: 'Draft' },
 { id: 'cancelled', label: 'Cancelled' },
 ].map((tab) => (
 <button
 key={tab.id}
 type="button"
 onClick={() => handleFilterChange(tab.id)}
 className={`px-3 py-1.5 rounded-[2px] text-xs font-medium capitalize transition-colors cursor-pointer shrink-0 ${activeStatus === tab.id
 ? 'bg-white dark:bg-[#12161c] text-[#0E5F3F] font-bold border border-slate-200/80 dark:border-slate-700 shadow-2xs'
 : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
 }`}
 >
 {tab.label}
 </button>
 ))}
 </div>

 <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
 <AnimatedSearchInput
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholders={[
 'Search by Order #...',
 'Search by Customer name...',
 'Press Enter to search orders...',
 ]}
 icon={<Search className="h-3.5 w-3.5"/>}
 wrapperClassName="h-8 rounded-[4px]"
 className="h-8 rounded-[4px] text-xs pl-9 pr-3"
 />
 </form>
 </div>

 {/* Clean Orders Card (Exact Cashier Station Layout) */}
 <div className="bg-white dark:bg-[#12161c] rounded-[2px] border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
 {/* Header */}
 <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181a20]/50">
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 rounded-[2px] bg-[#D5EDE2] dark:bg-[#0E5F3F]/15 text-[#0E5F3F] flex items-center justify-center shrink-0">
 <ShoppingCart className="h-3.5 w-3.5"/>
 </div>
 <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
 Orders Queue — {branchName ?? 'Banani Head Office'}
 </h3>
 </div>
 <span className="px-2 py-0.5 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-full font-medium">
 {orderList.length} orders in queue
 </span>
 </div>

 {/* Simple DataTable without bulky extra toolbars */}
 <div className="[&>div]:border-0 [&>div]:rounded-none">
 <DataTable
 data={orderList}
 columns={columns}
 compact={true}
 selectable={false}
 hideCheckbox={true}
 hideToolbar={true}
 hideViewToggle={true}
 syncUrlParams={false}
 emptyState={
 <div className="py-14 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
 <div className="w-12 h-12 rounded-full bg-[#EAF5F0] dark:bg-orange-950/20 text-[#0E5F3F] flex items-center justify-center">
 <Search className="h-5 w-5"/>
 </div>
 <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">
 No sales orders found
 </div>
 <div className="text-slate-400 text-xs">
 Completed sales transactions and active orders will appear here.
 </div>
 </div>
 }
 />
 </div>
 </div>
 </div>

 {/* Live Order Tracker Modal */}
 {trackingOrder && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
 <div className="w-full max-w-md rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
 <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-3">
 <div className="flex items-center gap-2">
 <Activity className="h-4 w-4 text-[#0E5F3F]"/>
 <div>
 <h3 className="text-xs font-bold text-slate-900 dark:text-white">
 Track Order #{trackingOrder.order_number}
 </h3>
 <p className="text-[11px] text-slate-500">{trackingOrder.customer_name}</p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => {
 setTrackingOrder(null);
 setTrackData(null);
 }}
 className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>

 {trackLoading ? (
 <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
 <RefreshCw className="h-4 w-4 animate-spin text-[#0E5F3F]"/>
 <span>Querying live counter routing status...</span>
 </div>
 ) : trackData ? (
 <div className="space-y-4">
 {/* Clean Flat Meta Overview (No Card Box) */}
 <div className="space-y-2 text-xs pb-3 border-b border-slate-100 dark:border-slate-800">
 <div className="flex items-center justify-between">
 <span className="text-slate-400">Order Status</span>
 <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11.5px] tracking-wide">
 {trackData.order_status.replace('_', ' ')}
 </span>
 </div>

 <div className="flex items-center justify-between">
 <span className="text-slate-400">Assigned Counter</span>
 {trackData.counter ? (
 <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
 <span className="px-1 py-0.2 rounded-[2px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 tabular-nums text-[11.5px] font-bold">
 {trackData.counter.code}
 </span>
 <span>{trackData.counter.name}</span>
 </span>
 ) : (
 <span className="text-rose-500 font-medium">Unassigned Queue</span>
 )}
 </div>

 {trackData.cashier_name && (
 <div className="flex items-center justify-between">
 <span className="text-slate-400">Serving Cashier</span>
 <span className="font-medium text-slate-700 dark:text-slate-300">
 {trackData.cashier_name}
 </span>
 </div>
 )}

 <div className="flex items-center justify-between pt-1">
 <span className="text-slate-400">Payable Amount</span>
 <span className="tabular-nums font-bold text-slate-900 dark:text-white">
 {formatCurrency(trackData.total_amount, currency)}
 </span>
 </div>
 </div>

 {/* Minimal Timeline (No Cards) */}
 <div className="pt-1">
 <div className="text-[10.5px] font-semibold text-slate-400 tracking-wider mb-3">
 Status Timeline
 </div>

 {trackData.timeline.length === 0 ? (
 <div className="text-xs text-slate-400 py-3 text-center">
 Order is currently in initial status.
 </div>
 ) : (
 <div className="space-y-0 relative pl-1">
 {trackData.timeline.map((step, idx) => {
 const isLast = idx === trackData.timeline.length - 1;
 const isCurrent = isLast;
 const isCancelled = step.status === 'cancelled';
 const isCompleted = step.status === 'completed' || step.status === 'paid';

 return (
 <div key={idx} className="flex items-start gap-3 relative pb-4.5 last:pb-1">
 {/* Thin vertical connecting line (only between nodes) */}
 {!isLast && (
 <span
 className="absolute left-[3.5px] top-3 bottom-0 w-[1px] bg-slate-200 dark:bg-slate-700"
 aria-hidden="true"
 />
 )}

 {/* Minimal Dot (No bulky bubble) */}
 <div className="relative flex items-center justify-center shrink-0 mt-1 z-10">
 {isCancelled ? (
 <div className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-100 dark:ring-rose-950"/>
 ) : isCompleted ? (
 <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-950"/>
 ) : isCurrent ? (
 <div className="w-2 h-2 rounded-full bg-[#0E5F3F] ring-2 ring-orange-200 dark:ring-orange-950"/>
 ) : (
 <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"/>
 )}
 </div>

 {/* Step Content (Clean typography, no card) */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2">
 <span
 className={`text-xs font-semibold tracking-wide ${isCancelled
 ? 'text-rose-600 dark:text-rose-400'
 : isCompleted
 ? 'text-emerald-600 dark:text-emerald-400'
 : isCurrent
 ? 'text-slate-900 dark:text-white font-bold'
 : 'text-slate-500 dark:text-slate-400'
 }`}
 >
 {step.status.replace('_', ' ')}
 </span>
 <span className="text-[11.5px] text-slate-400 tabular-nums shrink-0">
 {step.timestamp}
 </span>
 </div>

 {step.user && (
 <div className="text-[11px] text-slate-400 mt-0.5">
 By <span className="text-slate-600 dark:text-slate-300">{step.user}</span>
 </div>
 )}

 {step.reason && (
 <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">
"{step.reason}"
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setTrackingOrder(null);
 setTrackData(null);
 }}
 className="text-xs cursor-pointer"
 >
 Close
 </Button>
 </div>
 </div>
 ) : (
 <div className="text-center py-8 text-xs text-slate-400">
 No tracking telemetry available for this order.
 </div>
 )}
 </div>
 </div>
 )}

 {/* Cancel Order Modal */}
 {cancelOrderTarget && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
 <div className="w-full max-w-sm rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
 <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-3">
 <div className="flex items-center gap-1.5 text-rose-600">
 <Ban className="h-4 w-4"/>
 <h3 className="text-xs font-bold text-slate-900 dark:text-white">
 Cancel Order #{cancelOrderTarget.order_number}
 </h3>
 </div>
 <button
 type="button"
 onClick={() => setCancelOrderTarget(null)}
 className="text-slate-400 hover:text-slate-600 cursor-pointer"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>

 <form onSubmit={handleConfirmCancel} className="space-y-3">
 <p className="text-xs text-slate-600 dark:text-slate-400">
 Are you sure you want to cancel this order? This will release the counter queue slot and log the cancellation reason in history.
 </p>

 <div>
 <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
 Cancellation Reason <span className="text-rose-500">*</span>
 </label>
 <textarea
 required
 rows={3}
 placeholder="e.g. Customer changed mind, stock unavailable..."
 value={cancelReason}
 onChange={(e) => setCancelReason(e.target.value)}
 className="w-full text-xs rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] p-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
 />
 </div>

 <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
 <Button
 type="button"
 variant="outline"
 size="sm"
 disabled={cancelSubmitting}
 onClick={() => setCancelOrderTarget(null)}
 className="text-xs"
 >
 Keep Order
 </Button>
 <Button
 type="submit"
 size="sm"
 disabled={cancelSubmitting || !cancelReason.trim()}
 className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-[2px]"
 >
 {cancelSubmitting ? 'Cancelling...' : 'Confirm Cancel'}
 </Button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* View Order Items Modal */}
 {viewingItemsOrder && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
 <div className="w-full max-w-lg rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
 <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-3">
 <div className="flex items-center gap-2">
 <Package className="h-4 w-4 text-[#0E5F3F]"/>
 <div>
 <h3 className="text-xs font-bold text-slate-900 dark:text-white">
 Order Items — #{viewingItemsOrder.order_number}
 </h3>
 <p className="text-[11px] text-slate-500">
 Customer: {viewingItemsOrder.customer_name} · Total: {formatCurrency(viewingItemsOrder.total_amount, currency)}
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => setViewingItemsOrder(null)}
 className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>

 <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
 {viewingItemsOrder.items.map((item, idx) => (
 <div key={idx} className="py-2 flex items-center justify-between text-xs">
 <div>
 <div className="font-semibold text-slate-900 dark:text-white">
 {item.medicine_name || 'Prescription Medicine'}
 </div>
 <div className="text-[11px] text-slate-400">
 Qty: {item.quantity} {item.sale_unit || 'piece'}
 </div>
 </div>
 <span className="tabular-nums font-bold text-slate-900 dark:text-white">
 {formatCurrency(item.line_total, currency)}
 </span>
 </div>
 ))}
 </div>

 {viewingItemsOrder.prescription_file && (
 <div className="mt-3 p-2 rounded-[2px] bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs">
 <span className="text-indigo-700 dark:text-indigo-300 font-medium">Prescription File Attached</span>
 <a
 href={`/storage/${viewingItemsOrder.prescription_file}`}
 target="_blank"
 rel="noreferrer"
 className="text-xs font-bold text-[#0E5F3F] hover:underline"
 >
 Open Attachment
 </a>
 </div>
 )}

 <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => setViewingItemsOrder(null)}
 className="text-xs"
 >
 Close
 </Button>
 </div>
 </div>
 </div>
 )}
 </AppLayout>
 );
}
