import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRightLeft,
    Clock,
    RefreshCw,
    ShieldAlert,
    Store,
    User,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { MetricCard } from '@/Components/cards/MetricCard';
import { formatCurrency } from '@/lib/format';

interface ActiveOrder {
    id: number;
    order_number: string;
    customer_name: string;
    salesman_name?: string;
    total_amount: number;
    order_status: string;
    assigned_at?: string;
    items_count: number;
}

interface CounterBoardItem {
    id: number;
    code: string;
    name: string;
    type: string;
    location?: string;
    status: 'active' | 'on_break' | 'closed';
    max_queue_capacity: number;
    auto_assignment_enabled: boolean;
    current_cashier?: string;
    current_shift?: string;
    queue_count: number;
    active_orders: ActiveOrder[];
}

interface UnassignedOrder {
    id: number;
    order_number: string;
    customer_name: string;
    salesman_name?: string;
    total_amount: number;
    created_at?: string;
    items_count: number;
}

interface MonitoringProps {
    counters: CounterBoardItem[];
    unassignedOrders: UnassignedOrder[];
    branchName?: string;
    currency: string;
}

export default function CounterMonitoring({
    counters = [],
    unassignedOrders = [],
    branchName = 'Main Branch',
    currency = 'BDT',
}: MonitoringProps) {
    const [retrying, setRetrying] = useState(false);

    // Reassignment modal
    const [reassignModalOpen, setReassignModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<ActiveOrder | UnassignedOrder | null>(null);
    const [targetCounterId, setTargetCounterId] = useState<number | ''>('');
    const [reassignReason, setReassignReason] = useState('Queue balancing by branch manager');
    const [submittingReassign, setSubmittingReassign] = useState(false);

    const totalActiveCounters = counters.filter((c) => c.status === 'active').length;
    const totalQueuedOrders = counters.reduce((acc, c) => acc + c.queue_count, 0);

    const handleRetryUnassigned = () => {
        setRetrying(true);
        router.post(
            route('counters.retry-unassigned'),
            {},
            {
                onFinish: () => setRetrying(false),
            }
        );
    };

    const handleOpenReassign = (order: ActiveOrder | UnassignedOrder) => {
        setSelectedOrder(order);
        const available = counters.find((c) => c.status === 'active' && c.queue_count < c.max_queue_capacity);
        setTargetCounterId(available?.id ?? counters[0]?.id ?? '');
        setReassignReason('Queue load balancing');
        setReassignModalOpen(true);
    };

    const handleConfirmReassign = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder || !targetCounterId) return;

        setSubmittingReassign(true);
        router.post(
            route('counters.orders.reassign', selectedOrder.id),
            {
                counter_id: targetCounterId,
                reason: reassignReason,
            },
            {
                onSuccess: () => {
                    setSubmittingReassign(false);
                    setReassignModalOpen(false);
                    setSelectedOrder(null);
                },
                onError: () => setSubmittingReassign(false),
            }
        );
    };

    return (
        <AppLayout
            title="Live Counter Queue Monitor"
            subtitle={`${branchName} · Real-time counter load balancing, queue overview, and manual reassignment`}
            actions={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetryUnassigned}
                        disabled={retrying}
                        className="rounded-[3px] text-xs h-8"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${retrying ? 'animate-spin' : ''}`} />
                        Retry Auto-Assignment
                    </Button>
                    <Link href={route('counters.index')}>
                        <Button
                            variant="primary"
                            size="sm"
                            className="bg-[#FF4A1F] hover:bg-[#ea3e15] text-white rounded-[3px] text-xs h-8"
                        >
                            <Store className="h-3.5 w-3.5 mr-1.5" />
                            Counter Terminals & Shifts
                        </Button>
                    </Link>
                </div>
            }
        >
            <Head title="Live Counter Queue Monitor" />

            <div className="space-y-4 font-sans text-xs">
                {/* Metrics Overview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                        title="Online Counters"
                        value={`${totalActiveCounters} / ${counters.length}`}
                        description="Ready for dynamic assignment"
                        icon={Store}
                    />
                    <MetricCard
                        title="Active Queued Orders"
                        value={totalQueuedOrders}
                        description="Serving & waiting at counters"
                        icon={Clock}
                    />
                    <MetricCard
                        title="Unassigned Queue"
                        value={unassignedOrders.length}
                        description={unassignedOrders.length > 0 ? 'Requires attention / capacity' : 'All orders assigned'}
                        icon={AlertCircle}
                    />
                    <MetricCard
                        title="Round-Robin Balancing"
                        value="Active"
                        description="Atomic lowest-queue routing"
                        icon={ArrowRightLeft}
                    />
                </div>

                {/* Unassigned Orders Alert Banner */}
                {unassignedOrders.length > 0 && (
                    <div className="rounded-[3px] border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/20 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                <div>
                                    <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                                        {unassignedOrders.length} Unassigned Order{unassignedOrders.length > 1 ? 's' : ''} in Queue
                                    </h3>
                                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                                        These orders were submitted when all counters were either offline, on break, or reached maximum queue capacity.
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                onClick={handleRetryUnassigned}
                                disabled={retrying}
                                className="bg-amber-600 hover:bg-amber-700 text-white rounded-[3px] text-xs h-7.5 px-3"
                            >
                                <RefreshCw className={`h-3 w-3 mr-1 ${retrying ? 'animate-spin' : ''}`} />
                                Re-route All
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {unassignedOrders.map((ord) => (
                                <div
                                    key={ord.id}
                                    className="p-3 rounded-[3px] border border-amber-200 dark:border-amber-800/40 bg-white dark:bg-[#151921] flex items-center justify-between"
                                >
                                    <div>
                                        <div className="flex items-center gap-1.5 font-bold font-mono text-slate-900 dark:text-white">
                                            <span>#{ord.order_number}</span>
                                            <span className="text-[10px] px-1 py-0.2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded">
                                                {ord.created_at}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                            {ord.customer_name} · {ord.items_count} items
                                        </div>
                                        <div className="text-xs font-bold text-[#FF4A1F] mt-1">
                                            {formatCurrency(ord.total_amount, currency)}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleOpenReassign(ord)}
                                        className="rounded-[3px] text-[11px] h-7 px-2 border-slate-300 hover:border-[#FF4A1F]"
                                    >
                                        <ArrowRightLeft className="h-3 w-3 mr-1 text-[#FF4A1F]" />
                                        Assign
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Counter Stations Board */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {counters.map((c) => {
                        const isServing = c.status === 'active';
                        const isOnBreak = c.status === 'on_break';
                        const percentCapacity = Math.min(100, Math.round((c.queue_count / (c.max_queue_capacity || 20)) * 100));

                        return (
                            <div
                                key={c.id}
                                className="rounded-[3px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] shadow-xs flex flex-col justify-between overflow-hidden"
                            >
                                {/* Header */}
                                <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#12161c]">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-[3px] bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-mono font-bold text-xs">
                                                {c.code}
                                            </span>
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                                    {c.name}
                                                </h4>
                                                <div className="text-[10.5px] text-slate-500">
                                                    {c.location || c.type.toUpperCase()} · Shift: <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">{c.current_shift || 'None'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[10.5px] font-semibold border ${
                                                isServing
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                    : isOnBreak
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 animate-pulse'
                                                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                            }`}
                                        >
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                    isServing ? 'bg-emerald-500' : isOnBreak ? 'bg-amber-500' : 'bg-slate-400'
                                                }`}
                                            />
                                            {isServing ? 'ONLINE' : isOnBreak ? 'ON BREAK' : 'CLOSED'}
                                        </span>
                                    </div>

                                    {/* Cashier & Auto-assignment toggle info */}
                                    <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                            <User className="h-3 w-3 text-slate-400" />
                                            <span>Cashier:</span>
                                            <strong className="text-slate-900 dark:text-white font-medium truncate max-w-[120px]">
                                                {c.current_cashier || 'None'}
                                            </strong>
                                        </div>
                                        <span className={`text-[10px] font-semibold ${c.auto_assignment_enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {c.auto_assignment_enabled ? '● Auto-routing ON' : '○ Manual Only'}
                                        </span>
                                    </div>

                                    {/* Queue load capacity meter */}
                                    <div className="mt-2">
                                        <div className="flex items-center justify-between text-[10.5px] text-slate-500 mb-1">
                                            <span>Queue Capacity ({c.queue_count} / {c.max_queue_capacity})</span>
                                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{percentCapacity}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${
                                                    percentCapacity >= 90
                                                        ? 'bg-rose-500'
                                                        : percentCapacity >= 70
                                                        ? 'bg-amber-500'
                                                        : 'bg-emerald-500'
                                                }`}
                                                style={{ width: `${percentCapacity}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Order Queue List */}
                                <div className="p-3 flex-1 flex flex-col justify-between">
                                    <div className="space-y-2">
                                        {c.active_orders.length === 0 ? (
                                            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                                                No waiting orders in this counter queue.
                                            </div>
                                        ) : (
                                            c.active_orders.map((ord) => (
                                                <div
                                                    key={ord.id}
                                                    className="p-2.5 rounded-[3px] border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#12161c] hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-center justify-between"
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                                #{ord.order_number}
                                                            </span>
                                                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold capitalize ${
                                                                ord.order_status === 'processing'
                                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                                                    : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                            }`}>
                                                                {ord.order_status}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                                            {ord.customer_name} · By: {ord.salesman_name || 'Salesman'}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                                {formatCurrency(ord.total_amount, currency)}
                                                            </span>
                                                            {ord.assigned_at && (
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    Waiting: {ord.assigned_at}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleOpenReassign(ord)}
                                                        title="Reassign to another counter"
                                                        className="h-7 px-2 text-[11px] rounded-[3px] text-slate-600 hover:text-[#FF4A1F] border-slate-300 dark:border-slate-700"
                                                    >
                                                        <ArrowRightLeft className="h-3 w-3 mr-1" />
                                                        Reassign
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Reassign Modal */}
            {reassignModalOpen && selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-[3px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] shadow-2xl overflow-hidden font-sans">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#12161c]">
                            <div className="flex items-center gap-2">
                                <ArrowRightLeft className="h-4 w-4 text-[#FF4A1F]" />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Reassign Order #{selectedOrder.order_number}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReassignModalOpen(false)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmReassign} className="p-5 space-y-4 text-xs">
                            <div className="p-3 bg-slate-50 dark:bg-[#12161c] rounded-[3px] border border-slate-200 dark:border-slate-800 space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Customer:</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{selectedOrder.customer_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Total Payable:</span>
                                    <span className="font-bold text-[#FF4A1F]">{formatCurrency(selectedOrder.total_amount, currency)}</span>
                                </div>
                            </div>

                            <div>
                                <Select
                                    label="Destination Counter *"
                                    size="sm"
                                    value={targetCounterId || ''}
                                    placeholder="Select Target Counter"
                                    onChange={(e) => setTargetCounterId(Number(e.target.value))}
                                    options={counters.map((c) => ({
                                        value: c.id,
                                        label: `${c.name} (${c.code}) - ${c.status.toUpperCase()} (${c.queue_count}/${c.max_queue_capacity} in queue)`,
                                        disabled: c.status === 'closed',
                                    }))}
                                    triggerClassName="h-8 bg-white dark:bg-[#1e2329] text-xs"
                                />
                            </div>

                            <div>
                                <Input
                                    label="Reason for Reassignment *"
                                    type="text"
                                    required
                                    value={reassignReason}
                                    onChange={(e) => setReassignReason(e.target.value)}
                                    placeholder="e.g. Counter offline / Patient queue balancing"
                                    className="h-8 bg-white dark:bg-[#1e2329] text-xs focus:border-[#FF4A1F]"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setReassignModalOpen(false)}
                                    className="rounded-[3px]"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    disabled={submittingReassign || !targetCounterId}
                                    className="bg-[#FF4A1F] hover:bg-[#ea3e15] text-white rounded-[3px]"
                                >
                                    {submittingReassign ? 'Reassigning...' : 'Confirm Reassignment'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
