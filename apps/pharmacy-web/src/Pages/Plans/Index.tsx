import { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Building2,
    Check,
    CreditCard,
    GitBranch,
    Layers,
    Package,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { StatusDot } from '@/Components/ui/StatusDot';
import { PlanSummary, SharedPageProps, SubscriptionUsage } from '@/types';
import { formatCurrency, formatQuotaLimit } from '@/lib/format';

interface PlansIndexProps {
    plans: PlanSummary[];
    businessName: string;
    isAdminOwner: boolean;
    usage: SubscriptionUsage;
    selectedPlanKey?: string | null;
}

const paymentMethods = [
    {
        value: 'trial',
        label: 'Start Free Trial (14 Days)',
        hint: 'Full workspace access, $0 charge, no card required',
    },
    {
        value: 'card',
        label: 'Credit / Debit Card',
        hint: 'Instant commercial activation',
    },
    {
        value: 'bkash',
        label: 'bKash / Mobile Wallet',
        hint: 'Local wallet payment',
    },
    {
        value: 'bank_transfer',
        label: 'Bank Transfer',
        hint: 'Corporate invoice settlement',
    },
] as const;

export default function PlansIndex({
    plans,
    businessName,
    isAdminOwner,
    usage,
    selectedPlanKey,
}: PlansIndexProps) {
    const { subscription, tenant } = usePage<SharedPageProps>().props;
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(
        subscription?.billing_cycle === 'annual' ? 'annual' : 'monthly'
    );
    const [paymentMethod, setPaymentMethod] = useState<string>(
        subscription?.has_subscription ? 'card' : 'trial'
    );
    const [submittingKey, setSubmittingKey] = useState<string | null>(null);

    const activePlanKey = subscription?.plan?.key ?? '';

    const handleSelectPlan = (planKey: string) => {
        setSubmittingKey(planKey);
        router.post(
            route('subscription.store'),
            {
                plan_key: planKey,
                billing_cycle: billingCycle,
                payment_method: paymentMethod,
            },
            {
                preserveScroll: true,
                onFinish: () => setSubmittingKey(null),
            }
        );
    };

    return (
        <AppLayout
            title="Choose Subscription Plan"
            subtitle={`Select a plan for "${businessName}" to unlock POS, FEFO Inventory, Multi-Branch Operations & Team RBAC.`}
            actions={
                subscription?.has_subscription ? (
                    <Link href={route('subscription.index')}>
                        <Button variant="outline" size="md">
                            <CreditCard className="h-3.5 w-3.5" />
                            Billing & Invoices
                        </Button>
                    </Link>
                ) : null
            }
        >
            {/* Business Context Banner */}
            <Card className="mb-4">
                <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[2px] bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 text-[#0E5F3F]">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    {businessName}
                                </h2>
                                <StatusDot
                                    variant={
                                        subscription?.is_usable
                                            ? 'emerald'
                                            : 'brand'
                                    }
                                >
                                    {subscription?.is_usable
                                        ? `${subscription.plan?.name} (${subscription.status})`
                                        : 'Step 2 of 2 — Pick Your Plan'}
                                </StatusDot>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {tenant?.currentTenant?.domain ? (
                                    <>
                                        Workspace domain:{' '}
                                        <span className="tabular-nums font-semibold text-[#0E5F3F]">
                                            {tenant.currentTenant.domain}
                                        </span>{' '}
                                        ·{' '}
                                    </>
                                ) : null}
                                Current footprint: {usage.tenants} tenant(s),{' '}
                                {usage.branches} branch(es), {usage.employees}{' '}
                                staff seat(s). All tenants you create share this
                                subscription quota.
                            </p>
                        </div>
                    </div>

                    {/* Billing Cycle Switcher */}
                    <div className="inline-flex shrink-0 rounded-[2px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-0.5 self-start md:self-center">
                        <button
                            type="button"
                            onClick={() => setBillingCycle('monthly')}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer ${
                                billingCycle === 'monthly'
                                    ? 'bg-[#0E5F3F] text-white'
                                    : 'text-slate-600 dark:text-slate-300'
                            }`}
                        >
                            Monthly
                        </button>
                        <button
                            type="button"
                            onClick={() => setBillingCycle('annual')}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer ${
                                billingCycle === 'annual'
                                    ? 'bg-[#0E5F3F] text-white'
                                    : 'text-slate-600 dark:text-slate-300'
                            }`}
                        >
                            Annual (Save ~17%)
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Payment Mode Pill Selector (no dropdown) */}
            {isAdminOwner && (
                <Card className="mb-4">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-[#0E5F3F]" />
                            <CardTitle>Activation & Payment Method</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {paymentMethods.map((method) => {
                                const selected =
                                    paymentMethod === method.value;
                                return (
                                    <button
                                        key={method.value}
                                        type="button"
                                        onClick={() =>
                                            setPaymentMethod(method.value)
                                        }
                                        className={`text-left rounded-[2px] border p-3 transition-all cursor-pointer ${
                                            selected
                                                ? 'border-[#0E5F3F] bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 ring-1 ring-[#0E5F3F]/30'
                                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e2329] hover:border-slate-300'
                                        }`}
                                    >
                                        <p
                                            className={`text-xs font-bold ${
                                                selected
                                                    ? 'text-[#0E5F3F]'
                                                    : 'text-slate-900 dark:text-slate-100'
                                            }`}
                                        >
                                            {method.label}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                            {method.hint}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Pricing Plan Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
                {plans.map((plan) => {
                    const isCurrent =
                        activePlanKey === plan.key &&
                        Boolean(subscription?.is_usable);
                    const unitPrice =
                        billingCycle === 'annual'
                            ? Number(plan.annual_price ?? 0)
                            : Number(plan.monthly_price ?? 0);
                    const exceedsCurrentUsage =
                        usage.tenants > plan.max_pharmacies ||
                        usage.branches > plan.max_branches;

                    const isSelectedFromUrl = Boolean(
                        selectedPlanKey && selectedPlanKey === plan.key
                    );

                    return (
                        <div
                            key={plan.key}
                            className={`rounded-[2px] border p-6 flex flex-col justify-between bg-white dark:bg-[#1e2329] transition-all ${
                                isCurrent
                                    ? 'border-emerald-500 border-t-[3px] border-t-emerald-500 shadow-sm'
                                    : isSelectedFromUrl
                                      ? 'border-[#0E5F3F] border-t-[3px] border-t-[#0E5F3F] ring-2 ring-[#0E5F3F]/30 shadow-md'
                                      : plan.is_popular
                                        ? 'border-[#0E5F3F] border-t-[3px] border-t-[#0E5F3F] shadow-sm'
                                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <Layers className="h-4 w-4 text-[#0E5F3F] shrink-0" />
                                            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                                                {plan.name}
                                            </h3>
                                        </div>
                                        {plan.name_bn && (
                                             <span className="text-[11px] font-medium text-[#0E5F3F] dark:text-[#ff7450] pl-6">
                                                {plan.name_bn}
                                            </span>
                                        )}
                                    </div>
                                    {isCurrent ? (
                                        <StatusDot variant="emerald">
                                            Active Plan
                                        </StatusDot>
                                    ) : isSelectedFromUrl ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[11px] font-bold bg-[#0E5F3F] text-white">
                                            Selected Trial
                                        </span>
                                    ) : plan.is_popular ? (
                                        <StatusDot variant="brand">
                                            Recommended
                                        </StatusDot>
                                    ) : null}
                                </div>

                                {plan.description && (
                                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed min-h-[36px]">
                                        {plan.description}
                                    </p>
                                )}

                                <div className="mt-4 flex items-baseline gap-1.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                                        {paymentMethod === 'trial'
                                            ? '$0'
                                            : formatCurrency(
                                                  unitPrice,
                                                  plan.currency_code ?? 'USD'
                                              )}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {paymentMethod === 'trial'
                                            ? `for ${plan.trial_days ?? 14} days, then ${formatCurrency(unitPrice, plan.currency_code ?? 'USD')}/${billingCycle === 'annual' ? 'yr' : 'mo'}`
                                            : `/ ${billingCycle === 'annual' ? 'year' : 'month'}`}
                                    </span>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-[2px] border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#161a1e] p-3 text-xs">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-3.5 w-3.5 text-[#0E5F3F] shrink-0" />
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
                                        <GitBranch className="h-3.5 w-3.5 text-[#0E5F3F] shrink-0" />
                                        <span>
                                            <strong className="text-slate-900 dark:text-slate-100">
                                                {formatQuotaLimit(plan.max_branches)}
                                            </strong>{' '}
                                            <span className="text-slate-500">
                                                Branches
                                            </span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users className="h-3.5 w-3.5 text-[#0E5F3F] shrink-0" />
                                        <span>
                                            <strong className="text-slate-900 dark:text-slate-100">
                                                {formatQuotaLimit(plan.max_users)}
                                            </strong>{' '}
                                            <span className="text-slate-500">
                                                Staff
                                            </span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Package className="h-3.5 w-3.5 text-[#0E5F3F] shrink-0" />
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

                                <ul className="mt-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                                    {(plan.features ?? []).map((feat) => (
                                        <li
                                            key={feat}
                                            className="flex items-start gap-2"
                                        >
                                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                            <span>{feat}</span>
                                        </li>
                                    ))}
                                </ul>

                                {(plan.modules ?? []).length > 0 && (
                                    <p className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                            Unlocked Modules:{' '}
                                        </span>
                                        {(plan.modules ?? [])
                                            .map((mod) => mod.name)
                                            .join(' · ')}
                                    </p>
                                )}
                            </div>

                            <div className="mt-5 pt-3">
                                {exceedsCurrentUsage && (
                                    <p className="mb-2 text-[11px] font-semibold text-amber-600">
                                        Your current usage exceeds this tier
                                        quota.
                                    </p>
                                )}
                                {isAdminOwner ? (
                                    <Button
                                        variant={
                                            isCurrent ? 'outline' : 'primary'
                                        }
                                        fullWidth
                                        disabled={exceedsCurrentUsage}
                                        isLoading={submittingKey === plan.key}
                                        onClick={() =>
                                            handleSelectPlan(plan.key)
                                        }
                                    >
                                        {isCurrent
                                            ? 'Renew / Switch Billing'
                                            : paymentMethod === 'trial'
                                              ? `Start ${plan.trial_days ?? 14}-Day Free Trial`
                                              : `Activate ${plan.name}`}
                                    </Button>
                                ) : (
                                    <p className="text-center text-xs text-slate-400">
                                        Only Business Owners can change plans.
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </AppLayout>
    );
}
