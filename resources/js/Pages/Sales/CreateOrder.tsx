import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera,
    Check,
    Clock,
    FileText,
    Minus,
    Pause,
    Plus,
    Save,
    ScanBarcode,
    ShieldAlert,
    ShoppingCart,
    Stethoscope,
    Trash2,
    Upload,
    UserPlus,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { StatusDot } from '@/Components/ui/StatusDot';
import { BarcodeSvg } from '@/Components/BarcodeSvg';
import {
    BarcodeCameraModal,
    BarcodeScanFeedback,
} from '@/Components/BarcodeCameraModal';
import { formatCurrency, getCurrencySymbol } from '@/lib/format';
import SalesCustomerModal from './components/SalesCustomerModal';
import OrderPreviewModal from './components/OrderPreviewModal';
import HeldBillsModal, { HeldBill } from '../Pos/components/HeldBillsModal';

export interface BatchOption {
    id: number;
    batch_number: string;
    expiry_date?: string | null;
    quantity_available: number;
    selling_price: number;
}

export interface MedicineItem {
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
    batches: BatchOption[];
}

export interface CustomerItem {
    id: number;
    customer_code?: string | null;
    customer_type?: string;
    name: string;
    phone?: string | null;
    loyalty_points: number;
    allergies?: string | null;
    total_due: number;
    purchase_count?: number;
}

export interface DraftOrderProp {
    id: number;
    order_number: string;
    customer_id?: number | null;
    customer?: CustomerItem | null;
    doctor_name?: string | null;
    prescription_notes?: string | null;
    prescription_reference?: string | null;
    requires_verification: boolean;
    discount: number;
    discount_percentage: number;
    discount_type: 'fixed' | 'percent';
    tax_amount: number;
    notes?: string | null;
    internal_notes?: string | null;
    items: Array<{
        medicine_id: number;
        medicine_batch_id?: number | null;
        quantity: number;
        sale_unit: SaleUnit;
        pack_quantity?: number;
        unit_price: number;
        line_total: number;
    }>;
}

interface CreateOrderProps {
    medicines: MedicineItem[];
    customers: CustomerItem[];
    customerTypes?: Array<{ value: string; label: string }>;
    draftOrder?: DraftOrderProp | null;
    permittedDiscountLimit?: number;
    taxPercentage?: number;
    branchName?: string;
    currency: string;
}

export type SaleUnit = 'piece' | 'strip' | 'box';
export type DiscountType = 'fixed' | 'percent';
export type CatalogFilter = 'all' | 'in_stock' | 'rx';

export interface CartItem {
    medicine: MedicineItem;
    medicine_batch_id?: number | null;
    quantity: number;
    sale_unit: SaleUnit;
    unit_price: number;
    line_total: number;
}

function getPackSize(med: MedicineItem, unit: SaleUnit): number {
    if (unit === 'box') return Math.max(1, med.units_per_box || 1);
    if (unit === 'strip') return Math.max(1, med.units_per_strip || 1);
    return 1;
}

function getMaxSelectableQty(med: MedicineItem, unit: SaleUnit): number {
    const packSize = getPackSize(med, unit);
    return Math.floor(med.available_stock / packSize);
}

function calculateUnitPrice(med: MedicineItem, unit: SaleUnit, batchId?: number | null): number {
    let basePiecePrice = med.selling_price;
    if (batchId) {
        const b = med.batches?.find((batch) => batch.id === batchId);
        if (b && b.selling_price) {
            basePiecePrice = b.selling_price;
        }
    }

    if (unit === 'box') {
        if (med.box_selling_price && med.box_selling_price > 0) {
            return med.box_selling_price;
        }
        return Math.round(basePiecePrice * getPackSize(med, 'box') * 100) / 100;
    }
    if (unit === 'strip') {
        return Math.round(basePiecePrice * getPackSize(med, 'strip') * 100) / 100;
    }
    return basePiecePrice;
}

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

export default function CreateOrder({
    medicines = [],
    customers = [],
    customerTypes = [],
    draftOrder = null,
    permittedDiscountLimit = 2.0,
    taxPercentage = 0.0,
    branchName,
    currency = 'BDT',
}: CreateOrderProps) {
    const currencySymbol = getCurrencySymbol(currency);

    // Search & Filter
    const [query, setQuery] = useState('');
    const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanStatus, setScanStatus] = useState<BarcodeScanFeedback | null>(null);
    const scanInputRef = useRef<HTMLInputElement>(null);

    // Customer state
    const [customerList, setCustomerList] = useState<CustomerItem[]>(() => {
        if (draftOrder?.customer && !customers.some(c => c.id === draftOrder.customer?.id)) {
            return [draftOrder.customer, ...customers];
        }
        return customers;
    });
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
        draftOrder?.customer_id ? String(draftOrder.customer_id) : ''
    );
    const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('all');
    const [walkInName, setWalkInName] = useState(draftOrder?.customer?.name || 'Walk-in Customer');
    const [walkInPhone, setWalkInPhone] = useState(draftOrder?.customer?.phone || '');
    const [salesCustomerModalOpen, setSalesCustomerModalOpen] = useState(false);

    // Cart state initialized from draft if present
    const [cart, setCart] = useState<CartItem[]>(() => {
        if (draftOrder?.items && draftOrder.items.length > 0) {
            return draftOrder.items.map((item) => {
                const med = medicines.find((m) => m.id === item.medicine_id);
                if (!med) return null;
                return {
                    medicine: med,
                    medicine_batch_id: item.medicine_batch_id,
                    quantity: item.quantity,
                    sale_unit: item.sale_unit || 'piece',
                    unit_price: item.unit_price,
                    line_total: item.line_total,
                };
            }).filter(Boolean) as CartItem[];
        }
        return [];
    });

    const [discountType, setDiscountType] = useState<DiscountType>(draftOrder?.discount_type || 'fixed');
    const [discount, setDiscount] = useState<string>(draftOrder ? String(draftOrder.discount || 0) : '0');
    const [taxAmount, setTaxAmount] = useState<string>(draftOrder ? String(draftOrder.tax_amount || 0) : '0');
    const [orderNotes, setOrderNotes] = useState(draftOrder?.notes || '');
    const [internalNotes, setInternalNotes] = useState(draftOrder?.internal_notes || '');
    const [showOrderAdjustments, setShowOrderAdjustments] = useState<boolean>(
        Boolean(
            (draftOrder && Number(draftOrder.discount || 0) > 0) ||
            (draftOrder && Number(draftOrder.tax_amount || 0) > 0) ||
            draftOrder?.internal_notes ||
            draftOrder?.notes
        )
    );

    // Prescription & Doctor details
    const [showRxFields, setShowRxFields] = useState(
        Boolean(draftOrder?.doctor_name || draftOrder?.prescription_notes || draftOrder?.prescription_reference)
    );
    const [doctorName, setDoctorName] = useState(draftOrder?.doctor_name || '');
    const [prescriptionReference, setPrescriptionReference] = useState(draftOrder?.prescription_reference || '');
    const [prescriptionNotes, setPrescriptionNotes] = useState(draftOrder?.prescription_notes || '');
    const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
    const [prescriptionPreview, setPrescriptionPreview] = useState<string | null>(null);
    const [requiresVerification, setRequiresVerification] = useState<boolean>(
        draftOrder?.requires_verification || false
    );
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Order Preview Modal
    const [orderPreviewOpen, setOrderPreviewOpen] = useState(false);

    // Held Bills (Local Storage)
    const [heldBillsModalOpen, setHeldBillsModalOpen] = useState(false);
    const [heldBills, setHeldBills] = useState<HeldBill[]>([]);

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('sales_held_bills');
            if (raw) {
                setHeldBills(JSON.parse(raw));
            }
        } catch {}
    }, []);

    const saveHeldBills = (bills: HeldBill[]) => {
        setHeldBills(bills);
        try {
            localStorage.setItem('sales_held_bills', JSON.stringify(bills));
        } catch {}
    };

    // Auto-focus barcode/search input on load
    useEffect(() => {
        scanInputRef.current?.focus({ preventScroll: true });
    }, []);

    // Dismiss scan status toast after 3.5s
    useEffect(() => {
        if (!scanStatus) return;
        const timer = window.setTimeout(() => setScanStatus(null), 3500);
        return () => window.clearTimeout(timer);
    }, [scanStatus]);

    // Selected customer object
    const selectedCustomer = useMemo(() => {
        if (!selectedCustomerId) return null;
        return customerList.find((c) => String(c.id) === selectedCustomerId) || null;
    }, [selectedCustomerId, customerList]);

    // Customer options for Select component with type filter
    const customerOptions = useMemo(() => {
        let list = customerList;
        if (customerTypeFilter !== 'all') {
            list = list.filter((c) => (c.customer_type || 'registered') === customerTypeFilter);
        }
        return [
            { id: 'walkin', value: '', name: 'Walk-in Customer (নগদ ক্রেতা)' },
            ...list.map((c) => {
                const typeLabel = c.customer_type ? `[${c.customer_type.toUpperCase()}] ` : '';
                const codeText = c.customer_code ? `${c.customer_code} · ` : '';
                const dueText = c.total_due && c.total_due > 0 ? ` · বাকি: ${formatCurrency(c.total_due, currency)}` : '';
                return {
                    id: c.id,
                    value: String(c.id),
                    name: `${codeText}${c.name}${c.phone ? ` (${c.phone})` : ''}${dueText}`,
                    subtitle: `${typeLabel}${c.loyalty_points || 0} pts · ${c.purchase_count ?? 0} orders`,
                };
            }),
        ];
    }, [customerList, customerTypeFilter, currency]);

    // Cart by medicine ID for fast lookup in medicine table
    const cartById = useMemo(() => {
        const map = new Map<number, CartItem>();
        for (const item of cart) {
            map.set(item.medicine.id, item);
        }
        return map;
    }, [cart]);

    // Check if any cart item requires prescription
    const hasRxItem = useMemo(() => {
        return cart.some((c) => c.medicine.requires_prescription);
    }, [cart]);

    // Auto-prompt Rx fields when Rx item is added
    useEffect(() => {
        if (hasRxItem) {
            setShowRxFields(true);
            setRequiresVerification(true);
        }
    }, [hasRxItem]);

    // Filter medicines by query and catalog tab
    const filteredMedicines = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return [];

        return medicines.filter((m) => {
            if (catalogFilter === 'in_stock' && m.available_stock <= 0) return false;
            if (catalogFilter === 'rx' && !m.requires_prescription) return false;

            return (
                m.name.toLowerCase().includes(needle) ||
                (m.generic_name && m.generic_name.toLowerCase().includes(needle)) ||
                (m.sku && m.sku.toLowerCase().includes(needle)) ||
                (m.barcode && m.barcode.toLowerCase().includes(needle))
            );
        });
    }, [medicines, query, catalogFilter]);

    // Add medicine to cart
    const addToCart = (med: MedicineItem, unit: SaleUnit = 'piece') => {
        if (med.available_stock <= 0) {
            setScanStatus({
                ok: false,
                tone: 'warning',
                message: `${med.name} (${med.sku}) is out of stock.`,
            });
            return;
        }

        const defaultBatch = med.batches?.length > 0 ? med.batches[0].id : null;
        const maxQty = getMaxSelectableQty(med, unit);

        setCart((prev) => {
            const existingIdx = prev.findIndex(
                (item) => item.medicine.id === med.id && item.sale_unit === unit
            );

            if (existingIdx > -1) {
                const item = prev[existingIdx];
                if (item.quantity >= maxQty) {
                    setScanStatus({
                        ok: false,
                        tone: 'warning',
                        message: `Max available stock reached for ${med.name}.`,
                    });
                    return prev;
                }
                const updated = [...prev];
                const newQty = item.quantity + 1;
                updated[existingIdx] = {
                    ...item,
                    quantity: newQty,
                    line_total: Math.round(newQty * item.unit_price * 100) / 100,
                };
                return updated;
            }

            const unitPrice = calculateUnitPrice(med, unit, defaultBatch);
            return [
                ...prev,
                {
                    medicine: med,
                    medicine_batch_id: defaultBatch,
                    quantity: 1,
                    sale_unit: unit,
                    unit_price: unitPrice,
                    line_total: unitPrice,
                },
            ];
        });

        setScanStatus({
            ok: true,
            tone: 'success',
            message: `Added: ${med.name}`,
        });
        setQuery('');
    };

    // Update cart item quantity by delta
    const updateQuantity = (index: number, delta: number) => {
        setCart((prev) => {
            const updated = [...prev];
            const item = updated[index];
            if (!item) return prev;
            const maxQty = getMaxSelectableQty(item.medicine, item.sale_unit);
            const newQty = item.quantity + delta;

            if (newQty <= 0) {
                return prev.filter((_, i) => i !== index);
            }

            const clampedQty = Math.min(maxQty, newQty);
            updated[index] = {
                ...item,
                quantity: clampedQty,
                line_total: Math.round(clampedQty * item.unit_price * 100) / 100,
            };
            return updated;
        });
    };

    // Set direct quantity for cart item
    const setDirectQuantity = (index: number, rawQty: number) => {
        setCart((prev) => {
            const updated = [...prev];
            const item = updated[index];
            if (!item) return prev;
            const maxQty = getMaxSelectableQty(item.medicine, item.sale_unit);
            const validQty = Math.max(1, Math.min(maxQty, isNaN(rawQty) ? 1 : rawQty));
            updated[index] = {
                ...item,
                quantity: validQty,
                line_total: Math.round(validQty * item.unit_price * 100) / 100,
            };
            return updated;
        });
    };

    // Change sale unit (piece, strip, box)
    const changeSaleUnit = (index: number, unit: SaleUnit) => {
        setCart((prev) => {
            const updated = [...prev];
            const item = updated[index];
            if (!item) return prev;
            const maxQty = getMaxSelectableQty(item.medicine, unit);
            if (maxQty <= 0) return prev;

            const newPrice = calculateUnitPrice(item.medicine, unit, item.medicine_batch_id);
            const nextQty = Math.max(1, Math.min(maxQty, item.quantity));
            updated[index] = {
                ...item,
                sale_unit: unit,
                unit_price: newPrice,
                quantity: nextQty,
                line_total: Math.round(nextQty * newPrice * 100) / 100,
            };
            return updated;
        });
    };

    // Change batch for cart item
    const changeBatch = (index: number, batchId: number | null) => {
        setCart((prev) => {
            const updated = [...prev];
            const item = updated[index];
            if (!item) return prev;
            const newPrice = calculateUnitPrice(item.medicine, item.sale_unit, batchId);
            updated[index] = {
                ...item,
                medicine_batch_id: batchId,
                unit_price: newPrice,
                line_total: Math.round(item.quantity * newPrice * 100) / 100,
            };
            return updated;
        });
    };

    // Remove single item from cart
    const removeFromCart = (index: number) => {
        setCart((prev) => prev.filter((_, i) => i !== index));
    };

    // Clear entire cart
    const clearCart = () => {
        if (cart.length > 0) {
            setCart([]);
            setDiscount('0');
            setTaxAmount('0');
            setDoctorName('');
            setPrescriptionNotes('');
            setPrescriptionFile(null);
            setPrescriptionPreview(null);
            setShowRxFields(false);
        }
    };

    // Hold current order
    const handleHoldBill = () => {
        if (cart.length === 0) return;
        const newHeld: HeldBill = {
            id: 'HOLD-' + Date.now().toString(36),
            heldAt: new Date().toISOString(),
            customerName: selectedCustomer?.name ?? walkInName,
            customerId: selectedCustomerId || undefined,
            doctorName: doctorName || undefined,
            prescriptionNotes: prescriptionNotes || undefined,
            itemsCount: cart.length,
            subtotal: subtotal,
            cart: cart.map((c) => ({
                medicine: c.medicine,
                qty: c.quantity,
                saleUnit: c.sale_unit,
            })),
            discount: discount,
            discountType: discountType,
        };
        saveHeldBills([newHeld, ...heldBills]);
        clearCart();
    };

    // Resume a held order
    const handleResumeBill = (bill: HeldBill) => {
        const restoredCart: CartItem[] = bill.cart.map((item) => {
            const med = medicines.find((m) => m.id === item.medicine.id) || item.medicine;
            const defaultBatch = med.batches?.length > 0 ? med.batches[0].id : null;
            const price = calculateUnitPrice(med, item.saleUnit, defaultBatch);
            return {
                medicine: med,
                medicine_batch_id: defaultBatch,
                quantity: item.qty,
                sale_unit: item.saleUnit,
                unit_price: price,
                line_total: Math.round(item.qty * price * 100) / 100,
            };
        });
        setCart(restoredCart);
        setSelectedCustomerId(bill.customerId || '');
        setWalkInName(bill.customerName || 'Walk-in Customer');
        setDoctorName(bill.doctorName || '');
        setPrescriptionNotes(bill.prescriptionNotes || '');
        setShowRxFields(Boolean(bill.doctorName || bill.prescriptionNotes));
        setDiscount(bill.discount || '0');
        setDiscountType(bill.discountType || 'fixed');
        saveHeldBills(heldBills.filter((b) => b.id !== bill.id));
        setHeldBillsModalOpen(false);
    };

    // Totals calculations
    const totalUnits = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.quantity * getPackSize(item.medicine, item.sale_unit), 0);
    }, [cart]);

    const subtotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.line_total, 0);
    }, [cart]);

    const discountAmount = useMemo(() => {
        const val = Math.max(0, parseFloat(discount) || 0);
        if (val <= 0) return 0;
        if (discountType === 'percent') {
            const pct = Math.min(100, val);
            return Math.round(((subtotal * pct) / 100) * 100) / 100;
        }
        return Math.min(subtotal, val);
    }, [subtotal, discount, discountType]);

    const effectiveDiscountPercentage = useMemo(() => {
        if (subtotal <= 0 || discountAmount <= 0) return 0;
        return Math.round(((discountAmount / subtotal) * 100) * 100) / 100;
    }, [subtotal, discountAmount]);

    const discountExceedsLimit = useMemo(() => {
        const limit = permittedDiscountLimit ?? 2.0;
        return discountAmount > 0 && effectiveDiscountPercentage > (limit + 0.01);
    }, [discountAmount, effectiveDiscountPercentage, permittedDiscountLimit]);

    const taxRate = taxPercentage ?? 0;
    const computedTaxAmount = useMemo(() => {
        if (taxRate > 0) {
            const taxable = Math.max(0, subtotal - discountAmount);
            return Math.round(taxable * (taxRate / 100) * 100) / 100;
        }
        return Math.max(0, parseFloat(taxAmount) || 0);
    }, [subtotal, discountAmount, taxRate, taxAmount]);

    const totalPayable = useMemo(() => {
        const taxable = Math.max(0, subtotal - discountAmount);
        return Math.max(0, Math.round((taxable + computedTaxAmount) * 100) / 100);
    }, [subtotal, discountAmount, computedTaxAmount]);

    // Handle barcode or Enter key search
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();

        const needle = query.trim().toLowerCase();
        if (!needle) return;

        const exactMatch = medicines.find(
            (m) =>
                (m.barcode && m.barcode.toLowerCase() === needle) ||
                m.sku.toLowerCase() === needle
        );

        if (exactMatch) {
            addToCart(exactMatch);
            return;
        }

        const availableMatches = filteredMedicines.filter((m) => m.available_stock > 0);
        if (availableMatches.length === 1) {
            addToCart(availableMatches[0]);
            return;
        }

        if (filteredMedicines.length === 0) {
            setScanStatus({
                ok: false,
                tone: 'error',
                message: `No medicine found matching "${query.trim()}".`,
            });
        }
    };

    // Handle Prescription file upload
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPrescriptionFile(file);
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => setPrescriptionPreview(reader.result as string);
                reader.readAsDataURL(file);
            } else {
                setPrescriptionPreview(null);
            }
        }
    };

    const removePrescriptionFile = () => {
        setPrescriptionFile(null);
        setPrescriptionPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Prompt order preview modal prior to submission
    const handleInitiateSubmit = () => {
        if (cart.length === 0) {
            alert('Your sales cart is empty. Please add at least one medicine.');
            return;
        }
        setOrderPreviewOpen(true);
    };

    // Actual submission to backend
    const executeSubmitOrder = (isDraft: boolean) => {
        if (cart.length === 0) return;

        setSubmitting(true);

        const formData = new FormData();
        if (selectedCustomer) {
            formData.append('customer_id', String(selectedCustomer.id));
        }
        if (doctorName) formData.append('doctor_name', doctorName);
        if (prescriptionReference) formData.append('prescription_reference', prescriptionReference);
        if (prescriptionNotes) formData.append('prescription_notes', prescriptionNotes);
        if (orderNotes) formData.append('notes', orderNotes);
        if (internalNotes) formData.append('internal_notes', internalNotes);
        if (prescriptionFile) formData.append('prescription_file', prescriptionFile);
        formData.append('requires_verification', requiresVerification ? '1' : '0');
        formData.append('is_draft', isDraft ? '1' : '0');
        if (draftOrder?.id) {
            formData.append('draft_id', String(draftOrder.id));
        }
        formData.append('discount', String(discountAmount));
        formData.append('discount_type', discountType);
        formData.append('tax_amount', String(computedTaxAmount));

        cart.forEach((item, idx) => {
            formData.append(`items[${idx}][medicine_id]`, String(item.medicine.id));
            if (item.medicine_batch_id) {
                formData.append(`items[${idx}][medicine_batch_id]`, String(item.medicine_batch_id));
            }
            formData.append(`items[${idx}][quantity]`, String(item.quantity));
            formData.append(`items[${idx}][sale_unit]`, item.sale_unit);
        });

        router.post(route('sales.orders.store'), formData as any, {
            forceFormData: true,
            onFinish: () => {
                setSubmitting(false);
                setOrderPreviewOpen(false);
            },
            onError: (errs) => {
                setSubmitting(false);
                const firstErr = Object.values(errs)[0];
                alert(firstErr || 'Failed to submit sales order. Please review inputs.');
            },
        });
    };

    // Global keyboard shortcuts (F2 to focus search, F9 to submit)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
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

            if (e.key === 'F9') {
                e.preventDefault();
                if (!submitting && cart.length > 0) {
                    handleInitiateSubmit();
                }
                return;
            }

            // Keyboard-wedge barcode scanner capture
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

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart, submitting, selectedCustomer, doctorName, prescriptionNotes, orderNotes, discountAmount, discountType, taxAmount, requiresVerification]);

    return (
        <AppLayout
            title="New Sales Order"
            subtitle={`${branchName ?? 'Banani Head Office'} • High-speed order creation with automatic counter assignment`}
            actions={
                <div className="flex items-center gap-2">
                    <Link href={route('sales.orders.my-orders')}>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-[4px] hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <FileText className="h-3.5 w-3.5 text-[#FF4A1F]" />
                            <span>My Orders & Tracking</span>
                        </Button>
                    </Link>
                </div>
            }
        >
            <Head title="New Sales Order" />

            {/* Draft Notice if resuming a draft */}
            {draftOrder && (
                <div className="mb-3 px-3.5 py-2.5 rounded-[4px] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
                    <div className="flex items-center gap-2">
                        <Save className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>
                            <strong>Editing Saved Draft #{draftOrder.order_number}:</strong> Submitting this order will route it directly to the cash counter queue, or click "Save as Draft" to update the draft.
                        </span>
                    </div>
                    <Link
                        href={route('sales.orders.create')}
                        className="text-[11px] font-bold text-amber-900 dark:text-amber-100 underline hover:no-underline shrink-0 ml-2"
                    >
                        Start New Blank Order
                    </Link>
                </div>
            )}

            {/* Main 2-Column POS Layout (Left: 8 Cols Medicine Search & Table, Right: 4 Cols Order Register & Cart) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                {/* Left Side: Medicine Catalog & Search Table (8 Cols) */}
                <div className="lg:col-span-8 min-w-0 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] overflow-hidden">
                    {/* Top Search & Filter Bar */}
                    <div className="px-3 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#151921] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <div className="flex-1 min-w-0">
                                <Input
                                    ref={scanInputRef}
                                    placeholder="Scan barcode or SKU (F2), or search medicine... (Enter)"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    icon={<ScanBarcode className="h-3.5 w-3.5 text-[#FF4A1F]" />}
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
                                            <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                                                F2
                                            </kbd>
                                        )
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
                                        onClick={() => setCatalogFilter(tab.key)}
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
                                {query.trim()
                                    ? `${filteredMedicines.length} found`
                                    : 'Search to display'}
                            </span>
                        </div>
                    </div>

                    {/* Barcode / Scan Status Notification */}
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

                    {/* Single Unified Medicine Table (No second table!) */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-[#151921] border-b border-slate-200/90 dark:border-slate-800 text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap select-none">
                                    <th className="px-1.5 py-1 w-[52px]">SKU</th>
                                    <th className="hidden sm:table-cell px-1 py-1 w-[48px]">Barcode</th>
                                    <th className="px-1.5 py-1">Medicine</th>
                                    <th className="hidden xl:table-cell px-1.5 py-1 w-[100px] 2xl:w-[130px]">Generic</th>
                                    <th className="px-1 py-1 text-right w-[56px]">Stock</th>
                                    <th className="px-1 py-1 text-right w-[62px]">Price</th>
                                    <th className="px-1.5 py-1 text-right w-[60px]">Cart</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                                {filteredMedicines.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-12 text-center text-xs text-slate-400"
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
                                                <span>No medicines match "{query}". Try generic name or SKU.</span>
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMedicines.map((med) => {
                                        const outOfStock = med.available_stock <= 0;
                                        const cartItem = cartById.get(med.id);
                                        const cartQty = cartItem?.quantity ?? 0;
                                        const activeUnit: SaleUnit = cartItem?.sale_unit ?? 'piece';
                                        const maxUnitQty = getMaxSelectableQty(med, activeUnit);

                                        return (
                                            <tr
                                                key={med.id}
                                                onClick={() => !outOfStock && addToCart(med)}
                                                className={`transition-colors select-none ${
                                                    outOfStock
                                                        ? 'opacity-55 bg-slate-50/30 dark:bg-slate-900/20 cursor-not-allowed'
                                                        : cartQty > 0
                                                        ? 'bg-orange-50/40 dark:bg-[#ff4a1f]/10 hover:bg-orange-50/70 dark:hover:bg-[#ff4a1f]/20 cursor-pointer'
                                                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer active:bg-orange-50/30'
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
                                                        title={med.generic_name || med.dosage_form}
                                                    >
                                                        {med.generic_name || med.dosage_form}
                                                    </span>
                                                </td>
                                                <td className="px-1 py-1 text-right text-[9.5px] whitespace-nowrap">
                                                    {outOfStock ? (
                                                        <StatusDot variant="rose">Out</StatusDot>
                                                    ) : (
                                                        <span
                                                            className={`font-semibold tabular-nums ${
                                                                med.available_stock <= 20
                                                                    ? 'text-amber-600 dark:text-amber-400'
                                                                    : 'text-slate-700 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            {med.available_stock}{' '}
                                                            <span className="text-[8.5px] font-normal text-slate-400">
                                                                {med.unit}
                                                            </span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-1 py-1 text-right text-[10px] font-bold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap leading-tight">
                                                    <div>{formatCurrency(med.selling_price, currency)}</div>
                                                    {med.units_per_box > 1 && med.box_selling_price && (
                                                        <div className="text-[8px] font-normal text-slate-400">
                                                            Box: {formatCurrency(med.box_selling_price, currency)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-1.5 py-1 text-right whitespace-nowrap">
                                                    {cartQty > 0 ? (
                                                        <div
                                                            className="inline-flex items-center gap-0.5"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const idx = cart.findIndex((c) => c.medicine.id === med.id);
                                                                    if (idx > -1) updateQuantity(idx, -1);
                                                                }}
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
                                                                disabled={cartQty >= maxUnitQty}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const idx = cart.findIndex((c) => c.medicine.id === med.id);
                                                                    if (idx > -1) updateQuantity(idx, 1);
                                                                }}
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
                                                            variant={outOfStock ? 'outline' : 'primary'}
                                                            disabled={outOfStock}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                addToCart(med);
                                                            }}
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

                {/* Right Side: Order Register, Cart, Customer & Checkout Panel (4 Cols) */}
                <div className="lg:col-span-4 min-w-0 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] sticky top-16 overflow-hidden">
                    {/* Header */}
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
                                        onClick={clearCart}
                                        className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Customer, Doctor, Prescription, Discount Controls */}
                    <div className="p-3.5 space-y-2.5 border-b border-slate-100 dark:border-slate-800">
                        {/* Customer Selection with Type Filters */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[12.5px] font-bold text-slate-800 dark:text-slate-200">
                                    Customer (ক্রেতা / রোগী)
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setSalesCustomerModalOpen(true)}
                                    className="text-[11px] font-bold text-[#FF4A1F] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <UserPlus className="h-3 w-3" />
                                    <span>+ New Customer</span>
                                </button>
                            </div>

                            {/* Customer Type Quick Filter Tabs */}
                            <div className="flex items-center gap-1 mb-1.5 overflow-x-auto pb-0.5">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'registered', label: 'Registered' },
                                    { id: 'patient', label: 'Patient' },
                                    { id: 'corporate', label: 'Corporate' },
                                    { id: 'walk_in', label: 'Walk-in' },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setCustomerTypeFilter(tab.id)}
                                        className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-[2px] transition-colors cursor-pointer ${
                                            customerTypeFilter === tab.id
                                                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200/70'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <Select
                                size="sm"
                                value={selectedCustomerId}
                                options={customerOptions}
                                onChange={(e) => {
                                    const val = String(e.target.value);
                                    setSelectedCustomerId(val);
                                    const found = customerList.find((c) => String(c.id) === val);
                                    if (found) {
                                        setWalkInName(found.name);
                                    }
                                }}
                            />

                            {selectedCustomer ? (
                                <div className="mt-1.5 p-2 rounded-[3px] border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#181d26] space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                                            <span>{selectedCustomer.name}</span>
                                            {selectedCustomer.customer_type && (
                                                <span className="text-[9.5px] font-semibold px-1 py-0.2 rounded border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 capitalize">
                                                    {selectedCustomer.customer_type}
                                                </span>
                                            )}
                                        </div>
                                        {selectedCustomer.customer_code && (
                                            <span className="text-[10px] font-mono text-slate-400">
                                                ID: {selectedCustomer.customer_code}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                        <span>{selectedCustomer.phone || 'No phone'}</span>
                                        <span>{selectedCustomer.purchase_count ?? 0} past orders • {selectedCustomer.loyalty_points ?? 0} pts</span>
                                    </div>
                                    {(selectedCustomer.total_due ?? 0) > 0 && (
                                        <div className="flex items-center justify-between px-1.5 py-0.5 rounded-[2px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[10.5px] font-bold text-rose-700 dark:text-rose-300">
                                            <span>⚠️ পূর্বের বকেয়া (Due Balance):</span>
                                            <span className="tabular-nums">{formatCurrency(selectedCustomer.total_due, currency)}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                                    <Input
                                        placeholder="Walk-in Customer Name"
                                        value={walkInName}
                                        onChange={(e) => setWalkInName(e.target.value)}
                                        className="h-7 text-xs"
                                    />
                                    <Input
                                        placeholder="Walk-in Phone (Optional)"
                                        value={walkInPhone}
                                        onChange={(e) => setWalkInPhone(e.target.value)}
                                        className="h-7 text-xs"
                                    />
                                </div>
                            )}

                            {selectedCustomer?.allergies && (
                                <div className="mt-1.5 flex items-center gap-2 rounded-[3px] border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    <span>Allergy Note: {selectedCustomer.allergies}</span>
                                </div>
                            )}
                        </div>

                        {/* Doctor & Prescription Card */}
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        <Input
                                            placeholder="Doctor Name (ডাক্তারের নাম)"
                                            value={doctorName}
                                            onChange={(e) => setDoctorName(e.target.value)}
                                            className="h-7 text-xs bg-white dark:bg-[#151921]"
                                        />
                                        <Input
                                            placeholder="Prescription Ref / Serial"
                                            value={prescriptionReference}
                                            onChange={(e) => setPrescriptionReference(e.target.value)}
                                            className="h-7 text-xs bg-white dark:bg-[#151921]"
                                        />
                                    </div>
                                    <Input
                                        placeholder="Prescription / Dosage Instructions (নির্দেশনা বা নোট)"
                                        value={prescriptionNotes}
                                        onChange={(e) => setPrescriptionNotes(e.target.value)}
                                        className="h-7 text-xs bg-white dark:bg-[#151921]"
                                    />

                                    {/* Prescription File Upload */}
                                    <div className="relative pt-0.5">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept="image/*,.pdf"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="rx-upload"
                                        />
                                        <label
                                            htmlFor="rx-upload"
                                            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-[3px] border border-dashed border-indigo-300 dark:border-indigo-800 bg-white dark:bg-[#181d26] text-xs text-indigo-700 dark:text-indigo-300 cursor-pointer hover:bg-indigo-50/50 transition-colors"
                                        >
                                            <Upload className="h-3.5 w-3.5" />
                                            <span className="truncate">
                                                {prescriptionFile ? prescriptionFile.name : 'Upload Prescription (Image / PDF)'}
                                            </span>
                                        </label>
                                    </div>

                                    {prescriptionPreview && (
                                        <div className="relative mt-1 inline-block">
                                            <img
                                                src={prescriptionPreview}
                                                alt="Rx preview"
                                                className="h-16 w-auto rounded-[3px] border border-indigo-200 object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={removePrescriptionFile}
                                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] cursor-pointer"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}

                                    {/* Pharmacist Verification Toggle */}
                                    <label className="flex items-center gap-2 cursor-pointer pt-1 text-[11px] text-slate-700 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={requiresVerification}
                                            onChange={(e) => setRequiresVerification(e.target.checked)}
                                            className="h-3.5 w-3.5 rounded-[2px] text-[#FF4A1F] focus:ring-[#FF4A1F] border-slate-300"
                                        />
                                        <span className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                                            <ShieldAlert className="h-3 w-3" />
                                            Requires Pharmacist Verification
                                        </span>
                                    </label>
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

                        {/* Toggle Switch for Discount, VAT & Notes */}
                        <div className="pt-1 border-t border-slate-200/70 dark:border-slate-800/80">
                            <div className="flex items-center justify-between gap-2 py-0.5">
                                <button
                                    type="button"
                                    onClick={() => setShowOrderAdjustments((prev) => !prev)}
                                    className="text-left text-[12px] font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                                >
                                    Discount, VAT & Notes
                                </button>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={showOrderAdjustments}
                                    aria-label="Toggle Discount, VAT & Notes"
                                    onClick={() => setShowOrderAdjustments((prev) => !prev)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4A1F]/40 ${
                                        showOrderAdjustments
                                            ? 'bg-[#FF4A1F]'
                                            : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                                            showOrderAdjustments ? 'translate-x-[18px]' : 'translate-x-[2px]'
                                        }`}
                                    />
                                </button>
                            </div>

                            {showOrderAdjustments && (
                                <div className="mt-2 space-y-2">
                                    {/* Discount Input with Permitted Limit Display & Approval Badge */}
                                    <div className="flex flex-col gap-1 w-full font-sans antialiased">
                                        <div className="flex items-center justify-between gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <label
                                                    htmlFor="sales-discount-input"
                                                    className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 font-sans"
                                                >
                                                    Discount
                                                </label>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                                    (Max: {permittedDiscountLimit ?? 2}%)
                                                </span>
                                            </div>
                                            <div
                                                role="group"
                                                aria-label="Discount type"
                                                className="inline-flex rounded-[3px] border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800/70"
                                            >
                                                <button
                                                    type="button"
                                                    aria-pressed={discountType === 'fixed'}
                                                    onClick={() => setDiscountType('fixed')}
                                                    title={`Fixed amount (${currencySymbol})`}
                                                    className={`px-1.5 py-0.5 text-[10.5px] font-bold leading-none transition-colors cursor-pointer ${
                                                        discountType === 'fixed'
                                                            ? 'bg-[#FF4A1F] text-white'
                                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                                                    }`}
                                                >
                                                    {currencySymbol}
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-pressed={discountType === 'percent'}
                                                    onClick={() => setDiscountType('percent')}
                                                    title="Percentage (%)"
                                                    className={`px-1.5 py-0.5 text-[10.5px] font-bold leading-none transition-colors cursor-pointer ${
                                                        discountType === 'percent'
                                                            ? 'bg-[#FF4A1F] text-white'
                                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                                                    }`}
                                                >
                                                    %
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex h-[30px] items-center rounded-[4px] border border-slate-300 dark:border-[#384150] bg-white dark:bg-[#1e2329] focus-within:border-slate-400 dark:focus-within:border-slate-500 overflow-hidden">
                                            {discountType === 'fixed' && (
                                                <span className="px-2 h-full flex items-center text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#151921] border-r border-slate-200 dark:border-slate-700 select-none">
                                                    {currencySymbol}
                                                </span>
                                            )}
                                            <input
                                                id="sales-discount-input"
                                                type="number"
                                                min="0"
                                                max={discountType === 'percent' ? 100 : undefined}
                                                step="0.01"
                                                value={discount}
                                                onChange={(e) => setDiscount(e.target.value)}
                                                onFocus={(e) => e.currentTarget.select()}
                                                onBlur={() => {
                                                    const num = Number(discount);
                                                    if (discount.trim() === '' || Number.isNaN(num) || num < 0) {
                                                        setDiscount('0');
                                                        return;
                                                    }
                                                    if (discountType === 'percent' && num > 100) {
                                                        setDiscount('100');
                                                    }
                                                }}
                                                placeholder={discountType === 'percent' ? '0' : '0.00'}
                                                className="h-full w-full min-w-0 bg-transparent px-2.5 text-xs font-medium tabular-nums text-[#202223] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none dark:[color-scheme:dark]"
                                            />
                                            {discountType === 'percent' && (
                                                <span className="px-2 h-full flex items-center text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#151921] border-l border-slate-200 dark:border-slate-700 select-none">
                                                    %
                                                </span>
                                            )}
                                        </div>
                                        {discountExceedsLimit && (
                                            <div className="flex items-center gap-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-[2px] border border-amber-200">
                                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                                <span>Exceeds limit ({permittedDiscountLimit}%) • Requires Manager Approval</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* VAT / Tax & Remarks */}
                                    <div className="grid grid-cols-1 gap-2 pt-1">
                                        <div>
                                            <div className="flex items-center justify-between mb-0.5">
                                                <label className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                                                    VAT / Tax {taxRate > 0 ? `(${taxRate}% Auto Calculated)` : `(${currencySymbol})`}
                                                </label>
                                                {taxRate > 0 && (
                                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                                        Pharmacy Setting
                                                    </span>
                                                )}
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                disabled={taxRate > 0}
                                                value={taxRate > 0 ? computedTaxAmount : taxAmount}
                                                onChange={(e) => setTaxAmount(e.target.value)}
                                                className={`h-[30px] w-full rounded-[4px] border border-slate-300 dark:border-[#384150] px-2.5 text-xs font-medium tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-[#FF4A1F] ${
                                                    taxRate > 0 ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white dark:bg-[#1e2329]'
                                                }`}
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Salesman internal remark (ম্যানেজার ও ক্যাশিয়ারের জন্য)..."
                                                value={internalNotes}
                                                onChange={(e) => setInternalNotes(e.target.value)}
                                                className="h-[30px] w-full rounded-[4px] border border-slate-300 dark:border-[#384150] bg-white dark:bg-[#1e2329] px-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF4A1F]"
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="text"
                                                placeholder="Customer invoice note (রশিদে প্রিন্ট হবে - ঐচ্ছিক)..."
                                                value={orderNotes}
                                                onChange={(e) => setOrderNotes(e.target.value)}
                                                className="h-[30px] w-full rounded-[4px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] px-2.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#FF4A1F]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart Items List Container (Exactly like POS!) */}
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {cart.length === 0 ? (
                            <div className="px-4 py-8 text-center text-xs text-slate-400">
                                Select medicines from the list on the left to add items to this order.
                            </div>
                        ) : (
                            cart.map((item, idx) => {
                                const packSize = getPackSize(item.medicine, item.sale_unit);
                                const maxQty = getMaxSelectableQty(item.medicine, item.sale_unit);

                                return (
                                    <div
                                        key={`${item.medicine.id}-${item.sale_unit}-${item.medicine_batch_id}-${idx}`}
                                        className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                    {item.medicine.name}
                                                </span>
                                                {item.medicine.requires_prescription && (
                                                    <span className="text-[8.5px] font-bold text-[#FF4A1F] shrink-0">
                                                        Rx
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-400 tabular-nums">
                                                {formatCurrency(item.unit_price, currency)}{' '}
                                                × {item.quantity}{' '}
                                                {item.sale_unit === 'piece'
                                                    ? item.medicine.unit
                                                    : item.sale_unit === 'strip'
                                                    ? `strip (${item.medicine.units_per_strip} pcs)`
                                                    : `box (${item.medicine.units_per_box} pcs)`}
                                                {item.sale_unit !== 'piece' && (
                                                    <span className="ml-1 text-slate-500 dark:text-slate-400">
                                                        = {item.quantity * packSize} pcs
                                                    </span>
                                                )}
                                            </div>

                                            {/* Unit Switcher Pills (Pc, Strip, Box) */}
                                            {(item.medicine.units_per_strip > 1 || item.medicine.units_per_box > 1) && (
                                                <div className="mt-1 inline-flex items-center rounded-[3px] border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/50">
                                                    {(['piece', 'strip', 'box'] as SaleUnit[])
                                                        .filter(
                                                            (u) =>
                                                                u === 'piece' ||
                                                                (u === 'strip' && item.medicine.units_per_strip > 1) ||
                                                                (u === 'box' && item.medicine.units_per_box > 1)
                                                        )
                                                        .map((u) => {
                                                            const active = item.sale_unit === u;
                                                            const label =
                                                                u === 'piece'
                                                                    ? 'Pc'
                                                                    : u === 'strip'
                                                                    ? `Strip (${item.medicine.units_per_strip})`
                                                                    : `Box (${item.medicine.units_per_box})`;
                                                            return (
                                                                <button
                                                                    key={u}
                                                                    type="button"
                                                                    onClick={() => changeSaleUnit(idx, u)}
                                                                    className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
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

                                            {/* Batch Selector if multiple batches available */}
                                            {item.medicine.batches && item.medicine.batches.length > 1 && (
                                                <div className="mt-1">
                                                    <select
                                                        value={item.medicine_batch_id || ''}
                                                        onChange={(e) => changeBatch(idx, e.target.value ? Number(e.target.value) : null)}
                                                        className="h-5 text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181d26] px-1 text-slate-700 dark:text-slate-300"
                                                    >
                                                        <option value="">Auto Batch (FEFO)</option>
                                                        {item.medicine.batches.map((b) => (
                                                            <option key={b.id} value={b.id}>
                                                                {b.batch_number} {b.expiry_date ? `(Exp: ${b.expiry_date})` : ''} - Stock: {b.quantity_available}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => updateQuantity(idx, -1)}
                                                    className="h-6 w-6 rounded-[3px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] flex items-center justify-center hover:border-[#FF4A1F]/60 cursor-pointer text-slate-600 dark:text-slate-300"
                                                >
                                                    <Minus className="h-2.5 w-2.5" />
                                                </button>
                                                <CartQtyInput
                                                    qty={item.quantity}
                                                    max={maxQty}
                                                    name={item.medicine.name}
                                                    onChangeQty={(newQty) => setDirectQuantity(idx, newQty)}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={item.quantity >= maxQty}
                                                    onClick={() => updateQuantity(idx, 1)}
                                                    className="h-6 w-6 rounded-[3px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] flex items-center justify-center hover:border-[#FF4A1F]/60 disabled:opacity-40 cursor-pointer text-slate-600 dark:text-slate-300"
                                                >
                                                    <Plus className="h-2.5 w-2.5" />
                                                </button>
                                            </div>

                                            <span className="w-16 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                                                {formatCurrency(item.line_total, currency)}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() => removeFromCart(idx)}
                                                aria-label={`Remove ${item.medicine.name}`}
                                                className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Bottom Summary & Actions */}
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
                                    {discountType === 'percent' && parseFloat(discount) > 0
                                        ? ` (${discount}%)`
                                        : ''}
                                </span>
                                <span className="font-semibold tabular-nums text-emerald-600">
                                    -{formatCurrency(discountAmount, currency)}
                                </span>
                            </div>
                            {computedTaxAmount > 0 && (
                                <div className="flex justify-between text-slate-500">
                                    <span>VAT / Tax {taxRate > 0 ? `(${taxRate}%)` : ''}</span>
                                    <span className="font-semibold tabular-nums">
                                        +{formatCurrency(computedTaxAmount, currency)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-slate-200/80 dark:border-slate-700/80 pt-2 text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                <span>Total Payable</span>
                                <span className="text-[#FF4A1F] tabular-nums text-base">
                                    {formatCurrency(totalPayable, currency)}
                                </span>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="button"
                            variant="primary"
                            size="lg"
                            fullWidth
                            isLoading={submitting}
                            disabled={cart.length === 0 || submitting}
                            onClick={handleInitiateSubmit}
                            className="h-10 bg-[#FF4A1F] hover:bg-[#e03d15] text-white rounded-[4px] font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <ShoppingCart className="h-4 w-4" />
                            <span>Submit Sales Order</span>
                            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono">
                                F9
                            </kbd>
                        </Button>

                        {/* Save as Draft */}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            fullWidth
                            disabled={cart.length === 0 || submitting}
                            onClick={() => executeSubmitOrder(true)}
                            className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-[4px] cursor-pointer"
                        >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            <span>Save as Draft</span>
                        </Button>

                        <p className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                            <Check className="h-3 w-3 text-emerald-500" />
                            Automatic counter assignment & queue balancing
                        </p>
                    </div>
                </div>
            </div>

            {/* Sales Customer Modal (With Customer Types, Duplicate Prevention) */}
            {salesCustomerModalOpen && (
                <SalesCustomerModal
                    open={salesCustomerModalOpen}
                    onClose={() => setSalesCustomerModalOpen(false)}
                    onCustomerCreated={(newCust) => {
                        setCustomerList((prev) => [newCust, ...prev.filter(c => c.id !== newCust.id)]);
                        setSelectedCustomerId(String(newCust.id));
                        setWalkInName(newCust.name);
                    }}
                />
            )}

            {/* Pre-Submission Order Review Modal */}
            {orderPreviewOpen && (
                <OrderPreviewModal
                    open={orderPreviewOpen}
                    onClose={() => setOrderPreviewOpen(false)}
                    onConfirm={executeSubmitOrder}
                    submitting={submitting}
                    cart={cart}
                    customer={selectedCustomer}
                    walkInName={walkInName}
                    subtotal={subtotal}
                    discount={discount}
                    discountType={discountType}
                    discountAmount={discountAmount}
                    discountPercentage={effectiveDiscountPercentage}
                    permittedDiscountLimit={permittedDiscountLimit}
                    taxPercentage={taxRate}
                    taxAmount={computedTaxAmount}
                    totalPayable={totalPayable}
                    doctorName={doctorName}
                    prescriptionReference={prescriptionReference}
                    prescriptionNotes={prescriptionNotes}
                    prescriptionFile={prescriptionFile}
                    requiresVerification={requiresVerification}
                    orderNotes={orderNotes}
                    internalNotes={internalNotes}
                    currency={currency}
                />
            )}

            {/* HeldBillsModal for Hold / Resume */}
            {heldBillsModalOpen && (
                <HeldBillsModal
                    open={heldBillsModalOpen}
                    heldBills={heldBills}
                    currency={currency}
                    onClose={() => setHeldBillsModalOpen(false)}
                    onResumeBill={handleResumeBill}
                    onDeleteBill={(id) => saveHeldBills(heldBills.filter((b) => b.id !== id))}
                    onClearAll={() => {
                        saveHeldBills([]);
                        setHeldBillsModalOpen(false);
                    }}
                />
            )}

            {/* Barcode Camera Modal */}
            <BarcodeCameraModal
                open={cameraOpen}
                onClose={() => setCameraOpen(false)}
                onDetected={(code) => {
                    const match = medicines.find(
                        (m) =>
                            (m.barcode && m.barcode.toLowerCase() === code.toLowerCase()) ||
                            m.sku.toLowerCase() === code.toLowerCase()
                    );
                    if (match) {
                        addToCart(match);
                        setCameraOpen(false);
                    } else {
                        setScanStatus({
                            ok: false,
                            tone: 'error',
                            message: `No medicine matches scanned code: ${code}`,
                        });
                    }
                }}
            />
        </AppLayout>
    );
}
