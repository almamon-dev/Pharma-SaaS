import React, { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { Textarea } from '@/Components/ui/Textarea';
import { Badge } from '@/Components/ui/Badge';
import { formatCurrency } from '@/lib/format';
import { BatchRow } from './inventoryTypes';

interface BatchAdjustModalProps {
    batch: BatchRow | null;
    currency: string;
    onClose: () => void;
    onAdjusted?: () => void;
}

const reasonPresets: Record<string, string[]> = {
    adjustment_in: ['Physical stock count surplus', 'Unrecorded supplier bonus', 'Audit reconciliation (+)'],
    adjustment_out: ['Physical stock count variance', 'Sample / clinic issue', 'Audit reconciliation (-)'],
    damage: ['Water / moisture damage', 'Broken bottle or strip', 'Cold-chain failure'],
    expiry_disposal: ['Expired stock quarantine disposal', 'Manufacturer recall disposal', 'DGDA scheduled expiry write-off'],
};

export const BatchAdjustModal: React.FC<BatchAdjustModalProps> = ({
    batch,
    currency,
    onClose,
    onAdjusted,
}) => {
    const [adjustmentType, setAdjustmentType] = useState('adjustment_out');
    const [quantity, setQuantity] = useState('1');
    const [disposeEntireBatch, setDisposeEntireBatch] = useState(false);
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!batch) return;
        const defaultType = batch.is_expired ? 'expiry_disposal' : 'adjustment_out';
        setAdjustmentType(defaultType);
        setDisposeEntireBatch(batch.is_expired);
        setQuantity(batch.is_expired ? String(batch.quantity_available) : '1');
        setReason(
            batch.is_expired
                ? 'Expired stock quarantine disposal'
                : ''
        );
        setNotes('');
        setErrors({});
    }, [batch]);

    if (!batch) return null;

    const isDamageOrDisposal =
        adjustmentType === 'damage' || adjustmentType === 'expiry_disposal';
    const isInbound = adjustmentType === 'adjustment_in';
    const effectiveQty =
        disposeEntireBatch && isDamageOrDisposal
            ? batch.quantity_available
            : Math.max(0, Number(quantity) || 0);
    const costImpact =
        Math.round(effectiveQty * Number(batch.purchase_price || 0) * 100) / 100;

    const typeOptions = [
        ...(!batch.is_expired && batch.status !== 'damaged' && batch.status !== 'disposed'
            ? [{ id: 'adjustment_in', value: 'adjustment_in', name: 'Stock Addition (+)' }]
            : []),
        { id: 'adjustment_out', value: 'adjustment_out', name: 'Stock Deduction (-)' },
        { id: 'damage', value: 'damage', name: 'Record Damaged Stock' },
        { id: 'expiry_disposal', value: 'expiry_disposal', name: 'Expiry / Quarantine Disposal' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        setErrors({});

        router.post(
            route('inventory.batches.adjust', batch.id),
            {
                adjustment_type: adjustmentType,
                quantity: Number(quantity) || 0,
                dispose_entire_batch: disposeEntireBatch && isDamageOrDisposal,
                reason,
                notes,
            },
            {
                preserveScroll: true,
                onError: (errs) => {
                    setErrors(errs as Record<string, string>);
                },
                onSuccess: () => {
                    onAdjusted?.();
                    onClose();
                },
                onFinish: () => {
                    setProcessing(false);
                },
            }
        );
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-[1px] p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-[4px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            Batch Stock Adjustment & Disposal
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            Batch <span className="font-mono font-semibold text-[#FF4A1F]">{batch.batch_number}</span>
                            {batch.medicine_name ? ` · ${batch.medicine_name}` : ''}
                            {` · ${batch.branch_name}`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="grid grid-cols-3 gap-2 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151921] p-3 text-xs">
                        <div>
                            <div className="text-[10.5px] text-slate-500">Available</div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                {batch.quantity_available} {batch.unit ?? 'Pcs'}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10.5px] text-slate-500">Expiry Date</div>
                            <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {batch.expiry_date ?? '—'}
                                {batch.is_expired && (
                                    <Badge variant="rose">Expired</Badge>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10.5px] text-slate-500">Unit Cost</div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                                {formatCurrency(batch.purchase_price, currency)}
                            </div>
                        </div>
                    </div>

                    {batch.is_expired && (
                        <div className="flex items-start gap-2 rounded-[4px] border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/25 px-3 py-2 text-[11.5px] text-rose-700 dark:text-rose-300">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>
                                This batch has passed its expiry date and is automatically blocked from POS checkout. Record disposal to write off remaining stock from active valuation.
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Select
                            label="Adjustment Action"
                            required
                            value={adjustmentType}
                            options={typeOptions}
                            onChange={(e) => {
                                const next = String(e.target.value);
                                setAdjustmentType(next);
                                if (next !== 'damage' && next !== 'expiry_disposal') {
                                    setDisposeEntireBatch(false);
                                }
                                if (!reason || Object.values(reasonPresets).flat().includes(reason)) {
                                    setReason(reasonPresets[next]?.[0] ?? '');
                                }
                            }}
                            error={errors.adjustment_type}
                        />
                        <Input
                            label={isInbound ? 'Quantity to Add' : 'Quantity to Deduct'}
                            type="number"
                            min={1}
                            max={isInbound ? undefined : batch.quantity_available}
                            disabled={disposeEntireBatch && isDamageOrDisposal}
                            required={!disposeEntireBatch}
                            value={
                                disposeEntireBatch && isDamageOrDisposal
                                    ? String(batch.quantity_available)
                                    : quantity
                            }
                            onChange={(e) => setQuantity(e.target.value)}
                            error={errors.quantity}
                        />
                    </div>

                    {isDamageOrDisposal && (
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={disposeEntireBatch}
                                onChange={(e) =>
                                    setDisposeEntireBatch(e.target.checked)
                                }
                                className="table-checkbox"
                            />
                            Dispose entire remaining batch ({batch.quantity_available} {batch.unit ?? 'Pcs'}) & close batch status
                        </label>
                    )}

                    <div className="space-y-1.5">
                        <Input
                            label="Reason (Audit Trail)"
                            required
                            placeholder="Enter stock movement reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            error={errors.reason}
                        />
                        <div className="flex flex-wrap gap-1.5">
                            {(reasonPresets[adjustmentType] ?? []).map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setReason(preset)}
                                    className="rounded-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[10.5px] text-slate-600 dark:text-slate-300 hover:border-[#FF4A1F] hover:text-[#FF4A1F] cursor-pointer"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Textarea
                        label="Compliance / Supervisor Notes"
                        placeholder="Optional disposal certificate reference or physical verification notes..."
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        error={errors.notes}
                    />

                    <div className="flex items-center justify-between rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151921] px-3 py-2 text-xs">
                        <span className="text-slate-500">
                            {isInbound ? 'Inventory Cost Increase' : 'Stock Cost Value Impact'}
                        </span>
                        <span
                            className={`font-bold tabular-nums ${
                                isInbound
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                            }`}
                        >
                            {isInbound ? '+' : '-'}
                            {formatCurrency(costImpact, currency)}
                        </span>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant={isInbound ? 'primary' : 'danger'}
                            isLoading={processing}
                        >
                            {isInbound ? 'Confirm Stock Addition' : 'Record Adjustment'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

