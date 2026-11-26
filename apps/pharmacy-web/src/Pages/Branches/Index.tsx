import React, { useMemo, useState } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRightLeft,
    ArrowUpRight,
    GitBranch,
    Layers,
    MapPin,
    Plus,
    Power,
    Store,
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
import { BranchItem, SharedPageProps, SubscriptionUsage } from '@/types';

interface TenantOptionRow {
    id: number;
    name: string;
    city?: string | null;
}

interface BranchesProps {
    branches: BranchItem[];
    tenants: TenantOptionRow[];
    currentTenantId?: number | null;
    usage?: SubscriptionUsage | null;
}

export default function BranchesIndex({
    branches,
    tenants,
    currentTenantId,
    usage,
}: BranchesProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const searchParams =
        typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search)
            : null;
    const queryTenantId = searchParams?.get('tenant_id') ?? '';
    const hasValidQueryTenant =
        Boolean(queryTenantId) &&
        tenants.some((t) => String(t.id) === queryTenantId);
    const canAddBranch = !usage || usage.branches < usage.max_branches;
    const [showModal, setShowModal] = useState(
        Boolean(
            searchParams?.get('create') === '1' &&
            canAddBranch &&
            tenant?.canManageOrganization
        )
    );
    const [tenantFilter, setTenantFilter] = useState(
        hasValidQueryTenant ? queryTenantId : ''
    );

    const { data, setData, post, processing, errors, reset } = useForm({
        tenant_id: String(
            (hasValidQueryTenant ? queryTenantId : null) ??
                currentTenantId ??
                tenants[0]?.id ??
                tenant?.currentTenant?.id ??
                ''
        ),
        name: '',
        code: '',
        phone: '',
        email: '',
        city: '',
        address: '',
    });

    const filteredBranches = useMemo(() => {
        if (!tenantFilter) return branches;
        return branches.filter(
            (b) => String(b.tenant_id) === String(tenantFilter)
        );
    }, [branches, tenantFilter]);

    const activeCount = branches.filter((b) => b.is_active).length;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('branches.store'), {
            preserveScroll: true,
            onSuccess: () => {
                reset('name', 'code', 'phone', 'email', 'city', 'address');
                setShowModal(false);
            },
        });
    };

    const toggleBranchStatus = (branch: BranchItem) => {
        router.patch(
            route('branches.toggle', branch.id),
            {},
            { preserveScroll: true }
        );
    };

    const switchActiveBranch = (branch: BranchItem) => {
        router.post(
            route('branch.switch'),
            { branch_id: branch.id },
            { preserveScroll: true }
        );
    };

    const tenantSelectOptions = tenants.map((t) => ({
        id: t.id,
        value: String(t.id),
        name: t.name,
        subtitle: t.city ?? undefined,
    }));

    const filterTenantOptions = [
        { id: 'all', value: '', name: 'All Business Tenants' },
        ...tenantSelectOptions,
    ];

    const columns: Column<BranchItem>[] = useMemo(
        () => [
            {
                id: 'code',
                label: 'Code',
                sortable: true,
                render: (row) => (
                    <span className="tabular-nums text-[11.5px] font-bold text-[#0E5F3F]">
                        {row.code}
                    </span>
                ),
            },
            {
                id: 'name',
                label: 'Branch',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.name}
                        </span>
                        {row.is_head_office && (
                            <span className="text-[11px] font-semibold text-[#0E5F3F]">
                                · HQ
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'tenant_name',
                label: 'Business Tenant',
                sortable: true,
                render: (row) => (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        <Store className="h-3.5 w-3.5 text-[#0E5F3F] shrink-0" />
                        {row.tenant_name ??
                            tenant?.currentTenant?.name ??
                            'Business'}
                    </span>
                ),
            },
            {
                id: 'city',
                label: 'Location',
                render: (row) => (
                    <span className="block max-w-[200px] truncate text-[12px] text-slate-500 dark:text-slate-400">
                        {row.city || '—'}
                        {row.phone ? ` · ${row.phone}` : ''}
                    </span>
                ),
            },
            {
                id: 'batches_count',
                label: 'Batches',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {row.batches_count ?? 0}
                    </span>
                ),
            },
            {
                id: 'sales_count',
                label: 'POS Invoices',
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
        [tenant]
    );

    return (
        <AppLayout
            title="Business Branches"
            subtitle="Operate multiple outlets across your business tenants under one subscription quota."
            actions={
                tenant?.canManageOrganization ? (
                    <Button
                        variant="primary"
                        size="md"
                        disabled={!canAddBranch}
                        onClick={() => setShowModal(true)}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Branch
                    </Button>
                ) : null
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <MetricCard
                    title="Total Branches"
                    value={branches.length}
                    description={`${activeCount} currently active outlets`}
                    icon={GitBranch}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
                <MetricCard
                    title="Subscription Branch Quota"
                    value={
                        usage
                            ? `${usage.branches} / ${usage.max_branches}`
                            : `${branches.length}`
                    }
                    description="Combined branch allowance across tenants"
                    icon={Store}
                    colorClass={
                        canAddBranch
                            ? 'bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 text-[#0E5F3F]'
                            : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
                    }
                />
                <MetricCard
                    title="Active POS Scope"
                    value={tenant?.currentBranch?.name ?? 'Head Office'}
                    description={`Code: ${tenant?.currentBranch?.code ?? 'HO'}`}
                    icon={MapPin}
                    colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                />
            </div>

            {!canAddBranch && tenant?.canManageOrganization && usage && (
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[2px] border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3 text-xs">
                    <div className="flex items-start gap-2.5">
                        <Layers className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">
                                Branch Limit Reached ({usage.branches} /{' '}
                                {usage.max_branches} used)
                            </p>
                            <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                                {usage.max_branches === 1
                                    ? 'Your current plan covers a single-branch pharmacy (1 outlet). To create multiple branches, upgrade your subscription plan.'
                                    : 'You have used all branches allowed on your current plan. Upgrade on Plans to add more outlets.'}
                            </p>
                        </div>
                    </div>
                    <Link href={route('plans.index')} className="shrink-0">
                        <Button variant="primary" size="sm">
                            Upgrade Plan
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                    </Link>
                </div>
            )}

            <DataTable<BranchItem>
                data={filteredBranches}
                columns={columns}
                tableId="branches-table"
                selectable={false}
                hideCheckbox
                syncUrlParams={false}
                searchPlaceholder="Search branch name, code, city, tenant..."
                filterContent={
                    tenants.length > 1 ? (
                        <div className="w-56">
                            <Select
                                size="sm"
                                label="Filter by Business Tenant"
                                value={tenantFilter}
                                onChange={(e) =>
                                    setTenantFilter(String(e.target.value))
                                }
                                options={filterTenantOptions}
                            />
                        </div>
                    ) : undefined
                }
                actions={
                    tenant?.canManageOrganization
                        ? (row) => (
                              <TableActionMenu
                                  items={[
                                      {
                                          key: 'switch',
                                          label: 'Switch Active POS',
                                          icon: (
                                              <ArrowRightLeft className="h-3.5 w-3.5" />
                                          ),
                                          variant: 'brand',
                                          onClick: () =>
                                              switchActiveBranch(row),
                                          hidden:
                                              !row.is_active ||
                                              Number(row.tenant_id) !==
                                                  Number(
                                                      tenant?.currentTenant?.id
                                                  ) ||
                                              Number(row.id) ===
                                                  Number(
                                                      tenant?.currentBranch?.id
                                                  ),
                                      },
                                      {
                                          key: 'toggle',
                                          label: row.is_active
                                              ? 'Disable Branch'
                                              : 'Activate Branch',
                                          icon: <Power className="h-3.5 w-3.5" />,
                                          variant: row.is_active
                                              ? 'danger'
                                              : 'brand',
                                          onClick: () => toggleBranchStatus(row),
                                          hidden: row.is_head_office,
                                      },
                                  ]}
                              />
                          )
                        : undefined
                }
                emptyState={
                    <EmptyState
                        title="No branches found"
                        description="Create a branch under one of your business tenants."
                        icon={GitBranch}
                    />
                }
            />

            <BrtaFormModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={handleSubmit}
                title="Provision New Branch Outlet"
                icon={<GitBranch className="h-4 w-4" />}
                maxWidth="3xl"
                footerProps={{
                    cancelLabel: 'Cancel',
                    submitLabel: 'Create Branch',
                    submitting: processing,
                }}
            >
                <BrtaFormGrid>
                    {tenants.length > 0 && (
                        <BrtaField label="Business Tenant" required>
                            <Select
                                required
                                value={data.tenant_id}
                                onChange={(e) => setData('tenant_id', String(e.target.value))}
                                options={tenantSelectOptions}
                                icon={Store}
                            />
                        </BrtaField>
                    )}
                    <BrtaField label="Branch Name" required error={errors.name}>
                        <input
                            required
                            placeholder="e.g. Uttara Sector 7"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Branch Code" required error={errors.code}>
                        <input
                            required
                            placeholder="DHK-03"
                            value={data.code}
                            onChange={(e) => setData('code', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Phone" error={errors.phone}>
                        <input
                            placeholder="+880 1711-..."
                            value={data.phone}
                            onChange={(e) => setData('phone', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="City" error={errors.city}>
                        <input
                            placeholder="Dhaka"
                            value={data.city}
                            onChange={(e) => setData('city', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                </BrtaFormGrid>
                <BrtaField label="Street Address" alignTop>
                    <textarea
                        rows={2}
                        placeholder="Plot 12, Sector 7 Main Road..."
                        value={data.address}
                        onChange={(e) => setData('address', e.target.value)}
                        className={brtaTextareaClass}
                    />
                </BrtaField>
            </BrtaFormModal>
        </AppLayout>
    );
}
