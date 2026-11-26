import React, { useMemo, useState } from 'react';
import { Link, router, useForm } from '@inertiajs/react';
import {
    CreditCard,
    Edit,
    Plus,
    Power,
    Sparkles,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import {
    BrtaField,
    BrtaFormGrid,
    BrtaFormModal,
    BrtaOptionItem,
    BrtaOptionStrip,
    brtaInputClass,
    brtaTextareaClass,
} from '@/Components/ui/BrtaForm';
import {
    DataTable,
    Column,
    EmptyState,
    TableActionMenu,
} from '@/Components/tables';
import { PlanModuleSummary, PlanSummary } from '@/types';
import { formatCurrency } from '@/lib/format';

interface AdminPlanRow extends PlanSummary {
    id: number;
    active_subscribers_count?: number;
}

interface AdminPlansProps {
    plans: AdminPlanRow[];
    modules: PlanModuleSummary[];
}

const featureCategories = [
    { id: 'dispensing', value: 'dispensing', name: 'POS & Dispensing' },
    { id: 'inventory', value: 'inventory', name: 'Inventory & Batches' },
    { id: 'branches', value: 'branches', name: 'Branches & Locations' },
    { id: 'crm', value: 'crm', name: 'CRM & Patients' },
    { id: 'team', value: 'team', name: 'Team & RBAC' },
    { id: 'analytics', value: 'analytics', name: 'Reports & Analytics' },
    { id: 'compliance', value: 'compliance', name: 'Compliance & Audit' },
    { id: 'operations', value: 'operations', name: 'General Operations' },
];

export default function AdminPlans({ plans, modules = [] }: AdminPlansProps) {
    const [showModal, setShowModal] = useState(false);
    const [showQuickFeature, setShowQuickFeature] = useState(false);
    const [editingPlan, setEditingPlan] = useState<AdminPlanRow | null>(null);
    const [modalLangTab, setModalLangTab] = useState<'en' | 'bn'>('en');

    const form = useForm<{
        name: string;
        name_bn: string;
        description: string;
        description_bn: string;
        monthly_price: string;
        annual_price: string;
        trial_days: string;
        max_pharmacies: string;
        max_branches: string;
        max_users: string;
        max_medicines: string;
        features_text: string;
        features_bn_text: string;
        module_ids: number[];
        is_popular: boolean;
    }>({
        name: '',
        name_bn: '',
        description: '',
        description_bn: '',
        monthly_price: '29',
        annual_price: '290',
        trial_days: '14',
        max_pharmacies: '1',
        max_branches: '1',
        max_users: '5',
        max_medicines: '1500',
        features_text: '',
        features_bn_text: '',
        module_ids: [],
        is_popular: false,
    });

    const quickFeatureForm = useForm({
        name: '',
        description: '',
        category: 'operations',
        is_core: false,
    });

    const openCreate = () => {
        setEditingPlan(null);
        setShowQuickFeature(false);
        setModalLangTab('en');
        form.setData({
            name: '',
            name_bn: '',
            description: '',
            description_bn: '',
            monthly_price: '29',
            annual_price: '290',
            trial_days: '14',
            max_pharmacies: '1',
            max_branches: '1',
            max_users: '5',
            max_medicines: '1500',
            features_text: '',
            features_bn_text: '',
            module_ids: modules
                .filter((m) => m.is_active !== false && !m.is_core)
                .map((m) => m.id),
            is_popular: false,
        });
        setShowModal(true);
    };

    const openEdit = (plan: AdminPlanRow) => {
        setEditingPlan(plan);
        setShowQuickFeature(false);
        setModalLangTab('en');
        form.setData({
            name: plan.name,
            name_bn: plan.name_bn ?? '',
            description: plan.description ?? '',
            description_bn: plan.description_bn ?? '',
            monthly_price: String(plan.monthly_price ?? 0),
            annual_price: String(plan.annual_price ?? 0),
            trial_days: String(plan.trial_days ?? 14),
            max_pharmacies: String(plan.max_pharmacies),
            max_branches: String(plan.max_branches),
            max_users: String(plan.max_users),
            max_medicines: String(plan.max_medicines),
            features_text: (plan.features ?? []).join('\n'),
            features_bn_text: (plan.features_bn ?? []).join('\n'),
            module_ids: (plan.modules ?? []).map((m) => m.id),
            is_popular: Boolean(plan.is_popular),
        });
        setShowModal(true);
    };

    const toggleModuleId = (moduleId: number) => {
        const current = form.data.module_ids;
        if (current.includes(moduleId)) {
            form.setData(
                'module_ids',
                current.filter((id) => id !== moduleId)
            );
        } else {
            form.setData('module_ids', [...current, moduleId]);
        }
    };

    const handleQuickFeatureCreate = (e: React.FormEvent) => {
        e.preventDefault();
        quickFeatureForm.post(route('admin.features.store'), {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                quickFeatureForm.reset();
                setShowQuickFeature(false);
            },
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingPlan) {
            form.put(route('admin.plans.update', editingPlan.id), {
                onSuccess: () => setShowModal(false),
            });
        } else {
            form.post(route('admin.plans.store'), {
                onSuccess: () => setShowModal(false),
            });
        }
    };

    const togglePlan = (plan: AdminPlanRow) => {
        router.patch(
            route('admin.plans.toggle', plan.id),
            {},
            { preserveScroll: true }
        );
    };

    const columns: Column<AdminPlanRow>[] = useMemo(
        () => [
            {
                id: 'name',
                label: 'Plan',
                sortable: true,
                render: (row) => (
                    <div
                        className="flex flex-col gap-0.5"
                        title={row.description ?? ''}
                    >
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {row.name}
                            </span>
                            {row.is_popular && (
                                <StatusDot variant="brand">Popular</StatusDot>
                            )}
                        </div>
                        {row.name_bn && (
                            <span className="text-[11px] font-medium text-[#0E5F3F] dark:text-[#ff7450]">
                                {row.name_bn}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'monthly_price',
                label: 'Pricing',
                sortable: true,
                render: (row) => (
                    <span className="text-[12px] whitespace-nowrap">
                        <strong className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatCurrency(row.monthly_price ?? 0, 'USD')}/mo
                        </strong>
                        <span className="text-[11px] text-slate-400">
                            {' '}
                            · {formatCurrency(row.annual_price ?? 0, 'USD')}/yr ·{' '}
                            {row.trial_days ?? 14}d
                        </span>
                    </span>
                ),
            },
            {
                id: 'max_pharmacies',
                label: 'Quotas (Tenants · Branches · Staff)',
                render: (row) => (
                    <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        <strong className="text-slate-900 dark:text-slate-100">
                            {row.max_pharmacies >= 999
                                ? 'Unlimited'
                                : row.max_pharmacies}
                        </strong>{' '}
                        tenants ·{' '}
                        <strong className="text-slate-900 dark:text-slate-100">
                            {row.max_branches >= 999
                                ? 'Unlimited'
                                : row.max_branches}
                        </strong>{' '}
                        branches ·{' '}
                        <strong className="text-slate-900 dark:text-slate-100">
                            {row.max_users}
                        </strong>{' '}
                        staff
                    </span>
                ),
            },
            {
                id: 'modules',
                label: 'Features',
                render: (row) => {
                    const names = (row.modules ?? [])
                        .map((mod) => mod.name)
                        .join(', ');
                    return names ? (
                        <span
                            className="block max-w-[220px] truncate text-[12px] text-slate-600 dark:text-slate-300"
                            title={names}
                        >
                            {names}
                        </span>
                    ) : (
                        <span className="text-[11px] text-slate-400">
                            Core only
                        </span>
                    );
                },
            },
            {
                id: 'active_subscribers_count',
                label: 'Subscribers',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                        {row.active_subscribers_count ?? 0}
                    </span>
                ),
            },
            {
                id: 'is_active',
                label: 'Status',
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
            title="SaaS Subscription Plans"
            subtitle="Super Admin — define pricing tiers, quotas, and attach platform features so Pharmacy Owners receive feature-wise access."
            actions={
                <div className="flex items-center gap-2">
                    <Link href={route('admin.features')}>
                        <Button size="md" variant="outline">
                            <Sparkles className="h-3.5 w-3.5" />
                            Add / Manage Features
                        </Button>
                    </Link>
                    <Button size="md" variant="primary" onClick={openCreate}>
                        <Plus className="h-3.5 w-3.5" />
                        Create Plan
                    </Button>
                </div>
            }
        >
            <DataTable<AdminPlanRow>
                data={plans}
                columns={columns}
                tableId="admin-plans-table"
                selectable={false}
                hideCheckbox
                syncUrlParams={false}
                searchPlaceholder="Search plan name..."
                actions={(row) => (
                    <TableActionMenu
                        items={[
                            {
                                key: 'edit',
                                label: 'Edit & Assign Features',
                                icon: <Edit className="h-3.5 w-3.5" />,
                                onClick: () => openEdit(row),
                            },
                            {
                                key: 'toggle',
                                label: row.is_active
                                    ? 'Disable Plan'
                                    : 'Enable Plan',
                                icon: <Power className="h-3.5 w-3.5" />,
                                variant: row.is_active ? 'danger' : 'brand',
                                onClick: () => togglePlan(row),
                            },
                        ]}
                    />
                )}
                emptyState={
                    <EmptyState
                        title="No subscription plans configured"
                        icon={CreditCard}
                    />
                }
            />

            <BrtaFormModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={handleSubmit}
                title={
                    editingPlan
                        ? `Edit Plan & Features: ${editingPlan.name}`
                        : 'Create New SaaS Plan'
                }
                subtitle="Configure bilingual plan identity, pricing, quotas, and module privileges"
                icon={<CreditCard className="h-4 w-4" />}
                maxWidth="4xl"
                footerProps={{
                    submitLabel: editingPlan ? 'Save Plan & Sync Access' : 'Create Plan',
                    submitting: form.processing,
                }}
            >
                {/* Bilingual Plan Information Header/Tabs */}
                <div className="rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F8FAF8] dark:bg-slate-900/40 p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] dark:border-slate-800 pb-2.5">
                        <div>
                            <p className="text-[13px] font-bold text-[#222222] dark:text-slate-100">
                                Plan Content & Identity (দ্বিভাষিক / Bilingual)
                            </p>
                            <p className="text-[11px] text-[#666666] dark:text-slate-400">
                                Manage plan title, description and feature bullet highlights in English and বাংলা.
                            </p>
                        </div>
                        <div className="inline-flex rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] p-0.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setModalLangTab('en')}
                                className={`px-3 py-1 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer ${
                                    modalLangTab === 'en'
                                        ? 'bg-[#0E5F3F] text-white'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                }`}
                            >
                                English
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalLangTab('bn')}
                                className={`px-3 py-1 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer ${
                                    modalLangTab === 'bn'
                                        ? 'bg-[#0E5F3F] text-white'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                }`}
                            >
                                বাংলা (Bengali)
                            </button>
                        </div>
                    </div>

                    {modalLangTab === 'en' ? (
                        <BrtaFormGrid>
                            <BrtaField label="Plan Name (EN)" required error={form.errors.name}>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Starter Dispensary"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    className={brtaInputClass}
                                />
                            </BrtaField>
                            <BrtaField label="Description (EN)">
                                <input
                                    type="text"
                                    placeholder="Brief overview of who this plan is for..."
                                    value={form.data.description}
                                    onChange={(e) => form.setData('description', e.target.value)}
                                    className={brtaInputClass}
                                />
                            </BrtaField>
                        </BrtaFormGrid>
                    ) : (
                        <BrtaFormGrid>
                            <BrtaField label="প্ল্যানের নাম (বাংলা)" error={form.errors.name_bn}>
                                <input
                                    type="text"
                                    placeholder="যেমন: স্টার্টার ডিসপেনসারি"
                                    value={form.data.name_bn}
                                    onChange={(e) => form.setData('name_bn', e.target.value)}
                                    className={brtaInputClass}
                                />
                            </BrtaField>
                            <BrtaField label="প্ল্যানের বিবরণ (বাংলা)" error={form.errors.description_bn}>
                                <input
                                    type="text"
                                    placeholder="যেমন: একক ফার্মেসি ব্যবসা ও শাখার জন্য প্রয়োজনীয় পিওএস ও ইনভেন্টরি..."
                                    value={form.data.description_bn}
                                    onChange={(e) => form.setData('description_bn', e.target.value)}
                                    className={brtaInputClass}
                                />
                            </BrtaField>
                        </BrtaFormGrid>
                    )}
                </div>

                <BrtaFormGrid>
                    <BrtaField label="Monthly Price ($)" required>
                        <input
                            type="number"
                            step="0.01"
                            required
                            value={form.data.monthly_price}
                            onChange={(e) => form.setData('monthly_price', e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                    <BrtaField label="Annual Price ($)" required>
                        <input
                            type="number"
                            step="0.01"
                            required
                            value={form.data.annual_price}
                            onChange={(e) => form.setData('annual_price', e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                    <BrtaField label="Trial Days" required>
                        <input
                            type="number"
                            min="0"
                            max="90"
                            required
                            value={form.data.trial_days}
                            onChange={(e) => form.setData('trial_days', e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                    <BrtaField label="Max Tenants" required>
                        <input
                            type="number"
                            min="1"
                            required
                            value={form.data.max_pharmacies}
                            onChange={(e) => form.setData('max_pharmacies', e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                    <BrtaField label="Max Branches" required>
                        <input
                            type="number"
                            min="1"
                            required
                            value={form.data.max_branches}
                            onChange={(e) => form.setData('max_branches', e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                    <BrtaField label="Max Staff" required>
                        <input
                            type="number"
                            min="1"
                            required
                            value={form.data.max_users}
                            onChange={(e) => form.setData('max_users', e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                    <BrtaField label="Max SKUs" required>
                        <input
                            type="number"
                            min="50"
                            required
                            value={form.data.max_medicines}
                            onChange={(e) => form.setData('max_medicines', e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        />
                    </BrtaField>
                    <BrtaField label="Plan Badge">
                        <BrtaOptionStrip>
                            <BrtaOptionItem>
                                <input
                                    type="checkbox"
                                    checked={form.data.is_popular}
                                    onChange={(e) => form.setData('is_popular', e.target.checked)}
                                    className="rounded-[2px] border-slate-300 text-[#0E5F3F]"
                                />
                                <span>Highlight as Popular Plan</span>
                            </BrtaOptionItem>
                        </BrtaOptionStrip>
                    </BrtaField>
                </BrtaFormGrid>

                {/* Plan Feature Assignment Section */}
                <div className="rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 p-3.5 space-y-2.5 bg-[#F8FAF8] dark:bg-slate-900/30">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-[12.5px] font-bold text-[#222222] dark:text-slate-100">
                                Feature-Wise Access Included in Plan
                            </p>
                            <p className="text-[11px] text-[#666666] dark:text-slate-400">
                                Select which platform modules & features Pharmacy Owners unlock on this plan.
                            </p>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setShowQuickFeature((prev) => !prev)}
                        >
                            <Plus className="h-3 w-3" />
                            {showQuickFeature ? 'Close Quick Add' : 'Add New Feature'}
                        </Button>
                    </div>

                    {showQuickFeature && (
                        <div className="rounded-[2px] border border-[#0E5F3F]/30 bg-white dark:bg-[#181d25] p-3.5 space-y-3">
                            <p className="text-xs font-bold text-[#0E5F3F]">
                                Quick Add New Platform Feature
                            </p>
                            <BrtaFormGrid>
                                <BrtaField label="Feature Name" error={quickFeatureForm.errors.name}>
                                    <input
                                        type="text"
                                        placeholder="e.g. Expiry Analytics"
                                        value={quickFeatureForm.data.name}
                                        onChange={(e) => quickFeatureForm.setData('name', e.target.value)}
                                        className={brtaInputClass}
                                    />
                                </BrtaField>
                                <BrtaField label="Category">
                                    <select
                                        value={quickFeatureForm.data.category}
                                        onChange={(e) =>
                                            quickFeatureForm.setData('category', String(e.target.value))
                                        }
                                        className={brtaInputClass}
                                    >
                                        {featureCategories.map((cat) => (
                                            <option key={cat.value} value={cat.value}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </BrtaField>
                                <BrtaField label="Description" className="md:col-span-2">
                                    <input
                                        type="text"
                                        placeholder="What does this feature enable?"
                                        value={quickFeatureForm.data.description}
                                        onChange={(e) =>
                                            quickFeatureForm.setData('description', e.target.value)
                                        }
                                        className={brtaInputClass}
                                    />
                                </BrtaField>
                            </BrtaFormGrid>
                            <div className="flex items-center justify-end">
                                <button
                                    type="button"
                                    disabled={quickFeatureForm.processing}
                                    onClick={handleQuickFeatureCreate}
                                    className="inline-flex items-center gap-1.5 h-[32px] px-3.5 text-[12.5px] font-semibold rounded-[2px] bg-[#5CB85C] hover:bg-[#449D44] border border-[#4CAE4C] text-white disabled:opacity-50 cursor-pointer"
                                >
                                    {quickFeatureForm.processing ? 'Saving...' : 'Save New Feature to Catalog'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {modules
                            .filter((m) => m.is_active !== false)
                            .map((mod) => {
                                const isCore = Boolean(mod.is_core);
                                const checked = isCore || form.data.module_ids.includes(mod.id);
                                return (
                                    <label
                                        key={mod.id}
                                        className={`flex items-start gap-2 rounded-[2px] border p-2.5 transition-colors ${
                                            isCore
                                                ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 cursor-default'
                                                : checked
                                                  ? 'border-[#0E5F3F] bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 cursor-pointer'
                                                  : 'border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] cursor-pointer'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={isCore}
                                            onChange={() => !isCore && toggleModuleId(mod.id)}
                                            className="mt-0.5 rounded-[2px] border-slate-300 text-[#0E5F3F] focus:ring-[#0E5F3F]"
                                        />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="text-xs font-semibold text-[#222222] dark:text-slate-100">
                                                    {mod.name}
                                                </p>
                                                {isCore && (
                                                    <span className="text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                        Core
                                                    </span>
                                                )}
                                            </div>
                                            {mod.description && (
                                                <p className="text-[10.5px] text-slate-400 line-clamp-2">
                                                    {mod.description}
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}
                    </div>
                </div>

                <BrtaField
                    label={
                        modalLangTab === 'en'
                            ? 'Plan Bullets (EN)'
                            : 'মূল সুবিধাসমূহ (বাংলা)'
                    }
                    alignTop
                    hint={
                        modalLangTab === 'en'
                            ? '1 bullet per line (English)'
                            : 'প্রতি লাইনে ১টি বুলেট (বাংলা)'
                    }
                >
                    {modalLangTab === 'en' ? (
                        <textarea
                            rows={3}
                            placeholder="1 Business Tenant & Head Office Branch&#10;Up to 5 Employee Accounts&#10;Batch & Expiry Date Tracking (FEFO)"
                            value={form.data.features_text}
                            onChange={(e) => form.setData('features_text', e.target.value)}
                            className={brtaTextareaClass}
                        />
                    ) : (
                        <textarea
                            rows={3}
                            placeholder="১টি ফার্মেসি ব্যবসা এবং হেড অফিস শাখা&#10;সর্বোচ্চ ৫ জন কর্মী অ্যাকাউন্ট&#10;ব্যাচ ও মেয়াদোত্তীর্ণ ট্র্যাকিং (FEFO)"
                            value={form.data.features_bn_text}
                            onChange={(e) => form.setData('features_bn_text', e.target.value)}
                            className={brtaTextareaClass}
                        />
                    )}
                </BrtaField>
            </BrtaFormModal>
        </AppLayout>
    );
}
