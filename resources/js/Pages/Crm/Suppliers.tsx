import React, { useMemo, useState } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    PackageCheck,
    Plus,
    Power,
    Truck,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { FormLayoutProvider } from '@/Components/ui/FormLayout';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import {
    DataTable,
    Column,
    EmptyState,
    TableActionMenu,
} from '@/Components/tables';
import { SharedPageProps } from '@/types';

interface SupplierRow {
    id: number;
    name: string;
    contact_person?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    tax_number?: string | null;
    payment_terms?: string | null;
    is_active: boolean;
    batches_count: number;
}

interface SuppliersProps {
    suppliers: SupplierRow[];
    tenantName?: string | null;
}

export default function SuppliersIndex({
    suppliers,
    tenantName,
}: SuppliersProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const canManage = (tenant?.permissions ?? []).includes('crm.manage');
    const [showCreateModal, setShowCreateModal] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        tax_number: '',
        payment_terms: 'Net-15',
        address: '',
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('crm.suppliers.store'), {
            onSuccess: () => {
                setShowCreateModal(false);
                reset();
            },
        });
    };

    const toggleSupplier = (supplierId: number) => {
        router.patch(
            route('crm.suppliers.toggle', supplierId),
            {},
            { preserveScroll: true }
        );
    };

    const activeCount = suppliers.filter((s) => s.is_active).length;

    const columns: Column<SupplierRow>[] = useMemo(
        () => [
            {
                id: 'name',
                label: 'Supplier',
                sortable: true,
                render: (row) => (
                    <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {row.name}
                    </span>
                ),
            },
            {
                id: 'address',
                label: 'Address',
                render: (row) => (
                    <span
                        className="block max-w-[190px] truncate text-[12px] text-slate-500 dark:text-slate-400"
                        title={row.address || ''}
                    >
                        {row.address || '—'}
                    </span>
                ),
            },
            {
                id: 'contact_person',
                label: 'Contact Rep',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                            {row.contact_person || '—'}
                        </span>
                        {(row.phone || row.email) && (
                            <span className="text-[11px] text-slate-400">
                                · {row.phone || row.email}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'payment_terms',
                label: 'Terms & Tax ID',
                render: (row) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-[12px] text-slate-700 dark:text-slate-200">
                            {row.payment_terms || 'Standard'}
                        </span>
                        {row.tax_number && (
                            <span className="font-mono text-[11px] text-slate-400">
                                · {row.tax_number}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'batches_count',
                label: 'Batches',
                sortable: true,
                className: 'text-right',
            },
            {
                id: 'is_active',
                label: 'Status',
                sortable: true,
                render: (row) => (
                    <StatusDot variant={row.is_active ? 'emerald' : 'slate'}>
                        {row.is_active ? 'Active' : 'Disabled'}
                    </StatusDot>
                ),
            },
        ],
        []
    );

    return (
        <AppLayout
            title="Suppliers & Distributors CRM"
            subtitle={`Manage pharmaceutical distributors and procurement terms for ${tenantName ?? 'your business'}`}
            actions={
                canManage && (
                    <Button
                        size="md"
                        variant="primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Supplier
                    </Button>
                )
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <MetricCard
                    title="Total Distributors"
                    value={suppliers.length}
                    description="Registered supplier partners"
                    icon={Truck}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
                <MetricCard
                    title="Active Suppliers"
                    value={activeCount}
                    description="Ready for stock intake"
                    icon={CheckCircle2}
                    colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                />
                <MetricCard
                    title="Batches Supplied"
                    value={suppliers.reduce(
                        (sum, s) => sum + s.batches_count,
                        0
                    )}
                    description="Linked to FEFO inventory"
                    icon={PackageCheck}
                    colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                />
            </div>

            <DataTable<SupplierRow>
                data={suppliers}
                columns={columns}
                tableId="crm-suppliers-table"
                selectable={false}
                hideCheckbox
                syncUrlParams={false}
                searchPlaceholder="Search distributor name, contact rep, phone..."
                actions={
                    canManage
                        ? (row) => (
                              <TableActionMenu
                                  items={[
                                      {
                                          key: 'toggle',
                                          label: row.is_active
                                              ? 'Disable Supplier'
                                              : 'Activate Supplier',
                                          icon: <Power className="h-3.5 w-3.5" />,
                                          variant: row.is_active
                                              ? 'danger'
                                              : 'brand',
                                          onClick: () => toggleSupplier(row.id),
                                      },
                                  ]}
                              />
                          )
                        : undefined
                }
                emptyState={
                    <EmptyState
                        title="No suppliers registered yet"
                        description="Add medicine wholesalers and distributors to track supply chain batches."
                        icon={Truck}
                    />
                }
            />

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e2329] shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-[#FF4A1F]" />
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Register Distributor Supplier
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="text-slate-400 hover:text-slate-700"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <FormLayoutProvider labelWidth="sm:w-[140px]">
                            <form onSubmit={handleCreate} className="p-5 space-y-3">
                                <Input
                                    label="Company Name"
                                    required
                                    placeholder="e.g. Incepta Pharmaceuticals Dist."
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    error={errors.name}
                                />
                                <Input
                                    label="Contact Person"
                                    value={data.contact_person}
                                    onChange={(e) =>
                                        setData(
                                            'contact_person',
                                            e.target.value
                                        )
                                    }
                                />
                                <Input
                                    label="Phone Number"
                                    value={data.phone}
                                    onChange={(e) =>
                                        setData('phone', e.target.value)
                                    }
                                />
                                <Input
                                    label="Email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) =>
                                        setData('email', e.target.value)
                                    }
                                />
                                <Input
                                    label="Payment Terms"
                                    placeholder="Net-15 / Cash"
                                    value={data.payment_terms}
                                    onChange={(e) =>
                                        setData('payment_terms', e.target.value)
                                    }
                                />
                                <Input
                                    label="Tax / VAT Reg No."
                                    value={data.tax_number}
                                    onChange={(e) =>
                                        setData('tax_number', e.target.value)
                                    }
                                />
                                <Textarea
                                    label="Warehouse Address"
                                    rows={2}
                                    value={data.address}
                                    onChange={(e) =>
                                        setData('address', e.target.value)
                                    }
                                />

                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setShowCreateModal(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        isLoading={processing}
                                    >
                                        Add Supplier
                                    </Button>
                                </div>
                            </form>
                        </FormLayoutProvider>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
