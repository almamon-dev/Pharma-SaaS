import React, { useMemo, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Edit, ShieldCheck, Users, X } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { Select } from '@/Components/ui/Select';
import {
    DataTable,
    Column,
    EmptyState,
    TableActionMenu,
} from '@/Components/tables';
import { PlanSummary } from '@/types';
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
}

interface AdminSubscribersProps {
    subscribers: SubscriberRow[];
    plans: PlanSummary[];
}

export default function AdminSubscribers({
    subscribers,
    plans,
}: AdminSubscribersProps) {
    const [editing, setEditing] = useState<SubscriberRow | null>(null);

    const form = useForm({
        plan_key: '',
        status: 'active',
        billing_cycle: 'monthly',
    });

    const openManage = (sub: SubscriberRow) => {
        setEditing(sub);
        form.setData({
            plan_key: sub.plan_key || plans[0]?.key || 'growth',
            status:
                sub.subscription_status === 'none'
                    ? 'active'
                    : sub.subscription_status,
            billing_cycle: sub.billing_cycle || 'monthly',
        });
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

                        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
                            <Select
                                label="Assigned Plan"
                                value={form.data.plan_key}
                                onChange={(e) =>
                                    form.setData(
                                        'plan_key',
                                        String(e.target.value)
                                    )
                                }
                                options={planOptions}
                            />

                            <div className="grid grid-cols-2 gap-3">
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
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
