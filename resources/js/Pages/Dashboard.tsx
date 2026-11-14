import { useMemo } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    Clock,
    DollarSign,
    GitBranch,
    Package,
    Plus,
    ShoppingCart,
    Users,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { MetricCard } from '@/Components/cards/MetricCard';
import { SummaryCard } from '@/Components/cards/SummaryCard';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { SharedPageProps } from '@/types';
import { formatCurrency } from '@/lib/format';

interface ExpiringBatchRow {
    id: number;
    batch_number: string;
    medicine_name: string;
    medicine_sku: string;
    unit: string;
    branch_name: string;
    branch_code: string;
    quantity_available: number;
    expiry_date: string;
    days_remaining: number;
}

interface RecentSaleRow {
    id: number;
    invoice_number: string;
    customer_name: string;
    cashier_name: string;
    branch_code?: string | null;
    total_amount: number;
    payment_method: string;
    payment_status: string;
    sold_at: string;
}

interface DashboardProps {
    stats: {
        totalMedicines: number;
        totalStockUnits: number;
        inventoryValuation: number;
        expiringSoonCount: number;
        lowStockCount: number;
        todaySalesTotal: number;
        todaySalesCount: number;
        branchCount: number;
        teamCount: number;
    };
    expiringBatches: ExpiringBatchRow[];
    lowStockMedicines: Array<{
        id: number;
        name: string;
        sku: string;
        unit: string;
        available_stock: number;
        reorder_level: number;
    }>;
    recentSales: RecentSaleRow[];
    recentAuditLogs: Array<{
        id: number;
        action: string;
        description: string;
        user_name: string;
        created_at: string;
    }>;
    usage: {
        tenants?: { used: number; limit: number };
        branches: { used: number; limit: number };
        users: { used: number; limit: number };
        medicines: { used: number; limit: number };
    };
}

export default function Dashboard({
    stats,
    expiringBatches,
    lowStockMedicines,
    recentSales,
    recentAuditLogs,
    usage,
}: DashboardProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const currency = tenant?.currentTenant?.currency_code ?? 'BDT';
    const enabledFeatures = new Set(tenant?.enabledFeatures ?? []);
    const hasFeature = (key: string) => enabledFeatures.has(key);

    const usagePercent = (used: number, limit: number) =>
        limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    const expiringColumns = useMemo<Column<ExpiringBatchRow>[]>(
        () => [
            {
                id: 'medicine_name',
                label: 'Medicine',
                sortable: true,
                render: (batch) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {batch.medicine_name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                            {batch.medicine_sku}
                        </span>
                    </div>
                ),
            },
            {
                id: 'batch_number',
                label: 'Batch',
                sortable: true,
                render: (batch) => (
                    <span className="font-mono text-[11.5px] text-slate-600 dark:text-slate-300">
                        {batch.batch_number}
                    </span>
                ),
            },
            {
                id: 'branch_code',
                label: 'Branch',
                sortable: true,
                render: (batch) => (
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {batch.branch_code || batch.branch_name}
                    </span>
                ),
            },
            {
                id: 'quantity_available',
                label: 'Qty',
                sortable: true,
                className: 'text-right',
                render: (batch) => (
                    <span className="font-semibold tabular-nums">
                        {batch.quantity_available} {batch.unit}
                    </span>
                ),
            },
            {
                id: 'days_remaining',
                label: 'Status',
                sortable: true,
                className: 'text-right',
                render: (batch) => (
                    <div className="flex justify-end">
                        <StatusDot
                            variant={
                                batch.days_remaining <= 7 ? 'rose' : 'amber'
                            }
                        >
                            {batch.days_remaining < 0
                                ? 'Expired'
                                : `${batch.days_remaining}d left`}
                        </StatusDot>
                    </div>
                ),
            },
        ],
        []
    );

    const recentSalesColumns = useMemo<Column<RecentSaleRow>[]>(
        () => [
            {
                id: 'invoice_number',
                label: 'Invoice',
                sortable: true,
                render: (sale) => (
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[#FF4A1F]">
                            {sale.invoice_number}
                        </span>
                        {sale.branch_code && (
                            <span className="text-[11px] font-medium text-slate-400">
                                ({sale.branch_code})
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'customer_name',
                label: 'Customer',
                sortable: true,
                render: (sale) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {sale.customer_name}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                            · {sale.cashier_name} · {sale.sold_at}
                        </span>
                    </div>
                ),
            },
            {
                id: 'payment_method',
                label: 'Method',
                sortable: true,
                render: (sale) => (
                    <span className="text-xs font-medium capitalize text-emerald-700 dark:text-emerald-400">
                        {sale.payment_method}
                    </span>
                ),
            },
            {
                id: 'total_amount',
                label: 'Total',
                sortable: true,
                className: 'text-right',
                render: (sale) => (
                    <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(sale.total_amount, currency)}
                    </span>
                ),
            },
        ],
        [currency]
    );

    return (
        <AppLayout
            title="Workspace Overview"
            subtitle={`${tenant?.currentTenant?.name ?? 'Business Tenant'} · ${
                tenant?.currentBranch?.name ?? 'All Branches'
            }`}
            actions={
                <>
                    <Link href={route('inventory.index')}>
                        <Button variant="outline" size="sm">
                            <Plus className="h-3.5 w-3.5" />
                            Stock Batch
                        </Button>
                    </Link>
                    <Link href={route('pos.index')}>
                        <Button variant="primary" size="sm">
                            <ShoppingCart className="h-3.5 w-3.5" />
                            New POS Sale
                        </Button>
                    </Link>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                        title="Today's Sales"
                        value={formatCurrency(stats.todaySalesTotal, currency)}
                        description={`${stats.todaySalesCount} completed invoice(s)`}
                        icon={DollarSign}
                        colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                        onClick={() => router.visit(route('pos.index'))}
                    />
                    <MetricCard
                        title="Inventory Valuation"
                        value={formatCurrency(
                            stats.inventoryValuation,
                            currency
                        )}
                        description={`${stats.totalStockUnits.toLocaleString()} active units across ${stats.totalMedicines} SKUs`}
                        icon={Package}
                        colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600"
                        onClick={() => router.visit(route('inventory.index'))}
                    />
                    <MetricCard
                        title="Expiring Batches (FEFO)"
                        value={stats.expiringSoonCount}
                        description="Within alert window"
                        icon={Clock}
                        colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                        valueClassName={
                            stats.expiringSoonCount > 0 ? 'text-amber-600' : ''
                        }
                        onClick={() => router.visit(route('inventory.index'))}
                    />
                    <MetricCard
                        title="Low Stock SKUs"
                        value={stats.lowStockCount}
                        description="At or below reorder threshold"
                        icon={AlertTriangle}
                        colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                        valueClassName={
                            stats.lowStockCount > 0 ? 'text-rose-600' : ''
                        }
                        onClick={() => router.visit(route('inventory.index'))}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <SummaryCard
                        badge={hasFeature('pos') ? 'Counter' : 'Upgrade Plan'}
                        title="Point of Sale Register"
                        description="Process customer prescriptions and retail checkouts with automatic FEFO batch selection."
                        highlight={`Active branch: ${tenant?.currentBranch?.name ?? 'Main'}`}
                        icon={ShoppingCart}
                        onClick={() =>
                            router.visit(
                                hasFeature('pos')
                                    ? route('pos.index')
                                    : route('features.index')
                            )
                        }
                    />
                    <SummaryCard
                        badge={
                            hasFeature('branches')
                                ? 'Multi-Branch'
                                : 'Upgrade Plan'
                        }
                        title="Branch Network & Outlets"
                        description={`Manage ${stats.branchCount} active dispensary outlet(s) inside ${tenant?.currentTenant?.name ?? 'your workspace'}.`}
                        highlight="Tenant-scoped ledger isolation"
                        icon={GitBranch}
                        onClick={() =>
                            router.visit(
                                hasFeature('branches')
                                    ? route('branches.index')
                                    : route('features.index')
                            )
                        }
                    />
                    <SummaryCard
                        badge={
                            hasFeature('team_rbac')
                                ? 'Access Control'
                                : 'Upgrade Plan'
                        }
                        title="Team & Role Permissions"
                        description={
                            hasFeature('team_rbac')
                                ? `${stats.teamCount} active staff member(s) assigned across Owner, Pharmacist, and Cashier roles.`
                                : 'Multi-role RBAC requires upgrading to Growth or Enterprise.'
                        }
                        highlight={`Signed in as ${tenant?.roleLabel ?? 'Member'}`}
                        icon={Users}
                        onClick={() =>
                            router.visit(
                                hasFeature('team_rbac')
                                    ? route('team.index')
                                    : route('features.index')
                            )
                        }
                    />
                </div>

                {/* CarrierDirect DataTable Panels (matching LiveActiveShipmentsTable) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white dark:bg-[#12161c] rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                        <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181a20]/50">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-orange-100/70 dark:bg-[#ff4a1f]/15 text-[#FF4A1F] flex items-center justify-center shrink-0">
                                    <Clock size={15} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-[13px] sm:text-[14px] font-bold text-slate-800 dark:text-slate-200">
                                    FEFO Expiring Batches (
                                    {expiringBatches.length})
                                </h3>
                            </div>
                            <Link
                                href={route('inventory.index')}
                                className="text-[11px] sm:text-[12px] font-bold text-[#FF4A1F] hover:underline transition-colors"
                            >
                                See All
                            </Link>
                        </div>

                        <div className="[&_.border]:border-0 [&_.rounded-\[3px\]]:rounded-none">
                            <DataTable
                                data={expiringBatches}
                                columns={expiringColumns}
                                compact={true}
                                selectable={false}
                                hideCheckbox={true}
                                hideToolbar={true}
                                hideViewToggle={true}
                                hidePagination={true}
                                syncUrlParams={false}
                                emptyState={
                                    <EmptyState
                                        title="All shelf batches healthy"
                                        description="No batches are expiring within your workspace alert window."
                                        icon={Clock}
                                    />
                                }
                            />
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Plan Quota Usage</CardTitle>
                            <StatusDot variant="brand">
                                {tenant?.currentTenant?.plan?.name ?? 'Growth'}
                            </StatusDot>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[
                                {
                                    label: 'Active Branches',
                                    used: usage.branches.used,
                                    limit: usage.branches.limit,
                                },
                                {
                                    label: 'Team Members',
                                    used: usage.users.used,
                                    limit: usage.users.limit,
                                },
                                {
                                    label: 'Catalog Medicines',
                                    used: usage.medicines.used,
                                    limit: usage.medicines.limit,
                                },
                            ].map((quota) => {
                                const pct = usagePercent(
                                    quota.used,
                                    quota.limit
                                );
                                return (
                                    <div key={quota.label}>
                                        <div className="mb-1 flex items-center justify-between text-xs">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                {quota.label}
                                            </span>
                                            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                                {quota.used} / {quota.limit}
                                            </span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-[2px] bg-slate-100 dark:bg-slate-800">
                                            <div
                                                className="h-full bg-[#FF4A1F] transition-all"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-[11px] font-bold text-slate-400">
                                        Feature Access
                                    </h4>
                                    <Link
                                        href={route('features.index')}
                                        className="text-[11px] font-bold text-[#FF4A1F] hover:underline"
                                    >
                                        View All →
                                    </Link>
                                </div>
                                <div className="space-y-1.5 mb-3">
                                    {(tenant?.features ?? []).map((feat) => (
                                        <div
                                            key={feat.key}
                                            className="flex items-center justify-between text-xs py-0.5"
                                        >
                                            <span
                                                className={
                                                    feat.is_enabled
                                                        ? 'text-slate-700 dark:text-slate-200 font-medium'
                                                        : 'text-slate-400'
                                                }
                                            >
                                                {feat.name}
                                            </span>
                                            <StatusDot
                                                variant={
                                                    feat.is_enabled
                                                        ? 'emerald'
                                                        : 'slate'
                                                }
                                            >
                                                {feat.is_enabled
                                                    ? 'Unlocked'
                                                    : 'Locked'}
                                            </StatusDot>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                <h4 className="mb-2 text-[11px] font-bold text-slate-400">
                                    Low Stock Alerts
                                </h4>
                                {lowStockMedicines.length === 0 ? (
                                    <p className="text-xs text-slate-500">
                                        All medicines are above reorder levels.
                                    </p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {lowStockMedicines
                                            .slice(0, 4)
                                            .map((med) => (
                                                <div
                                                    key={med.id}
                                                    className="flex items-center justify-between rounded-[3px] border border-slate-100 dark:border-slate-800 px-2.5 py-1.5 text-xs"
                                                >
                                                    <span className="font-medium truncate pr-2">
                                                        {med.name}
                                                    </span>
                                                    <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                                                        {med.available_stock} /{' '}
                                                        {med.reorder_level}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-[#12161c] rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                        <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181a20]/50">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-orange-100/70 dark:bg-[#ff4a1f]/15 text-[#FF4A1F] flex items-center justify-center shrink-0">
                                    <ShoppingCart size={15} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-[13px] sm:text-[14px] font-bold text-slate-800 dark:text-slate-200">
                                    Recent POS Invoices ({recentSales.length})
                                </h3>
                            </div>
                            <Link
                                href={route('pos.index')}
                                className="text-[11px] sm:text-[12px] font-bold text-[#FF4A1F] hover:underline transition-colors"
                            >
                                Open POS
                            </Link>
                        </div>

                        <div className="[&_.border]:border-0 [&_.rounded-\[3px\]]:rounded-none">
                            <DataTable
                                data={recentSales}
                                columns={recentSalesColumns}
                                compact={true}
                                selectable={false}
                                hideCheckbox={true}
                                hideToolbar={true}
                                hideViewToggle={true}
                                hidePagination={true}
                                syncUrlParams={false}
                                emptyState={
                                    <EmptyState
                                        title="No POS invoices today"
                                        description="Completed branch counter sales will appear here automatically."
                                        icon={ShoppingCart}
                                    />
                                }
                            />
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-[#FF4A1F]" />
                                <CardTitle>Workspace Audit Trail</CardTitle>
                            </div>
                            <span className="text-[11px] font-medium text-slate-400">
                                Tenant Scoped
                            </span>
                        </CardHeader>
                        <CardContent className="p-0">
                            {recentAuditLogs.length === 0 ? (
                                <div className="px-5 py-8 text-center text-xs text-slate-500">
                                    Audit events will appear as your team works.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {recentAuditLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className="flex items-start justify-between gap-3 px-4 py-3 text-xs"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                                    {log.description}
                                                </p>
                                                <p className="mt-0.5 text-[11px] text-slate-500">
                                                    {log.user_name} ·{' '}
                                                    {log.created_at}
                                                </p>
                                            </div>
                                            <span className="shrink-0 font-mono text-[10.5px] text-slate-400">
                                                {log.action}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
