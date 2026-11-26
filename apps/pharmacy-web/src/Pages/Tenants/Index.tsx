import React, { useMemo, useState } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRightLeft,
    Building2,
    Edit,
    ExternalLink,
    GitBranch,
    Globe,
    Plus,
    Store,
    Users,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { Textarea } from '@/Components/ui/Textarea';
import { BrtaField, BrtaFormGrid, BrtaFormModal, brtaInputClass, brtaTextareaClass } from '@/Components/ui/BrtaForm';
import {
    DataTable,
    Column,
    EmptyState,
    TableActionMenu,
} from '@/Components/tables';
import { SharedPageProps, SubscriptionUsage } from '@/types';

interface TenantRow {
    id: number;
    name: string;
    slug: string;
    domain: string;
    domain_url: string;
    license_number?: string | null;
    phone?: string | null;
    email?: string | null;
    city?: string | null;
    address?: string | null;
    currency_code: string;
    status: string;
    branches_count: number;
    users_count: number;
    medicines_count: number;
    sales_count: number;
    is_current: boolean;
}

interface TenantsIndexProps {
    tenants: TenantRow[];
    usage: SubscriptionUsage;
    canManageTenants: boolean;
    baseDomain: string;
}

const currencyOptions = [
    { id: 'BDT', value: 'BDT', name: 'BDT (৳) — Bangladeshi Taka' },
    { id: 'USD', value: 'USD', name: 'USD ($) — US Dollar' },
    { id: 'EUR', value: 'EUR', name: 'EUR (€) — Euro' },
    { id: 'GBP', value: 'GBP', name: 'GBP (£) — British Pound' },
];

export default function TenantsIndex({
    tenants,
    usage,
    canManageTenants,
    baseDomain,
}: TenantsIndexProps) {
    const { tenant: sharedTenant } = usePage<SharedPageProps>().props;
    const canManageBranches = (sharedTenant?.enabledFeatures ?? []).includes(
        'branches'
    );
    const [showCreateModal, setShowCreateModal] = useState(
        tenants.length === 0
    );
    const [editingTenant, setEditingTenant] = useState<TenantRow | null>(null);

    const createForm = useForm({
        name: '',
        domain: '',
        branch_name: 'Head Office',
        branch_code: 'HO',
        license_number: '',
        phone: '',
        email: '',
        city: '',
        address: '',
        currency_code: 'BDT',
    });

    const editForm = useForm({
        name: '',
        domain: '',
        license_number: '',
        phone: '',
        email: '',
        city: '',
        address: '',
        currency_code: 'BDT',
        status: 'active',
    });

    const openEditModal = (tenant: TenantRow) => {
        setEditingTenant(tenant);
        editForm.setData({
            name: tenant.name,
            domain: tenant.domain ?? '',
            license_number: tenant.license_number ?? '',
            phone: tenant.phone ?? '',
            email: tenant.email ?? '',
            city: tenant.city ?? '',
            address: tenant.address ?? '',
            currency_code: tenant.currency_code ?? 'BDT',
            status: tenant.status ?? 'active',
        });
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(route('tenants.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setShowCreateModal(false);
                createForm.reset();
            },
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTenant) return;
        editForm.put(route('tenants.update', editingTenant.id), {
            preserveScroll: true,
            onSuccess: () => setEditingTenant(null),
        });
    };

    const switchWorkspace = (tenantId: number) => {
        router.post(route('tenant.switch'), { tenant_id: tenantId });
    };

    const columns: Column<TenantRow>[] = useMemo(
        () => [
            {
                id: 'name',
                label: 'Business Tenant',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.name}
                        </span>
                        {row.is_current && (
                            <StatusDot variant="brand">Current</StatusDot>
                        )}
                    </div>
                ),
            },
            {
                id: 'domain',
                label: 'Domain',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <a
                            href={row.domain_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 tabular-nums text-[11.5px] text-[#0E5F3F] hover:underline"
                        >
                            <Globe className="h-3 w-3 shrink-0" />
                            {row.domain}
                        </a>
                        {row.city && (
                            <span className="text-[11px] text-slate-400">
                                · {row.city}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'branches_count',
                label: 'Branches',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {row.branches_count}
                    </span>
                ),
            },
            {
                id: 'users_count',
                label: 'Employees',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {row.users_count}
                    </span>
                ),
            },
            {
                id: 'medicines_count',
                label: 'Catalog SKUs',
                sortable: true,
                className: 'text-right',
            },
            {
                id: 'sales_count',
                label: 'POS Orders',
                sortable: true,
                className: 'text-right',
            },
            {
                id: 'status',
                label: 'Status',
                sortable: true,
                render: (row) => (
                    <StatusDot
                        variant={row.status === 'active' ? 'emerald' : 'slate'}
                        className="capitalize"
                    >
                        {row.status}
                    </StatusDot>
                ),
            },
        ],
        []
    );

    const canCreateMore = usage.tenants < usage.max_tenants;

    return (
        <AppLayout
            title="Business Tenants"
            subtitle="Create and manage isolated pharmacy business tenants operating under your subscription quota."
            actions={
                canManageTenants && (
                    <Button
                        size="md"
                        variant="primary"
                        disabled={!canCreateMore}
                        onClick={() => setShowCreateModal(true)}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Business Tenant
                    </Button>
                )
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <MetricCard
                    title="Business Tenants Quota"
                    value={`${usage.tenants} / ${usage.max_tenants}`}
                    description={
                        canCreateMore
                            ? 'Add multiple businesses under this subscription'
                            : 'Tenant limit reached — upgrade on Plans page'
                    }
                    icon={Store}
                    colorClass={
                        canCreateMore
                            ? 'bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 text-[#0E5F3F]'
                            : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
                    }
                />
                <MetricCard
                    title="Branches Across Tenants"
                    value={`${usage.branches} / ${usage.max_branches}`}
                    description="Manage outlets per business tenant"
                    icon={GitBranch}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
                <MetricCard
                    title="Staff Seats Used"
                    value={`${usage.employees} / ${usage.max_users}`}
                    description="Unique active employees across tenants"
                    icon={Users}
                    colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                />
            </div>

            <DataTable<TenantRow>
                data={tenants}
                columns={columns}
                tableId="tenants-table"
                selectable={false}
                hideCheckbox
                syncUrlParams={false}
                searchPlaceholder="Search business tenant name, domain, city..."
                actions={(row) => (
                    <TableActionMenu
                        items={[
                            {
                                key: 'open',
                                label: 'Open Domain',
                                icon: <ExternalLink className="h-3.5 w-3.5" />,
                                href: row.domain_url,
                                target: '_blank',
                                hidden: row.status !== 'active',
                            },
                            {
                                key: 'switch',
                                label: 'Switch Workspace',
                                icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
                                onClick: () => switchWorkspace(row.id),
                                variant: 'brand',
                                hidden: row.is_current || row.status !== 'active',
                            },
                            {
                                key: 'branches',
                                label: `Manage Branches (${row.branches_count})`,
                                icon: <GitBranch className="h-3.5 w-3.5" />,
                                onClick: () =>
                                    router.visit(
                                        `${route('branches.index')}?tenant_id=${row.id}`
                                    ),
                                hidden: !canManageBranches,
                            },
                            {
                                key: 'edit',
                                label: 'Edit Details & Domain',
                                icon: <Edit className="h-3.5 w-3.5" />,
                                onClick: () => openEditModal(row),
                                hidden: !canManageTenants,
                            },
                        ]}
                    />
                )}
                emptyState={
                    <EmptyState
                        title="No business tenants yet"
                        description="Click Add Business Tenant to create your first pharmacy business workspace."
                        icon={Store}
                    />
                }
            />

            <BrtaFormModal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreate}
                title="Create Business Tenant"
                icon={<Building2 className="h-4 w-4" />}
                maxWidth="4xl"
                footerProps={{
                    cancelLabel: 'Cancel',
                    submitLabel: 'Create Tenant Workspace',
                    submitting: createForm.processing,
                }}
            >
                <BrtaFormGrid>
                    <BrtaField label="Business Name" required error={createForm.errors.name}>
                        <input
                            required
                            placeholder="CityMed Express Pharmacy"
                            value={createForm.data.name}
                            onChange={(e) => createForm.setData('name', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField
                        label="Subdomain"
                        error={createForm.errors.domain}
                        hint={`Optional. Auto-generates under .${baseDomain} or accepts custom domain.`}
                    >
                        <input
                            placeholder="citymed-express"
                            value={createForm.data.domain}
                            onChange={(e) => createForm.setData('domain', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Head Office Branch" required error={createForm.errors.branch_name}>
                        <input
                            required
                            placeholder="Head Office"
                            value={createForm.data.branch_name}
                            onChange={(e) => createForm.setData('branch_name', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Head Office Code" required error={createForm.errors.branch_code}>
                        <input
                            required
                            placeholder="HO"
                            value={createForm.data.branch_code}
                            onChange={(e) => createForm.setData('branch_code', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="License Number" error={createForm.errors.license_number}>
                        <input
                            placeholder="DGDA-2026-009"
                            value={createForm.data.license_number}
                            onChange={(e) => createForm.setData('license_number', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Currency">
                        <Select
                            value={createForm.data.currency_code}
                            options={currencyOptions}
                            onChange={(e) => createForm.setData('currency_code', String(e.target.value))}
                        />
                    </BrtaField>
                    <BrtaField label="Phone" error={createForm.errors.phone}>
                        <input
                            placeholder="+880 1711-000000"
                            value={createForm.data.phone}
                            onChange={(e) => createForm.setData('phone', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="City" error={createForm.errors.city}>
                        <input
                            placeholder="Dhaka"
                            value={createForm.data.city}
                            onChange={(e) => createForm.setData('city', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                </BrtaFormGrid>
                <BrtaField label="Street Address" alignTop error={createForm.errors.address}>
                    <textarea
                        rows={2}
                        value={createForm.data.address}
                        onChange={(e) => createForm.setData('address', e.target.value)}
                        className={brtaTextareaClass}
                    />
                </BrtaField>
            </BrtaFormModal>

            <BrtaFormModal
                open={Boolean(editingTenant)}
                onClose={() => setEditingTenant(null)}
                onSubmit={handleUpdate}
                title={editingTenant ? `Edit ${editingTenant.name}` : 'Edit Business Tenant'}
                icon={<Building2 className="h-4 w-4" />}
                maxWidth="4xl"
                footerProps={{
                    cancelLabel: 'Cancel',
                    submitLabel: 'Save Changes',
                    submitting: editForm.processing,
                }}
            >
                <BrtaFormGrid>
                    <BrtaField label="Business Name" required error={editForm.errors.name}>
                        <input
                            required
                            value={editForm.data.name}
                            onChange={(e) => editForm.setData('name', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Subdomain" error={editForm.errors.domain}>
                        <input
                            placeholder={`citymed.${baseDomain}`}
                            value={editForm.data.domain}
                            onChange={(e) => editForm.setData('domain', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="License Number" error={editForm.errors.license_number}>
                        <input
                            value={editForm.data.license_number}
                            onChange={(e) => editForm.setData('license_number', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Status">
                        <Select
                            value={editForm.data.status}
                            options={[
                                { id: 'active', value: 'active', name: 'Active' },
                                { id: 'inactive', value: 'inactive', name: 'Inactive' },
                            ]}
                            onChange={(e) => editForm.setData('status', String(e.target.value))}
                        />
                    </BrtaField>
                    <BrtaField label="Phone" error={editForm.errors.phone}>
                        <input
                            value={editForm.data.phone}
                            onChange={(e) => editForm.setData('phone', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="City" error={editForm.errors.city}>
                        <input
                            value={editForm.data.city}
                            onChange={(e) => editForm.setData('city', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Currency">
                        <Select
                            value={editForm.data.currency_code}
                            options={currencyOptions}
                            onChange={(e) => editForm.setData('currency_code', String(e.target.value))}
                        />
                    </BrtaField>
                </BrtaFormGrid>
                <BrtaField label="Street Address" alignTop error={editForm.errors.address}>
                    <textarea
                        rows={2}
                        value={editForm.data.address}
                        onChange={(e) => editForm.setData('address', e.target.value)}
                        className={brtaTextareaClass}
                    />
                </BrtaField>
            </BrtaFormModal>
        </AppLayout>
    );
}

