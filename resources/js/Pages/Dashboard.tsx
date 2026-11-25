import { useMemo } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    Clock,
    Contact2,
    DollarSign,
    GitBranch,
    Package,
    Plus,
    ShoppingCart,
    Store,
    UserCheck,
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

interface CounterInfo {
    id: number;
    code: string;
    name: string;
    type: string;
    zone?: string | null;
    status: string;
    has_active_session: boolean;
    opening_float: number;
    expected_cash: number;
    session_sales: number;
    session_transactions: number;
}

interface RoleContext {
    role: string;
    label: string;
    badge: string;
    description: string;
    isOwnerOrAdmin: boolean;
    isManager: boolean;
    isPharmacist: boolean;
    isCashier: boolean;
    isClerk: boolean;
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
        todaySalesTotal?: number | null;
        todaySalesCount?: number | null;
        myTodaySalesTotal?: number;
        myTodaySalesCount?: number;
        branchCount: number;
        teamCount: number;
    };
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
    counter?: CounterInfo | null;
    roleContext?: RoleContext;
}

export default function Dashboard({
    stats,
    expiringBatches = [],
    lowStockMedicines = [],
    recentSales = [],
    recentAuditLogs = [],
    usage,
    counter,
    roleContext,
}: DashboardProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const currency = tenant?.currentTenant?.currency_code ?? 'BDT';
    const enabledFeatures = new Set(tenant?.enabledFeatures ?? []);
    const hasFeature = (key: string) => enabledFeatures.has(key);

    const isCashier = Boolean(roleContext?.isCashier);
    const isPharmacist = Boolean(roleContext?.isPharmacist);
    const isClerk = Boolean(roleContext?.isClerk);
    const isManager = Boolean(roleContext?.isManager);
    const isOwnerOrAdmin = Boolean(roleContext?.isOwnerOrAdmin);

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
                render: (batch) => (
                    <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
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
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
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
                                className={`font-mono text-xs font-semibold ${
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
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                    isExpired
                                        ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                                        : isUrgent
                                          ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                            >
                                {isExpired
                                    ? 'Expired'
                                    : `${batch.days_remaining}d`}
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
                label: 'Invoice',
                render: (sale) => (
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-[#FF4A1F]">
                            {sale.invoice_number}
                        </span>
                        {sale.branch_code && (
                            <span className="text-[10px] font-mono text-slate-400">
                                ({sale.branch_code})
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'customer_name',
                label: 'Customer & Cashier',
                render: (sale) => (
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
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

    const pageTitle = isCashier
        ? 'POS Cashier Station'
        : isPharmacist
          ? 'Dispensing & Clinical Safety'
          : isClerk
            ? 'Inventory & Supply Intake'
            : isManager
              ? 'Branch Operations Management'
              : 'Executive Workspace Overview';

    const renderHeaderActions = () => {
        if (isCashier) {
            return (
                <>
                    <Link href={route('counters.index')}>
                        <Button variant="outline" size="sm">
                            <Store className="h-3.5 w-3.5" />
                            Counters & Shifts
                        </Button>
                    </Link>
                    <Link href={route('crm.customers')}>
                        <Button variant="outline" size="sm">
                            <Users className="h-3.5 w-3.5" />
                            Patients / CRM
                        </Button>
                    </Link>
                    <Link href={route('pos.index')}>
                        <Button variant="primary" size="sm">
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Open POS Terminal
                        </Button>
                    </Link>
                </>
            );
        }

        if (isPharmacist) {
            return (
                <>
                    <Link href={route('catalog.ui')}>
                        <Button variant="outline" size="sm">
                            <Package className="h-3.5 w-3.5" />
                            Product Catalog
                        </Button>
                    </Link>
                    <Link href={route('inventory.index')}>
                        <Button variant="outline" size="sm">
                            <Clock className="h-3.5 w-3.5" />
                            FEFO Batches
                        </Button>
                    </Link>
                    <Link href={route('pos.index')}>
                        <Button variant="primary" size="sm">
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Dispense / POS
                        </Button>
                    </Link>
                </>
            );
        }

        if (isClerk) {
            return (
                <>
                    <Link href={route('inventory.batches')}>
                        <Button variant="outline" size="sm">
                            <Clock className="h-3.5 w-3.5" />
                            Batches & Expiry
                        </Button>
                    </Link>
                    <Link href={route('crm.suppliers')}>
                        <Button variant="outline" size="sm">
                            <Contact2 className="h-3.5 w-3.5" />
                            Suppliers Directory
                        </Button>
                    </Link>
                    <Link href={route('inventory.index')}>
                        <Button variant="primary" size="sm">
                            <Plus className="h-3.5 w-3.5" />
                            Stock Batch Entry
                        </Button>
                    </Link>
                </>
            );
        }

        return (
            <>
                {hasFeature('branches') &&
                    tenant?.canManageOrganization &&
                    usage &&
                    (usage.branches?.used ?? 0) < (usage.branches?.limit ?? 1) && (
                        <Link href={`${route('branches.index')}?create=1`}>
                            <Button variant="outline" size="sm">
                                <GitBranch className="h-3.5 w-3.5" />
                                Add Branch
                            </Button>
                        </Link>
                    )}
                <Link href={route('counters.index')}>
                    <Button variant="outline" size="sm">
                        <Store className="h-3.5 w-3.5" />
                        Counters
                    </Button>
                </Link>
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
        );
    };

    return (
        <AppLayout
            title={pageTitle}
            subtitle={`${tenant?.currentTenant?.name ?? 'Business Tenant'} · ${
                tenant?.currentBranch?.name ?? 'All Branches'
            }`}
            actions={renderHeaderActions()}
        >
            <div className="space-y-4">
                {/* Role-Tailored Metric Cards Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {isCashier ? (
                        <>
                            <MetricCard
                                title="My Sales Today"
                                value={formatCurrency(
                                    stats.myTodaySalesTotal || 0,
                                    currency
                                )}
                                description={`${stats.myTodaySalesCount || 0} completed checkout(s)`}
                                icon={DollarSign}
                                colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                                onClick={() => router.visit(route('pos.index'))}
                            />
                            <MetricCard
                                title="Active Counter Terminal"
                                value={counter?.code || 'C-01'}
                                description={`${counter?.name || 'Main Counter'} · ${counter?.type || 'Retail'}`}
                                icon={Store}
                                colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600"
                                onClick={() => router.visit(route('counters.index'))}
                            />
                            <MetricCard
                                title="Cash Drawer Balance"
                                value={formatCurrency(
                                    counter?.expected_cash || 0,
                                    currency
                                )}
                                description={`Opening float: ${formatCurrency(counter?.opening_float || 0, currency)}`}
                                icon={DollarSign}
                                colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                                onClick={() => router.visit(route('counters.index'))}
                            />
                            <MetricCard
                                title="Shift Transactions"
                                value={counter?.session_transactions || 0}
                                description={
                                    counter?.has_active_session
                                        ? 'Serving active shift'
                                        : 'Terminal ready for shift'
                                }
                                icon={UserCheck}
                                colorClass="bg-purple-50 dark:bg-purple-500/10 text-purple-600"
                                onClick={() => router.visit(route('counters.index'))}
                            />
                        </>
                    ) : isPharmacist ? (
                        <>
                            <MetricCard
                                title="Expiring Soon (FEFO Alert)"
                                value={stats.expiringSoonCount}
                                description="Batches within shelf alert window"
                                icon={Clock}
                                colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                                valueClassName={
                                    stats.expiringSoonCount > 0 ? 'text-amber-600' : ''
                                }
                                onClick={() => router.visit(route('inventory.index'))}
                            />
                            <MetricCard
                                title="Low Stock Medicines"
                                value={stats.lowStockCount}
                                description="At or below reorder threshold"
                                icon={AlertTriangle}
                                colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                                valueClassName={
                                    stats.lowStockCount > 0 ? 'text-rose-600' : ''
                                }
                                onClick={() => router.visit(route('inventory.index'))}
                            />
                            <MetricCard
                                title="Active Catalog SKUs"
                                value={stats.totalMedicines}
                                description={`${stats.totalStockUnits.toLocaleString()} units on shelves`}
                                icon={Package}
                                colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600"
                                onClick={() => router.visit(route('catalog.ui'))}
                            />
                            <MetricCard
                                title="Today's Dispensed Invoices"
                                value={stats.todaySalesCount ?? 0}
                                description="Customer prescriptions & retail sales"
                                icon={ShoppingCart}
                                colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                                onClick={() => router.visit(route('pos.index'))}
                            />
                        </>
                    ) : isClerk ? (
                        <>
                            <MetricCard
                                title="Active Medicine SKUs"
                                value={stats.totalMedicines}
                                description="Registered catalog products"
                                icon={Package}
                                colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600"
                                onClick={() => router.visit(route('catalog.ui'))}
                            />
                            <MetricCard
                                title="Physical Stock Units"
                                value={stats.totalStockUnits.toLocaleString()}
                                description="Available units in warehouse"
                                icon={Package}
                                colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                                onClick={() => router.visit(route('inventory.index'))}
                            />
                            <MetricCard
                                title="Expiring Soon (FEFO Alert)"
                                value={stats.expiringSoonCount}
                                description="Within shelf expiry window"
                                icon={Clock}
                                colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                                valueClassName={
                                    stats.expiringSoonCount > 0 ? 'text-amber-600' : ''
                                }
                                onClick={() => router.visit(route('inventory.index'))}
                            />
                            <MetricCard
                                title="Low Stock Reorders Needed"
                                value={stats.lowStockCount}
                                description="Medicines needing supplier PO"
                                icon={AlertTriangle}
                                colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                                valueClassName={
                                    stats.lowStockCount > 0 ? 'text-rose-600' : ''
                                }
                                onClick={() => router.visit(route('inventory.index'))}
                            />
                        </>
                    ) : (
                        // Manager / Owner / Admin
                        <>
                            <MetricCard
                                title="Today's Sales"
                                value={formatCurrency(
                                    stats.todaySalesTotal || 0,
                                    currency
                                )}
                                description={`${stats.todaySalesCount || 0} completed invoice(s)`}
                                icon={DollarSign}
                                colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                                onClick={() => router.visit(route('pos.index'))}
                            />
                            <MetricCard
                                title="Inventory Valuation"
                                value={formatCurrency(
                                    stats.inventoryValuation || 0,
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
                        </>
                    )}
                </div>

                {/* Role-Tailored Middle Section: Summary Shortcuts */}
                {isCashier ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <SummaryCard
                            badge="Cashier POS"
                            title="Open Point of Sale Terminal"
                            description="Process quick customer sales with barcode scanning, cash drawer calculation, and instant receipts."
                            highlight={`Assigned to: ${counter?.code || 'C-01'} · ${counter?.name || 'Cash Counter'}`}
                            icon={ShoppingCart}
                            onClick={() => router.visit(route('pos.index'))}
                        />
                        <SummaryCard
                            badge="Cash Shifts"
                            title="Counter Drawer & Shifts"
                            description="Monitor shift cash float, register sales, break lock/resume, and shift closing reconciliation."
                            highlight={`Expected Cash: ${formatCurrency(counter?.expected_cash || 0, currency)}`}
                            icon={Store}
                            onClick={() => router.visit(route('counters.index'))}
                        />
                    </div>
                ) : isPharmacist ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <SummaryCard
                            badge="Clinical Dispense"
                            title="Prescriptions & POS"
                            description="Dispense prescription medications, verify patient allergies, and select priority FEFO batches."
                            highlight={`Branch: ${tenant?.currentBranch?.name ?? 'Main Outlet'}`}
                            icon={ShoppingCart}
                            onClick={() => router.visit(route('pos.index'))}
                        />
                        <SummaryCard
                            badge="FEFO Shelf"
                            title="Batch Expiry Priority"
                            description={`${stats.expiringSoonCount} batch(es) nearing expiry within window. Check shelves for first-out priority.`}
                            highlight="Patient safety compliance"
                            icon={Clock}
                            onClick={() => router.visit(route('inventory.index'))}
                        />
                        <SummaryCard
                            badge="Medicine Directory"
                            title="Product Catalog & SKUs"
                            description={`Review ${stats.totalMedicines} medicine dosage forms, generic categories, and manufacturer info.`}
                            highlight="Complete Formulary"
                            icon={Package}
                            onClick={() => router.visit(route('catalog.ui'))}
                        />
                    </div>
                ) : isClerk ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <SummaryCard
                            badge="Procurement"
                            title="Stock Batch Intake"
                            description="Record vendor delivery shipments, lot numbers, manufacturing dates, and warehouse batch restocks."
                            highlight="Warehouse Inventory"
                            icon={Plus}
                            onClick={() => router.visit(route('inventory.index'))}
                        />
                        <SummaryCard
                            badge="Batch Expiry"
                            title="Expiry & Movement Tracker"
                            description="Track FEFO movement logs, damaged batch disposal, and returns to pharmaceutical distributors."
                            highlight={`${stats.expiringSoonCount} urgent batch(es)`}
                            icon={Clock}
                            onClick={() => router.visit(route('inventory.batches'))}
                        />
                        <SummaryCard
                            badge="Vendors"
                            title="Suppliers & PO Ledger"
                            description="Maintain supplier contact directories, trade terms, and purchase shipment records."
                            highlight="Supplier Directory"
                            icon={Contact2}
                            onClick={() => router.visit(route('crm.suppliers'))}
                        />
                    </div>
                ) : (
                    // Manager / Admin Summary Cards
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
                                    ? `${stats.teamCount} active staff member(s) assigned across Owner, Manager, Pharmacist, and Cashier roles.`
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
                )}

                {/* Table Section: Tailored per Role */}
                {!isCashier && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div
                            className={`${
                                usage && isOwnerOrAdmin
                                    ? 'lg:col-span-2'
                                    : 'lg:col-span-3'
                            } bg-white dark:bg-[#12161c] rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden`}
                        >
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

                        {/* Plan Quota Usage (only for Owner/Admin) */}
                        {usage && isOwnerOrAdmin && (
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
                                            used: usage.branches?.used ?? 1,
                                            limit: usage.branches?.limit ?? 1,
                                        },
                                        {
                                            label: 'Team Members',
                                            used: usage.users?.used ?? 1,
                                            limit: usage.users?.limit ?? 5,
                                        },
                                        {
                                            label: 'Catalog Medicines',
                                            used: usage.medicines?.used ?? 0,
                                            limit: usage.medicines?.limit ?? 500,
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
                        )}
                    </div>
                )}

                {/* Bottom Panels: Invoices & Activity */}
                <div
                    className={`grid grid-cols-1 ${
                        recentAuditLogs.length > 0 && !isCashier && !isPharmacist && !isClerk
                            ? 'lg:grid-cols-2'
                            : 'lg:grid-cols-1'
                    } gap-4`}
                >
                    {/* Recent POS Invoices (shown to Cashier, Pharmacist, Manager, Admin) */}
                    {!isClerk && (
                        <div className="bg-white dark:bg-[#12161c] rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                            <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181a20]/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-orange-100/70 dark:bg-[#ff4a1f]/15 text-[#FF4A1F] flex items-center justify-center shrink-0">
                                        <ShoppingCart size={15} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-[13px] sm:text-[14px] font-bold text-slate-800 dark:text-slate-200">
                                        {isCashier
                                            ? `My Recent Checkouts (${recentSales.length})`
                                            : `Recent Invoices (${recentSales.length})`}
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
                                    syncUrlParams={false}
                                    emptyState={
                                        <EmptyState
                                            title="No POS invoices today"
                                            description="Completed checkout receipts will appear here automatically."
                                            icon={ShoppingCart}
                                        />
                                    }
                                />
                            </div>
                        </div>
                    )}

                    {/* Low Stock List for Clerk / Pharmacist if not shown above */}
                    {(isClerk || isPharmacist) && (
                        <div className="bg-white dark:bg-[#12161c] rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                            <div className="flex items-center justify-between px-3.5 sm:px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#181a20]/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-rose-100/70 dark:bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
                                        <AlertTriangle size={15} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-[13px] sm:text-[14px] font-bold text-slate-800 dark:text-slate-200">
                                        Low Stock & Reorder Alerts ({lowStockMedicines.length})
                                    </h3>
                                </div>
                                <Link
                                    href={route('inventory.index')}
                                    className="text-[11px] sm:text-[12px] font-bold text-[#FF4A1F] hover:underline transition-colors"
                                >
                                    Manage Stock
                                </Link>
                            </div>
                            <div className="p-3">
                                {lowStockMedicines.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-6 text-center">
                                        All inventory items are currently above their reorder thresholds.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {lowStockMedicines.map((med) => (
                                            <div
                                                key={med.id}
                                                className="flex items-center justify-between rounded-[3px] border border-slate-100 dark:border-slate-800 px-3 py-2 text-xs bg-slate-50/40 dark:bg-[#151921]/40"
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <span className="font-semibold text-slate-900 dark:text-white truncate block">
                                                        {med.name}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-slate-400">
                                                        SKU: {med.sku}
                                                    </span>
                                                </div>
                                                <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums shrink-0">
                                                    {med.available_stock} / {med.reorder_level} {med.unit}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Workspace Audit Trail (Only for Owner/Admin & Manager) */}
                    {recentAuditLogs.length > 0 && !isCashier && !isPharmacist && !isClerk && (
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
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}