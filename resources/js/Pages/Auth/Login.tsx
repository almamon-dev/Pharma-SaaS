import React, { useState } from 'react';
import { Link, useForm, usePage } from '@inertiajs/react';
import {
    Eye,
    EyeOff,
    Globe,
    Lock,
    Mail,
    ShieldCheck,
} from 'lucide-react';
import { AuthLayout } from '@/Layouts/AuthLayout';
import { Input } from '@/Components/ui/Input';
import { Button } from '@/Components/ui/Button';
import { SharedPageProps } from '@/types';

export default function Login() {
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
                {/* 1-Click Test Role Accounts */}
                {!isAdminDomain && (
                    <div className="rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                Quick Test Sign-In by Role:
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                                Pass: password
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                            {[
                                {
                                    label: '👑 Admin',
                                    email: 'admin@pharmacore.test',
                                    desc: 'Owner',
                                },
                                {
                                    label: '👔 Manager',
                                    email: 'manager@pharmacore.test',
                                    desc: 'Branch',
                                },
                                {
                                    label: '💊 Pharmacist',
                                    email: 'pharmacist@pharmacore.test',
                                    desc: 'Clinical',
                                },
                                {
                                    label: '🛒 Cashier',
                                    email: 'cashier@pharmacore.test',
                                    desc: 'POS',
                                },
                                {
                                    label: '📦 Clerk',
                                    email: 'clerk@pharmacore.test',
                                    desc: 'Inventory',
                                },
                            ].map((roleItem) => (
                                <button
                                    key={roleItem.email}
                                    type="button"
                                    onClick={() => {
                                        setData({
                                            ...data,
                                            email: roleItem.email,
                                            password: 'password',
                                        });
                                    }}
                                    className="flex flex-col items-start px-2 py-1.5 rounded-[3px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#FF4A1F] dark:hover:border-[#FF4A1F] transition-all text-left group"
                                >
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#FF4A1F]">
                                        {roleItem.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400 truncate w-full">
                                        {roleItem.email}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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
                </Button>
            </form>

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
