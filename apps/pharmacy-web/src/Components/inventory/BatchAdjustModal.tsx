import React, { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { Textarea } from '@/Components/ui/Textarea';
import { Badge } from '@/Components/ui/Badge';
import { BrtaField, BrtaFormGrid, BrtaFormModal, BrtaOptionItem, BrtaOptionStrip, brtaInputClass, brtaTextareaClass } from '@/Components/ui/BrtaForm';
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
    supplier_return: ['Near-expiry supplier return (সাপ্লায়ার ফেরত)', 'Defective batch supplier recall', 'Wrong shipment returned to distributor'],
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
        { id: 'supplier_return', value: 'supplier_return', name: 'Return to Supplier (সাপ্লায়ার ফেরত)' },
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
        <BrtaFormModal
            open={Boolean(batch)}
            onClose={onClose}
            onSubmit={handleSubmit}
            title="Batch Stock Adjustment & Disposal"
            subtitle={`Batch ${batch.batch_number}${batch.medicine_name ? ` · ${batch.medicine_name}` : ''} · ${batch.branch_name}`}
            icon={<AlertTriangle className="h-4 w-4" />}
            maxWidth="3xl"
            footerProps={{
                leftText: (
                    <span>
                        {isInbound ? 'Inventory Cost Increase: ' : 'Stock Cost Value Impact: '}
                        <strong className={`font-mono ${isInbound ? 'text-[#0E5F3F]' : 'text-[#D9534F]'}`}>
                            {isInbound ? '+' : '-'}
                            {formatCurrency(costImpact, currency)}
                        </strong>
                    </span>
                ),
                cancelLabel: 'Cancel',
                submitLabel: isInbound ? 'Confirm Stock Addition' : 'Record Adjustment',
                submitting: processing,
            }}
        >
            <div className="grid grid-cols-3 gap-2 rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-[#F8FAF8] dark:bg-[#151921] p-3 text-xs">
                <div>
                    <div className="text-[11px] text-[#666666]">Available</div>
                    <div className="font-mono font-bold text-[#222222] dark:text-slate-100">
                        {batch.quantity_available} {batch.unit ?? 'Pcs'}
                    </div>
                </div>
                <div>
                    <div className="text-[11px] text-[#666666]">Expiry Date</div>
                    <div className="flex items-center gap-1.5 font-mono font-semibold text-[#222222] dark:text-slate-200">
                        {batch.expiry_date ?? '—'}
                        {batch.is_expired && <Badge variant="rose">Expired</Badge>}
                    </div>
                </div>
                <div>
                    <div className="text-[11px] text-[#666666]">Unit Cost</div>
                    <div className="font-mono font-semibold text-[#222222] dark:text-slate-100">
                        {formatCurrency(batch.purchase_price, currency)}
                    </div>
                </div>
            </div>

            {batch.is_expired && (
                <div className="flex items-start gap-2 rounded-[2px] border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/25 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                        This batch has passed its expiry date and is blocked from POS checkout. Record disposal to write off remaining stock.
                    </span>
                </div>
            )}

            <BrtaFormGrid>
                <BrtaField label="Adjustment Action" required error={errors.adjustment_type}>
                    <Select
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
                    />
                </BrtaField>
                <BrtaField label={isInbound ? 'Quantity to Add' : 'Quantity to Deduct'} required={!disposeEntireBatch} error={errors.quantity}>
                    <input
                        type="number"
                        min={1}
                        max={isInbound ? undefined : batch.quantity_available}
                        disabled={disposeEntireBatch && isDamageOrDisposal}
                        required={!disposeEntireBatch}
                        value={disposeEntireBatch && isDamageOrDisposal ? String(batch.quantity_available) : quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>
            </BrtaFormGrid>

            {isDamageOrDisposal && (
                <BrtaField label="Disposal Option">
                    <BrtaOptionStrip>
                        <BrtaOptionItem>
                            <input
                                type="checkbox"
                                checked={disposeEntireBatch}
                                onChange={(e) => setDisposeEntireBatch(e.target.checked)}
                                className="accent-[#337AB7]"
                            />
                            <span>
                                Dispose entire remaining batch ({batch.quantity_available} {batch.unit ?? 'Pcs'}) & close batch
                            </span>
                        </BrtaOptionItem>
                    </BrtaOptionStrip>
                </BrtaField>
            )}

            <BrtaField label="Reason (Audit Trail)" required error={errors.reason} alignTop>
                <div className="space-y-1.5">
                    <input
                        required
                        placeholder="Enter stock movement reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className={brtaInputClass}
                    />
                    <div className="flex flex-wrap gap-1.5">
                        {(reasonPresets[adjustmentType] ?? []).map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setReason(preset)}
                                className="rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F5F7F4] dark:bg-slate-800 px-2 py-0.5 text-[11px] text-[#444444] dark:text-slate-300 hover:border-[#0E5F3F] hover:text-[#0E5F3F] cursor-pointer"
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                </div>
            </BrtaField>

            <BrtaField label="Supervisor Notes" alignTop error={errors.notes}>
                <textarea
                    placeholder="Optional disposal certificate reference or physical verification notes..."
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={brtaTextareaClass}
                />
            </BrtaField>
        </BrtaFormModal>
    );
};

