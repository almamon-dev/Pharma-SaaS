import React, { useMemo, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Coffee,
    Lock,
    LogOut,
    Play,
    Shield,
    ShieldAlert,
    Utensils,
    X,
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { formatCurrency } from '@/lib/format';
import { SharedPageProps } from '@/types';

export interface PosCounterData {
    id: number;
    code: string;
    name: string;
    type: string;
    zone?: string | null;
    location?: string | null;
    status: 'active' | 'on_break' | 'closed';
    current_break_reason?: string | null;
    break_started_at?: string | null;
    current_user_id?: number | null;
    current_user_name?: string | null;
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

const PRIMARY_BDT_NOTES = [1000, 500, 100];
const ALL_BDT_NOTES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
const BDT_NOTES = ALL_BDT_NOTES;

interface QuickStartShiftModalProps {
    open: boolean;
    currency: string;
    onClose: () => void;
}

export function QuickStartShiftModal({ open, currency, onClose }: QuickStartShiftModalProps) {
    const [openingFloat, setOpeningFloat] = useState<string>('2000');
    const [notes, setNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        router.post(
            route('cashier.shift.auto-open', undefined, false),
            {
                opening_float: parseFloat(openingFloat) || 0,
                notes: notes.trim() || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    onClose();
                },
                onError: (errs) => {
                    setSubmitting(false);
                    alert(Object.values(errs)[0] || 'Failed to start shift.');
                },
            }
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12161c]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-[4px] bg-[#FF4A1F]/10 flex items-center justify-center text-[#FF4A1F]">
                            <Play className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Start Cash Register Shift
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                অটো-সিট কাউন্টার · ক্যাশ ড্রয়ারের ওপেনিং ফ্লোট নিশ্চিত করুন
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-[3px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Opening Cash Float (ড্রয়ারে থাকা শুরুর খুচরা টাকা) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                                {currency}
                            </span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={openingFloat}
                                onChange={(e) => setOpeningFloat(e.target.value)}
                                className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] pl-12 pr-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                placeholder="0.00"
                                required
                                autoFocus
                            />
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {['0', '500', '1000', '2000', '5000'].map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setOpeningFloat(amt)}
                                    className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-[4px] border cursor-pointer transition-colors ${
                                        openingFloat === amt
                                            ? 'border-[#FF4A1F] bg-[#FF4A1F]/10 text-[#FF4A1F]'
                                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#FF4A1F]'
                                    }`}
                                >
                                    ৳{Number(amt).toLocaleString()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Shift Note (ঐচ্ছিক)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Received ৳2,000 change float from manager"
                            className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
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
                            {submitting ? 'Starting Shift...' : 'Start Shift Now'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface OpenShiftModalProps {
    open: boolean;
    counters: PosCounterData[];
    initialCounter?: PosCounterData | null;
    currency: string;
    onClose: () => void;
}

export function OpenShiftModal({
    open,
    counters,
    initialCounter = null,
    currency,
    onClose,
}: OpenShiftModalProps) {
    const { auth } = usePage<SharedPageProps>().props;
    const availableCounters = counters.filter((c) => c.status === 'closed' || !c.current_user_id);
    const [selectedCounterId, setSelectedCounterId] = useState<number | ''>(
        initialCounter?.id ?? availableCounters[0]?.id ?? counters[0]?.id ?? ''
    );
    const [noteCounts, setNoteCounts] = useState<Record<number, string>>({
        1000: '',
        500: '',
        100: '',
    });
    const [showAllNotes, setShowAllNotes] = useState(false);
    const [manualMode, setManualMode] = useState(false);
    const [manualFloat, setManualFloat] = useState<string>('0');
    const [notes, setNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    const visibleNotes = showAllNotes ? ALL_BDT_NOTES : PRIMARY_BDT_NOTES;

    const noteTotal = useMemo(() => {
        let sum = 0;
        for (const n of ALL_BDT_NOTES) {
            sum += n * (parseInt(noteCounts[n] || '0', 10) || 0);
        }
        return sum;
    }, [noteCounts]);

    const effectiveOpeningFloat = manualMode ? Math.max(0, parseFloat(manualFloat) || 0) : noteTotal;

    if (!open) return null;

    const selectedCounter =
        initialCounter ??
        counters.find((c) => c.id === selectedCounterId) ??
        null;

    const startedLabel = new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    const handleCountChange = (note: number, raw: string) => {
        const cleaned = raw.replace(/[^0-9]/g, '');
        setNoteCounts((prev) => ({ ...prev, [note]: cleaned }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCounterId) {
            alert('Please select a counter to open.');
            return;
        }

        const openingDenominations = !manualMode
            ? Object.fromEntries(
                  ALL_BDT_NOTES.map((n) => [String(n), parseInt(noteCounts[n] || '0', 10) || 0])
              )
            : null;

        setSubmitting(true);
        router.post(
            route('counters.open-session', selectedCounterId, false),
            {
                opening_float: effectiveOpeningFloat,
                opening_denominations: openingDenominations,
                notes: notes.trim() || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    onClose();
                },
                onError: (errs) => {
                    setSubmitting(false);
                    alert(Object.values(errs)[0] || 'Failed to start shift.');
                },
            }
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-[6px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Open Shift</h3>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800 text-[11px] font-semibold">
                            Counter Available
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded-[3px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
                    {/* 3 Info Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="rounded-[5px] bg-[#FF4A1F]/[0.06] dark:bg-[#FF4A1F]/10 border border-[#FF4A1F]/15 px-3 py-2">
                            <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Counter</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">
                                {selectedCounter ? `${selectedCounter.code} · ${selectedCounter.name}` : 'Select Counter'}
                            </div>
                        </div>
                        <div className="rounded-[5px] bg-[#FF4A1F]/[0.06] dark:bg-[#FF4A1F]/10 border border-[#FF4A1F]/15 px-3 py-2">
                            <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Cashier</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                                {auth?.user?.name || 'Cashier'}
                            </div>
                        </div>
                        <div className="rounded-[5px] bg-[#FF4A1F]/[0.06] dark:bg-[#FF4A1F]/10 border border-[#FF4A1F]/15 px-3 py-2">
                            <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">Started</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">
                                {startedLabel}
                            </div>
                        </div>
                    </div>

                    {/* Counter selector only when opened without a pre-selected counter card */}
                    {!initialCounter && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Select Counter <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={selectedCounterId}
                                onChange={(e) => setSelectedCounterId(Number(e.target.value))}
                                className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                required
                            >
                                <option value="">-- Choose Counter --</option>
                                {counters.map((c) => (
                                    <option key={c.id} value={c.id} disabled={c.status === 'active' && !!c.current_user_id}>
                                        {c.code} - {c.name} ({(c.type || 'POS').toUpperCase()}) {c.status !== 'closed' ? `[Occupied by ${c.current_user_name || 'Staff'}]` : '[Available]'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Opening Float (Cash Count Table) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Opening Float (cash count)
                            </label>
                            <div className="flex items-center gap-3 text-[11px] font-semibold">
                                {!manualMode && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllNotes((v) => !v)}
                                        className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                                    >
                                        {showAllNotes ? 'Compact (৳1000/500/100)' : 'All Notes (৳1000–৳1)'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setManualMode((v) => {
                                            const next = !v;
                                            if (next) setManualFloat(String(noteTotal));
                                            return next;
                                        });
                                    }}
                                    className="text-[#FF4A1F] hover:underline cursor-pointer"
                                >
                                    {manualMode ? 'Count by Notes' : 'Enter Total Directly'}
                                </button>
                            </div>
                        </div>

                        {manualMode ? (
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">৳</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={manualFloat}
                                    onChange={(e) => setManualFloat(e.target.value)}
                                    className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] pl-7 pr-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        ) : (
                            <div className="rounded-[5px] border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <table className="w-full text-xs border-collapse">
                                    <thead className="bg-slate-50 dark:bg-[#181d26] text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="py-2 px-3 text-left font-semibold">Note</th>
                                            <th className="py-2 px-3 text-center font-semibold">Count</th>
                                            <th className="py-2 px-3 text-right font-semibold">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                        {visibleNotes.map((note) => {
                                            const qty = parseInt(noteCounts[note] || '0', 10) || 0;
                                            const rowAmount = note * qty;
                                            return (
                                                <tr key={note} className="bg-white dark:bg-[#12161c]">
                                                    <td className="py-2 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                        ৳ {note}
                                                    </td>
                                                    <td className="py-1.5 px-3 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            inputMode="numeric"
                                                            value={noteCounts[note] ?? ''}
                                                            onChange={(e) => handleCountChange(note, e.target.value)}
                                                            placeholder="0"
                                                            className="w-20 text-center rounded-[4px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#181d26] px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                                                        {rowAmount.toLocaleString('en-US', {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Highlighted Total Opening Float */}
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-[5px] bg-[#FF4A1F]/[0.08] dark:bg-[#FF4A1F]/15 border border-[#FF4A1F]/20">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Total Opening Float</span>
                        <span className="text-base font-mono font-black text-[#FF4A1F]">
                            {formatCurrency(effectiveOpeningFloat, currency)}
                        </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        After opening, this counter is locked to you. Payments can be taken only while the shift is open.
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <Button type="button" variant="outline" size="sm" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={submitting || !selectedCounterId}
                            className="bg-[#FF4A1F] hover:bg-[#e03d15] text-white font-semibold px-4"
                        >
                            {submitting ? 'Opening Shift...' : 'Open Shift'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface TakeBreakModalProps {
    open: boolean;
    counter: PosCounterData;
    onClose: () => void;
}

export function TakeBreakModal({ open, counter, onClose }: TakeBreakModalProps) {
    const [breakType, setBreakType] = useState<'prayer' | 'tea' | 'lunch' | 'audit' | 'custom'>('tea');
    const [notes, setNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const breakPresets = [
        { id: 'tea', label: 'Tea Break (চা বিরতি)', icon: Coffee, desc: '10-15 mins quick rest' },
        { id: 'prayer', label: 'Prayer / Namaz (নামাজ বিরতি)', icon: Clock, desc: '15-20 mins prayer pause' },
        { id: 'lunch', label: 'Lunch / Dinner (খাবারের বিরতি)', icon: Utensils, desc: '30-45 mins meal pause' },
        { id: 'audit', label: 'Cash Tally / Audit (ক্যাশ অডিট)', icon: Shield, desc: 'Shift drawer tally' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        router.post(
            route('counters.take-break', counter.id),
            {
                break_type: breakType,
                notes: notes.trim(),
            },
            {
                onSuccess: () => {
                    setSubmitting(false);
                    onClose();
                },
                onError: (errs) => {
                    setSubmitting(false);
                    alert(Object.values(errs)[0] || 'Failed to start break.');
                },
            }
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-amber-500/10">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-[4px] bg-amber-500/20 text-amber-600 flex items-center justify-center">
                            <Coffee className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Counter Break Mode · {counter.code}
                            </h3>
                            <p className="text-[11px] text-slate-500">টার্মিনাল সাময়িক বিরতিতে থাকবে ও লক হবে</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-[3px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Select Break Reason (বিরতির কারণ নির্বাচন করুন)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {breakPresets.map((preset) => {
                                const Icon = preset.icon;
                                const isSelected = breakType === preset.id;
                                return (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => setBreakType(preset.id as any)}
                                        className={`flex flex-col items-start p-2.5 rounded-[4px] border text-left transition-colors cursor-pointer ${
                                            isSelected
                                                ? 'border-[#FF4A1F] bg-[#FF4A1F]/5 text-slate-900 dark:text-white'
                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12161c] text-slate-600 dark:text-slate-300 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Icon className={`h-4 w-4 ${isSelected ? 'text-[#FF4A1F]' : 'text-slate-400'}`} />
                                            <span className="text-xs font-bold">{preset.label.split('(')[0]}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{preset.desc}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Additional Note (ঐচ্ছিক নোট)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Back in 15 minutes"
                            className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                        />
                    </div>

                    <div className="rounded-[4px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                        <Lock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                            <strong>Terminal Lock Protection:</strong> While on break, queue tickets will route away and the screen will lock until you enter your 4-digit Cashier PIN.
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <Button type="button" variant="outline" size="sm" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={submitting}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {submitting ? 'Starting Break...' : 'Start Break & Lock Screen'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface CloseShiftModalProps {
    open: boolean;
    counter: PosCounterData;
    currency: string;
    onClose: () => void;
}

export function CloseShiftModal({ open, counter, currency, onClose }: CloseShiftModalProps) {
    const session = counter.current_session;
    const expectedCash = session ? session.system_expected_cash : 0;
    const [closingCash, setClosingCash] = useState<string>(expectedCash.toFixed(2));
    const [useDenominations, setUseDenominations] = useState(false);
    const [denominations, setDenominations] = useState<Record<number, string>>({});
    const [notes, setNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const handleDenominationChange = (note: number, value: string) => {
        const cleaned = value.replace(/[^0-9]/g, '');
        const next = { ...denominations, [note]: cleaned };
        setDenominations(next);

        let sum = 0;
        for (const n of BDT_NOTES) {
            sum += n * (parseInt(next[n] || '0', 10) || 0);
        }
        setClosingCash(sum.toFixed(2));
    };

    const countedNum = parseFloat(closingCash) || 0;
    const discrepancy = Math.round((countedNum - expectedCash) * 100) / 100;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (closingCash === '') {
            alert('Please enter counted closing cash.');
            return;
        }

        if (discrepancy !== 0 && !notes.trim()) {
            alert('Please enter a closing note explaining the cash discrepancy (shortage or surplus).');
            return;
        }

        const payloadDenominations: Record<string, number> | null = useDenominations
            ? Object.fromEntries(
                  BDT_NOTES.map((n) => [String(n), parseInt(denominations[n] || '0', 10) || 0])
              )
            : null;

        setSubmitting(true);
        router.post(
            route('counters.close-session', counter.id, false),
            {
                closing_cash_counted: countedNum,
                closing_denominations: payloadDenominations,
                notes: notes.trim(),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    onClose();
                },
                onError: (errs) => {
                    setSubmitting(false);
                    alert(Object.values(errs)[0] || 'Failed to close shift.');
                },
            }
        );
    };

    const nowTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md max-h-[92vh] flex flex-col rounded-[6px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <div className="flex items-start justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            Close Shift · {counter.code}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {session?.user_name || counter.current_user_name || 'Cashier'} · {session?.opened_at_time || 'Opened'} to {nowTime}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-[3px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto">
                    {/* Clean Drawer Formula matching Mockup */}
                    <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Opening Float</span>
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                {(session?.opening_float || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Cash Sales</span>
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                {(session?.cash_sales ?? session?.total_sales_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        {(session?.cash_in ?? 0) > 0 && (
                            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                                <span>Cash In (Float Top-up)</span>
                                <span className="font-mono font-semibold">
                                    +{(session?.cash_in || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        {(session?.cash_out_total ?? 0) > 0 && (
                            <div className="flex justify-between text-amber-700 dark:text-amber-400">
                                <span>Cash Out / Safe Drops</span>
                                <span className="font-mono font-semibold">
                                    − {(session?.cash_out_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Cash Refunds</span>
                            <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                − {(session?.cash_refunds || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center px-3 py-2 mt-1 rounded-[5px] bg-[#FF4A1F]/[0.08] dark:bg-[#FF4A1F]/15 border border-[#FF4A1F]/20 font-bold">
                            <span className="text-slate-900 dark:text-white">Expected Cash</span>
                            <span className="font-mono text-sm text-slate-900 dark:text-white">
                                {expectedCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Counted Cash (drawer) + BDT Note Counter */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Counted Cash (drawer)
                            </label>
                            <button
                                type="button"
                                onClick={() => setUseDenominations((prev) => !prev)}
                                className="text-[11px] font-semibold text-[#FF4A1F] hover:underline cursor-pointer"
                            >
                                {useDenominations ? 'Hide Note Counter' : 'Count by Notes'}
                            </button>
                        </div>

                        {useDenominations && (
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-2.5 rounded-[4px] bg-slate-50 dark:bg-[#12161c] border border-slate-200 dark:border-slate-800">
                                {BDT_NOTES.map((note) => (
                                    <div key={note} className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold text-slate-500 font-mono">৳{note} ×</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={denominations[note] ?? ''}
                                            onChange={(e) => handleDenominationChange(note, e.target.value)}
                                            placeholder="0"
                                            className="w-full rounded-[3px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#151921] px-2 py-1 text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="relative">
                            <span className="absolute left-3 top-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                                ৳
                            </span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={closingCash}
                                onChange={(e) => setClosingCash(e.target.value)}
                                className="w-full rounded-[5px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] pl-7 pr-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    {/* Live Discrepancy Bar */}
                    <div className={`px-3 py-2 rounded-[5px] border text-xs flex items-center justify-between font-bold ${
                        discrepancy === 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                            : (discrepancy > 0
                                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300')
                    }`}>
                        <div className="flex items-center gap-1.5">
                            {discrepancy === 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                            <span>
                                {discrepancy === 0
                                    ? 'Discrepancy (matched)'
                                    : discrepancy > 0
                                    ? 'Discrepancy (surplus)'
                                    : 'Discrepancy (short)'}
                            </span>
                        </div>
                        <span className="font-mono">
                            {discrepancy > 0
                                ? `+ ${discrepancy.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : discrepancy < 0
                                ? `− ${Math.abs(discrepancy).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '0.00'}
                        </span>
                    </div>

                    {/* Reason (required if not zero) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                            Reason (required if not zero) {discrepancy !== 0 && <span className="text-rose-500">*</span>}
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            required={discrepancy !== 0}
                            placeholder="[Write note]"
                            className="w-full rounded-[5px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                        />
                    </div>

                    {/* Non-cash info line */}
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Non-cash (info only): bKash / Mobile {(session?.mobile_sales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Card {(session?.card_sales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <Button type="button" variant="outline" size="sm" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={submitting}
                            className="bg-[#FF4A1F] hover:bg-[#e03d15] text-white font-semibold px-4"
                        >
                            {submitting ? 'Closing Shift...' : 'Close Shift & Print Z-Report'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface ForceCloseShiftModalProps {
    open: boolean;
    counter: PosCounterData;
    currency: string;
    onClose: () => void;
}

export function ForceCloseShiftModal({ open, counter, currency, onClose }: ForceCloseShiftModalProps) {
    const session = counter.current_session;
    const expectedCash = session ? session.system_expected_cash : 0;
    const [closingCash, setClosingCash] = useState<string>(expectedCash.toFixed(2));
    const [reason, setReason] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (reason.trim().length < 3) {
            alert('Please provide a valid reason for force-closing this shift.');
            return;
        }

        setSubmitting(true);
        router.post(
            route('counters.force-close-session', counter.id, false),
            {
                force_close_reason: reason.trim(),
                closing_cash_counted: parseFloat(closingCash) || 0,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmitting(false);
                    onClose();
                },
                onError: (errs) => {
                    setSubmitting(false);
                    alert(Object.values(errs)[0] || 'Failed to force-close shift.');
                },
            }
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-[6px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-rose-500/10">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-[4px] bg-rose-500/20 text-rose-600 flex items-center justify-center">
                            <ShieldAlert className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                Force Close Shift · {counter.code}
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                Admin / Manager Override (Audit Logged)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-[3px] text-slate-400 hover:text-slate-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
                    <div className="p-3 rounded-[4px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                        Active shift by <strong>{session?.user_name || counter.current_user_name || 'Cashier'}</strong> will be forcefully terminated and a Z-Report will be generated.
                    </div>

                    <div className="flex justify-between text-xs px-3 py-2 rounded-[4px] bg-slate-50 dark:bg-[#12161c] border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500">System Expected Cash:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {formatCurrency(expectedCash, currency)}
                        </span>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Counted Cash in Drawer ({currency})
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={closingCash}
                            onChange={(e) => setClosingCash(e.target.value)}
                            className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Force Close Reason (বাধ্যতামূলক) <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={2}
                            required
                            placeholder="e.g. Cashier left without closing morning shift; manager verified cash drawer."
                            className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <Button type="button" variant="outline" size="sm" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={submitting || reason.trim().length < 3}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {submitting ? 'Force Closing...' : 'Force Close & Print Z-Report'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
