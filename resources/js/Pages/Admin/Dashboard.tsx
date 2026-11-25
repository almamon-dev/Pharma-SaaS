import { useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    Building2,
    CreditCard,
    DollarSign,
    GitBranch,
    ShieldCheck,
    Store,
    Users,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { StatusDot } from '@/Components/ui/StatusDot';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { formatCurrency } from '@/lib/format';

interface SubscriptionRow {
    id: number;
    owner_name: string;
    owner_email: string;
    tenant_name: string;
    plan_name: string;
    billing_cycle: string;
    status: string;
    amount: number;
    payment_method: string;
    ends_at: string;
}

interface TenantRegistryRow {
    id: number;
    name: string;
    slug: string;
    owner_name: string;
    city: string;
    branches_count: number;
    users_count: number;
    status: string;
}

interface SuperAdminDashboardProps {
    metrics: {
        subscriberAdminsCount: number;
        activeSubscriptionsCount: number;
        monthlyRevenue: number;
        totalTenants: number;
        totalBranches: number;
        totalEmployees: number;
    };
    recentSubscriptions: SubscriptionRow[];
    tenants: TenantRegistryRow[];
}

export default function SuperAdminDashboard({
    metrics,
    recentSubscriptions,
    tenants,
}: SuperAdminDashboardProps) {
    const subscriptionColumns: Column<SubscriptionRow>[] = useMemo(
        () => [
            {
                id: 'owner_name',
                label: 'Business Admin (Subscriber)',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.owner_name}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                            · {row.tenant_name}
                        </span>
                    </div>
                ),
            },
            {
                id: 'plan_name',
                label: 'Plan',
                sortable: true,
                render: (row) => (
                    <span className="text-[12px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <strong className="font-semibold text-slate-800 dark:text-slate-200">
                            {row.plan_name}
                        </strong>
                        {' · '}
                        <span className="capitalize text-slate-400">
                            {row.billing_cycle}
                        </span>
                    </span>
                ),
            },
            {
                id: 'amount',
                label: 'Amount',
                className: 'text-right',
                render: (row) => (
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(row.amount, 'USD')}
                    </span>
                ),
            },
            {
                id: 'status',
                label: 'Status',
                render: (row) => (
                    <StatusDot
                        variant={
                            row.status === 'active'
                                ? 'emerald'
                                : row.status === 'trialing'
                                  ? 'brand'
                                  : 'rose'
                        }
                        className="capitalize"
                    >
                        {row.status}
                    </StatusDot>
                ),
            },
        ],
        []
    );

    const tenantColumns: Column<TenantRegistryRow>[] = useMemo(
        () => [
            {
                id: 'name',
                label: 'Business Tenant',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.name}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
                            · {row.city || row.owner_name}
                        </span>
                    </div>
                ),
            },
            {
                id: 'branches_count',
                label: 'Branches',
                className: 'text-right',
            },
            {
                id: 'users_count',
                label: 'Staff',
                className: 'text-right',
            },
            {
                id: 'status',
                label: 'Status',
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

    return (
        <AppLayout
            title="SaaS Platform Overview (Super Admin)"
            subtitle="Business Owner Command Console — manage SaaS subscription plans, subscriber admins, and business tenants."
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
                <MetricCard
                    title="Monthly Revenue"
                    value={formatCurrency(metrics.monthlyRevenue, 'USD')}
                    description="Active paid subscriptions"
                    icon={DollarSign}
                    colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                />
                <MetricCard
                    title="Subscriber Admins"
                    value={metrics.subscriberAdminsCount}
                    description="Pharmacy business owners"
                    icon={ShieldCheck}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
                <MetricCard
                    title="Live Subscriptions"
                    value={metrics.activeSubscriptionsCount}
                    description="Active & trialing accounts"
                    icon={CreditCard}
                    colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                />
                <MetricCard
                    title="Business Tenants"
                    value={metrics.totalTenants}
                    description="Provisioned tenant workspaces"
                    icon={Store}
                    colorClass="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                />
                <MetricCard
                    title="Total Branches"
                    value={metrics.totalBranches}
                    description="Retail outlets across platform"
                    icon={GitBranch}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
                <MetricCard
                    title="Active Staff Seats"
                    value={metrics.totalEmployees}
                    description="Employees across tenants"
                    icon={Users}
                    colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <Card className="xl:col-span-7 overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-[#FF4A1F]" />
                            <CardTitle>Recent Subscriptions</CardTitle>
                        </div>
                        <Link
                            href={route('admin.subscribers')}
                            className="text-xs font-semibold text-[#FF4A1F] hover:underline"
                        >
                            Manage Subscribers
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="[&_.border]:border-0 [&_.rounded-\[3px\]]:rounded-none">
                            <DataTable<SubscriptionRow>
                                data={recentSubscriptions}
                                columns={subscriptionColumns}
                                compact
                                selectable={false}
                                hideCheckbox
                                hideToolbar
                                hideViewToggle
                                syncUrlParams={false}
                                emptyState={
                                    <EmptyState
                                        title="No subscriptions yet"
                                        icon={CreditCard}
                                    />
                                }
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="xl:col-span-5 overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-[#FF4A1F]" />
                            <CardTitle>Registered Tenants</CardTitle>
                        </div>
                        <Link
                            href={route('admin.plans')}
                            className="text-xs font-semibold text-[#FF4A1F] hover:underline"
                        >
                            Manage Plans
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="[&_.border]:border-0 [&_.rounded-\[3px\]]:rounded-none">
                            <DataTable<TenantRegistryRow>
                                data={tenants}
                                columns={tenantColumns}
                                compact
                                selectable={false}
                                hideCheckbox
                                hideToolbar
                                hideViewToggle
                                syncUrlParams={false}
                                emptyState={
                                    <EmptyState
                                        title="No business tenants provisioned"
                                        icon={Building2}
                                    />
                                }
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
