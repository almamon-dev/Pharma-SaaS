import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import { SharedPageProps } from '@/types';

interface PharmacistMobileNavProps {
    currentPath?: string;
}

export default function PharmacistMobileNav({ currentPath }: PharmacistMobileNavProps) {
    const { pharmacist } = usePage<SharedPageProps>().props;
    const pendingCount = pharmacist?.pendingRxCount ?? 0;
    const activePath =
        currentPath || (typeof window !== 'undefined' ? window.location.pathname : '');

    const links = [
        { label: 'Dashboard', href: '/dashboard', match: (p: string) => p === '/dashboard' || p === '/pharmacist/dashboard' },
        { label: 'Prescription Queue', href: '/pharmacist/prescriptions', badge: pendingCount, match: (p: string) => p.startsWith('/pharmacist/prescriptions') },
        { label: 'Dispensing', href: '/pharmacist/dispensing', match: (p: string) => p === '/pharmacist/dispensing' },
        { label: 'Medicine Search', href: '/pharmacist/medicine-search', match: (p: string) => p === '/pharmacist/medicine-search' },
        { label: 'Patient History', href: '/pharmacist/patient-history', match: (p: string) => p === '/pharmacist/patient-history' },
        { label: 'Stock & Expiry', href: '/pharmacist/stock-expiry', match: (p: string) => p === '/pharmacist/stock-expiry' },
        { label: 'Purchase Request', href: '/pharmacist/purchase-requests', match: (p: string) => p === '/pharmacist/purchase-requests' },
        { label: 'Returns', href: '/pharmacist/returns', match: (p: string) => p === '/pharmacist/returns' },
        { label: 'Controlled Drugs', href: '/pharmacist/controlled-drugs', match: (p: string) => p === '/pharmacist/controlled-drugs' },
        { label: 'Profile & Security', href: '/settings/profile', match: (p: string) => p.startsWith('/settings/profile') },
    ];

    return (
        <nav
            aria-label="Pharmacist navigation"
            className="lg:hidden -mx-3 sm:-mx-5 px-3 sm:px-5 py-2 mb-3 bg-white dark:bg-[#12161c] border-y border-[#D5DBD3] dark:border-slate-800 overflow-x-auto"
        >
            <div className="flex items-center gap-1.5 min-w-max">
                {links.map((item) => {
                    const isActive = item.match(activePath);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold rounded-[2px] whitespace-nowrap transition-colors ${
                                isActive
                                    ? 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/30 dark:bg-[#0E5F3F]/20 dark:text-emerald-300'
                                    : 'text-[#444444] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                            }`}
                        >
                            <span>{item.label}</span>
                            {typeof item.badge === 'number' && item.badge > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full bg-[#D9534F] text-white text-[10px] font-mono font-bold">
                                    {item.badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

