import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    Check,
    Coffee,
    Edit2,
    KeyRound,
    Layers,
    LogOut,
    Plus,
    Search,
    ShoppingCart,
    Store,
    Trash2,
    User,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { TableActionMenu, TableActionItem } from '@/Components/tables';
import { formatCurrency } from '@/lib/format';
import {
    CloseShiftModal,
    OpenShiftModal,
    PosCounterData,
    TakeBreakModal,
} from '../Pos/components/PosShiftModals';

interface RecentSession {
    id: number;
    counter_code?: string;
    counter_name?: string;
    user_name?: string;
    status: string;
    opened_at?: string;
    closed_at?: string;
    opening_float: number;
    closing_cash_counted?: number | null;
    system_expected_cash: number;
    discrepancy?: number | null;
    total_sales_amount: number;
    total_transactions: number;
    notes?: string | null;
}

interface CountersIndexProps {
    counters: PosCounterData[];
    recentSessions: RecentSession[];
    branchName?: string | null;
    currency: string;
    canManageCounters?: boolean;
    isCashier?: boolean;
}

export default function CountersIndex({
    counters = [],
    recentSessions = [],
    branchName,
    currency = 'BDT',
    canManageCounters = true,
    isCashier = false,
}: CountersIndexProps) {
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editingCounter, setEditingCounter] = useState<PosCounterData | null>(null);

    // Active session modal targets
    const [openShiftCounter, setOpenShiftCounter] = useState<PosCounterData | null>(null);
    const [breakCounter, setBreakCounter] = useState<PosCounterData | null>(null);
    const [closeShiftCounter, setCloseShiftCounter] = useState<PosCounterData | null>(null);
    const [resumeCounter, setResumeCounter] = useState<PosCounterData | null>(null);
    const [resumePin, setResumePin] = useState('');
    const [resumeError, setResumeError] = useState('');
    const [resumeSubmitting, setResumeSubmitting] = useState(false);

    const handleDeleteCounter = (counter: PosCounterData) => {
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

    const filteredCounters = counters.filter((c) => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                c.code.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                c.type.toLowerCase().includes(q) ||
                (c.current_user_name && c.current_user_name.toLowerCase().includes(q))
            );
        }
        return true;
    });

    const activeCount = counters.filter((c) => c.status === 'active').length;
    const breakCount = counters.filter((c) => c.status === 'on_break').length;
    const closedCount = counters.filter((c) => c.status === 'closed').length;

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
                    ? `${branchName ?? 'Branch'} · Personal shift station, float, and sales log`
                    : `${branchName ?? 'Branch'} · Counter terminals & cashier shifts`
            }
            actions={
                canManageCounters ? (
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setCreateModalOpen(true)}
                        className="gap-1.5 bg-[#FF4A1F] hover:bg-[#e03d15] text-white text-xs font-medium rounded-[4px]"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Counter</span>
                    </Button>
                ) : (
                    <Link href={route('pos.index')}>
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="gap-1.5 bg-[#FF4A1F] hover:bg-[#e03d15] text-white text-xs font-medium rounded-[4px]"
                        >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            <span>Open POS Terminal</span>
                        </Button>
                    </Link>
                )
            }
        >
            <Head title={isCashier ? 'My Shift & Register' : 'Counters & Shifts'} />

            <div className="space-y-3.5">
                {/* Segmented Control & Search (or Cashier Status Banner) */}
                {canManageCounters ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="inline-flex items-center gap-1 bg-slate-100/80 dark:bg-[#181d26] p-0.5 rounded-[4px] border border-slate-200/60 dark:border-slate-800/60 overflow-x-auto text-xs">
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
                                placeholder="Filter counter or cashier..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                icon={<Search className="h-3.5 w-3.5 text-slate-400" />}
                                className="h-8 text-xs rounded-[4px]"
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

                {/* Counter Stations Grid (Internal Summary Metric Card Design) */}
                {filteredCounters.length === 0 ? (
                    <div className="text-center py-10 rounded-[4px] border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-[#12161c] p-6">
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
                                      ]),
                                ...(canManageCounters
                                    ? [
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

                            return (
                                <div
                                    key={counter.id}
                                    className="rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] flex flex-col justify-between overflow-hidden transition-all shadow-none"
                                >
                                    {/* Card Header (Compact, no clutter) */}
                                    <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-[#151921]/50">
                                        <div className="flex items-start gap-2">
                                            <span className="px-1.5 py-0.5 rounded-[4px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-xs text-slate-800 dark:text-slate-200 shrink-0 mt-0.5">
                                                {counter.code}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
                                                    {counter.name}
                                                </h4>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                                                    <span className="uppercase font-semibold tracking-wider">{counter.type}</span>
                                                    {counter.zone && <span>· {counter.zone}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Content (Simple Key : Value List) */}
                                    <div className="p-3 text-xs flex-1 flex flex-col justify-between">
                                        {session ? (
                                            <div className="space-y-1.5 py-1 text-[11.5px]">
                                                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                                    <span>Opening Float:</span>
                                                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                                                        {formatCurrency(session.opening_float, currency)}
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
                                            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                                                Ready for next cashier shift
                                            </div>
                                        )}

                                        {/* Card Footer: Cashier on left, Status Pill & Three-Dot on right */}
                                        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11.5px] text-slate-600 dark:text-slate-400 gap-2">
                                            <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                                                <User className="h-3 w-3 text-slate-400 shrink-0" />
                                                <span className="text-[11px] text-slate-500">Cashier:</span>
                                                <span className="font-semibold text-slate-900 dark:text-white truncate">
                                                    {counter.current_user_name || (counter.status !== 'closed' ? 'Assigned' : 'Available')}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {/* Status Pill */}
                                                <span
                                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold border border-slate-200/80 dark:border-slate-700 ${
                                                        isActive
                                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                            : isOnBreak
                                                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 animate-pulse'
                                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
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
                                                    {isActive ? 'Serving' : isOnBreak ? (counter.current_break_reason ? counter.current_break_reason.toUpperCase() : 'BREAK') : 'Closed'}
                                                </span>

                                                {/* Three-Dot Action Menu */}
                                                <TableActionMenu items={actionItems} label={`${counter.code} actions`} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Shift History & Z-Report Audit Log */}
                <div className="rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] overflow-hidden mt-4">
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
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/80 dark:bg-[#181d26] text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="py-2 px-3">Counter</th>
                                    <th className="py-2 px-3">Cashier</th>
                                    <th className="py-2 px-3">Timing</th>
                                    <th className="py-2 px-3 text-right">Opening Float</th>
                                    <th className="py-2 px-3 text-right">Sales Amount</th>
                                    <th className="py-2 px-3 text-right">Counted Cash</th>
                                    <th className="py-2 px-3 text-right">Discrepancy</th>
                                    <th className="py-2 px-3 text-center">Status</th>
                                    {canManageCounters && <th className="py-2 px-3 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                                {recentSessions.length === 0 ? (
                                    <tr>
                                        <td colSpan={canManageCounters ? 9 : 8} className="text-center py-6 text-slate-400 font-sans">
                                            No shift sessions recorded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    recentSessions.map((s) => (
                                        <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="py-2 px-3 font-sans font-bold text-slate-900 dark:text-white">
                                                <span className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10.5px] mr-1.5 text-slate-700 dark:text-slate-300">
                                                    {s.counter_code}
                                                </span>
                                                {s.counter_name}
                                            </td>
                                            <td className="py-2 px-3 font-sans text-slate-700 dark:text-slate-300">
                                                {s.user_name || 'Staff'}
                                            </td>
                                            <td className="py-2 px-3 font-sans text-slate-500 text-[10.5px]">
                                                <div>{s.opened_at}</div>
                                                {s.closed_at && <div className="text-[10px] text-slate-400">Closed: {s.closed_at}</div>}
                                            </td>
                                            <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                                                {formatCurrency(s.opening_float, currency)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(s.total_sales_amount, currency)} ({s.total_transactions})
                                            </td>
                                            <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-white">
                                                {s.closing_cash_counted !== null && s.closing_cash_counted !== undefined
                                                    ? formatCurrency(s.closing_cash_counted, currency)
                                                    : 'In Progress'}
                                            </td>
                                            <td className="py-2 px-3 text-right">
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
                                            <td className="py-2 px-3 text-center">
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
                                            {canManageCounters && (
                                                <td className="py-2 px-3 text-right font-sans">
                                                    {s.status === 'closed' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteSession(s)}
                                                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                            title="Delete shift record"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
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

            {/* Shift Operations Modals */}
            {openShiftCounter && (
                <OpenShiftModal
                    open={!!openShiftCounter}
                    counters={counters}
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

            {/* Resume Service PIN Modal */}
            {resumeCounter && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="w-full max-w-sm rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
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

                            <input
                                type="password"
                                placeholder="Enter Cashier PIN"
                                autoFocus
                                value={resumePin}
                                onChange={(e) => setResumePin(e.target.value)}
                                className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-2 text-center text-sm font-bold tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                            />

                            {resumeError && (
                                <p className="text-xs text-rose-500 font-medium">{resumeError}</p>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                <Button type="button" variant="outline" size="sm" onClick={() => setResumeCounter(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    disabled={resumeSubmitting || !resumePin}
                                    className="bg-[#FF4A1F] hover:bg-[#e03d15] text-white"
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
    counter: PosCounterData | null;
    onClose: () => void;
}) {
    const isEdit = !!counter;
    const [code, setCode] = useState(counter?.code || 'C-01');
    const [name, setName] = useState(counter?.name || 'Main Cashier Counter');
    const [type, setType] = useState(counter?.type || 'opd');
    const [zone, setZone] = useState(counter?.zone || 'Ground Floor Area A');
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
                code: code.trim(),
                name: name.trim(),
                type,
                zone: zone.trim(),
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
            <div className="w-full max-w-md rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-3">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        {isEdit ? 'Edit Counter Information' : 'Add New Pharmacy Counter'}
                    </h3>
                    <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Code <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="C-01"
                                required
                                className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Counter Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. OPD Dispensing Counter"
                                required
                                className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Counter Type
                            </label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                            >
                                <option value="opd">OPD Dispensing</option>
                                <option value="ipd">IPD / Inpatient</option>
                                <option value="express">Express Counter</option>
                                <option value="general">General Retail</option>
                                <option value="billing">Billing Only</option>
                                <option value="emergency">Emergency 24/7</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Location Zone
                            </label>
                            <input
                                type="text"
                                value={zone}
                                onChange={(e) => setZone(e.target.value)}
                                placeholder="e.g. Ground Floor Wing A"
                                className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                            />
                        </div>
                    </div>

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
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900"
                            >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Delete Counter
                            </Button>
                        ) : <div />}
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                disabled={submitting}
                                className="bg-[#FF4A1F] hover:bg-[#e03d15] text-white"
                            >
                                {submitting ? 'Saving...' : (isEdit ? 'Update Counter' : 'Create Counter')}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
