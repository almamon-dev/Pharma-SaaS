import React, { useLayoutEffect, useRef } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    ClipboardList,
    Contact2,
    CreditCard,
    GitBranch,
    Layers,
    LayoutDashboard,
    LogOut,
    Package,
    ReceiptText,
    Settings,
    ShieldCheck,
    ShoppingCart,
    Sparkles,
    Store,
    UserCog,
    Users,
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
    const { auth, subscription, tenant } = usePage<SharedPageProps>().props;
    const navScrollRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (navScrollRef.current && persistedSidebarScrollTop > 0) {
            navScrollRef.current.scrollTop = persistedSidebarScrollTop;
        }
    }, []);
    const user = auth?.user;
    const isSuperAdmin = Boolean(user?.is_super_admin);
    const isSubscriberAdmin = Boolean(user?.is_subscriber_admin);
    const permissions = new Set(tenant?.permissions ?? []);
    const enabledFeatures = new Set(tenant?.enabledFeatures ?? []);
    const hasWorkspace = Boolean(tenant?.currentTenant);
    const hasSubscription = Boolean(subscription?.is_usable);
    const isWorkspaceReady = hasWorkspace && hasSubscription;

    const hasPerm = (...keys: string[]) =>
        isSubscriberAdmin || keys.some((k) => permissions.has(k));
    const hasFeature = (key: string) => enabledFeatures.has(key);

    let navEntries: SidebarEntry[] = [];

    if (isSuperAdmin) {
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
        navEntries = [
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
    } else {
        const inventoryItems = [
            ...(hasFeature('inventory') &&
            hasPerm('inventory.view', 'inventory.manage', 'inventory.adjust')
                ? [
                      {
                          name: 'Product Catalog',
                          href: toPath('catalog.ui'),
                          active: route().current('catalog.*'),
                      },
                      {
                          name: 'Inventory & FEFO',
                          href: toPath('inventory.index'),
                          active: route().current('inventory.index'),
                      },
                      {
                          name: 'Batches & Expiry',
                          href: hasFeature('batch_expiry')
                              ? toPath('inventory.batches')
                              : toPath('plans.browse'),
                          active: route().current('inventory.batches'),
                          locked: !hasFeature('batch_expiry'),
                      },
                      {
                          name: 'Stock Movements',
                          href: hasFeature('batch_expiry')
                              ? toPath('inventory.movements')
                              : toPath('plans.browse'),
                          active: route().current('inventory.movements'),
                          locked: !hasFeature('batch_expiry'),
                      },
                  ]
                : []),
        ];

        const crmItems = [
            ...(hasFeature('crm') && hasPerm('crm.view', 'crm.manage')
                ? [
                      {
                          name: 'Customers (Patients)',
                          href: toPath('crm.customers'),
                          active: route().current('crm.customers*'),
                      },
                      {
                          name: 'Suppliers Directory',
                          href: toPath('crm.suppliers'),
                          active: route().current('crm.suppliers*'),
                      },
                  ]
                : []),
        ];

        const organizationEntries: SidebarEntry[] = [
            ...(isSubscriberAdmin
                ? [
                      {
                          category: 'Organization',
                          name: 'Business Tenants',
                          href: toPath('tenants.index'),
                          active: route().current('tenants.*'),
                          icon: Store,
                      },
                  ]
                : []),
            ...(isSubscriberAdmin || (hasFeature('branches') && hasPerm('branches.manage', 'branch.manage'))
                ? [
                      {
                          category: 'Organization',
                          name: 'Branches',
                          href: toPath('branches.index'),
                          active: route().current('branches.*'),
                          icon: GitBranch,
                      },
                  ]
                : []),
            ...(isSubscriberAdmin || (hasFeature('team_rbac') && hasPerm('team.manage', 'user.manage', 'role.manage'))
                ? [
                      {
                          category: 'Organization',
                          group: 'Employees & Roles',
                          icon: Users,
                          items: [
                              {
                                  name: 'Staff Directory',
                                  href: toPath('team.index'),
                                  active: route().current('team.index') && (typeof window === 'undefined' || !window.location.search.includes('tab=')),
                              },
                              {
                                  name: 'Roles & Permissions',
                                  href: `${toPath('team.index')}?tab=matrix`,
                                  active: route().current('team.*') && typeof window !== 'undefined' && window.location.search.includes('tab=matrix'),
                              },
                              {
                                  name: 'Activity & Audit Log',
                                  href: `${toPath('team.index')}?tab=activity`,
                                  active: route().current('team.*') && typeof window !== 'undefined' && window.location.search.includes('tab=activity'),
                              },
                          ],
                      },
                  ]
                : []),
        ];

        const canManageCounters = isSubscriberAdmin || hasPerm('branch.manage') || tenant?.role === 'admin' || tenant?.role === 'manager';

        navEntries = [
            {
                category: 'Main Menu',
                name: 'Dashboard',
                href: toPath('dashboard'),
                active: route().current('dashboard'),
                icon: LayoutDashboard,
            },
            ...(hasFeature('pos') && (hasPerm('sales_orders.create', 'sales_orders.view_own') || tenant?.role === 'salesman' || isSubscriberAdmin || tenant?.role === 'admin' || tenant?.role === 'manager')
                ? [
                      {
                          category: 'Main Menu',
                          group: 'Sales Orders',
                          icon: ClipboardList,
                          items: [
                              {
                                  name: 'New Sales Order',
                                  href: toPath('sales.orders.create'),
                                  active: route().current('sales.orders.create'),
                              },
                              {
                                  name: 'My Orders & Tracking',
                                  href: toPath('sales.orders.my-orders'),
                                  active: route().current('sales.orders.my-orders'),
                              },
                          ],
                      },
                  ]
                : []),
            ...(hasFeature('pos') && (hasPerm('sales_orders.process', 'payments.receive') || tenant?.role === 'cashier' || isSubscriberAdmin || tenant?.role === 'admin' || tenant?.role === 'manager')
                ? [
                      {
                          category: 'Main Menu',
                          name: 'Cashier Station',
                          href: toPath('cashier.dashboard'),
                          active: route().current('cashier.dashboard'),
                          icon: ReceiptText,
                      },
                  ]
                : []),
            ...(hasFeature('pos') && (hasPerm('pos.sell', 'cash_counters.view') || tenant?.role === 'cashier' || isSubscriberAdmin || tenant?.role === 'admin' || tenant?.role === 'manager')
                ? [
                      ...(hasPerm('pos.sell') && tenant?.role !== 'salesman'
                          ? [
                                {
                                    category: 'Main Menu',
                                    name: 'Point of Sale (Direct)',
                                    href: toPath('pos.index'),
                                    active: route().current('pos.*'),
                                    icon: ShoppingCart,
                                },
                            ]
                          : []),
                      ...(hasPerm('cash_counters.view', 'cash_register.open') || tenant?.role === 'cashier' || canManageCounters
                          ? canManageCounters
                              ? [
                                    {
                                        category: 'Main Menu',
                                        group: 'Counters & Shifts',
                                        icon: Store,
                                        items: [
                                            {
                                                name: 'Counter Terminals',
                                                href: toPath('counters.index'),
                                                active: route().current('counters.index'),
                                            },
                                            {
                                                name: 'Live Queue Monitor',
                                                href: toPath('counters.monitoring'),
                                                active: route().current('counters.monitoring'),
                                            },
                                        ],
                                    },
                                ]
                              : [
                                    {
                                        category: 'Main Menu',
                                        name: 'My Terminal Shift',
                                        href: toPath('counters.index'),
                                        active: route().current('counters.index'),
                                        icon: Store,
                                    },
                                ]
                          : []),
                  ]
                : []),
            ...(inventoryItems.length > 0
                ? [
                      {
                          category: 'Main Menu',
                          group: 'Inventory & Stock',
                          icon: Package,
                          items: inventoryItems,
                      },
                  ]
                : []),
            ...(crmItems.length > 0
                ? [
                      {
                          category: 'Main Menu',
                          group: 'CRM & Partners',
                          icon: Contact2,
                          items: crmItems,
                      },
                  ]
                : []),
            ...organizationEntries,
            ...(isSubscriberAdmin
                ? [
                      {
                          category: 'Organization',
                          name: 'Feature Access',
                          href: toPath('features.index'),
                          active: route().current('features.*'),
                          icon: Sparkles,
                      },
                      {
                          category: 'Organization',
                          name: 'Browse Plans',
                          href: toPath('plans.index'),
                          active: route().current('plans.*'),
                          icon: Layers,
                      },
                      {
                          category: 'Organization',
                          name: 'Billing & Subscription',
                          href: toPath('subscription.index'),
                          active: route().current('subscription.*'),
                          icon: CreditCard,
                      },
                  ]
                : []),
            ...(hasPerm('settings.manage')
                ? [
                      {
                          category: 'Organization',
                          name: 'Business Settings',
                          href: toPath('settings.business'),
                          active: route().current('settings.business*'),
                          icon: Settings,
                      },
                  ]
                : []),
            {
                category: 'Organization',
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
                    href={
                        isSuperAdmin
                            ? toPath('admin.dashboard')
                            : isWorkspaceReady
                              ? toPath('dashboard')
                              : toPath('plans.index')
                    }
                    onClick={() => {
                        if (window.innerWidth < 1024) onClose?.();
                    }}
                >
                    <BrandLogo
                        size="md"
                        showText={isOpen}
                        subtitle={
                            isOpen
                                ? isSuperAdmin
                                    ? 'Platform Super Admin'
                                    : tenant?.currentTenant?.name ??
                                      'Business Subscription'
                                : undefined
                        }
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
                                    className={`px-3 mb-2 text-[11px] font-bold text-slate-400/90 dark:text-slate-500 transition-opacity duration-300 ${
                                        idx > 0 ? 'mt-4' : 'mt-1'
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
                                    className={`flex items-center px-3 py-2 text-[13px] rounded-lg transition-all mb-0.5 whitespace-nowrap group relative overflow-hidden ${
                                        !isOpen
                                            ? 'lg:justify-center lg:px-0'
                                            : ''
                                    } ${
                                        item.active
                                            ? 'text-[#ff4a1f] dark:text-[#ff6a45] font-semibold bg-orange-50/70 dark:bg-[#ff4a1f]/10'
                                            : 'font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
                                    }`}
                                >
                                    <item.icon
                                        size={17}
                                        className={`shrink-0 transition-transform duration-300 ${
                                            isOpen ? 'mr-3' : 'mr-3 lg:mr-0'
                                        } ${
                                            item.active
                                                ? 'text-[#ff4a1f]'
                                                : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
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
                                </Link>
                            )}
                        </React.Fragment>
                    );
                })}

                {isSuperAdmin && isOpen && (
                    <div className="mx-2 mt-4 rounded-lg border border-orange-200/80 bg-orange-50/60 dark:border-orange-900/40 dark:bg-orange-950/20 p-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#ff4a1f]">
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
                    className={`w-full flex items-center px-3 py-2 text-[13px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap group overflow-hidden ${
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
