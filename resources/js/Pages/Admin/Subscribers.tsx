import React, { useMemo, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Edit, ShieldCheck, Users, X } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { FormLayoutProvider } from '@/Components/ui/FormLayout';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import {
    DataTable,
    Column,
    EmptyState,
    TableActionMenu,
} from '@/Components/tables';
import { PlanModuleSummary, PlanSummary } from '@/types';
import { formatCurrency } from '@/lib/format';

interface SubscriberRow {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    business_name?: string | null;
    account_status: string;
    plan_id?: number | null;
    plan_key: string;
    plan_name: string;
    subscription_status: string;
    billing_cycle: string;
    amount: number;
    ends_at: string;
    tenants_used: number;
    max_tenants: number;
    branches_used: number;
    max_branches: number;
    employees_used: number;
    max_users: number;
    enabled_module_ids?: number[];
}

interface AdminSubscribersProps {
    subscribers: SubscriberRow[];
    plans: PlanSummary[];
    modules?: PlanModuleSummary[];
}

export default function AdminSubscribers({
    subscribers,
    plans,
    modules = [],
}: AdminSubscribersProps) {
    const [editing, setEditing] = useState<SubscriberRow | null>(null);

    const form = useForm<{
        plan_key: string;
        status: string;
        billing_cycle: string;
        module_ids: number[];
    }>({
        plan_key: '',
        status: 'active',
        billing_cycle: 'monthly',
        module_ids: [],
    });

    const openManage = (sub: SubscriberRow) => {
        setEditing(sub);
        const planKey = sub.plan_key || plans[0]?.key || 'growth';
        const foundPlan = plans.find((p) => p.key === planKey);
        const planModuleIds = foundPlan?.modules?.map((m) => m.id) ?? [];
        const coreModuleIds = modules.filter((m) => m.is_core).map((m) => m.id);
        const defaultModuleIds = Array.from(new Set([...coreModuleIds, ...planModuleIds]));
        const initialModuleIds = sub.enabled_module_ids && sub.enabled_module_ids.length > 0
            ? sub.enabled_module_ids
            : defaultModuleIds;

        form.setData({
            plan_key: planKey,
            status:
                sub.subscription_status === 'none'
                    ? 'active'
                    : sub.subscription_status,
            billing_cycle: sub.billing_cycle || 'monthly',
            module_ids: initialModuleIds,
        });
    };

    const handlePlanChange = (newPlanKey: string) => {
        const foundPlan = plans.find((p) => p.key === newPlanKey);
        const planModuleIds = foundPlan?.modules?.map((m) => m.id) ?? [];
        const coreModuleIds = modules.filter((m) => m.is_core).map((m) => m.id);
        const combined = Array.from(new Set([...coreModuleIds, ...planModuleIds]));

        form.setData((data) => ({
            ...data,
            plan_key: newPlanKey,
            module_ids: combined,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        form.patch(route('admin.subscribers.update', editing.id), {
            preserveScroll: true,
            onSuccess: () => setEditing(null),
        });
    };

    const columns: Column<SubscriberRow>[] = useMemo(
        () => [
            {
                id: 'name',
                label: 'Business Admin',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.name}
                        </span>
                        {row.business_name && (
                            <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                                · {row.business_name}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'email',
                label: 'Contact',
                sortable: true,
                render: (row) => (
                    <span className="text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {row.email}
                        {row.phone ? ` · ${row.phone}` : ''}
                    </span>
                ),
            },
            {
                id: 'plan_name',
                label: 'Plan',
                sortable: true,
                render: (row) => (
                    <span className="text-[12px] whitespace-nowrap">
                        <strong className="font-semibold text-slate-800 dark:text-slate-200">
                            {row.plan_name}
                        </strong>
                        <span className="text-slate-400">
                            {' '}
                            · {row.billing_cycle} ({formatCurrency(row.amount, 'USD')})
                        </span>
                    </span>
                ),
            },
            {
                id: 'tenants_used',
                label: 'Tenants / Branches / Staff',
                render: (row) => (
                    <div className="text-xs tabular-nums text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.tenants_used}/{row.max_tenants >= 999 ? '∞' : row.max_tenants}
                        </span>{' '}
                        tenants ·{' '}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.branches_used}/{row.max_branches >= 999 ? '∞' : row.max_branches}
                        </span>{' '}
                        branches ·{' '}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.employees_used}/{row.max_users}
                        </span>{' '}
                        staff
                    </div>
                ),
            },
            {
                id: 'ends_at',
                label: 'Renews / Expires',
                sortable: true,
            },
            {
                id: 'subscription_status',
                label: 'Status',
                sortable: true,
                render: (row) => (
                    <StatusDot
                        variant={
                            row.subscription_status === 'active'
                                ? 'emerald'
                                : row.subscription_status === 'trialing'
                                  ? 'brand'
                                  : 'rose'
                        }
                        className="capitalize"
                    >
                        {row.subscription_status}
                    </StatusDot>
                ),
            },
        ],
        []
    );

    const planOptions = plans.map((p) => ({
        id: p.key,
        value: p.key,
        name: `${p.name} ($${p.monthly_price}/mo · ${p.max_pharmacies} tenants)`,
    }));

    return (
        <AppLayout
            title="Subscribers & Business Accounts"
            subtitle="Super Admin — monitor every Business Admin's active plan, quota consumption, and billing status."
        >
            <DataTable<SubscriberRow>
                data={subscribers}
                columns={columns}
                tableId="admin-subscribers-table"
                selectable={false}
                hideCheckbox
                syncUrlParams={false}
                searchPlaceholder="Search business admin name, email, plan..."
                actions={(row) => (
                    <TableActionMenu
                        items={[
                            {
                                key: 'manage',
                                label: 'Manage Plan & Quota',
                                icon: <Edit className="h-3.5 w-3.5" />,
                                onClick: () => openManage(row),
                            },
                        ]}
                    />
                )}
                emptyState={
                    <EmptyState
                        title="No subscriber admins registered yet"
                        icon={Users}
                    />
                }
            />

            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e2329] shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-[#FF4A1F]" />
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Manage Subscription: {editing.name}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditing(null)}
                                className="text-slate-400 hover:text-slate-700"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <FormLayoutProvider labelWidth="sm:w-[145px]">
                            <form onSubmit={handleSubmit} className="p-5 space-y-3">
                                <Input
                                    label="Subscriber"
                                    readOnly
                                    value={`${editing.name} (${editing.email})`}
                                />
                                <Select
                                    label="Assigned Plan"
                                    value={form.data.plan_key}
                                    onChange={(e) =>
                                        handlePlanChange(String(e.target.value))
                                    }
                                    options={planOptions}
                                />

                                <Select
                                    label="Subscription Status"
                                    value={form.data.status}
                                    onChange={(e) =>
                                        form.setData(
                                            'status',
                                            String(e.target.value)
                                        )
                                    }
                                    options={[
                                        {
                                            id: 'active',
                                            value: 'active',
                                            name: 'Active',
                                        },
                                        {
                                            id: 'trialing',
                                            value: 'trialing',
                                            name: 'Trialing',
                                        },
                                        {
                                            id: 'suspended',
                                            value: 'suspended',
                                            name: 'Suspended',
                                        },
                                        {
                                            id: 'cancelled',
                                            value: 'cancelled',
                                            name: 'Cancelled',
                                        },
                                    ]}
                                />
                                <Select
                                    label="Billing Cycle"
                                    value={form.data.billing_cycle}
                                    onChange={(e) =>
                                        form.setData(
                                            'billing_cycle',
                                            String(e.target.value)
                                        )
                                    }
                                    options={[
                                        {
                                            id: 'monthly',
                                            value: 'monthly',
                                            name: 'Monthly',
                                        },
                                        {
                                            id: 'annual',
                                            value: 'annual',
                                            name: 'Annual',
                                        },
                                    ]}
                                />

                            {/* Direct Module & Feature Access Control */}
                            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                            Feature & Module Privileges
                                        </label>
                                        <p className="text-[11px] text-slate-400">
                                            Control which modules are enabled for this pharmacy workspace.
                                        </p>
                                    </div>
                                    <span className="text-[11px] font-mono font-bold text-[#FF4A1F] bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 px-2 py-0.5 rounded">
                                        {form.data.module_ids.length} Active
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1 rounded border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                                    {modules.map((mod) => {
                                        const isCore = Boolean(mod.is_core);
                                        const isChecked = isCore || form.data.module_ids.includes(mod.id);

                                        return (
                                            <label
                                                key={mod.id}
                                                className={`flex items-start gap-2 p-2 rounded border text-xs cursor-pointer transition-colors ${
                                                    isCore
                                                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                                                        : isChecked
                                                            ? 'bg-orange-50/60 dark:bg-orange-950/30 border-[#FF4A1F]/50 text-slate-900 dark:text-slate-100'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    disabled={isCore}
                                                    onChange={(e) => {
                                                        if (isCore) return;
                                                        const next = e.target.checked
                                                            ? [...form.data.module_ids, mod.id]
                                                            : form.data.module_ids.filter((id) => id !== mod.id);
                                                        form.setData('module_ids', next);
                                                    }}
                                                    className="mt-0.5 rounded text-[#FF4A1F] focus:ring-[#FF4A1F]"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold truncate flex items-center gap-1.5">
                                                        <span>{mod.name}</span>
                                                        {isCore && (
                                                            <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                                                                Core
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                        {mod.key}
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setEditing(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={form.processing}
                                >
                                    Apply Subscription
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
