import React, { useState } from 'react';
import { Link, useForm, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Eye,
    EyeOff,
    Globe,
    KeyRound,
    Lock,
    Mail,
    ShieldCheck,
} from 'lucide-react';
import { AuthLayout } from '@/Layouts/AuthLayout';
import { Input } from '@/Components/ui/Input';
import { Button } from '@/Components/ui/Button';
import { SharedPageProps } from '@/types';

interface LoginProps {
    isLocal: boolean;
}

const demoAccounts = [
    {
        role: 'SaaS Business Owner (Platform Super Admin)',
        badge: 'Super Admin',
        email: 'superadmin@pharmacore.test',
        password: 'password',
        cardClass:
            'border-orange-200 bg-orange-50/70 hover:bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/20',
        badgeClass: 'bg-orange-100 text-[#FF4A1F]',
    },
    {
        role: 'Pharmacy Store Admin (1 Growth Plan · 2 Shops)',
        badge: 'Store Admin',
        email: 'admin@pharmacore.test',
        password: 'password',
        cardClass:
            'border-blue-200 bg-blue-50/70 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20',
        badgeClass: 'bg-blue-100 text-blue-700',
    },
    {
        role: 'Branch Manager + CRM Specialist (Multi-Role)',
        badge: 'Manager+CRM',
        email: 'manager@pharmacore.test',
        password: 'password',
        cardClass:
            'border-amber-200 bg-amber-50/70 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
        badgeClass: 'bg-amber-100 text-amber-700',
    },
    {
        role: 'Pharmacist + Inventory Clerk (Multi-Role)',
        badge: 'Pharmacist',
        email: 'pharmacist@pharmacore.test',
        password: 'password',
        cardClass:
            'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
        badgeClass: 'bg-emerald-100 text-emerald-700',
    },
    {
        role: 'Branch Cashier (POS Counter)',
        badge: 'Cashier',
        email: 'cashier@pharmacore.test',
        password: 'password',
        cardClass:
            'border-purple-200 bg-purple-50/70 hover:bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/20',
        badgeClass: 'bg-purple-100 text-purple-700',
    },
];

export default function Login({ isLocal }: LoginProps) {
    const { domainTenant, tenancy } = usePage<SharedPageProps>().props;
    const isAdminDomain = Boolean(tenancy?.isAdminDomain);
    const adminHostLabel =
        tenancy?.domainHost || tenancy?.adminDomain || 'admin.localhost';
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('login'));
    };

    const fillDemo = (email: string, password: string) => {
        setData({
            email,
            password,
            remember: true,
        });
    };

    const visibleDemoAccounts = isAdminDomain
        ? demoAccounts.filter(
              (acc) => acc.email === 'superadmin@pharmacore.test'
          )
        : domainTenant
          ? demoAccounts.filter(
                (acc) => acc.email !== 'superadmin@pharmacore.test'
            )
          : demoAccounts;

    return (
        <AuthLayout
            title={
                isAdminDomain
                    ? 'Platform Owner Sign In'
                    : domainTenant
                      ? `Sign In to ${domainTenant.name}`
                      : 'Welcome Back'
            }
            subtitle={
                isAdminDomain
                    ? `SaaS Business Owner console on ${adminHostLabel}.`
                    : domainTenant
                      ? `Dedicated workspace portal on ${domainTenant.domain}${domainTenant.city ? ` (${domainTenant.city})` : ''}.`
                      : 'Sign in to access your pharmacy workspace and branch operations.'
            }
            badge={
                isAdminDomain
                    ? 'SaaS Owner Portal'
                    : domainTenant
                      ? domainTenant.domain
                      : 'Workspace Sign In'
            }
            size="md"
        >
            {isAdminDomain && (
                <div className="mb-4 flex items-center gap-2.5 rounded-[4px] border border-orange-200 bg-orange-50/70 dark:border-orange-900/50 dark:bg-orange-950/20 px-3 py-2 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#FF4A1F]" />
                    <div className="min-w-0">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                            SaaS Business Owner Console
                        </span>
                        <span className="ml-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {adminHostLabel}
                        </span>
                    </div>
                </div>
            )}

            {!isAdminDomain && domainTenant && (
                <div className="mb-4 flex items-center gap-2.5 rounded-[4px] border border-orange-200 bg-orange-50/70 dark:border-orange-900/50 dark:bg-orange-950/20 px-3 py-2 text-xs">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-[#FF4A1F]" />
                    <div className="min-w-0">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {domainTenant.name}
                        </span>
                        <span className="ml-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {domainTenant.domain}
                        </span>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Email Address"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@pharmacy.com"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    icon={<Mail className="h-3.5 w-3.5" />}
                />

                <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    icon={<Lock className="h-3.5 w-3.5" />}
                    rightIcon={
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                            aria-label={
                                showPassword ? 'Hide password' : 'Show password'
                            }
                        >
                            {showPassword ? (
                                <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                                <Eye className="h-3.5 w-3.5" />
                            )}
                        </button>
                    }
                />

                <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={data.remember}
                            onChange={(e) =>
                                setData('remember', e.target.checked)
                            }
                            className="h-3.5 w-3.5 rounded-[2px] border-slate-300 text-[#FF4A1F] focus:ring-[#FF4A1F]"
                        />
                        Keep me signed in
                    </label>
                    <span className="text-[11px] font-medium text-slate-400">
                        Role & tenant scoped
                    </span>
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    isLoading={processing}
                    className="h-10 font-semibold"
                >
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </form>

            {isLocal && (
                <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2.5">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            <KeyRound className="h-3.5 w-3.5 text-[#FF4A1F]" />
                            Quick Demo Credentials
                        </span>
                        <span className="text-[11px] text-slate-400">
                            Click to autofill
                        </span>
                    </div>

                    <div className="space-y-2">
                        {visibleDemoAccounts.map((acc) => (
                            <button
                                key={acc.email}
                                type="button"
                                onClick={() =>
                                    fillDemo(acc.email, acc.password)
                                }
                                className={`w-full text-left rounded-[4px] border px-3 py-2 transition-colors flex items-center justify-between gap-2 ${acc.cardClass}`}
                            >
                                <div className="min-w-0">
                                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                        {acc.role}
                                    </div>
                                    <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono truncate">
                                        {acc.email}
                                    </div>
                                </div>
                                <span
                                    className={`shrink-0 rounded-[2px] px-2 py-0.5 text-[10px] font-bold ${acc.badgeClass}`}
                                >
                                    {acc.badge}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {!isAdminDomain && (
                <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    New pharmacy?{' '}
                    <Link
                        href={route('register')}
                        className="font-semibold text-[#FF4A1F] hover:text-[#E03E15] transition-colors"
                    >
                        Start your 14-day free trial
                    </Link>
                </p>
            )}
        </AuthLayout>
    );
}
