import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowUpRight,
    RotateCcw,
    ShieldCheck,
    Wallet,
    X,
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { FormLayoutProvider } from '@/Components/ui/FormLayout';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { formatCurrency } from '@/lib/format';
import { PosCounterData } from '@/Pages/Pos/components/PosShiftModals';

export type CashMovementType = 'cash_in' | 'cash_out' | 'safe_drop' | 'cash_refund';

interface CashMovementModalProps {
    open: boolean;
    counter: PosCounterData;
    currency: string;
    initialType?: CashMovementType;
    onClose: () => void;
}

const MOVEMENT_OPTIONS: Array<{
    id: CashMovementType;
    label: string;
    subtitle: string;
    sign: 1 | -1;
    icon: typeof ArrowDownLeft;
    badgeClass: string;
    placeholder: string;
}> = [
    {
        id: 'cash_in',
        label: 'Cash In',
        subtitle: 'Float top-up / petty cash',
        sign: 1,
        icon: ArrowDownLeft,
        badgeClass: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
        placeholder: 'e.g. Change float added by branch manager',
    },
    {
        id: 'cash_out',
        label: 'Cash Out',
        subtitle: 'Petty expense / payout',
        sign: -1,
        icon: ArrowUpRight,
        badgeClass: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
        placeholder: 'e.g. Courier delivery charge / water bill',
    },
    {
        id: 'safe_drop',
        label: 'Safe Drop',
        subtitle: 'Move excess cash to vault',
        sign: -1,
        icon: ShieldCheck,
        badgeClass: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
        placeholder: 'e.g. Mid-shift safe drop handed to supervisor',
    },
    {
        id: 'cash_refund',
        label: 'Cash Refund',
        subtitle: 'Customer cash return',
        sign: -1,
        icon: RotateCcw,
        badgeClass: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800',
        placeholder: 'e.g. Medicine return refund for INV-00012',
    },
];

export default function CashMovementModal({
    open,
    counter,
    currency,
    initialType = 'cash_in',
    onClose,
}: CashMovementModalProps) {
    const [type, setType] = useState<CashMovementType>(initialType);
    const [amount, setAmount] = useState<string>('');
    const [reason, setReason] = useState<string>('');
    const [referenceNumber, setReferenceNumber] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const currentExpected = counter.current_session?.system_expected_cash ?? 0;
    const selectedOption = MOVEMENT_OPTIONS.find((o) => o.id === type) ?? MOVEMENT_OPTIONS[0];
    const parsedAmount = parseFloat(amount) || 0;
    const projectedExpected = Math.round((currentExpected + selectedOption.sign * parsedAmount) * 100) / 100;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (parsedAmount <= 0 || !reason.trim()) return;

        setSubmitting(true);
        router.post(
            route('counters.cash-movement', counter.id, false),
            {
                type,
                amount: parsedAmount,
                reason: reason.trim(),
                reference_number: referenceNumber.trim() || null,
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
                    alert(Object.values(errs)[0] || 'Failed to record cash movement.');
                },
            }
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12161c]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-[4px] bg-[#FF4A1F]/10 text-[#FF4A1F] flex items-center justify-center">
                            <Wallet className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                Cash Drawer Movement · {counter.code}
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                Cash In, Cash Out, Safe Drop বা Cash Refund রেকর্ড করুন
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

                <FormLayoutProvider labelWidth="sm:w-[155px]">
                    <form onSubmit={handleSubmit} className="p-4 space-y-3">
                        {/* Movement Type Selector */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {MOVEMENT_OPTIONS.map((opt) => {
                                const Icon = opt.icon;
                                const active = type === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setType(opt.id)}
                                        className={`flex flex-col items-start p-2.5 rounded-[4px] border text-left transition-all cursor-pointer ${
                                            active
                                                ? 'border-[#FF4A1F] bg-[#FF4A1F]/5 ring-1 ring-[#FF4A1F]/30'
                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12161c] hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <Icon
                                                className={`h-3.5 w-3.5 ${
                                                    active ? 'text-[#FF4A1F]' : 'text-slate-400'
                                                }`}
                                            />
                                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                {opt.label}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                                            {opt.subtitle}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <Input
                            label="Counter"
                            readOnly
                            value={`${counter.code} — ${counter.name}`}
                            className="h-[34px] text-xs font-semibold"
                        />

                        {/* Amount & Reference */}
                        <Input
                            label={`Amount (${currency}) *`}
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            required
                            autoFocus
                            icon={<span className="text-xs font-bold text-slate-400">৳</span>}
                            className="text-sm font-bold focus:border-[#FF4A1F]"
                        />
                        <Input
                            label="Reference / Receipt #"
                            type="text"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            placeholder="e.g. INV-00042 / Voucher #12"
                            className="text-xs focus:border-[#FF4A1F]"
                        />

                        {/* Reason (Required for Audit) */}
                        <Input
                            label="Reason (অডিটের জন্য) *"
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={selectedOption.placeholder}
                            required
                            className="text-xs focus:border-[#FF4A1F]"
                        />

                        {/* Optional Notes */}
                        <Textarea
                            label="Additional Notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Optional remarks..."
                            className="text-xs focus:border-[#FF4A1F]"
                        />

                    {/* Live Drawer Balance Preview */}
                    <div className="rounded-[4px] bg-slate-50 dark:bg-[#12161c] border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-500">
                            <span>Current Expected Cash in Drawer:</span>
                            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {formatCurrency(currentExpected, currency)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">{selectedOption.label} Adjustment:</span>
                            <span
                                className={`font-mono font-bold ${
                                    selectedOption.sign > 0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                            >
                                {selectedOption.sign > 0 ? '+' : '−'}
                                {formatCurrency(parsedAmount, currency)}
                            </span>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                            <span>Projected Drawer Cash After Entry:</span>
                            <span className="font-mono">{formatCurrency(projectedExpected, currency)}</span>
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
                            disabled={submitting || parsedAmount <= 0 || !reason.trim()}
                            className="bg-[#FF4A1F] hover:bg-[#e03d15] text-white"
                        >
                            {submitting ? 'Recording...' : `Record ${selectedOption.label}`}
                        </Button>
                    </div>
                </form>
                </FormLayoutProvider>
            </div>
        </div>
    );
}
