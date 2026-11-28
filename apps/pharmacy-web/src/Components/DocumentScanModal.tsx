import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    FileText,
    FileUp,
    Loader2,
    Minus,
    Plus,
    RefreshCw,
    Search,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { StatusDot } from '@/Components/ui/StatusDot';
import { formatCurrency } from '@/lib/format';

export type ScanSaleUnit = 'piece' | 'strip' | 'box';

export interface ScannableBatch {
    id: number;
    batch_number: string;
    expiry_date?: string | null;
    quantity_available: number;
    selling_price: number;
}

export interface ScannableMedicine {
    id: number;
    name: string;
    generic_name?: string | null;
    sku: string;
    barcode?: string | null;
    dosage_form: string;
    strength?: string | null;
    unit: string;
    units_per_strip: number;
    units_per_box: number;
    requires_prescription: boolean;
    selling_price: number;
    box_selling_price?: number | null;
    available_stock: number;
    batches?: ScannableBatch[];
}

export interface ScanExtractedMeta {
    doctor_name?: string | null;
    patient_name?: string | null;
    patient_phone?: string | null;
    notes?: string | null;
}

interface ApiScanItem {
    id: string;
    detected_name: string;
    detected_dosage?: string | null;
    requested_qty: number;
    requested_unit: ScanSaleUnit;
    confidence: 'high' | 'medium' | 'low';
    status: 'matched' | 'out_of_stock' | 'alternative' | 'not_found';
    medicine: ScannableMedicine | null;
    alternatives: ScannableMedicine[];
}

interface ApiScanResponse {
    ok: boolean;
    engine: 'local_pdf' | 'gemini_ai';
    ai_configured: boolean;
    file_name: string;
    extracted: ScanExtractedMeta;
    summary: {
        total_detected: number;
        matched_in_stock: number;
        out_of_stock: number;
        unmatched: number;
    };
    warnings: string[];
    items: ApiScanItem[];
}

interface EditableScanRow {
    rowId: string;
    detectedName: string;
    detectedDosage?: string | null;
    originalRequestedQty: number;
    selected: boolean;
    medicine: ScannableMedicine | null;
    alternatives: ScannableMedicine[];
    saleUnit: ScanSaleUnit;
    quantity: number;
}

export interface DocumentScanApplyPayload {
    items: Array<{
        medicine: ScannableMedicine;
        quantity: number;
        saleUnit: ScanSaleUnit;
    }>;
    file: File | null;
    attachFile: boolean;
    extracted: ScanExtractedMeta;
}

interface DocumentScanModalProps {
    open: boolean;
    onClose: () => void;
    catalogMedicines: ScannableMedicine[];
    currency: string;
    mode?: 'order' | 'pos';
    initialFile?: File | null;
    onApply: (payload: DocumentScanApplyPayload) => void;
}

function getPackSize(med: ScannableMedicine, unit: ScanSaleUnit): number {
    if (unit === 'box') return Math.max(1, med.units_per_box || 1);
    if (unit === 'strip') return Math.max(1, med.units_per_strip || 1);
    return 1;
}

function getMaxQty(med: ScannableMedicine | null, unit: ScanSaleUnit): number {
    if (!med) return 0;
    return Math.floor(med.available_stock / getPackSize(med, unit));
}

function getUnitPrice(med: ScannableMedicine | null, unit: ScanSaleUnit): number {
    if (!med) return 0;
    if (unit === 'box') {
        if (med.box_selling_price && med.box_selling_price > 0) {
            return med.box_selling_price;
        }
        return Math.round(med.selling_price * getPackSize(med, 'box') * 100) / 100;
    }
    if (unit === 'strip') {
        return Math.round(med.selling_price * getPackSize(med, 'strip') * 100) / 100;
    }
    return med.selling_price;
}

export const DocumentScanModal: React.FC<DocumentScanModalProps> = ({
    open,
    onClose,
    catalogMedicines,
    currency,
    mode = 'order',
    initialFile = null,
    onApply,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [scanMeta, setScanMeta] = useState<{
        engine: 'local_pdf' | 'gemini_ai';
        aiConfigured: boolean;
        fileName: string;
        warnings: string[];
        extracted: ScanExtractedMeta;
    } | null>(null);
    const [rows, setRows] = useState<EditableScanRow[]>([]);
    const [attachFileAndMeta, setAttachFileAndMeta] = useState(true);
    const [pickerRowId, setPickerRowId] = useState<string | null>(null);
    const [pickerQuery, setPickerQuery] = useState('');

    useEffect(() => {
        if (!open) {
            setScanning(false);
            setErrorMsg(null);
            setPickerRowId(null);
            setPickerQuery('');
            return;
        }
        if (initialFile) {
            void runScan(initialFile, false);
        }
    }, [open, initialFile]);

    const runScan = async (file: File, forceAi = false) => {
        setUploadedFile(file);
        setScanning(true);
        setErrorMsg(null);
        setPickerRowId(null);

        try {
            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const formData = new FormData();
            formData.append('document', file);
            if (forceAi) {
                formData.append('force_ai', '1');
            }

            const res = await fetch(route('sales.scan-document'), {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                credentials: 'same-origin',
                body: formData,
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.ok) {
                const validationMsg =
                    data?.errors?.document?.[0] ||
                    data?.message ||
                    'Could not scan file. Please upload a valid PDF or image.';
                setErrorMsg(validationMsg);
                setScanMeta(null);
                setRows([]);
                return;
            }

            const resp = data as ApiScanResponse;
            setScanMeta({
                engine: resp.engine,
                aiConfigured: resp.ai_configured,
                fileName: resp.file_name,
                warnings: resp.warnings || [],
                extracted: resp.extracted || {},
            });

            const mappedRows: EditableScanRow[] = (resp.items || []).map((item) => {
                let chosenMed = item.medicine;
                if ((!chosenMed || chosenMed.available_stock <= 0) && item.alternatives?.length > 0) {
                    const inStockAlt = item.alternatives.find((a) => a.available_stock > 0);
                    if (!chosenMed && inStockAlt) {
                        chosenMed = inStockAlt;
                    }
                }

                const unit: ScanSaleUnit = item.requested_unit || 'piece';
                const maxAvail = getMaxQty(chosenMed, unit);
                const clampedQty =
                    maxAvail > 0
                        ? Math.max(1, Math.min(maxAvail, item.requested_qty || 1))
                        : Math.max(1, item.requested_qty || 1);

                return {
                    rowId: item.id,
                    detectedName: item.detected_name,
                    detectedDosage: item.detected_dosage,
                    originalRequestedQty: item.requested_qty || 1,
                    selected: Boolean(chosenMed && maxAvail > 0),
                    medicine: chosenMed,
                    alternatives: item.alternatives || [],
                    saleUnit: unit,
                    quantity: clampedQty,
                };
            });

            setRows(mappedRows);
        } catch {
            setErrorMsg('Network error while scanning document. Please try again.');
        } finally {
            setScanning(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            void runScan(file, false);
        }
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            void runScan(file, false);
        }
    };

    const assignMedicineToRow = (rowId: string, med: ScannableMedicine) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.rowId !== rowId) return r;
                const maxAvail = getMaxQty(med, r.saleUnit);
                const nextQty =
                    maxAvail > 0
                        ? Math.max(1, Math.min(maxAvail, r.originalRequestedQty))
                        : r.originalRequestedQty;
                return {
                    ...r,
                    medicine: med,
                    quantity: nextQty,
                    selected: maxAvail > 0,
                };
            })
        );
        setPickerRowId(null);
        setPickerQuery('');
    };

    const updateRowUnit = (rowId: string, unit: ScanSaleUnit) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.rowId !== rowId || !r.medicine) return r;
                const maxAvail = getMaxQty(r.medicine, unit);
                if (maxAvail <= 0) return r;
                return {
                    ...r,
                    saleUnit: unit,
                    quantity: Math.max(1, Math.min(maxAvail, r.quantity)),
                };
            })
        );
    };

    const updateRowQty = (rowId: string, nextRaw: number) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.rowId !== rowId) return r;
                const maxAvail = getMaxQty(r.medicine, r.saleUnit);
                const limit = maxAvail > 0 ? maxAvail : 999;
                const valid = Math.max(1, Math.min(limit, Number.isNaN(nextRaw) ? 1 : nextRaw));
                return { ...r, quantity: valid };
            })
        );
    };

    const toggleRowSelected = (rowId: string) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.rowId !== rowId) return r;
                if (!r.medicine || getMaxQty(r.medicine, r.saleUnit) <= 0) return r;
                return { ...r, selected: !r.selected };
            })
        );
    };

    const removeRow = (rowId: string) => {
        setRows((prev) => prev.filter((r) => r.rowId !== rowId));
    };

    const pickerMatches = useMemo(() => {
        const q = pickerQuery.trim().toLowerCase();
        if (!q) return catalogMedicines.slice(0, 10);
        return catalogMedicines
            .filter(
                (m) =>
                    m.name.toLowerCase().includes(q) ||
                    (m.generic_name ?? '').toLowerCase().includes(q) ||
                    m.sku.toLowerCase().includes(q)
            )
            .slice(0, 12);
    }, [catalogMedicines, pickerQuery]);

    const selectedRows = useMemo(
        () => rows.filter((r) => r.selected && r.medicine && getMaxQty(r.medicine, r.saleUnit) > 0),
        [rows]
    );

    const estimatedTotal = useMemo(
        () =>
            selectedRows.reduce(
                (sum, r) => sum + getUnitPrice(r.medicine, r.saleUnit) * r.quantity,
                0
            ),
        [selectedRows]
    );

    const sellableRowsCount = useMemo(
        () => rows.filter((r) => r.medicine && getMaxQty(r.medicine, r.saleUnit) > 0).length,
        [rows]
    );

    const allSellableSelected =
        sellableRowsCount > 0 && selectedRows.length === sellableRowsCount;

    const toggleAllSellable = () => {
        const nextVal = !allSellableSelected;
        setRows((prev) =>
            prev.map((r) =>
                r.medicine && getMaxQty(r.medicine, r.saleUnit) > 0
                    ? { ...r, selected: nextVal }
                    : r
            )
        );
    };

    const handleConfirmApply = () => {
        if (selectedRows.length === 0) return;
        onApply({
            items: selectedRows.map((r) => ({
                medicine: r.medicine!,
                quantity: r.quantity,
                saleUnit: r.saleUnit,
            })),
            file: uploadedFile,
            attachFile: attachFileAndMeta,
            extracted: scanMeta?.extracted ?? {},
        });
        onClose();
    };

    if (!open) return null;

    const hasResults = Boolean(scanMeta && !scanning);
    const hasDetectedMeta = Boolean(
        scanMeta?.extracted?.doctor_name ||
            scanMeta?.extracted?.patient_name ||
            scanMeta?.extracted?.patient_phone
    );

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3"
            onClick={() => !scanning && onClose()}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] shadow-2xl overflow-hidden"
            >
                {/* Compact Header */}
                <div className="flex items-center justify-between gap-2.5 px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151921] shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-[2px] bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 text-[#0E5F3F] flex items-center justify-center shrink-0">
                            <FileUp className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
                                Prescription / PDF Auto-Scan
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                Upload PDF or Rx image to auto-match medicines
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={scanning}
                        aria-label="Close scanner"
                        className="rounded-[2px] p-1 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-700 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* Compact Upload Dropzone */}
                    {(!scanMeta || scanning) && (
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => !scanning && fileInputRef.current?.click()}
                            className={`rounded-[2px] border border-dashed px-6 py-9 text-center transition-colors ${
                                scanning
                                    ? 'border-[#0E5F3F]/40 bg-[#F8FAF8] dark:bg-[#151921] cursor-wait'
                                    : isDragging
                                      ? 'border-[#0E5F3F] bg-[#EAF5F0]/60 dark:bg-emerald-950/20 cursor-copy'
                                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/40 dark:bg-[#151921]/60 hover:border-[#0E5F3F] hover:bg-[#EAF5F0]/25 cursor-pointer'
                            }`}
                        >
                            {scanning ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-1">
                                    <Loader2 className="h-6 w-6 text-[#0E5F3F] animate-spin" />
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                            Scanning & matching stock...
                                        </p>
                                        <p className="text-[11px] text-slate-400 truncate max-w-[260px] mx-auto mt-0.5">
                                            {uploadedFile?.name}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <div className="h-9 w-9 rounded-full bg-[#EAF5F0] dark:bg-[#0E5F3F]/20 border border-[#0E5F3F]/20 flex items-center justify-center text-[#0E5F3F]">
                                        <FileUp className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                            Drop PDF / Rx image here or click to browse
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            PDF, JPG, PNG, WEBP · Max 10 MB
                                        </p>
                                    </div>
                                    <span className="mt-0.5 inline-flex items-center gap-1 h-7 px-3 rounded-[2px] bg-[#0E5F3F] text-white text-[11.5px] font-semibold">
                                        <FileUp className="h-3 w-3" />
                                        Select File
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {errorMsg && (
                        <div className="flex items-center gap-2 rounded-[2px] border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30 px-3 py-2 text-[11.5px] font-medium text-rose-700 dark:text-rose-300">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Compact Scan Results */}
                    {hasResults && scanMeta && (
                        <>
                            {/* Slim File Summary Strip */}
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151921] px-2.5 py-1.5 text-[11.5px]">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <FileText className="h-3.5 w-3.5 text-[#0E5F3F] shrink-0" />
                                    <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[170px]">
                                        {scanMeta.fileName}
                                    </span>
                                    <span className="rounded-[2px] bg-[#EAF5F0] dark:bg-emerald-950/40 px-1.5 py-0.2 text-[10px] font-semibold text-[#0E5F3F] dark:text-emerald-300">
                                        {scanMeta.engine === 'gemini_ai' ? 'AI Vision' : 'PDF Text'}
                                    </span>
                                    <span className="text-slate-500">
                                        · Ready: <strong className="text-[#0E5F3F]">{sellableRowsCount}</strong>/{rows.length}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {scanMeta.aiConfigured &&
                                        scanMeta.engine === 'local_pdf' &&
                                        uploadedFile && (
                                            <button
                                                type="button"
                                                onClick={() => void runScan(uploadedFile, true)}
                                                className="inline-flex items-center gap-1 h-6 px-2 rounded-[2px] border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold hover:bg-indigo-100 cursor-pointer"
                                            >
                                                <Sparkles className="h-3 w-3" />
                                                AI Scan
                                            </button>
                                        )}
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="inline-flex items-center gap-1 h-6 px-2 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-slate-700 dark:text-slate-200 text-[11px] font-medium hover:border-[#0E5F3F] hover:text-[#0E5F3F] cursor-pointer"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Change File
                                    </button>
                                </div>
                            </div>

                            {scanMeta.warnings.map((w, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 rounded-[2px] border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-200"
                                >
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                                    <span>{w}</span>
                                </div>
                            ))}

                            {/* Slim Rx Attach & Metadata Bar */}
                            {(hasDetectedMeta || mode === 'order') && (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] border border-slate-200/80 dark:border-slate-800 bg-[#F8FAF8] dark:bg-[#161b23] px-2.5 py-1.5 text-[11px]">
                                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-200">
                                        <input
                                            type="checkbox"
                                            checked={attachFileAndMeta}
                                            onChange={(e) => setAttachFileAndMeta(e.target.checked)}
                                            className="table-checkbox"
                                        />
                                        <span>
                                            {mode === 'order'
                                                ? 'Attach file & Rx info to order'
                                                : 'Apply detected Rx / patient info'}
                                        </span>
                                    </label>
                                    {hasDetectedMeta && (
                                        <div className="flex flex-wrap items-center gap-2 text-slate-500">
                                            {scanMeta.extracted.doctor_name && (
                                                <span>
                                                    Dr: <strong className="text-slate-700 dark:text-slate-200">{scanMeta.extracted.doctor_name}</strong>
                                                </span>
                                            )}
                                            {scanMeta.extracted.patient_name && (
                                                <span>
                                                    Pt: <strong className="text-slate-700 dark:text-slate-200">{scanMeta.extracted.patient_name}</strong>
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Compact Fixed-Width Item List */}
                            {rows.length > 0 && (
                                <div className="rounded-[2px] border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#F8FAFC] dark:bg-[#161a22] border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={allSellableSelected}
                                                onChange={toggleAllSellable}
                                                disabled={sellableRowsCount === 0}
                                                className="table-checkbox cursor-pointer"
                                            />
                                            <span>Select All ({sellableRowsCount})</span>
                                        </label>
                                        <span>Unit & Qty</span>
                                    </div>

                                    <div className="max-h-[54vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                        {rows.map((row) => {
                                            const med = row.medicine;
                                            const maxAvail = getMaxQty(med, row.saleUnit);
                                            const inStock = Boolean(med && maxAvail > 0);
                                            const unitPrice = getUnitPrice(med, row.saleUnit);
                                            const lineTotal =
                                                Math.round(unitPrice * row.quantity * 100) / 100;
                                            const isPickerOpen = pickerRowId === row.rowId;

                                            return (
                                                <div
                                                    key={row.rowId}
                                                    className={`px-2.5 py-2 space-y-1.5 text-xs ${
                                                        row.selected && inStock
                                                            ? 'bg-[#EAF5F0]/40 dark:bg-[#0E5F3F]/10'
                                                            : 'bg-white dark:bg-[#12161c]'
                                                    }`}
                                                >
                                                    {/* Top row: Checkbox + Medicine Name + Stock + Total + Delete */}
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={row.selected && inStock}
                                                                disabled={!inStock}
                                                                onChange={() =>
                                                                    toggleRowSelected(row.rowId)
                                                                }
                                                                className="table-checkbox cursor-pointer disabled:opacity-40 shrink-0"
                                                            />
                                                            {med ? (
                                                                <div className="flex items-center gap-1 min-w-0">
                                                                    <CheckCircle2
                                                                        className={`h-3.5 w-3.5 shrink-0 ${
                                                                            inStock
                                                                                ? 'text-[#0E5F3F]'
                                                                                : 'text-amber-500'
                                                                        }`}
                                                                    />
                                                                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                                        {med.name}
                                                                    </span>
                                                                    {med.strength && (
                                                                        <span className="text-[10.5px] text-slate-500 shrink-0">
                                                                            {med.strength}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[11.5px] text-rose-600 dark:text-rose-400 font-semibold">
                                                                    Not matched in stock
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {med &&
                                                                (med.available_stock <= 0 ? (
                                                                    <StatusDot variant="rose">Out</StatusDot>
                                                                ) : (
                                                                    <span className="text-[10.5px] text-slate-500 tabular-nums">
                                                                        Stk: {med.available_stock}
                                                                    </span>
                                                                ))}
                                                            {med && (
                                                                <span className="text-[11.5px] font-bold tabular-nums text-slate-900 dark:text-slate-100">
                                                                    {formatCurrency(lineTotal, currency)}
                                                                </span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => removeRow(row.rowId)}
                                                                className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                                                                title="Remove"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Bottom row: Detected PDF text + Change button | Unit + Qty Stepper */}
                                                    <div className="flex items-center justify-between gap-2 pl-5">
                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                            <span
                                                                className="text-[10.5px] text-slate-400 truncate"
                                                                title={row.detectedName}
                                                            >
                                                                {row.detectedName}
                                                                {row.detectedDosage
                                                                    ? ` · ${row.detectedDosage}`
                                                                    : ''}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setPickerRowId(
                                                                        isPickerOpen ? null : row.rowId
                                                                    );
                                                                    setPickerQuery('');
                                                                }}
                                                                className="text-[10.5px] text-[#0E5F3F] dark:text-emerald-400 font-semibold hover:underline shrink-0 cursor-pointer"
                                                            >
                                                                {isPickerOpen
                                                                    ? 'Close'
                                                                    : med
                                                                      ? 'Change'
                                                                      : 'Pick'}
                                                            </button>
                                                        </div>

                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <select
                                                                disabled={!med}
                                                                value={row.saleUnit}
                                                                onChange={(e) =>
                                                                    updateRowUnit(
                                                                        row.rowId,
                                                                        e.target.value as ScanSaleUnit
                                                                    )
                                                                }
                                                                className="h-5 rounded-[2px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] px-1 text-[10.5px] font-medium focus:border-[#0E5F3F] focus:outline-none disabled:opacity-40"
                                                            >
                                                                <option value="piece">Pc</option>
                                                                {med && med.units_per_strip > 1 && (
                                                                    <option value="strip">
                                                                        Strip ({med.units_per_strip})
                                                                    </option>
                                                                )}
                                                                {med && med.units_per_box > 1 && (
                                                                    <option value="box">
                                                                        Box ({med.units_per_box})
                                                                    </option>
                                                                )}
                                                            </select>

                                                            <div className="inline-flex items-center gap-0.5">
                                                                <button
                                                                    type="button"
                                                                    disabled={!inStock || row.quantity <= 1}
                                                                    onClick={() =>
                                                                        updateRowQty(
                                                                            row.rowId,
                                                                            row.quantity - 1
                                                                        )
                                                                    }
                                                                    className="h-5 w-5 rounded-[2px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] flex items-center justify-center hover:border-[#0E5F3F] disabled:opacity-40 cursor-pointer"
                                                                >
                                                                    <Minus className="h-2.5 w-2.5" />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    max={maxAvail > 0 ? maxAvail : 999}
                                                                    disabled={!inStock}
                                                                    value={row.quantity}
                                                                    onChange={(e) =>
                                                                        updateRowQty(
                                                                            row.rowId,
                                                                            parseInt(e.target.value, 10)
                                                                        )
                                                                    }
                                                                    className="h-5 w-9 rounded-[2px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-center text-[11px] font-bold tabular-nums focus:border-[#0E5F3F] focus:outline-none disabled:opacity-40"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        !inStock || row.quantity >= maxAvail
                                                                    }
                                                                    onClick={() =>
                                                                        updateRowQty(
                                                                            row.rowId,
                                                                            row.quantity + 1
                                                                        )
                                                                    }
                                                                    className="h-5 w-5 rounded-[2px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] flex items-center justify-center hover:border-[#0E5F3F] disabled:opacity-40 cursor-pointer"
                                                                >
                                                                    <Plus className="h-2.5 w-2.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Inline Picker */}
                                                    {isPickerOpen && (
                                                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5 pl-5">
                                                            {row.alternatives.length > 0 && (
                                                                <div className="flex flex-wrap items-center gap-1">
                                                                    <span className="text-[10px] font-semibold text-slate-500">
                                                                        Alt:
                                                                    </span>
                                                                    {row.alternatives.map((alt) => (
                                                                        <button
                                                                            key={alt.id}
                                                                            type="button"
                                                                            onClick={() =>
                                                                                assignMedicineToRow(
                                                                                    row.rowId,
                                                                                    alt
                                                                                )
                                                                            }
                                                                            className="px-1.5 py-0.5 rounded-[2px] border border-[#0E5F3F]/30 bg-slate-50 dark:bg-[#181d25] text-[10.5px] font-medium hover:border-[#0E5F3F] cursor-pointer"
                                                                        >
                                                                            {alt.name} ({alt.available_stock})
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-1.5">
                                                                <Search className="h-3 w-3 text-slate-400 shrink-0" />
                                                                <input
                                                                    type="text"
                                                                    value={pickerQuery}
                                                                    onChange={(e) =>
                                                                        setPickerQuery(e.target.value)
                                                                    }
                                                                    placeholder="Search medicine..."
                                                                    className="h-6 flex-1 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] px-2 text-[11px] focus:border-[#0E5F3F] focus:outline-none"
                                                                />
                                                            </div>
                                                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                                                {pickerMatches.map((m) => (
                                                                    <button
                                                                        key={m.id}
                                                                        type="button"
                                                                        onClick={() =>
                                                                            assignMedicineToRow(row.rowId, m)
                                                                        }
                                                                        className="px-1.5 py-0.5 rounded-[2px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#181d25] hover:border-[#0E5F3F] text-[10.5px] cursor-pointer"
                                                                    >
                                                                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                                                                            {m.name}
                                                                        </span>{' '}
                                                                        <span
                                                                            className={
                                                                                m.available_stock > 0
                                                                                    ? 'text-[#0E5F3F]'
                                                                                    : 'text-rose-500'
                                                                            }
                                                                        >
                                                                            ({m.available_stock})
                                                                        </span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Compact Footer */}
                <div className="px-4 py-2.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151921] flex items-center justify-between gap-2 shrink-0">
                    <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
                        {selectedRows.length > 0 ? (
                            <>
                                <strong className="text-slate-800 dark:text-slate-100">
                                    {selectedRows.length} selected
                                </strong>{' '}
                                ·{' '}
                                <strong className="text-[#0E5F3F]">
                                    {formatCurrency(estimatedTotal, currency)}
                                </strong>
                            </>
                        ) : (
                            <span>No items selected</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-7 px-3 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={selectedRows.length === 0 || scanning}
                            onClick={handleConfirmApply}
                            className="h-7 px-3.5 text-[11.5px] font-semibold"
                        >
                            {mode === 'order'
                                ? `Add to Order (${selectedRows.length})`
                                : `Add to Bill (${selectedRows.length})`}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
