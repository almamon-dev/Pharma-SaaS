import React, { useMemo, useState } from 'react';
import { router, useForm } from '@inertiajs/react';
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
import {
    DataTable,
    Column,
    EmptyState,
    TableActionMenu,
} from '@/Components/tables';
import { SubscriptionUsage } from '@/types';

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
                            className="inline-flex items-center gap-1 font-mono text-[11.5px] text-[#FF4A1F] hover:underline"
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
                            ? 'bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]'
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

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-lg rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e2329] shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-[#FF4A1F]" />
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Create Business Tenant
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

                        <form onSubmit={handleCreate} className="p-5 space-y-3">
                            <Input
                                label="Business Name"
                                required
                                placeholder="CityMed Express Pharmacy"
                                value={createForm.data.name}
                                onChange={(e) =>
                                    createForm.setData('name', e.target.value)
                                }
                                error={createForm.errors.name}
                            />

                            <div>
                                <Input
                                    label="Subdomain"
                                    placeholder="citymed-express"
                                    value={createForm.data.domain}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'domain',
                                            e.target.value
                                        )
                                    }
                                    error={createForm.errors.domain}
                                    icon={<Globe className="h-3.5 w-3.5" />}
                                />
                                <p className="mt-1 text-[11px] text-slate-400">
                                    Optional. Auto-generates under{' '}
                                    <span className="font-mono">
                                        .{baseDomain}
                                    </span>{' '}
                                    or accepts a custom domain.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Head Office Branch"
                                    required
                                    placeholder="Head Office"
                                    value={createForm.data.branch_name}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'branch_name',
                                            e.target.value
                                        )
                                    }
                                    error={createForm.errors.branch_name}
                                />
                                <Input
                                    label="Head Office Code"
                                    required
                                    placeholder="HO"
                                    value={createForm.data.branch_code}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'branch_code',
                                            e.target.value
                                        )
                                    }
                                    error={createForm.errors.branch_code}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="License Number"
                                    placeholder="DGDA-2026-009"
                                    value={createForm.data.license_number}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'license_number',
                                            e.target.value
                                        )
                                    }
                                    error={createForm.errors.license_number}
                                />
                                <Select
                                    label="Currency"
                                    value={createForm.data.currency_code}
                                    options={currencyOptions}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'currency_code',
                                            String(e.target.value)
                                        )
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Phone"
                                    placeholder="+880 1711-000000"
                                    value={createForm.data.phone}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'phone',
                                            e.target.value
                                        )
                                    }
                                    error={createForm.errors.phone}
                                />
                                <Input
                                    label="City"
                                    placeholder="Dhaka"
                                    value={createForm.data.city}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'city',
                                            e.target.value
                                        )
                                    }
                                    error={createForm.errors.city}
                                />
                            </div>

                            <Textarea
                                label="Street Address"
                                rows={2}
                                value={createForm.data.address}
                                onChange={(e) =>
                                    createForm.setData(
                                        'address',
                                        e.target.value
                                    )
                                }
                                error={createForm.errors.address}
                            />

                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={createForm.processing}
                                >
                                    Create Tenant Workspace
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editingTenant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-lg rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e2329] shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                Edit {editingTenant.name}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setEditingTenant(null)}
                                className="text-slate-400 hover:text-slate-700"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="p-5 space-y-3">
                            <Input
                                label="Business Name"
                                required
                                value={editForm.data.name}
                                onChange={(e) =>
                                    editForm.setData('name', e.target.value)
                                }
                                error={editForm.errors.name}
                            />

                            <div>
                                <Input
                                    label="Subdomain"
                                    placeholder={`citymed.${baseDomain}`}
                                    value={editForm.data.domain}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'domain',
                                            e.target.value
                                        )
                                    }
                                    error={editForm.errors.domain}
                                    icon={<Globe className="h-3.5 w-3.5" />}
                                />
                                <p className="mt-1 text-[11px] text-slate-400">
                                    Enter a subdomain or custom domain.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="License Number"
                                    value={editForm.data.license_number}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'license_number',
                                            e.target.value
                                        )
                                    }
                                    error={editForm.errors.license_number}
                                />
                                <Select
                                    label="Status"
                                    value={editForm.data.status}
                                    options={[
                                        {
                                            id: 'active',
                                            value: 'active',
                                            name: 'Active',
                                        },
                                        {
                                            id: 'inactive',
                                            value: 'inactive',
                                            name: 'Inactive',
                                        },
                                    ]}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'status',
                                            String(e.target.value)
                                        )
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Phone"
                                    value={editForm.data.phone}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'phone',
                                            e.target.value
                                        )
                                    }
                                    error={editForm.errors.phone}
                                />
                                <Input
                                    label="City"
                                    value={editForm.data.city}
                                    onChange={(e) =>
                                        editForm.setData('city', e.target.value)
                                    }
                                    error={editForm.errors.city}
                                />
                            </div>

                            <Select
                                label="Currency"
                                value={editForm.data.currency_code}
                                options={currencyOptions}
                                onChange={(e) =>
                                    editForm.setData(
                                        'currency_code',
                                        String(e.target.value)
                                    )
                                }
                            />

                            <Textarea
                                label="Street Address"
                                rows={2}
                                value={editForm.data.address}
                                onChange={(e) =>
                                    editForm.setData('address', e.target.value)
                                }
                                error={editForm.errors.address}
                            />

                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditingTenant(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={editForm.processing}
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

