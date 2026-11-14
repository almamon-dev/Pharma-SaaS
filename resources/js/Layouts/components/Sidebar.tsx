import React from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Building2,
    Contact2,
    CreditCard,
    Layers,
    LayoutDashboard,
    LogOut,
    Package,
    Settings,
    ShieldCheck,
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

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { auth, subscription, tenant } = usePage<SharedPageProps>().props;
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
                href: route('admin.dashboard'),
                active: route().current('admin.dashboard'),
                icon: LayoutDashboard,
            },
            {
                category: 'SaaS Business Owner',
                name: 'Subscription Plans',
                href: route('admin.plans'),
                active: route().current('admin.plans*'),
                icon: CreditCard,
            },
            {
                category: 'SaaS Business Owner',
                name: 'Features & Access',
                href: route('admin.features'),
                active: route().current('admin.features*'),
                icon: Sparkles,
            },
            {
                category: 'SaaS Business Owner',
                name: 'Subscribers & Tenants',
                href: route('admin.subscribers'),
                active: route().current('admin.subscribers*'),
                icon: Users,
            },
            {
                category: 'Account',
                name: 'Profile & Security',
                href: route('settings.profile'),
                active: route().current('settings.profile*'),
                icon: UserCog,
            },
        ];
    } else if (!isWorkspaceReady) {
        navEntries = [
            {
                category: 'Activate Subscription',
                name: 'Choose a Plan',
                href: route('plans.index'),
                active: route().current('plans.*'),
                icon: Layers,
            },
            {
                category: 'Activate Subscription',
                name: 'Billing & Invoices',
                href: route('subscription.index'),
                active: route().current('subscription.*'),
                icon: CreditCard,
            },
            ...(hasSubscription
                ? [
                      {
                          category: 'Activate Subscription',
                          name: 'Business Tenants',
                          href: route('tenants.index'),
                          active: route().current('tenants.*'),
                          icon: Store,
                      },
                  ]
                : []),
            {
                category: 'Account',
                name: 'Profile & Security',
                href: route('settings.profile'),
                active: route().current('settings.profile*'),
                icon: UserCog,
            },
        ];
    } else {
        const dispensingItems = [
            ...(hasFeature('pos') && hasPerm('pos.sell')
                ? [
                      {
                          name: 'Point of Sale',
                          href: route('pos.index'),
                          active: route().current('pos.*'),
                      },
                  ]
                : []),
            ...(hasFeature('inventory') &&
            hasPerm('inventory.view', 'inventory.manage')
                ? [
                      {
                          name: 'Inventory & FEFO',
                          href: route('inventory.index'),
                          active: route().current('inventory.*'),
                      },
                  ]
                : []),
        ];

        const crmItems = [
            ...(hasFeature('crm') && hasPerm('crm.view', 'crm.manage')
                ? [
                      {
                          name: 'Customers (Patients)',
                          href: route('crm.customers'),
                          active: route().current('crm.customers*'),
                      },
                      {
                          name: 'Suppliers Directory',
                          href: route('crm.suppliers'),
                          active: route().current('crm.suppliers*'),
                      },
                  ]
                : []),
        ];

        const organizationItems = [
            ...(isSubscriberAdmin
                ? [
                      {
                          name: 'Business Tenants',
                          href: route('tenants.index'),
                          active: route().current('tenants.*'),
                      },
                  ]
                : []),
            ...(hasFeature('branches')
                ? [
                      {
                          name: 'Branches',
                          href: route('branches.index'),
                          active: route().current('branches.*'),
                      },
                  ]
                : []),
            ...(hasFeature('team_rbac') && hasPerm('team.manage')
                ? [
                      {
                          name: 'Employees & Roles',
                          href: route('team.index'),
                          active: route().current('team.*'),
                      },
                  ]
                : []),
        ];

        navEntries = [
            {
                category: 'Main Menu',
                name: 'Dashboard',
                href: route('dashboard'),
                active: route().current('dashboard'),
                icon: LayoutDashboard,
            },
            ...(dispensingItems.length > 0
                ? [
                      {
                          category: 'Main Menu',
                          group: 'Dispensing & Stock',
                          icon: Package,
                          items: dispensingItems,
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
            ...(organizationItems.length > 0
                ? [
                      {
                          category: 'Organization',
                          group: 'Tenants & Team',
                          icon: Building2,
                          items: organizationItems,
                      },
                  ]
                : []),
            ...(isSubscriberAdmin
                ? [
                      {
                          category: 'Organization',
                          name: 'Feature Access',
                          href: route('features.index'),
                          active: route().current('features.*'),
                          icon: Sparkles,
                      },
                      {
                          category: 'Organization',
                          name: 'Browse Plans',
                          href: route('plans.index'),
                          active: route().current('plans.*'),
                          icon: Layers,
                      },
                      {
                          category: 'Organization',
                          name: 'Billing & Subscription',
                          href: route('subscription.index'),
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
                          href: route('settings.business'),
                          active: route().current('settings.business*'),
                          icon: Settings,
                      },
                  ]
                : []),
            {
                category: 'Organization',
                name: 'Profile & Security',
                href: route('settings.profile'),
                active: route().current('settings.profile*'),
                icon: UserCog,
            },
        ];
    }

    const handleLogout = () => {
        router.post(route('logout'));
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
                            ? route('admin.dashboard')
                            : isWorkspaceReady
                              ? route('dashboard')
                              : route('plans.index')
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

            <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 custom-scrollbar">
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
