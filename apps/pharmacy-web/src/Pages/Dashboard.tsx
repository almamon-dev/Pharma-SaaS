import { useMemo } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    CheckSquare,
    ClipboardList,
    Clock,
    Contact2,
    DollarSign,
    FilePlus2,
    GitBranch,
    Monitor,
    Package,
    ReceiptText,
    ShoppingCart,
    Target,
    TrendingUp,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { MetricCard } from '@/Components/cards/MetricCard';
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
    order_status?: string | null;
    sold_at: string;
}

interface BranchPerfRow {
    id: number;
    name: string;
    code: string;
    city?: string | null;
    today_sales: number;
    total_sales: number;
    total_bills: number;
    open_counters: number;
    total_counters: number;
}

interface TopProductRow {
    id: number;
    name: string;
    generic_name?: string | null;
    sku: string;
    unit_price: number;
    total_qty: number;
    total_revenue: number;
}

interface RoleContext {
    role: 'owner' | 'co_admin' | 'manager' | 'salesman' | string;
    label: string;
    badge: string;
    isOwner: boolean;
    isCoAdmin: boolean;
    isManager: boolean;
    isSalesman: boolean;
    canSwitchRole: boolean;
    availableDemoRoles: Array<{
        role: string;
        name: string;
        title: string;
        email: string;
    }>;
}

interface DashboardProps {
    stats: {
        totalMedicines: number;
        totalStockUnits: number;
        inventoryValuation?: number | null;
        expiringSoonCount: number;
        lowStockCount: number;
        todaySalesTotal: number;
        todaySalesCount: number;
        allTimeSalesTotal: number;
        pendingApprovalsCount: number;
        cashDiscrepancyCount: number;
        cashDiscrepancyTotal: number;
        openCountersCount: number;
        totalCountersCount: number;
        waitingQueueCount: number;
        myTodaySalesTotal: number;
        myTodaySalesCount: number;
        salesmanDailyTarget: number;
        targetAchievementPct: number;
        awaitingPaymentCount: number;
        awaitingPaymentTotal: number;
        branchCount: number;
        totalBranchesInCompany: number;
        teamCount: number;
    };
    grossProfitSummary?: {
        totalGrossProfit: number;
        todayGrossProfit: number;
        marginPercent: number;
    } | null;
    branchPerformance?: BranchPerfRow[];
    topSellingProducts?: TopProductRow[];
    expiringBatches?: ExpiringBatchRow[];
    lowStockMedicines?: Array<{
        id: number;
        name: string;
        sku: string;
        unit: string;
        available_stock: number;
        reorder_level: number;
    }>;
    recentSales?: RecentSaleRow[];
    recentAuditLogs?: Array<{
        id: number;
        action: string;
        description: string;
        user_name: string;
        created_at: string;
    }>;
    usage?: {
        tenants?: { used: number; limit: number };
        branches?: { used: number; limit: number };
        users?: { used: number; limit: number };
        medicines?: { used: number; limit: number };
    } | null;
    roleContext?: RoleContext;
}

export default function Dashboard({
    stats,
    grossProfitSummary,
    branchPerformance = [],
    topSellingProducts = [],
    expiringBatches = [],
    lowStockMedicines = [],
    recentSales = [],
    recentAuditLogs = [],
    usage,
    roleContext,
}: DashboardProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const currency = tenant?.currentTenant?.currency_code ?? 'BDT';

    const isOwner = Boolean(roleContext?.isOwner);
    const isCoAdmin = Boolean(roleContext?.isCoAdmin);
    const isManager = Boolean(roleContext?.isManager);
    const isSalesman = Boolean(roleContext?.isSalesman);

    const usagePercent = (used: number, limit: number) =>
        limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    const branchColumns = useMemo<Column<BranchPerfRow>[]>(
        () => [
            {
                id: 'name',
                label: 'Branch',
                sortable: true,
                render: (b) => (
                    <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {b.name}
                        </span>
                        <span className="ml-1.5 text-[11px] text-slate-400 tabular-nums">
                            ({b.code})
                        </span>
                    </div>
                ),
            },
            {
                id: 'open_counters',
                label: 'Counters Open',
                sortable: true,
                render: (b) => (
                    <span className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                        {b.open_counters} / {b.total_counters}
                    </span>
                ),
            },
            {
                id: 'today_sales',
                label: "Today's Sales",
                sortable: true,
                className: 'text-right',
                render: (b) => (
                    <span className="text-xs font-bold tabular-nums text-[#0E5F3F] dark:text-emerald-400">
                        {formatCurrency(b.today_sales, currency)}
                    </span>
                ),
            },
            {
                id: 'total_sales',
                label: 'Total Sales',
                sortable: true,
                className: 'text-right',
                render: (b) => (
                    <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(b.total_sales, currency)}
                    </span>
                ),
            },
            {
                id: 'total_bills',
                label: 'Bills',
                sortable: true,
                className: 'text-right',
                render: (b) => (
                    <span className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                        {b.total_bills}
                    </span>
                ),
            },
        ],
        [currency]
    );

    const topProductsColumns = useMemo<Column<TopProductRow>[]>(
        () => [
            {
                id: 'name',
                label: 'Medicine',
                sortable: true,
                render: (p) => (
                    <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {p.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                            {p.generic_name || p.sku}
                        </div>
                    </div>
                ),
            },
            {
                id: 'unit_price',
                label: 'Unit Price',
                sortable: true,
                className: 'text-right',
                render: (p) => (
                    <span className="tabular-nums text-xs font-medium text-slate-700 dark:text-slate-300">
                        {formatCurrency(p.unit_price, currency)}
                    </span>
                ),
            },
            {
                id: 'total_qty',
                label: 'Units Sold',
                sortable: true,
                className: 'text-right',
                render: (p) => (
                    <span className="tabular-nums text-xs font-bold text-[#0E5F3F] dark:text-emerald-400">
                        {p.total_qty.toLocaleString()}
                    </span>
                ),
            },
            {
                id: 'total_revenue',
                label: 'Sales Value',
                sortable: true,
                className: 'text-right',
                render: (p) => (
                    <span className="tabular-nums text-xs font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(p.total_revenue, currency)}
                    </span>
                ),
            },
        ],
        [currency]
    );

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
                        <span className="text-[11px] text-slate-400 tabular-nums">
                            {batch.medicine_sku}
                        </span>
                    </div>
                ),
            },
            {
                id: 'batch_number',
                label: 'Batch',
                render: (batch) => (
                    <span className="tabular-nums text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {batch.batch_number}
                    </span>
                ),
            },
            {
                id: 'quantity_available',
                label: 'Qty On Shelf',
                sortable: true,
                className: 'text-right',
                render: (batch) => (
                    <span className="tabular-nums text-xs font-bold text-slate-800 dark:text-slate-200">
                        {batch.quantity_available.toLocaleString()}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">
                            {batch.unit}
                        </span>
                    </span>
                ),
            },
            {
                id: 'expiry_date',
                label: 'Expires',
                sortable: true,
                render: (batch) => {
                    const isUrgent = batch.days_remaining <= 15;
                    const isExpired = batch.days_remaining <= 0;
                    return (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span
                                className={`tabular-nums text-xs font-semibold ${
                                    isExpired
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : isUrgent
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-slate-600 dark:text-slate-300'
                                }`}
                            >
                                {batch.expiry_date}
                            </span>
                            <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-[2px] ${
                                    isExpired
                                        ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                                        : isUrgent
                                          ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                            >
                                {isExpired ? 'Expired' : `${batch.days_remaining}d`}
                            </span>
                        </div>
                    );
                },
            },
        ],
        []
    );

    const recentSalesColumns = useMemo<Column<RecentSaleRow>[]>(
        () => [
            {
                id: 'invoice_number',
                label: isSalesman ? 'Order #' : 'Invoice / Order',
                render: (sale) => (
                    <div className="flex items-center gap-1.5">
                        <span className="tabular-nums text-xs font-bold text-[#0E5F3F] dark:text-emerald-400">
                            {sale.invoice_number}
                        </span>
                        {sale.branch_code && !isManager && !isSalesman && (
                            <span className="text-[10px] tabular-nums text-slate-400">
                                ({sale.branch_code})
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'customer_name',
                label: 'Customer',
                render: (sale) => (
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {sale.customer_name}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                            · {sale.sold_at}
                        </span>
                    </div>
                ),
            },
            {
                id: 'payment_status',
                label: 'Status',
                sortable: true,
                render: (sale) => {
                    const paid = sale.payment_status === 'paid';
                    return (
                        <span
                            className={`inline-flex px-2 py-0.5 rounded-[2px] text-[11px] font-semibold capitalize ${
                                paid
                                    ? 'bg-[#EAF5F0] text-[#0E5F3F] dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}
                        >
                            {sale.payment_status.replace('_', ' ')}
                        </span>
                    );
                },
            },
            {
                id: 'total_amount',
                label: 'Amount',
                sortable: true,
                className: 'text-right',
                render: (sale) => (
                    <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatCurrency(sale.total_amount, currency)}
                    </span>
                ),
            },
        ],
        [currency, isManager, isSalesman]
    );

    const pageTitle = isOwner
        ? 'Company Overview'
        : isCoAdmin
          ? 'Operations Overview'
          : isManager
            ? 'Branch Overview'
            : 'Sales Home';

    const pageSubtitle = isOwner
        ? `${tenant?.currentTenant?.name ?? 'Company'} · All ${stats.totalBranchesInCompany} Active Branches`
        : isCoAdmin
          ? `${tenant?.currentTenant?.name ?? 'Workspace'} · ${stats.branchCount} Assigned Branch(es)`
          : `${tenant?.currentTenant?.name ?? 'Workspace'} · ${tenant?.currentBranch?.name ?? 'Assigned Branch'}`;

    const renderHeaderActions = () => {
        if (isSalesman) {
            return (
                <>
                    <Link href={route('crm.customers')}>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] hover:border-[#0E5F3F] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                            <Contact2 className="h-3.5 w-3.5 text-[#0E5F3F]" />
                            Customers & Dues
                        </button>
                    </Link>
                    <Link href={route('sales.orders.my-orders')}>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] hover:border-[#0E5F3F] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                            <ClipboardList className="h-3.5 w-3.5 text-[#0E5F3F]" />
                            My Orders
                        </button>
                    </Link>
                    <Link href={route('sales.orders.create')}>
                        <Button variant="primary" size="sm">
                            <FilePlus2 className="h-3.5 w-3.5" />
                            New Sales Order
                        </Button>
                    </Link>
                </>
            );
        }

        if (isManager) {
            return (
                <>
                    <Link href={route('approvals.index')}>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] hover:border-[#0E5F3F] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                            <CheckSquare className="h-3.5 w-3.5 text-[#0E5F3F]" />
                            Approvals ({stats.pendingApprovalsCount})
                        </button>
                    </Link>
                    <Link href={route('counters.monitoring')}>
                        <Button variant="primary" size="sm">
                            <Monitor className="h-3.5 w-3.5" />
                            Counters Live View
                        </Button>
                    </Link>
                </>
            );
        }

        return (
            <>
                <Link href={route('approvals.index')}>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] hover:border-[#0E5F3F] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                        <CheckSquare className="h-3.5 w-3.5 text-[#0E5F3F]" />
                        Approvals ({stats.pendingApprovalsCount})
                    </button>
                </Link>
                <Link href={route('counters.monitoring')}>
                    <Button variant="primary" size="sm">
                        <Monitor className="h-3.5 w-3.5" />
                        Counter Monitoring
                    </Button>
                </Link>
            </>
        );
    };

    return (
        <AppLayout
            title={pageTitle}
            subtitle={pageSubtitle}
            actions={renderHeaderActions()}
        >
            <div className="space-y-4">
                {/* 1. SUPER ADMIN (BUSINESS OWNER) KPI ROW */}
                {isOwner && (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <MetricCard
                            title="Total Company Sales"
                            value={formatCurrency(stats.allTimeSalesTotal, currency)}
                            description={`Today: ${formatCurrency(stats.todaySalesTotal, currency)} (${stats.todaySalesCount} bills)`}
                            icon={DollarSign}
                            colorClass="bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 text-[#0E5F3F]"
                            onClick={() => router.visit(route('accounting.dashboard'))}
                        />
                        <MetricCard
                            title="Gross Profit Summary"
                            value={formatCurrency(
                                grossProfitSummary?.totalGrossProfit ?? 0,
                                currency
                            )}
                            description={`Margin: ${grossProfitSummary?.marginPercent ?? 0}% · Today: ${formatCurrency(grossProfitSummary?.todayGrossProfit ?? 0, currency)}`}
                            icon={TrendingUp}
                            colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                            onClick={() => router.visit(route('accounting.simple-pnl'))}
                        />
                        <MetricCard
                            title="Active Branches"
                            value={`${stats.totalBranchesInCompany}`}
                            description={`${stats.openCountersCount} / ${stats.totalCountersCount} counters open now`}
                            icon={GitBranch}
                            colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600"
                            onClick={() => router.visit(route('branches.index'))}
                        />
                        <MetricCard
                            title="Pending Approvals"
                            value={stats.pendingApprovalsCount}
                            description="Critical discount, return & voucher items"
                            icon={CheckSquare}
                            colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                            valueClassName={
                                stats.pendingApprovalsCount > 0 ? 'text-amber-600' : ''
                            }
                            onClick={() => router.visit(route('approvals.index'))}
                        />
                        <MetricCard
                            title="Cash Discrepancy Alerts"
                            value={formatCurrency(stats.cashDiscrepancyTotal, currency)}
                            description={`${stats.cashDiscrepancyCount} shift discrepancy flag(s)`}
                            icon={AlertTriangle}
                            colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                            valueClassName={
                                stats.cashDiscrepancyCount > 0 ? 'text-rose-600' : ''
                            }
                            onClick={() => router.visit(route('counters.monitoring'))}
                        />
                    </div>
                )}

                {/* 2. CO-ADMIN (DELEGATED OPERATIONS HEAD) KPI ROW — NO PROFIT OR BILLING */}
                {isCoAdmin && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <MetricCard
                            title="Assigned Branches Sales"
                            value={formatCurrency(stats.todaySalesTotal, currency)}
                            description={`${stats.todaySalesCount} bills today · Total ${formatCurrency(stats.allTimeSalesTotal, currency)}`}
                            icon={DollarSign}
                            colorClass="bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 text-[#0E5F3F]"
                            onClick={() => router.visit(route('accounting.day-book'))}
                        />
                        <MetricCard
                            title="Pending Approvals"
                            value={stats.pendingApprovalsCount}
                            description="Discounts, returns & operational vouchers"
                            icon={CheckSquare}
                            colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                            valueClassName={
                                stats.pendingApprovalsCount > 0 ? 'text-amber-600' : ''
                            }
                            onClick={() => router.visit(route('approvals.index'))}
                        />
                        <MetricCard
                            title="Live Counters & Queue"
                            value={`${stats.openCountersCount} / ${stats.totalCountersCount}`}
                            description={`${stats.waitingQueueCount} order(s) active in queue`}
                            icon={Monitor}
                            colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600"
                            onClick={() => router.visit(route('counters.monitoring'))}
                        />
                        <MetricCard
                            title="Stock & Expiry Alerts"
                            value={stats.lowStockCount}
                            description={`${stats.expiringSoonCount} batch(es) nearing expiry`}
                            icon={Package}
                            colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                            valueClassName={
                                stats.lowStockCount > 0 ? 'text-rose-600' : ''
                            }
                            onClick={() => router.visit(route('inventory.index'))}
                        />
                    </div>
                )}

                {/* 3. BRANCH MANAGER KPI ROW — STRICTLY OWN BRANCH */}
                {isManager && (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <MetricCard
                            title="Branch Sales Today"
                            value={formatCurrency(stats.todaySalesTotal, currency)}
                            description={`Branch total: ${formatCurrency(stats.allTimeSalesTotal, currency)}`}
                            icon={DollarSign}
                            colorClass="bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 text-[#0E5F3F]"
                            onClick={() => router.visit(route('accounting.day-book'))}
                        />
                        <MetricCard
                            title="Total Bills Today"
                            value={stats.todaySalesCount}
                            description={`${stats.waitingQueueCount} order(s) waiting at counters`}
                            icon={ReceiptText}
                            colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600"
                            onClick={() => router.visit(route('sales.orders.my-orders'))}
                        />
                        <MetricCard
                            title="Open Counters"
                            value={`${stats.openCountersCount} / ${stats.totalCountersCount}`}
                            description="Active terminals in your branch"
                            icon={Monitor}
                            colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                            onClick={() => router.visit(route('counters.monitoring'))}
                        />
                        <MetricCard
                            title="Low-Stock Items"
                            value={stats.lowStockCount}
                            description={`${stats.expiringSoonCount} near-expiry batch(es)`}
                            icon={AlertTriangle}
                            colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                            valueClassName={
                                stats.lowStockCount > 0 ? 'text-rose-600' : ''
                            }
                            onClick={() => router.visit(route('inventory.index'))}
                        />
                        <MetricCard
                            title="Branch Approvals"
                            value={stats.pendingApprovalsCount}
                            description="Returns, discounts & adjustments"
                            icon={CheckSquare}
                            colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                            valueClassName={
                                stats.pendingApprovalsCount > 0 ? 'text-amber-600' : ''
                            }
                            onClick={() => router.visit(route('approvals.index'))}
                        />
                    </div>
                )}

                {/* 6. SALESMAN KPI ROW */}
                {isSalesman && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <MetricCard
                            title="My Sales Today"
                            value={formatCurrency(stats.myTodaySalesTotal, currency)}
                            description={`${stats.myTodaySalesCount} order(s) created today`}
                            icon={DollarSign}
                            colorClass="bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 text-[#0E5F3F]"
                            onClick={() => router.visit(route('sales.collections.index'))}
                        />
                        <MetricCard
                            title="Target Achievement"
                            value={`${stats.targetAchievementPct}%`}
                            description={`Daily goal: ${formatCurrency(stats.salesmanDailyTarget, currency)}`}
                            icon={Target}
                            colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600"
                            onClick={() => router.visit(route('sales.orders.create'))}
                        />
                        <MetricCard
                            title="Orders Awaiting Payment"
                            value={stats.awaitingPaymentCount}
                            description={`${formatCurrency(stats.awaitingPaymentTotal, currency)} in cashier queue`}
                            icon={Clock}
                            colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                            valueClassName={
                                stats.awaitingPaymentCount > 0 ? 'text-amber-600' : ''
                            }
                            onClick={() => router.visit(route('sales.orders.my-orders'))}
                        />
                        <MetricCard
                            title="Top Selling Medicines"
                            value={topSellingProducts.length}
                            description="Fast-moving SKUs in your branch"
                            icon={ShoppingCart}
                            colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                            onClick={() => router.visit(route('sales.orders.create'))}
                        />
                    </div>
                )}

                {/* BRANCH PERFORMANCE TABLE FOR OWNER & CO-ADMIN */}
                {(isOwner || isCoAdmin) && branchPerformance.length > 0 && (
                    <div className="bg-white dark:bg-[#12161c] rounded-[2px] border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                        <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181a20]/50">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-[2px] bg-[#D5EDE2] dark:bg-[#0E5F3F]/15 text-[#0E5F3F] flex items-center justify-center shrink-0">
                                    <GitBranch size={15} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-[13px] sm:text-[14px] font-bold text-slate-800 dark:text-slate-200">
                                    {isOwner
                                        ? `All Branches Sales & Counter Performance (${branchPerformance.length})`
                                        : `Assigned Branches Sales Performance (${branchPerformance.length})`}
                                </h3>
                            </div>
                            <Link
                                href={route('counters.monitoring')}
                                className="text-[11px] sm:text-[12px] font-bold text-[#0E5F3F] hover:underline"
                            >
                                Live Counter Monitor
                            </Link>
                        </div>
                        <div className="[&_.border]:border-0 [&_.rounded-\[3px\]]:rounded-none">
                            <DataTable
                                data={branchPerformance}
                                columns={branchColumns}
                                compact={true}
                                selectable={false}
                                hideCheckbox={true}
                                hideToolbar={true}
                                hideViewToggle={true}
                                syncUrlParams={false}
                            />
                        </div>
                    </div>
                )}

                {/* SALESMAN: TOP & RECENT SELLING PRODUCTS */}
                {isSalesman && (
                    <div className="bg-white dark:bg-[#12161c] rounded-[2px] border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                        <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181a20]/50">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-[2px] bg-[#D5EDE2] dark:bg-[#0E5F3F]/15 text-[#0E5F3F] flex items-center justify-center shrink-0">
                                    <TrendingUp size={15} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-[13px] sm:text-[14px] font-bold text-slate-800 dark:text-slate-200">
                                    Recent & Top-Selling Medicines
                                </h3>
                            </div>
                            <Link
                                href={route('sales.orders.create')}
                                className="text-[11px] sm:text-[12px] font-bold text-[#0E5F3F] hover:underline"
                            >
                                Create New Order
                            </Link>
                        </div>
                        <div className="[&_.border]:border-0 [&_.rounded-\[3px\]]:rounded-none">
                            <DataTable
                                data={topSellingProducts}
                                columns={topProductsColumns}
                                compact={true}
                                selectable={false}
                                hideCheckbox={true}
                                hideToolbar={true}
                                hideViewToggle={true}
                                syncUrlParams={false}
                                emptyState={
                                    <EmptyState
                                        title="No product sales recorded yet"
                                        description="Top-selling medicines will appear here as orders are completed."
                                        icon={Package}
                                    />
                                }
                            />
                        </div>
                    </div>
                )}

                {/* EXPIRING BATCHES + LOW STOCK / PLAN QUOTA (OWNER, CO-ADMIN, MANAGER) */}
                {!isSalesman && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 bg-white dark:bg-[#12161c] rounded-[2px] border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                            <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181a20]/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-[2px] bg-[#D5EDE2] dark:bg-[#0E5F3F]/15 text-[#0E5F3F] flex items-center justify-center shrink-0">
                                        <Clock size={15} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-[13px] sm:text-[14px] font-bold text-slate-800 dark:text-slate-200">
                                        FEFO Expiring Batches ({expiringBatches.length})
                                    </h3>
                                </div>
                                <Link
                                    href={
                                        isOwner
                                            ? route('catalog.ui')
                                            : route('inventory.batches')
                                    }
                                    className="text-[11px] sm:text-[12px] font-bold text-[#0E5F3F] hover:underline"
                                >
                                    View All
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
                                    syncUrlParams={false}
                                    emptyState={
                                        <EmptyState
                                            title="All shelf batches healthy"
                                            description="No batches are expiring within your alert window."
                                            icon={Clock}
                                        />
                                    }
                                />
                            </div>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {isOwner && usage
                                        ? 'Subscription & Low Stock'
                                        : 'Low Stock Alerts'}
                                </CardTitle>
                                {isOwner && usage && (
                                    <StatusDot variant="brand">
                                        {tenant?.currentTenant?.plan?.name ?? 'Growth'}
                                    </StatusDot>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {isOwner &&
                                    usage &&
                                    [
                                        {
                                            label: 'Active Branches',
                                            used: usage.branches?.used ?? 1,
                                            limit: usage.branches?.limit ?? 1,
                                        },
                                        {
                                            label: 'Team Members',
                                            used: usage.users?.used ?? 1,
                                            limit: usage.users?.limit ?? 5,
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
                                                        className="h-full bg-[#0E5F3F] transition-all"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}

                                <div
                                    className={
                                        isOwner && usage
                                            ? 'pt-2 border-t border-slate-100 dark:border-slate-800'
                                            : ''
                                    }
                                >
                                    {lowStockMedicines.length === 0 ? (
                                        <p className="text-xs text-slate-500">
                                            All medicines are above reorder levels.
                                        </p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {lowStockMedicines.slice(0, 5).map((med) => (
                                                <div
                                                    key={med.id}
                                                    className="flex items-center justify-between rounded-[2px] border border-slate-100 dark:border-slate-800 px-2.5 py-1.5 text-xs"
                                                >
                                                    <span className="font-medium truncate pr-2 text-slate-800 dark:text-slate-200">
                                                        {med.name}
                                                    </span>
                                                    <span className="tabular-nums text-xs font-bold text-rose-600 dark:text-rose-400 shrink-0">
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
                )}

                {/* BOTTOM PANELS: RECENT INVOICES / ORDERS & AUDIT LOG */}
                <div
                    className={`grid grid-cols-1 ${
                        recentAuditLogs.length > 0 && !isSalesman
                            ? 'lg:grid-cols-2'
                            : 'lg:grid-cols-1'
                    } gap-4`}
                >
                    <div className="bg-white dark:bg-[#12161c] rounded-[2px] border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                        <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181a20]/50">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-[2px] bg-[#D5EDE2] dark:bg-[#0E5F3F]/15 text-[#0E5F3F] flex items-center justify-center shrink-0">
                                    <ShoppingCart size={15} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-[13px] sm:text-[14px] font-bold text-slate-800 dark:text-slate-200">
                                    {isSalesman
                                        ? `My Recent Orders (${recentSales.length})`
                                        : `Recent Invoices & Orders (${recentSales.length})`}
                                </h3>
                            </div>
                            <Link
                                href={
                                    isSalesman
                                        ? route('sales.orders.my-orders')
                                        : isManager
                                          ? route('sales.orders.my-orders')
                                          : route('counters.monitoring')
                                }
                                className="text-[11px] sm:text-[12px] font-bold text-[#0E5F3F] hover:underline"
                            >
                                See All
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
                                syncUrlParams={false}
                                emptyState={
                                    <EmptyState
                                        title="No recent orders"
                                        description="Completed sales and orders will appear here automatically."
                                        icon={ShoppingCart}
                                    />
                                }
                            />
                        </div>
                    </div>

                    {recentAuditLogs.length > 0 && !isSalesman && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-[#0E5F3F]" />
                                    <CardTitle>
                                        {isManager
                                            ? 'Branch Audit Log'
                                            : isCoAdmin
                                              ? 'Operational Audit Log'
                                              : 'Company Audit Log'}
                                    </CardTitle>
                                </div>
                                <Link
                                    href={`${route('team.index')}?tab=activity`}
                                    className="text-[11px] font-bold text-[#0E5F3F] hover:underline"
                                >
                                    Full Log
                                </Link>
                            </CardHeader>
                            <CardContent className="p-0">
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
                                            <span className="shrink-0 tabular-nums text-[10.5px] text-slate-400">
                                                {log.action}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
