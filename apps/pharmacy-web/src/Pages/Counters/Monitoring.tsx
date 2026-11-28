import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    ArrowRightLeft,
    BadgePercent,
    CheckCircle2,
    Clock,
    Coffee,
    Download,
    FileWarning,
    LayoutGrid,
    Monitor,
    Pause,
    Play,
    RefreshCw,
    ShieldAlert,
    Store,
    User,
    Users,
    Wallet,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import {
    BrtaField,
    BrtaFormModal,
    brtaInputClass,
} from '@/Components/ui/BrtaForm';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { MetricCard } from '@/Components/cards/MetricCard';
import { formatCurrency } from '@/lib/format';

interface BranchOption {
    id: number;
    code: string;
    name: string;
}

interface BranchSummaryRow {
    id: number;
    code: string;
    name: string;
    counters_open: number;
    counters_total: number;
    sales: number;
    bills: number;
    queue: number;
    cash_diff: number;
    status: 'normal' | 'long_queue' | 'check';
    status_label: string;
}

interface SalesByBranchItem {
    id: number;
    name: string;
    sales: number;
    status: 'normal' | 'long_queue' | 'check';
    percent: number;
}

interface BranchAlertItem {
    id: string;
    type: 'cash_diff' | 'discount' | 'queue' | 'rx' | 'break';
    severity: 'high' | 'medium';
    branch_id: number;
    branch_name: string;
    title: string;
    subtitle: string;
}

interface AllBranchesOverviewData {
    period_label: string;
    kpis: {
        branches_open: number;
        branches_total: number;
        branches_subtitle: string;
        counters_open: number;
        counters_total: number;
        counters_subtitle: string;
        sales_total: number;
        sales_subtitle: string;
        sales_trend: 'up' | 'down' | 'flat';
        bills_count: number;
        bills_avg: number;
        cash_diff: number;
        cash_diff_branches: number;
        alerts_total: number;
        alerts_action_needed: number;
    };
    branch_rows: BranchSummaryRow[];
    sales_by_branch: SalesByBranchItem[];
    alerts: BranchAlertItem[];
}

interface ActiveOrder {
    id: number;
    order_number: string;
    customer_name: string;
    salesman_name?: string | null;
    total_amount: number;
    order_status: string;
    assigned_at?: string | null;
    waiting_minutes: number;
    is_delayed: boolean;
    requires_verification?: boolean;
    verification_status?: string | null;
    items_count: number;
    counter_id?: number;
    counter_code?: string;
    counter_name?: string;
}

interface CounterBoardItem {
    id: number;
    code: string;
    name: string;
    type: string;
    zone?: string | null;
    location?: string | null;
    status: 'active' | 'on_break' | 'closed';
    break_reason?: string | null;
    max_queue_capacity: number;
    auto_assignment_enabled: boolean;
    current_cashier?: string | null;
    current_shift?: string | null;
    shift_opened_at?: string | null;
    completed_bills?: number;
    shift_sales?: number;
    queue_count: number;
    delayed_count: number;
    max_wait_minutes: number;
    active_orders: ActiveOrder[];
}

interface UnassignedOrder {
    id: number;
    order_number: string;
    customer_name: string;
    salesman_name?: string | null;
    total_amount: number;
    created_at?: string | null;
    waiting_minutes: number;
    is_delayed: boolean;
    items_count: number;
}

interface MonitoringProps {
    canViewAllBranches?: boolean;
    selectedBranchId?: 'all' | number;
    period?: 'today' | 'yesterday' | '7d' | 'month';
    branchesList?: BranchOption[];
    allBranchesOverview?: AllBranchesOverviewData | null;
    counters: CounterBoardItem[];
    unassignedOrders: UnassignedOrder[];
    branchName?: string;
    currency: string;
    syncedAt?: string;
}

type ViewTab = 'manager' | 'tv';
type CounterFilter = 'all' | 'online' | 'delayed' | 'offline';

function formatWaitLabel(mins: number): string {
    if (mins < 1) return '< 1m';
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatCompactBdt(amount: number, currency: string): string {
    if (currency !== 'BDT') {
        return formatCurrency(amount, currency);
    }
    if (amount >= 100000) {
        return `৳${(amount / 100000).toFixed(2)}L`;
    }
    if (amount >= 1000) {
        return `৳${(amount / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount, currency);
}

function formatSignedCashDiff(diff: number, currency: string): string {
    const absFormatted = formatCurrency(Math.abs(diff), currency);
    if (diff < -0.01) {
        return absFormatted.startsWith('৳')
            ? `৳-${absFormatted.slice(1)}`
            : `-${absFormatted}`;
    }
    if (diff > 0.01) {
        return `+${absFormatted}`;
    }
    return currency === 'BDT' ? '৳0' : formatCurrency(0, currency);
}

export default function CounterMonitoring({
    canViewAllBranches = false,
    selectedBranchId = 'all',
    period = 'today',
    branchesList = [],
    allBranchesOverview = null,
    counters = [],
    unassignedOrders = [],
    branchName = 'Main Branch',
    currency = 'BDT',
    syncedAt,
}: MonitoringProps) {
    const isAllBranchesMode = Boolean(
        canViewAllBranches && selectedBranchId === 'all' && allBranchesOverview
    );

    const [viewTab, setViewTab] = useState<ViewTab>('manager');
    const [counterFilter, setCounterFilter] = useState<CounterFilter>('all');
    const [liveSync, setLiveSync] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [showAllAlerts, setShowAllAlerts] = useState(false);
    const [clockStr, setClockStr] = useState<string>(() =>
        new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
    );

    // Reassignment modal
    const [reassignModalOpen, setReassignModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<
        ActiveOrder | UnassignedOrder | null
    >(null);
    const [targetCounterId, setTargetCounterId] = useState<number | ''>('');
    const [reassignReason, setReassignReason] = useState('Queue load balancing');
    const [submittingReassign, setSubmittingReassign] = useState(false);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setClockStr(
                new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                })
            );
        }, 1000);
        return () => window.clearInterval(timer);
    }, []);

    // Auto-refresh every 10 seconds when Live Sync is enabled
    useEffect(() => {
        if (!liveSync || reassignModalOpen) return;
        const interval = window.setInterval(() => {
            router.reload({
                only: [
                    'allBranchesOverview',
                    'counters',
                    'unassignedOrders',
                    'syncedAt',
                ],
            });
        }, 10000);
        return () => window.clearInterval(interval);
    }, [liveSync, reassignModalOpen]);

    const navigateFilter = (nextPeriod: string, nextBranch: string | number) => {
        router.get(
            route('counters.monitoring'),
            {
                period: nextPeriod,
                branch_id: nextBranch,
            },
            {
                preserveScroll: true,
                preserveState: true,
            }
        );
    };

    const handleManualRefresh = () => {
        setRefreshing(true);
        router.reload({
            only: [
                'allBranchesOverview',
                'counters',
                'unassignedOrders',
                'syncedAt',
            ],
            onFinish: () => setRefreshing(false),
        });
    };

    const handleExportBranchCsv = () => {
        if (!allBranchesOverview) return;
        const header = [
            'Branch',
            'Open Counters',
            'Total Counters',
            'Sales',
            'Bills',
            'Queue',
            'Cash Diff',
            'Status',
        ];
        const csvLines = [
            header.join(','),
            ...allBranchesOverview.branch_rows.map((r) =>
                [
                    `"${r.name.replace(/"/g, '""')}"`,
                    r.counters_open,
                    r.counters_total,
                    r.sales,
                    r.bills,
                    r.queue,
                    r.cash_diff,
                    `"${r.status_label}"`,
                ].join(',')
            ),
        ];
        const blob = new Blob([csvLines.join('\n')], {
            type: 'text/csv;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `counter-monitoring-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleRetryUnassigned = () => {
        setRetrying(true);
        router.post(
            route('counters.retry-unassigned'),
            {},
            {
                preserveScroll: true,
                onFinish: () => setRetrying(false),
            }
        );
    };

    const handleOpenReassign = (order: ActiveOrder | UnassignedOrder) => {
        setSelectedOrder(order);
        const currentCid = 'counter_id' in order ? order.counter_id : undefined;
        const available = counters.find(
            (c) =>
                c.status === 'active' &&
                c.id !== currentCid &&
                c.queue_count < c.max_queue_capacity
        );
        setTargetCounterId(
            available?.id ?? counters.find((c) => c.id !== currentCid)?.id ?? ''
        );
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
                preserveScroll: true,
                onSuccess: () => {
                    setSubmittingReassign(false);
                    setReassignModalOpen(false);
                    setSelectedOrder(null);
                },
                onError: () => setSubmittingReassign(false),
            }
        );
    };

    // Single-branch derived metrics
    const onlineCount = counters.filter((c) => c.status === 'active').length;
    const onBreakCount = counters.filter((c) => c.status === 'on_break').length;
    const closedCount = counters.filter((c) => c.status === 'closed').length;
    const totalQueuedOrders = counters.reduce((acc, c) => acc + c.queue_count, 0);

    const allQueuedOrders = useMemo(() => {
        const list: ActiveOrder[] = [];
        for (const c of counters) {
            for (const o of c.active_orders) {
                list.push({
                    ...o,
                    counter_id: c.id,
                    counter_code: c.code,
                    counter_name: c.name,
                });
            }
        }
        return list.sort((a, b) => b.waiting_minutes - a.waiting_minutes);
    }, [counters]);

    const delayedQueuedCount =
        allQueuedOrders.filter((o) => o.is_delayed).length +
        unassignedOrders.filter((u) => u.is_delayed).length;

    const maxWaitMinutes = Math.max(
        0,
        ...allQueuedOrders.map((o) => o.waiting_minutes),
        ...unassignedOrders.map((u) => u.waiting_minutes)
    );

    const filteredCounters = useMemo(() => {
        if (counterFilter === 'online') {
            return counters.filter((c) => c.status === 'active');
        }
        if (counterFilter === 'delayed') {
            return counters.filter((c) => c.delayed_count > 0);
        }
        if (counterFilter === 'offline') {
            return counters.filter((c) => c.status !== 'active');
        }
        return counters;
    }, [counters, counterFilter]);

    const activeTvCounters = useMemo(
        () => counters.filter((c) => c.status !== 'closed'),
        [counters]
    );

    const upcomingTvQueue = useMemo(() => {
        const waiting: ActiveOrder[] = [];
        for (const c of counters) {
            c.active_orders.slice(1).forEach((ord) => {
                waiting.push({
                    ...ord,
                    counter_code: c.code,
                    counter_name: c.name,
                });
            });
        }
        return waiting;
    }, [counters]);

    const visibleAlerts = useMemo(() => {
        if (!allBranchesOverview) return [];
        return showAllAlerts
            ? allBranchesOverview.alerts
            : allBranchesOverview.alerts.slice(0, 5);
    }, [allBranchesOverview, showAllAlerts]);

    const branchSummaryColumns: Column<BranchSummaryRow>[] = useMemo(
        () => [
            {
                id: 'name',
                label: 'Branch',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-white">
                            {row.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                            · {row.code}
                        </span>
                    </div>
                ),
            },
            {
                id: 'counters_open',
                label: 'Counters',
                sortable: true,
                render: (row) => (
                    <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {row.counters_open} / {row.counters_total}
                    </span>
                ),
            },
            {
                id: 'sales',
                label: 'Sales',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(row.sales, currency)}
                    </span>
                ),
            },
            {
                id: 'bills',
                label: 'Bills',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span className="tabular-nums text-slate-700 dark:text-slate-300">
                        {row.bills}
                    </span>
                ),
            },
            {
                id: 'queue',
                label: 'Queue',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">
                        {row.queue}
                    </span>
                ),
            },
            {
                id: 'cash_diff',
                label: 'Cash Diff',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span
                        className={`font-semibold tabular-nums ${
                            row.cash_diff < -0.01
                                ? 'text-rose-600 dark:text-rose-400'
                                : row.cash_diff > 0.01
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-500 dark:text-slate-400'
                        }`}
                    >
                        {formatSignedCashDiff(row.cash_diff, currency)}
                    </span>
                ),
            },
            {
                id: 'status_label',
                label: 'Status',
                sortable: true,
                render: (row) => (
                    <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            row.status === 'check'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                                : row.status === 'long_queue'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                        }`}
                    >
                        {row.status_label}
                    </span>
                ),
            },
        ],
        [currency]
    );

    const activeQueueColumns: Column<ActiveOrder>[] = useMemo(
        () => [
            {
                id: 'order_number',
                label: 'Order / Token',
                sortable: true,
                render: (ord) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                            #{ord.order_number}
                        </span>
                        {ord.order_status === 'processing' && (
                            <span className="px-1.5 py-0.2 rounded-[2px] bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[10.5px] font-semibold">
                                Serving
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'counter_name',
                label: 'Counter',
                sortable: true,
                render: (ord) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-[11px]">
                            {ord.counter_code}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300">
                            {ord.counter_name}
                        </span>
                    </div>
                ),
            },
            {
                id: 'customer_name',
                label: 'Customer',
                sortable: true,
            },
            {
                id: 'salesman_name',
                label: 'Salesman',
                sortable: true,
                render: (ord) => (
                    <span className="text-slate-500">
                        {ord.salesman_name || '—'}
                    </span>
                ),
            },
            {
                id: 'items_count',
                label: 'Items',
                sortable: true,
                className: 'text-right',
            },
            {
                id: 'total_amount',
                label: 'Payable',
                sortable: true,
                className: 'text-right',
                render: (ord) => (
                    <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(ord.total_amount, currency)}
                    </span>
                ),
            },
            {
                id: 'waiting_minutes',
                label: 'Wait Time',
                sortable: true,
                render: (ord) => (
                    <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[11px] font-bold tabular-nums ${
                            ord.is_delayed
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                        <Clock className="h-3 w-3" />
                        {formatWaitLabel(ord.waiting_minutes)}
                        {ord.is_delayed ? ' · Delayed' : ''}
                    </span>
                ),
            },
        ],
        [currency]
    );

    return (
        <AppLayout
            title={
                isAllBranchesMode
                    ? 'Counter monitoring, all branches'
                    : `Counter monitoring · ${branchName}`
            }
            focusModeKey="counter-monitor"
            subtitle={
                isAllBranchesMode
                    ? `Live multi-branch counter operations, sales, cash differences, and queue alerts${syncedAt ? ` · Updated ${syncedAt}` : ''}`
                    : `${branchName} · Real-time queue flow, >5m wait alerts, and token display`
            }
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    {/* Period Selector */}
                    {canViewAllBranches && (
                        <select
                            value={period}
                            onChange={(e) =>
                                navigateFilter(e.target.value, selectedBranchId)
                            }
                            aria-label="Select time period"
                            className="h-8 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-[#0E5F3F] focus:outline-none cursor-pointer"
                        >
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="7d">Last 7 days</option>
                            <option value="month">This month</option>
                        </select>
                    )}

                    {/* Branch Selector */}
                    {canViewAllBranches && (
                        <select
                            value={String(selectedBranchId)}
                            onChange={(e) =>
                                navigateFilter(
                                    period,
                                    e.target.value === 'all'
                                        ? 'all'
                                        : Number(e.target.value)
                                )
                            }
                            aria-label="Select branch"
                            className="h-8 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-[#0E5F3F] focus:outline-none cursor-pointer"
                        >
                            <option value="all">All branches</option>
                            {branchesList.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Live Auto-Sync Toggle */}
                    <button
                        type="button"
                        onClick={() => setLiveSync((prev) => !prev)}
                        title={
                            liveSync
                                ? 'Auto-refreshing every 10s (click to pause)'
                                : 'Auto-refresh paused (click to resume)'
                        }
                        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[2px] border text-xs font-semibold transition-colors cursor-pointer ${
                            liveSync
                                ? 'border-[#0E5F3F]/40 bg-[#EAF5F0] text-[#0E5F3F] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${
                                liveSync
                                    ? 'bg-emerald-500 animate-pulse'
                                    : 'bg-slate-400'
                            }`}
                        />
                        <span>{liveSync ? 'Live' : 'Paused'}</span>
                        {liveSync ? (
                            <Pause className="h-3 w-3 opacity-70" />
                        ) : (
                            <Play className="h-3 w-3 opacity-70" />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleManualRefresh}
                        disabled={refreshing}
                        title={syncedAt ? `Last synced at ${syncedAt}` : 'Refresh now'}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0E5F3F] hover:text-[#0E5F3F] cursor-pointer"
                    >
                        <RefreshCw
                            className={`h-3.5 w-3.5 ${
                                refreshing ? 'animate-spin text-[#0E5F3F]' : ''
                            }`}
                        />
                    </button>

                    <Link href={route('counters.index')}>
                        <Button variant="primary" size="sm" className="h-8 text-xs">
                            <Store className="h-3.5 w-3.5 mr-1" />
                            Counters & Shifts
                        </Button>
                    </Link>
                </div>
            }
        >
            <Head
                title={
                    isAllBranchesMode
                        ? 'Counter monitoring, all branches'
                        : `Counter monitoring · ${branchName}`
                }
            />

            {/* ==================== ALL BRANCHES OVERVIEW (OWNER / ADMIN) ==================== */}
            {isAllBranchesMode && allBranchesOverview ? (
                <div className="space-y-4 font-sans">
                    {/* 6 Dynamic KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                        {/* 1. Branches open */}
                        <div className="rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] p-3.5">
                            <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                                Branches open
                            </div>
                            <div className="mt-1 text-[22px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight">
                                {allBranchesOverview.kpis.branches_open} /{' '}
                                {allBranchesOverview.kpis.branches_total}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {allBranchesOverview.kpis.branches_subtitle}
                            </div>
                        </div>

                        {/* 2. Counters open */}
                        <div className="rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] p-3.5">
                            <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                                Counters open
                            </div>
                            <div className="mt-1 text-[22px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight">
                                {allBranchesOverview.kpis.counters_open} /{' '}
                                {allBranchesOverview.kpis.counters_total}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {allBranchesOverview.kpis.counters_subtitle}
                            </div>
                        </div>

                        {/* 3. Period sales */}
                        <div className="rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] p-3.5">
                            <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                                {allBranchesOverview.period_label}
                            </div>
                            <div className="mt-1 text-[22px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight truncate">
                                {formatCurrency(
                                    allBranchesOverview.kpis.sales_total,
                                    currency
                                )}
                            </div>
                            <div
                                className={`mt-1 text-[11px] font-medium truncate ${
                                    allBranchesOverview.kpis.sales_trend === 'up'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : allBranchesOverview.kpis.sales_trend === 'down'
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-slate-500 dark:text-slate-400'
                                }`}
                            >
                                {allBranchesOverview.kpis.sales_subtitle}
                            </div>
                        </div>

                        {/* 4. Bills */}
                        <div className="rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] p-3.5">
                            <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                                Bills
                            </div>
                            <div className="mt-1 text-[22px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight">
                                {allBranchesOverview.kpis.bills_count}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                Avg{' '}
                                {formatCurrency(
                                    allBranchesOverview.kpis.bills_avg,
                                    currency
                                )}
                            </div>
                        </div>

                        {/* 5. Cash difference */}
                        <div className="rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] p-3.5">
                            <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                                Cash difference
                            </div>
                            <div
                                className={`mt-1 text-[22px] font-bold tabular-nums leading-tight truncate ${
                                    allBranchesOverview.kpis.cash_diff < -0.01
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : allBranchesOverview.kpis.cash_diff > 0.01
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-slate-900 dark:text-white'
                                }`}
                            >
                                {formatSignedCashDiff(
                                    allBranchesOverview.kpis.cash_diff,
                                    currency
                                )}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {allBranchesOverview.kpis.cash_diff_branches > 0
                                    ? `In ${allBranchesOverview.kpis.cash_diff_branches} branch${
                                          allBranchesOverview.kpis.cash_diff_branches > 1
                                              ? 'es'
                                              : ''
                                      }`
                                    : 'All drawers balanced'}
                            </div>
                        </div>

                        {/* 6. Alerts */}
                        <div className="rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] p-3.5">
                            <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                                Alerts
                            </div>
                            <div
                                className={`mt-1 text-[22px] font-bold tabular-nums leading-tight ${
                                    allBranchesOverview.kpis.alerts_total > 0
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                            >
                                {allBranchesOverview.kpis.alerts_total}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {allBranchesOverview.kpis.alerts_action_needed > 0
                                    ? `${allBranchesOverview.kpis.alerts_action_needed} need action`
                                    : 'No urgent issues'}
                            </div>
                        </div>
                    </div>

                    {/* Branch Summary DataTable */}
                    <DataTable
                        tableId="counter-monitoring-branch-summary"
                        data={allBranchesOverview.branch_rows}
                        columns={branchSummaryColumns}
                        keyExtractor={(row) => row.id}
                        selectable={false}
                        hideCheckbox
                        hideFilter
                        hideViewToggle
                        syncUrlParams={false}
                        onRefresh={handleManualRefresh}
                        isRefreshing={refreshing}
                        searchPlaceholders={[
                            'Search branch name or code...',
                            'Filter by status (Normal, Long queue, Check)...',
                        ]}
                        headerTabs={
                            <div className="py-1.5 flex items-center justify-between gap-2">
                                <h2 className="text-[14px] font-bold text-slate-900 dark:text-white">
                                    Branch summary
                                </h2>
                                <button
                                    type="button"
                                    onClick={handleExportBranchCsv}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#337AB7] dark:text-sky-400 hover:underline cursor-pointer"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Export
                                </button>
                            </div>
                        }
                        actionsColumnClassName="w-[132px] text-right"
                        actions={(row) => (
                            <button
                                type="button"
                                onClick={() => navigateFilter(period, row.id)}
                                className="inline-flex items-center justify-center h-7 px-2.5 rounded-[3px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-[#0E5F3F] hover:text-[#0E5F3F] dark:hover:border-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
                            >
                                View counters
                            </button>
                        )}
                        emptyState={
                            <EmptyState
                                title="No branches found"
                                description="Create an active branch to monitor counters."
                            />
                        }
                    />

                    {/* Bottom 2-Column Section: Sales by branch & Needs attention */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Left: Sales by branch */}
                        <div className="lg:col-span-6 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] p-4 space-y-3.5">
                            <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">
                                Sales by branch
                            </h3>

                            {allBranchesOverview.sales_by_branch.length === 0 ? (
                                <div className="py-8 text-center text-xs text-slate-400">
                                    No active branches found.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {allBranchesOverview.sales_by_branch.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => navigateFilter(period, item.id)}
                                            title={`${item.name}: ${formatCurrency(item.sales, currency)}`}
                                            className="w-full grid grid-cols-12 items-center gap-3 text-left group cursor-pointer"
                                        >
                                            <span className="col-span-4 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-[#0E5F3F] dark:group-hover:text-emerald-400">
                                                {item.name}
                                            </span>
                                            <div className="col-span-5 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${
                                                        item.status === 'check'
                                                            ? 'bg-rose-500'
                                                            : item.status === 'long_queue'
                                                              ? 'bg-amber-500'
                                                              : 'bg-emerald-500'
                                                    }`}
                                                    style={{ width: `${item.percent}%` }}
                                                />
                                            </div>
                                            <span className="col-span-3 text-right text-[12.5px] font-bold tabular-nums text-slate-900 dark:text-white">
                                                {formatCompactBdt(item.sales, currency)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right: Needs attention */}
                        <div className="lg:col-span-6 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">
                                    Needs attention
                                </h3>
                                {allBranchesOverview.alerts.length > 5 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllAlerts((p) => !p)}
                                        className="text-xs font-semibold text-[#337AB7] dark:text-sky-400 hover:underline cursor-pointer"
                                    >
                                        {showAllAlerts
                                            ? 'Show less'
                                            : `See all (${allBranchesOverview.alerts.length})`}
                                    </button>
                                )}
                            </div>

                            {visibleAlerts.length === 0 ? (
                                <div className="py-10 flex flex-col items-center justify-center gap-2 text-center">
                                    <div className="h-9 w-9 rounded-full bg-[#EAF5F0] dark:bg-emerald-950/40 flex items-center justify-center text-[#0E5F3F] dark:text-emerald-400">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                        All branches operating normally
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        No cash discrepancies, long queues, or compliance alerts in this period.
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {visibleAlerts.map((alert) => (
                                        <button
                                            key={alert.id}
                                            type="button"
                                            onClick={() =>
                                                navigateFilter(period, alert.branch_id)
                                            }
                                            className="w-full py-2.5 first:pt-0 last:pb-0 flex items-start gap-3 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/30 rounded-[2px] px-1 -mx-1 transition-colors cursor-pointer"
                                        >
                                            <div
                                                className={`mt-0.5 h-6 w-6 rounded-[3px] flex items-center justify-center shrink-0 ${
                                                    alert.type === 'cash_diff'
                                                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                                                        : alert.type === 'discount'
                                                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                                                          : alert.type === 'rx'
                                                            ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400'
                                                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                                                }`}
                                            >
                                                {alert.type === 'cash_diff' ? (
                                                    <Wallet className="h-3.5 w-3.5" />
                                                ) : alert.type === 'discount' ? (
                                                    <BadgePercent className="h-3.5 w-3.5" />
                                                ) : alert.type === 'rx' ? (
                                                    <FileWarning className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Users className="h-3.5 w-3.5" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
                                                    {alert.title}
                                                </div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {alert.subtitle}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* ==================== SINGLE BRANCH DRILLDOWN / MANAGER VIEW ==================== */
                <div className="space-y-3.5 font-sans text-xs">
                    {/* Mode Switcher Bar + Back to All Branches */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {canViewAllBranches && (
                                <button
                                    type="button"
                                    onClick={() => navigateFilter(period, 'all')}
                                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0E5F3F] hover:text-[#0E5F3F] mr-1 cursor-pointer"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    All branches
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setViewTab('manager')}
                                className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-[2px] text-xs font-semibold border transition-colors cursor-pointer ${
                                    viewTab === 'manager'
                                        ? 'bg-[#0E5F3F] border-[#0E5F3F] text-white'
                                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1e2329] text-slate-700 dark:text-slate-300 hover:border-[#0E5F3F]'
                                }`}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                Manager Control View
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewTab('tv')}
                                className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-[2px] text-xs font-semibold border transition-colors cursor-pointer ${
                                    viewTab === 'tv'
                                        ? 'bg-[#0E5F3F] border-[#0E5F3F] text-white'
                                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1e2329] text-slate-700 dark:text-slate-300 hover:border-[#0E5F3F]'
                                }`}
                            >
                                <Monitor className="h-3.5 w-3.5" />
                                Customer TV / Token Display
                            </button>
                        </div>

                        <div className="flex items-center gap-3 text-[11.5px] text-slate-500 dark:text-slate-400">
                            {delayedQueuedCount > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-[2px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                                    <AlertTriangle className="h-3 w-3 animate-pulse" />
                                    {delayedQueuedCount} delayed (&gt;5m)
                                </span>
                            )}
                            {syncedAt && (
                                <span className="tabular-nums">
                                    Synced:{' '}
                                    <strong className="text-slate-700 dark:text-slate-200">
                                        {syncedAt}
                                    </strong>
                                </span>
                            )}
                        </div>
                    </div>

                    {viewTab === 'manager' ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <MetricCard
                                    title="Open Counters"
                                    value={`${onlineCount} / ${counters.length}`}
                                    description={`${onBreakCount} on break · ${closedCount} closed`}
                                    icon={Store}
                                />
                                <MetricCard
                                    title="Active Queue"
                                    value={totalQueuedOrders}
                                    description={
                                        totalQueuedOrders > 0
                                            ? `Max wait: ${formatWaitLabel(maxWaitMinutes)}`
                                            : 'All counter queues clear'
                                    }
                                    icon={Clock}
                                />
                                <MetricCard
                                    title="Long Wait (> 5m)"
                                    value={delayedQueuedCount}
                                    description={
                                        delayedQueuedCount > 0
                                            ? 'Action needed — reassign to free counter'
                                            : 'No delayed orders right now'
                                    }
                                    icon={AlertTriangle}
                                />
                                <MetricCard
                                    title="Unassigned Orders"
                                    value={unassignedOrders.length}
                                    description={
                                        unassignedOrders.length > 0
                                            ? 'Waiting for an available counter'
                                            : 'All submitted orders routed'
                                    }
                                    icon={AlertCircle}
                                />
                            </div>

                            {delayedQueuedCount > 0 && (
                                <div className="rounded-[2px] border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/30 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200">
                                        <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
                                        <span className="text-xs font-semibold">
                                            সতর্কতা: <strong>{delayedQueuedCount}টি অর্ডার</strong> ৫ মিনিটের বেশি সময় ধরে অপেক্ষায় আছে (সর্বোচ্চ{' '}
                                            <strong>{formatWaitLabel(maxWaitMinutes)}</strong>)। দ্রুত খালি কাউন্টারে ট্রান্সফার করুন।
                                        </span>
                                    </div>
                                </div>
                            )}

                            {unassignedOrders.length > 0 && (
                                <div className="rounded-[2px] border border-amber-300 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/20 p-3 space-y-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                            <div>
                                                <span className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                                                    {unassignedOrders.length} Unassigned Order
                                                    {unassignedOrders.length > 1 ? 's' : ''}
                                                </span>
                                                <span className="text-[11px] text-amber-700 dark:text-amber-300 ml-2">
                                                    Submitted while all counters were closed, on break, or full.
                                                </span>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={handleRetryUnassigned}
                                            disabled={retrying}
                                            className="h-7 px-3 text-[11.5px]"
                                        >
                                            <RefreshCw
                                                className={`h-3 w-3 mr-1 ${
                                                    retrying ? 'animate-spin' : ''
                                                }`}
                                            />
                                            Auto-Assign All
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {unassignedOrders.map((ord) => (
                                            <div
                                                key={ord.id}
                                                className={`px-3 py-2 rounded-[2px] border flex items-center justify-between gap-2 bg-white dark:bg-[#151921] ${
                                                    ord.is_delayed
                                                        ? 'border-rose-300 dark:border-rose-800'
                                                        : 'border-amber-200 dark:border-amber-800/50'
                                                }`}
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 font-bold tabular-nums text-slate-900 dark:text-white">
                                                        <span>#{ord.order_number}</span>
                                                        <span
                                                            className={`text-[10px] px-1.5 py-0.2 rounded-[2px] font-semibold ${
                                                                ord.is_delayed
                                                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                                            }`}
                                                        >
                                                            {formatWaitLabel(ord.waiting_minutes)} wait
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 truncate">
                                                        {ord.customer_name} · {ord.items_count} items ·{' '}
                                                        <strong className="text-[#0E5F3F]">
                                                            {formatCurrency(ord.total_amount, currency)}
                                                        </strong>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenReassign(ord)}
                                                    className="inline-flex items-center gap-1 h-6 px-2 rounded-[2px] border border-[#0E5F3F]/40 bg-[#EAF5F0] text-[#0E5F3F] hover:bg-[#0E5F3F] hover:text-white text-[11px] font-semibold transition-colors shrink-0 cursor-pointer"
                                                >
                                                    <ArrowRightLeft className="h-3 w-3" />
                                                    Assign
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Counter Filter Pills */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                {(
                                    [
                                        { id: 'all', label: `All Counters (${counters.length})` },
                                        { id: 'online', label: `Online (${onlineCount})` },
                                        {
                                            id: 'delayed',
                                            label: `Delayed >5m (${
                                                counters.filter((c) => c.delayed_count > 0).length
                                            })`,
                                        },
                                        {
                                            id: 'offline',
                                            label: `Break / Closed (${onBreakCount + closedCount})`,
                                        },
                                    ] as const
                                ).map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setCounterFilter(f.id)}
                                        className={`h-7 px-2.5 rounded-[2px] text-[11.5px] font-semibold border transition-colors cursor-pointer ${
                                            counterFilter === f.id
                                                ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200'
                                                : 'bg-white dark:bg-[#151921] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {/* Compact Counter Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {filteredCounters.map((c) => {
                                    const isOnline = c.status === 'active';
                                    const isOnBreak = c.status === 'on_break';
                                    const hasDelayed = c.delayed_count > 0;
                                    const pct = Math.min(
                                        100,
                                        Math.round(
                                            (c.queue_count / Math.max(1, c.max_queue_capacity)) *
                                                100
                                        )
                                    );
                                    const nowServing = c.active_orders[0] ?? null;
                                    const waitingList = c.active_orders.slice(1);

                                    return (
                                        <div
                                            key={c.id}
                                            className={`rounded-[2px] border bg-white dark:bg-[#151921] overflow-hidden flex flex-col ${
                                                hasDelayed
                                                    ? 'border-rose-300 dark:border-rose-800'
                                                    : isOnline
                                                      ? 'border-slate-200 dark:border-slate-800'
                                                      : 'border-slate-200/80 dark:border-slate-800/80 opacity-90'
                                            }`}
                                        >
                                            <div className="px-3 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#12161c] space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="px-1.5 py-0.5 rounded-[2px] bg-[#0E5F3F] text-white tabular-nums font-bold text-[11px] shrink-0">
                                                            {c.code}
                                                        </span>
                                                        <h4 className="font-bold text-slate-900 dark:text-white text-[13px] truncate">
                                                            {c.name}
                                                        </h4>
                                                    </div>

                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10.5px] font-semibold border shrink-0 ${
                                                            isOnline
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                                : isOnBreak
                                                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                                                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${
                                                                isOnline
                                                                    ? 'bg-emerald-500'
                                                                    : isOnBreak
                                                                      ? 'bg-amber-500'
                                                                      : 'bg-slate-400'
                                                            }`}
                                                        />
                                                        {isOnline
                                                            ? 'Online'
                                                            : isOnBreak
                                                              ? 'On Break'
                                                              : 'Closed'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                    <div className="flex items-center gap-1 min-w-0">
                                                        <User className="h-3 w-3 shrink-0" />
                                                        <span className="truncate text-slate-700 dark:text-slate-200 font-medium">
                                                            {c.current_cashier || 'No cashier'}
                                                        </span>
                                                        {c.shift_opened_at && (
                                                            <span className="text-slate-400">
                                                                · {c.shift_opened_at}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 tabular-nums">
                                                        <span>
                                                            Done:{' '}
                                                            <strong className="text-slate-700 dark:text-slate-200">
                                                                {c.completed_bills ?? 0}
                                                            </strong>
                                                        </span>
                                                        <span>
                                                            Queue:{' '}
                                                            <strong className="text-[#0E5F3F]">
                                                                {c.queue_count}
                                                            </strong>
                                                            /{c.max_queue_capacity}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all ${
                                                            hasDelayed || pct >= 85
                                                                ? 'bg-rose-500'
                                                                : pct >= 60
                                                                  ? 'bg-amber-500'
                                                                  : 'bg-[#0E5F3F]'
                                                        }`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="p-2.5 flex-1 flex flex-col justify-between space-y-2">
                                                {!nowServing ? (
                                                    <div className="py-4 px-2 text-center">
                                                        {isOnline ? (
                                                            <div className="inline-flex items-center gap-1.5 text-[11.5px] text-emerald-700 dark:text-emerald-400 font-medium">
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                <span>
                                                                    Queue clear · Ready for next order
                                                                </span>
                                                            </div>
                                                        ) : isOnBreak ? (
                                                            <div className="inline-flex items-center gap-1.5 text-[11.5px] text-amber-700 dark:text-amber-400 font-medium">
                                                                <Coffee className="h-3.5 w-3.5" />
                                                                <span>
                                                                    Counter on break
                                                                    {c.break_reason
                                                                        ? ` (${c.break_reason})`
                                                                        : ''}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11.5px] text-slate-400">
                                                                Counter closed · No active shift
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        <div
                                                            className={`p-2 rounded-[2px] border flex items-center justify-between gap-2 ${
                                                                nowServing.is_delayed
                                                                    ? 'border-rose-300 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/25'
                                                                    : 'border-[#0E5F3F]/30 bg-[#EAF5F0]/55 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                                                            }`}
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="px-1.5 py-0.2 rounded-[2px] bg-[#0E5F3F] text-white text-[10px] font-bold">
                                                                        Serving
                                                                    </span>
                                                                    <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                                                                        #{nowServing.order_number}
                                                                    </span>
                                                                    <span
                                                                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-[2px] text-[10px] font-bold tabular-nums ${
                                                                            nowServing.is_delayed
                                                                                ? 'bg-rose-600 text-white animate-pulse'
                                                                                : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                                        }`}
                                                                    >
                                                                        <Clock className="h-2.5 w-2.5" />
                                                                        {formatWaitLabel(
                                                                            nowServing.waiting_minutes
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                                                                    {nowServing.customer_name} ·{' '}
                                                                    {nowServing.items_count} items ·{' '}
                                                                    <strong>
                                                                        {formatCurrency(
                                                                            nowServing.total_amount,
                                                                            currency
                                                                        )}
                                                                    </strong>
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleOpenReassign(nowServing)
                                                                }
                                                                className="inline-flex items-center gap-1 h-6 px-2 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0E5F3F] hover:text-[#0E5F3F] shrink-0 cursor-pointer"
                                                            >
                                                                <ArrowRightLeft className="h-3 w-3" />
                                                                Move
                                                            </button>
                                                        </div>

                                                        {waitingList.length > 0 && (
                                                            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-[2px]">
                                                                {waitingList.map((ord, idx) => (
                                                                    <div
                                                                        key={ord.id}
                                                                        className={`px-2 py-1.5 flex items-center justify-between gap-2 ${
                                                                            ord.is_delayed
                                                                                ? 'bg-rose-50/60 dark:bg-rose-950/20'
                                                                                : 'bg-white dark:bg-[#151921]'
                                                                        }`}
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="text-[10.5px] text-slate-400 font-mono">
                                                                                    #{idx + 2}
                                                                                </span>
                                                                                <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                                                                    #{ord.order_number}
                                                                                </span>
                                                                                <span
                                                                                    className={`px-1 py-0.2 rounded-[2px] text-[10px] font-bold tabular-nums ${
                                                                                        ord.is_delayed
                                                                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                                                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                                                    }`}
                                                                                >
                                                                                    {formatWaitLabel(
                                                                                        ord.waiting_minutes
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-[10.5px] text-slate-500 truncate">
                                                                                {ord.customer_name} ·{' '}
                                                                                {formatCurrency(
                                                                                    ord.total_amount,
                                                                                    currency
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleOpenReassign(ord)
                                                                            }
                                                                            className="text-[11px] font-semibold text-[#0E5F3F] dark:text-emerald-400 hover:underline shrink-0 cursor-pointer"
                                                                        >
                                                                            Move
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Unified Live Queue DataTable */}
                            <DataTable
                                tableId="counter-monitoring-active-queue"
                                data={allQueuedOrders}
                                columns={activeQueueColumns}
                                keyExtractor={(ord) => ord.id}
                                selectable={false}
                                hideCheckbox
                                hideFilter
                                hideViewToggle
                                syncUrlParams={false}
                                onRefresh={handleManualRefresh}
                                isRefreshing={refreshing}
                                searchPlaceholders={[
                                    'Search order #, customer, counter, or salesman...',
                                ]}
                                headerTabs={
                                    <div className="py-1.5 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-[#0E5F3F]" />
                                            <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100">
                                                All Active Queue Orders (Sorted by Longest Wait)
                                            </h3>
                                        </div>
                                        <span className="text-[11.5px] text-slate-500">
                                            Total in queue: <strong>{allQueuedOrders.length}</strong>
                                        </span>
                                    </div>
                                }
                                actionsColumnClassName="w-[100px] text-right"
                                actions={(ord) => (
                                    <button
                                        type="button"
                                        onClick={() => handleOpenReassign(ord)}
                                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[2px] border border-[#0E5F3F]/45 bg-[#EAF5F0] text-[#0E5F3F] hover:bg-[#0E5F3F] hover:text-white text-[11.5px] font-semibold transition-colors cursor-pointer"
                                    >
                                        <ArrowRightLeft className="h-3 w-3" />
                                        Transfer
                                    </button>
                                )}
                                emptyState={
                                    <EmptyState
                                        title="No waiting orders in queue"
                                        description="Submitted sales orders will appear here in real time."
                                    />
                                }
                            />
                        </>
                    ) : (
                        /* Customer TV / Token Display */
                        <div className="rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1318] overflow-hidden shadow-sm">
                            <div className="px-5 py-3.5 bg-[#0E5F3F] text-white flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <Monitor className="h-5 w-5" />
                                    <div>
                                        <div className="text-[15px] font-bold leading-tight">
                                            {branchName} — Live Billing Token Display
                                        </div>
                                        <div className="text-[11.5px] text-emerald-100">
                                            অনুগ্রহ করে আপনার অর্ডার নম্বর দেখে নির্ধারিত ক্যাশ কাউন্টারে যোগাযোগ করুন
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right tabular-nums">
                                    <div className="text-[18px] font-bold leading-tight">{clockStr}</div>
                                    <div className="text-[11px] text-emerald-100">
                                        Open Counters: {onlineCount}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 min-h-[420px]">
                                <div className="lg:col-span-7 p-4 space-y-3">
                                    <h3 className="text-[14px] font-bold text-[#0E5F3F] dark:text-emerald-400">
                                        Now Serving at Counters (চলমান বিলিং)
                                    </h3>

                                    {activeTvCounters.length === 0 ? (
                                        <div className="py-16 text-center text-sm text-slate-400">
                                            বর্তমানে সব ক্যাশ কাউন্টার বন্ধ আছে।
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {activeTvCounters.map((c) => {
                                                const current = c.active_orders[0] ?? null;
                                                const isBreak = c.status === 'on_break';

                                                return (
                                                    <div
                                                        key={c.id}
                                                        className={`p-4 rounded-[3px] border-2 flex flex-col justify-between min-h-[132px] ${
                                                            isBreak
                                                                ? 'border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20'
                                                                : current
                                                                  ? 'border-[#0E5F3F] bg-[#EAF5F0]/50 dark:bg-emerald-950/25'
                                                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151921]'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="px-2.5 py-0.5 rounded-[2px] bg-[#0E5F3F] text-white font-bold text-xs tabular-nums">
                                                                Counter {c.code}
                                                            </span>
                                                            <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
                                                                {c.name}
                                                            </span>
                                                        </div>

                                                        {isBreak ? (
                                                            <div className="pt-3 text-sm font-bold text-amber-700 dark:text-amber-300">
                                                                সাময়িক বিরতি (On Break)
                                                            </div>
                                                        ) : current ? (
                                                            <div className="pt-2">
                                                                <div className="text-[24px] font-extrabold tabular-nums text-slate-900 dark:text-white leading-tight">
                                                                    #{current.order_number}
                                                                </div>
                                                                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate mt-0.5">
                                                                    {current.customer_name}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="pt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                                                কাউন্টার খালি আছে (Ready)
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="lg:col-span-5 p-4 bg-slate-50/50 dark:bg-[#12161c] space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">
                                            Up Next in Queue (অপেক্ষমাণ সিরিয়াল)
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-xs font-bold tabular-nums">
                                            {upcomingTvQueue.length}
                                        </span>
                                    </div>

                                    {upcomingTvQueue.length === 0 ? (
                                        <div className="py-16 text-center text-xs text-slate-400">
                                            অপেক্ষমাণ লাইনে কোনো অর্ডার নেই।
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[360px] overflow-y-auto">
                                            {upcomingTvQueue.map((ord, idx) => (
                                                <div
                                                    key={ord.id}
                                                    className="px-3.5 py-2.5 rounded-[2px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181d25] flex items-center justify-between gap-2"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                                                            {idx + 1}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <div className="text-[15px] font-bold tabular-nums text-slate-900 dark:text-white">
                                                                #{ord.order_number}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 truncate">
                                                                {ord.customer_name}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="px-2 py-1 rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-xs tabular-nums shrink-0">
                                                        → {ord.counter_code}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Reassign Modal */}
            <BrtaFormModal
                open={Boolean(reassignModalOpen && selectedOrder)}
                onClose={() => setReassignModalOpen(false)}
                onSubmit={handleConfirmReassign}
                title={
                    selectedOrder
                        ? `Transfer Order #${selectedOrder.order_number}`
                        : 'Transfer Order'
                }
                subtitle="Move active billing order to another open counter queue"
                icon={<ArrowRightLeft className="h-4 w-4" />}
                maxWidth="md"
                footerProps={{
                    submitLabel: 'Confirm Transfer',
                    submitting: submittingReassign,
                    submitDisabled: !targetCounterId,
                }}
            >
                {selectedOrder && (
                    <div className="p-3 bg-[#F8FAF8] dark:bg-[#12161c] rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-[#555555] dark:text-slate-400">
                                Customer:
                            </span>
                            <span className="font-semibold text-[#222222] dark:text-white">
                                {selectedOrder.customer_name}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[#555555] dark:text-slate-400">
                                Total Payable:
                            </span>
                            <span className="font-mono font-bold text-[#0E5F3F]">
                                {formatCurrency(selectedOrder.total_amount, currency)}
                            </span>
                        </div>
                    </div>
                )}

                <BrtaField label="Destination Counter" required>
                    <select
                        required
                        value={targetCounterId}
                        onChange={(e) => setTargetCounterId(Number(e.target.value))}
                        className={brtaInputClass}
                    >
                        <option value="">Select Target Counter</option>
                        {counters.map((c) => (
                            <option
                                key={c.id}
                                value={c.id}
                                disabled={c.status === 'closed'}
                            >
                                {c.name} ({c.code}) — {c.status} ({c.queue_count}/
                                {c.max_queue_capacity} in queue)
                            </option>
                        ))}
                    </select>
                </BrtaField>

                <BrtaField label="Transfer Reason" required>
                    <input
                        type="text"
                        required
                        value={reassignReason}
                        onChange={(e) => setReassignReason(e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
            </BrtaFormModal>
        </AppLayout>
    );
}
