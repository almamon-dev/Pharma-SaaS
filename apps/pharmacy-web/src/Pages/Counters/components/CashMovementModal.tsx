import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import {
    ArrowDownLeft,
    ArrowUpRight,
    RotateCcw,
    ShieldCheck,
    Wallet,
} from 'lucide-react';
import {
    BrtaField,
    BrtaFormGrid,
    BrtaFormModal,
    brtaInputClass,
    brtaTextareaClass,
} from '@/Components/ui/BrtaForm';
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
        <BrtaFormModal
            open={open}
            onClose={onClose}
            onSubmit={handleSubmit}
            title={`Cash Drawer Movement · ${counter.code}`}
            subtitle="Cash In, Cash Out, Safe Drop বা Cash Refund রেকর্ড করুন"
            icon={<Wallet className="h-4 w-4" />}
            maxWidth="2xl"
            footerProps={{
                submitLabel: `Record ${selectedOption.label}`,
                submitting,
                submitDisabled: parsedAmount <= 0 || !reason.trim(),
            }}
        >
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
                            className={`flex flex-col items-start p-2.5 rounded-[2px] border text-left transition-all cursor-pointer ${
                                active
                                    ? 'border-[#0E5F3F] bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 ring-1 ring-[#0E5F3F]/30'
                                    : 'border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] hover:border-slate-400'
                            }`}
                        >
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <Icon
                                    className={`h-3.5 w-3.5 ${
                                        active ? 'text-[#0E5F3F]' : 'text-slate-400'
                                    }`}
                                />
                                <span className="text-xs font-bold text-[#222222] dark:text-white">
                                    {opt.label}
                                </span>
                            </div>
                            <span className="text-[10.5px] text-[#666666] dark:text-slate-400 leading-tight">
                                {opt.subtitle}
                            </span>
                        </button>
                    );
                })}
            </div>

            <BrtaFormGrid>
                <BrtaField label={`Amount (${currency})`} required>
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        autoFocus
                        className={`${brtaInputClass} font-mono font-bold`}
                    />
                </BrtaField>

                <BrtaField label="Reference / Receipt #">
                    <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="e.g. INV-00042 / Voucher #12"
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>

                <BrtaField
                    label="Reason (কারণ)"
                    required
                    hint="অডিটের জন্য বাধ্যতামূলক"
                    className="md:col-span-2"
                >
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={selectedOption.placeholder}
                        required
                        className={brtaInputClass}
                    />
                </BrtaField>

                <BrtaField label="Additional Notes" alignTop className="md:col-span-2">
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Optional remarks..."
                        className={brtaTextareaClass}
                    />
                </BrtaField>
            </BrtaFormGrid>

            {/* Live Drawer Balance Preview */}
            <div className="rounded-[2px] bg-[#F8FAF8] dark:bg-[#12161c] border border-[#CCCCCC] dark:border-slate-700 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-[#555555] dark:text-slate-400">
                    <span>Current Expected Cash in Drawer:</span>
                    <span className="font-mono font-semibold text-[#222222] dark:text-slate-200">
                        {formatCurrency(currentExpected, currency)}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-[#555555] dark:text-slate-400">
                        {selectedOption.label} Adjustment:
                    </span>
                    <span
                        className={`font-mono font-bold ${
                            selectedOption.sign > 0 ? 'text-[#0E5F3F]' : 'text-[#C9302C]'
                        }`}
                    >
                        {selectedOption.sign > 0 ? '+' : '−'}
                        {formatCurrency(parsedAmount, currency)}
                    </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-[#E5E7EB] dark:border-slate-700 font-bold text-[#222222] dark:text-white">
                    <span>Projected Drawer Cash After Entry:</span>
                    <span className="font-mono">{formatCurrency(projectedExpected, currency)}</span>
                </div>
            </div>
        </BrtaFormModal>
    );
}

