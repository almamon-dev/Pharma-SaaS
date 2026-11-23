import { Clock, Play, Trash2, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { formatCurrency } from '@/lib/format';

export interface HeldBill {
    id: string;
    heldAt: string;
    customerName: string;
    customerId?: string;
    doctorName?: string;
    prescriptionNotes?: string;
    itemsCount: number;
    subtotal: number;
    cart: Array<{
        medicine: any;
        qty: number;
        saleUnit: 'piece' | 'strip' | 'box';
    }>;
    discount: string;
    discountType: 'fixed' | 'percent';
}

interface HeldBillsModalProps {
    open: boolean;
    heldBills: HeldBill[];
    currency: string;
    onClose: () => void;
    onResumeBill: (bill: HeldBill) => void;
    onDeleteBill: (billId: string) => void;
    onClearAll: () => void;
}

export default function HeldBillsModal({
    open,
    heldBills,
    currency,
    onClose,
    onResumeBill,
    onDeleteBill,
    onClearAll,
}: HeldBillsModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12161c]">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#FF4A1F]" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Held Orders (হোল্ড করা বিলের তালিকা)
                        </h3>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#FF4A1F]/10 text-[#FF4A1F]">
                            {heldBills.length}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto space-y-3 flex-1">
                    {heldBills.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                            বর্তমানে কোনো হোল্ড করা বিল নেই।
                        </div>
                    ) : (
                        heldBills.map((bill) => (
                            <div
                                key={bill.id}
                                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#1a202a] hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-center justify-between gap-3"
                            >
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                            {bill.customerName || 'Walk-in Customer'}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {new Date(bill.heldAt).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate">
                                        {bill.cart
                                            .map((c) => `${c.medicine.name} (${c.qty} ${c.saleUnit})`)
                                            .join(', ')}
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                        <span>{bill.itemsCount} items</span>
                                        <span>•</span>
                                        <span className="text-[#FF4A1F] font-bold">
                                            {formatCurrency(bill.subtotal, currency)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => onDeleteBill(bill.id)}
                                        title="Discard Bill"
                                        className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={() => onResumeBill(bill)}
                                        className="gap-1 text-xs"
                                    >
                                        <Play className="h-3.5 w-3.5 fill-current" />
                                        Resume (চালু)
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {heldBills.length > 0 && (
                    <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#12161c] flex items-center justify-between text-xs">
                        <button
                            type="button"
                            onClick={onClearAll}
                            className="text-rose-500 hover:underline cursor-pointer font-medium"
                        >
                            সব হোল্ড বিল মুছুন
                        </button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={onClose}
                        >
                            Close
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
