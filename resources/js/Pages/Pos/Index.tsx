import React, { useEffect, useMemo, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera,
    Check,
    Minus,
    Plus,
    Receipt,
    ScanBarcode,
    ShoppingCart,
    Trash2,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    BarcodeCameraModal,
    BarcodeScanFeedback,
} from '@/Components/BarcodeCameraModal';
import { BarcodeSvg } from '@/Components/BarcodeSvg';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { StatusDot } from '@/Components/ui/StatusDot';
import { SharedPageProps } from '@/types';
import { formatCurrency } from '@/lib/format';

interface PosMedicine {
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
}

type SaleUnit = 'piece' | 'strip' | 'box';

interface CrmCustomer {
    id: number;
    name: string;
    phone?: string | null;
    loyalty_points: number;
    allergies?: string | null;
}

interface CartItem {
    medicine: PosMedicine;
    qty: number;
    saleUnit: SaleUnit;
}

function getPackSize(med: PosMedicine, unit: SaleUnit): number {
    if (unit === 'box') return Math.max(1, med.units_per_box || 1);
    if (unit === 'strip') return Math.max(1, med.units_per_strip || 1);
    return 1;
}

function getPackUnitPrice(med: PosMedicine, unit: SaleUnit): number {
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

function getMaxSelectableQty(med: PosMedicine, unit: SaleUnit): number {
    return Math.floor(med.available_stock / getPackSize(med, unit));
}

interface PosProps {
    medicines: PosMedicine[];
    customers?: CrmCustomer[];
    branchName?: string | null;
}

type CatalogFilter = 'all' | 'in_stock' | 'rx';

const paymentOptions = [
    { id: 'cash', value: 'cash', name: 'Cash Counter' },
    { id: 'card', value: 'card', name: 'Debit / Credit Card' },
    { id: 'bkash', value: 'bkash', name: 'bKash / Mobile Wallet' },
];

function CartQtyInput({
    qty,
    max,
    name,
    onChangeQty,
}: {
    qty: number;
    max: number;
    name: string;
    onChangeQty: (nextQty: number) => void;
}) {
    const [draft, setDraft] = useState(String(qty));

    useEffect(() => {
        setDraft(String(qty));
    }, [qty]);

    const commitDraft = () => {
        const parsed = parseInt(draft, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
            setDraft('1');
            onChangeQty(1);
            return;
        }
        const clamped = Math.min(max, parsed);
        setDraft(String(clamped));
        onChangeQty(clamped);
    };

    return (
        <input
            type="number"
            min={1}
            max={max}
            value={draft}
            aria-label={`${name} quantity`}
            onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                const parsed = parseInt(raw, 10);
                if (!Number.isNaN(parsed) && parsed >= 1) {
                    onChangeQty(Math.min(max, parsed));
                }
            }}
            onBlur={commitDraft}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commitDraft();
                    (e.currentTarget as HTMLInputElement).blur();
                }
            }}
            onFocus={(e) => e.currentTarget.select()}
            className="h-6 w-11 rounded-[3px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] px-1 text-center text-[11.5px] font-bold tabular-nums text-slate-900 dark:text-slate-100 focus:border-[#FF4A1F] focus:outline-none"
        />
    );
}

export default function PosIndex({
    medicines,
    customers = [],
    branchName,
}: PosProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const currency = tenant?.currentTenant?.currency_code ?? 'BDT';

    const [query, setQuery] = useState('');
    const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerId, setCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('Walk-in Customer');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [discount, setDiscount] = useState('0');
    const [processing, setProcessing] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanStatus, setScanStatus] = useState<BarcodeScanFeedback | null>(
        null
    );
    const scanInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        scanInputRef.current?.focus({ preventScroll: true });
    }, []);

    useEffect(() => {
        if (!scanStatus) return;
        const timer = window.setTimeout(() => setScanStatus(null), 3500);
        return () => window.clearTimeout(timer);
    }, [scanStatus]);

    useEffect(() => {
        if (cameraOpen) return;

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const tagName = target?.tagName;
            const isEditable =
                tagName === 'INPUT' ||
                tagName === 'TEXTAREA' ||
                tagName === 'SELECT' ||
                Boolean(target?.isContentEditable);

            if (e.key === 'F2' || (!isEditable && e.key === '/')) {
                e.preventDefault();
                scanInputRef.current?.focus();
                scanInputRef.current?.select();
                return;
            }

            // Capture USB/Bluetooth keyboard-wedge barcode scans even if focus sits on a button
            if (
                !isEditable &&
                e.key.length === 1 &&
                e.key !== ' ' &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.altKey
            ) {
                e.preventDefault();
                scanInputRef.current?.focus();
                setQuery((prev) => prev + e.key);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [cameraOpen]);

    const selectedCustomer = useMemo(
        () => customers.find((c) => String(c.id) === String(customerId)) ?? null,
        [customers, customerId]
    );

    const customerOptions = useMemo(
        () => [
            { id: 'walkin', value: '', name: 'Walk-in Customer' },
            ...customers.map((c) => ({
                id: c.id,
                value: String(c.id),
                name: `${c.name}${c.phone ? ` (${c.phone})` : ''}`,
                subtitle: `${c.loyalty_points} loyalty pts`,
            })),
        ],
        [customers]
    );

    const cartById = useMemo(() => {
        const map = new Map<number, CartItem>();
        for (const item of cart) {
            map.set(item.medicine.id, item);
        }
        return map;
    }, [cart]);

    const filteredMedicines = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return medicines.filter((m) => {
            if (catalogFilter === 'in_stock' && m.available_stock <= 0) {
                return false;
            }
            if (catalogFilter === 'rx' && !m.requires_prescription) {
                return false;
            }
            if (!needle) return true;
            return (
                m.name.toLowerCase().includes(needle) ||
                (m.generic_name ?? '').toLowerCase().includes(needle) ||
                m.sku.toLowerCase().includes(needle) ||
                (m.barcode ?? '').toLowerCase().includes(needle)
            );
        });
    }, [medicines, query, catalogFilter]);

    const addToCart = (med: PosMedicine) => {
        if (med.available_stock <= 0) return;
        setCart((prev) => {
            const existing = prev.find((c) => c.medicine.id === med.id);
            if (existing) {
                const maxQty = getMaxSelectableQty(med, existing.saleUnit);
                if (existing.qty >= maxQty) return prev;
                return prev.map((c) =>
                    c.medicine.id === med.id ? { ...c, qty: c.qty + 1 } : c
                );
            }
            return [...prev, { medicine: med, qty: 1, saleUnit: 'piece' }];
        });
    };

    const updateQty = (id: number, delta: number) => {
        setCart((prev) =>
            prev
                .map((item) => {
                    if (item.medicine.id !== id) return item;
                    const maxQty = getMaxSelectableQty(
                        item.medicine,
                        item.saleUnit
                    );
                    const nextQty = Math.min(maxQty, item.qty + delta);
                    return nextQty <= 0 ? null : { ...item, qty: nextQty };
                })
                .filter((x): x is CartItem => x !== null)
        );
    };

    const setItemQty = (id: number, exactQty: number) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.medicine.id !== id) return item;
                const maxQty = getMaxSelectableQty(
                    item.medicine,
                    item.saleUnit
                );
                const clamped = Math.max(1, Math.min(maxQty, exactQty));
                return { ...item, qty: clamped };
            })
        );
    };

    const setItemSaleUnit = (id: number, nextUnit: SaleUnit) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.medicine.id !== id) return item;
                const maxQty = getMaxSelectableQty(item.medicine, nextUnit);
                if (maxQty <= 0) return item;
                return {
                    ...item,
                    saleUnit: nextUnit,
                    qty: Math.max(1, Math.min(item.qty, maxQty)),
                };
            })
        );
    };

    const commitScannedItem = (med: PosMedicine): BarcodeScanFeedback => {
        if (med.available_stock <= 0) {
            const feedback: BarcodeScanFeedback = {
                ok: false,
                tone: 'warning',
                message: `${med.name} (${med.sku}) is out of stock.`,
            };
            setScanStatus(feedback);
            setQuery('');
            return feedback;
        }

        const existingItem = cartById.get(med.id);
        const activeUnit: SaleUnit = existingItem?.saleUnit ?? 'piece';
        const maxQty = getMaxSelectableQty(med, activeUnit);
        if (existingItem && existingItem.qty >= maxQty) {
            const feedback: BarcodeScanFeedback = {
                ok: false,
                tone: 'warning',
                message: `Max stock reached for ${med.name} (${med.available_stock} ${med.unit}).`,
            };
            setScanStatus(feedback);
            setQuery('');
            return feedback;
        }

        addToCart(med);
        const feedback: BarcodeScanFeedback = {
            ok: true,
            tone: 'success',
            message: `Scanned: ${med.name} (${med.barcode || med.sku})`,
        };
        setScanStatus(feedback);
        setQuery('');
        return feedback;
    };

    const processScannedCode = (
        rawCode: string,
        allowSingleFilteredMatch = false
    ): BarcodeScanFeedback | void => {
        const trimmed = rawCode.trim();
        const needle = trimmed.toLowerCase();
        if (!needle) return;

        const exactMatch = medicines.find(
            (m) =>
                (m.barcode && m.barcode.toLowerCase() === needle) ||
                m.sku.toLowerCase() === needle
        );
        if (exactMatch) {
            return commitScannedItem(exactMatch);
        }

        if (allowSingleFilteredMatch) {
            const availableMatches = filteredMedicines.filter(
                (m) => m.available_stock > 0
            );
            if (availableMatches.length === 1) {
                return commitScannedItem(availableMatches[0]);
            }
            if (filteredMedicines.length > 0) {
                return;
            }
        }

        const notFound: BarcodeScanFeedback = {
            ok: false,
            tone: 'error',
            message: `No medicine matched barcode or SKU "${trimmed}".`,
        };
        setScanStatus(notFound);
        setQuery('');
        return notFound;
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        processScannedCode(query, true);
    };

    const totalUnits = cart.reduce(
        (sum, item) => sum + item.qty * getPackSize(item.medicine, item.saleUnit),
        0
    );
    const subtotal = cart.reduce(
        (sum, item) =>
            sum + getPackUnitPrice(item.medicine, item.saleUnit) * item.qty,
        0
    );
    const discountAmount = Math.max(
        0,
        Math.min(subtotal, Number(discount) || 0)
    );
    const grandTotal = Math.max(0, subtotal - discountAmount);

    const handleCompleteCheckout = (e: React.FormEvent) => {
        e.preventDefault();
        if (cart.length === 0) return;

        setProcessing(true);
        router.post(
            route('pos.checkout'),
            {
                customer_id: customerId ? Number(customerId) : null,
                customer_name: selectedCustomer?.name ?? customerName,
                payment_method: paymentMethod,
                discount: discountAmount,
                items: cart.map((c) => ({
                    medicine_id: c.medicine.id,
                    quantity: c.qty,
                    sale_unit: c.saleUnit,
                })),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCart([]);
                    setDiscount('0');
                    setScanStatus(null);
                    scanInputRef.current?.focus({ preventScroll: true });
                },
                onFinish: () => setProcessing(false),
            }
        );
    };

    return (
        <AppLayout
            title="Point of Sale"
            subtitle={`${branchName ?? 'Active Branch'} · Compact list terminal & FEFO checkout`}
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left Catalog List */}
                <div className="lg:col-span-7 xl:col-span-8 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151921] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <div className="flex-1 min-w-0">
                                <Input
                                    ref={scanInputRef}
                                    placeholder="Scan barcode or SKU (F2), or search medicine... (Enter)"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    icon={
                                        <ScanBarcode className="h-3.5 w-3.5 text-[#FF4A1F]" />
                                    }
                                    rightIcon={
                                        !query ? (
                                            <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                                                F2
                                            </kbd>
                                        ) : undefined
                                    }
                                    className="h-8 text-[12.5px]"
                                />
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setCameraOpen(true)}
                                title="Scan barcode using camera or image"
                                className="h-8 px-2.5 shrink-0 text-[11.5px] font-semibold"
                            >
                                <Camera className="h-3.5 w-3.5 text-[#FF4A1F]" />
                                <span className="hidden md:inline">Camera</span>
                            </Button>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
                            {(
                                [
                                    { key: 'all', label: 'All' },
                                    { key: 'in_stock', label: 'In Stock' },
                                    { key: 'rx', label: 'Rx Only' },
                                ] as const
                            ).map((tab) => {
                                const active = catalogFilter === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() =>
                                            setCatalogFilter(tab.key)
                                        }
                                        className={`h-7 px-2.5 rounded-[3px] text-[11.5px] font-semibold transition-colors cursor-pointer ${
                                            active
                                                ? 'bg-[#FF4A1F] text-white'
                                                : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-slate-600 dark:text-slate-300 hover:border-slate-300'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                            <span className="ml-1 text-[11px] font-medium text-slate-400 tabular-nums">
                                {filteredMedicines.length} SKUs
                            </span>
                        </div>
                    </div>

                    {scanStatus && (
                        <div
                            className={`px-3 py-1.5 border-b text-[11.5px] font-medium flex items-center justify-between gap-2 ${
                                scanStatus.tone === 'success'
                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                                    : scanStatus.tone === 'warning'
                                      ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
                                      : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
                            }`}
                        >
                            <span>{scanStatus.message}</span>
                            <button
                                type="button"
                                onClick={() => setScanStatus(null)}
                                className="text-[11px] opacity-70 hover:opacity-100 cursor-pointer"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-[#151921] border-b border-slate-200/90 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap select-none">
                                    <th className="px-2.5 py-1.5">SKU</th>
                                    <th className="px-2.5 py-1.5">Barcode</th>
                                    <th className="px-2.5 py-1.5">Medicine</th>
                                    <th className="px-2.5 py-1.5">Generic</th>
                                    <th className="px-2.5 py-1.5 text-right">
                                        Stock
                                    </th>
                                    <th className="px-2.5 py-1.5 text-right">
                                        Price
                                    </th>
                                    <th className="px-2.5 py-1.5 text-right w-[108px]">
                                        Cart
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                                {filteredMedicines.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-10 text-center text-xs text-slate-400"
                                        >
                                            No medicines match "{query}".
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMedicines.map((med) => {
                                        const outOfStock =
                                            med.available_stock <= 0;
                                        const cartItem = cartById.get(med.id);
                                        const cartQty = cartItem?.qty ?? 0;
                                        const activeUnit: SaleUnit =
                                            cartItem?.saleUnit ?? 'piece';
                                        const maxUnitQty = getMaxSelectableQty(
                                            med,
                                            activeUnit
                                        );

                                        return (
                                            <tr
                                                key={med.id}
                                                className={`min-h-[36px] transition-colors ${
                                                    outOfStock
                                                        ? 'opacity-55 bg-slate-50/30 dark:bg-slate-900/20'
                                                        : cartQty > 0
                                                          ? 'bg-orange-50/40 dark:bg-[#ff4a1f]/10'
                                                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                                                }`}
                                            >
                                                <td className="px-2.5 py-1.5 font-mono text-[11.5px] font-bold text-[#FF4A1F] whitespace-nowrap">
                                                    {med.sku}
                                                </td>
                                                <td className="px-2.5 py-1 whitespace-nowrap">
                                                    <BarcodeSvg
                                                        value={med.barcode}
                                                        compact
                                                    />
                                                </td>
                                                <td className="px-2.5 py-1.5 text-[12.5px] whitespace-nowrap">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                            {med.name}
                                                        </span>
                                                        {med.strength && (
                                                            <span className="text-[11px] text-slate-400">
                                                                {med.strength}
                                                            </span>
                                                        )}
                                                        {med.requires_prescription && (
                                                            <span className="text-[10.5px] font-bold text-[#FF4A1F]">
                                                                Rx
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2.5 py-1.5 text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                    <span
                                                        className="block max-w-[170px] truncate"
                                                        title={
                                                            med.generic_name ||
                                                            med.dosage_form
                                                        }
                                                    >
                                                        {med.generic_name ||
                                                            med.dosage_form}
                                                    </span>
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right text-[12px] whitespace-nowrap">
                                                    {outOfStock ? (
                                                        <StatusDot variant="rose">
                                                            Out
                                                        </StatusDot>
                                                    ) : (
                                                        <span
                                                            className={`font-semibold tabular-nums ${
                                                                med.available_stock <=
                                                                20
                                                                    ? 'text-amber-600 dark:text-amber-400'
                                                                    : 'text-slate-700 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            {
                                                                med.available_stock
                                                            }{' '}
                                                            {med.unit}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right text-[12.5px] font-bold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                    <div>
                                                        {formatCurrency(
                                                            med.selling_price,
                                                            currency
                                                        )}
                                                    </div>
                                                    {med.units_per_box > 1 &&
                                                        med.box_selling_price && (
                                                            <div className="text-[10.5px] font-normal text-slate-400">
                                                                Box:{' '}
                                                                {formatCurrency(
                                                                    med.box_selling_price,
                                                                    currency
                                                                )}
                                                            </div>
                                                        )}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                                                    {cartQty > 0 ? (
                                                        <div className="inline-flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    updateQty(
                                                                        med.id,
                                                                        -1
                                                                    )
                                                                }
                                                                aria-label={`Decrease ${med.name} quantity`}
                                                                className="h-6 w-6 rounded-[3px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] flex items-center justify-center hover:border-[#FF4A1F]/60 cursor-pointer"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </button>
                                                            <span className="w-6 text-center text-[12px] font-bold tabular-nums text-[#FF4A1F]">
                                                                {cartQty}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    cartQty >=
                                                                    maxUnitQty
                                                                }
                                                                onClick={() =>
                                                                    updateQty(
                                                                        med.id,
                                                                        1
                                                                    )
                                                                }
                                                                aria-label={`Increase ${med.name} quantity`}
                                                                className="h-6 w-6 rounded-[3px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] flex items-center justify-center hover:border-[#FF4A1F]/60 disabled:opacity-40 cursor-pointer"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={
                                                                outOfStock
                                                                    ? 'outline'
                                                                    : 'primary'
                                                            }
                                                            disabled={
                                                                outOfStock
                                                            }
                                                            onClick={() =>
                                                                addToCart(med)
                                                            }
                                                            className="h-7 px-2.5 text-[11.5px]"
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                            Add
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Order Register */}
                <div className="lg:col-span-5 xl:col-span-4 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] sticky top-16 overflow-hidden">
                    <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#151921]">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-[#FF4A1F]" />
                            <h2 className="text-[13px] font-bold text-slate-900 dark:text-slate-100">
                                Order Register
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                                {totalUnits} pcs ({cart.length} lines)
                            </span>
                            {cart.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setCart([])}
                                    className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleCompleteCheckout}>
                        <div className="p-3.5 space-y-2.5 border-b border-slate-100 dark:border-slate-800">
                            <Select
                                label="Customer"
                                size="sm"
                                value={customerId}
                                options={customerOptions}
                                onChange={(e) => {
                                    const val = String(e.target.value);
                                    setCustomerId(val);
                                    const found = customers.find(
                                        (c) => String(c.id) === val
                                    );
                                    if (found) {
                                        setCustomerName(found.name);
                                    }
                                }}
                            />

                            {!customerId && (
                                <Input
                                    label="Walk-in Name"
                                    value={customerName}
                                    onChange={(e) =>
                                        setCustomerName(e.target.value)
                                    }
                                    placeholder="Walk-in Customer"
                                />
                            )}

                            {selectedCustomer?.allergies && (
                                <div className="flex items-center gap-2 rounded-[3px] border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    Allergy Note: {selectedCustomer.allergies}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2.5">
                                <Select
                                    label="Payment"
                                    size="sm"
                                    value={paymentMethod}
                                    options={paymentOptions}
                                    onChange={(e) =>
                                        setPaymentMethod(String(e.target.value))
                                    }
                                />
                                <Input
                                    label="Discount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={discount}
                                    onChange={(e) =>
                                        setDiscount(e.target.value)
                                    }
                                />
                            </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                            {cart.length === 0 ? (
                                <div className="px-4 py-8 text-center text-xs text-slate-400">
                                    Select medicines from the list to add items
                                    to this order.
                                </div>
                            ) : (
                                cart.map(({ medicine, qty, saleUnit }) => {
                                    const packSize = getPackSize(
                                        medicine,
                                        saleUnit
                                    );
                                    const packUnitPrice = getPackUnitPrice(
                                        medicine,
                                        saleUnit
                                    );
                                    const maxQty = getMaxSelectableQty(
                                        medicine,
                                        saleUnit
                                    );
                                    return (
                                        <div
                                            key={medicine.id}
                                            className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                    {medicine.name}
                                                </div>
                                                <div className="text-[11px] text-slate-400 tabular-nums">
                                                    {formatCurrency(
                                                        packUnitPrice,
                                                        currency
                                                    )}{' '}
                                                    × {qty}{' '}
                                                    {saleUnit === 'piece'
                                                        ? medicine.unit
                                                        : saleUnit === 'strip'
                                                          ? `strip (${packSize} pcs)`
                                                          : `box (${packSize} pcs)`}
                                                    {saleUnit !== 'piece' && (
                                                        <span className="ml-1 text-slate-500 dark:text-slate-400">
                                                            = {qty * packSize}{' '}
                                                            pcs
                                                        </span>
                                                    )}
                                                </div>
                                                {(medicine.units_per_strip >
                                                    1 ||
                                                    medicine.units_per_box >
                                                        1) && (
                                                    <div className="mt-1 inline-flex items-center rounded-[3px] border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                                                        {(
                                                            [
                                                                'piece',
                                                                'strip',
                                                                'box',
                                                            ] as SaleUnit[]
                                                        )
                                                            .filter(
                                                                (u) =>
                                                                    u ===
                                                                        'piece' ||
                                                                    (u ===
                                                                        'strip' &&
                                                                        medicine.units_per_strip >
                                                                            1) ||
                                                                    (u ===
                                                                        'box' &&
                                                                        medicine.units_per_box >
                                                                            1)
                                                            )
                                                            .map((u) => {
                                                                const uMax =
                                                                    getMaxSelectableQty(
                                                                        medicine,
                                                                        u
                                                                    );
                                                                const active =
                                                                    saleUnit ===
                                                                    u;
                                                                const label =
                                                                    u ===
                                                                    'piece'
                                                                        ? 'Pc'
                                                                        : u ===
                                                                            'strip'
                                                                          ? `Strip (${medicine.units_per_strip})`
                                                                          : `Box (${medicine.units_per_box})`;
                                                                return (
                                                                    <button
                                                                        key={u}
                                                                        type="button"
                                                                        disabled={
                                                                            uMax <=
                                                                            0
                                                                        }
                                                                        onClick={() =>
                                                                            setItemSaleUnit(
                                                                                medicine.id,
                                                                                u
                                                                            )
                                                                        }
                                                                        className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                                                            active
                                                                                ? 'bg-[#FF4A1F] text-white'
                                                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/60'
                                                                        }`}
                                                                    >
                                                                        {label}
                                                                    </button>
                                                                );
                                                            })}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            updateQty(
                                                                medicine.id,
                                                                -1
                                                            )
                                                        }
                                                        className="h-6 w-6 rounded-[3px] border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <CartQtyInput
                                                        qty={qty}
                                                        max={maxQty}
                                                        name={medicine.name}
                                                        onChangeQty={(
                                                            nextQty
                                                        ) =>
                                                            setItemQty(
                                                                medicine.id,
                                                                nextQty
                                                            )
                                                        }
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={qty >= maxQty}
                                                        onClick={() =>
                                                            updateQty(
                                                                medicine.id,
                                                                1
                                                            )
                                                        }
                                                        className="h-6 w-6 rounded-[3px] border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>

                                                <span className="w-16 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                                                    {formatCurrency(
                                                        packUnitPrice * qty,
                                                        currency
                                                    )}
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        updateQty(
                                                            medicine.id,
                                                            -qty
                                                        )
                                                    }
                                                    aria-label={`Remove ${medicine.name}`}
                                                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="p-3.5 bg-slate-50/50 dark:bg-[#151921] border-t border-slate-200/80 dark:border-slate-800 space-y-3">
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between text-slate-500">
                                    <span>Subtotal</span>
                                    <span className="font-semibold tabular-nums">
                                        {formatCurrency(subtotal, currency)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                    <span>Discount</span>
                                    <span className="font-semibold tabular-nums">
                                        -
                                        {formatCurrency(
                                            discountAmount,
                                            currency
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200/80 dark:border-slate-700/80 pt-2 text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                    <span>Total Payable</span>
                                    <span className="text-[#FF4A1F] tabular-nums">
                                        {formatCurrency(grandTotal, currency)}
                                    </span>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                fullWidth
                                isLoading={processing}
                                disabled={cart.length === 0}
                            >
                                <Receipt className="h-4 w-4" />
                                {cart.length > 0
                                    ? `Complete Sale · ${formatCurrency(grandTotal, currency)}`
                                    : 'Complete Checkout & Deduct FEFO'}
                            </Button>

                            {cart.length > 0 && (
                                <p className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                                    <Check className="h-3 w-3 text-emerald-500" />
                                    FEFO nearest-expiry batch deduction applied
                                    automatically
                                </p>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            <BarcodeCameraModal
                open={cameraOpen}
                onClose={() => {
                    setCameraOpen(false);
                    scanInputRef.current?.focus({ preventScroll: true });
                }}
                onDetected={(code) => processScannedCode(code, false)}
                title="Scan Medicine Barcode"
                subtitle="Use laptop webcam or phone camera to add products to cart"
                allowContinuous
                defaultContinuous={false}
            />
        </AppLayout>
    );
}
