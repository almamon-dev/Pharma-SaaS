import React, { useMemo, useState } from 'react';
import { Link, router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    CreditCard,
    Edit,
    Layers,
    Plus,
    Power,
    ShieldCheck,
    Sparkles,
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

interface AssignedPlanRef {
    id: number;
    name: string;
    key: string;
}

interface AdminFeatureRow {
    id: number;
    key: string;
    name: string;
    description?: string | null;
    category: string;
    is_core: boolean;
    is_active: boolean;
    plan_ids: number[];
    plans: AssignedPlanRef[];
    enabled_tenants_count: number;
}

interface PlanOption {
    id: number;
    name: string;
    key: string;
    monthly_price: string | number;
    is_active: boolean;
}

interface AdminFeaturesProps {
    features: AdminFeatureRow[];
    plans: PlanOption[];
}

const categoryOptions = [
    { id: 'dispensing', value: 'dispensing', name: 'POS & Dispensing' },
    { id: 'inventory', value: 'inventory', name: 'Inventory & Batches' },
    { id: 'branches', value: 'branches', name: 'Branches & Locations' },
    { id: 'crm', value: 'crm', name: 'CRM & Patients' },
    { id: 'team', value: 'team', name: 'Team & RBAC' },
    { id: 'analytics', value: 'analytics', name: 'Reports & Analytics' },
    { id: 'compliance', value: 'compliance', name: 'Compliance & Audit' },
    { id: 'operations', value: 'operations', name: 'General Operations' },
];

export default function AdminFeatures({ features, plans }: AdminFeaturesProps) {
    const [showModal, setShowModal] = useState(false);
    const [editingFeature, setEditingFeature] = useState<AdminFeatureRow | null>(
        null
    );

    const form = useForm<{
        name: string;
        key: string;
        description: string;
        category: string;
        is_core: boolean;
        plan_ids: number[];
    }>({
        name: '',
        key: '',
        description: '',
        category: 'operations',
        is_core: false,
        plan_ids: [],
    });

    const openCreate = () => {
        setEditingFeature(null);
        form.setData({
            name: '',
            key: '',
            description: '',
            category: 'operations',
            is_core: false,
            plan_ids: plans.map((p) => p.id),
        });
        setShowModal(true);
    };

    const openEdit = (feature: AdminFeatureRow) => {
        setEditingFeature(feature);
        form.setData({
            name: feature.name,
            key: feature.key,
            description: feature.description ?? '',
            category: feature.category || 'operations',
            is_core: Boolean(feature.is_core),
            plan_ids: feature.plan_ids ?? [],
        });
        setShowModal(true);
    };

    const togglePlanSelection = (planId: number) => {
        const current = form.data.plan_ids;
        if (current.includes(planId)) {
            form.setData(
                'plan_ids',
                current.filter((id) => id !== planId)
            );
        } else {
            form.setData('plan_ids', [...current, planId]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingFeature) {
            form.put(route('admin.features.update', editingFeature.id), {
                preserveScroll: true,
                onSuccess: () => setShowModal(false),
            });
        } else {
            form.post(route('admin.features.store'), {
                preserveScroll: true,
                onSuccess: () => setShowModal(false),
            });
        }
    };

    const toggleFeature = (feature: AdminFeatureRow) => {
        router.patch(
            route('admin.features.toggle', feature.id),
            {},
            { preserveScroll: true }
        );
    };

    const activeCount = features.filter((f) => f.is_active).length;
    const coreCount = features.filter((f) => f.is_core).length;
    const gatedCount = features.filter((f) => !f.is_core).length;

    const columns: Column<AdminFeatureRow>[] = useMemo(
        () => [
            {
                id: 'name',
                label: 'Feature',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                            ({row.key})
                        </span>
                    </div>
                ),
            },
            {
                id: 'description',
                label: 'Description',
                render: (row) => (
                    <span
                        className="block max-w-[230px] truncate text-[12px] text-slate-500 dark:text-slate-400"
                        title={row.description ?? ''}
                    >
                        {row.description || '—'}
                    </span>
                ),
            },
            {
                id: 'category',
                label: 'Category & Scope',
                sortable: true,
                render: (row) => (
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="capitalize font-medium text-slate-800 dark:text-slate-200">
                            {row.category}
                        </span>
                        {' · '}
                        <span
                            className={
                                row.is_core
                                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                    : 'text-[#FF4A1F] font-medium'
                            }
                        >
                            {row.is_core ? 'Core (All Plans)' : 'Plan-Gated'}
                        </span>
                    </div>
                ),
            },
            {
                id: 'plans',
                label: 'Assigned Subscription Plans',
                render: (row) =>
                    row.is_core ? (
                        <span className="text-[11px] text-emerald-600 font-medium">
                            Unlocked in every active plan
                        </span>
                    ) : row.plans.length === 0 ? (
                        <span className="text-[11px] text-amber-600">
                            Not assigned to any plan yet
                        </span>
                    ) : (
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                            {row.plans.map((p) => p.name).join(', ')}
                        </span>
                    ),
            },
            {
                id: 'enabled_tenants_count',
                label: 'Active Tenants',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                        {row.enabled_tenants_count}
                    </span>
                ),
            },
            {
                id: 'is_active',
                label: 'Status',
                sortable: true,
                render: (row) => (
                    <StatusDot variant={row.is_active ? 'emerald' : 'slate'}>
                        {row.is_active ? 'Enabled' : 'Disabled'}
                    </StatusDot>
                ),
            },
        ],
        []
    );

    return (
        <AppLayout
            title="Platform Features & Plan Entitlements"
            subtitle="Super Admin — add new platform features, manage global availability, and assign which subscription plans unlock each feature for Pharmacy Owners."
            actions={
                <div className="flex items-center gap-2">
                    <Link href={route('admin.plans')}>
                        <Button size="md" variant="outline">
                            <CreditCard className="h-3.5 w-3.5" />
                            Manage Plans
                        </Button>
                    </Link>
                    <Button size="md" variant="primary" onClick={openCreate}>
                        <Plus className="h-3.5 w-3.5" />
                        Add New Feature
                    </Button>
                </div>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <MetricCard
                    title="Total Features"
                    value={features.length}
                    description="Registered SaaS modules & capabilities"
                    icon={Layers}
                    colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                />
                <MetricCard
                    title="Enabled Globally"
                    value={activeCount}
                    description="Available for tenant provisioning"
                    icon={CheckCircle2}
                    colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                />
                <MetricCard
                    title="Core Infrastructure"
                    value={coreCount}
                    description="Auto-enabled on every subscription"
                    icon={ShieldCheck}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
                <MetricCard
                    title="Plan-Gated Features"
                    value={gatedCount}
                    description="Controlled per Subscription Plan"
                    icon={Sparkles}
                    colorClass="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                />
            </div>

            <DataTable<AdminFeatureRow>
                data={features}
                columns={columns}
                tableId="admin-features-table"
                selectable={false}
                hideCheckbox
                syncUrlParams={false}
                searchPlaceholder="Search feature name, key, category..."
                actions={(row) => (
                    <TableActionMenu
                        items={[
                            {
                                key: 'edit',
                                label: 'Edit & Assign Plans',
                                icon: <Edit className="h-3.5 w-3.5" />,
                                onClick: () => openEdit(row),
                            },
                            {
                                key: 'toggle',
                                label: row.is_active
                                    ? 'Disable Feature'
                                    : 'Enable Feature',
                                icon: <Power className="h-3.5 w-3.5" />,
                                variant: row.is_active ? 'danger' : 'brand',
                                onClick: () => toggleFeature(row),
                            },
                        ]}
                    />
                )}
                emptyState={
                    <EmptyState
                        title="No platform features created yet"
                        description="Click Add New Feature to create and assign capabilities to your SaaS plans."
                        icon={Sparkles}
                    />
                }
            />

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-lg rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e2329] shadow-xl max-h-[92vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-[#FF4A1F]" />
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    {editingFeature
                                        ? `Edit Feature: ${editingFeature.name}`
                                        : 'Add New Platform Feature'}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-700"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Feature Name"
                                    required
                                    placeholder="e.g. Expiry Alert Automation"
                                    value={form.data.name}
                                    onChange={(e) =>
                                        form.setData('name', e.target.value)
                                    }
                                    error={form.errors.name}
                                />
                                <Select
                                    label="Feature Category"
                                    value={form.data.category}
                                    options={categoryOptions}
                                    onChange={(e) =>
                                        form.setData(
                                            'category',
                                            String(e.target.value)
                                        )
                                    }
                                />
                            </div>

                            {!editingFeature && (
                                <Input
                                    label="Feature Key (Optional slug)"
                                    placeholder="auto-generated if blank, e.g. expiry_alerts"
                                    value={form.data.key}
                                    onChange={(e) =>
                                        form.setData('key', e.target.value)
                                    }
                                    error={form.errors.key}
                                />
                            )}

                            <Textarea
                                label="Description"
                                rows={2}
                                placeholder="Describe what this feature unlocks for pharmacy owners..."
                                value={form.data.description}
                                onChange={(e) =>
                                    form.setData('description', e.target.value)
                                }
                                error={form.errors.description}
                            />

                            <label className="flex items-start gap-2.5 rounded-[4px] border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.data.is_core}
                                    onChange={(e) =>
                                        form.setData(
                                            'is_core',
                                            e.target.checked
                                        )
                                    }
                                    className="mt-0.5 rounded-[2px] border-slate-300 text-[#FF4A1F] focus:ring-[#FF4A1F]"
                                />
                                <div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                        Core Feature (Included in ALL Plans)
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        Leave unchecked to restrict this feature
                                        only to the Subscription Plans checked
                                        below.
                                    </p>
                                </div>
                            </label>

                            {!form.data.is_core && (
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2">
                                        Enable For Subscription Plans
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {plans.map((plan) => {
                                            const checked =
                                                form.data.plan_ids.includes(
                                                    plan.id
                                                );
                                            return (
                                                <label
                                                    key={plan.id}
                                                    className={`flex items-center gap-2 rounded-[4px] border p-2.5 cursor-pointer transition-colors ${
                                                        checked
                                                            ? 'border-[#FF4A1F] bg-orange-50/60 dark:bg-[#FF4A1F]/10'
                                                            : 'border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() =>
                                                            togglePlanSelection(
                                                                plan.id
                                                            )
                                                        }
                                                        className="rounded-[2px] border-slate-300 text-[#FF4A1F] focus:ring-[#FF4A1F]"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                            {plan.name}
                                                        </p>
                                                        <p className="text-[10.5px] text-slate-400">
                                                            ${plan.monthly_price}
                                                            /mo
                                                        </p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={form.processing}
                                >
                                    {editingFeature
                                        ? 'Save Feature & Sync Plans'
                                        : 'Create Feature'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

