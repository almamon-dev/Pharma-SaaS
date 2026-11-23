import React, { useState, useRef, useEffect } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { Header } from './components/Header';
import { SharedPageProps } from '@/types';
import { cn } from '@/lib/cn';

interface AppLayoutProps {
    title?: string;
    subtitle?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
    title,
    subtitle,
    actions,
    children,
}) => {
    const { auth, flash, subscription, tenant } =
        usePage<SharedPageProps>().props;
    const isSuperAdmin = Boolean(auth?.user?.is_super_admin);
    const isSubscriberAdmin = Boolean(auth?.user?.is_subscriber_admin);
    const isTrialing = subscription?.status === 'trialing';
    const daysLeft = subscription?.days_left ?? 0;
    const canViewFeatures =
        !isSuperAdmin &&
        Boolean(tenant?.currentTenant) &&
        Boolean(subscription?.is_usable);

    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 1024;
        }
        return true;
    });
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                profileRef.current &&
                !profileRef.current.contains(event.target as Node)
            ) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex h-screen bg-[#f8fafc] dark:bg-[#12161c] overflow-hidden font-sans antialiased text-slate-900 dark:text-slate-100">
            {title && <Head title={title} />}

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-20 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Header
                    title={title}
                    onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
                    isProfileOpen={isProfileOpen}
                    setIsProfileOpen={setIsProfileOpen}
                    profileRef={profileRef}
                />

                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 flex flex-col">
                    <div className="flex-1">
                        {(flash?.success || flash?.error) && (
                            <div
                                className={cn(
                                    'mb-4 flex items-center gap-2 rounded-[3px] border px-3.5 py-2.5 text-xs font-medium',
                                    flash.error
                                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                )}
                            >
                                {flash.error ? (
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                )}
                                <span>{flash.error || flash.success}</span>
                            </div>
                        )}

                        {subscription?.banner && (
                            <div
                                className={cn(
                                    'mb-4 rounded-[4px] border px-4 py-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs',
                                    subscription.banner.type === 'error'
                                        ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                                        : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    <div>
                                        <p className="font-bold">
                                            {subscription.banner.title}
                                        </p>
                                        <p className="text-[11px] mt-0.5 opacity-90">
                                            {subscription.banner.message}
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    href={subscription.banner.action_url}
                                    className="shrink-0 inline-flex items-center gap-1.5 rounded-[3px] bg-[#FF4A1F] hover:bg-[#e03f16] text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors"
                                >
                                    {subscription.banner.action_label}
                                </Link>
                            </div>
                        )}

                        {isTrialing && (
                            <div className="mb-4 rounded-[4px] border border-orange-200 dark:border-orange-500/30 bg-orange-50/90 dark:bg-[#1a1412] px-4 py-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-800 dark:text-slate-200 shadow-2xs">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF4A1F]/10 text-[#FF4A1F] shrink-0 font-bold text-sm">
                                        ⏳
                                    </span>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            <span>১৪ দিনের ফ্রি ট্রায়াল চলছে</span>
                                            {subscription?.plan?.name && (
                                                <span className="rounded bg-[#FF4A1F] text-white text-[10px] px-1.5 py-0.5 font-semibold">
                                                    {subscription.plan.name}
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                            আপনার ট্রায়ালের আর{' '}
                                            <strong className="text-[#FF4A1F] font-bold">
                                                {daysLeft} দিন
                                            </strong>{' '}
                                            বাকি আছে। ট্রায়াল চলাকালীন সকল ফিচার কোনো ক্রেডিট কার্ড ছাড়াই সম্পূর্ণ আনলক করা।
                                        </p>
                                    </div>
                                </div>
                                {isSubscriberAdmin && (
                                    <Link
                                        href={route('plans.index')}
                                        className="shrink-0 inline-flex items-center gap-1.5 rounded-[3px] bg-[#FF4A1F] hover:bg-[#e03f16] text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors"
                                    >
                                        প্ল্যান আপগ্রেড / বিলিং
                                    </Link>
                                )}
                            </div>
                        )}

                        {(subtitle || actions) && (
                            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                {subtitle ? (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {subtitle}
                                    </p>
                                ) : (
                                    <div />
                                )}
                                {actions && (
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        {actions}
                                    </div>
                                )}
                            </div>
                        )}

                        {children}
                    </div>

                    <footer className="mt-8 pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-500 dark:text-slate-300">
                                © {new Date().getFullYear()} PharmaCore SaaS
                            </span>
                            <span>·</span>
                            <span>
                                {tenant?.currentTenant
                                    ? `Workspace: ${tenant.currentTenant.name}${tenant.currentTenant.domain ? ` (${tenant.currentTenant.domain})` : ''}`
                                    : isSuperAdmin
                                      ? 'Platform Super Admin Console'
                                      : 'Multi-Tenant Pharmacy Operations'}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            {isSuperAdmin ? (
                                <>
                                    <Link
                                        href={route('admin.plans')}
                                        className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    >
                                        Plans
                                    </Link>
                                    <Link
                                        href={route('admin.features')}
                                        className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    >
                                        Features
                                    </Link>
                                    <Link
                                        href={route('admin.subscribers')}
                                        className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    >
                                        Subscribers
                                    </Link>
                                </>
                            ) : (
                                <>
                                    {isSubscriberAdmin && (
                                        <Link
                                            href={route('plans.index')}
                                            className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                        >
                                            Plans
                                        </Link>
                                    )}
                                    {canViewFeatures && (
                                        <Link
                                            href={route('features.index')}
                                            className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                        >
                                            Feature Access
                                        </Link>
                                    )}
                                    <Link
                                        href={route('subscription.index')}
                                        className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    >
                                        Billing
                                    </Link>
                                </>
                            )}
                            <Link
                                href={route('settings.profile')}
                                className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                Account Settings
                            </Link>
                        </div>
                    </footer>
                </main>
            </div>
        </div>
    );
};
