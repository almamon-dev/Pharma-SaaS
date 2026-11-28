import React, { useLayoutEffect, useRef } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Activity,
    Boxes,
    CheckSquare,
    ClipboardCheck,
    ClipboardList,
    Contact2,
    CreditCard,
    FilePlus2,
    FileSpreadsheet,
    GitBranch,
    Home,
    Layers,
    LayoutDashboard,
    Lock,
    LogOut,
    Monitor,
    Package,
    Pill,
    Settings,
    ShieldCheck,
    ShoppingBag,
    ShoppingCart,
    SlidersHorizontal,
    Sparkles,
    Store,
    UserCog,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import { BrandLogo } from '@/Components/BrandLogo';
import { SharedPageProps } from '@/types';
import { NavGroup, SidebarGroupItem } from './NavGroup';

interface SidebarSingleItem {
    category?: string;
    name: string;
    href: string;
    active: boolean;
    icon: React.ElementType;
    locked?: boolean;
    badge?: number;
}

type SidebarEntry =
    | SidebarSingleItem
    | (SidebarGroupItem & { category?: string });

interface SidebarProps {
    isOpen: boolean;
    onClose?: () => void;
}

let persistedSidebarScrollTop = 0;

const toPath = (name: string) => route(name, undefined, false);

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { props, url } = usePage<SharedPageProps>();
    const { auth, subscription, tenant, pharmacist } = props;
    const navScrollRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (navScrollRef.current && persistedSidebarScrollTop > 0) {
            navScrollRef.current.scrollTop = persistedSidebarScrollTop;
        }
    }, []);

    const user = auth?.user;
    const isSuperAdmin = Boolean(user?.is_super_admin);
    const isSubscriberAdmin = Boolean(user?.is_subscriber_admin);
    const isBusinessOwner = Boolean(isSubscriberAdmin || tenant?.isOwner);
    const primaryRole = tenant?.role ?? null;
    const permissions = new Set(tenant?.permissions ?? []);
    const hasWorkspace = Boolean(tenant?.currentTenant);
    const hasSubscription = Boolean(subscription?.is_usable);
    const isWorkspaceReady = hasWorkspace && hasSubscription;

    const hasPerm = (...keys: string[]) =>
        isBusinessOwner || keys.some((k) => permissions.has(k));

    const pendingApprovalsCount = tenant?.pendingApprovalsCount ?? 0;
    const pendingRxCount = pharmacist?.pendingRxCount ?? 0;
    const batchAlertCount = tenant?.batchAlertCount ?? 0;

    const isTeamMatrixTab = url.includes('tab=matrix');
    const isTeamActivityTab = url.includes('tab=activity');
    const isTeamUsersView =
        route().current('team.index') && !isTeamMatrixTab && !isTeamActivityTab;
    const isCashierIncomingTab = url.includes('tab=incoming');

    let navEntries: SidebarEntry[] = [];
    let homeHref = toPath('dashboard');
    let roleSubtitle =
        tenant?.currentTenant?.name ?? 'Business Subscription';

    if (isSuperAdmin) {
        homeHref = toPath('admin.dashboard');
        roleSubtitle = 'Platform Super Admin';
        navEntries = [
            {
                category: 'SaaS Business Owner',
                name: 'Platform Overview',
                href: toPath('admin.dashboard'),
                active: route().current('admin.dashboard'),
                icon: LayoutDashboard,
            },
            {
                category: 'SaaS Business Owner',
                name: 'Subscription Plans',
                href: toPath('admin.plans'),
                active: route().current('admin.plans*'),
                icon: CreditCard,
            },
            {
                category: 'SaaS Business Owner',
                name: 'Features & Access',
                href: toPath('admin.features'),
                active: route().current('admin.features*'),
                icon: Sparkles,
            },
            {
                category: 'SaaS Business Owner',
                name: 'Subscribers & Tenants',
                href: toPath('admin.subscribers'),
                active: route().current('admin.subscribers*'),
                icon: Users,
            },
            {
                category: 'SaaS Business Owner',
                name: 'Demo Roles & Features',
                href: toPath('admin.demo_roles'),
                active: route().current('admin.demo_roles*'),
                icon: UserCog,
            },
            {
                category: 'Account',
                name: 'Profile & Security',
                href: toPath('settings.profile'),
                active: route().current('settings.profile*'),
                icon: UserCog,
            },
        ];
    } else if (!isWorkspaceReady) {
        homeHref = toPath('plans.index');
        navEntries = [
            {
                category: 'Activate Subscription',
                name: 'Choose Features & Pricing',
                href: toPath('pricing.index'),
                active: route().current('pricing.*'),
                icon: Sparkles,
            },
            {
                category: 'Activate Subscription',
                name: 'Choose a Plan',
                href: toPath('plans.index'),
                active: route().current('plans.*'),
                icon: Layers,
            },
            {
                category: 'Activate Subscription',
                name: 'Billing & Invoices',
                href: toPath('subscription.index'),
                active: route().current('subscription.*'),
                icon: CreditCard,
            },
            ...(hasSubscription
                ? [
                      {
                          category: 'Activate Subscription',
                          name: 'Business Tenants',
                          href: toPath('tenants.index'),
                          active: route().current('tenants.*'),
                          icon: Store,
                      },
                  ]
                : []),
            {
                category: 'Account',
                name: 'Profile & Security',
                href: toPath('settings.profile'),
                active: route().current('settings.profile*'),
                icon: UserCog,
            },
        ];
    } else if (isBusinessOwner) {
        // ১. Super Admin (Business Owner)
        roleSubtitle = 'Super Admin (Owner)';
        navEntries = [
            {
                category: 'Company Overview',
                name: 'Dashboard',
                href: toPath('dashboard'),
                active: route().current('dashboard'),
                icon: LayoutDashboard,
            },
            {
                category: 'Company Overview',
                group: 'Organization',
                icon: GitBranch,
                items: [
                    {
                        name: 'Branches',
                        href: toPath('branches.index'),
                        active: route().current('branches.*'),
                    },
                    {
                        name: 'Business Tenants',
                        href: toPath('tenants.index'),
                        active: route().current('tenants.*'),
                    },
                    {
                        name: 'Counter Monitoring',
                        href: toPath('counters.monitoring'),
                        active: route().current('counters.monitoring'),
                    },
                ],
            },
            {
                category: 'Company Overview',
                group: 'Users & Roles',
                icon: Users,
                items: [
                    {
                        name: 'Admins, Managers & Staff',
                        href: toPath('team.index'),
                        active: isTeamUsersView,
                    },
                    {
                        name: 'Role Permissions',
                        href: `${toPath('team.index')}?tab=matrix`,
                        active: route().current('team.index') && isTeamMatrixTab,
                    },
                ],
            },
            {
                category: 'Company Overview',
                name: 'Approvals',
                href: toPath('approvals.index'),
                active: route().current('approvals.*'),
                icon: CheckSquare,
                badge: pendingApprovalsCount,
            },
            {
                category: 'Catalog & Finance',
                name: 'Product Catalog',
                href: toPath('catalog.ui'),
                active: route().current('catalog.*'),
                icon: Package,
            },
            {
                category: 'Catalog & Finance',
                group: 'Financial Reports',
                icon: FileSpreadsheet,
                items: [
                    {
                        name: 'Profit & Loss (P&L)',
                        href: toPath('accounting.simple-pnl'),
                        active: route().current('accounting.simple-pnl'),
                    },
                    {
                        name: 'Cash Flow & Reports',
                        href: toPath('accounting.extra-reports'),
                        active: route().current('accounting.extra-reports*'),
                    },
                    {
                        name: 'VAT Summary',
                        href: toPath('accounting.vat-summary'),
                        active: route().current('accounting.vat-summary'),
                    },
                    {
                        name: 'Parties & Ageing',
                        href: toPath('accounting.parties.index'),
                        active: route().current('accounting.parties.*'),
                    },
                    {
                        name: 'Day & Cash Book',
                        href: toPath('accounting.dashboard'),
                        active: route().current('accounting.dashboard'),
                    },
                ],
            },
            {
                category: 'Governance & Billing',
                name: 'Audit Log',
                href: `${toPath('team.index')}?tab=activity`,
                active: route().current('team.index') && isTeamActivityTab,
                icon: Activity,
            },
            {
                category: 'Governance & Billing',
                group: 'Settings & Billing',
                icon: Settings,
                items: [
                    {
                        name: 'Business Settings',
                        href: toPath('settings.business'),
                        active: route().current('settings.business*'),
                    },
                    {
                        name: 'Subscription & Plans',
                        href: toPath('subscription.index'),
                        active: route().current('subscription.*'),
                    },
                    {
                        name: 'Browse Plans',
                        href: toPath('plans.index'),
                        active: route().current('plans.*'),
                    },
                    {
                        name: 'Security & Profile',
                        href: toPath('settings.profile'),
                        active: route().current('settings.profile*'),
                    },
                ],
            },
        ];
    } else if (primaryRole === 'co_admin' || primaryRole === 'admin') {
        // ২. Admin (Delegated Operations Head / Co-Admin)
        roleSubtitle = 'Admin (Operations Head)';
        const staffSubItems: SidebarGroupItem['items'] = [];
        if (hasPerm('user.manage', 'team.manage')) {
            staffSubItems.push({
                name: 'Manage Staff',
                href: toPath('team.index'),
                active: isTeamUsersView,
            });
        }
        if (hasPerm('role.manage')) {
            staffSubItems.push({
                name: 'Role Permissions',
                href: `${toPath('team.index')}?tab=matrix`,
                active: route().current('team.index') && isTeamMatrixTab,
            });
        }

        navEntries = [
            {
                category: 'Operations Overview',
                name: 'Dashboard',
                href: toPath('dashboard'),
                active: route().current('dashboard'),
                icon: LayoutDashboard,
            },
            {
                category: 'Operations Overview',
                name: 'Branches',
                href: toPath('branches.index'),
                active: route().current('branches.*'),
                icon: GitBranch,
            },
            {
                category: 'Operations Overview',
                name: 'Approvals',
                href: toPath('approvals.index'),
                active: route().current('approvals.*'),
                icon: CheckSquare,
                badge: pendingApprovalsCount,
            },
            ...(staffSubItems.length > 0
                ? [
                      {
                          category: 'Operations Overview',
                          group: 'Staff & Roles',
                          icon: Users,
                          items: staffSubItems,
                      },
                  ]
                : []),
            {
                category: 'Live Operations',
                name: 'Counter Monitoring',
                href: toPath('counters.monitoring'),
                active: route().current('counters.monitoring'),
                icon: Monitor,
            },
            {
                category: 'Live Operations',
                group: 'Reports',
                icon: FileSpreadsheet,
                items: [
                    {
                        name: 'Sales & Day Book',
                        href: toPath('accounting.day-book'),
                        active: route().current('accounting.day-book'),
                    },
                    {
                        name: 'Stock & Inventory',
                        href: toPath('inventory.index'),
                        active: route().current('inventory.index'),
                    },
                    {
                        name: 'Expiry Report',
                        href: toPath('inventory.batches'),
                        active: route().current('inventory.batches'),
                        badge: batchAlertCount > 0 ? batchAlertCount : undefined,
                    },
                ],
            },
            {
                category: 'Governance',
                name: 'Audit Log',
                href: `${toPath('team.index')}?tab=activity`,
                active: route().current('team.index') && isTeamActivityTab,
                icon: Activity,
            },
            {
                category: 'Account',
                name: 'Profile & Security',
                href: toPath('settings.profile'),
                active: route().current('settings.profile*'),
                icon: UserCog,
            },
        ];
    } else if (primaryRole === 'manager') {
        // ৩. Branch Manager (নির্দিষ্ট ব্রাঞ্চের প্রধান)
        roleSubtitle = `${tenant?.currentBranch?.name ?? 'Branch'} Manager`;
        navEntries = [
            {
                category: 'Branch Overview',
                name: 'Dashboard',
                href: toPath('dashboard'),
                active: route().current('dashboard'),
                icon: LayoutDashboard,
            },
            {
                category: 'Branch Overview',
                name: 'Approvals',
                href: toPath('approvals.index'),
                active: route().current('approvals.*'),
                icon: CheckSquare,
                badge: pendingApprovalsCount,
            },
            {
                category: 'Branch Operations',
                group: 'Sales & Orders',
                icon: ShoppingCart,
                items: [
                    {
                        name: 'Orders Tracking',
                        href: toPath('sales.orders.my-orders'),
                        active: route().current('sales.orders.my-orders'),
                    },
                    {
                        name: 'Counters Live View',
                        href: toPath('counters.monitoring'),
                        active: route().current('counters.monitoring'),
                    },
                    {
                        name: 'Counter Terminals',
                        href: toPath('counters.index'),
                        active: route().current('counters.index'),
                    },
                ],
            },
            {
                category: 'Branch Operations',
                group: 'Inventory & Stock',
                icon: Package,
                items: [
                    {
                        name: 'Medicines & Stock',
                        href: toPath('inventory.index'),
                        active: route().current('inventory.index'),
                    },
                    {
                        name: 'Product Catalog',
                        href: toPath('catalog.ui'),
                        active: route().current('catalog.*'),
                    },
                    {
                        name: 'Purchases & Suppliers',
                        href: toPath('crm.suppliers'),
                        active: route().current('crm.suppliers*'),
                    },
                    {
                        name: 'Expiry Tracker',
                        href: toPath('inventory.batches'),
                        active: route().current('inventory.batches'),
                        badge: batchAlertCount > 0 ? batchAlertCount : undefined,
                    },
                ],
            },
            {
                category: 'Team & Analytics',
                name: 'Branch Staff',
                href: toPath('team.index'),
                active: isTeamUsersView,
                icon: Users,
            },
            {
                category: 'Team & Analytics',
                group: 'Reports',
                icon: FileSpreadsheet,
                items: [
                    {
                        name: 'Branch Sales Report',
                        href: toPath('accounting.day-book'),
                        active: route().current('accounting.day-book'),
                    },
                    {
                        name: 'Stock Movements',
                        href: toPath('inventory.movements'),
                        active: route().current('inventory.movements'),
                    },
                ],
            },
            {
                category: 'Team & Analytics',
                name: 'Audit Log',
                href: `${toPath('team.index')}?tab=activity`,
                active: route().current('team.index') && isTeamActivityTab,
                icon: Activity,
            },
            {
                category: 'Account',
                name: 'Profile & Security',
                href: toPath('settings.profile'),
                active: route().current('settings.profile*'),
                icon: UserCog,
            },
        ];
    } else if (primaryRole === 'pharmacist') {
        // ৫. Pharmacist (ক্লিনিক্যাল ও ফার্মেসি স্টক)
        homeHref = toPath('pharmacist.dashboard');
        roleSubtitle = 'Pharmacist · Clinical & Stock';
        navEntries = [
            {
                category: 'Pharmacy Today',
                name: 'Dashboard',
                href: toPath('pharmacist.dashboard'),
                active:
                    route().current('dashboard') ||
                    route().current('pharmacist.dashboard'),
                icon: LayoutDashboard,
            },
            {
                category: 'Pharmacy Today',
                name: 'Rx to Verify',
                href: toPath('pharmacist.prescriptions'),
                active: route().current('pharmacist.prescriptions*'),
                icon: ClipboardCheck,
                badge: pendingRxCount,
            },
            {
                category: 'Pharmacy Today',
                name: 'Dispensed Today',
                href: toPath('pharmacist.dispensing'),
                active: route().current('pharmacist.dispensing'),
                icon: Pill,
            },
            {
                category: 'Pharmacy Stock',
                group: 'Medicines & Batches',
                icon: Boxes,
                items: [
                    {
                        name: 'Batches, FEFO & Expiry',
                        href: toPath('inventory.batches'),
                        active: route().current('inventory.batches'),
                        badge: batchAlertCount > 0 ? batchAlertCount : undefined,
                    },
                    {
                        name: 'Inventory Stock',
                        href: toPath('inventory.index'),
                        active: route().current('inventory.index'),
                    },
                    {
                        name: 'Medicine Search',
                        href: toPath('pharmacist.medicine-search'),
                        active: route().current('pharmacist.medicine-search'),
                    },
                ],
            },
            {
                category: 'Pharmacy Stock',
                name: 'Stock Adjustment',
                href: toPath('inventory.movements'),
                active: route().current('inventory.movements'),
                icon: SlidersHorizontal,
            },
            {
                category: 'Pharmacy Stock',
                group: 'Purchases & Returns',
                icon: ShoppingBag,
                items: [
                    {
                        name: 'Purchase Requests',
                        href: toPath('pharmacist.purchase-requests'),
                        active: route().current('pharmacist.purchase-requests'),
                    },
                    {
                        name: 'Supplier & Sales Returns',
                        href: toPath('pharmacist.returns'),
                        active: route().current('pharmacist.returns'),
                    },
                    {
                        name: 'Suppliers Directory',
                        href: toPath('crm.suppliers'),
                        active: route().current('crm.suppliers*'),
                    },
                ],
            },
            {
                category: 'Clinical Reports',
                group: 'Reports',
                icon: FileSpreadsheet,
                items: [
                    {
                        name: 'Pharmacy & Expiry Report',
                        href: toPath('pharmacist.stock-expiry'),
                        active: route().current('pharmacist.stock-expiry'),
                    },
                    {
                        name: 'Controlled Drugs Log',
                        href: toPath('pharmacist.controlled-drugs'),
                        active: route().current('pharmacist.controlled-drugs'),
                    },
                    {
                        name: 'Patient Medication History',
                        href: toPath('pharmacist.patient-history'),
                        active: route().current('pharmacist.patient-history'),
                    },
                ],
            },
            {
                category: 'Account',
                name: 'Profile & Security',
                href: toPath('settings.profile'),
                active: route().current('settings.profile*'),
                icon: UserCog,
            },
        ];
    } else if (primaryRole === 'cashier') {
        // ৭. Cashier (POS ও পেমেন্ট কালেকশন)
        homeHref = toPath('cashier.dashboard');
        roleSubtitle = 'Cashier · POS & Collection';
        navEntries = [
            {
                category: 'Cashier Station',
                name: 'Home',
                href: toPath('cashier.dashboard'),
                active:
                    route().current('cashier.dashboard') && !isCashierIncomingTab,
                icon: Home,
            },
            {
                category: 'Cashier Station',
                name: 'Pending Orders',
                href: `${toPath('cashier.dashboard')}?tab=incoming`,
                active:
                    route().current('cashier.dashboard') && isCashierIncomingTab,
                icon: ClipboardList,
            },
            {
                category: 'Cashier Station',
                name: 'New Bill (Direct POS)',
                href: toPath('pos.index'),
                active: route().current('pos.*'),
                icon: ShoppingCart,
            },
            {
                category: 'Cashier Station',
                name: 'My Shift',
                href: toPath('counters.index'),
                active: route().current('counters.index'),
                icon: Store,
            },
            {
                category: 'Account',
                name: 'Profile & Security',
                href: toPath('settings.profile'),
                active: route().current('settings.profile*'),
                icon: UserCog,
            },
        ];
    } else {
        // ৬. Salesman (অর্ডার ও কাস্টমার হ্যান্ডলিং)
        roleSubtitle = 'Salesman · Orders & Customers';
        navEntries = [
            {
                category: 'Sales Home',
                name: 'Home',
                href: toPath('dashboard'),
                active: route().current('dashboard'),
                icon: Home,
            },
            {
                category: 'Sales Home',
                name: 'New Order',
                href: toPath('sales.orders.create'),
                active: route().current('sales.orders.create'),
                icon: FilePlus2,
            },
            {
                category: 'Sales Home',
                name: 'My Orders',
                href: toPath('sales.orders.my-orders'),
                active: route().current('sales.orders.my-orders'),
                icon: ClipboardList,
            },
            {
                category: 'Sales Home',
                name: 'Customers',
                href: toPath('crm.customers'),
                active: route().current('crm.customers*'),
                icon: Contact2,
            },
            {
                category: 'Sales Home',
                name: 'My Sales',
                href: toPath('sales.collections.index'),
                active: route().current('sales.collections.*'),
                icon: Wallet,
            },
            {
                category: 'Account',
                name: 'Profile & Security',
                href: toPath('settings.profile'),
                active: route().current('settings.profile*'),
                icon: UserCog,
            },
        ];
    }

    const handleLogout = () => {
        router.post(toPath('logout'));
    };

    return (
        <aside
            className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto bg-white dark:bg-[#12161c] shadow-2xl lg:shadow-none border-r border-slate-200 dark:border-slate-800 transform transition-all duration-300 ease-in-out flex flex-col overflow-hidden ${
                isOpen
                    ? 'w-64 translate-x-0'
                    : '-translate-x-full lg:w-[72px] lg:translate-x-0'
            }`}
        >
            <div className="h-16 flex items-center justify-between lg:justify-start px-4 sm:px-5 border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 whitespace-nowrap">
                <Link
                    href={homeHref}
                    onClick={() => {
                        if (window.innerWidth < 1024) onClose?.();
                    }}
                >
                    <BrandLogo
                        size="md"
                        showText={isOpen}
                        subtitle={isOpen ? roleSubtitle : undefined}
                    />
                </Link>
                {isOpen && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="lg:hidden p-1.5 rounded-full border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                        title="Close menu"
                        aria-label="Close menu"
                    >
                        <X size={17} strokeWidth={2} />
                    </button>
                )}
            </div>

            <div
                ref={navScrollRef}
                onScroll={(e) => {
                    persistedSidebarScrollTop = e.currentTarget.scrollTop;
                }}
                className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 custom-scrollbar"
            >
                {navEntries.map((item, idx) => {
                    const prevCategory =
                        idx > 0 ? navEntries[idx - 1].category : null;
                    const showCategory =
                        item.category && item.category !== prevCategory;

                    return (
                        <React.Fragment key={idx}>
                            {showCategory && (
                                <div
                                    className={`px-3 mb-1.5 text-[11px] font-bold text-slate-400/90 dark:text-slate-500 transition-opacity duration-300 ${
                                        idx > 0
                                            ? 'mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80'
                                            : 'mt-1'
                                    } ${!isOpen ? 'lg:hidden' : ''}`}
                                >
                                    {item.category}
                                </div>
                            )}

                            {'group' in item ? (
                                <NavGroup
                                    item={item}
                                    isOpen={isOpen}
                                    onClose={onClose}
                                />
                            ) : (
                                <Link
                                    href={item.href}
                                    title={!isOpen ? item.name : undefined}
                                    onClick={() => {
                                        if (window.innerWidth < 1024)
                                            onClose?.();
                                    }}
                                    className={`flex items-center px-3 py-2 text-[13px] rounded-[2px] transition-colors mb-0.5 whitespace-nowrap group relative overflow-hidden ${
                                        !isOpen
                                            ? 'lg:justify-center lg:px-0'
                                            : ''
                                    } ${
                                        item.active
                                            ? 'text-[#0E5F3F] dark:text-[#34D399] font-semibold bg-[#EAF5F0] dark:bg-[#0E5F3F]/15'
                                            : 'font-medium text-[#333333] dark:text-slate-400 hover:text-[#0E5F3F] dark:hover:text-slate-200 hover:bg-[#F5F7F4] dark:hover:bg-slate-800/50'
                                    }`}
                                >
                                    <item.icon
                                        size={17}
                                        className={`shrink-0 transition-transform duration-300 ${
                                            isOpen ? 'mr-3' : 'mr-3 lg:mr-0'
                                        } ${
                                            item.active
                                                ? 'text-[#0E5F3F]'
                                                : 'text-[#666666] dark:text-slate-500 group-hover:text-[#0E5F3F] dark:group-hover:text-slate-300'
                                        }`}
                                    />
                                    <span
                                        className={`transition-all duration-300 ${
                                            isOpen
                                                ? 'opacity-100 max-w-[160px]'
                                                : 'opacity-0 max-w-0 lg:hidden'
                                        } truncate`}
                                    >
                                        {item.name}
                                    </span>
                                    {isOpen &&
                                        typeof item.badge === 'number' &&
                                        item.badge > 0 && (
                                            <span className="ml-auto shrink-0 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-[#D9534F] text-white text-[10.5px] font-bold font-mono leading-none">
                                                {item.badge}
                                            </span>
                                        )}
                                    {!isOpen &&
                                        typeof item.badge === 'number' &&
                                        item.badge > 0 && (
                                            <span className="hidden lg:inline-flex absolute top-1 right-2 w-2 h-2 rounded-full bg-[#D9534F]" />
                                        )}
                                    {isOpen && item.locked && (
                                        <span
                                            className="ml-auto shrink-0 flex items-center justify-center text-slate-400 dark:text-slate-500"
                                            title="Locked by plan - Click to Upgrade"
                                        >
                                            <Lock size={12} strokeWidth={2} />
                                        </span>
                                    )}
                                </Link>
                            )}
                        </React.Fragment>
                    );
                })}

                {isSuperAdmin && isOpen && (
                    <div className="mx-2 mt-4 rounded-[2px] border border-[#0E5F3F]/25 bg-[#EAF5F0] dark:border-emerald-900/40 dark:bg-emerald-950/20 p-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0E5F3F]">
                            <ShieldCheck size={14} />
                            Platform SaaS Mode
                        </div>
                        <p className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            Managing global subscription plans and tenant
                            subscribers.
                        </p>
                    </div>
                )}
            </div>

            <div className="p-2 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <button
                    type="button"
                    onClick={handleLogout}
                    title={!isOpen ? 'Logout' : undefined}
                    className={`w-full flex items-center px-3 py-2 text-[13px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-[2px] transition-colors cursor-pointer whitespace-nowrap group overflow-hidden ${
                        !isOpen ? 'lg:justify-center lg:px-0' : ''
                    }`}
                >
                    <LogOut
                        size={17}
                        className={`shrink-0 ${
                            isOpen ? 'mr-3' : 'mr-3 lg:mr-0'
                        }`}
                    />
                    <span
                        className={`transition-all duration-300 ${
                            isOpen
                                ? 'opacity-100 max-w-[150px]'
                                : 'opacity-0 max-w-0 lg:hidden'
                        } truncate`}
                    >
                        Logout
                    </span>
                </button>
            </div>
        </aside>
    );
}
