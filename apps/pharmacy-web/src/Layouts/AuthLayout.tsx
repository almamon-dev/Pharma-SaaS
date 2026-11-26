import React from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/Components/BrandLogo';
import { SharedPageProps } from '@/types';
import { cn } from '@/lib/cn';

interface AuthLayoutProps {
    title: string;
    subtitle: string;
    badge?: string;
    size?: 'md' | 'lg';
    highlights?: string[];
    children: React.ReactNode;
}

const defaultHighlights = [
    'Multi-branch tenant workspace isolation',
    'Batch & expiry (FEFO) automated alerts',
    'High-speed POS billing & receipt ledger',
];

export const AuthLayout: React.FC<AuthLayoutProps> = ({
    title,
    subtitle,
    badge = 'Pharmacy Workspace',
    size = 'md',
    highlights = defaultHighlights,
    children,
}) => {
    const { flash } = usePage<SharedPageProps>().props;

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#EAECE9] dark:bg-[#0b0e11] p-4 sm:p-6 text-[#333333] dark:text-slate-100">
            <Head title={title} />

            {(flash?.success || flash?.error) && (
                <div
                    className={cn(
                        'mb-4 w-full rounded-[2px] border px-4 py-2.5 text-xs font-medium',
                        size === 'lg' ? 'max-w-5xl' : 'max-w-4xl',
                        flash.error
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    )}
                >
                    {flash.error || flash.success}
                </div>
            )}

            <div
                className={cn(
                    'main-auth-card w-full bg-white dark:bg-[#1e2329] rounded-[2px] border border-slate-200 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] grid grid-cols-1 lg:grid-cols-12 overflow-hidden',
                    size === 'lg' ? 'max-w-5xl' : 'max-w-4xl'
                )}
            >
                {/* Left Brand Panel (matches CarrierDirect LoginLeftBanner) */}
                <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-8 bg-slate-50/70 dark:bg-[#181c21] border-r border-slate-200/80 dark:border-slate-800 overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:18px_18px] opacity-60" />

                    <div className="relative z-10">
                        <Link
                            href={route('welcome')}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E5F3F] hover:text-[#0A4D33] transition-colors"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Back to Home
                        </Link>
                    </div>

                    <div className="relative z-10 my-auto py-8">
                        <div className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#0E5F3F]/25 bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 px-2.5 py-1 text-[11px] font-semibold text-[#083D28] dark:text-[#0E5F3F] mb-5">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {badge}
                        </div>

                        <BrandLogo
                            size="lg"
                            subtitle="Multi-Tenant Pharmacy SaaS"
                            className="mb-5"
                        />

                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            Run every dispensary, warehouse batch, cashier register,
                            and pharmacist team from one unified cloud console.
                        </p>

                        <ul className="mt-5 space-y-2.5">
                            {highlights.map((item) => (
                                <li
                                    key={item}
                                    className="flex items-start gap-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                                >
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0E5F3F] mt-0.5" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="relative z-10 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                        Scoped branch ledger · FEFO expiry monitoring
                    </div>
                </div>

                {/* Right Form Panel */}
                <div className="col-span-1 lg:col-span-7 p-6 sm:p-8 md:p-10 flex flex-col justify-center bg-white dark:bg-[#1e2329]">
                    <div className="flex items-center justify-between gap-3 mb-6 lg:hidden">
                        <BrandLogo size="sm" />
                        <Link
                            href={route('welcome')}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E5F3F] hover:text-[#0A4D33]"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Home
                        </Link>
                    </div>

                    <div className="mb-6">
                        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                            {title}
                        </h1>
                        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            {subtitle}
                        </p>
                    </div>

                    {children}
                </div>
            </div>
        </div>
    );
};
