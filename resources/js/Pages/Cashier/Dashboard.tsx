import React, { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertCircle,
    ArrowRightLeft,
    Banknote,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    Coffee,
    CreditCard,
    Eye,
    Layers,
    List,
    Loader2,
    LogOut,
    Plus,
    Printer,
    ReceiptText,
    ShoppingCart,
    Smartphone,
    Store,
    TrendingUp,
    User,
    Users,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState, TableActionMenu } from '@/Components/tables';
import { PosReceiptData, SharedPageProps } from '@/types';
import { formatCurrency } from '@/lib/format';
import PosReceiptModal from '../Pos/components/PosReceiptModal';
import {
    CloseShiftModal,
    OpenShiftModal,
    PosCounterData,
    TakeBreakModal,
} from '../Pos/components/PosShiftModals';

interface CashierOrderItem {
    id: number;
    medicine_id: number;
    medicine_name?: string;
    dosage_form?: string;
    strength?: string;
    quantity: number;
    sale_unit?: string;
    pack_size?: number;
    unit_price: number;
    line_total: number;
}

export interface CashierOrder {
    id: number;
    order_number: string;
    invoice_number?: string | null;
    customer_name: string;
    customer_phone?: string | null;
    customer_allergies?: string | null;
    salesman_name?: string | null;
    salesman_initials?: string | null;
    total_amount: number;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    order_status: string;
    payment_status: string;
    prescription_file?: string | null;
    doctor_name?: string | null;
    prescription_notes?: string | null;
    created_at?: string;
    assigned_at?: string;
    assigned_date_time?: string;
    assigned_time_ago?: string;
    processing_started_at?: string;
    completed_at?: string;
    items_count: number;
    items: CashierOrderItem[];
}

export interface RecentTransactionItem {
    id: number;
    invoice_number: string;
    customer_name: string;
    payment_method: string;
    total_amount: number;
    time: string;
    status: string;
    order?: CashierOrder;
}

export interface LatestActivityItem {
    id: string;
    type: 'shift' | 'completed' | 'assigned';
    title: string;
    time: string;
    timestamp?: number;
}

interface CashierDashboardProps {
    activeCounter?: {
        id: number;
        code: string;
        name: string;
        status: 'active' | 'on_break' | 'closed';
        location?: string | null;
        max_queue_capacity?: number;
        current_break_reason?: string | null;
    } | null;
    activeSession?: {
        id: number;
        opened_at?: string;
        opened_date_time?: string;
        opening_float: number;
        system_expected_cash: number;
        shift: string;
        total_sales_amount: number;
        total_transactions: number;
    } | null;
    metrics: {
        total_collection: number;
        cash_collection: number;
        card_collection: number;
        mobile_collection: number;
        total_transactions: number;
        completed_sales_amount: number;
        pending_orders: number;
    };
    queues: {
        incoming: CashierOrder[];
        processing: CashierOrder[];
        completed: CashierOrder[];
    };
    recentTransactions?: RecentTransactionItem[];
    latestActivity?: LatestActivityItem[];
    availableCounters: PosCounterData[];
    currency: string;
    branchName?: string;
}

export default function CashierDashboard({
    activeCounter,
    activeSession,
    metrics,
    queues,
    recentTransactions = [],
    latestActivity = [],
    availableCounters = [],
    currency = 'BDT',
    branchName,
}: CashierDashboardProps) {
    const { auth, flash } = usePage<SharedPageProps>().props;
    const currentUserName = auth?.user?.name ?? 'Cashier';

    const [activeTab, setActiveTab] = useState<'incoming' | 'processing' | 'completed'>('incoming');

    // Shift modals
    const [openShiftModal, setOpenShiftModal] = useState(false);
    const [breakModal, setBreakModal] = useState(false);
    const [closeShiftModal, setCloseShiftModal] = useState(false);

    // Processing / Payment Tender Modal
    const [tenderOrder, setTenderOrder] = useState<CashierOrder | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bkash' | 'nagad' | 'split'>('cash');
    const [tenderedCash, setTenderedCash] = useState<number | ''>('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [splitPayments, setSplitPayments] = useState<Array<{ method: 'cash' | 'card' | 'bkash' | 'nagad'; amount: number; reference_number?: string }>>([
        { method: 'cash', amount: 0 },
        { method: 'bkash', amount: 0 },
    ]);
    const [submittingPayment, setSubmittingPayment] = useState(false);

    // Receipt Modal State
    const [receiptData, setReceiptData] = useState<PosReceiptData | null>(null);
    const [receiptModalOpen, setReceiptModalOpen] = useState(false);

    // Reassign Request Modal
    const [reassignOrderTarget, setReassignOrderTarget] = useState<CashierOrder | null>(null);
    const [reassignReason, setReassignReason] = useState('');
    const [reassignSubmitting, setReassignSubmitting] = useState(false);

    // Order Details Preview Modal
    const [previewOrder, setPreviewOrder] = useState<CashierOrder | null>(null);

    // Order currently being accepted
    const [acceptingOrderId, setAcceptingOrderId] = useState<number | null>(null);

    // Accept Order (move to processing and automatically open tender payment modal)
    const handleAcceptOrder = (order: CashierOrder, openPayImmediately = true) => {
        setAcceptingOrderId(order.id);
        router.post(
            route('cashier.orders.accept', order.id),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    setAcceptingOrderId(null);
                    setActiveTab('processing');
                    if (openPayImmediately) {
                        openTenderModal({
                            ...order,
                            order_status: 'processing',
                        });
                    }
                },
                onError: (errors) => {
                    setAcceptingOrderId(null);
                    const errorMsg = Object.values(errors).flat().join('\n') || 'Failed to accept order.';
                    alert(errorMsg);
                },
            }
        );
    };

    // Open Payment Tender Modal
    const openTenderModal = (order: CashierOrder) => {
        setTenderOrder(order);
        setTenderedCash(order.total_amount);
        setPaymentMethod('cash');
        setReferenceNumber('');
        setSplitPayments([
            { method: 'cash', amount: Math.round(order.total_amount / 2) },
            { method: 'bkash', amount: Math.round(order.total_amount / 2) },
        ]);
    };

    // Calculate Change
    const changeDue = Math.max(0, (Number(tenderedCash) || 0) - (tenderOrder?.total_amount || 0));

    // Confirm Payment
    const handleConfirmPayment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenderOrder) return;

        setSubmittingPayment(true);

        const payload: any = {};
        if (paymentMethod === 'split') {
            payload.payments = splitPayments.filter((p) => p.amount > 0);
        } else {
            payload.payment_method = paymentMethod;
            payload.paid_amount = paymentMethod === 'cash' ? Number(tenderedCash) : tenderOrder.total_amount;
            payload.reference_number = referenceNumber || undefined;
        }

        router.post(route('cashier.orders.pay', tenderOrder.id), payload, {
            onSuccess: () => {
                setSubmittingPayment(false);
                const orderId = tenderOrder.id;
                setTenderOrder(null);
                loadInvoiceAndShowReceipt(orderId);
            },
            onError: (errs) => {
                setSubmittingPayment(false);
                alert(Object.values(errs)[0] || 'Payment failed. Please try again.');
            },
        });
    };

    // Load invoice JSON for printing receipt
    const loadInvoiceAndShowReceipt = async (saleId: number) => {
        try {
            const resp = await fetch(route('cashier.orders.invoice', saleId));
            if (resp.ok) {
                const data = await resp.json();
                const posReceipt: PosReceiptData = {
                    id: saleId,
                    invoice_number: data.invoice_number,
                    sold_at: data.sold_at,
                    branch_name: data.branch?.name || branchName || 'Pharmacy Branch',
                    branch_address: data.branch?.address,
                    branch_phone: data.branch?.phone,
                    counter_code: data.counter?.code,
                    counter_name: data.counter?.name,
                    cashier_name: data.cashier || currentUserName || 'Cashier',
                    customer_name: data.customer?.name,
                    customer_phone: data.customer?.phone,
                    payment_method: data.payment_method,
                    payment_status: data.payment_status,
                    subtotal: data.subtotal,
                    discount_amount: data.discount_amount,
                    tax_amount: data.tax_amount,
                    total_amount: data.total_amount,
                    paid_amount: data.paid_amount,
                    due_amount: data.due_amount,
                    change_amount: data.change_amount,
                    currency,
                    payments: data.payments,
                    items: data.items.map((it: any, i: number) => ({
                        id: i + 1,
                        name: it.name,
                        dosage_form: it.dosage_form,
                        strength: it.strength,
                        quantity: it.quantity,
                        unit: it.unit,
                        unit_price: it.unit_price,
                        line_total: it.line_total,
                    })),
                };
                setReceiptData(posReceipt);
                setReceiptModalOpen(true);
            }
        } catch (e) {
            console.error('Failed to load invoice receipt', e);
        }
    };

    // Submit Reassignment Request
    const handleReassignRequest = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reassignOrderTarget || !reassignReason.trim()) return;

        setReassignSubmitting(true);
        router.post(
            route('cashier.orders.request-reassign', reassignOrderTarget.id),
            { reason: reassignReason.trim() },
            {
                onSuccess: () => {
                    setReassignSubmitting(false);
                    setReassignOrderTarget(null);
                    setReassignReason('');
                },
                onError: (errs) => {
                    setReassignSubmitting(false);
                    alert(Object.values(errs)[0] || 'Failed to request reassignment.');
                },
            }
        );
    };

    const hasOpenShift = !!activeSession && !!activeCounter;
    const isServing = activeCounter?.status === 'active';
    const isOnBreak = activeCounter?.status === 'on_break';

    // Current queue list based on active tab
    const currentQueueOrders = useMemo(() => {
        if (activeTab === 'incoming') return queues.incoming;
        if (activeTab === 'processing') return queues.processing;
        return queues.completed;
    }, [activeTab, queues]);

    // Format shift label e.g. "Morning (8:00 AM – 4:00 PM)"
    const shiftLabel = useMemo(() => {
        const s = activeSession?.shift || 'morning';
        if (s === 'morning') return 'Morning (8:00 AM – 4:00 PM)';
        if (s === 'evening') return 'Evening (4:00 PM – 12:00 AM)';
        if (s === 'night') return 'Night (12:00 AM – 8:00 AM)';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }, [activeSession?.shift]);

    // DataTable columns for Queue Orders
    const queueColumns: Column<CashierOrder>[] = useMemo(
        () => [
            {
                id: 'order_number',
                label: 'Order ID',
                className: 'w-[120px]',
                render: (order) => (
                    <div className="flex items-center gap-1.5">
                        <span className="font-bold font-mono text-[#FF4A1F] text-xs">
                            {order.order_number}
                        </span>
                        {order.prescription_file && (
                            <span className="text-[9px] px-1 py-0.2 rounded-[2px] bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                                Rx
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'customer',
                label: 'Customer',
                className: 'min-w-[140px]',
                render: (order) => (
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center shrink-0">
                            <User className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-tight truncate">
                            {order.customer_name}
                        </span>
                    </div>
                ),
            },
            {
                id: 'customer_phone',
                label: 'Phone Number',
                className: 'w-[125px]',
                render: (order) => (
                    <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                        {order.customer_phone || '—'}
                    </span>
                ),
            },
            {
                id: 'salesman',
                label: 'Salesman',
                className: 'min-w-[130px]',
                render: (order) => (
                    <div className="flex items-center gap-1.5 truncate">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {order.salesman_initials || 'SM'}
                        </div>
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate font-medium">
                            {order.salesman_name || 'Sales Staff'}
                        </span>
                    </div>
                ),
            },
            {
                id: 'items',
                label: 'Items',
                className: 'w-[85px]',
                render: (order) => (
                    <button
                        type="button"
                        onClick={() => setPreviewOrder(order)}
                        className="text-xs text-slate-600 dark:text-slate-400 hover:text-[#FF4A1F] hover:underline cursor-pointer"
                    >
                        {order.items_count} items
                    </button>
                ),
            },
            {
                id: 'total_amount',
                label: 'Payable Amount',
                className: 'w-[110px]',
                render: (order) => (
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                        {formatCurrency(order.total_amount, currency)}
                    </span>
                ),
            },
            {
                id: 'assigned_time',
                label: 'Assigned Time',
                className: 'min-w-[120px]',
                render: (order) => (
                    <div>
                        <div className="text-xs text-slate-700 dark:text-slate-300">
                            {order.assigned_date_time || order.assigned_at || order.created_at}
                        </div>
                        <div className="text-[10px] text-slate-400">
                            {order.assigned_time_ago || 'Recently'}
                        </div>
                    </div>
                ),
            },
            {
                id: 'status',
                label: 'Status',
                className: 'w-[110px]',
                render: (order) => {
                    if (order.order_status === 'completed') {
                        return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Completed</span>
                            </span>
                        );
                    }
                    if (order.order_status === 'processing') {
                        return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-medium">
                                <Activity className="h-3 w-3" />
                                <span>Processing</span>
                            </span>
                        );
                    }
                    return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-medium">
                            <Clock className="h-3 w-3" />
                            <span>Waiting</span>
                        </span>
                    );
                },
            },
            {
                id: 'action',
                label: 'Action',
                className: 'w-[130px] text-right',
                render: (order) => {
                    const isCompleted = order.order_status === 'completed';

                    const actionMenuItems = [
                        ...(!isCompleted
                            ? [
                                  {
                                      key: 'pay',
                                      label: 'Collect / Process Payment',
                                      icon: <Banknote className="h-3.5 w-3.5 text-emerald-600" />,
                                      onClick: () => {
                                          if (activeTab === 'incoming') {
                                              handleAcceptOrder(order, true);
                                          } else {
                                              openTenderModal(order);
                                          }
                                      },
                                  },
                              ]
                            : []),
                        {
                            key: 'print',
                            label: 'Print Invoice / Receipt',
                            icon: <Printer className="h-3.5 w-3.5 text-blue-600" />,
                            onClick: () => loadInvoiceAndShowReceipt(order.id),
                        },
                        {
                            key: 'view',
                            label: 'View Order Details',
                            icon: <Eye className="h-3.5 w-3.5 text-slate-500" />,
                            onClick: () => setPreviewOrder(order),
                        },
                        ...(!isCompleted
                            ? [
                                  {
                                      key: 'reassign',
                                      label: 'Request Reassignment',
                                      icon: <ArrowRightLeft className="h-3.5 w-3.5 text-amber-500" />,
                                      onClick: () => {
                                          setReassignOrderTarget(order);
                                          setReassignReason('');
                                      },
                                  },
                              ]
                            : []),
                    ];

                    return (
                        <div className="flex items-center justify-end gap-1.5">
                            {activeTab === 'incoming' && (
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    disabled={acceptingOrderId === order.id}
                                    onClick={() => handleAcceptOrder(order, true)}
                                    className="h-6.5 px-2.5 text-[10.5px] bg-[#FF4A1F] hover:bg-[#e03d15] text-white rounded-[3px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-60"
                                    title="Accept order and open payment checkout"
                                >
                                    {acceptingOrderId === order.id ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Accepting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-3 w-3" />
                                            <span>Accept</span>
                                        </>
                                    )}
                                </Button>
                            )}
                            {activeTab === 'processing' && (
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    onClick={() => openTenderModal(order)}
                                    className="h-6.5 px-2.5 text-[10.5px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-[3px] font-bold flex items-center gap-1 cursor-pointer"
                                    title="Collect payment"
                                >
                                    <Banknote className="h-3 w-3" />
                                    <span>Pay</span>
                                </Button>
                            )}
                            {activeTab === 'completed' && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadInvoiceAndShowReceipt(order.id)}
                                    className="h-6.5 px-2 text-[10.5px] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-[#FF4A1F] rounded-[3px] flex items-center gap-1 font-semibold"
                                    title="Print or reprint invoice"
                                >
                                    <Printer className="h-3 w-3" />
                                    <span>Print</span>
                                </Button>
                            )}

                            {/* Dot Button Menu with Print, Pay, View Details, Reassign */}
                            <TableActionMenu items={actionMenuItems} />
                        </div>
                    );
                },
            },
        ],
        [activeTab, currency]
    );

    // DataTable columns for Recent Transactions
    const recentColumns: Column<RecentTransactionItem>[] = useMemo(
        () => [
            {
                id: 'invoice_number',
                label: 'Invoice No.',
                className: 'w-[140px]',
                render: (item: RecentTransactionItem) => (
                    <span className="font-bold font-mono text-[#FF4A1F] text-xs">
                        {item.invoice_number}
                    </span>
                ),
            },
            {
                id: 'customer_name',
                label: 'Customer',
                className: 'min-w-[160px]',
                render: (item: RecentTransactionItem) => (
                    <span className="font-medium text-xs text-slate-800 dark:text-slate-200">
                        {item.customer_name}
                    </span>
                ),
            },
            {
                id: 'payment_method',
                label: 'Payment Method',
                className: 'w-[120px]',
                render: (item: RecentTransactionItem) => {
                    const m = item.payment_method?.toLowerCase() || 'cash';
                    return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 capitalize">
                            {m === 'cash' && <Banknote className="h-3 w-3 text-emerald-600" />}
                            {m === 'card' && <CreditCard className="h-3 w-3 text-purple-600" />}
                            {(m === 'bkash' || m === 'nagad') && <Smartphone className="h-3 w-3 text-pink-600" />}
                            <span>{m}</span>
                        </span>
                    );
                },
            },
            {
                id: 'total_amount',
                label: 'Amount',
                className: 'w-[110px]',
                render: (item: RecentTransactionItem) => (
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                        {formatCurrency(item.total_amount, currency)}
                    </span>
                ),
            },
            {
                id: 'time',
                label: 'Time',
                className: 'w-[90px]',
                render: (item: RecentTransactionItem) => (
                    <span className="text-xs text-slate-500 font-mono">{item.time}</span>
                ),
            },
            {
                id: 'status',
                label: 'Status',
                className: 'w-[110px] text-right',
                render: () => (
                    <div className="flex justify-end">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Completed</span>
                        </span>
                    </div>
                ),
            },
        ],
        [currency]
    );

    return (
        <AppLayout
            title="Cashier Station & Queue"
            subtitle={`${branchName ?? 'Dhanmondi 27 Care Point'} • Process incoming salesman orders, collect payments, and print invoices`}
            actions={
                <div className="flex items-center gap-2">
                    {hasOpenShift ? (
                        <>
                            {isServing ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBreakModal(true)}
                                    className="gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-[4px] hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                >
                                    <Coffee className="h-3.5 w-3.5" />
                                    <span>Take Break</span>
                                </Button>
                            ) : null}

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setCloseShiftModal(true)}
                                className="gap-1.5 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-[4px] hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                <span>Close Shift</span>
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => setOpenShiftModal(true)}
                            className="gap-1.5 bg-[#FF4A1F] hover:bg-[#e03d15] text-white text-xs font-bold rounded-[4px] shadow-xs px-3.5 py-2"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Open Cash Register Shift</span>
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Cashier Station & Queue" />

            <div className="space-y-4">
                {/* 1. Emerald Counter Status Pill Bar */}
                <div className="rounded-[4px] border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/20 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-950 dark:text-emerald-100">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                        {/* Counter Status Pill */}
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-[4px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                                <Store className="h-3.5 w-3.5" />
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">
                                Counter {activeCounter?.code || 'C-01'}
                            </span>
                            <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                    isServing
                                        ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                                        : isOnBreak
                                        ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800 animate-pulse'
                                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                }`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                        isServing ? 'bg-emerald-500' : isOnBreak ? 'bg-amber-500' : 'bg-slate-400'
                                    }`}
                                />
                                {isServing ? 'Active' : isOnBreak ? 'On Break' : 'Closed'}
                            </span>
                        </div>

                        <span className="text-emerald-300 dark:text-emerald-700 hidden sm:inline">|</span>

                        {/* Shift Info */}
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <Users className="h-3.5 w-3.5 text-slate-500" />
                            <span>Shift: <strong className="font-semibold text-slate-900 dark:text-white">{shiftLabel}</strong></span>
                        </div>

                        <span className="text-emerald-300 dark:text-emerald-700 hidden sm:inline">|</span>

                        {/* Cashier Info */}
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <User className="h-3.5 w-3.5 text-slate-500" />
                            <span>Cashier: <strong className="font-semibold text-slate-900 dark:text-white">{currentUserName}</strong></span>
                        </div>

                        <span className="text-emerald-300 dark:text-emerald-700 hidden sm:inline">|</span>

                        {/* Shift Opened Info */}
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                            <span>
                                Shift Opened:{' '}
                                <strong className="font-semibold text-slate-900 dark:text-white">
                                    {activeSession?.opened_date_time || 'Today, 8:02 AM'}
                                </strong>
                            </span>
                        </div>
                    </div>

                    {!hasOpenShift && (
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium text-xs">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Shift closed. Open a shift to receive automatic orders.</span>
                        </div>
                    )}
                </div>

                {/* 2. 5 Metric Cards Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* 1. Today's Collection */}
                    <div className="bg-white dark:bg-[#12161c] rounded-[4px] border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Today's Collection
                            </span>
                            <div className="w-7 h-7 rounded-[4px] bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center shrink-0">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {formatCurrency(metrics.total_collection, currency)}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            {metrics.total_transactions} completed sales
                        </div>
                    </div>

                    {/* 2. Cash in Register */}
                    <div className="bg-white dark:bg-[#12161c] rounded-[4px] border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Cash in Register
                            </span>
                            <div className="w-7 h-7 rounded-[4px] bg-sky-50 text-sky-500 dark:bg-sky-950/40 dark:text-sky-400 flex items-center justify-center shrink-0">
                                <Banknote className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {formatCurrency(
                                activeSession?.system_expected_cash ?? metrics.cash_collection,
                                currency
                            )}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            Drawer balance (expected)
                        </div>
                    </div>

                    {/* 3. Card & Mobile */}
                    <div className="bg-white dark:bg-[#12161c] rounded-[4px] border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Card & Mobile
                            </span>
                            <div className="w-7 h-7 rounded-[4px] bg-purple-50 text-purple-500 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center shrink-0">
                                <CreditCard className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {formatCurrency(
                                metrics.card_collection + metrics.mobile_collection,
                                currency
                            )}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            Card, bKash, Nagad, etc.
                        </div>
                    </div>

                    {/* 4. Pending Queue */}
                    <div className="bg-white dark:bg-[#12161c] rounded-[4px] border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Pending Queue
                            </span>
                            <div className="w-7 h-7 rounded-[4px] bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <Clock className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {metrics.pending_orders}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            Waiting for processing
                        </div>
                    </div>

                    {/* 5. Completed Sales */}
                    <div className="bg-white dark:bg-[#12161c] rounded-[4px] border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                Completed Sales
                            </span>
                            <div className="w-7 h-7 rounded-[4px] bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {metrics.total_transactions}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            Today's finished orders
                        </div>
                    </div>
                </div>

                {/* Flash Messages */}
                {flash?.success && (
                    <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-[4px] shadow-2xs">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-semibold">{flash.success}</span>
                    </div>
                )}
                {flash?.error && (
                    <div className="flex items-center gap-2 p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-[4px] shadow-2xs">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                        <span className="font-semibold">{flash.error}</span>
                    </div>
                )}

                {/* 3. Queue Tabs */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('incoming')}
                        className={`px-4 py-2 rounded-[4px] font-semibold text-xs transition-colors cursor-pointer flex items-center gap-2 ${
                            activeTab === 'incoming'
                                ? 'bg-[#FF4A1F] text-white shadow-xs'
                                : 'bg-white dark:bg-[#12161c] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                    >
                        <List className="h-4 w-4" />
                        <span>Incoming Queue ({queues.incoming.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('processing')}
                        className={`px-4 py-2 rounded-[4px] font-semibold text-xs transition-colors cursor-pointer flex items-center gap-2 ${
                            activeTab === 'processing'
                                ? 'bg-[#FF4A1F] text-white shadow-xs'
                                : 'bg-white dark:bg-[#12161c] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                    >
                        <Activity className="h-4 w-4" />
                        <span>Currently Processing ({queues.processing.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('completed')}
                        className={`px-4 py-2 rounded-[4px] font-semibold text-xs transition-colors cursor-pointer flex items-center gap-2 ${
                            activeTab === 'completed'
                                ? 'bg-[#FF4A1F] text-white shadow-xs'
                                : 'bg-white dark:bg-[#12161c] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Completed Today ({queues.completed.length})</span>
                    </button>
                </div>

                {/* 4. Main 2-Column Section (Left: 9 cols, Right: 3 cols) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    {/* Left Column (9 cols): Queue Orders & Recent Transactions */}
                    <div className="lg:col-span-9 space-y-4">
                        {/* Queue Orders Card */}
                        <div className="bg-white dark:bg-[#12161c] rounded-[4px] border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181a20]/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-[4px] bg-orange-100/70 dark:bg-[#ff4a1f]/15 text-[#FF4A1F] flex items-center justify-center shrink-0">
                                        <ShoppingCart className="h-3.5 w-3.5" />
                                    </div>
                                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        {activeTab === 'incoming' && `Incoming Orders — Counter ${activeCounter?.code || 'C-01'}`}
                                        {activeTab === 'processing' && `Currently Processing — Counter ${activeCounter?.code || 'C-01'}`}
                                        {activeTab === 'completed' && `Completed Today — Counter ${activeCounter?.code || 'C-01'}`}
                                    </h3>
                                </div>
                                <span className="px-2 py-0.5 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-full font-medium">
                                    {currentQueueOrders.length} orders in queue
                                </span>
                            </div>

                            <div className="[&_.border]:border-0 [&_.rounded-\[3px\]]:rounded-none">
                                <DataTable
                                    data={currentQueueOrders}
                                    columns={queueColumns}
                                    compact={true}
                                    selectable={false}
                                    hideCheckbox={true}
                                    hideToolbar={true}
                                    hideViewToggle={true}
                                    hidePagination={true}
                                    syncUrlParams={false}
                                    emptyState={
                                        <EmptyState
                                            title="No orders found"
                                            description={
                                                activeTab === 'incoming'
                                                    ? 'No incoming orders in counter queue. New salesman orders will appear here automatically.'
                                                    : activeTab === 'processing'
                                                    ? 'No orders currently in processing. Accept an incoming order to begin billing.'
                                                    : 'No completed orders recorded yet today on this counter.'
                                            }
                                        />
                                    }
                                />
                            </div>
                        </div>

                        {/* Recent Transactions (Today) Card */}
                        <div className="bg-white dark:bg-[#12161c] rounded-[4px] border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181a20]/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-[4px] bg-orange-100/70 dark:bg-[#ff4a1f]/15 text-[#FF4A1F] flex items-center justify-center shrink-0">
                                        <ReceiptText className="h-3.5 w-3.5" />
                                    </div>
                                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        Recent Transactions (Today)
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('completed')}
                                    className="text-xs font-semibold text-[#FF4A1F] hover:underline cursor-pointer"
                                >
                                    View All Transactions
                                </button>
                            </div>

                            <div className="[&_.border]:border-0 [&_.rounded-\[3px\]]:rounded-none">
                                <DataTable
                                    data={recentTransactions}
                                    columns={recentColumns}
                                    compact={true}
                                    selectable={false}
                                    hideCheckbox={true}
                                    hideToolbar={true}
                                    hideViewToggle={true}
                                    hidePagination={true}
                                    syncUrlParams={false}
                                    emptyState={
                                        <EmptyState
                                            title="No recent transactions"
                                            description="Completed sales transactions for today will appear here."
                                        />
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column (3 cols): Counter Activity */}
                    <div className="lg:col-span-3">
                        <div className="bg-white dark:bg-[#12161c] rounded-[4px] border border-slate-200 dark:border-slate-800 shadow-2xs p-3">
                            {/* Header */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-[3px] bg-orange-100/70 dark:bg-[#ff4a1f]/15 text-[#FF4A1F] flex items-center justify-center shrink-0">
                                        <Layers className="h-3 w-3" />
                                    </div>
                                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                                        Counter Activity
                                    </span>
                                </div>
                                <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold px-1.5 py-0.2 text-[10px] rounded-full">
                                    {activeCounter?.code || 'C-01'}
                                </span>
                            </div>

                            {/* Details List */}
                            <div className="py-2.5 space-y-2 text-[11px]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Calendar className="h-3 w-3" />
                                        <span>Shift Opened</span>
                                    </div>
                                    <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[110px]">
                                        {activeSession?.opened_date_time || 'Today, 8:02 AM'}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <User className="h-3 w-3" />
                                        <span>Cashier</span>
                                    </div>
                                    <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[110px]">
                                        {currentUserName}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Layers className="h-3 w-3" />
                                        <span>Queue Capacity</span>
                                    </div>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        {activeCounter?.max_queue_capacity || 50} orders
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Clock className="h-3 w-3" />
                                        <span>Current Queue</span>
                                    </div>
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                        {queues.incoming.length} orders
                                    </span>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-slate-100 dark:border-slate-800 my-1.5" />

                            {/* Latest Activity Section */}
                            <div>
                                <div className="flex items-center justify-between mb-2 pt-0.5">
                                    <h4 className="text-[11px] font-bold text-slate-900 dark:text-white">
                                        Latest Activity
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('completed')}
                                        className="text-[10px] font-semibold text-[#FF4A1F] hover:underline cursor-pointer"
                                    >
                                        View All
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {latestActivity.length === 0 ? (
                                        <p className="text-[11px] text-slate-400 py-2 text-center">
                                            No recent activity.
                                        </p>
                                    ) : (
                                        latestActivity.map((act) => (
                                            <div
                                                key={act.id}
                                                className="flex items-start justify-between gap-1.5 text-[11px]"
                                            >
                                                <div className="flex items-start gap-1.5 min-w-0">
                                                    {act.type === 'completed' || act.type === 'shift' ? (
                                                        <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                                            <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                                                        </div>
                                                    ) : (
                                                        <div className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#FF4A1F] flex items-center justify-center shrink-0 mt-0.5">
                                                            <Plus className="h-2.5 w-2.5" strokeWidth={2.5} />
                                                        </div>
                                                    )}
                                                    <span className="text-slate-800 dark:text-slate-200 leading-tight truncate">
                                                        {act.title}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                                    {act.time}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Tender Modal */}
            {tenderOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="w-full max-w-lg rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-3">
                            <div className="flex items-center gap-2">
                                <Banknote className="h-4 w-4 text-[#FF4A1F]" />
                                <div>
                                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                        Collect Payment · #{tenderOrder.order_number}
                                    </h3>
                                    <p className="text-[11px] text-slate-500">Customer: {tenderOrder.customer_name}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTenderOrder(null)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmPayment} className="space-y-3.5">
                            {/* Amount Summary */}
                            <div className="p-3 rounded-[4px] bg-slate-50 dark:bg-[#181d26] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] text-slate-500 block">Total Amount Due</span>
                                    <span className="text-xl font-mono font-black text-[#FF4A1F]">
                                        {formatCurrency(tenderOrder.total_amount, currency)}
                                    </span>
                                </div>
                                <div className="text-right text-[11px] text-slate-500 space-y-0.5">
                                    <div>Subtotal: <span className="font-mono">{formatCurrency(tenderOrder.subtotal, currency)}</span></div>
                                    <div>Discount: <span className="font-mono text-emerald-600">-{formatCurrency(tenderOrder.discount_amount, currency)}</span></div>
                                    {tenderOrder.tax_amount > 0 && <div>VAT/Tax: <span className="font-mono">+{formatCurrency(tenderOrder.tax_amount, currency)}</span></div>}
                                </div>
                            </div>

                            {/* Payment Method Selector */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Payment Method
                                </label>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {(['cash', 'card', 'bkash', 'nagad', 'split'] as const).map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setPaymentMethod(m)}
                                            className={`py-2 px-1 text-center rounded-[4px] border text-xs font-bold uppercase transition-colors cursor-pointer ${
                                                paymentMethod === m
                                                    ? 'bg-[#FF4A1F] text-white border-[#FF4A1F]'
                                                    : 'bg-white dark:bg-[#181d26] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Cash Tender & Quick Buttons */}
                            {paymentMethod === 'cash' && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                Tendered Cash Amount
                                            </label>
                                            <input
                                                type="number"
                                                min={tenderOrder.total_amount}
                                                step="any"
                                                value={tenderedCash}
                                                onChange={(e) => setTenderedCash(e.target.value ? Number(e.target.value) : '')}
                                                required
                                                className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-1.5 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                                Change Due
                                            </label>
                                            <div className="w-full rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#181d26] px-3 py-1.5 text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(changeDue, currency)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Cash Buttons */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => setTenderedCash(tenderOrder.total_amount)}
                                            className="px-2 py-1 rounded-[4px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                                        >
                                            Exact
                                        </button>
                                        {[50, 100, 500, 1000].map((inc) => (
                                            <button
                                                key={inc}
                                                type="button"
                                                onClick={() => setTenderedCash(Math.ceil(tenderOrder.total_amount / inc) * inc)}
                                                className="px-2 py-1 rounded-[4px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                                            >
                                                +{inc}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Card / Mobile Reference Number */}
                            {(paymentMethod === 'card' || paymentMethod === 'bkash' || paymentMethod === 'nagad') && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Transaction / Reference ID
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. TrxID / POS Slip Approval Code"
                                        value={referenceNumber}
                                        onChange={(e) => setReferenceNumber(e.target.value)}
                                        className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                    />
                                </div>
                            )}

                            {/* Split Payment Rows */}
                            {paymentMethod === 'split' && (
                                <div className="space-y-2">
                                    <span className="text-[11px] text-slate-500 font-semibold block">
                                        Multi-Channel Tender Breakdown
                                    </span>
                                    {splitPayments.map((sp, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-4">
                                                <select
                                                    value={sp.method}
                                                    onChange={(e) => {
                                                        const updated = [...splitPayments];
                                                        updated[idx].method = e.target.value as any;
                                                        setSplitPayments(updated);
                                                    }}
                                                    className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-2 py-1 text-xs text-slate-900 dark:text-white"
                                                >
                                                    <option value="cash">Cash</option>
                                                    <option value="card">Card</option>
                                                    <option value="bkash">bKash</option>
                                                    <option value="nagad">Nagad</option>
                                                </select>
                                            </div>
                                            <div className="col-span-4">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="any"
                                                    value={sp.amount || ''}
                                                    placeholder="Amount"
                                                    onChange={(e) => {
                                                        const updated = [...splitPayments];
                                                        updated[idx].amount = Number(e.target.value);
                                                        setSplitPayments(updated);
                                                    }}
                                                    className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                                                />
                                            </div>
                                            <div className="col-span-4">
                                                <input
                                                    type="text"
                                                    placeholder="Ref #"
                                                    value={sp.reference_number || ''}
                                                    onChange={(e) => {
                                                        const updated = [...splitPayments];
                                                        updated[idx].reference_number = e.target.value;
                                                        setSplitPayments(updated);
                                                    }}
                                                    className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-2 py-1 text-xs text-slate-900 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTenderOrder(null)}
                                    className="rounded-[4px]"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    disabled={submittingPayment}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-[4px] font-bold"
                                >
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    {submittingPayment ? 'Processing Payment...' : 'Confirm & Print Invoice'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reassign Request Modal */}
            {reassignOrderTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="w-full max-w-sm rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-3">
                            <h3 className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                                <ArrowRightLeft className="h-4 w-4" />
                                Request Reassignment · #{reassignOrderTarget.order_number}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setReassignOrderTarget(null)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleReassignRequest} className="space-y-3">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                Notify the branch manager to reassign this order to another active counter.
                            </p>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Reason <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={reassignReason}
                                    onChange={(e) => setReassignReason(e.target.value)}
                                    placeholder="e.g. Express counter overload / Needs cold-chain packaging"
                                    required
                                    autoFocus
                                    className="w-full rounded-[4px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF4A1F]"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setReassignOrderTarget(null)}
                                    className="rounded-[4px]"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    disabled={reassignSubmitting || !reassignReason.trim()}
                                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-[4px]"
                                >
                                    {reassignSubmitting ? 'Submitting...' : 'Send Request'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Order Items Inspection Modal */}
            {previewOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="w-full max-w-md rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl p-4">
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800 mb-3">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                Verification & Items · #{previewOrder.order_number}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setPreviewOrder(null)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-72 overflow-y-auto">
                            {previewOrder.items.map((item) => (
                                <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-slate-200">
                                            {item.medicine_name || 'Medicine'}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            {item.strength} · Qty: {item.quantity} {item.sale_unit || 'piece'}
                                        </div>
                                    </div>
                                    <div className="font-mono font-semibold text-slate-900 dark:text-white">
                                        {formatCurrency(item.line_total, currency)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {previewOrder.doctor_name && (
                            <div className="mt-2 p-2 rounded-[4px] bg-slate-50 dark:bg-[#181d26] text-[11px] text-slate-600 dark:text-slate-400">
                                Doctor: <strong>{previewOrder.doctor_name}</strong>
                                {previewOrder.prescription_notes && <div className="mt-0.5 italic">{previewOrder.prescription_notes}</div>}
                            </div>
                        )}

                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Total Payable</span>
                            <span className="font-mono font-black text-sm text-[#FF4A1F]">
                                {formatCurrency(previewOrder.total_amount, currency)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Shift Operation Modals */}
            {openShiftModal && (
                <OpenShiftModal
                    open={openShiftModal}
                    counters={availableCounters}
                    currency={currency}
                    onClose={() => setOpenShiftModal(false)}
                />
            )}

            {breakModal && activeCounter && (
                <TakeBreakModal
                    open={breakModal}
                    counter={activeCounter as any}
                    onClose={() => setBreakModal(false)}
                />
            )}

            {closeShiftModal && activeCounter && (
                <CloseShiftModal
                    open={closeShiftModal}
                    counter={activeCounter as any}
                    currency={currency}
                    onClose={() => setCloseShiftModal(false)}
                />
            )}

            {/* Pos Receipt Modal */}
            {receiptModalOpen && (
                <PosReceiptModal
                    open={receiptModalOpen}
                    sale={receiptData}
                    onClose={() => {
                        setReceiptModalOpen(false);
                        setReceiptData(null);
                    }}
                    onNewSale={() => {
                        setReceiptModalOpen(false);
                        setReceiptData(null);
                        setActiveTab('incoming');
                    }}
                />
            )}
        </AppLayout>
    );
}
