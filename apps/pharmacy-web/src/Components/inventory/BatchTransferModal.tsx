import React, { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { ArrowRightLeft, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { Textarea } from '@/Components/ui/Textarea';
import { BrtaField, BrtaFormGrid, BrtaFormModal, brtaInputClass, brtaTextareaClass } from '@/Components/ui/BrtaForm';
import { BatchRow, BranchFilterOption } from './inventoryTypes';

interface BatchTransferModalProps {
    batch: BatchRow | null;
    branches: BranchFilterOption[];
    onClose: () => void;
    onTransferred?: () => void;
}

export const BatchTransferModal: React.FC<BatchTransferModalProps> = ({
    batch,
    branches,
    onClose,
    onTransferred,
}) => {
    const [targetBranchId, setTargetBranchId] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Target branches: exclude 'all' and current batch's branch
    const availableBranches = branches.filter(
        (b) => String(b.id) !== 'all' && Number(b.id) !== batch?.branch_id
    );

    useEffect(() => {
        if (!batch) return;
        setQuantity('1');
        setTargetBranchId(availableBranches[0]?.id ? String(availableBranches[0].id) : '');
        setReason(`Stock transfer from ${batch.branch_name}`);
        setNotes('');
        setErrors({});
    }, [batch]);

    if (!batch) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetBranchId) {
            setErrors({ target_branch_id: 'Please select a destination branch.' });
            return;
        }

        setProcessing(true);
        setErrors({});

        router.post(
            route('inventory.batches.transfer', batch.id),
            {
                target_branch_id: Number(targetBranchId),
                quantity: Number(quantity) || 1,
                reason,
                notes,
            },
            {
                preserveScroll: true,
                onError: (errs) => {
                    setErrors(errs as Record<string, string>);
                },
                onSuccess: () => {
                    onTransferred?.();
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
            title="Branch-to-Branch Stock Transfer (শাখা ট্রান্সফার)"
            subtitle={`${batch.medicine_name} (${batch.medicine_sku}) · Batch ${batch.batch_number}`}
            icon={<ArrowRightLeft className="h-4 w-4" />}
            maxWidth="3xl"
            footerProps={{
                cancelLabel: 'Cancel',
                submitLabel: 'Confirm Branch Transfer',
                submitting: processing,
                submitDisabled: availableBranches.length === 0 || batch.quantity_available < 1,
            }}
        >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-[#F8FAF8] dark:bg-[#141820] p-3 text-xs">
                <div>
                    <div className="text-[11px] text-[#666666]">Source Branch</div>
                    <div className="font-semibold text-[#222222] dark:text-slate-200">{batch.branch_name}</div>
                </div>
                <div>
                    <div className="text-[11px] text-[#666666]">Batch #</div>
                    <div className="font-mono font-bold text-[#0E5F3F]">{batch.batch_number}</div>
                </div>
                <div className="col-span-2">
                    <div className="text-[11px] text-[#666666]">Available Stock</div>
                    <div className="font-mono font-bold text-[#0E5F3F]">
                        {batch.quantity_available} {batch.unit ?? 'Pcs'}
                    </div>
                </div>
            </div>

            {availableBranches.length === 0 ? (
                <div className="p-3 text-xs text-amber-700 bg-amber-50 rounded-[2px] border border-amber-200">
                    No other branches exist in this pharmacy to transfer stock to. Create a second branch first in Branch Management.
                </div>
            ) : (
                <>
                    <BrtaFormGrid>
                        <BrtaField label="Destination Branch" required error={errors.target_branch_id}>
                            <Select
                                required
                                value={targetBranchId}
                                options={availableBranches.map((b) => ({
                                    id: String(b.id),
                                    value: String(b.id),
                                    name: b.name,
                                }))}
                                onChange={(e) => setTargetBranchId(String(e.target.value))}
                            />
                        </BrtaField>
                        <BrtaField
                            label={`Transfer Qty (${batch.unit ?? 'Units'})`}
                            required
                            error={errors.quantity}
                            hint={`1 to ${batch.quantity_available}`}
                        >
                            <input
                                type="number"
                                required
                                min={1}
                                max={batch.quantity_available}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className={`${brtaInputClass} font-mono`}
                            />
                        </BrtaField>
                    </BrtaFormGrid>

                    <BrtaField label="Transfer Reason" error={errors.reason}>
                        <input
                            placeholder="e.g. Stock replenishment for urgent demand"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>

                    <BrtaField label="Dispatch Notes" alignTop error={errors.notes}>
                        <textarea
                            placeholder="Optional gate pass, vehicle number, or staff reference..."
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className={brtaTextareaClass}
                        />
                    </BrtaField>
                </>
            )}
        </BrtaFormModal>
    );
};
