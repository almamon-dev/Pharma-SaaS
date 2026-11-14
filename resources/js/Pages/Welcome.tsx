import React, { useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    Activity,
    ArrowRight,
    Building2,
    Check,
    GitBranch,
    Globe,
    Package,
    ShieldCheck,
    ShoppingCart,
    Users,
    X,
} from 'lucide-react';
import { BrandLogo } from '@/Components/BrandLogo';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { StatusDot } from '@/Components/ui/StatusDot';
import { PlanSummary, SharedPageProps } from '@/types';
import { formatCurrency, formatQuotaLimit } from '@/lib/format';

interface WelcomeProps {
    plans: PlanSummary[];
}

const platformHighlights = [
    {
        step: '01',
        title: 'Multi-Tenant Pharmacy Ownership',
        description:
            'Pharmacy Store Admins subscribe once to provision and operate multiple isolated business tenants and retail outlets from one account.',
        highlight: 'Row-level tenant_id & workspace switching',
        icon: Building2,
    },
    {
        step: '02',
        title: 'Granular Multi-Role RBAC',
        description:
            'Combine built-in operational roles or define custom permission matrices per pharmacy team member and branch assignment.',
        highlight: 'Plan-gated feature & role enforcement',
        icon: ShieldCheck,
    },
    {
        step: '03',
        title: 'High-Speed POS & Patient CRM',
        description:
            'Process counter checkouts with automatic FEFO batch deduction, customer allergy warnings, loyalty balances, and supplier history.',
        highlight: 'Sub-second counter & ledger sync',
        icon: ShoppingCart,
    },
    {
        step: '04',
        title: 'Automated FEFO Expiry Control',
        description:
            'Track every batch arrival, rack location, reorder level, and upcoming expiry window before stock slips out of compliance.',
        highlight: 'Real-time branch alert windows',
        icon: Activity,
    },
];

export default function Welcome({ plans }: WelcomeProps) {
    const { auth, tenancy } = usePage<SharedPageProps>().props;
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(
        'monthly'
    );
    const [showPortalFinder, setShowPortalFinder] = useState(false);
    const [workspaceSubdomain, setWorkspaceSubdomain] = useState('');
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [lookingUp, setLookingUp] = useState(false);

    const baseDomain = tenancy?.baseDomain ?? 'localhost';
    const scheme = tenancy?.scheme ?? 'http';
    const portSuffix = tenancy?.portSuffix ?? '';
    const adminLoginUrl =
        tenancy?.adminLoginUrl ??
        `${scheme}://admin.${baseDomain}${portSuffix}/login`;
    const demoLoginUrl =
        tenancy?.demoLoginUrl ??
        `${scheme}://demo.${baseDomain}${portSuffix}/login`;

    const cleanedSubdomain = workspaceSubdomain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .split('/')[0]
        .replace(/:\d+$/, '');
    const previewHost = cleanedSubdomain
        ? cleanedSubdomain.includes('.')
            ? cleanedSubdomain
            : `${cleanedSubdomain}.${baseDomain}`
        : `demo.${baseDomain}`;

    const handleFindWorkspace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cleanedSubdomain) {
            setLookupError(
                'Enter your workspace subdomain (e.g. demo or admin).'
            );
            return;
        }

        setLookupError(null);
        setLookingUp(true);

        try {
            const res = await fetch(
                `${route('workspace.lookup')}?subdomain=${encodeURIComponent(cleanedSubdomain)}`,
                { headers: { Accept: 'application/json' } }
            );
            const payload = (await res.json()) as {
                url?: string;
                message?: string;
            };

            if (!res.ok || !payload.url) {
                setLookupError(
                    payload.message ??
                        'Workspace not found. Check your subdomain and try again.'
                );
                setLookingUp(false);
                return;
            }

            window.location.href = payload.url;
        } catch {
            setLookupError('Unable to reach workspace lookup. Please try again.');
            setLookingUp(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b0e11] text-slate-900 dark:text-slate-100 font-sans antialiased">
            <Head title="Multi-Tenant Pharmacy SaaS" />

            {/* Sticky Top Nav */}
            <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#1e2329]/95 backdrop-blur-xs">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                    <Link href={route('welcome')}>
                        <BrandLogo subtitle="Cloud Pharmacy Platform" />
                    </Link>

                    <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <a
                            href="#architecture"
                            className="hover:text-[#FF4A1F] transition-colors"
                        >
                            Platform Architecture
                        </a>
                        <a
                            href="#plans"
                            className="hover:text-[#FF4A1F] transition-colors"
                        >
                            Pricing Plans
                        </a>
                        <a
                            href={demoLoginUrl}
                            className="hover:text-[#FF4A1F] transition-colors"
                        >
                            Demo Console
                        </a>
                    </nav>

                    <div className="flex items-center gap-2.5">
                        {auth?.user ? (
                            <Link href={route('dashboard')}>
                                <Button variant="primary" size="md">
                                    Open Workspace
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                            </Link>
                        ) : (
                            <>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="md"
                                    onClick={() => setShowPortalFinder(true)}
                                >
                                    Sign In
                                </Button>
                                <Link href={route('register')}>
                                    <Button variant="primary" size="md">
                                        Start Free Trial
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1">
                {/* Hero Section */}
                <section className="relative overflow-hidden border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#161a1e]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-55" />

                    <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
                            <div className="lg:col-span-6">
                                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#FF4A1F]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF4A1F]" />
                                    <span>
                                        Multi-Tenant Pharmacy SaaS & FEFO Cloud
                                    </span>
                                </div>

                                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-[1.12]">
                                    Run Every Pharmacy Branch from One{' '}
                                    <span className="text-[#FF4A1F]">
                                        Unified Command Console
                                    </span>
                                </h1>

                                <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                                    Built for multi-branch retail chains and
                                    hospital dispensaries. Manage isolated
                                    business tenants, live batch expiries,
                                    patient allergy CRM, and feature-gated
                                    team permissions in real time.
                                </p>

                                <div className="mt-7 flex flex-wrap items-center gap-3">
                                    <Link
                                        href={
                                            auth?.user
                                                ? route('dashboard')
                                                : route('register')
                                        }
                                    >
                                        <Button
                                            variant="primary"
                                            size="lg"
                                            className="h-10 px-5 text-xs sm:text-sm font-semibold"
                                        >
                                            {auth?.user
                                                ? 'Go to Dashboard'
                                                : 'Register Business & Start Trial'}
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                    {!auth?.user && (
                                        <a href={demoLoginUrl}>
                                            <Button
                                                variant="outline"
                                                size="lg"
                                                className="h-10 px-5 text-xs sm:text-sm"
                                            >
                                                Sign In with Demo Account
                                            </Button>
                                        </a>
                                    )}
                                </div>

                                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                                    <StatusDot variant="emerald">
                                        14-day free trial included
                                    </StatusDot>
                                    <span>·</span>
                                    <span>Strict tenant_id isolation</span>
                                    <span>·</span>
                                    <span>Role & feature access control</span>
                                </div>
                            </div>

                            {/* Hero 3D Pharmacy Visual */}
                            <div className="lg:col-span-6">
                                <div className="relative mx-auto max-w-lg lg:max-w-none">
                                    <div className="pointer-events-none absolute -inset-4 rounded-2xl bg-gradient-to-tr from-[#FF4A1F]/10 via-transparent to-emerald-500/10 blur-2xl" />
                                    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#1e2329] shadow-lg shadow-slate-900/5">
                                        <img
                                            src="/images/hero-pharmacy-3d.jpg"
                                            alt="3D Cloud Pharmacy Management Hub"
                                            className="w-full h-auto object-cover select-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Platform Architecture Section */}
                <section
                    id="architecture"
                    className="mx-auto max-w-6xl px-4 py-14 sm:px-6"
                >
                    <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                        <div>
                            <p className="text-xs font-semibold text-[#FF4A1F]">
                                Platform Architecture
                            </p>
                            <h2 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                                Engineered for High-Throughput Dispensaries
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Zero cross-tenant data leakage · Live quota &
                            feature enforcement
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {platformHighlights.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.step}
                                    className="rounded-[6px] border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#1e2329] p-5 flex flex-col justify-between transition-colors hover:border-[#FF4A1F]/40"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#FFF0ED] dark:bg-[#ff4a1f]/15 text-[#FF4A1F]">
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <span className="font-mono text-xs font-semibold text-slate-400">
                                                {item.step}
                                            </span>
                                        </div>

                                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                                            {item.title}
                                        </h3>
                                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                            {item.description}
                                        </p>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                        {item.highlight}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Subscription Plans Section */}
                <section
                    id="plans"
                    className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#161a1e] py-14"
                >
                    <div className="mx-auto max-w-6xl px-4 sm:px-6">
                        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold text-[#FF4A1F]">
                                    Subscription Plans
                                </p>
                                <h2 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                                    Clear Tiers Built to Scale with Every Branch
                                </h2>
                                <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                                    Start with a full 14-day free trial. Upgrade
                                    or unlock additional modules anytime from
                                    your Business Owner workspace.
                                </p>
                            </div>

                            {/* Billing Cycle Toggle */}
                            <div className="inline-flex self-start md:self-auto rounded-[4px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1e2329] p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setBillingCycle('monthly')}
                                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-[3px] transition-colors cursor-pointer ${
                                        billingCycle === 'monthly'
                                            ? 'bg-[#FF4A1F] text-white'
                                            : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    Monthly
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBillingCycle('annual')}
                                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-[3px] transition-colors cursor-pointer ${
                                        billingCycle === 'annual'
                                            ? 'bg-[#FF4A1F] text-white'
                                            : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    Annual (2 months free)
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
                            {plans.map((plan) => {
                                const price =
                                    billingCycle === 'annual'
                                        ? Number(plan.annual_price ?? 0)
                                        : Number(plan.monthly_price ?? 0);

                                return (
                                    <div
                                        key={plan.key}
                                        className={`rounded-[6px] border p-6 flex flex-col justify-between transition-all bg-white dark:bg-[#1e2329] ${
                                            plan.is_popular
                                                ? 'border-[#FF4A1F] border-t-[3px] border-t-[#FF4A1F] shadow-sm'
                                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                                    {plan.name}
                                                </h3>
                                                {plan.is_popular && (
                                                    <StatusDot variant="brand">
                                                        Recommended
                                                    </StatusDot>
                                                )}
                                            </div>

                                            {plan.description && (
                                                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed min-h-[36px]">
                                                    {plan.description}
                                                </p>
                                            )}

                                            <div className="mt-4 flex items-baseline gap-1.5">
                                                <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                                                    {formatCurrency(
                                                        price,
                                                        plan.currency_code ??
                                                            'USD'
                                                    )}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    /{' '}
                                                    {billingCycle === 'annual'
                                                        ? 'year'
                                                        : 'month'}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-[11px] text-slate-400">
                                                Includes {plan.trial_days ?? 14}
                                                -day free trial
                                            </p>

                                            {/* Structured Quota Grid */}
                                            <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-[4px] border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#161a1e] p-3 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-3.5 w-3.5 text-[#FF4A1F] shrink-0" />
                                                    <span>
                                                        <strong className="text-slate-900 dark:text-slate-100">
                                                            {formatQuotaLimit(
                                                                plan.max_pharmacies
                                                            )}
                                                        </strong>{' '}
                                                        <span className="text-slate-500">
                                                            Tenants
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <GitBranch className="h-3.5 w-3.5 text-[#FF4A1F] shrink-0" />
                                                    <span>
                                                        <strong className="text-slate-900 dark:text-slate-100">
                                                            {formatQuotaLimit(
                                                                plan.max_branches
                                                            )}
                                                        </strong>{' '}
                                                        <span className="text-slate-500">
                                                            Branches
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-3.5 w-3.5 text-[#FF4A1F] shrink-0" />
                                                    <span>
                                                        <strong className="text-slate-900 dark:text-slate-100">
                                                            {formatQuotaLimit(
                                                                plan.max_users
                                                            )}
                                                        </strong>{' '}
                                                        <span className="text-slate-500">
                                                            Staff
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-3.5 w-3.5 text-[#FF4A1F] shrink-0" />
                                                    <span>
                                                        <strong className="text-slate-900 dark:text-slate-100">
                                                            {plan.max_medicines.toLocaleString()}
                                                        </strong>{' '}
                                                        <span className="text-slate-500">
                                                            SKUs
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Included Features */}
                                            <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                                                {(plan.features ?? []).map(
                                                    (feat) => (
                                                        <li
                                                            key={feat}
                                                            className="flex items-start gap-2"
                                                        >
                                                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                            <span>{feat}</span>
                                                        </li>
                                                    )
                                                )}
                                            </ul>

                                            {(plan.modules ?? []).length > 0 && (
                                                <p className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                        Unlocked Modules:{' '}
                                                    </span>
                                                    {(plan.modules ?? [])
                                                        .map((m) => m.name)
                                                        .join(' · ')}
                                                </p>
                                            )}
                                        </div>

                                        <Link
                                            href={
                                                auth?.user
                                                    ? route('plans.index')
                                                    : route('register')
                                            }
                                            className="mt-6 block"
                                        >
                                            <Button
                                                variant={
                                                    plan.is_popular
                                                        ? 'primary'
                                                        : 'outline'
                                                }
                                                fullWidth
                                            >
                                                {auth?.user
                                                    ? `Choose ${plan.name}`
                                                    : `Start ${plan.name} Trial`}
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </Button>
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            </main>

            {/* Full SaaS Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c]">
                <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-5">
                            <BrandLogo subtitle="Cloud Pharmacy Platform" />
                            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
                                Multi-tenant pharmacy SaaS engineered for strict
                                business isolation, FEFO inventory precision,
                                customer CRM, and subscription-gated feature
                                access.
                            </p>
                            <div className="mt-4">
                                <StatusDot variant="emerald">
                                    All tenant clusters operational
                                </StatusDot>
                            </div>
                        </div>

                        <div className="lg:col-span-2 space-y-2.5 text-xs">
                            <p className="font-bold text-slate-900 dark:text-slate-100">
                                Platform
                            </p>
                            <ul className="space-y-2 text-slate-500 dark:text-slate-400">
                                <li>
                                    <a
                                        href="#architecture"
                                        className="hover:text-[#FF4A1F] transition-colors"
                                    >
                                        Architecture
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href="#plans"
                                        className="hover:text-[#FF4A1F] transition-colors"
                                    >
                                        Subscription Plans
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href={demoLoginUrl}
                                        className="hover:text-[#FF4A1F] transition-colors"
                                    >
                                        Demo Workspace
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <div className="lg:col-span-3 space-y-2.5 text-xs">
                            <p className="font-bold text-slate-900 dark:text-slate-100">
                                Capabilities
                            </p>
                            <ul className="space-y-2 text-slate-500 dark:text-slate-400">
                                <li>Point of Sale & FEFO Checkout</li>
                                <li>Multi-Tenant & Branch Inventory</li>
                                <li>Patient Allergy & Loyalty CRM</li>
                                <li>Custom Roles & Feature Access</li>
                            </ul>
                        </div>

                        <div className="lg:col-span-2 space-y-2.5 text-xs">
                            <p className="font-bold text-slate-900 dark:text-slate-100">
                                Get Started
                            </p>
                            <ul className="space-y-2 text-slate-500 dark:text-slate-400">
                                <li>
                                    <Link
                                        href={route('register')}
                                        className="hover:text-[#FF4A1F] transition-colors"
                                    >
                                        Create Business Account
                                    </Link>
                                </li>
                                <li>
                                    <a
                                        href={adminLoginUrl}
                                        className="hover:text-[#FF4A1F] transition-colors"
                                    >
                                        Owner Sign In
                                    </a>
                                </li>
                                <li>
                                    {auth?.user ? (
                                        <Link
                                            href={route('plans.index')}
                                            className="hover:text-[#FF4A1F] transition-colors"
                                        >
                                            Compare Tiers
                                        </Link>
                                    ) : (
                                        <a
                                            href="#plans"
                                            className="hover:text-[#FF4A1F] transition-colors"
                                        >
                                            Compare Tiers
                                        </a>
                                    )}
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
                        <p>
                            © {new Date().getFullYear()} PharmaCore SaaS.
                            Multi-Tenant Pharmacy Management Platform.
                        </p>
                        <div className="flex items-center gap-4">
                            <span>PostgreSQL · Isolated Tenant Scope</span>
                            <span>·</span>
                            <span>14-Day Risk-Free Trial</span>
                        </div>
                    </div>
                </div>
            </footer>

            {showPortalFinder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-[6px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e2329] shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-[#FF4A1F]" />
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Sign In to Your Domain
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPortalFinder(false);
                                    setLookupError(null);
                                }}
                                className="text-slate-400 hover:text-slate-700"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <form
                                onSubmit={handleFindWorkspace}
                                className="space-y-3"
                            >
                                <div className="space-y-1.5">
                                    <Input
                                        label="Subdomain"
                                        required
                                        placeholder="demo"
                                        value={workspaceSubdomain}
                                        onChange={(e) => {
                                            setWorkspaceSubdomain(e.target.value);
                                            if (lookupError) setLookupError(null);
                                        }}
                                        error={lookupError ?? undefined}
                                        icon={<Globe className="h-3.5 w-3.5" />}
                                    />
                                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                                        Enter only your subdomain name (no{' '}
                                        <code className="text-slate-700 dark:text-slate-300">
                                            http://
                                        </code>{' '}
                                        or{' '}
                                        <code className="text-slate-700 dark:text-slate-300">
                                            .{baseDomain}
                                        </code>{' '}
                                        needed).{' '}
                                        <span className="block font-mono text-slate-700 dark:text-slate-200 mt-0.5 truncate">
                                            {scheme}://{previewHost}
                                            {portSuffix}/login
                                        </span>
                                    </p>
                                </div>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="md"
                                    fullWidth
                                    isLoading={lookingUp}
                                >
                                    Continue to Workspace Login
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                            </form>

                            <p className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center">
                                Quick links:{' '}
                                <a
                                    href={demoLoginUrl}
                                    className="font-semibold text-slate-600 dark:text-slate-300 hover:text-[#FF4A1F] underline underline-offset-2"
                                >
                                    Demo Pharmacy (demo)
                                </a>
                                {' · '}
                                <a
                                    href={adminLoginUrl}
                                    className="font-semibold text-slate-600 dark:text-slate-300 hover:text-[#FF4A1F] underline underline-offset-2"
                                >
                                    Platform Owner (admin)
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
