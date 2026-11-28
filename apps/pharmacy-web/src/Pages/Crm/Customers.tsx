import React, { useMemo, useState } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Award,
    BellRing,
    Edit,
    Eye,
    GitBranch,
    HeartPulse,
    Plus,
    ShoppingBag,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { Button } from '@/Components/ui/Button';
import { Badge } from '@/Components/ui/Badge';
import Select from '@/Components/ui/select';
import {
    BrtaField,
    BrtaFormGrid,
    BrtaFormModal,
    brtaInputClass,
    brtaTextareaClass,
} from '@/Components/ui/BrtaForm';
import {
    Column,
    DataTable,
    EmptyState,
    TableActionMenu,
} from '@/Components/tables';
import { SharedPageProps } from '@/types';
import { formatCurrency } from '@/lib/format';

interface BranchOption {
    id: number;
    name: string;
}

interface CustomerRow {
    id: number;
    branch_id?: number | null;
    branch_name: string;
    customer_code?: string | null;
    segment: 'regular' | 'vip' | 'chronic' | 'credit';
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    allergies?: string | null;
    doctor_name?: string | null;
    notes?: string | null;
    loyalty_points: number;
    credit_limit: number;
    sales_count: number;
    total_spent: number;
    total_due: number;
    pending_followups_count: number;
    last_contacted_at?: string | null;
    created_at?: string | null;
}

interface ProfileSale {
    id: number;
    invoice_number: string;
    branch_name: string;
    sold_at: string;
    total_amount: number;
    paid_amount: number;
    due_amount: number;
    payment_status: string;
}

interface ProfileFollowup {
    id: number;
    followup_type: string;
    title: string;
    medicines_summary?: string | null;
    due_date: string;
    channel: string;
    status: string;
    branch_name: string;
    assignee_name?: string | null;
}

interface CustomerProfilePayload {
    customer: {
        id: number;
        name: string;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        branch_name: string;
        segment: string;
        allergies?: string | null;
        doctor_name?: string | null;
        notes?: string | null;
        loyalty_points: number;
        credit_limit: number;
        last_contacted_at?: string | null;
    };
    sales: ProfileSale[];
    followups: ProfileFollowup[];
}

interface CustomersProps {
    customers: CustomerRow[];
    branches: BranchOption[];
    selectedBranchId: number | null;
    tenantName?: string | null;
    currency?: string;
}

const SEGMENTS = [
    { value: 'regular', label: 'Regular Patient' },
    { value: 'chronic', label: 'Chronic / Refill Patient' },
    { value: 'vip', label: 'VIP Member' },
    { value: 'credit', label: 'Credit Account' },
];

export default function CustomersIndex({
    customers,
    branches,
    selectedBranchId,
    tenantName,
    currency: currencyProp,
}: CustomersProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const currency = currencyProp ?? tenant?.currentTenant?.currency_code ?? 'BDT';
    const canManage =
        (tenant?.permissions ?? []).includes('crm.manage') ||
        tenant?.role === 'admin' ||
        tenant?.role === 'manager' ||
        tenant?.role === 'pharmacist';

    const [segmentTab, setSegmentTab] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
    const [profileData, setProfileData] = useState<CustomerProfilePayload | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [collectingSale, setCollectingSale] = useState<ProfileSale | null>(null);

    const defaultBranchId = selectedBranchId
        ? String(selectedBranchId)
        : branches[0]
          ? String(branches[0].id)
          : '';

    const createForm = useForm({
        branch_id: defaultBranchId,
        segment: 'regular',
        name: '',
        phone: '',
        email: '',
        address: '',
        allergies: '',
        doctor_name: '',
        notes: '',
        loyalty_points: '0',
        credit_limit: '0',
    });

    const editForm = useForm({
        branch_id: defaultBranchId,
        segment: 'regular',
        name: '',
        phone: '',
        email: '',
        address: '',
        allergies: '',
        doctor_name: '',
        notes: '',
        loyalty_points: '0',
        credit_limit: '0',
    });

    const collectForm = useForm({
        sale_id: 0,
        amount: '',
        payment_method: 'cash',
        reference_number: '',
    });

    const openEdit = (customer: CustomerRow) => {
        setEditingCustomer(customer);
        editForm.setData({
            branch_id: customer.branch_id ? String(customer.branch_id) : defaultBranchId,
            segment: customer.segment ?? 'regular',
            name: customer.name,
            phone: customer.phone ?? '',
            email: customer.email ?? '',
            address: customer.address ?? '',
            allergies: customer.allergies ?? '',
            doctor_name: customer.doctor_name ?? '',
            notes: customer.notes ?? '',
            loyalty_points: String(customer.loyalty_points ?? 0),
            credit_limit: String(customer.credit_limit ?? 0),
        });
    };

    const fetchCustomerProfile = async (customerId: number) => {
        const res = await fetch(route('crm.customers.profile', customerId), {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        });
        if (!res.ok) throw new Error('Failed to load profile');
        return (await res.json()) as CustomerProfilePayload;
    };

    const openProfile = async (customer: CustomerRow) => {
        setProfileLoading(true);
        setProfileData(null);
        try {
            setProfileData(await fetchCustomerProfile(customer.id));
        } finally {
            setProfileLoading(false);
        }
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

    const openCollectDue = (sale: ProfileSale) => {
        setCollectingSale(sale);
        collectForm.setData({
            sale_id: sale.id,
            amount: String(sale.due_amount),
            payment_method: 'cash',
            reference_number: '',
        });
    };

    const handleCollectDue = (e: React.FormEvent) => {
        e.preventDefault();
        if (!profileData || !collectingSale) return;
        const custId = profileData.customer.id;
        collectForm.post(route('crm.customers.collect-due', custId), {
            preserveScroll: true,
            onSuccess: async () => {
                setCollectingSale(null);
                setProfileData(await fetchCustomerProfile(custId));
            },
        });
    };

    const totalDue = customers.reduce((acc, c) => acc + (c.total_due || 0), 0);
    const totalLoyalty = customers.reduce((acc, c) => acc + (c.loyalty_points || 0), 0);
    const withAllergies = customers.filter((c) => Boolean(c.allergies)).length;

    const filteredCustomers = useMemo(() => {
        if (segmentTab === 'all') return customers;
        if (segmentTab === 'with_due') return customers.filter((c) => c.total_due > 0);
        return customers.filter((c) => c.segment === segmentTab);
    }, [customers, segmentTab]);

    const columns: Column<CustomerRow>[] = useMemo(
        () => [
            {
                id: 'name',
                label: 'Patient / Customer',
                sortable: true,
                render: (row) => (
                    <div>
                        <button
                            type="button"
                            onClick={() => openProfile(row)}
                            className="font-semibold text-slate-900 dark:text-slate-100 hover:text-[#0E5F3F] cursor-pointer text-left whitespace-nowrap"
                        >
                            {row.name}
                        </button>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <GitBranch className="h-3 w-3 text-[#0E5F3F]" />
                            {row.branch_name}
                            {row.doctor_name ? ` · ${row.doctor_name}` : ''}
                        </div>
                    </div>
                ),
            },
            {
                id: 'segment',
                label: 'Segment',
                sortable: true,
                render: (row) => {
                    const variant =
                        row.segment === 'vip'
                            ? 'success'
                            : row.segment === 'chronic'
                              ? 'sky'
                              : row.segment === 'credit'
                                ? 'amber'
                                : 'slate';
                    const labels: Record<string, string> = {
                        regular: 'Regular',
                        vip: 'VIP',
                        chronic: 'Chronic Refill',
                        credit: 'Credit',
                    };
                    return <Badge variant={variant}>{labels[row.segment] ?? row.segment}</Badge>;
                },
            },
            {
                id: 'phone',
                label: 'Contact',
                render: (row) => (
                    <div className="text-[12px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div>{row.phone || '—'}</div>
                        {row.allergies && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="h-3 w-3" />
                                {row.allergies}
                            </div>
                        )}
                    </div>
                ),
            },
            {
                id: 'pending_followups_count',
                label: 'Reminders',
                sortable: true,
                render: (row) =>
                    row.pending_followups_count > 0 ? (
                        <Badge variant="amber">{row.pending_followups_count} open</Badge>
                    ) : (
                        <span className="text-[11.5px] text-slate-400">—</span>
                    ),
            },
            {
                id: 'total_due',
                label: 'Due Balance',
                sortable: true,
                className: 'text-right',
                render: (row) =>
                    row.total_due > 0 ? (
                        <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {formatCurrency(row.total_due, currency)}
                        </span>
                    ) : (
                        <span className="text-[11.5px] text-slate-400">Clear</span>
                    ),
            },
            {
                id: 'total_spent',
                label: 'Lifetime Spend',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <div className="text-right whitespace-nowrap">
                        <div className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {formatCurrency(row.total_spent, currency)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                            {row.sales_count} invoices · {row.loyalty_points} pts
                        </div>
                    </div>
                ),
            },
        ],
        [currency]
    );

    const branchFilterOptions = [
        { value: 'all', label: 'All Branches' },
        ...branches.map((b) => ({ value: String(b.id), label: b.name })),
    ];

    const activeForm = editingCustomer ? editForm : createForm;

    return (
        <AppLayout
            title="Customers & Patient CRM"
            subtitle={`Branch-wise patient profiles, due tracking, chronic refill notes & purchase history for ${tenantName ?? 'your business'}`}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <div className="w-44">
                        <Select
                            value={selectedBranchId ? String(selectedBranchId) : 'all'}
                            onChange={(val) =>
                                router.get(
                                    route('crm.customers'),
                                    String(val) === 'all' ? {} : { branch_id: String(val) },
                                    { preserveState: true, preserveScroll: true }
                                )
                            }
                            options={branchFilterOptions}
                            size="sm"
                        />
                    </div>
                    <Link href={route('crm.followups')}>
                        <Button size="md" variant="secondary">
                            <BellRing className="h-3.5 w-3.5" />
                            Refills & Follow-ups
                        </Button>
                    </Link>
                    {canManage && (
                        <Button
                            size="md"
                            variant="primary"
                            onClick={() => setShowCreateModal(true)}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Customer
                        </Button>
                    )}
                </div>
            }
        >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <MetricCard
                    title="Registered Customers"
                    value={customers.length}
                    description="Active branch CRM profiles"
                    icon={Users}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
                <MetricCard
                    title="Total Receivable Due"
                    value={formatCurrency(totalDue, currency)}
                    description={`${customers.filter((c) => c.total_due > 0).length} customers with due`}
                    icon={Wallet}
                    colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                />
                <MetricCard
                    title="Allergy Alerts"
                    value={withAllergies}
                    description="Patients with clinical warnings"
                    icon={HeartPulse}
                    colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                />
                <MetricCard
                    title="Loyalty Points Pool"
                    value={`${totalLoyalty.toLocaleString()} pts`}
                    description="Earned via POS purchases"
                    icon={Award}
                    colorClass="bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 text-[#0E5F3F]"
                />
            </div>

            <DataTable<CustomerRow>
                data={filteredCustomers}
                columns={columns}
                tableId="crm-customers-table"
                selectable={false}
                hideCheckbox
                syncUrlParams={false}
                searchPlaceholder="Search customer name, phone, doctor, allergies..."
                headerTabs={
                    <div className="flex items-center gap-1 overflow-x-auto">
                        {[
                            { key: 'all', label: 'All Customers', count: customers.length },
                            { key: 'chronic', label: 'Chronic Refill', count: customers.filter((c) => c.segment === 'chronic').length },
                            { key: 'vip', label: 'VIP', count: customers.filter((c) => c.segment === 'vip').length },
                            { key: 'credit', label: 'Credit', count: customers.filter((c) => c.segment === 'credit').length },
                            { key: 'with_due', label: 'With Due', count: customers.filter((c) => c.total_due > 0).length },
                        ].map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setSegmentTab(t.key)}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                                    segmentTab === t.key
                                        ? 'border-[#0E5F3F] text-[#0E5F3F] font-semibold'
                                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                <span>{t.label}</span>
                                <span className={`px-1.5 py-0.5 text-[11px] rounded-full font-mono ${segmentTab === t.key ? 'bg-[#EAF5F0] text-[#0E5F3F]' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    {t.count}
                                </span>
                            </button>
                        ))}
                    </div>
                }
                actions={(row) => (
                    <TableActionMenu
                        items={[
                            {
                                key: 'profile',
                                label: 'Customer 360 & Dues',
                                icon: <Eye className="h-3.5 w-3.5 text-[#0E5F3F]" />,
                                onClick: () => openProfile(row),
                            },
                            ...(canManage
                                ? [
                                      {
                                          key: 'edit',
                                          label: 'Edit Customer',
                                          icon: <Edit className="h-3.5 w-3.5" />,
                                          onClick: () => openEdit(row),
                                      },
                                  ]
                                : []),
                        ]}
                    />
                )}
                emptyState={
                    <EmptyState
                        title="No customers in CRM yet"
                        description="Add customer profiles to track branch dues, allergies, refill reminders, and loyalty rewards."
                        icon={Users}
                    />
                }
            />

            {/* Create / Edit Customer Modal */}
            <BrtaFormModal
                open={Boolean(showCreateModal || editingCustomer)}
                onClose={() => {
                    setShowCreateModal(false);
                    setEditingCustomer(null);
                }}
                onSubmit={editingCustomer ? handleUpdate : handleCreate}
                title={editingCustomer ? `Edit ${editingCustomer.name}` : 'Add Customer to CRM'}
                icon={<ShoppingBag className="h-4 w-4" />}
                maxWidth="4xl"
                footerProps={{
                    cancelLabel: 'Cancel',
                    submitLabel: editingCustomer ? 'Save Customer' : 'Create Customer',
                    submitting: activeForm.processing,
                }}
            >
                <BrtaFormGrid>
                    <BrtaField label="Full Name" required>
                        <input
                            required
                            value={activeForm.data.name}
                            onChange={(e) => activeForm.setData('name', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Home Branch">
                        <Select
                            value={activeForm.data.branch_id}
                            onChange={(val) => activeForm.setData('branch_id', String(val))}
                            options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
                            placeholder="Select Branch"
                        />
                    </BrtaField>
                    <BrtaField label="Phone Number">
                        <input
                            value={activeForm.data.phone}
                            onChange={(e) => activeForm.setData('phone', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Customer Segment">
                        <Select
                            value={activeForm.data.segment}
                            onChange={(val) => activeForm.setData('segment', String(val))}
                            options={SEGMENTS}
                        />
                    </BrtaField>
                    <BrtaField label="Email">
                        <input
                            type="email"
                            value={activeForm.data.email}
                            onChange={(e) => activeForm.setData('email', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Regular Doctor">
                        <input
                            placeholder="e.g. Dr. Kamrul Islam"
                            value={activeForm.data.doctor_name}
                            onChange={(e) => activeForm.setData('doctor_name', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Credit Limit">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={activeForm.data.credit_limit}
                            onChange={(e) => activeForm.setData('credit_limit', e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                    <BrtaField label="Loyalty Points">
                        <input
                            type="number"
                            min="0"
                            value={activeForm.data.loyalty_points}
                            onChange={(e) => activeForm.setData('loyalty_points', e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                </BrtaFormGrid>
                <BrtaField label="Drug Allergies">
                    <input
                        placeholder="e.g. Penicillin, Sulfa drugs"
                        value={activeForm.data.allergies}
                        onChange={(e) => activeForm.setData('allergies', e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
                <BrtaField label="Address" alignTop>
                    <textarea
                        rows={2}
                        value={activeForm.data.address}
                        onChange={(e) => activeForm.setData('address', e.target.value)}
                        className={brtaTextareaClass}
                    />
                </BrtaField>
                <BrtaField label="CRM Notes" alignTop>
                    <textarea
                        rows={2}
                        placeholder="Preferred delivery window, chronic medicines, special billing note..."
                        value={activeForm.data.notes}
                        onChange={(e) => activeForm.setData('notes', e.target.value)}
                        className={brtaTextareaClass}
                    />
                </BrtaField>
            </BrtaFormModal>

            {/* Customer 360 Profile Modal */}
            {(profileLoading || profileData) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-[3px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161b22] shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-900">
                            <div>
                                <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
                                    {profileLoading ? 'Loading Customer 360...' : profileData?.customer.name}
                                </h3>
                                {profileData && (
                                    <p className="text-[12px] text-slate-500">
                                        {profileData.customer.branch_name} · {profileData.customer.phone || 'No phone'}
                                        {profileData.customer.doctor_name ? ` · ${profileData.customer.doctor_name}` : ''}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setProfileData(null);
                                    setProfileLoading(false);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {profileLoading && (
                                <div className="py-12 text-center text-[13px] text-slate-500">
                                    Fetching purchase history, dues, and refill reminders...
                                </div>
                            )}

                            {profileData && (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12.5px]">
                                        <div className="rounded-[2px] border border-slate-200 dark:border-slate-800 p-3">
                                            <div className="text-[11px] text-slate-400">Segment</div>
                                            <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 capitalize">
                                                {profileData.customer.segment}
                                            </div>
                                        </div>
                                        <div className="rounded-[2px] border border-slate-200 dark:border-slate-800 p-3">
                                            <div className="text-[11px] text-slate-400">Credit Limit</div>
                                            <div className="font-semibold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                                                {formatCurrency(profileData.customer.credit_limit, currency)}
                                            </div>
                                        </div>
                                        <div className="rounded-[2px] border border-slate-200 dark:border-slate-800 p-3">
                                            <div className="text-[11px] text-slate-400">Loyalty Points</div>
                                            <div className="font-semibold font-mono text-[#0E5F3F] mt-0.5">
                                                {profileData.customer.loyalty_points} pts
                                            </div>
                                        </div>
                                        <div className="rounded-[2px] border border-slate-200 dark:border-slate-800 p-3">
                                            <div className="text-[11px] text-slate-400">Last Contacted</div>
                                            <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                                                {profileData.customer.last_contacted_at || 'Not recorded'}
                                            </div>
                                        </div>
                                    </div>

                                    {profileData.customer.allergies && (
                                        <div className="rounded-[2px] border border-rose-200 bg-rose-50/70 dark:bg-rose-950/20 dark:border-rose-900/40 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:text-rose-300 flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 shrink-0" />
                                            <span>
                                                <strong>Drug Allergies:</strong> {profileData.customer.allergies}
                                            </span>
                                        </div>
                                    )}

                                    {/* Recent Sales & Due Collection */}
                                    <div>
                                        <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-200 mb-2">
                                            Recent Invoices & Due Collection ({profileData.sales.length})
                                        </h4>
                                        {profileData.sales.length === 0 ? (
                                            <div className="text-[12.5px] text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2px] p-4 text-center">
                                                No completed sales invoices found for this customer yet.
                                            </div>
                                        ) : (
                                            <div className="border border-slate-200 dark:border-slate-800 rounded-[2px] overflow-x-auto">
                                                <table className="w-full text-[12.5px]">
                                                    <thead className="bg-[#f8fafc] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                                                        <tr>
                                                            <th className="text-left px-3 py-2 font-semibold">Invoice</th>
                                                            <th className="text-left px-3 py-2 font-semibold">Date & Branch</th>
                                                            <th className="text-right px-3 py-2 font-semibold">Total</th>
                                                            <th className="text-right px-3 py-2 font-semibold">Due</th>
                                                            <th className="text-right px-3 py-2 font-semibold">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {profileData.sales.map((s) => (
                                                            <tr key={s.id}>
                                                                <td className="px-3 py-2 font-mono font-medium">{s.invoice_number}</td>
                                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                                                    {s.sold_at} · {s.branch_name}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono">
                                                                    {formatCurrency(s.total_amount, currency)}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono font-semibold text-rose-600">
                                                                    {s.due_amount > 0 ? formatCurrency(s.due_amount, currency) : '—'}
                                                                </td>
                                                                <td className="px-3 py-2 text-right">
                                                                    {s.due_amount > 0 ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openCollectDue(s)}
                                                                            className="px-2.5 py-1 text-[11.5px] font-medium rounded-[2px] bg-[#0E5F3F] text-white hover:bg-[#0B4D32] cursor-pointer"
                                                                        >
                                                                            Collect Due
                                                                        </button>
                                                                    ) : (
                                                                        <Badge variant="success">Paid</Badge>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Refill & Follow-up Reminders */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-200">
                                                Refill & Follow-up Reminders ({profileData.followups.length})
                                            </h4>
                                            <Link
                                                href={route('crm.followups')}
                                                className="text-[12px] font-medium text-[#0E5F3F] hover:underline"
                                            >
                                                Manage all reminders →
                                            </Link>
                                        </div>
                                        {profileData.followups.length === 0 ? (
                                            <div className="text-[12.5px] text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2px] p-4 text-center">
                                                No refill or follow-up reminders scheduled for this patient.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {profileData.followups.map((f) => (
                                                    <div
                                                        key={f.id}
                                                        className="flex items-center justify-between gap-3 rounded-[2px] border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-[12.5px]"
                                                    >
                                                        <div>
                                                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                                                                {f.title}
                                                            </div>
                                                            <div className="text-[11.5px] text-slate-500">
                                                                Due {f.due_date} · via {f.channel}
                                                                {f.medicines_summary ? ` · ${f.medicines_summary}` : ''}
                                                            </div>
                                                        </div>
                                                        <Badge
                                                            variant={
                                                                f.status === 'completed'
                                                                    ? 'success'
                                                                    : f.status === 'contacted'
                                                                      ? 'sky'
                                                                      : 'amber'
                                                            }
                                                        >
                                                            {f.status}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Collect Due Modal */}
            <BrtaFormModal
                open={Boolean(collectingSale)}
                onClose={() => setCollectingSale(null)}
                onSubmit={handleCollectDue}
                title={collectingSale ? `Collect Due — ${collectingSale.invoice_number}` : 'Collect Due'}
                icon={<Wallet className="h-4 w-4" />}
                maxWidth="xl"
                footerProps={{
                    cancelLabel: 'Cancel',
                    submitLabel: 'Record Payment',
                    submitting: collectForm.processing,
                }}
            >
                <BrtaFormGrid>
                    <BrtaField label="Amount" required>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={collectingSale?.due_amount}
                            required
                            value={collectForm.data.amount}
                            onChange={(e) => collectForm.setData('amount', e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                    <BrtaField label="Payment Method" required>
                        <Select
                            value={collectForm.data.payment_method}
                            onChange={(val) => collectForm.setData('payment_method', String(val))}
                            options={[
                                { value: 'cash', label: 'Cash' },
                                { value: 'bkash', label: 'bKash' },
                                { value: 'nagad', label: 'Nagad' },
                                { value: 'card', label: 'Card' },
                                { value: 'bank', label: 'Bank Transfer' },
                            ]}
                        />
                    </BrtaField>
                </BrtaFormGrid>
                <BrtaField label="Reference / TrxID">
                    <input
                        value={collectForm.data.reference_number}
                        onChange={(e) => collectForm.setData('reference_number', e.target.value)}
                        placeholder="Optional bKash TrxID or receipt reference"
                        className={brtaInputClass}
                    />
                </BrtaField>
            </BrtaFormModal>
        </AppLayout>
    );
}
