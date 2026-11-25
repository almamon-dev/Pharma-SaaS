import React, { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { ArrowRightLeft, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { FormLayoutProvider } from '@/Components/ui/FormLayout';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { Textarea } from '@/Components/ui/Textarea';
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
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-[1px] p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e2329] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50 dark:bg-[#151921]">
                    <div className="flex items-center gap-2 min-w-0">
                        <ArrowRightLeft className="h-4 w-4 text-[#FF4A1F]" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            Branch-to-Branch Stock Transfer (শাখা ট্রান্সফার)
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body Form */}
                <FormLayoutProvider labelWidth="sm:w-[155px]">
                    <form onSubmit={handleSubmit} className="p-5 space-y-3">
                        {/* Auto-filled Read-only Batch Summary */}
                        <Input
                            label="Medicine"
                            readOnly
                            value={`${batch.medicine_name} (${batch.medicine_sku})`}
                        />
                        <Input
                            label="Source Branch"
                            readOnly
                            value={batch.branch_name}
                        />
                        <Input
                            label="Batch Number"
                            readOnly
                            value={batch.batch_number}
                            className="font-mono font-semibold"
                        />
                        <Input
                            label="Available Stock"
                            readOnly
                            value={`${batch.quantity_available} ${batch.unit ?? 'Pcs'}`}
                            className="font-semibold"
                        />

                        {availableBranches.length === 0 ? (
                            <div className="p-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                                No other branches exist in this pharmacy to transfer stock to. Create a second branch first in Branch Management.
                            </div>
                        ) : (
                            <>
                                <Select
                                    label="Destination Branch"
                                    required
                                    value={targetBranchId}
                                    options={availableBranches.map((b) => ({
                                        id: String(b.id),
                                        value: String(b.id),
                                        name: b.name,
                                    }))}
                                    onChange={(e) => setTargetBranchId(String(e.target.value))}
                                    error={errors.target_branch_id}
                                />

                                <Input
                                    label={`Transfer Qty (${batch.unit ?? 'Units'})`}
                                    type="number"
                                    required
                                    min={1}
                                    max={batch.quantity_available}
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    error={errors.quantity}
                                />

                                <Input
                                    label="Transfer Reason"
                                    placeholder="e.g. Stock replenishment for urgent demand"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    error={errors.reason}
                                />

                                <Textarea
                                    label="Dispatch Notes"
                                    placeholder="Optional gate pass, vehicle number, or staff reference..."
                                    rows={2}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    error={errors.notes}
                                />
                            </>
                        )}

                        {/* Footer buttons */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={processing}
                                disabled={availableBranches.length === 0 || batch.quantity_available < 1}
                            >
                                Confirm Branch Transfer
                            </Button>
                        </div>
                    </form>
                </FormLayoutProvider>
            </div>
        </div>
    );
};
