import {
    BarcodeCameraModal,
    BarcodeScanFeedback,
} from '@/Components/BarcodeCameraModal';
import { BarcodeSvg } from '@/Components/BarcodeSvg';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { StatusDot } from '@/Components/ui/StatusDot';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    POS_SEARCH_PLACEHOLDERS,
    useTypingPlaceholder,
} from '@/hooks/useTypingPlaceholder';
import { formatCurrency, getCurrencySymbol } from '@/lib/format';
import { PosReceiptData, SharedPageProps } from '@/types';
import { router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera,
    Check,
    Clock,
    Minus,
    Pause,
    Plus,
    Receipt,
    ScanBarcode,
    ShoppingCart,
    Stethoscope,
    Trash2,
    UserPlus,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import HeldBillsModal, { HeldBill } from './components/HeldBillsModal';
import { PosBreakLockOverlay } from './components/PosBreakLockOverlay';
import { PosCounterBar } from './components/PosCounterBar';
import PosReceiptModal from './components/PosReceiptModal';
import {
    CloseShiftModal,
    OpenShiftModal,
    PosCounterData,
    TakeBreakModal,
} from './components/PosShiftModals';
import QuickCustomerModal from './components/QuickCustomerModal';

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
type DiscountType = 'fixed' | 'percent';

interface CrmCustomer {
    id: number;
    name: string;
    phone?: string | null;
    loyalty_points: number;
    allergies?: string | null;
    total_due?: number;
}

type PaymentMode = 'single' | 'split' | 'due';

interface SplitPaymentRow {
    method: string;
    amount: string;
    reference_number?: string;
}

const singlePaymentOptions = [
    { id: 'cash', value: 'cash', name: 'Cash Counter (নগদ)' },
    { id: 'card', value: 'card', name: 'Debit / Credit Card (কার্ড)' },
    { id: 'bkash', value: 'bkash', name: 'bKash (বিকাশ)' },
    { id: 'nagad', value: 'nagad', name: 'Nagad (নগদ ওয়ালেট)' },
    { id: 'rocket', value: 'rocket', name: 'Rocket (রকেট)' },
];

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
    counters?: PosCounterData[];
    activeCounter?: PosCounterData | null;
}

type CatalogFilter = 'all' | 'in_stock' | 'rx';

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
        <div className="w-11">
            <Input
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
                className="h-6 px-1 text-center text-[11.5px] font-bold tabular-nums focus:border-[#FF4A1F]"
            />
        </div>
    );
}

export default function PosIndex({
    medicines,
    customers = [],
    branchName,
    counters = [],
    activeCounter = null,
}: PosProps) {
    const { tenant, flash } = usePage<SharedPageProps>().props;
    const currency = tenant?.currentTenant?.currency_code ?? 'BDT';
    const currencySymbol = getCurrencySymbol(currency);

    const [openShiftOpen, setOpenShiftOpen] = useState(false);
    const [takeBreakOpen, setTakeBreakOpen] = useState(false);
    const [closeShiftOpen, setCloseShiftOpen] = useState(false);

    const [query, setQuery] = useState('');
    const searchPlaceholder = useTypingPlaceholder(
        POS_SEARCH_PLACEHOLDERS,
        Boolean(query)
    );
    const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerId, setCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('Walk-in Customer');
    const [doctorName, setDoctorName] = useState('');
    const [prescriptionNotes, setPrescriptionNotes] = useState('');
    const [showRxFields, setShowRxFields] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('single');
    const [givenCash, setGivenCash] = useState('');
    const [splitPayments, setSplitPayments] = useState<SplitPaymentRow[]>([
        { method: 'cash', amount: '', reference_number: '' },
        { method: 'bkash', amount: '', reference_number: '' },
    ]);
    const [duePaidNow, setDuePaidNow] = useState('0');
    const [dueMethod, setDueMethod] = useState('cash');

    const [heldBillsModalOpen, setHeldBillsModalOpen] = useState(false);
    const [quickCustomerModalOpen, setQuickCustomerModalOpen] = useState(false);
    const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
    const [discountType, setDiscountType] = useState<DiscountType>('fixed');
    const [discount, setDiscount] = useState('0');
    const [processing, setProcessing] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanStatus, setScanStatus] = useState<BarcodeScanFeedback | null>(
        null
    );
    const [receiptModalSale, setReceiptModalSale] = useState<PosReceiptData | null>(null);
    const scanInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('pos_held_bills');
            if (raw) {
                setHeldBills(JSON.parse(raw));
            }
        } catch { }
    }, []);

    const saveHeldBills = (bills: HeldBill[]) => {
        setHeldBills(bills);
        try {
            localStorage.setItem('pos_held_bills', JSON.stringify(bills));
        } catch { }
    };

    const handleHoldBill = () => {
        if (cart.length === 0) return;
        const newHeld: HeldBill = {
            id: 'HOLD-' + Date.now().toString(36),
            heldAt: new Date().toISOString(),
            customerName: selectedCustomer?.name ?? customerName,
            customerId: customerId || undefined,
            doctorName: doctorName || undefined,
            prescriptionNotes: prescriptionNotes || undefined,
            itemsCount: cart.length,
            subtotal: subtotal,
            cart: [...cart],
            discount,
            discountType,
        };
        const updated = [newHeld, ...heldBills];
        saveHeldBills(updated);
        setCart([]);
        setDiscount('0');
        setDoctorName('');
        setPrescriptionNotes('');
        setShowRxFields(false);
        setGivenCash('');
        setDuePaidNow('0');
    };

    const handleResumeBill = (bill: HeldBill) => {
        setCart(bill.cart);
        setCustomerId(bill.customerId || '');
        setCustomerName(bill.customerName || 'Walk-in Customer');
        setDoctorName(bill.doctorName || '');
        setPrescriptionNotes(bill.prescriptionNotes || '');
        setShowRxFields(Boolean(bill.doctorName || bill.prescriptionNotes));
        setDiscount(bill.discount || '0');
        setDiscountType(bill.discountType || 'fixed');
        const remaining = heldBills.filter((b) => b.id !== bill.id);
        saveHeldBills(remaining);
        setHeldBillsModalOpen(false);
    };

    const handleDeleteHeldBill = (billId: string) => {
        const remaining = heldBills.filter((b) => b.id !== billId);
        saveHeldBills(remaining);
    };

    const handleClearAllHeldBills = () => {
        saveHeldBills([]);
        setHeldBillsModalOpen(false);
    };

    useEffect(() => {
        if (flash?.lastSale) {
            setReceiptModalSale(flash.lastSale);
        }
    }, [flash?.lastSale]);

    const hasRxItem = useMemo(() => cart.some((c) => c.medicine.requires_prescription), [cart]);

    const handleStartNewSale = () => {
        setReceiptModalSale(null);
        setCart([]);
        setQuery('');
        setDoctorName('');
        setPrescriptionNotes('');
        setShowRxFields(false);
        setDiscount('0');
        setGivenCash('');
        setDuePaidNow('0');
        setPaymentMode('single');
        scanInputRef.current?.focus({ preventScroll: true });
    };

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
            { id: 'walkin', value: '', name: 'Walk-in Customer (সাধারণ ক্রেতা)' },
            ...customers.map((c) => {
                const dueText = c.total_due && c.total_due > 0 ? ` · বাকি: ${formatCurrency(c.total_due, currency)}` : '';
                return {
                    id: c.id,
                    value: String(c.id),
                    name: `${c.name}${c.phone ? ` (${c.phone})` : ''}${dueText}`,
                    subtitle: `${c.loyalty_points} loyalty pts`,
                };
            }),
        ],
        [customers, currency]
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
        if (!needle) {
            return [];
        }
        return medicines.filter((m) => {
            if (catalogFilter === 'in_stock' && m.available_stock <= 0) {
                return false;
            }
            if (catalogFilter === 'rx' && !m.requires_prescription) {
                return false;
            }
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
    const handleDiscountTypeChange = (nextType: DiscountType) => {
        if (nextType === discountType) return;
        setDiscountType(nextType);
        const currentNum = Math.max(0, Number(discount) || 0);
        if (nextType === 'percent' && currentNum > 100) {
            setDiscount('100');
        }
    };

    const rawDiscountValue = Math.max(0, Number(discount) || 0);
    const effectiveDiscountPercent =
        discountType === 'percent' ? Math.min(100, rawDiscountValue) : 0;
    const discountAmount =
        discountType === 'percent'
            ? Math.min(
                subtotal,
                Math.round(
                    ((subtotal * effectiveDiscountPercent) / 100) * 100
                ) / 100
            )
            : Math.min(subtotal, Math.round(rawDiscountValue * 100) / 100);
    const grandTotal = Math.max(
        0,
        Math.round((subtotal - discountAmount) * 100) / 100
    );

    const handleCompleteCheckout = (e: React.FormEvent) => {
        e.preventDefault();
        if (cart.length === 0) return;

        let payloadPaymentMethod = paymentMethod;
        let payloadPaidAmount: number | undefined = undefined;
        let payloadPayments: Array<{ method: string; amount: number; reference_number?: string }> | undefined = undefined;

        if (paymentMode === 'single') {
            payloadPaymentMethod = paymentMethod;
            const given = Number(givenCash);
            payloadPaidAmount = given > 0 ? given : grandTotal;
        } else if (paymentMode === 'split') {
            const activePayments = splitPayments
                .filter((p) => Number(p.amount) > 0)
                .map((p) => ({
                    method: p.method,
                    amount: Math.round(Number(p.amount) * 100) / 100,
                    reference_number: p.reference_number?.trim() || undefined,
                }));

            if (activePayments.length === 0) {
                alert('অনুগ্রহ করে অন্তত একটি পেমেন্ট মাধ্যমে টাকার পরিমাণ লিখুন।');
                return;
            }

            const totalSplit = activePayments.reduce((s, p) => s + p.amount, 0);
            if (totalSplit < grandTotal && !customerId) {
                alert('বাকি বা আংশিক বিক্রির জন্য রেজিস্টার্ড কাস্টমার সিলেক্ট করতে হবে।');
                return;
            }

            payloadPayments = activePayments;
            payloadPaymentMethod = activePayments.map((p) => p.method).join(' + ');
            payloadPaidAmount = totalSplit;
        } else if (paymentMode === 'due') {
            if (!customerId) {
                alert('বাকিতে বিক্রির জন্য কাস্টমার সিলেক্ট করা আবশ্যক। অনুগ্রহ করে কাস্টমার সিলেক্ট বা নতুন কাস্টমার যুক্ত করুন।');
                return;
            }
            const paid = Math.max(0, Number(duePaidNow) || 0);
            payloadPaidAmount = paid;
            payloadPaymentMethod = paid > 0 ? dueMethod : 'due';
        }

        setProcessing(true);
        router.post(
            route('pos.checkout'),
            {
                counter_id: activeCounter?.id,
                counter_session_id: activeCounter?.current_session?.id,
                customer_id: customerId ? Number(customerId) : null,
                customer_name: selectedCustomer?.name ?? customerName,
                doctor_name: doctorName.trim() || null,
                prescription_notes: prescriptionNotes.trim() || null,
                payment_method: payloadPaymentMethod,
                paid_amount: payloadPaidAmount,
                payments: payloadPayments,
                discount:
                    discountType === 'percent'
                        ? effectiveDiscountPercent
                        : rawDiscountValue,
                discount_type: discountType,
                items: cart.map((c) => ({
                    medicine_id: c.medicine.id,
                    quantity: c.qty,
                    sale_unit: c.saleUnit,
                })),
            },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    setCart([]);
                    setDiscount('0');
                    setDoctorName('');
                    setPrescriptionNotes('');
                    setShowRxFields(false);
                    setScanStatus(null);
                    setGivenCash('');
                    setDuePaidNow('0');
                    setPaymentMode('single');
                    const lastSale = (page.props as any)?.flash?.lastSale;
                    if (lastSale) {
                        setReceiptModalSale(lastSale);
                    }
                    scanInputRef.current?.focus({ preventScroll: true });
                },
                onError: (errs) => {
                    const firstMsg = Object.values(errs)[0];
                    if (firstMsg) {
                        alert(typeof firstMsg === 'string' ? firstMsg : 'Checkout failed');
                    }
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
            {/* Break Lock Screen Overlay */}
            {activeCounter && activeCounter.status === 'on_break' && (
                <PosBreakLockOverlay counter={activeCounter} />
            )}

            {/* Counter Shift & Status Bar */}
            <PosCounterBar
                activeCounter={activeCounter}
                currency={currency}
                onOpenShift={() => setOpenShiftOpen(true)}
                onTakeBreak={() => setTakeBreakOpen(true)}
                onCloseShift={() => setCloseShiftOpen(true)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                {/* Left Catalog List */}
                <div className="lg:col-span-8 min-w-0 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151921] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <div className="flex-1 min-w-0">
                                <Input
                                    ref={scanInputRef}
                                    placeholder={searchPlaceholder}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    icon={
                                        <ScanBarcode className="h-3.5 w-3.5 text-[#FF4A1F]" />
                                    }
                                    rightIcon={
                                        query ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setQuery('');
                                                    scanInputRef.current?.focus();
                                                }}
                                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer text-xs"
                                                title="Clear search"
                                            >
                                                ✕
                                            </button>
                                        ) : (
                                            <kbd className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                                                F2
                                            </kbd>
                                        )
                                    }
                                    className="h-8 rounded-full border-slate-200/90 dark:border-slate-700/80 focus:border-slate-200/90 dark:focus:border-slate-700/80 bg-white dark:bg-[#12161c] pl-9 pr-11 text-[12.5px]"
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
                                        className={`h-7 px-2.5 rounded-[3px] text-[11.5px] font-semibold transition-colors cursor-pointer ${active
                                                ? 'bg-[#FF4A1F] text-white'
                                                : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] text-slate-600 dark:text-slate-300 hover:border-slate-300'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                            <span className="ml-1 text-[11px] font-medium text-slate-400 tabular-nums">
                                {query.trim()
                                    ? `${filteredMedicines.length} found`
                                    : 'Search to display'}
                            </span>
                        </div>
                    </div>

                    {scanStatus && (
                        <div
                            className={`px-3 py-1.5 border-b text-[11.5px] font-medium flex items-center justify-between gap-2 ${scanStatus.tone === 'success'
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
                                <tr className="bg-slate-50/80 dark:bg-[#151921] border-b border-slate-200/90 dark:border-slate-800 text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap select-none">
                                    <th className="px-1.5 py-1 w-[52px]">SKU</th>
                                    <th className="hidden sm:table-cell px-1 py-1 w-[48px]">Barcode</th>
                                    <th className="px-1.5 py-1">Medicine</th>
                                    <th className="hidden xl:table-cell px-1.5 py-1 w-[100px] 2xl:w-[130px]">Generic</th>
                                    <th className="px-1 py-1 text-right w-[56px]">
                                        Stock
                                    </th>
                                    <th className="px-1 py-1 text-right w-[62px]">
                                        Price
                                    </th>
                                    <th className="px-1.5 py-1 text-right w-[60px]">
                                        Cart
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                                {filteredMedicines.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-14 text-center text-xs text-slate-400"
                                        >
                                            {!query.trim() ? (
                                                <div className="flex flex-col items-center justify-center gap-2 py-4">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center text-slate-400">
                                                        <ScanBarcode className="h-5 w-5 text-[#FF4A1F]" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                            ওষুধের নাম, জেনেরিক বা বারকোড দিয়ে সার্চ করুন
                                                        </p>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            Search by medicine name, generic, barcode, or SKU (F2 to focus)
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span>No medicines match "{query}".</span>
                                            )}
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
                                                className={`transition-colors ${outOfStock
                                                        ? 'opacity-55 bg-slate-50/30 dark:bg-slate-900/20'
                                                        : cartQty > 0
                                                            ? 'bg-orange-50/40 dark:bg-[#ff4a1f]/10'
                                                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                                                    }`}
                                            >
                                                <td className="px-1.5 py-1 font-mono text-[9.5px] font-bold text-[#FF4A1F] whitespace-nowrap">
                                                    {med.sku}
                                                </td>
                                                <td className="hidden sm:table-cell px-1 py-1 whitespace-nowrap">
                                                    <BarcodeSvg
                                                        value={med.barcode}
                                                        compact
                                                        height={14}
                                                        barWidth={0.65}
                                                        className="[&>svg]:h-[14px] [&>svg]:max-w-[44px]"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1 text-[10px] min-w-0">
                                                    <div className="flex items-baseline gap-1 min-w-0">
                                                        <span
                                                            className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[130px] xl:max-w-[155px] 2xl:max-w-[210px]"
                                                            title={med.name}
                                                        >
                                                            {med.name}
                                                        </span>
                                                        {med.strength && (
                                                            <span className="text-[8.5px] text-slate-400 shrink-0">
                                                                {med.strength}
                                                            </span>
                                                        )}
                                                        {med.requires_prescription && (
                                                            <span className="text-[8.5px] font-bold text-[#FF4A1F] shrink-0">
                                                                Rx
                                                            </span>
                                                        )}
                                                    </div>
                                                    {med.generic_name && (
                                                        <div
                                                            className="xl:hidden text-[8.5px] text-slate-400 truncate max-w-[130px]"
                                                            title={med.generic_name}
                                                        >
                                                            {med.generic_name}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="hidden xl:table-cell px-1.5 py-1 text-[9.5px] text-slate-500 dark:text-slate-400">
                                                    <span
                                                        className="block truncate max-w-[95px] 2xl:max-w-[125px]"
                                                        title={
                                                            med.generic_name ||
                                                            med.dosage_form
                                                        }
                                                    >
                                                        {med.generic_name ||
                                                            med.dosage_form}
                                                    </span>
                                                </td>
                                                <td className="px-1 py-1 text-right text-[9.5px] whitespace-nowrap">
                                                    {outOfStock ? (
                                                        <StatusDot variant="rose">
                                                            Out
                                                        </StatusDot>
                                                    ) : (
                                                        <span
                                                            className={`font-semibold tabular-nums ${med.available_stock <=
                                                                    20
                                                                    ? 'text-amber-600 dark:text-amber-400'
                                                                    : 'text-slate-700 dark:text-slate-300'
                                                                }`}
                                                        >
                                                            {
                                                                med.available_stock
                                                            }{' '}
                                                            <span className="text-[8.5px] font-normal text-slate-400">{med.unit}</span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-1 py-1 text-right text-[10px] font-bold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap leading-tight">
                                                    <div>
                                                        {formatCurrency(
                                                            med.selling_price,
                                                            currency
                                                        )}
                                                    </div>
                                                    {med.units_per_box > 1 &&
                                                        med.box_selling_price && (
                                                            <div className="text-[8px] font-normal text-slate-400">
                                                                Box:{' '}
                                                                {formatCurrency(
                                                                    med.box_selling_price,
                                                                    currency
                                                                )}
                                                            </div>
                                                        )}
                                                </td>
                                                <td className="px-1.5 py-1 text-right whitespace-nowrap">
                                                    {cartQty > 0 ? (
                                                        <div className="inline-flex items-center gap-0.5">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    updateQty(
                                                                        med.id,
                                                                        -1
                                                                    )
                                                                }
                                                                aria-label={`Decrease ${med.name} quantity`}
                                                                className="h-4.5 w-4.5 rounded-[2px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] flex items-center justify-center hover:border-[#FF4A1F]/60 cursor-pointer"
                                                            >
                                                                <Minus className="h-2 w-2" />
                                                            </button>
                                                            <span className="w-4 text-center text-[9.5px] font-bold tabular-nums text-[#FF4A1F]">
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
                                                                className="h-4.5 w-4.5 rounded-[2px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] flex items-center justify-center hover:border-[#FF4A1F]/60 disabled:opacity-40 cursor-pointer"
                                                            >
                                                                <Plus className="h-2 w-2" />
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
                                                            className="h-5 px-1.5 text-[9.5px] leading-none"
                                                        >
                                                            <Plus className="h-2 w-2 mr-0.5" />
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
                <div className="lg:col-span-4 min-w-0 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] sticky top-16 overflow-hidden">
                    <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-[#151921]">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-[#FF4A1F]" />
                            <h2 className="text-[13px] font-bold text-slate-900 dark:text-slate-100">
                                Order Register
                            </h2>
                            {heldBills.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setHeldBillsModalOpen(true)}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                    <Clock className="h-3 w-3 animate-pulse" />
                                    <span>হোল্ড ({heldBills.length})</span>
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                                {totalUnits} pcs ({cart.length} lines)
                            </span>
                            {cart.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleHoldBill}
                                        title="Hold bill to serve another customer"
                                        className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                    >
                                        <Pause className="h-3 w-3" />
                                        Hold
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCart([])}
                                        className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleCompleteCheckout}>
                        <div className="p-3.5 space-y-2.5 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                                        Customer (কাস্টমার)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setQuickCustomerModalOpen(true)}
                                        className="text-[11px] font-bold text-[#FF4A1F] hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <UserPlus className="h-3 w-3" />
                                        + New Customer
                                    </button>
                                </div>
                                <Select
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
                                {selectedCustomer && (selectedCustomer.total_due ?? 0) > 0 && (
                                    <div className="mt-1 flex items-center justify-between px-2 py-1 rounded-[4px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300">
                                        <span>⚠️ পূর্বের বকেয়া (Previous Due):</span>
                                        <span className="font-bold">{formatCurrency(selectedCustomer.total_due!, currency)}</span>
                                    </div>
                                )}
                            </div>

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

                            {/* Doctor & Prescription Notes */}
                            <div className="pt-0.5">
                                {hasRxItem || showRxFields ? (
                                    <div className="space-y-2 p-2.5 rounded-[4px] border border-indigo-200/90 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-xs">
                                        <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
                                            <div className="flex items-center gap-1.5">
                                                <Stethoscope className="h-3.5 w-3.5" />
                                                <span>Doctor & Prescription (প্রেসক্রিপশন)</span>
                                            </div>
                                            {!hasRxItem && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowRxFields(false)}
                                                    className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                                >
                                                    Hide
                                                </button>
                                            )}
                                        </div>
                                        <Input
                                            placeholder="Doctor Name (ডাক্তারের নাম)"
                                            value={doctorName}
                                            onChange={(e) => setDoctorName(e.target.value)}
                                            className="h-7 text-xs bg-white dark:bg-[#151921]"
                                        />
                                        <Input
                                            placeholder="Prescription / Dosage Notes (নির্দেশনা বা নোট)"
                                            value={prescriptionNotes}
                                            onChange={(e) => setPrescriptionNotes(e.target.value)}
                                            className="h-7 text-xs bg-white dark:bg-[#151921]"
                                        />
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setShowRxFields(true)}
                                        className="text-[11px] font-medium text-slate-500 hover:text-[#FF4A1F] flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                        <Stethoscope className="h-3 w-3" />
                                        <span>+ Add Doctor Name / Prescription Note</span>
                                    </button>
                                )}
                            </div>

                            {/* Discount Input */}
                            <div className="flex flex-col gap-1 w-full font-sans antialiased">
                                <div className="flex items-center justify-between gap-1">
                                    <label
                                        htmlFor="pos-discount-input"
                                        className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 font-sans"
                                    >
                                        Discount
                                    </label>
                                    <div
                                        role="group"
                                        aria-label="Discount type"
                                        className="inline-flex rounded-[3px] border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800/70"
                                    >
                                        <button
                                            type="button"
                                            aria-pressed={
                                                discountType === 'fixed'
                                            }
                                            onClick={() =>
                                                handleDiscountTypeChange(
                                                    'fixed'
                                                )
                                            }
                                            title={`Fixed amount (${currencySymbol})`}
                                            className={`px-1.5 py-0.5 text-[10.5px] font-bold leading-none transition-colors cursor-pointer ${discountType === 'fixed'
                                                    ? 'bg-[#FF4A1F] text-white'
                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            {currencySymbol}
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={
                                                discountType === 'percent'
                                            }
                                            onClick={() =>
                                                handleDiscountTypeChange(
                                                    'percent'
                                                )
                                            }
                                            title="Percentage (%)"
                                            className={`px-1.5 py-0.5 text-[10.5px] font-bold leading-none transition-colors cursor-pointer ${discountType === 'percent'
                                                    ? 'bg-[#FF4A1F] text-white'
                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            %
                                        </button>
                                    </div>
                                </div>
                                <div className="flex h-[30px] items-center rounded-[1px] border border-slate-300 dark:border-[#384150] bg-white dark:bg-[#1e2329] focus-within:border-slate-400 dark:focus-within:border-slate-500 overflow-hidden">
                                    {discountType === 'fixed' && (
                                        <span className="px-2 h-full flex items-center text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#151921] border-r border-slate-200 dark:border-slate-700 select-none">
                                            {currencySymbol}
                                        </span>
                                    )}
                                    <Input
                                        id="pos-discount-input"
                                        type="number"
                                        min="0"
                                        max={
                                            discountType === 'percent'
                                                ? 100
                                                : undefined
                                        }
                                        step="0.01"
                                        value={discount}
                                        onChange={(e) =>
                                            setDiscount(e.target.value)
                                        }
                                        onFocus={(e) =>
                                            e.currentTarget.select()
                                        }
                                        onBlur={() => {
                                            const num = Number(discount);
                                            if (
                                                discount.trim() === '' ||
                                                Number.isNaN(num) ||
                                                num < 0
                                            ) {
                                                setDiscount('0');
                                                return;
                                            }
                                            if (
                                                discountType ===
                                                'percent' &&
                                                num > 100
                                            ) {
                                                setDiscount('100');
                                            }
                                        }}
                                        placeholder={
                                            discountType === 'percent'
                                                ? '0'
                                                : '0.00'
                                        }
                                        className="h-[28px] border-0 bg-transparent px-2.5 text-xs font-medium tabular-nums"
                                    />
                                    {discountType === 'percent' && (
                                        <span className="px-2 h-full flex items-center text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#151921] border-l border-slate-200 dark:border-slate-700 select-none">
                                            %
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Payment Mode Selector & Options */}
                            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                    <label className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                                        Payment Method (পেমেন্ট পদ্ধতি)
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {paymentMode === 'single' ? 'একক' : paymentMode === 'split' ? 'মিক্সড' : 'বাকি'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-1 p-0.5 rounded-[5px] bg-slate-100 dark:bg-[#1a202a] border border-slate-200 dark:border-slate-800 text-[11px] font-semibold">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMode('single')}
                                        className={`py-1 rounded-[4px] transition-colors cursor-pointer text-center ${paymentMode === 'single'
                                                ? 'bg-white dark:bg-[#252d3d] text-slate-900 dark:text-white shadow-xs font-bold border border-slate-200/80 dark:border-slate-700'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                    >
                                        Single Pay
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMode('split')}
                                        className={`py-1 rounded-[4px] transition-colors cursor-pointer text-center ${paymentMode === 'split'
                                                ? 'bg-[#FF4A1F] text-white shadow-xs font-bold'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                    >
                                        Split / Mixed
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMode('due')}
                                        className={`py-1 rounded-[4px] transition-colors cursor-pointer text-center ${paymentMode === 'due'
                                                ? 'bg-rose-600 text-white shadow-xs font-bold'
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                    >
                                        Due (বাকি)
                                    </button>
                                </div>

                                {/* Single Payment Mode Controls */}
                                {paymentMode === 'single' && (
                                    <div className="space-y-2 pt-1">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Select
                                                size="sm"
                                                value={paymentMethod}
                                                options={singlePaymentOptions}
                                                onChange={(e) => setPaymentMethod(String(e.target.value))}
                                            />
                                            {paymentMethod === 'cash' ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder={`Given Cash (${currencySymbol})`}
                                                        value={givenCash}
                                                        onChange={(e) => setGivenCash(e.target.value)}
                                                        className="h-[30px] px-2 text-xs font-bold tabular-nums focus:border-[#FF4A1F]"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 rounded-[4px] border border-emerald-200 dark:border-emerald-900/50">
                                                    Full Pay: {formatCurrency(grandTotal, currency)}
                                                </div>
                                            )}
                                        </div>
                                        {paymentMethod === 'cash' && Number(givenCash) > grandTotal && (
                                            <div className="flex items-center justify-between px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                                                <span>Change / ফেরত:</span>
                                                <span>{formatCurrency(Number(givenCash) - grandTotal, currency)}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Split / Mixed Payment Mode Controls */}
                                {paymentMode === 'split' && (
                                    <div className="space-y-2 pt-1 p-2 rounded-[4px] bg-slate-50 dark:bg-[#161c24] border border-slate-200 dark:border-slate-800 text-xs">
                                        <div className="flex items-center justify-between font-bold text-[11px] text-slate-700 dark:text-slate-300 pb-1 border-b border-slate-200 dark:border-slate-700">
                                            <span>Mixed Methods</span>
                                            <button
                                                type="button"
                                                onClick={() => setSplitPayments([...splitPayments, { method: 'card', amount: '' }])}
                                                className="text-[#FF4A1F] hover:underline cursor-pointer flex items-center gap-0.5"
                                            >
                                                <Plus className="h-3 w-3" />
                                                Add Row
                                            </button>
                                        </div>
                                        {splitPayments.map((row, rIdx) => (
                                            <div key={rIdx} className="grid grid-cols-12 gap-1.5 items-center">
                                                <div className="col-span-5">
                                                    <Select
                                                        size="sm"
                                                        value={row.method}
                                                        onChange={(e) => {
                                                            const updated = [...splitPayments];
                                                            updated[rIdx].method = String(e.target.value);
                                                            setSplitPayments(updated);
                                                        }}
                                                        options={[
                                                            { value: 'cash', label: 'Cash (নগদ)' },
                                                            { value: 'bkash', label: 'bKash (বিকাশ)' },
                                                            { value: 'nagad', label: 'Nagad (নগদ)' },
                                                            { value: 'card', label: 'Card (কার্ড)' },
                                                            { value: 'rocket', label: 'Rocket (রকেট)' },
                                                        ]}
                                                        triggerClassName="h-7 text-[11px] bg-white dark:bg-[#1f2631] px-2 font-semibold"
                                                    />
                                                </div>
                                                <div className="col-span-6">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder={`Amount (${currencySymbol})`}
                                                        value={row.amount}
                                                        onChange={(e) => {
                                                            const updated = [...splitPayments];
                                                            updated[rIdx].amount = e.target.value;
                                                            setSplitPayments(updated);
                                                        }}
                                                        className="h-7 px-1.5 text-[11px] font-bold tabular-nums bg-white dark:bg-[#1f2631]"
                                                    />
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    {splitPayments.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== rIdx))}
                                                            className="text-slate-400 hover:text-rose-500 cursor-pointer"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {(() => {
                                            const totalPaid = splitPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                                            const remaining = Math.max(0, Math.round((grandTotal - totalPaid) * 100) / 100);
                                            const change = Math.max(0, Math.round((totalPaid - grandTotal) * 100) / 100);
                                            return (
                                                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 space-y-1 text-[11px]">
                                                    <div className="flex justify-between font-semibold">
                                                        <span>Total Collected:</span>
                                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(totalPaid, currency)}</span>
                                                    </div>
                                                    {remaining > 0 ? (
                                                        <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded">
                                                            <span>Remaining Due (বাকি):</span>
                                                            <span>{formatCurrency(remaining, currency)}</span>
                                                        </div>
                                                    ) : (
                                                        change > 0 && (
                                                            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                                                                <span>Change / ফেরত:</span>
                                                                <span>{formatCurrency(change, currency)}</span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Due Sale Mode Controls */}
                                {paymentMode === 'due' && (
                                    <div className="space-y-2 pt-1 p-2.5 rounded-[4px] bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-xs">
                                        {!customerId && (
                                            <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                <span>বাকিতে বিক্রি করতে উপরে কাস্টমার সিলেক্ট করুন</span>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <Input
                                                    label={`Paid Now / আজকে আদায় (${currencySymbol})`}
                                                    type="number"
                                                    min="0"
                                                    max={grandTotal}
                                                    step="0.01"
                                                    value={duePaidNow}
                                                    onChange={(e) => setDuePaidNow(e.target.value)}
                                                    className="h-7 border-rose-300 dark:border-rose-800 bg-white dark:bg-[#1a202a] px-2 text-xs font-bold tabular-nums"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                                                    Payment Method
                                                </label>
                                                <Select
                                                    size="sm"
                                                    value={dueMethod}
                                                    onChange={(e) => setDueMethod(String(e.target.value))}
                                                    options={[
                                                        { value: 'cash', label: 'Cash (নগদ)' },
                                                        { value: 'bkash', label: 'bKash (বিকাশ)' },
                                                        { value: 'nagad', label: 'Nagad (নগদ)' },
                                                        { value: 'card', label: 'Card (কার্ড)' },
                                                    ]}
                                                    triggerClassName="h-7 border-rose-300 dark:border-rose-800 bg-white dark:bg-[#1a202a] px-2 text-xs font-medium"
                                                />
                                            </div>
                                        </div>
                                        <div className="pt-1.5 border-t border-rose-200 dark:border-rose-900/50 flex justify-between items-center text-[11px] font-bold text-rose-700 dark:text-rose-300">
                                            <span>Due to Record (নতুন বকেয়া):</span>
                                            <span className="text-sm">{formatCurrency(Math.max(0, grandTotal - (Number(duePaidNow) || 0)), currency)}</span>
                                        </div>
                                    </div>
                                )}
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
                                                                            className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${active
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
                                    <span>
                                        Discount
                                        {discountType === 'percent' &&
                                            effectiveDiscountPercent > 0
                                            ? ` (${effectiveDiscountPercent}%)`
                                            : ''}
                                    </span>
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

            <PosReceiptModal
                open={receiptModalSale !== null}
                sale={receiptModalSale}
                onClose={() => setReceiptModalSale(null)}
                onNewSale={handleStartNewSale}
            />

            <QuickCustomerModal
                open={quickCustomerModalOpen}
                onClose={() => setQuickCustomerModalOpen(false)}
                onCustomerCreated={(newCust) => {
                    setCustomerId(String(newCust.id));
                    setCustomerName(newCust.name);
                }}
            />

            <HeldBillsModal
                open={heldBillsModalOpen}
                heldBills={heldBills}
                currency={currency}
                onClose={() => setHeldBillsModalOpen(false)}
                onResumeBill={handleResumeBill}
                onDeleteBill={handleDeleteHeldBill}
                onClearAll={handleClearAllHeldBills}
            />

            <OpenShiftModal
                open={openShiftOpen}
                counters={counters}
                currency={currency}
                onClose={() => setOpenShiftOpen(false)}
            />

            {activeCounter && (
                <>
                    <TakeBreakModal
                        open={takeBreakOpen}
                        counter={activeCounter}
                        onClose={() => setTakeBreakOpen(false)}
                    />
                    <CloseShiftModal
                        open={closeShiftOpen}
                        counter={activeCounter}
                        currency={currency}
                        onClose={() => setCloseShiftOpen(false)}
                    />
                </>
            )}
        </AppLayout>
    );
}
