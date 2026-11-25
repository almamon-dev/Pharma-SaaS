import React, { useEffect, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Activity,
    Check,
    Coffee,
    Edit2,
    FileText,
    KeyRound,
    Layers,
    LogOut,
    Plus,
    Printer,
    Search,
    ShieldAlert,
    ShoppingCart,
    Store,
    Trash2,
    User,
    UserCheck,
    Users,
    Wallet,
    X,
    Zap,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { FormLayoutProvider, HorizontalFormRow } from '@/Components/ui/FormLayout';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { TableActionMenu, TableActionItem, TablePagination } from '@/Components/tables';
import { formatCurrency } from '@/lib/format';
import { SharedPageProps } from '@/types';
import {
    CloseShiftModal,
    ForceCloseShiftModal,
    OpenShiftModal,
    PosCounterData,
    TakeBreakModal,
} from '../Pos/components/PosShiftModals';
import CashMovementModal from './components/CashMovementModal';
import ZReportModal from './components/ZReportModal';

export interface AssignedCashierData {
    id: number;
    user_id: number;
    user_name?: string;
    shift: 'morning' | 'evening' | 'night' | 'any';
    is_primary: boolean;
    is_active: boolean;
}

export interface ExtendedCounterData extends Omit<PosCounterData, 'current_session'> {
    location?: string | null;
    max_queue_capacity?: number;
    auto_assignment_enabled?: boolean;
    active_queue_count?: number;
    assigned_cashiers?: AssignedCashierData[];
    printer_ip?: string | null;
    terminal_device_id?: string | null;
    is_active?: boolean;
    current_user?: { id: number; name: string } | null;
    current_session?: {
        id: number;
        user_id: number;
        user_name?: string | null;
        shift?: string;
        opened_at?: string | null;
        opened_at_time?: string | null;
        opening_float: number;
        opening_denominations?: Record<string, number> | null;
        cash_sales?: number;
        card_sales?: number;
        mobile_sales?: number;
        cash_in?: number;
        cash_out_total?: number;
        cash_refunds?: number;
        total_sales_amount: number;
        total_transactions: number;
        system_expected_cash: number;
    } | null;
}

interface RecentSession {
    id: number;
    z_report_number?: string | null;
    is_force_closed?: boolean;
    force_close_reason?: string | null;
    counter_code?: string;
    counter_name?: string;
    user_name?: string;
    status: string;
    shift?: string;
    opened_at?: string;
    closed_at?: string;
    opening_float: number;
    cash_in_total?: number;
    cash_out_total?: number;
    cash_refunds_total?: number;
    closing_cash_counted?: number | null;
    system_expected_cash: number;
    discrepancy?: number | null;
    total_sales_amount: number;
    total_transactions: number;
    notes?: string | null;
}

interface EligibleCashier {
    id: number;
    name: string;
    email?: string;
}

interface CountersIndexProps {
    counters: ExtendedCounterData[];
    recentSessions: RecentSession[];
    eligibleCashiers?: EligibleCashier[];
    branchName?: string | null;
    currency: string;
    canManageCounters?: boolean;
    isCashier?: boolean;
}

export default function CountersIndex({
    counters = [],
    recentSessions = [],
    eligibleCashiers = [],
    branchName,
    currency = 'BDT',
    canManageCounters = true,
    isCashier = false,
}: CountersIndexProps) {
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editingCounter, setEditingCounter] = useState<ExtendedCounterData | null>(null);
    const [assignCashierCounter, setAssignCashierCounter] = useState<ExtendedCounterData | null>(null);

    // Active session modal targets
    const { auth, flash } = usePage<SharedPageProps>().props;
    const currentUserId = auth?.user?.id ?? null;
    const [openShiftCounter, setOpenShiftCounter] = useState<PosCounterData | null>(null);
    const [breakCounter, setBreakCounter] = useState<PosCounterData | null>(null);
    const [closeShiftCounter, setCloseShiftCounter] = useState<PosCounterData | null>(null);
    const [forceCloseCounter, setForceCloseCounter] = useState<PosCounterData | null>(null);
    const [cashMovementCounter, setCashMovementCounter] = useState<PosCounterData | null>(null);
    const [zReportSessionId, setZReportSessionId] = useState<number | null>(null);
    const [resumeCounter, setResumeCounter] = useState<PosCounterData | null>(null);
    const [resumePin, setResumePin] = useState('');
    const [resumeError, setResumeError] = useState('');
    const [resumeSubmitting, setResumeSubmitting] = useState(false);

    useEffect(() => {
        if (flash?.lastClosedSessionId) {
            setZReportSessionId(flash.lastClosedSessionId);
        }
    }, [flash?.lastClosedSessionId]);

    const handleDeleteCounter = (counter: ExtendedCounterData) => {
        if (counter.status !== 'closed') {
            alert(`Cannot delete Counter ${counter.code} while a shift is active. Please close the shift first.`);
            return;
        }
        if (confirm(`Are you sure you want to delete Counter ${counter.code} (${counter.name})?`)) {
            router.delete(route('counters.destroy', counter.id));
        }
    };

    const handleDeleteSession = (session: RecentSession) => {
        if (session.status === 'open') {
            alert('Cannot delete an active open shift session. Close it first.');
            return;
        }
        if (confirm(`Delete shift session record for ${session.counter_code || 'Counter'} (${session.opened_at})?`)) {
            router.delete(route('counters.sessions.destroy', session.id));
        }
    };

    // Filters
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on_break' | 'closed'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sessionPage, setSessionPage] = useState(1);
    const [sessionPerPage, setSessionPerPage] = useState(10);

    const sessionTotal = recentSessions.length;
    const sessionTotalPages = Math.max(1, Math.ceil(sessionTotal / sessionPerPage));
    const validSessionPage = Math.min(Math.max(1, sessionPage), sessionTotalPages);
    const sessionStartIdx = (validSessionPage - 1) * sessionPerPage;
    const paginatedSessions = recentSessions.slice(sessionStartIdx, sessionStartIdx + sessionPerPage);

    const filteredCounters = counters.filter((c) => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                c.code.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                c.type.toLowerCase().includes(q) ||
                (c.location && c.location.toLowerCase().includes(q)) ||
                (c.current_user_name && c.current_user_name.toLowerCase().includes(q))
            );
        }
        return true;
    });

    const activeCount = counters.filter((c) => c.status === 'active').length;
    const breakCount = counters.filter((c) => c.status === 'on_break').length;
    const closedCount = counters.filter((c) => c.status === 'closed').length;
    const myActiveCounter = counters.find(
        (c) =>
            c.status !== 'closed' &&
            (c.current_session?.user_id === currentUserId || c.current_user?.id === currentUserId)
    );
    const canOpenPosNow = canManageCounters || (myActiveCounter?.status === 'active');

    const handleResumeService = (e: React.FormEvent) => {
        e.preventDefault();
        if (!resumeCounter || !resumePin) return;

        setResumeSubmitting(true);
        setResumeError('');
        router.post(
            route('counters.resume-service', resumeCounter.id),
            { pin: resumePin },
            {
                onSuccess: () => {
                    setResumeSubmitting(false);
                    setResumeCounter(null);
                    setResumePin('');
                },
                onError: (errs) => {
                    setResumeSubmitting(false);
                    setResumeError(Object.values(errs)[0] || 'Invalid PIN or password.');
                },
            }
        );
    };

    return (
        <AppLayout
            title={isCashier ? 'My Shift & Register' : 'Counters & Shifts'}
            subtitle={
                isCashier
                    ? myActiveCounter
                        ? `${branchName ?? 'Branch'} · Shift running on ${myActiveCounter.code}`
                        : `${branchName ?? 'Branch'} · Personal shift station, float, and sales log`
                    : `${branchName ?? 'Branch'} · Counter terminals, cashier shift schedules, & dynamic queues`
            }
            actions={
                <div className="flex items-center gap-2">
                    {canManageCounters && (
                        <Link href={route('counters.monitoring')}>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-[3px] hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <Activity className="h-3.5 w-3.5 text-[#FF4A1F]" />
                                <span>Live Queue Monitor</span>
                            </Button>
                        </Link>
                    )}

                    {canManageCounters ? (
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => setCreateModalOpen(true)}
                            className="gap-1.5 bg-[#FF4A1F] hover:bg-[#e03d15] text-white text-xs font-semibold rounded-[3px]"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Counter</span>
                        </Button>
                    ) : canOpenPosNow ? (
                        <Link href={route('pos.index', undefined, false)}>
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                className="gap-1.5 bg-[#FF4A1F] hover:bg-[#e03d15] text-white text-xs font-semibold rounded-[3px]"
                            >
                                <ShoppingCart className="h-3.5 w-3.5" />
                                <span>Open POS Terminal</span>
                            </Button>
                        </Link>
                    ) : (
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled
                            title="Open a shift on a counter first to unlock POS Terminal"
                            className="gap-1.5 bg-[#FF4A1F]/50 text-white text-xs font-semibold rounded-[3px] cursor-not-allowed"
                        >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            <span>Open POS Terminal</span>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title={isCashier ? 'My Shift & Register' : 'Counters & Shifts'} />

            <div className="space-y-3.5">
                {/* Segmented Control & Search */}
                {canManageCounters ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="inline-flex items-center gap-1 bg-slate-100/80 dark:bg-[#181d26] p-0.5 rounded-[3px] border border-slate-200/60 dark:border-slate-800/60 overflow-x-auto text-xs">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('all')}
                                className={`px-3 py-1.5 rounded-[3px] font-medium transition-colors cursor-pointer ${
                                    statusFilter === 'all'
                                        ? 'bg-white dark:bg-[#12161c] text-slate-900 dark:text-white font-semibold border border-slate-200/80 dark:border-slate-700 shadow-none'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                All ({counters.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('active')}
                                className={`px-3 py-1.5 rounded-[3px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    statusFilter === 'active'
                                        ? 'bg-white dark:bg-[#12161c] text-emerald-600 dark:text-emerald-400 font-semibold border border-slate-200/80 dark:border-slate-700 shadow-none'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Serving ({activeCount})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('on_break')}
                                className={`px-3 py-1.5 rounded-[3px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    statusFilter === 'on_break'
                                        ? 'bg-white dark:bg-[#12161c] text-amber-600 dark:text-amber-400 font-semibold border border-slate-200/80 dark:border-slate-700 shadow-none'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>On Break ({breakCount})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('closed')}
                                className={`px-3 py-1.5 rounded-[3px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    statusFilter === 'closed'
                                        ? 'bg-white dark:bg-[#12161c] text-slate-800 dark:text-slate-200 font-semibold border border-slate-200/80 dark:border-slate-700 shadow-none'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                <span>Closed ({closedCount})</span>
                            </button>
                        </div>

                        <div className="w-full sm:w-64">
                            <Input
                                placeholder="Filter counter, cashier, zone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                icon={<Search className="h-3.5 w-3.5 text-slate-400" />}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-xs py-1 text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {counters.some((c) => c.status === 'active' || c.status === 'on_break')
                                ? 'Your Current Shift Terminal'
                                : 'Select an Available Counter to Open Shift'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                            Logged in as: <strong className="text-slate-700 dark:text-slate-300">Cashier</strong>
                        </span>
                    </div>
                )}

                {/* Counter Stations Grid */}
                {filteredCounters.length === 0 ? (
                    <div className="text-center py-10 rounded-[3px] border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-[#12161c] p-6">
                        <Store className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No counters found</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs mx-auto">
                            No counter terminals match the selected filter.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredCounters.map((counter) => {
                            const session = counter.current_session;
                            const isActive = counter.status === 'active';
                            const isOnBreak = counter.status === 'on_break';
                            const isClosed = counter.status === 'closed';
                            const queueCount = counter.active_queue_count ?? 0;
                            const maxCapacity = counter.max_queue_capacity ?? 20;
                            const isFull = queueCount >= maxCapacity;

                            const actionItems: TableActionItem[] = [
                                ...(isClosed
                                    ? [
                                          {
                                              key: 'open-shift',
                                              label: 'Open Shift Float',
                                              icon: <Plus className="h-3.5 w-3.5 text-[#FF4A1F]" />,
                                              onClick: () => setOpenShiftCounter(counter),
                                          },
                                      ]
                                    : isOnBreak
                                    ? [
                                          {
                                              key: 'resume-shift',
                                              label: 'Resume Shift (PIN)',
                                              icon: <KeyRound className="h-3.5 w-3.5 text-amber-600" />,
                                              onClick: () => setResumeCounter(counter),
                                          },
                                          {
                                              key: 'close-shift',
                                              label: 'Close Shift',
                                              icon: <LogOut className="h-3.5 w-3.5 text-rose-600" />,
                                              variant: 'danger' as const,
                                              onClick: () => setCloseShiftCounter(counter),
                                          },
                                      ]
                                    : [
                                          {
                                              key: 'cash-movement',
                                              label: 'Cash In / Out / Refund',
                                              icon: <Wallet className="h-3.5 w-3.5 text-emerald-600" />,
                                              onClick: () => setCashMovementCounter(counter),
                                          },
                                          ...(session
                                              ? [
                                                    {
                                                        key: 'x-report',
                                                        label: 'Live X-Report',
                                                        icon: <FileText className="h-3.5 w-3.5 text-blue-600" />,
                                                        onClick: () => setZReportSessionId(session.id),
                                                    },
                                                ]
                                              : []),
                                          {
                                              key: 'take-break',
                                              label: 'Take Break',
                                              icon: <Coffee className="h-3.5 w-3.5 text-amber-600" />,
                                              onClick: () => setBreakCounter(counter),
                                          },
                                          {
                                              key: 'close-shift',
                                              label: 'Close Shift',
                                              icon: <LogOut className="h-3.5 w-3.5 text-rose-600" />,
                                              variant: 'danger' as const,
                                              onClick: () => setCloseShiftCounter(counter),
                                          },
                                          ...(canManageCounters
                                              ? [
                                                    {
                                                        key: 'force-close',
                                                        label: 'Force Close Shift (Admin)',
                                                        icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />,
                                                        variant: 'danger' as const,
                                                        onClick: () => setForceCloseCounter(counter),
                                                    },
                                                ]
                                              : []),
                                      ]),
                                ...(canManageCounters
                                    ? [
                                          {
                                              key: 'assign-cashier',
                                              label: 'Assign Cashiers & Shifts',
                                              icon: <Users className="h-3.5 w-3.5 text-blue-600" />,
                                              onClick: () => setAssignCashierCounter(counter),
                                          },
                                          {
                                              key: 'edit',
                                              label: 'Edit Counter',
                                              icon: <Edit2 className="h-3.5 w-3.5 text-slate-500" />,
                                              onClick: () => setEditingCounter(counter),
                                          },
                                          {
                                              key: 'delete',
                                              label: 'Delete Counter',
                                              icon: <Trash2 className="h-3.5 w-3.5 text-rose-600" />,
                                              variant: 'danger' as const,
                                              onClick: () => handleDeleteCounter(counter),
                                          },
                                      ]
                                    : []),
                            ];

                            const isOwnActive =
                                !isClosed &&
                                (session?.user_id === currentUserId || counter.current_user?.id === currentUserId);

                            return (
                                <div
                                    key={counter.id}
                                    className={`rounded-[5px] border bg-white dark:bg-[#12161c] flex flex-col justify-between overflow-hidden transition-all shadow-none ${
                                        isActive
                                            ? 'border-[#FF4A1F] ring-1 ring-[#FF4A1F]/15'
                                            : 'border-slate-200 dark:border-slate-800'
                                    }`}
                                >
                                    {/* Card Header */}
                                    <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-[#151921]/50">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2 min-w-0">
                                                <span className="px-1.5 py-0.5 rounded-[3px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-xs text-slate-800 dark:text-slate-200 shrink-0 mt-0.5">
                                                    {counter.code}
                                                </span>
                                                <div className="min-w-0">
                                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug truncate">
                                                        {counter.name}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                                                        <span className="uppercase font-semibold tracking-wider">{counter.type}</span>
                                                        {counter.location && <span>· {counter.location}</span>}
                                                        {counter.zone && <span>· {counter.zone}</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Auto-Assignment Pill */}
                                            {counter.auto_assignment_enabled ? (
                                                <span
                                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[3px] text-[9.5px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0"
                                                    title="Automatic order routing enabled"
                                                >
                                                    <Zap className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                                                    Auto
                                                </span>
                                            ) : (
                                                <span
                                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[3px] text-[9.5px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0"
                                                    title="Manual assignment only"
                                                >
                                                    Manual
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Content */}
                                    <div className="p-3 text-xs flex-1 flex flex-col justify-between space-y-2.5">
                                        {/* Active Queue Bar */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-slate-500 font-medium">Active Queue</span>
                                                <span
                                                    className={`font-mono font-bold ${
                                                        isFull
                                                            ? 'text-rose-600 dark:text-rose-400'
                                                            : queueCount > 0
                                                            ? 'text-[#FF4A1F]'
                                                            : 'text-slate-600 dark:text-slate-400'
                                                    }`}
                                                >
                                                    {queueCount} / {maxCapacity} {isFull && '(Full)'}
                                                </span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-300 ${
                                                        isFull
                                                            ? 'bg-rose-500'
                                                            : queueCount / maxCapacity > 0.7
                                                            ? 'bg-amber-500'
                                                            : 'bg-[#FF4A1F]'
                                                    }`}
                                                    style={{ width: `${Math.min(100, (queueCount / maxCapacity) * 100)}%` }}
                                                />
                                            </div>
                                        </div>

                                        {session ? (
                                            <div className="space-y-1.5 py-1 text-[11.5px] border-t border-slate-100 dark:border-slate-800/80 pt-2">
                                                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                                    <span>Active Shift:</span>
                                                    <span className="font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded-[3px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                        {session.shift || 'Morning'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                                    <span>Drawer Cash:</span>
                                                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                        {formatCurrency(session.system_expected_cash, currency)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                                    <span>Shift Sales:</span>
                                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(session.total_sales_amount, currency)} ({session.total_transactions})
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                                                Ready for cashier shift
                                            </div>
                                        )}

                                        {/* Assigned Staff Mini-Chips */}
                                        {counter.assigned_cashiers && counter.assigned_cashiers.length > 0 && (
                                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                                <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                                                    Assigned Cashiers ({counter.assigned_cashiers.length}):
                                                </span>
                                                <div className="flex flex-wrap gap-1">
                                                    {counter.assigned_cashiers.map((ac) => (
                                                        <span
                                                            key={ac.id}
                                                            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-[3px] border ${
                                                                ac.is_primary
                                                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900'
                                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                                            }`}
                                                        >
                                                            <span>{ac.user_name || 'Staff'}</span>
                                                            <span className="opacity-70 text-[9px] uppercase">({ac.shift[0]})</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Card Footer: Active Cashier & Status Menu */}
                                        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                                            <div className="flex items-center justify-between text-[11.5px] text-slate-600 dark:text-slate-400 gap-2">
                                                <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                                                    <User className="h-3 w-3 text-slate-400 shrink-0" />
                                                    <span className="text-[11px] text-slate-500">Active:</span>
                                                    <span className="font-semibold text-slate-900 dark:text-white truncate">
                                                        {counter.current_user?.name || counter.current_user_name || (counter.status !== 'closed' ? 'Serving' : 'None')}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold border ${
                                                            isActive
                                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80'
                                                                : isOnBreak
                                                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80 animate-pulse'
                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200/80 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`w-1.5 h-1.5 rounded-full ${
                                                                isActive
                                                                    ? 'bg-emerald-500'
                                                                    : isOnBreak
                                                                    ? 'bg-amber-500'
                                                                    : 'bg-slate-400'
                                                            }`}
                                                        />
                                                        {isActive ? 'Open' : isOnBreak ? 'Break' : 'Closed'}
                                                    </span>

                                                    <TableActionMenu items={actionItems} label={`${counter.code} actions`} />
                                                </div>
                                            </div>

                                            {session && !isClosed && (
                                                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-snug">
                                                    Since {session.opened_at_time || '—'} · Float{' '}
                                                    <strong className="font-mono text-slate-700 dark:text-slate-200">
                                                        {formatCurrency(session.opening_float, currency)}
                                                    </strong>{' '}
                                                    · Sales{' '}
                                                    <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(session.total_sales_amount, currency)}
                                                    </strong>
                                                </div>
                                            )}

                                            {/* Primary Card Action Buttons (Matching Mockup) */}
                                            {isClosed ? (
                                                <Button
                                                    type="button"
                                                    variant="primary"
                                                    size="sm"
                                                    disabled={!!myActiveCounter}
                                                    onClick={() => setOpenShiftCounter(counter)}
                                                    className="w-full justify-center bg-[#FF4A1F] hover:bg-[#e03d15] text-white text-xs font-bold rounded-[4px]"
                                                >
                                                    {myActiveCounter ? 'Shift Active Elsewhere' : 'Open Shift'}
                                                </Button>
                                            ) : isActive ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {isOwnActive || canManageCounters ? (
                                                        <Link href={route('pos.index', undefined, false)} className="w-full">
                                                            <Button
                                                                type="button"
                                                                variant="primary"
                                                                size="sm"
                                                                className="w-full justify-center bg-[#FF4A1F] hover:bg-[#e03d15] text-white text-[11px] font-bold rounded-[4px]"
                                                            >
                                                                Open POS Terminal
                                                            </Button>
                                                        </Link>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled
                                                            className="w-full justify-center text-[11px] rounded-[4px]"
                                                        >
                                                            Locked
                                                        </Button>
                                                    )}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            canManageCounters && !isOwnActive
                                                                ? setForceCloseCounter(counter)
                                                                : setCloseShiftCounter(counter)
                                                        }
                                                        className="w-full justify-center border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-rose-400 hover:text-rose-600 text-[11px] font-semibold rounded-[4px]"
                                                    >
                                                        {canManageCounters && !isOwnActive ? 'Force Close' : 'Close Shift'}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => setResumeCounter(counter)}
                                                        className="w-full justify-center bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-[4px]"
                                                    >
                                                        Resume Shift
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            canManageCounters && !isOwnActive
                                                                ? setForceCloseCounter(counter)
                                                                : setCloseShiftCounter(counter)
                                                        }
                                                        className="w-full justify-center border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-rose-400 hover:text-rose-600 text-[11px] font-semibold rounded-[4px]"
                                                    >
                                                        {canManageCounters && !isOwnActive ? 'Force Close' : 'Close Shift'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Shift History & Z-Report Audit Log */}
                <div className="rounded-[3px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] overflow-hidden mt-4">
                    <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#151921]">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-[#FF4A1F]" />
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                {isCashier ? 'My Shift History & Z-Reports' : 'Shift Sessions & Z-Report Audit Log'}
                            </h3>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-400">
                                {recentSessions.length} records
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-[#f8fafc] dark:bg-[#181d26] text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="py-2 px-3 border-r border-slate-200/80 dark:border-slate-800/80">Counter</th>
                                    <th className="py-2 px-3 border-r border-slate-200/80 dark:border-slate-800/80">Cashier</th>
                                    <th className="py-2 px-3 border-r border-slate-200/80 dark:border-slate-800/80">Shift</th>
                                    <th className="py-2 px-3 border-r border-slate-200/80 dark:border-slate-800/80">Timing</th>
                                    <th className="py-2 px-3 text-right border-r border-slate-200/80 dark:border-slate-800/80">Opening Float</th>
                                    <th className="py-2 px-3 text-right border-r border-slate-200/80 dark:border-slate-800/80">Sales Amount</th>
                                    <th className="py-2 px-3 text-right border-r border-slate-200/80 dark:border-slate-800/80">Counted Cash</th>
                                    <th className="py-2 px-3 text-right border-r border-slate-200/80 dark:border-slate-800/80">Discrepancy</th>
                                    <th className="py-2 px-3 text-center border-r border-slate-200/80 dark:border-slate-800/80">Status</th>
                                    <th className="py-2 px-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="font-mono text-[11px]">
                                {recentSessions.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="text-center py-6 text-slate-400 font-sans">
                                            No shift sessions recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedSessions.map((s, sIdx) => {
                                        const isEven = sIdx % 2 === 1;
                                        const rowBg = isEven ? 'bg-[#f8fafc] dark:bg-[#161a22]' : 'bg-white dark:bg-[#12161c]';
                                        return (
                                        <tr key={s.id} className={`${rowBg} hover:bg-slate-100/70 dark:hover:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors`}>
                                            <td className="py-2 px-3 font-sans font-bold text-slate-900 dark:text-white border-r border-slate-200/80 dark:border-slate-800/80">
                                                <div>
                                                    <span className="px-1 py-0.5 rounded-[3px] bg-slate-100 dark:bg-slate-800 font-mono text-[10.5px] mr-1.5 text-slate-700 dark:text-slate-300">
                                                        {s.counter_code}
                                                    </span>
                                                    {s.counter_name}
                                                </div>
                                                {s.z_report_number && (
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[10px] font-mono text-[#FF4A1F]">
                                                            {s.z_report_number}
                                                        </span>
                                                        {s.is_force_closed && (
                                                            <span
                                                                className="px-1 py-0.2 rounded-[2px] text-[9px] font-sans font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                                                title={s.force_close_reason || 'Force closed by supervisor'}
                                                            >
                                                                Force Closed
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 font-sans text-slate-700 dark:text-slate-300 border-r border-slate-200/80 dark:border-slate-800/80">
                                                {s.user_name || 'Staff'}
                                            </td>
                                            <td className="py-2 px-3 font-sans capitalize text-slate-600 dark:text-slate-400 text-[10.5px] border-r border-slate-200/80 dark:border-slate-800/80">
                                                {s.shift || 'Morning'}
                                            </td>
                                            <td className="py-2 px-3 font-sans text-slate-500 text-[10.5px] border-r border-slate-200/80 dark:border-slate-800/80">
                                                <div>{s.opened_at}</div>
                                                {s.closed_at && <div className="text-[10px] text-slate-400">Closed: {s.closed_at}</div>}
                                            </td>
                                            <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300 border-r border-slate-200/80 dark:border-slate-800/80">
                                                {formatCurrency(s.opening_float, currency)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 border-r border-slate-200/80 dark:border-slate-800/80">
                                                {formatCurrency(s.total_sales_amount, currency)} ({s.total_transactions})
                                            </td>
                                            <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white border-r border-slate-200/80 dark:border-slate-800/80">
                                                {s.closing_cash_counted !== null && s.closing_cash_counted !== undefined
                                                    ? formatCurrency(s.closing_cash_counted, currency)
                                                    : 'In Progress'}
                                            </td>
                                            <td className="py-2 px-3 text-right border-r border-slate-200/80 dark:border-slate-800/80">
                                                {s.discrepancy !== null && s.discrepancy !== undefined ? (
                                                    <span
                                                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[3px] font-bold text-[10.5px] ${
                                                            s.discrepancy === 0
                                                                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                                                                : (s.discrepancy ?? 0) > 0
                                                                ? 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
                                                                : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                                                        }`}
                                                    >
                                                        {s.discrepancy === 0 ? (
                                                            <>
                                                                <Check className="h-3 w-3" />
                                                                <span>0.00</span>
                                                            </>
                                                        ) : (s.discrepancy ?? 0) > 0 ? (
                                                            `+${formatCurrency(s.discrepancy, currency)}`
                                                        ) : (
                                                            formatCurrency(s.discrepancy, currency)
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-center border-r border-slate-200/80 dark:border-slate-800/80">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded-[3px] text-[9.5px] font-bold uppercase font-sans ${
                                                        s.status === 'open'
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}
                                                >
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right font-sans">
                                                <div className="inline-flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setZReportSessionId(s.id)}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-[3px] text-[10.5px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-[#FF4A1F] hover:text-white transition-colors cursor-pointer"
                                                        title={s.status === 'closed' ? 'View & Print Z-Report' : 'View Live X-Report'}
                                                    >
                                                        <Printer className="h-3 w-3" />
                                                        <span>{s.status === 'closed' ? 'Z-Report' : 'X-Report'}</span>
                                                    </button>
                                                    {canManageCounters && s.status === 'closed' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteSession(s)}
                                                            className="p-1 rounded-[3px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                                            title="Delete shift record"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <TablePagination
                        total={sessionTotal}
                        fromIdx={sessionTotal > 0 ? sessionStartIdx + 1 : 0}
                        toIdx={Math.min(sessionStartIdx + sessionPerPage, sessionTotal)}
                        perPage={sessionPerPage}
                        currentPage={validSessionPage}
                        totalPages={sessionTotalPages}
                        onPerPageChange={(val) => {
                            setSessionPerPage(val);
                            setSessionPage(1);
                        }}
                        onPrevPage={() => setSessionPage((p) => Math.max(1, p - 1))}
                        onNextPage={() => setSessionPage((p) => Math.min(sessionTotalPages, p + 1))}
                        hasPrev={validSessionPage > 1}
                        hasNext={validSessionPage < sessionTotalPages}
                        variant="table"
                    />
                </div>
            </div>

            {/* Create / Edit Counter Modal */}
            {(createModalOpen || editingCounter) && (
                <CounterFormModal
                    open={createModalOpen || !!editingCounter}
                    counter={editingCounter}
                    onClose={() => {
                        setCreateModalOpen(false);
                        setEditingCounter(null);
                    }}
                />
            )}

            {/* Assign Cashier & Shift Modal */}
            {assignCashierCounter && (
                <AssignCashierModal
                    open={!!assignCashierCounter}
                    counter={assignCashierCounter}
                    eligibleCashiers={eligibleCashiers}
                    onClose={() => setAssignCashierCounter(null)}
                />
            )}

            {/* Shift Operations Modals */}
            {openShiftCounter && (
                <OpenShiftModal
                    open={!!openShiftCounter}
                    counters={counters}
                    initialCounter={openShiftCounter}
                    currency={currency}
                    onClose={() => setOpenShiftCounter(null)}
                />
            )}

            {breakCounter && (
                <TakeBreakModal
                    open={!!breakCounter}
                    counter={breakCounter}
                    onClose={() => setBreakCounter(null)}
                />
            )}

            {closeShiftCounter && (
                <CloseShiftModal
                    open={!!closeShiftCounter}
                    counter={closeShiftCounter}
                    currency={currency}
                    onClose={() => setCloseShiftCounter(null)}
                />
            )}

            {forceCloseCounter && (
                <ForceCloseShiftModal
                    open={!!forceCloseCounter}
                    counter={forceCloseCounter}
                    currency={currency}
                    onClose={() => setForceCloseCounter(null)}
                />
            )}

            {cashMovementCounter && (
                <CashMovementModal
                    open={!!cashMovementCounter}
                    counter={cashMovementCounter}
                    currency={currency}
                    onClose={() => setCashMovementCounter(null)}
                />
            )}

            <ZReportModal
                sessionId={zReportSessionId}
                onClose={() => setZReportSessionId(null)}
            />

            {/* Resume Service PIN Modal */}
            {resumeCounter && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="w-full max-w-sm rounded-[3px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-3">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                Unlock Counter · {resumeCounter.code}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setResumeCounter(null)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleResumeService} className="space-y-3">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                Counter is on break ({resumeCounter.current_break_reason}). Enter Cashier 4-digit PIN to unlock.
                            </p>

                            <Input
                                type="password"
                                placeholder="Enter Cashier PIN"
                                autoFocus
                                value={resumePin}
                                onChange={(e) => setResumePin(e.target.value)}
                                className="h-[38px] text-center text-sm font-bold tracking-widest focus:border-[#FF4A1F]"
                            />

                            {resumeError && (
                                <p className="text-xs text-rose-500 font-medium">{resumeError}</p>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                <Button type="button" variant="outline" size="sm" onClick={() => setResumeCounter(null)} className="rounded-[3px]">
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    disabled={resumeSubmitting || !resumePin}
                                    className="bg-[#FF4A1F] hover:bg-[#e03d15] text-white rounded-[3px]"
                                >
                                    {resumeSubmitting ? 'Unlocking...' : 'Unlock Terminal'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

function CounterFormModal({
    open,
    counter,
    onClose,
}: {
    open: boolean;
    counter: ExtendedCounterData | null;
    onClose: () => void;
}) {
    const isEdit = !!counter;
    const [code, setCode] = useState(counter?.code || '');
    const [name, setName] = useState(counter?.name || 'Main Cashier Counter');
    const [type, setType] = useState(counter?.type || 'opd');
    const [location, setLocation] = useState(counter?.location || '');
    const [zone, setZone] = useState(counter?.zone || 'Ground Floor Area A');
    const [maxQueueCapacity, setMaxQueueCapacity] = useState<number>(counter?.max_queue_capacity ?? 20);
    const [autoAssignmentEnabled, setAutoAssignmentEnabled] = useState<boolean>(counter?.auto_assignment_enabled ?? true);
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const url = isEdit ? route('counters.update', counter.id) : route('counters.store');
        const method = isEdit ? 'put' : 'post';

        router[method](
            url,
            {
                code: code ? code.trim() : undefined,
                name: name.trim(),
                type,
                location: location.trim() || undefined,
                zone: zone.trim() || 'General',
                max_queue_capacity: Number(maxQueueCapacity),
                auto_assignment_enabled: Boolean(autoAssignmentEnabled),
            },
            {
                onSuccess: () => {
                    setSubmitting(false);
                    onClose();
                },
                onError: (errs) => {
                    setSubmitting(false);
                    alert(Object.values(errs)[0] || 'Failed to save counter.');
                },
            }
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-[3px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-3">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        {isEdit ? `Edit Counter · ${counter.code}` : 'Add New Pharmacy Counter'}
                    </h3>
                    <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <FormLayoutProvider labelWidth="sm:w-[155px]">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <Input
                            label="Counter Code"
                            type="text"
                            readOnly={isEdit}
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="Auto (e.g. C-01)"
                            className="h-[34px] text-xs font-bold focus:border-[#FF4A1F]"
                        />
                        <Input
                            label="Counter Name *"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. OPD Dispensing Counter"
                            required
                            className="h-[34px] text-xs focus:border-[#FF4A1F]"
                        />
                        <Select
                            label="Counter Type *"
                            size="sm"
                            value={type}
                            onChange={(e) => setType(String(e.target.value))}
                            options={[
                                { value: 'opd', label: 'OPD Dispensing' },
                                { value: 'ipd', label: 'IPD / Inpatient' },
                                { value: 'express', label: 'Express Counter' },
                                { value: 'general', label: 'General Retail' },
                                { value: 'billing', label: 'Billing Only' },
                                { value: 'emergency', label: 'Emergency 24/7' },
                            ]}
                            triggerClassName="h-[34px] bg-white dark:bg-[#12161c] text-xs"
                        />
                        <Input
                            label="Counter Location"
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g. Ground Floor Main Hall"
                            className="h-[34px] text-xs focus:border-[#FF4A1F]"
                        />
                        <Input
                            label="Zone / Area"
                            type="text"
                            value={zone}
                            onChange={(e) => setZone(e.target.value)}
                            placeholder="e.g. Zone A"
                            className="h-[34px] text-xs focus:border-[#FF4A1F]"
                        />
                        <Input
                            label="Max Queue Capacity *"
                            type="number"
                            min={1}
                            max={100}
                            value={maxQueueCapacity}
                            onChange={(e) => setMaxQueueCapacity(Number(e.target.value))}
                            required
                            className="h-[34px] text-xs font-mono focus:border-[#FF4A1F]"
                        />

                        {/* Auto Assignment Toggle */}
                        <HorizontalFormRow label="Auto Assignment">
                            <div className="p-2.5 rounded-[3px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#181d26]/60 flex items-center justify-between gap-2">
                                <div>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                                        Enable Dynamic Automatic Assignment
                                    </span>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Include this counter in automatic Round-Robin order distribution when cashier shift is active.
                                    </span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={autoAssignmentEnabled}
                                    onChange={(e) => setAutoAssignmentEnabled(e.target.checked)}
                                    className="h-4 w-4 rounded-[3px] text-[#FF4A1F] focus:ring-[#FF4A1F] border-slate-300 dark:border-slate-600 cursor-pointer"
                                />
                            </div>
                        </HorizontalFormRow>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                            {isEdit ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (counter.status !== 'closed') {
                                            alert(`Cannot delete Counter ${counter.code} while a shift is active. Please close the shift first.`);
                                            return;
                                        }
                                        if (confirm(`Are you sure you want to delete Counter ${counter.code} (${counter.name})?`)) {
                                            router.delete(route('counters.destroy', counter.id), {
                                                onSuccess: () => onClose(),
                                            });
                                        }
                                    }}
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900 rounded-[3px]"
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    Delete Counter
                                </Button>
                            ) : <div />}
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-[3px]">
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    disabled={submitting}
                                    className="bg-[#FF4A1F] hover:bg-[#e03d15] text-white rounded-[3px]"
                                >
                                    {submitting ? 'Saving...' : (isEdit ? 'Update Counter' : 'Create Counter')}
                                </Button>
                            </div>
                        </div>
                    </form>
                </FormLayoutProvider>
            </div>
        </div>
    );
}

function AssignCashierModal({
    open,
    counter,
    eligibleCashiers,
    onClose,
}: {
    open: boolean;
    counter: ExtendedCounterData;
    eligibleCashiers: EligibleCashier[];
    onClose: () => void;
}) {
    const [selectedUserId, setSelectedUserId] = useState<number | ''>(
        eligibleCashiers[0]?.id ?? ''
    );
    const [shift, setShift] = useState<'morning' | 'evening' | 'night' | 'any'>('morning');
    const [isPrimary, setIsPrimary] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const assignedCashiers = counter.assigned_cashiers || [];

    const handleAssign = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) return;

        setSubmitting(true);
        router.post(
            route('counters.assign-cashier', counter.id),
            {
                user_id: Number(selectedUserId),
                shift,
                is_primary: isPrimary,
            },
            {
                onSuccess: () => {
                    setSubmitting(false);
                },
                onError: (errs) => {
                    setSubmitting(false);
                    alert(Object.values(errs)[0] || 'Failed to assign cashier.');
                },
            }
        );
    };

    const handleUnassign = (userId: number, userName?: string) => {
        if (confirm(`Remove cashier ${userName || 'this user'} from Counter ${counter.code}?`)) {
            router.delete(route('counters.unassign-cashier', { counter: counter.id, cashier: userId }));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-[3px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-3">
                    <div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                            Assign Cashiers & Shifts · {counter.code}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            {counter.name} {counter.location && `(${counter.location})`}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Form to add cashier */}
                <FormLayoutProvider labelWidth="sm:w-[135px]">
                    <form onSubmit={handleAssign} className="space-y-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <Input
                            label="Target Counter"
                            readOnly
                            value={`${counter.code} — ${counter.name}`}
                            className="h-[34px] text-xs font-semibold"
                        />
                        <Select
                            label="Select Cashier *"
                            size="sm"
                            value={selectedUserId || ''}
                            placeholder="Choose employee..."
                            onChange={(e) => setSelectedUserId(Number(e.target.value))}
                            options={eligibleCashiers.map((c) => ({
                                value: c.id,
                                label: `${c.name}${c.email ? ` (${c.email})` : ''}`,
                            }))}
                            triggerClassName="h-[34px] bg-white dark:bg-[#12161c] text-xs"
                        />
                        <Select
                            label="Shift Schedule *"
                            size="sm"
                            value={shift}
                            onChange={(e) => setShift(String(e.target.value) as any)}
                            options={[
                                { value: 'morning', label: 'Morning Shift (08:00 AM - 04:00 PM)' },
                                { value: 'evening', label: 'Evening Shift (04:00 PM - 12:00 AM)' },
                                { value: 'night', label: 'Night Shift (12:00 AM - 08:00 AM)' },
                                { value: 'any', label: 'Flexible / All Shifts' },
                            ]}
                            triggerClassName="h-[34px] bg-white dark:bg-[#12161c] text-xs"
                        />

                        <div className="flex items-center justify-between sm:pl-[145px]">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={isPrimary}
                                    onChange={(e) => setIsPrimary(e.target.checked)}
                                    className="h-4 w-4 rounded-[3px] text-[#FF4A1F] focus:ring-[#FF4A1F] border-slate-300 dark:border-slate-600"
                                />
                                <span>Set as primary cashier for this counter</span>
                            </label>

                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                disabled={submitting || !selectedUserId}
                            className="bg-[#FF4A1F] hover:bg-[#e03d15] text-white rounded-[3px]"
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            {submitting ? 'Assigning...' : 'Assign to Counter'}
                        </Button>
                    </div>
                </form>
                </FormLayoutProvider>

                {/* Assigned Cashiers List */}
                <div className="mt-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
                        <span>Currently Assigned Cashiers</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                            {assignedCashiers.length} assigned
                        </span>
                    </h4>

                    {assignedCashiers.length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-[3px]">
                            No cashiers assigned yet. Any available cashier with credentials can open shift on this counter.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-[3px] overflow-hidden">
                            {assignedCashiers.map((ac) => (
                                <div key={ac.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-[3px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                                            <UserCheck className="h-4 w-4 text-[#FF4A1F]" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                    {ac.user_name || 'Staff User'}
                                                </span>
                                                {ac.is_primary && (
                                                    <span className="text-[9px] px-1.5 py-0.2 rounded-[3px] bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold uppercase">
                                                        Primary
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-500 capitalize">
                                                Shift: {ac.shift}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleUnassign(ac.user_id, ac.user_name)}
                                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                        title="Remove assignment"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
                    <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-[3px]">
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
}
