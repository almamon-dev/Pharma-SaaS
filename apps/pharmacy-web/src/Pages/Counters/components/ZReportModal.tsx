import { useCallback, useEffect, useState } from 'react';
import {
 AlertTriangle,
 CheckCircle2,
 FileText,
 Loader2,
 Printer,
 Receipt,
 X,
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { formatCurrency } from '@/lib/format';

export interface ZReportPayload {
 report_type: 'Z-REPORT' | 'X-REPORT (LIVE)';
 z_report_number: string;
 session_id: number;
 status: 'open' | 'closed';
 is_force_closed?: boolean;
 force_close_reason?: string | null;
 generated_at: string;
 tenant: { name: string; currency: string };
 branch: { name?: string | null; address?: string | null; phone?: string | null };
 counter: { id?: number | null; code?: string | null; name?: string | null; zone?: string | null };
 shift: string;
 cashier: { id: number; name: string };
 closed_by?: { id: number; name: string } | null;
 opened_at?: string | null;
 closed_at?: string | null;
 duration_minutes: number;
 totals: {
 total_transactions: number;
 total_sales: number;
 cash_sales: number;
 card_sales: number;
 mobile_sales: number;
 total_collected: number;
 };
 drawer: {
 opening_float: number;
 cash_sales: number;
 cash_in: number;
 cash_out_only: number;
 safe_drop: number;
 cash_out_total: number;
 cash_refunds: number;
 expected_cash: number;
 counted_cash?: number | null;
 discrepancy: number;
 discrepancy_status: 'open' | 'matched' | 'surplus' | 'shortage';
 };
 denominations?: Record<string, number> | null;
 breaks: Array<{
 id: number;
 break_type: string;
 started_at?: string | null;
 ended_at?: string | null;
 duration_minutes?: number | null;
 notes?: string | null;
 }>;
 total_break_minutes: number;
 movements: Array<{
 id: number;
 type: string;
 amount: number;
 amount_formatted: string;
 reason: string;
 reference_number?: string | null;
 user_name?: string | null;
 occurred_at?: string | null;
 }>;
 notes?: string | null;
}

interface ZReportModalProps {
 sessionId: number | null;
 onClose: () => void;
}

const BDT_NOTES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

export default function ZReportModal({ sessionId, onClose }: ZReportModalProps) {
 const [report, setReport] = useState<ZReportPayload | null>(null);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('a4');

 useEffect(() => {
 if (!sessionId) {
 setReport(null);
 return;
 }

 let cancelled = false;
 setLoading(true);
 setError(null);

 fetch(route('counters.sessions.z-report', sessionId, false), {
 headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
 })
 .then(async (res) => {
 if (!res.ok) {
 throw new Error('Unable to load shift report.');
 }
 return res.json();
 })
 .then((data: ZReportPayload) => {
 if (!cancelled) {
 setReport(data);
 setLoading(false);
 }
 })
 .catch((err) => {
 if (!cancelled) {
 setError(err?.message || 'Failed to load Z-Report.');
 setLoading(false);
 }
 });

 return () => {
 cancelled = true;
 };
 }, [sessionId]);

 const handlePrint = useCallback(() => {
 if (!report) return;
 const content = document.getElementById('z-report-printable-body');
 if (!content) {
 window.print();
 return;
 }

 let iframe = document.getElementById('z-report-print-frame') as HTMLIFrameElement | null;
 if (!iframe) {
 iframe = document.createElement('iframe');
 iframe.id = 'z-report-print-frame';
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

 const existingStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
 .map((el) => el.outerHTML)
 .join('\n');

 const isThermal = printFormat === 'thermal';
 const doc = pri.document;
 doc.open();
 doc.write(`
 <!DOCTYPE html>
 <html>
 <head>
 <meta charset="utf-8">
 <title>${report.report_type} - ${report.z_report_number}</title>
 ${existingStyles}
 <style>
 @page {
 size: ${isThermal ? '80mm auto' : 'A4 portrait'};
 margin: ${isThermal ? '2mm' : '12mm'};
 }
 * {
 box-sizing: border-box;
 -webkit-print-color-adjust: exact !important;
 print-color-adjust: exact !important;
 }
 html, body {
 background: #ffffff !important;
 color: #0f172a !important;
 margin: 0 !important;
 padding: 0 !important;
 font-family: ${isThermal ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : "'Lato', 'Helvetica Neue', Helvetica, Arial, 'SolaimanLipi', 'Noto Sans Bengali', sans-serif"};
 font-size: ${isThermal ? '10.5px' : '12px'};
 }
 #print-root {
 width: 100%;
 max-width: ${isThermal ? '74mm' : '186mm'};
 margin: 0 auto;
 }
 </style>
 </head>
 <body>
 <div id="print-root">${content.innerHTML}</div>
 </body>
 </html>
 `);
 doc.close();

 setTimeout(() => {
 pri.focus();
 pri.print();
 }, 250);
 }, [report, printFormat]);

 if (!sessionId) return null;

 const currency = report?.tenant?.currency || 'BDT';
 const isClosed = report?.status === 'closed';

 const formatDuration = (mins: number) => {
 const hrs = Math.floor(mins / 60);
 const rem = mins % 60;
 if (hrs <= 0) return `${rem} min`;
 return `${hrs}h ${rem}m`;
 };

 const usedDenominations = report?.denominations
 ? BDT_NOTES.filter((note) => Number(report.denominations?.[String(note)] ?? 0) > 0)
 : [];

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
 <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
 {/* Modal Top Bar */}
 <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12161c] shrink-0">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-[2px] bg-[#0E5F3F]/10 text-[#0E5F3F] flex items-center justify-center">
 <FileText className="h-4 w-4"/>
 </div>
 <div>
 <h3 className="text-sm font-bold text-slate-900 dark:text-white">
 {report ? `${report.report_type} · ${report.z_report_number}` : 'Shift Reconciliation Report'}
 </h3>
 <p className="text-[11px] text-slate-500">
 {isClosed
 ? 'Immutable end-of-shift cash drawer & Z-Report audit record'
 : 'Live mid-shift X-Report preview (shift still open)'}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <div className="inline-flex rounded-[2px] border border-slate-200 dark:border-slate-700 overflow-hidden text-[11px] font-semibold">
 <button
 type="button"
 onClick={() => setPrintFormat('a4')}
 className={`px-2.5 py-1 cursor-pointer transition-colors ${
 printFormat === 'a4'
 ? 'bg-[#0E5F3F] text-white'
 : 'bg-white dark:bg-[#12161c] text-slate-600 dark:text-slate-300'
 }`}
 >
 A4 Official
 </button>
 <button
 type="button"
 onClick={() => setPrintFormat('thermal')}
 className={`px-2.5 py-1 cursor-pointer transition-colors ${
 printFormat === 'thermal'
 ? 'bg-[#0E5F3F] text-white'
 : 'bg-white dark:bg-[#12161c] text-slate-600 dark:text-slate-300'
 }`}
 >
 80mm Thermal
 </button>
 </div>

 <Button
 type="button"
 variant="primary"
 size="sm"
 onClick={handlePrint}
 disabled={!report}
 className="gap-1.5 bg-[#5CB85C] hover:bg-[#449D44] border border-[#4CAE4C] hover:bg-[#e03d15] text-white text-xs"
 >
 <Printer className="h-3.5 w-3.5"/>
 <span>Print</span>
 </Button>

 <button
 type="button"
 onClick={onClose}
 className="p-1 rounded-[2px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>
 </div>

 {/* Body */}
 <div className="flex-1 overflow-y-auto p-5 bg-slate-100/60 dark:bg-[#0e1117]">
 {loading && (
 <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-2">
 <Loader2 className="h-6 w-6 animate-spin text-[#0E5F3F]"/>
 <span className="text-xs font-medium">Loading shift reconciliation report...</span>
 </div>
 )}

 {error && (
 <div className="p-4 rounded-[2px] bg-rose-50 border border-rose-200 text-rose-700 text-xs">
 {error}
 </div>
 )}

 {report && !loading && (
 <div
 id="z-report-printable-body"
 className={`mx-auto bg-white text-slate-900 border border-slate-200 rounded-[2px] p-5 space-y-4 ${
 printFormat === 'thermal' ? 'max-w-[320px] font-mono text-[11px]' : 'max-w-full text-xs'
 }`}
 >
 {/* Header */}
 <div className="text-center border-b border-dashed border-slate-300 pb-3">
 <div className="text-base font-black tracking-tight text-slate-900">
 {report.tenant.name}
 </div>
 {report.branch.name && (
 <div className="text-[11px] font-semibold text-slate-700">
 {report.branch.name}
 </div>
 )}
 {(report.branch.address || report.branch.phone) && (
 <div className="text-[10.5px] text-slate-500">
 {[report.branch.address, report.branch.phone].filter(Boolean).join(' • ')}
 </div>
 )}
 <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-slate-900 text-white text-[11px] font-bold tracking-wider">
 <Receipt className="h-3 w-3"/>
 <span>
 {report.report_type} · {report.z_report_number}
 </span>
 </div>
 </div>

 {/* Metadata Grid */}
 <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] border-b border-slate-200 pb-3">
 <div className="flex justify-between gap-2">
 <span className="text-slate-500">Counter:</span>
 <span className="font-bold text-slate-900">
 {report.counter.code} ({report.counter.name})
 </span>
 </div>
 <div className="flex justify-between gap-2">
 <span className="text-slate-500">Shift:</span>
 <span className="font-bold capitalize text-slate-900">{report.shift}</span>
 </div>
 <div className="flex justify-between gap-2">
 <span className="text-slate-500">Cashier:</span>
 <span className="font-bold text-slate-900">{report.cashier.name}</span>
 </div>
 <div className="flex justify-between gap-2">
 <span className="text-slate-500">Duration:</span>
 <span className="font-semibold text-slate-900">
 {formatDuration(report.duration_minutes)}
 </span>
 </div>
 <div className="flex justify-between gap-2">
 <span className="text-slate-500">Opened:</span>
 <span className="font-mono text-slate-800">{report.opened_at || '—'}</span>
 </div>
 <div className="flex justify-between gap-2">
 <span className="text-slate-500">Closed:</span>
 <span className="font-mono text-slate-800">
 {report.closed_at || 'In Progress'}
 </span>
 </div>
 {report.closed_by && report.closed_by.id !== report.cashier.id && (
 <div className="col-span-2 flex justify-between gap-2 text-amber-700 font-semibold">
 <span>{report.is_force_closed ? 'Force Closed By (Supervisor):' : 'Closed By (Supervisor):'}</span>
 <span>{report.closed_by.name}</span>
 </div>
 )}
 {report.is_force_closed && report.force_close_reason && (
 <div className="col-span-2 px-2.5 py-1.5 rounded-[2px] bg-rose-50 border border-rose-200 text-rose-700 text-[10.5px]">
 <strong>Force Close Reason:</strong> {report.force_close_reason}
 </div>
 )}
 </div>

 {/* Section 1: Sales & Payment Channels */}
 <div className="space-y-1.5 border-b border-slate-200 pb-3">
 <div className="text-[10.5px] font-bold tracking-wider text-slate-500">
 1. Sales & Payment Channels ({report.totals.total_transactions} Bills)
 </div>
 <div className="space-y-1">
 <div className="flex justify-between">
 <span className="text-slate-600">Cash Sales (Net of Change)</span>
 <span className="font-mono font-semibold">
 {formatCurrency(report.totals.cash_sales, currency)}
 </span>
 </div>
 <div className="flex justify-between">
 <span className="text-slate-600">Card Payments (POS Terminal)</span>
 <span className="font-mono font-semibold">
 {formatCurrency(report.totals.card_sales, currency)}
 </span>
 </div>
 <div className="flex justify-between">
 <span className="text-slate-600">Mobile Banking (bKash / Nagad / Rocket)</span>
 <span className="font-mono font-semibold">
 {formatCurrency(report.totals.mobile_sales, currency)}
 </span>
 </div>
 <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
 <span>Total Shift Sales</span>
 <span className="font-mono">
 {formatCurrency(report.totals.total_sales, currency)}
 </span>
 </div>
 </div>
 </div>

 {/* Section 2: Cash Drawer Reconciliation */}
 <div className="space-y-1.5 border-b border-slate-200 pb-3">
 <div className="text-[10.5px] font-bold tracking-wider text-slate-500">
 2. Cash Drawer Reconciliation
 </div>
 <div className="space-y-1">
 <div className="flex justify-between">
 <span className="text-slate-600">Opening Cash Float</span>
 <span className="font-mono font-semibold">
 {formatCurrency(report.drawer.opening_float, currency)}
 </span>
 </div>
 <div className="flex justify-between text-emerald-700">
 <span>(+) Cash Payments Received</span>
 <span className="font-mono font-semibold">
 +{formatCurrency(report.drawer.cash_sales, currency)}
 </span>
 </div>
 <div className="flex justify-between text-emerald-700">
 <span>(+) Cash In (Float Top-up)</span>
 <span className="font-mono font-semibold">
 +{formatCurrency(report.drawer.cash_in, currency)}
 </span>
 </div>
 <div className="flex justify-between text-amber-700">
 <span>(−) Cash Out / Petty Expenses</span>
 <span className="font-mono font-semibold">
 −{formatCurrency(report.drawer.cash_out_only, currency)}
 </span>
 </div>
 <div className="flex justify-between text-blue-700">
 <span>(−) Safe Drops to Vault</span>
 <span className="font-mono font-semibold">
 −{formatCurrency(report.drawer.safe_drop, currency)}
 </span>
 </div>
 <div className="flex justify-between text-rose-700">
 <span>(−) Cash Refunds Paid Out</span>
 <span className="font-mono font-semibold">
 −{formatCurrency(report.drawer.cash_refunds, currency)}
 </span>
 </div>
 <div className="flex justify-between pt-1.5 border-t border-slate-300 font-bold text-slate-900 text-xs">
 <span>System Expected Cash in Drawer</span>
 <span className="font-mono">
 {formatCurrency(report.drawer.expected_cash, currency)}
 </span>
 </div>
 {isClosed && (
 <>
 <div className="flex justify-between font-bold text-slate-900">
 <span>Physical Cash Counted</span>
 <span className="font-mono">
 {formatCurrency(report.drawer.counted_cash ?? 0, currency)}
 </span>
 </div>
 <div
 className={`mt-2 px-3 py-2 rounded-[2px] border flex items-center justify-between font-bold ${
 report.drawer.discrepancy_status === 'matched'
 ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
 : report.drawer.discrepancy_status === 'surplus'
 ? 'bg-blue-50 border-blue-200 text-blue-800'
 : 'bg-rose-50 border-rose-200 text-rose-800'
 }`}
 >
 <div className="flex items-center gap-1.5">
 {report.drawer.discrepancy_status === 'matched' ? (
 <CheckCircle2 className="h-4 w-4"/>
 ) : (
 <AlertTriangle className="h-4 w-4"/>
 )}
 <span>
 {report.drawer.discrepancy_status === 'matched'
 ? 'Drawer Balanced (100% Matched)'
 : report.drawer.discrepancy_status === 'surplus'
 ? 'Cash Surplus (Over)'
 : 'Cash Shortage (Short)'}
 </span>
 </div>
 <span className="font-mono">
 {report.drawer.discrepancy > 0
 ? `+${formatCurrency(report.drawer.discrepancy, currency)}`
 : formatCurrency(report.drawer.discrepancy, currency)}
 </span>
 </div>
 </>
 )}
 </div>
 </div>

 {/* Section 3: BDT Denominations (if provided) */}
 {usedDenominations.length > 0 && (
 <div className="space-y-1.5 border-b border-slate-200 pb-3">
 <div className="text-[10.5px] font-bold tracking-wider text-slate-500">
 3. Physical Cash Denomination Breakdown
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
 {usedDenominations.map((note) => {
 const qty = Number(report.denominations?.[String(note)] ?? 0);
 return (
 <div
 key={note}
 className="flex justify-between px-2 py-1 rounded-[2px] bg-slate-50 border border-slate-200 font-mono"
 >
 <span>
 ৳{note} × {qty}
 </span>
 <span className="font-bold">৳{(note * qty).toLocaleString()}</span>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Section 4: Cash Movements Log (if any) */}
 {report.movements.length > 0 && (
 <div className="space-y-1.5 border-b border-slate-200 pb-3">
 <div className="text-[10.5px] font-bold tracking-wider text-slate-500">
 Cash Drawer Movements ({report.movements.length})
 </div>
 <div className="space-y-1">
 {report.movements.map((m) => (
 <div key={m.id} className="flex justify-between gap-2 text-[11px]">
 <div className="truncate">
 <span className="font-bold text-[10px] px-1 py-0.2 rounded-[2px] bg-slate-100 mr-1.5">
 {m.type.replace('_', ' ')}
 </span>
 <span className="text-slate-700">{m.reason}</span>
 {m.occurred_at && (
 <span className="text-slate-400 ml-1">({m.occurred_at})</span>
 )}
 </div>
 <span className="font-mono font-semibold shrink-0">
 {m.type === 'cash_in' ? '+' : '−'}
 {formatCurrency(m.amount, currency)}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Breaks & Notes */}
 {(report.breaks.length > 0 || report.notes) && (
 <div className="space-y-1 text-[11px] border-b border-slate-200 pb-3">
 {report.breaks.length > 0 && (
 <div className="flex justify-between text-slate-600">
 <span>Breaks Taken ({report.breaks.length})</span>
 <span className="font-mono font-semibold">
 {report.total_break_minutes} mins total
 </span>
 </div>
 )}
 {report.notes && (
 <div className="text-slate-600 italic">
 <span className="font-semibold not-italic text-slate-700">Closing Note: </span>
 {report.notes}
 </div>
 )}
 </div>
 )}

 {/* Audit Signatures */}
 <div className="grid grid-cols-2 gap-8 pt-6 text-center text-[10.5px] text-slate-600">
 <div>
 <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
 Cashier Signature
 </div>
 <div>{report.cashier.name}</div>
 </div>
 <div>
 <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
 Manager / Auditor Signature
 </div>
 <div>{report.closed_by?.name || 'Verified By'}</div>
 </div>
 </div>

 <div className="text-center text-[10px] text-slate-400 pt-2">
 Generated on {report.generated_at} · PharmaCore Audit System
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
