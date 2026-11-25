import React from 'react';
import { FileText, Save, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { formatCurrency } from '@/lib/format';
import { CartItem, CustomerItem, DiscountType } from '../CreateOrder';

interface OrderPreviewModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (isDraft: boolean) => void;
    submitting: boolean;
    cart: CartItem[];
    customer: CustomerItem | null;
    walkInName: string;
    subtotal: number;
    discount: string;
    discountType: DiscountType;
    discountAmount: number;
    discountPercentage: number;
    permittedDiscountLimit: number;
    taxPercentage: number;
    taxAmount: number;
    totalPayable: number;
    doctorName?: string;
    prescriptionReference?: string;
    prescriptionNotes?: string;
    prescriptionFile?: File | null;
    requiresVerification: boolean;
    orderNotes?: string;
    internalNotes?: string;
    currency: string;
}

export default function OrderPreviewModal({
    open,
    onClose,
    onConfirm,
    submitting,
    cart,
    customer,
    walkInName,
    subtotal,
    discountAmount,
    discountPercentage,
    permittedDiscountLimit,
    taxPercentage,
    taxAmount,
    totalPayable,
    doctorName,
    prescriptionReference,
    prescriptionNotes,
    requiresVerification,
    internalNotes,
    currency,
}: OrderPreviewModalProps) {
    if (!open) return null;

    const requiresApproval = discountAmount > 0 && discountPercentage > permittedDiscountLimit + 0.01;
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

    const customerTypeLabel = (() => {
        switch (customer?.customer_type) {
            case 'patient':
                return 'Patient';
            case 'corporate':
                return 'Corporate';
            case 'walk_in':
                return 'Walk-in';
            default:
                return 'Registered';
        }
    })();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-[3px] bg-white dark:bg-[#12161c] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                {/* Minimal Header */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Order Review
                        </h3>
                        <p className="text-[11px] text-slate-400">
                            {cart.length} items • {totalQty} units
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs">
                    {/* Customer Info (Minimal Line) */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {customer?.name || walkInName || 'Walk-in Customer'}
                            </span>
                            {customer?.phone && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                    {customer.phone}
                                </span>
                            )}
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-[2px]">
                                {customerTypeLabel}
                            </span>
                            {customer?.customer_code && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                    #{customer.customer_code}
                                </span>
                            )}
                        </div>
                        {(customer?.total_due ?? 0) > 0 && (
                            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                                Due: {formatCurrency(customer?.total_due ?? 0, currency)}
                            </span>
                        )}
                    </div>

                    {/* Prescription / Notes (Minimal inline if present) */}
                    {(doctorName || prescriptionReference || prescriptionNotes || internalNotes || requiresVerification) && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                            {doctorName && (
                                <div>
                                    <span className="text-slate-400 font-medium">Doctor:</span> {doctorName}
                                </div>
                            )}
                            {prescriptionReference && (
                                <div>
                                    <span className="text-slate-400 font-medium">Rx Ref:</span> {prescriptionReference}
                                </div>
                            )}
                            {prescriptionNotes && (
                                <div>
                                    <span className="text-slate-400 font-medium">Rx Notes:</span> {prescriptionNotes}
                                </div>
                            )}
                            {internalNotes && (
                                <div>
                                    <span className="text-slate-400 font-medium">Internal Note:</span> {internalNotes}
                                </div>
                            )}
                            {requiresVerification && (
                                <div className="text-amber-600 dark:text-amber-400 font-medium text-[10.5px]">
                                    ⚠️ Pharmacist verification required for prescription items
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cart Items Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-100 dark:border-slate-800 text-[10.5px] font-semibold uppercase text-slate-400">
                                <tr>
                                    <th className="py-1.5 pr-2">Item</th>
                                    <th className="py-1.5 px-2">Batch</th>
                                    <th className="py-1.5 px-2 text-center">Unit</th>
                                    <th className="py-1.5 px-2 text-center">Qty</th>
                                    <th className="py-1.5 pl-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {cart.map((item, idx) => {
                                    const selectedBatch = item.medicine.batches?.find((b) => b.id === item.medicine_batch_id);
                                    const activeBatch = selectedBatch || item.medicine.batches?.[0];

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                            <td className="py-2 pr-2">
                                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                                    {item.medicine.name}
                                                    {item.medicine.requires_prescription && (
                                                        <span className="ml-1 text-[9px] font-bold text-[#FF4A1F]">Rx</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {item.medicine.generic_name}
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                                                {activeBatch?.batch_number ?? 'Auto FEFO'}
                                            </td>
                                            <td className="py-2 px-2 text-center text-slate-600 dark:text-slate-400 capitalize">
                                                {item.sale_unit}
                                            </td>
                                            <td className="py-2 px-2 text-center font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                                                {item.quantity}
                                            </td>
                                            <td className="py-2 pl-2 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                                                {formatCurrency(item.line_total, currency)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Financial Summary */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                            <span>Subtotal</span>
                            <span className="font-medium tabular-nums">{formatCurrency(subtotal, currency)}</span>
                        </div>

                        {discountAmount > 0 && (
                            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                <div className="flex items-center gap-1.5">
                                    <span>Discount ({discountPercentage.toFixed(1)}%)</span>
                                    {requiresApproval ? (
                                        <span className="text-[9.5px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 py-0.2 rounded">
                                            Pending Approval
                                        </span>
                                    ) : (
                                        <span className="text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400">
                                            ✓ Approved
                                        </span>
                                    )}
                                </div>
                                <span className="font-medium text-emerald-600 tabular-nums">
                                    -{formatCurrency(discountAmount, currency)}
                                </span>
                            </div>
                        )}

                        {taxAmount > 0 && (
                            <div className="flex justify-between text-slate-500 dark:text-slate-400">
                                <span>VAT / Tax ({taxPercentage > 0 ? `${taxPercentage}%` : 'Standard'})</span>
                                <span className="font-medium tabular-nums">+{formatCurrency(taxAmount, currency)}</span>
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center font-bold text-sm text-slate-900 dark:text-slate-100">
                            <span>Total Payable</span>
                            <span className="text-base text-[#FF4A1F] tabular-nums">
                                {formatCurrency(totalPayable, currency)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Minimal Footer */}
                <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-slate-50/50 dark:bg-[#151921]/50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium cursor-pointer"
                    >
                        Edit Order
                    </button>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={submitting}
                            onClick={() => onConfirm(true)}
                            className="rounded-[3px] text-xs gap-1 border-slate-300 dark:border-slate-700"
                        >
                            <Save className="h-3 w-3" />
                            <span>Save Draft</span>
                        </Button>

                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            isLoading={submitting}
                            disabled={submitting}
                            onClick={() => onConfirm(false)}
                            className="bg-[#FF4A1F] hover:bg-[#e03d15] text-white rounded-[3px] text-xs font-bold gap-1 px-3.5 shadow-none cursor-pointer"
                        >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            <span>Submit Order</span>
                            <kbd className="ml-1 px-1 py-0.2 rounded bg-black/20 text-[9px] font-mono">
                                F9
                            </kbd>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
