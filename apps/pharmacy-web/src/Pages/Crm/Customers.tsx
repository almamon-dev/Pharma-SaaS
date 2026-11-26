import React, { useMemo, useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Award,
    Edit,
    HeartPulse,
    Plus,
    ShoppingBag,
    Users,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { BrtaField, BrtaFormGrid, BrtaFormModal, brtaInputClass, brtaTextareaClass } from '@/Components/ui/BrtaForm';
import {
    DataTable,
    Column,
    EmptyState,
    TableActionMenu,
} from '@/Components/tables';
import { SharedPageProps } from '@/types';
import { formatCurrency } from '@/lib/format';

interface CustomerRow {
    id: number;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    allergies?: string | null;
    loyalty_points: number;
    sales_count: number;
    total_spent: number;
    created_at?: string | null;
}

interface CustomersProps {
    customers: CustomerRow[];
    tenantName?: string | null;
}

export default function CustomersIndex({
    customers,
    tenantName,
}: CustomersProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const currency = tenant?.currentTenant?.currency_code ?? 'BDT';
    const canManage = (tenant?.permissions ?? []).includes('crm.manage');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(
        null
    );

    const createForm = useForm({
        name: '',
        phone: '',
        email: '',
        address: '',
        allergies: '',
        loyalty_points: '0',
    });

    const editForm = useForm({
        name: '',
        phone: '',
        email: '',
        address: '',
        allergies: '',
        loyalty_points: '0',
    });

    const openEdit = (customer: CustomerRow) => {
        setEditingCustomer(customer);
        editForm.setData({
            name: customer.name,
            phone: customer.phone ?? '',
            email: customer.email ?? '',
            address: customer.address ?? '',
            allergies: customer.allergies ?? '',
            loyalty_points: String(customer.loyalty_points ?? 0),
        });
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(route('crm.customers.store'), {
            onSuccess: () => {
                setShowCreateModal(false);
                createForm.reset();
            },
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCustomer) return;
        editForm.put(route('crm.customers.update', editingCustomer.id), {
            onSuccess: () => setEditingCustomer(null),
        });
    };

    const totalLoyalty = customers.reduce(
        (acc, c) => acc + (c.loyalty_points || 0),
        0
    );
    const withAllergies = customers.filter((c) => Boolean(c.allergies)).length;

    const columns: Column<CustomerRow>[] = useMemo(
        () => [
            {
                id: 'name',
                label: 'Patient / Customer',
                sortable: true,
                render: (row) => (
                    <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {row.name}
                    </span>
                ),
            },
            {
                id: 'phone',
                label: 'Contact',
                render: (row) => (
                    <span className="block max-w-[230px] truncate text-[12px] text-slate-500 dark:text-slate-400">
                        {row.phone || '—'}
                        {row.email ? ` · ${row.email}` : ''}
                    </span>
                ),
            },
            {
                id: 'allergies',
                label: 'Allergies',
                render: (row) =>
                    row.allergies ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {row.allergies}
                        </span>
                    ) : (
                        <span className="text-[11.5px] text-slate-400">—</span>
                    ),
            },
            {
                id: 'loyalty_points',
                label: 'Points',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        {row.loyalty_points} pts
                    </span>
                ),
            },
            {
                id: 'sales_count',
                label: 'Invoices',
                sortable: true,
                className: 'text-right',
            },
            {
                id: 'total_spent',
                label: 'Lifetime Spend',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(row.total_spent, currency)}
                    </span>
                ),
            },
        ],
        [currency]
    );

    return (
        <AppLayout
            title="Customers & Patient CRM"
            subtitle={`Manage loyalty profiles, prescription allergy warnings & invoice spend for ${tenantName ?? 'your business'}`}
            actions={
                canManage && (
                    <Button
                        size="md"
                        variant="primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Customer
                    </Button>
                )
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <MetricCard
                    title="Registered Customers"
                    value={customers.length}
                    description="Active patient profiles in CRM"
                    icon={Users}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
                <MetricCard
                    title="Allergy Alerts Tracked"
                    value={withAllergies}
                    description="Customers with clinical notes"
                    icon={HeartPulse}
                    colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                />
                <MetricCard
                    title="Total Loyalty Balance"
                    value={`${totalLoyalty.toLocaleString()} pts`}
                    description="Earned via POS purchases"
                    icon={Award}
                    colorClass="bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 text-[#0E5F3F]"
                />
            </div>

            <DataTable<CustomerRow>
                data={customers}
                columns={columns}
                tableId="crm-customers-table"
                selectable={false}
                hideCheckbox
                syncUrlParams={false}
                searchPlaceholder="Search customer name, phone, allergies..."
                actions={
                    canManage
                        ? (row) => (
                              <TableActionMenu
                                  items={[
                                      {
                                          key: 'edit',
                                          label: 'Edit Customer',
                                          icon: <Edit className="h-3.5 w-3.5" />,
                                          onClick: () => openEdit(row),
                                      },
                                  ]}
                              />
                          )
                        : undefined
                }
                emptyState={
                    <EmptyState
                        title="No customers in CRM yet"
                        description="Add customer profiles to track allergies and loyalty rewards at POS checkout."
                        icon={Users}
                    />
                }
            />

            <BrtaFormModal
                open={Boolean(showCreateModal || editingCustomer)}
                onClose={() => {
                    setShowCreateModal(false);
                    setEditingCustomer(null);
                }}
                onSubmit={editingCustomer ? handleUpdate : handleCreate}
                title={editingCustomer ? `Edit ${editingCustomer.name}` : 'Add Customer to CRM'}
                icon={<ShoppingBag className="h-4 w-4" />}
                maxWidth="3xl"
                footerProps={{
                    cancelLabel: 'Cancel',
                    submitLabel: editingCustomer ? 'Save Customer' : 'Create Customer',
                    submitting: editingCustomer ? editForm.processing : createForm.processing,
                }}
            >
                <BrtaFormGrid>
                    <BrtaField label="Full Name" required>
                        <input
                            required
                            value={editingCustomer ? editForm.data.name : createForm.data.name}
                            onChange={(e) =>
                                editingCustomer
                                    ? editForm.setData('name', e.target.value)
                                    : createForm.setData('name', e.target.value)
                            }
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Phone Number">
                        <input
                            value={editingCustomer ? editForm.data.phone : createForm.data.phone}
                            onChange={(e) =>
                                editingCustomer
                                    ? editForm.setData('phone', e.target.value)
                                    : createForm.setData('phone', e.target.value)
                            }
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Email">
                        <input
                            type="email"
                            value={editingCustomer ? editForm.data.email : createForm.data.email}
                            onChange={(e) =>
                                editingCustomer
                                    ? editForm.setData('email', e.target.value)
                                    : createForm.setData('email', e.target.value)
                            }
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Loyalty Points">
                        <input
                            type="number"
                            min="0"
                            value={
                                editingCustomer
                                    ? editForm.data.loyalty_points
                                    : createForm.data.loyalty_points
                            }
                            onChange={(e) =>
                                editingCustomer
                                    ? editForm.setData('loyalty_points', e.target.value)
                                    : createForm.setData('loyalty_points', e.target.value)
                            }
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                </BrtaFormGrid>
                <BrtaField label="Drug Allergies">
                    <input
                        placeholder="e.g. Penicillin, Sulfa drugs"
                        value={editingCustomer ? editForm.data.allergies : createForm.data.allergies}
                        onChange={(e) =>
                            editingCustomer
                                ? editForm.setData('allergies', e.target.value)
                                : createForm.setData('allergies', e.target.value)
                        }
                        className={brtaInputClass}
                    />
                </BrtaField>
                <BrtaField label="Address" alignTop>
                    <textarea
                        rows={2}
                        value={editingCustomer ? editForm.data.address : createForm.data.address}
                        onChange={(e) =>
                            editingCustomer
                                ? editForm.setData('address', e.target.value)
                                : createForm.setData('address', e.target.value)
                        }
                        className={brtaTextareaClass}
                    />
                </BrtaField>
            </BrtaFormModal>
        </AppLayout>
    );
}
