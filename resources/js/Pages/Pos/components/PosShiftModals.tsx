import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Coffee,
    Lock,
    LogOut,
    Play,
    Shield,
    Utensils,
    X,
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { formatCurrency } from '@/lib/format';

export interface PosCounterData {
    id: number;
    code: string;
    name: string;
    type: string;
    zone?: string | null;
    status: 'active' | 'on_break' | 'closed';
    current_break_reason?: string | null;
    break_started_at?: string | null;
    current_user_id?: number | null;
    current_user_name?: string | null;
    current_session?: {
        id: number;
        user_id: number;
        user_name?: string | null;
        opened_at?: string | null;
        opening_float: number;
        total_sales_amount: number;
        total_transactions: number;
        system_expected_cash: number;
    } | null;
}

interface OpenShiftModalProps {
    open: boolean;
    counters: PosCounterData[];
    currency: string;
    onClose: () => void;
}

export function OpenShiftModal({ open, counters, currency, onClose }: OpenShiftModalProps) {
    const availableCounters = counters.filter((c) => c.status === 'closed' || !c.current_user_id);
    const [selectedCounterId, setSelectedCounterId] = useState<number | ''>(
        availableCounters[0]?.id ?? counters[0]?.id ?? ''
    );
    const [openingFloat, setOpeningFloat] = useState<string>('2000');
    const [notes, setNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCounterId) {
            alert('Please select a counter to open.');
            return;
        }

        setSubmitting(true);
        router.post(
            route('counters.open-session', selectedCounterId),
            {
                opening_float: parseFloat(openingFloat) || 0,
                notes: notes.trim(),
            },
            {
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
                                Open Shift · Start Counter Float
                            </h3>
                            <p className="text-[11px] text-slate-500">শিফট শুরু এবং ক্যাশ ড্রয়ার ওপেনিং ফ্লোট নির্ধারণ</p>
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
                            Select Counter (কাউন্টার নির্বাচন করুন) <span className="text-rose-500">*</span>
                        </label>
                        {counters.length === 0 ? (
                            <p className="text-xs text-rose-500">No counters found. Please create a counter first.</p>
                        ) : (
                            <select
                                value={selectedCounterId}
                                onChange={(e) => setSelectedCounterId(Number(e.target.value))}
                                className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                required
                            >
                                <option value="">-- Choose Counter --</option>
                                {counters.map((c) => (
                                    <option key={c.id} value={c.id} disabled={c.status === 'active' && !!c.current_user_id}>
                                        {c.code} - {c.name} ({c.type.toUpperCase()}) {c.status !== 'closed' ? `[Occupied by ${c.current_user_name || 'Staff'}]` : '[Available]'}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Opening Cash Float (ড্রয়ারের শুরুর ব্যালেন্স / খুচরা টাকা) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                                {currency}
                            </span>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={openingFloat}
                                onChange={(e) => setOpeningFloat(e.target.value)}
                                className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] pl-12 pr-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div className="flex gap-1.5 mt-2">
                            {['500', '1000', '2000', '5000'].map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setOpeningFloat(amt)}
                                    className="px-2 py-0.5 text-[11px] rounded-[4px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#FF4A1F]"
                                >
                                    +{amt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Shift Notes (ঐচ্ছিক মন্তব্য)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="e.g. Morning Shift - Cash float received from manager"
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
                            disabled={submitting || !selectedCounterId}
                            className="bg-[#FF4A1F] hover:bg-[#e03d15] text-white"
                        >
                            {submitting ? 'Starting Shift...' : 'Start Shift (শিফট শুরু করুন)'}
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
    const [closingCash, setClosingCash] = useState<string>(String(expectedCash));
    const [notes, setNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const countedNum = parseFloat(closingCash) || 0;
    const discrepancy = Math.round((countedNum - expectedCash) * 100) / 100;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (closingCash === '') {
            alert('Please enter counted closing cash.');
            return;
        }

        if (discrepancy !== 0) {
            const confirmed = window.confirm(
                `Warning: There is a cash discrepancy of ${formatCurrency(discrepancy, currency)}. Proceed with Z-report closing?`
            );
            if (!confirmed) return;
        }

        setSubmitting(true);
        router.post(
            route('counters.close-session', counter.id),
            {
                closing_cash_counted: countedNum,
                notes: notes.trim(),
            },
            {
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-rose-500/10">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-[4px] bg-rose-500/20 text-rose-600 flex items-center justify-center">
                            <LogOut className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Close Shift · Z-Report Reconciliation
                            </h3>
                            <p className="text-[11px] text-slate-500">{counter.code} - {counter.name}</p>
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
                    {/* Shift Statistics Summary */}
                    <div className="p-3 rounded-[4px] bg-slate-50 dark:bg-[#12161c] border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Opening Cash Float:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {formatCurrency(session?.opening_float || 0, currency)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Total Shift Sales:</span>
                            <span className="font-semibold text-emerald-600">
                                {formatCurrency(session?.total_sales_amount || 0, currency)} ({session?.total_transactions || 0} bills)
                            </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1.5 font-bold">
                            <span className="text-slate-700 dark:text-slate-300">System Expected Cash in Drawer:</span>
                            <span className="text-slate-900 dark:text-white">
                                {formatCurrency(expectedCash, currency)}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Physical Cash Counted (ড্রয়ারে গুনে পাওয়া নগদ টাকা) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                                {currency}
                            </span>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={closingCash}
                                onChange={(e) => setClosingCash(e.target.value)}
                                className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] pl-12 pr-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    {/* Live Discrepancy Indicator */}
                    <div className={`p-2.5 rounded-[4px] border text-xs flex items-center justify-between ${
                        discrepancy === 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                            : (discrepancy > 0
                                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300')
                    }`}>
                        <div className="flex items-center gap-1.5">
                            {discrepancy === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                            <span className="font-semibold">
                                {discrepancy === 0 ? 'Cash matched 100% (কোন গরমিল নেই)' : (discrepancy > 0 ? 'Surplus / বাড়তি ক্যাশ' : 'Shortage / ঘাটতি')}
                            </span>
                        </div>
                        <span className="font-bold text-sm">
                            {discrepancy > 0 ? `+${formatCurrency(discrepancy, currency)}` : formatCurrency(discrepancy, currency)}
                        </span>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Shift Closing Notes (সমাপ্তি নোট)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="e.g. Cash handed over to supervisor / dropped into vault"
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
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {submitting ? 'Closing Shift...' : 'Close Shift & Generate Z-Report'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
