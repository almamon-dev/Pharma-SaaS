import { useMemo } from 'react';
import { router, usePage } from '@inertiajs/react';
import {
    Activity,
    ArrowUpRight,
    Building2,
    CheckCircle2,
    CreditCard,
    GitBranch,
    Lock,
    Receipt,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { MetricCard } from '@/Components/cards/MetricCard';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { Column, DataTable, EmptyState } from '@/Components/tables';
import { SharedPageProps, SubscriptionUsage } from '@/types';
import { formatCurrency } from '@/lib/format';

interface SubscriptionHistoryItem {
    id: number;
    transaction_ref: string;
    tenant_name: string;
    plan_name: string;
    plan_key: string;
    billing_cycle: string;
    status: string;
    amount: number;
    payment_method: string;
    starts_at?: string | null;
    ends_at?: string | null;
}

interface LedgerItem {
    id: number;
    event: string;
    tenant_name: string;
    actor_name: string;
    idempotency_key: string;
    created_at?: string | null;
}

interface SubscriptionPageProps {
    subscriptions: SubscriptionHistoryItem[];
    ledgers: LedgerItem[];
    isAdminOwner: boolean;
    usage: SubscriptionUsage;
}

export default function SubscriptionIndex({
    subscriptions,
    ledgers,
    isAdminOwner,
    usage,
}: SubscriptionPageProps) {
    const { subscription, tenant } = usePage<SharedPageProps>().props;
    const tenantFeatures = tenant?.features ?? [];
    const unlockedCount = tenantFeatures.filter((f) => f.is_enabled).length;

    const historyColumns: Column<SubscriptionHistoryItem>[] = useMemo(
        () => [
            {
                id: 'transaction_ref',
                label: 'Reference',
                sortable: true,
                render: (row) => (
                    <span className="tabular-nums text-[11px] font-bold text-slate-800 dark:text-slate-200">
                        {row.transaction_ref}
                    </span>
                ),
            },
            {
                id: 'tenant_name',
                label: 'Business / Tenant',
                sortable: true,
                render: (row) => (
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {row.tenant_name}
                    </span>
                ),
            },
            {
                id: 'plan_name',
                label: 'Plan',
                sortable: true,
                render: (row) => (
                    <span className="text-[12px] whitespace-nowrap">
                        <strong className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.plan_name}
                        </strong>
                        <span className="text-slate-400">
                            {' '}
                            · {row.billing_cycle} · {row.payment_method}
                        </span>
                    </span>
                ),
            },
            {
                id: 'amount',
                label: 'Amount',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(row.amount, 'USD')}
                    </span>
                ),
            },
            {
                id: 'ends_at',
                label: 'Valid Period',
                sortable: true,
                render: (row) => (
                    <span className="text-[11px] text-slate-500">
                        {row.starts_at ?? '-'} → {row.ends_at ?? '-'}
                    </span>
                ),
            },
            {
                id: 'status',
                label: 'Status',
                sortable: true,
                render: (row) => (
                    <StatusDot
                        variant={
                            row.status === 'active'
                                ? 'emerald'
                                : row.status === 'trialing'
                                    ? 'brand'
                                    : 'slate'
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

    const ledgerColumns: Column<LedgerItem>[] = useMemo(
        () => [
            {
                id: 'event',
                label: 'Ledger Event',
                sortable: true,
                render: (row) => (
                    <span className="tabular-nums text-xs font-semibold text-[#083D28] dark:text-[#0E5F3F]">
                        {row.event}
                    </span>
                ),
            },
            {
                id: 'tenant_name',
                label: 'Business / Tenant',
                sortable: true,
                render: (row) => (
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {row.tenant_name}
                    </span>
                ),
            },
            {
                id: 'actor_name',
                label: 'Actor',
                sortable: true,
                render: (row) => (
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                        {row.actor_name}
                    </span>
                ),
            },
            {
                id: 'idempotency_key',
                label: 'Idempotency Key',
                sortable: false,
                render: (row) => (
                    <span className="tabular-nums text-[10.5px] text-slate-500">
                        {row.idempotency_key}
                    </span>
                ),
            },
            {
                id: 'created_at',
                label: 'Timestamp',
                sortable: true,
                render: (row) => (
                    <span className="text-[11px] text-slate-500">
                        {row.created_at ?? '-'}
                    </span>
                ),
            },
        ],
        []
    );

    return (
        <AppLayout
            title="Business Subscription & Billing"
            subtitle="Monitor your plan quotas, feature access, billing history, and commercial subscription ledger."
            actions={
                isAdminOwner ? (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.visit(route('features.index'))}
                        >
                            <Lock className="h-3.5 w-3.5 mr-1.5" />
                            Feature Access ({unlockedCount}/{tenantFeatures.length})
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => router.visit(route('plans.index'))}
                        >
                            Change / Upgrade Plan
                            <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
                        </Button>
                    </div>
                ) : undefined
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <MetricCard
                    title="Current Plan"
                    value={subscription?.plan?.name ?? 'No Active Plan'}
                    description={
                        subscription?.has_subscription
                            ? `${subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)} · ${subscription.days_left} days left`
                            : 'Choose a plan on the Plans page'
                    }
                    icon={CreditCard}
                    colorClass={
                        subscription?.is_usable
                            ? 'bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 text-[#0E5F3F]'
                            : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
                    }
                />
                <MetricCard
                    title="Pharmacy Tenants"
                    value={`${usage.tenants} / ${usage.max_tenants}`}
                    description="Active pharmacy businesses under plan"
                    icon={Building2}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
                <MetricCard
                    title="Total Branches"
                    value={`${usage.branches} / ${usage.max_branches}`}
                    description="Outlets across all your tenants"
                    icon={GitBranch}
                    colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                />
                <MetricCard
                    title="Active Employees"
                    value={`${usage.employees} / ${usage.max_users}`}
                    description="Staff seats across your business"
                    icon={Users}
                    colorClass="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                />
            </div>

            {tenantFeatures.length > 0 && (
                <Card className="mb-4">
                    <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-[#0E5F3F]" />
                            <CardTitle>Included Plan Features</CardTitle>
                        </div>
                        {tenant?.currentTenant && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.visit(route('features.index'))}
                            >
                                View Full Access Matrix
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {tenantFeatures.map((feat) => (
                                <div
                                    key={feat.key}
                                    className="flex items-center justify-between gap-2 rounded-[2px] border border-slate-100 dark:border-slate-800 px-3 py-2 text-xs"
                                >
                                    <span className="inline-flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                                        {feat.is_enabled ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                        ) : (
                                            <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        )}
                                        {feat.name}
                                    </span>
                                    <span
                                        className={`text-[11px] font-medium ${feat.is_enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}
                                    >
                                        {feat.is_enabled ? 'Active' : 'Locked'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-[#0E5F3F]" />
                            <CardTitle>Subscription & Billing History</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <DataTable<SubscriptionHistoryItem>
                            data={subscriptions}
                            columns={historyColumns}
                            tableId="subscription-history"
                            selectable={false}
                            hideCheckbox
                            hideViewToggle
                            syncUrlParams={false}
                            searchPlaceholder="Search transaction ref, business or plan..."
                            emptyState={
                                <EmptyState
                                    title="No billing history yet"
                                    description="Transactions will appear here when you activate or renew a subscription."
                                    icon={Receipt}
                                />
                            }
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-[#0E5F3F]" />
                            <CardTitle>Commercial Subscription Ledger</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <DataTable<LedgerItem>
                            data={ledgers}
                            columns={ledgerColumns}
                            tableId="subscription-ledger"
                            selectable={false}
                            hideCheckbox
                            hideViewToggle
                            syncUrlParams={false}
                            searchPlaceholder="Search ledger events..."
                            emptyState={
                                <EmptyState
                                    title="No ledger entries yet"
                                    description="Audit events for plan activations and upgrades will appear here."
                                    icon={Activity}
                                />
                            }
                        />
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
