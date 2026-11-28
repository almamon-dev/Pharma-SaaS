import React, { useLayoutEffect, useRef } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    BellRing,
    Boxes,
    ClipboardCheck,
    ClipboardList,
    Contact2,
    CreditCard,
    FilePlus2,
    FileSpreadsheet,
    GitBranch,
    Layers,
    LayoutDashboard,
    Lock,
    LogOut,
    Package,
    Pill,
    ReceiptText,
    RotateCcw,
    Search,
    Settings,
    ShieldAlert,
    ShieldCheck,
    ShoppingBag,
    ShoppingCart,
    Sparkles,
    Stethoscope,
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
    const { auth, subscription, tenant, pharmacist } = usePage<SharedPageProps>().props;
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
    } else {
        const inventoryEntries: SidebarEntry[] =
            hasFeature('inventory') &&
            hasPerm('inventory.view', 'inventory.manage', 'inventory.adjust')
                ? [
                      {
                          category: 'Inventory & Stock',
                          group: 'Catalog & Stock',
                          icon: Package,
                          items: [
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
                                  badge:
                                      hasFeature('batch_expiry') && (tenant?.batchAlertCount ?? 0) > 0
                                          ? tenant?.batchAlertCount
                                          : undefined,
                              },
                              {
                                  name: 'Stock Movements',
                                  href: hasFeature('batch_expiry')
                                      ? toPath('inventory.movements')
                                      : toPath('plans.browse'),
                                  active: route().current('inventory.movements'),
                                  locked: !hasFeature('batch_expiry'),
                              },
                          ],
                      },
                  ]
                : [];

        const crmEntries: SidebarEntry[] =
            hasFeature('crm') && hasPerm('crm.view', 'crm.manage')
                ? [
                      {
                          category: 'CRM & Partners',
                          group: 'Patients & Partners',
                          icon: Contact2,
                          items: [
                              {
                                  name: 'Customers (Patients)',
                                  href: toPath('crm.customers'),
                                  active: route().current('crm.customers*'),
                              },
                              {
                                  name: 'Refills & Follow-ups',
                                  href: toPath('crm.followups'),
                                  active: route().current('crm.followups*'),
                              },
                              {
                                  name: 'Suppliers Directory',
                                  href: toPath('crm.suppliers'),
                                  active: route().current('crm.suppliers*'),
                              },
                          ],
                      },
                  ]
                : [];

        const hrmEntries: SidebarEntry[] = [];

        const orgItems: SidebarGroupItem['items'] = [
            ...(isSubscriberAdmin
                ? [
                      {
                          name: 'Business Tenants',
                          href: toPath('tenants.index'),
                          active: route().current('tenants.*'),
                      },
                  ]
                : []),
            ...(isSubscriberAdmin || (hasFeature('branches') && hasPerm('branches.manage', 'branch.manage'))
                ? [
                      {
                          name: 'Branches',
                          href: toPath('branches.index'),
                          active: route().current('branches.*'),
                      },
                  ]
                : []),

        ];

        const organizationEntries: SidebarEntry[] = orgItems.length
            ? [
                  {
                      category: 'Organization',
                      group: 'Workspace & Team',
                      icon: GitBranch,
                      items: orgItems,
                  },
              ]
            : [];

        const canManageCounters = isSubscriberAdmin || hasPerm('branch.manage') || tenant?.role === 'admin' || tenant?.role === 'manager';
        const isSalesmanOnly = tenant?.role === 'salesman' && !isSubscriberAdmin && !canManageCounters;
        const isPharmacistOnly = tenant?.role === 'pharmacist' && !isSubscriberAdmin && !canManageCounters;
        const pendingRxCount = pharmacist?.pendingRxCount ?? 0;

        if (isPharmacistOnly) {
            navEntries = [
                {
                    category: 'Main Menu',
                    name: 'Dashboard',
                    href: toPath('dashboard'),
                    active: route().current('dashboard') || route().current('pharmacist.dashboard'),
                    icon: LayoutDashboard,
                },
                {
                    category: 'Main Menu',
                    name: 'Prescription Queue',
                    href: toPath('pharmacist.prescriptions'),
                    active: route().current('pharmacist.prescriptions*'),
                    icon: ClipboardCheck,
                    badge: pendingRxCount,
                },
                {
                    category: 'Main Menu',
                    name: 'Dispensing',
                    href: toPath('pharmacist.dispensing'),
                    active: route().current('pharmacist.dispensing'),
                    icon: Pill,
                },
                {
                    category: 'Main Menu',
                    name: 'Medicine Search',
                    href: toPath('pharmacist.medicine-search'),
                    active: route().current('pharmacist.medicine-search'),
                    icon: Search,
                },
                {
                    category: 'Main Menu',
                    name: 'Patient Medication History',
                    href: toPath('pharmacist.patient-history'),
                    active: route().current('pharmacist.patient-history'),
                    icon: Stethoscope,
                },
                {
                    category: 'Main Menu',
                    name: 'Stock & Expiry',
                    href: toPath('pharmacist.stock-expiry'),
                    active: route().current('pharmacist.stock-expiry'),
                    icon: Boxes,
                },
                {
                    category: 'Main Menu',
                    name: 'Purchase Request',
                    href: toPath('pharmacist.purchase-requests'),
                    active: route().current('pharmacist.purchase-requests'),
                    icon: ShoppingBag,
                },
                {
                    category: 'Main Menu',
                    name: 'Returns',
                    href: toPath('pharmacist.returns'),
                    active: route().current('pharmacist.returns'),
                    icon: RotateCcw,
                },
                {
                    category: 'Main Menu',
                    name: 'Controlled Drugs Log',
                    href: toPath('pharmacist.controlled-drugs'),
                    active: route().current('pharmacist.controlled-drugs'),
                    icon: ShieldAlert,
                },
                {
                    category: 'Organization',
                    name: 'Profile & Security',
                    href: toPath('settings.profile'),
                    active: route().current('settings.profile*'),
                    icon: UserCog,
                },
            ];
        } else if (isSalesmanOnly) {
            navEntries = [
                {
                    category: 'Main Menu',
                    name: 'Dashboard',
                    href: toPath('dashboard'),
                    active: route().current('dashboard'),
                    icon: LayoutDashboard,
                },
                {
                    category: 'Main Menu',
                    name: 'New Sales Order',
                    href: toPath('sales.orders.create'),
                    active: route().current('sales.orders.create'),
                    icon: FilePlus2,
                },
                {
                    category: 'Main Menu',
                    name: 'My Orders & Tracking',
                    href: toPath('sales.orders.my-orders'),
                    active: route().current('sales.orders.my-orders'),
                    icon: ClipboardList,
                },
                {
                    category: 'Main Menu',
                    name: 'My Customers',
                    href: toPath('crm.customers'),
                    active: route().current('crm.customers*'),
                    icon: Contact2,
                },
                {
                    category: 'Main Menu',
                    name: 'Refills & Follow-ups',
                    href: toPath('crm.followups'),
                    active: route().current('crm.followups*'),
                    icon: BellRing,
                },
                {
                    category: 'Main Menu',
                    name: 'Collections & Dues',
                    href: toPath('sales.collections.index'),
                    active: route().current('sales.collections.*'),
                    icon: Wallet,
                },
                {
                    category: 'Main Menu',
                    name: 'Product Catalog',
                    href: toPath('catalog.ui'),
                    active: route().current('catalog.*'),
                    icon: Pill,
                },
                {
                    category: 'Main Menu',
                    name: 'Returns',
                    href: toPath('sales.returns.index'),
                    active: route().current('sales.returns.*'),
                    icon: RotateCcw,
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
                          category: 'Sales & Cashier',
                          group: 'Sales Orders',
                          icon: FilePlus2,
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
                              {
                                  name: 'Collections & Dues',
                                  href: toPath('sales.collections.index'),
                                  active: route().current('sales.collections.*'),
                              },
                              {
                                  name: 'Returns',
                                  href: toPath('sales.returns.index'),
                                  active: route().current('sales.returns.*'),
                              },
                          ],
                      },
                  ]
                : []),
            ...(() => {
                if (!hasFeature('pos')) return [];
                const cashierSubItems: SidebarGroupItem['items'] = [];
                if (hasPerm('sales_orders.process', 'payments.receive') || tenant?.role === 'cashier' || isSubscriberAdmin || tenant?.role === 'admin' || tenant?.role === 'manager') {
                    cashierSubItems.push({
                        name: 'Cashier Station',
                        href: toPath('cashier.dashboard'),
                        active: route().current('cashier.dashboard'),
                    });
                }
                if ((hasPerm('pos.sell') && tenant?.role !== 'salesman') || tenant?.role === 'cashier' || isSubscriberAdmin || tenant?.role === 'admin' || tenant?.role === 'manager') {
                    if (hasPerm('pos.sell') && tenant?.role !== 'salesman') {
                        cashierSubItems.push({
                            name: 'Point of Sale (Direct)',
                            href: toPath('pos.index'),
                            active: route().current('pos.*'),
                        });
                    }
                    if (hasPerm('cash_counters.view', 'cash_register.open') || tenant?.role === 'cashier' || canManageCounters) {
                        if (canManageCounters) {
                            cashierSubItems.push(
                                {
                                    name: 'Counter Terminals',
                                    href: toPath('counters.index'),
                                    active: route().current('counters.index'),
                                },
                                {
                                    name: 'Live Queue Monitor',
                                    href: toPath('counters.monitoring'),
                                    active: route().current('counters.monitoring'),
                                }
                            );
                        } else {
                            cashierSubItems.push({
                                name: 'My Terminal Shift',
                                href: toPath('counters.index'),
                                active: route().current('counters.index'),
                            });
                        }
                    }
                }
                if (!cashierSubItems.length) return [];
                return [
                    {
                        category: 'Sales & Cashier',
                        group: 'Cashier & POS',
                        icon: ShoppingCart,
                        items: cashierSubItems,
                    },
                ];
            })(),
            ...(canManageCounters
                ? [
                      {
                          category: 'Pharmacy Clinical',
                          group: 'Clinical Desk',
                          icon: Stethoscope,
                          items: [
                              {
                                  name: 'Pharmacist Dashboard',
                                  href: toPath('pharmacist.dashboard'),
                                  active: route().current('pharmacist.dashboard'),
                              },
                              {
                                  name: 'Prescription Queue',
                                  href: toPath('pharmacist.prescriptions'),
                                  active: route().current('pharmacist.prescriptions*'),
                                  badge: pendingRxCount,
                              },
                          ],
                      },
                  ]
                : []),
            ...inventoryEntries,
            ...(() => {
                if (!hasPerm('accounting.view')) return [];

                const isAccountingAdvanced = tenant?.accountingMode === 'advanced';
                const search = typeof window !== 'undefined' ? window.location.search : '';
                const isMultiQuery = search.includes('multi=1');

                const accountingGroups: Array<SidebarGroupItem & { category: string }> = [
                    {
                        category: 'Accounting',
                        group: 'Overview & Entry',
                        icon: Wallet,
                        items: [
                            ...(isAccountingAdvanced && hasPerm('accounting.reports.view')
                                ? [
                                      {
                                          name: 'Overview',
                                          href: toPath('accounting.overview'),
                                          active: route().current('accounting.overview'),
                                      },
                                  ]
                                : []),
                            {
                                name: isAccountingAdvanced ? 'Quick Entry' : 'Dashboard',
                                href: isAccountingAdvanced
                                    ? `${toPath('accounting.dashboard')}?simple=1`
                                    : toPath('accounting.dashboard'),
                                active: route().current('accounting.dashboard') && !isMultiQuery,
                            },
                            ...(hasPerm('accounting.expense.create')
                                ? [
                                      {
                                          name: 'Multi Entry',
                                          href: `${toPath('accounting.dashboard')}?simple=1&multi=1`,
                                          active: route().current('accounting.dashboard') && isMultiQuery,
                                      },
                                  ]
                                : []),
                        ],
                    },
                    {
                        category: 'Accounting',
                        group: 'Vouchers & Journal',
                        icon: ReceiptText,
                        items: [
                            {
                                name: 'Vouchers',
                                href: toPath('accounting.vouchers.index'),
                                active: route().current('accounting.vouchers.*'),
                            },
                            ...(isAccountingAdvanced && hasPerm('accounting.journal.create')
                                ? [
                                      {
                                          name: 'Journal',
                                          href: toPath('accounting.journal.index'),
                                          active: route().current('accounting.journal.*'),
                                      },
                                  ]
                                : []),
                            ...(isAccountingAdvanced && hasPerm('accounting.voucher.create')
                                ? [
                                      {
                                          name: 'Payroll & Stock',
                                          href: toPath('accounting.operations.index'),
                                          active: route().current('accounting.operations.*'),
                                      },
                                  ]
                                : []),
                        ],
                    },
                    {
                        category: 'Accounting',
                        group: 'Books & Parties',
                        icon: FileSpreadsheet,
                        items: [
                            ...(hasPerm('accounting.reports.view')
                                ? [
                                      {
                                          name: 'Parties & Ageing',
                                          href: toPath('accounting.parties.index'),
                                          active: route().current('accounting.parties.*'),
                                      },
                                      ...(isAccountingAdvanced
                                          ? [
                                                {
                                                    name: 'Ledger',
                                                    href: toPath('accounting.ledger'),
                                                    active: route().current('accounting.ledger'),
                                                },
                                            ]
                                          : []),
                                      {
                                          name: 'Day Book',
                                          href: toPath('accounting.day-book'),
                                          active: route().current('accounting.day-book'),
                                      },
                                      {
                                          name: 'Cash Book',
                                          href: toPath('accounting.cash-book'),
                                          active: route().current('accounting.cash-book'),
                                      },
                                      {
                                          name: 'Bank Book',
                                          href: toPath('accounting.bank-book'),
                                          active: route().current('accounting.bank-book'),
                                      },
                                      ...(isAccountingAdvanced
                                          ? [
                                                {
                                                    name: 'Bank Recon',
                                                    href: toPath('accounting.bank-reconciliation.index'),
                                                    active: route().current('accounting.bank-reconciliation.*'),
                                                },
                                            ]
                                          : []),
                                  ]
                                : []),
                        ],
                    },
                    {
                        category: 'Accounting',
                        group: 'Financial Reports',
                        icon: Layers,
                        items: [
                            ...(hasPerm('accounting.reports.view')
                                ? [
                                      {
                                          name: 'Profit & Loss (P&L)',
                                          href: toPath('accounting.simple-pnl'),
                                          active: route().current('accounting.simple-pnl'),
                                      },
                                      ...(isAccountingAdvanced
                                          ? [
                                                {
                                                    name: 'Trial Balance',
                                                    href: toPath('accounting.trial-balance'),
                                                    active: route().current('accounting.trial-balance'),
                                                },
                                                {
                                                    name: 'Balance Sheet',
                                                    href: toPath('accounting.balance-sheet'),
                                                    active: route().current('accounting.balance-sheet'),
                                                },
                                            ]
                                          : []),
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
                                  ]
                                : []),
                        ],
                    },
                    {
                        category: 'Accounting',
                        group: 'Accounting Setup',
                        icon: Settings,
                        items: [
                            ...(isAccountingAdvanced && (hasPerm('accounting.coa.manage') || hasPerm('accounting.view'))
                                ? [
                                      {
                                          name: 'Chart of Accounts',
                                          href: toPath('accounting.accounts.index'),
                                          active: route().current('accounting.accounts.*'),
                                      },
                                  ]
                                : []),
                            ...(isAccountingAdvanced &&
                            (hasPerm('accounting.period.close') ||
                                hasPerm('accounting.period.reopen') ||
                                hasPerm('accounting.view'))
                                ? [
                                      {
                                          name: 'Fiscal Periods',
                                          href: toPath('accounting.periods.index'),
                                          active: route().current('accounting.periods.*'),
                                      },
                                  ]
                                : []),
                            ...(isAccountingAdvanced && hasPerm('accounting.voucher.post')
                                ? [
                                      {
                                          name: 'Posting Errors',
                                          href: toPath('accounting.posting-errors.index'),
                                          active: route().current('accounting.posting-errors.*'),
                                      },
                                  ]
                                : []),
                            ...(hasPerm('accounting.settings.manage') || hasPerm('accounting.view')
                                ? [
                                      {
                                          name: 'Settings',
                                          href: toPath('accounting.settings.index'),
                                          active: route().current('accounting.settings.*'),
                                      },
                                  ]
                                : []),
                        ],
                    },
                ];

                return accountingGroups.filter((g) => g.items.length > 0);
            })(),
            ...crmEntries,
            ...hrmEntries,
            ...organizationEntries,
            ...(isSubscriberAdmin
                ? [
                      {
                          category: 'Billing & Settings',
                          group: 'Plans & Billing',
                          icon: CreditCard,
                          items: [
                              {
                                  name: 'Feature Access',
                                  href: toPath('features.index'),
                                  active: route().current('features.*'),
                              },
                              {
                                  name: 'Feature Pricing',
                                  href: toPath('pricing.index'),
                                  active: route().current('pricing.*'),
                              },
                              {
                                  name: 'Browse Plans',
                                  href: toPath('plans.index'),
                                  active: route().current('plans.*'),
                              },
                              {
                                  name: 'Billing & Subscription',
                                  href: toPath('subscription.index'),
                                  active: route().current('subscription.*'),
                              },
                          ],
                      },
                  ]
                : []),
            {
                category: 'Billing & Settings',
                group: 'Account & Business',
                icon: Settings,
                items: [
                    ...(hasPerm('settings.manage')
                        ? [
                              {
                                  name: 'Business Settings',
                                  href: toPath('settings.business'),
                                  active: route().current('settings.business*'),
                              },
                          ]
                        : []),
                    {
                        name: 'Profile & Security',
                        href: toPath('settings.profile'),
                        active: route().current('settings.profile*'),
                    },
                ],
            },
        ];
        }
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
                                    : tenant?.role === 'pharmacist' && !isSubscriberAdmin
                                      ? 'Logged in as Pharmacist'
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
                                    {isOpen && typeof item.badge === 'number' && item.badge > 0 && (
                                        <span className="ml-auto shrink-0 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full bg-[#D9534F] text-white text-[10.5px] font-bold font-mono leading-none">
                                            {item.badge}
                                        </span>
                                    )}
                                    {!isOpen && typeof item.badge === 'number' && item.badge > 0 && (
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
