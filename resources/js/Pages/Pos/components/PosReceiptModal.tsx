import { Printer, ShoppingBag, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { PosReceiptData } from '@/types';
import { formatCurrency } from '@/lib/format';

interface PosReceiptModalProps {
    open: boolean;
    sale: PosReceiptData | null;
    onClose: () => void;
    onNewSale: () => void;
}

export default function PosReceiptModal({
    open,
    sale,
    onClose,
    onNewSale,
}: PosReceiptModalProps) {
    if (!open || !sale) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
            {/* Modal Container */}
            <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden print:border-none print:shadow-none print:w-full print:max-w-none">
                {/* Modal Header (Hidden on print) */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12161c] print:hidden">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Sale Completed · POS Receipt
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Printable Slip Area */}
                <div className="p-5 print:p-0 bg-slate-100/60 dark:bg-[#0e1217]/60 print:bg-white flex justify-center">
                    <div
                        id="pos-thermal-receipt"
                        className="w-full max-w-[340px] bg-white text-slate-900 p-5 rounded-lg shadow-sm border border-slate-200/90 font-mono text-xs print:border-none print:shadow-none print:max-w-[80mm] print:p-0 print:text-[11px]"
                    >
                        {/* Pharmacy Header */}
                        <div className="text-center pb-3 border-b border-dashed border-slate-300">
                            <h2 className="text-base font-extrabold tracking-tight uppercase">
                                {sale.branch_name}
                            </h2>
                            {sale.branch_address && (
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                    {sale.branch_address}
                                </p>
                            )}
                            {sale.branch_phone && (
                                <p className="text-[11px] text-slate-600">
                                    Tel: {sale.branch_phone}
                                </p>
                            )}
                            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                POS Cash Receipt
                            </div>
                        </div>

                        {/* Invoice & Meta Details */}
                        <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Invoice:</span>
                                <span className="font-bold text-slate-900">{sale.invoice_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Date/Time:</span>
                                <span>{sale.sold_at}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Cashier:</span>
                                <span>{sale.cashier_name}</span>
                            </div>
                            {sale.customer_name && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Customer:</span>
                                    <span className="font-semibold">
                                        {sale.customer_name}
                                        {sale.customer_phone ? ` (${sale.customer_phone})` : ''}
                                    </span>
                                </div>
                            )}
                            {sale.doctor_name && (
                                <div className="flex justify-between text-indigo-700">
                                    <span className="font-medium">Doctor:</span>
                                    <span className="font-semibold">{sale.doctor_name}</span>
                                </div>
                            )}
                            {sale.prescription_notes && (
                                <div className="pt-0.5 text-[10px] text-slate-600 italic">
                                    Rx Note: {sale.prescription_notes}
                                </div>
                            )}
                        </div>

                        {/* Items Table */}
                        <div className="py-2.5 border-b border-dashed border-slate-300">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-200 pb-1">
                                        <th className="py-1">Item</th>
                                        <th className="py-1 text-center">Qty</th>
                                        <th className="py-1 text-right">Price</th>
                                        <th className="py-1 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sale.items.map((item, idx) => (
                                        <tr key={idx} className="text-[11px]">
                                            <td className="py-1.5 pr-1">
                                                <div className="font-bold text-slate-900 leading-tight">
                                                    {item.name}
                                                </div>
                                                <div className="text-[9.5px] text-slate-500">
                                                    {item.strength ? `${item.strength} · ` : ''}
                                                    {item.sale_unit}
                                                </div>
                                            </td>
                                            <td className="py-1.5 text-center font-bold">
                                                {item.pack_quantity}
                                            </td>
                                            <td className="py-1.5 text-right text-slate-600">
                                                {formatCurrency(item.unit_price, sale.currency)}
                                            </td>
                                            <td className="py-1.5 text-right font-bold text-slate-900">
                                                {formatCurrency(item.line_total, sale.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11.5px]">
                            <div className="flex justify-between text-slate-600">
                                <span>Subtotal</span>
                                <span>{formatCurrency(sale.subtotal, sale.currency)}</span>
                            </div>
                            {sale.discount_amount > 0 && (
                                <div className="flex justify-between text-emerald-700 font-medium">
                                    <span>Discount</span>
                                    <span>- {formatCurrency(sale.discount_amount, sale.currency)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                                <span>TOTAL</span>
                                <span>{formatCurrency(sale.total_amount, sale.currency)}</span>
                            </div>

                            <div className="pt-1 space-y-0.5 text-[10.5px]">
                                <div className="flex justify-between text-slate-600">
                                    <span>Payment Method:</span>
                                    <span className="uppercase font-bold">{sale.payment_method}</span>
                                </div>

                                {sale.payments && sale.payments.length > 1 && (
                                    <div className="pl-2 space-y-0.5 text-[9.5px] text-slate-500 border-l border-slate-200">
                                        {sale.payments.map((p, pIdx) => (
                                            <div key={pIdx} className="flex justify-between">
                                                <span>
                                                    • {p.method.toUpperCase()}
                                                    {p.reference_number ? ` (${p.reference_number})` : ''}
                                                </span>
                                                <span>{formatCurrency(p.amount, sale.currency)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex justify-between text-slate-700 font-medium">
                                    <span>Paid / সংগৃহীত:</span>
                                    <span className="font-bold">{formatCurrency(sale.paid_amount, sale.currency)}</span>
                                </div>

                                {(sale.change_amount ?? 0) > 0 && (
                                    <div className="flex justify-between text-emerald-700 font-semibold">
                                        <span>Change / ফেরত:</span>
                                        <span>{formatCurrency(sale.change_amount!, sale.currency)}</span>
                                    </div>
                                )}

                                {(sale.due_amount ?? 0) > 0 && (
                                    <div className="flex justify-between text-rose-700 font-bold bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                                        <span>Unpaid Due (বাকি):</span>
                                        <span>{formatCurrency(sale.due_amount!, sale.currency)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Message */}
                        <div className="pt-3 text-center text-[10px] text-slate-500 space-y-1">
                            <p className="font-semibold text-slate-700">
                                আমাদের ফার্মেসিতে আসার জন্য ধন্যবাদ!
                            </p>
                            <p>Get well soon · দ্রুত আরোগ্য কামনা করি</p>
                            <p className="text-[9px] text-slate-400 font-mono">
                                Powered by PharmaCore SaaS
                            </p>
                        </div>
                    </div>
                </div>

                {/* Modal Footer Controls (Hidden on print) */}
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] print:hidden">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onNewSale}
                        className="gap-1.5"
                    >
                        <ShoppingBag className="h-4 w-4" />
                        New Sale (F2)
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={handlePrint}
                            className="gap-1.5"
                        >
                            <Printer className="h-4 w-4" />
                            Print Receipt
                        </Button>
                    </div>
                </div>
            </div>

            {/* Print Specific CSS */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #pos-thermal-receipt, #pos-thermal-receipt * {
                        visibility: visible !important;
                    }
                    #pos-thermal-receipt {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 80mm !important;
                        max-width: 80mm !important;
                        margin: 0 !important;
                        padding: 2mm !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
