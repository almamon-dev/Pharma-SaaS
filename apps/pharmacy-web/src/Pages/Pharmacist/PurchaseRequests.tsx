import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { CheckCircle2, Plus, ShoppingBag } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import {
    BrtaField,
    BrtaFormGrid,
    BrtaFormModal,
    BrtaOptionItem,
    BrtaOptionStrip,
    brtaInputClass,
    brtaTextareaClass,
} from '@/Components/ui/BrtaForm';
import PharmacistMobileNav from './components/PharmacistMobileNav';
import { LowStockItem, PharmacistBranchContext } from './types';

interface PurchaseRequestEntry {
    request_number: string;
    item_key: string;
    medicine_name: string;
    generic_name: string;
    requested_qty: number;
    priority: 'normal' | 'urgent';
    note: string;
    status: string;
    requested_by: string;
    requested_at: string;
}

interface PurchaseRequestsProps {
    context: PharmacistBranchContext;
    lowStockSuggestions: LowStockItem[];
    requests: PurchaseRequestEntry[];
}

export default function PharmacistPurchaseRequests({
    context,
    lowStockSuggestions,
    requests,
}: PurchaseRequestsProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [medicineName, setMedicineName] = useState('');
    const [genericName, setGenericName] = useState('');
    const [requestedQty, setRequestedQty] = useState('50');
    const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const handleSubmitCustom = (e: React.FormEvent) => {
        e.preventDefault();
        if (!medicineName.trim()) return;
        setSubmitting(true);
        router.post(
            route('pharmacist.purchase-requests.store'),
            {
                medicine_name: medicineName.trim(),
                generic_name: genericName.trim() || undefined,
                requested_qty: Math.max(1, Number(requestedQty) || 50),
                priority,
                note: note.trim() || undefined,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setModalOpen(false);
                    setMedicineName('');
                    setGenericName('');
                    setRequestedQty('50');
                    setPriority('normal');
                    setNote('');
                },
                onFinish: () => setSubmitting(false),
            }
        );
    };

    const handleQuickSuggestion = (item: LowStockItem) => {
        setBusyKey(item.key);
        const suggestedQty = Math.max(20, item.reorder_level * 2 - item.current_qty);
        router.post(
            route('pharmacist.purchase-requests.store'),
            {
                item_key: item.key,
                medicine_name: item.medicine_name,
                generic_name: item.generic_name,
                requested_qty: suggestedQty,
                priority: item.stock_status === 'out_of_stock' ? 'urgent' : 'normal',
                note:
                    item.stock_status === 'out_of_stock'
                        ? 'Out of stock in branch — urgent replenishment required'
                        : `Current stock (${item.current_qty}) below reorder level (${item.reorder_level})`,
            },
            {
                preserveScroll: true,
                onFinish: () => setBusyKey(null),
            }
        );
    };

    return (
        <AppLayout title="Purchase Request">
            <Head title="Purchase Request" />
            <PharmacistMobileNav />

            <div className="w-full space-y-4">
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            Purchase Requests
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            {context.branch_name} (<span className="font-mono">{context.branch_code}</span>) • Quantity-only replenishment requests (supplier cost & margin hidden)
                        </p>
                    </div>
                    <Button size="sm" variant="default" onClick={() => setModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-1.5" />
                        New purchase request
                    </Button>
                </div>

                {/* Suggested Low-Stock Reorder Items */}
                <DataTable<LowStockItem>
                    tableId="pharmacist-pr-suggestions-table"
                    data={lowStockSuggestions}
                    columns={[
                        {
                            id: 'medicine_name',
                            label: 'Medicine',
                            render: (item) => (
                                <div>
                                    <div className="font-semibold text-[#222222] dark:text-white">
                                        {item.medicine_name}
                                    </div>
                                    <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {item.generic_name}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'stock_status',
                            label: 'Status',
                            render: (item) =>
                                item.stock_status === 'out_of_stock' ? (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200 whitespace-nowrap">
                                        Out of stock
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                                        Low
                                    </span>
                                ),
                        },
                        {
                            id: 'reorder_level',
                            label: 'Reorder',
                            className: 'text-right',
                            render: (item) => <span className="font-mono">{item.reorder_level}</span>,
                        },
                        {
                            id: 'current_qty',
                            label: 'Current Qty',
                            className: 'text-right',
                            render: (item) => (
                                <span className="font-mono font-bold text-[#C9302C] dark:text-rose-400">
                                    {item.current_qty}
                                </span>
                            ),
                        },
                        {
                            id: 'suggested',
                            label: 'Suggested Order',
                            className: 'text-right',
                            sortable: false,
                            render: (item) => {
                                const suggested = Math.max(
                                    20,
                                    item.reorder_level * 2 - item.current_qty
                                );
                                return (
                                    <span className="font-mono font-semibold text-[#0E5F3F] dark:text-emerald-400 whitespace-nowrap">
                                        {suggested} {item.unit}
                                    </span>
                                );
                            },
                        },
                    ] as Column<LowStockItem>[]}
                    keyExtractor={(item) => item.key}
                    searchPlaceholder="Search low-stock medicines..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    hidePagination
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex items-center justify-between pb-1.5">
                            <div>
                                <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                    Suggested low-stock & out-of-stock items
                                </h2>
                                <p className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                    One-click request for items below branch reorder level
                                </p>
                            </div>
                            <ShoppingBag className="w-4 h-4 text-[#0E5F3F]" />
                        </div>
                    }
                    actions={(item) =>
                        item.requested ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25">
                                <CheckCircle2 className="w-3 h-3" />
                                Requested
                            </span>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-[11.5px]"
                                disabled={busyKey === item.key}
                                onClick={() => handleQuickSuggestion(item)}
                            >
                                {busyKey === item.key ? 'Sending...' : 'Request purchase'}
                            </Button>
                        )
                    }
                    actionsColumnClassName="w-[140px] min-w-[140px]"
                    emptyState={<EmptyState title="No low-stock items right now." />}
                />

                {/* Submitted Purchase Requests */}
                <DataTable<PurchaseRequestEntry>
                    tableId="pharmacist-pr-submitted-table"
                    data={requests}
                    columns={[
                        {
                            id: 'request_number',
                            label: 'Request #',
                            render: (req) => (
                                <span className="font-mono font-bold text-[#0E5F3F] dark:text-emerald-400 whitespace-nowrap">
                                    {req.request_number}
                                </span>
                            ),
                        },
                        {
                            id: 'medicine_name',
                            label: 'Medicine',
                            render: (req) => (
                                <div>
                                    <div className="font-semibold text-[#222222] dark:text-white">
                                        {req.medicine_name}
                                    </div>
                                    <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {req.generic_name}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'requested_qty',
                            label: 'Qty',
                            className: 'text-right',
                            render: (req) => (
                                <span className="font-mono font-bold whitespace-nowrap">
                                    {req.requested_qty}
                                </span>
                            ),
                        },
                        {
                            id: 'priority',
                            label: 'Priority',
                            render: (req) =>
                                req.priority === 'urgent' ? (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#D9534F] text-white">
                                        Urgent
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-slate-100 text-[#444444] border border-slate-200 dark:bg-slate-800 dark:text-slate-300">
                                        Normal
                                    </span>
                                ),
                        },
                        {
                            id: 'note',
                            label: 'Clinical Note',
                            render: (req) => (
                                <span className="text-[12px] text-[#555555] dark:text-slate-400">
                                    {req.note}
                                </span>
                            ),
                        },
                        {
                            id: 'status',
                            label: 'Status',
                            render: (req) => (
                                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 whitespace-nowrap">
                                    {req.status}
                                </span>
                            ),
                        },
                        {
                            id: 'requested_at',
                            label: 'Submitted',
                            className: 'text-right',
                            render: (req) => (
                                <div className="whitespace-nowrap">
                                    <div className="text-[12px] text-[#333333] dark:text-slate-200">
                                        {req.requested_by}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                        {req.requested_at}
                                    </div>
                                </div>
                            ),
                        },
                    ] as Column<PurchaseRequestEntry>[]}
                    keyExtractor={(req) => req.request_number}
                    searchPlaceholder="Search request # or medicine..."
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <h2 className="text-[14px] font-bold text-[#222222] dark:text-white pb-1.5">
                            Submitted purchase requests (
                            <span className="font-mono">{requests.length}</span>)
                        </h2>
                    }
                    emptyState={<EmptyState title="No purchase requests submitted yet." />}
                />
            </div>

            {/* New Purchase Request Modal */}
            <BrtaFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmitCustom}
                title="Submit Purchase Request"
                subtitle="Request stock replenishment for low or clinical-need medicines"
                icon={<ShoppingBag className="h-4 w-4" />}
                maxWidth="2xl"
                footerProps={{
                    submitLabel: 'Submit Request',
                    submitting,
                }}
            >
                <BrtaFormGrid>
                    <BrtaField label="Medicine Name" required className="md:col-span-2">
                        <input
                            type="text"
                            value={medicineName}
                            onChange={(e) => setMedicineName(e.target.value)}
                            placeholder="e.g. Sergel 20mg Capsule"
                            className={brtaInputClass}
                            required
                        />
                    </BrtaField>

                    <BrtaField label="Generic Name">
                        <input
                            type="text"
                            value={genericName}
                            onChange={(e) => setGenericName(e.target.value)}
                            placeholder="e.g. Esomeprazole"
                            className={brtaInputClass}
                        />
                    </BrtaField>

                    <BrtaField label="Quantity Needed" required>
                        <input
                            type="number"
                            min={1}
                            value={requestedQty}
                            onChange={(e) => setRequestedQty(e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>

                    <BrtaField label="Priority" className="md:col-span-2">
                        <BrtaOptionStrip>
                            <BrtaOptionItem>
                                <input
                                    type="radio"
                                    name="pr_priority"
                                    checked={priority === 'normal'}
                                    onChange={() => setPriority('normal')}
                                    className="text-[#0E5F3F] focus:ring-[#0E5F3F]"
                                />
                                <span>Normal</span>
                            </BrtaOptionItem>
                            <BrtaOptionItem>
                                <input
                                    type="radio"
                                    name="pr_priority"
                                    checked={priority === 'urgent'}
                                    onChange={() => setPriority('urgent')}
                                    className="text-[#D9534F] focus:ring-[#D9534F]"
                                />
                                <span className="text-[#C9302C] dark:text-rose-400">
                                    Urgent clinical need
                                </span>
                            </BrtaOptionItem>
                        </BrtaOptionStrip>
                    </BrtaField>

                    <BrtaField label="Reason / Ward Note" alignTop className="md:col-span-2">
                        <textarea
                            rows={2}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. Required for Emergency OPD refills"
                            className={brtaTextareaClass}
                        />
                    </BrtaField>
                </BrtaFormGrid>
            </BrtaFormModal>
        </AppLayout>
    );
}

