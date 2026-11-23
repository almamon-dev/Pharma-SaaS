import { useCallback, useEffect } from 'react';
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
    const handlePrint = useCallback(() => {
        if (!sale) return;
        const receiptElement = document.getElementById('pos-thermal-receipt');
        if (!receiptElement) {
            window.print();
            return;
        }

        // Use a hidden iframe for 100% reliable thermal receipt printing without modal/DOM clipping
        let iframe = document.getElementById('pos-thermal-print-frame') as HTMLIFrameElement | null;
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'pos-thermal-print-frame';
            iframe.setAttribute(
                'style',
                'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;pointer-events:none;'
            );
            document.body.appendChild(iframe);
        }

        const pri = iframe.contentWindow;
        if (!pri) {
            window.print();
            return;
        }

        // Collect existing stylesheets to preserve font and formatting
        const existingStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map((el) => el.outerHTML)
            .join('\n');

        const doc = pri.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Receipt - ${sale.invoice_number}</title>
                ${existingStyles}
                <style>
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    @media print {
                        html, body {
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Reset borders to 0 so no browser default 3px box borders appear */
                    *, *::before, *::after {
                        border-width: 0;
                        border-style: solid;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                        font-size: 11px;
                        line-height: 1.35;
                        display: flex;
                        justify-content: center;
                        align-items: flex-start;
                        padding: 4mm 2mm;
                    }
                    #print-slip {
                        width: 100%;
                        max-width: 74mm;
                        margin: 0 auto;
                        background: #ffffff;
                        padding: 2mm 1mm;
                    }
                    /* Clean horizontal dashed dividers only (no box/side borders) */
                    .border-b { border-bottom-width: 1px !important; }
                    .border-t { border-top-width: 1px !important; }
                    .border-l { border-left-width: 1px !important; }
                    .border-r { border-right-width: 0 !important; }
                    .border-dashed { border-style: dashed !important; }
                    .border-slate-300, .border-slate-200, .border-slate-700, .border-slate-800 {
                        border-color: #94a3b8 !important;
                    }
                    .text-center { text-align: center !important; }
                    .text-right { text-align: right !important; }
                    .text-left { text-align: left !important; }
                    .font-bold { font-weight: 700 !important; }
                    .font-extrabold { font-weight: 800 !important; }
                    .font-semibold { font-weight: 600 !important; }
                    .font-medium { font-weight: 500 !important; }
                    .uppercase { text-transform: uppercase !important; }
                    .italic { font-style: italic !important; }
                    .tracking-tight { letter-spacing: -0.025em !important; }
                    .tracking-wider { letter-spacing: 0.05em !important; }
                    .leading-tight { line-height: 1.25 !important; }
                    .text-base { font-size: 14px !important; }
                    .text-sm { font-size: 12px !important; }
                    .text-xs { font-size: 11px !important; }
                    .text-\\[11px\\] { font-size: 11px !important; }
                    .text-\\[10px\\] { font-size: 10px !important; }
                    .text-\\[9\\.5px\\] { font-size: 9.5px !important; }
                    .text-\\[9px\\] { font-size: 9px !important; }
                    .text-\\[11\\.5px\\] { font-size: 11.5px !important; }
                    .text-\\[10\\.5px\\] { font-size: 10.5px !important; }
                    .py-1 { padding-top: 2px !important; padding-bottom: 2px !important; }
                    .py-1\\.5 { padding-top: 3px !important; padding-bottom: 3px !important; }
                    .py-2\\.5 { padding-top: 6px !important; padding-bottom: 6px !important; }
                    .pb-1 { padding-bottom: 2px !important; }
                    .pb-3 { padding-bottom: 8px !important; }
                    .pt-0\\.5 { padding-top: 2px !important; }
                    .pt-1 { padding-top: 4px !important; }
                    .pt-3 { padding-top: 8px !important; }
                    .pr-1 { padding-right: 4px !important; }
                    .pl-2 { padding-left: 8px !important; }
                    .mt-0\\.5 { margin-top: 2px !important; }
                    .mt-1 { margin-top: 4px !important; }
                    .space-y-1 > * + * { margin-top: 3px !important; }
                    .space-y-0\\.5 > * + * { margin-top: 2px !important; }
                    .flex { display: flex !important; }
                    .justify-between { justify-content: space-between !important; }
                    .items-center { align-items: center !important; }
                    table { width: 100% !important; border-collapse: collapse !important; }
                    th, td { text-align: left !important; }
                    .divide-y > * + * { border-top-width: 1px !important; border-top-style: solid !important; border-top-color: #e2e8f0 !important; }
                    span, p, h2, h3, div, th, td { color: #000000 !important; }
                    .bg-rose-50, .bg-slate-50, .bg-slate-100 { background: transparent !important; }
                    .border-rose-200 { border-width: 1px !important; border-style: solid !important; border-color: #94a3b8 !important; }
                </style>
            </head>
            <body>
                <div id="print-slip">
                    ${receiptElement.innerHTML}
                </div>
            </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            pri.focus();
            pri.print();
        }, 150);
    }, [sale]);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'F2') {
                e.preventDefault();
                onNewSale();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                handlePrint();
            } else if (e.key === 'Enter') {
                const target = e.target as HTMLElement | null;
                const isFormInput = target?.tagName === 'BUTTON' || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
                if (!isFormInput) {
                    e.preventDefault();
                    handlePrint();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose, onNewSale, handlePrint]);

    if (!open || !sale) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static"
            onClick={onClose}
        >
            {/* Single Modal Container */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-[3px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:border-none print:shadow-none print:w-full print:max-w-none print:max-h-none print:rounded-none"
            >
                {/* Modal Header (Hidden on print) */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12161c] shrink-0 print:hidden">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Sale Completed · POS Receipt
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-[3px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        title="Close (Esc)"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Receipt Content Area - Single unified body */}
                <div className="overflow-y-auto flex-1 p-5 print:p-0 print:overflow-visible bg-white dark:bg-[#151921] print:bg-white">
                    <div
                        id="pos-thermal-receipt"
                        className="w-full font-mono text-xs text-slate-800 dark:text-slate-200 print:text-black print:max-w-[80mm] print:p-0 print:text-[11px]"
                    >
                        {/* Pharmacy Header */}
                        <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
                            <h2 className="text-base font-extrabold tracking-tight uppercase text-slate-900 dark:text-white print:text-black">
                                {sale.branch_name}
                            </h2>
                            {sale.branch_address && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 print:text-black mt-0.5">
                                    {sale.branch_address}
                                </p>
                            )}
                            {sale.branch_phone && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 print:text-black">
                                    Tel: {sale.branch_phone}
                                </p>
                            )}
                            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 print:text-black">
                                POS Cash Receipt
                            </div>
                        </div>

                        {/* Invoice & Meta Details */}
                        <div className="py-2.5 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-1 text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400 print:text-black">Invoice:</span>
                                <span className="font-bold text-slate-900 dark:text-white print:text-black">{sale.invoice_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400 print:text-black">Date/Time:</span>
                                <span>{sale.sold_at}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400 print:text-black">Cashier:</span>
                                <span>{sale.cashier_name}</span>
                            </div>
                            {sale.customer_name && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-slate-400 print:text-black">Customer:</span>
                                    <span className="font-semibold text-slate-900 dark:text-white print:text-black">
                                        {sale.customer_name}
                                        {sale.customer_phone ? ` (${sale.customer_phone})` : ''}
                                    </span>
                                </div>
                            )}
                            {sale.doctor_name && (
                                <div className="flex justify-between text-indigo-600 dark:text-indigo-400 print:text-black">
                                    <span className="font-medium">Doctor:</span>
                                    <span className="font-semibold">{sale.doctor_name}</span>
                                </div>
                            )}
                            {sale.prescription_notes && (
                                <div className="pt-0.5 text-[10px] text-slate-500 dark:text-slate-400 italic print:text-black">
                                    Rx Note: {sale.prescription_notes}
                                </div>
                            )}
                        </div>

                        {/* Items Table */}
                        <div className="py-2.5 border-b border-dashed border-slate-300 dark:border-slate-700">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[10px] uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1 print:text-black">
                                        <th className="py-1">Item</th>
                                        <th className="py-1 text-center">Qty</th>
                                        <th className="py-1 text-right">Price</th>
                                        <th className="py-1 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                    {sale.items.map((item, idx) => (
                                        <tr key={idx} className="text-[11px]">
                                            <td className="py-1.5 pr-1">
                                                <div className="font-bold text-slate-900 dark:text-white print:text-black leading-tight">
                                                    {item.name}
                                                </div>
                                                <div className="text-[9.5px] text-slate-500 dark:text-slate-400 print:text-black">
                                                    {item.strength ? `${item.strength} · ` : ''}
                                                    {item.sale_unit}
                                                </div>
                                            </td>
                                            <td className="py-1.5 text-center font-bold text-slate-900 dark:text-white print:text-black">
                                                {item.pack_quantity}
                                            </td>
                                            <td className="py-1.5 text-right text-slate-600 dark:text-slate-300 print:text-black">
                                                {formatCurrency(item.unit_price, sale.currency)}
                                            </td>
                                            <td className="py-1.5 text-right font-bold text-slate-900 dark:text-white print:text-black">
                                                {formatCurrency(item.line_total, sale.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div className="py-2.5 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-1 text-[11.5px]">
                            <div className="flex justify-between text-slate-600 dark:text-slate-400 print:text-black">
                                <span>Subtotal</span>
                                <span>{formatCurrency(sale.subtotal, sale.currency)}</span>
                            </div>
                            {sale.discount_amount > 0 && (
                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                    <span>Discount</span>
                                    <span>- {formatCurrency(sale.discount_amount, sale.currency)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white print:text-black pt-1 border-t border-slate-200 dark:border-slate-800">
                                <span>TOTAL</span>
                                <span>{formatCurrency(sale.total_amount, sale.currency)}</span>
                            </div>

                            <div className="pt-1 space-y-0.5 text-[10.5px]">
                                <div className="flex justify-between text-slate-600 dark:text-slate-400 print:text-black">
                                    <span>Payment Method:</span>
                                    <span className="uppercase font-bold text-slate-800 dark:text-slate-200 print:text-black">{sale.payment_method}</span>
                                </div>

                                {sale.payments && sale.payments.length > 1 && (
                                    <div className="pl-2 space-y-0.5 text-[9.5px] text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800">
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

                                <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium print:text-black">
                                    <span>Paid / সংগৃহীত:</span>
                                    <span className="font-bold text-slate-900 dark:text-white print:text-black">{formatCurrency(sale.paid_amount, sale.currency)}</span>
                                </div>

                                {(sale.change_amount ?? 0) > 0 && (
                                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                                        <span>Change / ফেরত:</span>
                                        <span>{formatCurrency(sale.change_amount!, sale.currency)}</span>
                                    </div>
                                )}

                                {(sale.due_amount ?? 0) > 0 && (
                                    <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-1 py-0.5 rounded-[3px] border border-rose-200 dark:border-rose-900/60">
                                        <span>Unpaid Due (বাকি):</span>
                                        <span>{formatCurrency(sale.due_amount!, sale.currency)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Message */}
                        <div className="pt-3 text-center text-[10px] text-slate-500 dark:text-slate-400 space-y-1 print:text-black">
                            <p className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                                আমাদের ফার্মেসিতে আসার জন্য ধন্যবাদ!
                            </p>
                            <p>Get well soon · দ্রুত আরোগ্য কামনা করি</p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono print:text-black">
                                Powered by PharmaCore SaaS
                            </p>
                        </div>
                    </div>
                </div>

                {/* Modal Footer Controls (Hidden on print) */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12161c] shrink-0 print:hidden">
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

            {/* Print Specific CSS fallback for browser Ctrl+P */}
            <style>{`
                @media print {
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    html, body {
                        width: 80mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        overflow: visible !important;
                        height: auto !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #pos-thermal-receipt, #pos-thermal-receipt * {
                        visibility: visible !important;
                        color: #000000 !important;
                    }
                    #pos-thermal-receipt {
                        position: fixed !important;
                        top: 4mm !important;
                        left: 50% !important;
                        transform: translateX(-50%) !important;
                        width: 76mm !important;
                        max-width: 76mm !important;
                        margin: 0 auto !important;
                        padding: 3mm 2mm !important;
                        background: #ffffff !important;
                        box-shadow: none !important;
                        border: none !important;
                        z-index: 9999999 !important;
                        display: block !important;
                    }
                }
            `}</style>
        </div>
    );
}
