import React from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    CreditCard,
    Layers,
    LogOut,
    Settings,
    ShieldCheck,
    Store,
    User,
} from 'lucide-react';
import { SharedPageProps } from '@/types';

interface HeaderProps {
    title?: string;
    onToggleSidebar: () => void;
    isProfileOpen: boolean;
    setIsProfileOpen: (open: boolean) => void;
    profileRef: React.RefObject<HTMLDivElement | null>;
}

function getInitials(name?: string): string {
    if (!name) return 'U';
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
}

export const Header: React.FC<HeaderProps> = ({
    title,
    onToggleSidebar,
    isProfileOpen,
    setIsProfileOpen,
    profileRef,
}) => {
    const { auth, subscription, tenant } = usePage<SharedPageProps>().props;
    const authUser = auth?.user;
    const isSuperAdmin = Boolean(authUser?.is_super_admin);
    const hasSubscription = Boolean(subscription?.is_usable);

    const handleLogout = () => {
        router.post(route('logout'));
    };

    const roleDisplay = isSuperAdmin
        ? 'SaaS Super Admin'
        : tenant?.roleLabel ||
          (authUser?.is_subscriber_admin ? 'Business Admin' : 'Staff');

    return (
        <header className="h-14 bg-white/95 dark:bg-[#12161c]/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-4 sm:px-5 z-30 shrink-0 transition-colors">
            <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                <button
                    type="button"
                    aria-label="Toggle navigation"
                    className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    onClick={onToggleSidebar}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M4 6h16M4 12h10M4 18h16" />
                    </svg>
                </button>

                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-none truncate">
                        {title || 'Dashboard'}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <div className="relative" ref={profileRef}>
                    <button
                        type="button"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="h-9 flex items-center gap-1.5 sm:gap-2 pl-1 pr-2 sm:pr-2.5 rounded-full bg-slate-100 dark:bg-[#1e2329] border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <div className="w-7 h-7 rounded-full bg-[#ff4a1f] text-white flex items-center justify-center text-[10.5px] font-extrabold shrink-0 shadow-2xs">
                            {getInitials(authUser?.name)}
                        </div>
                        <div className="hidden md:block text-left pr-0.5">
                            <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100 leading-none truncate max-w-[120px]">
                                {authUser?.name ?? 'User'}
                            </p>
                            <p className="text-[9.5px] font-medium text-slate-500 dark:text-slate-400 leading-none mt-0.5">
                                {roleDisplay}
                            </p>
                        </div>
                        <ChevronDown
                            size={13}
                            className={`text-slate-400 hidden sm:block transition-transform duration-200 ${
                                isProfileOpen ? 'rotate-180' : ''
                            }`}
                        />
                    </button>

                    {isProfileOpen && (
                        <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-[#1e2329] rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-50">
                            <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800">
                                <p className="text-[12px] font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {authUser?.name}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    {authUser?.email}
                                </p>
                                {!isSuperAdmin && tenant?.currentTenant && (
                                    <p className="text-[10.5px] font-semibold text-[#ff4a1f] mt-1 truncate">
                                        {tenant.currentTenant.name}
                                    </p>
                                )}
                            </div>

                            <div className="py-1">
                                <Link
                                    href={route('settings.profile')}
                                    onClick={() => setIsProfileOpen(false)}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                >
                                    <User
                                        size={14}
                                        className="text-slate-400"
                                    />
                                    My Profile & Security
                                </Link>

                                {isSuperAdmin ? (
                                    <>
                                        <Link
                                            href={route('admin.plans')}
                                            onClick={() =>
                                                setIsProfileOpen(false)
                                            }
                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                        >
                                            <CreditCard
                                                size={14}
                                                className="text-slate-400"
                                            />
                                            Manage Plans
                                        </Link>
                                        <Link
                                            href={route('admin.subscribers')}
                                            onClick={() =>
                                                setIsProfileOpen(false)
                                            }
                                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                        >
                                            <ShieldCheck
                                                size={14}
                                                className="text-slate-400"
                                            />
                                            Subscribers Registry
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        {authUser?.is_subscriber_admin && (
                                            <>
                                                <Link
                                                    href={route('plans.index')}
                                                    onClick={() =>
                                                        setIsProfileOpen(false)
                                                    }
                                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                                >
                                                    <Layers
                                                        size={14}
                                                        className="text-slate-400"
                                                    />
                                                    Subscription Plans
                                                </Link>
                                                <Link
                                                    href={route(
                                                        'subscription.index'
                                                    )}
                                                    onClick={() =>
                                                        setIsProfileOpen(false)
                                                    }
                                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                                >
                                                    <CreditCard
                                                        size={14}
                                                        className="text-slate-400"
                                                    />
                                                    Billing & Subscription
                                                </Link>
                                                {hasSubscription && (
                                                    <Link
                                                        href={route(
                                                            'tenants.index'
                                                        )}
                                                        onClick={() =>
                                                            setIsProfileOpen(
                                                                false
                                                            )
                                                        }
                                                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-[#ff4a1f] hover:bg-orange-50/70 dark:hover:bg-[#ff4a1f]/10"
                                                    >
                                                        <Store size={14} />
                                                        Business Tenants
                                                    </Link>
                                                )}
                                            </>
                                        )}

                                        {hasSubscription &&
                                            tenant?.canManageOrganization &&
                                            tenant?.currentTenant && (
                                                <Link
                                                    href={route(
                                                        'settings.business'
                                                    )}
                                                    onClick={() =>
                                                        setIsProfileOpen(false)
                                                    }
                                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                                >
                                                    <Settings
                                                        size={14}
                                                        className="text-slate-400"
                                                    />
                                                    Business Settings
                                                </Link>
                                            )}
                                    </>
                                )}
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                                >
                                    <LogOut size={14} />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
