import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    CheckCircle2,
    Sparkles,
    Shield,
    X,
    AlertTriangle,
    ArrowRight,
    Terminal,
    Info,
    Check,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface PlanFeatureMeta {
    type: 'boolean' | 'limit' | 'level';
    bool_value: boolean;
    limit_value: number | null;
    level_value: string | null;
}

interface PlanItem {
    id: number;
    code: string;
    name: string;
    monthly_price: number;
    yearly_price: number;
    currency: string;
    features: Record<string, PlanFeatureMeta>;
}

interface BrowsePlansProps {
    plans: PlanItem[];
    currentPlanCode: string;
    currentBillingCycle: string;
    subscription: {
        id: number | null;
        plan_code: string;
        plan_name: string;
        billing_cycle: string;
        status: string;
        ends_at: string | null;
        days_left: number;
    };
    statusBadge: {
        label: string;
        color: string;
    };
    banner?: {
        type: string;
        title: string;
        message: string;
        action_label: string;
        action_url: string;
    } | null;
    isWritable: boolean;
    tenant: {
        id: number;
        name: string;
    } | null;
    canManageBilling: boolean;
}

interface ImpactResponse {
    is_downgrade: boolean;
    over_limit_resources: Record<
        string,
        {
            resource: string;
            label: string;
            current_used: number;
            new_limit: number;
            difference: number;
        }
    >;
    features_disabled: Record<string, string>;
    levels_reduced: Record<string, { from: string; to: string }>;
    warnings: string[];
}

export default function BrowsePlans({
    plans,
    currentPlanCode,
    currentBillingCycle = 'monthly',
    tenant,
}: BrowsePlansProps) {
    const [cycle, setCycle] = useState<'monthly' | 'yearly'>(
        currentBillingCycle === 'yearly' ? 'yearly' : 'monthly'
    );
    const [selectedPlan, setSelectedPlan] = useState<PlanItem | null>(null);
    const [impactData, setImpactData] = useState<ImpactResponse | null>(null);
    const [isLoadingImpact, setIsLoadingImpact] = useState(false);
    const [showConfirmNotice, setShowConfirmNotice] = useState(false);

    const handleSelectPlan = async (plan: PlanItem) => {
        if (plan.code === currentPlanCode) {
            return;
        }

        setSelectedPlan(plan);
        setShowConfirmNotice(false);
        setIsLoadingImpact(true);

        try {
            const res = await fetch(`/billing/plans/${plan.id}/impact`);
            if (res.ok) {
                const data = await res.json();
                setImpactData(data);
            } else {
                setImpactData(null);
            }
        } catch (e) {
            setImpactData(null);
        } finally {
            setIsLoadingImpact(false);
        }
    };

    const closeModal = () => {
        setSelectedPlan(null);
        setImpactData(null);
        setShowConfirmNotice(false);
    };

    return (
        <AppLayout
            title="Subscription Plans & Pricing"
            subtitle="Choose the optimal tier for your pharmacy business"
            actions={
                <Link
                    href="/feature-access"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
                >
                    <Shield className="w-3.5 h-3.5 text-[#FF4A1F]" />
                    View Current Limits & Access
                </Link>
            }
        >
            <Head title="Subscription Plans & Pricing" />

            <div className="max-w-7xl mx-auto space-y-8">
                {/* Billing Cycle Switcher */}
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setCycle('monthly')}
                            className={cn(
                                'px-5 py-2 text-xs font-bold rounded-md transition-all',
                                cycle === 'monthly'
                                    ? 'bg-white dark:bg-slate-700 text-[#FF4A1F] shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            )}
                        >
                            Monthly Billing
                        </button>
                        <button
                            type="button"
                            onClick={() => setCycle('yearly')}
                            className={cn(
                                'px-5 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2',
                                cycle === 'yearly'
                                    ? 'bg-white dark:bg-slate-700 text-[#FF4A1F] shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            )}
                        >
                            Yearly Billing
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                2 Months Free (~17% Off)
                            </span>
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Prices are in BDT. All plans include 100% data ownership,
                        nightly backups, and multi-tenant security.
                    </p>
                </div>

                {/* Plan Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                    {plans.map((plan) => {
                        const isCurrent = plan.code === currentPlanCode;
                        const price =
                            cycle === 'yearly'
                                ? plan.yearly_price
                                : plan.monthly_price;
                        const formattedPrice = Number(price).toLocaleString();

                        return (
                            <div
                                key={plan.id}
                                className={cn(
                                    'bg-white dark:bg-[#1a1f26] border rounded-xl p-6 shadow-xs flex flex-col justify-between transition-all relative',
                                    isCurrent
                                        ? 'border-[#FF4A1F] ring-2 ring-[#FF4A1F]/20 dark:ring-[#FF4A1F]/30'
                                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                )}
                            >
                                {isCurrent && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF4A1F] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                                        Current Active Plan
                                    </div>
                                )}

                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                            {plan.name}
                                        </h3>
                                        <span className="text-xs uppercase font-semibold text-slate-500">
                                            Tier {plan.id}
                                        </span>
                                    </div>

                                    <div className="mb-6">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                                                ৳{formattedPrice}
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                /{' '}
                                                {cycle === 'yearly'
                                                    ? 'year'
                                                    : 'month'}
                                            </span>
                                        </div>
                                        {cycle === 'yearly' && (
                                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                                                Equivalent to ৳
                                                {Math.round(
                                                    Number(price) / 12
                                                ).toLocaleString()}
                                                /mo
                                            </p>
                                        )}
                                    </div>

                                    {/* Key Plan Limits & Features */}
                                    <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                Staff Accounts:
                                            </span>
                                            <strong className="text-slate-900 dark:text-slate-100 font-bold">
                                                {plan.features.max_users
                                                    ?.limit_value
                                                    ? `${plan.features.max_users.limit_value} Users`
                                                    : 'Unlimited'}
                                            </strong>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                Pharmacy Branches:
                                            </span>
                                            <strong className="text-slate-900 dark:text-slate-100 font-bold">
                                                {plan.features.max_branches
                                                    ?.limit_value
                                                    ? `${plan.features.max_branches.limit_value} Branch(es)`
                                                    : 'Unlimited Outlets'}
                                            </strong>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                Medicine Items:
                                            </span>
                                            <strong className="text-slate-900 dark:text-slate-100 font-bold">
                                                {plan.features.max_products
                                                    ?.limit_value
                                                    ? `${plan.features.max_products.limit_value.toLocaleString()} items`
                                                    : 'Unlimited'}
                                            </strong>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                Monthly Bills:
                                            </span>
                                            <strong className="text-slate-900 dark:text-slate-100 font-bold">
                                                {plan.features.max_bills_month
                                                    ?.limit_value
                                                    ? `${plan.features.max_bills_month.limit_value.toLocaleString()} bills/mo`
                                                    : 'Unlimited'}
                                            </strong>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                Batch & FEFO Expiry:
                                            </span>
                                            <strong className="font-bold flex items-center gap-1">
                                                {plan.features.batch_expiry
                                                    ?.bool_value ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                        <Check className="w-3.5 h-3.5" />{' '}
                                                        Included
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">
                                                        Not included
                                                    </span>
                                                )}
                                            </strong>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                Stock Transfers:
                                            </span>
                                            <strong className="font-bold">
                                                {plan.features.stock_transfer
                                                    ?.bool_value ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                        <Check className="w-3.5 h-3.5" />{' '}
                                                        Included
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">
                                                        Not included
                                                    </span>
                                                )}
                                            </strong>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                Reporting Depth:
                                            </span>
                                            <strong className="capitalize text-slate-900 dark:text-slate-100 font-bold">
                                                {plan.features.report_level
                                                    ?.level_value || 'Basic'}
                                            </strong>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                Double-Entry Accounts:
                                            </span>
                                            <strong className="capitalize text-slate-900 dark:text-slate-100 font-bold">
                                                {plan.features.accounts_level
                                                    ?.level_value === 'full'
                                                    ? 'Full Accounting'
                                                    : 'Basic Ledgers'}
                                            </strong>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    {isCurrent ? (
                                        <button
                                            type="button"
                                            disabled
                                            className="w-full py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-xs cursor-default"
                                        >
                                            Active Plan
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleSelectPlan(plan)
                                            }
                                            className="w-full py-2.5 rounded-lg bg-[#FF4A1F] hover:bg-[#e03f16] text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-2"
                                        >
                                            <span>
                                                Switch to {plan.name} (
                                                {cycle === 'yearly'
                                                    ? 'Yearly'
                                                    : 'Monthly'}
                                                )
                                            </span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Plan Change Impact & Confirmation Modal */}
            {selectedPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-[#1a1f26] border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
                        <button
                            type="button"
                            onClick={closeModal}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/40 flex items-center justify-center text-[#FF4A1F]">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                    Switch to {selectedPlan.name} Plan
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Target Billing:{' '}
                                    <strong className="capitalize">
                                        {cycle}
                                    </strong>{' '}
                                    (৳
                                    {(cycle === 'yearly'
                                        ? selectedPlan.yearly_price
                                        : selectedPlan.monthly_price
                                    ).toLocaleString()}
                                    )
                                </p>
                            </div>
                        </div>

                        {isLoadingImpact ? (
                            <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-500 space-y-2">
                                <div className="w-6 h-6 border-2 border-[#FF4A1F] border-t-transparent rounded-full animate-spin" />
                                <p>Evaluating subscription impact...</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {impactData?.warnings &&
                                impactData.warnings.length > 0 ? (
                                    <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs space-y-2">
                                        <div className="flex items-center gap-1.5 font-bold">
                                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                                            <span>
                                                Plan Downgrade Warnings
                                                (Preservation Policy):
                                            </span>
                                        </div>
                                        <ul className="list-disc list-inside space-y-1 text-[11px]">
                                            {impactData.warnings.map(
                                                (warn, idx) => (
                                                    <li key={idx}>{warn}</li>
                                                )
                                            )}
                                        </ul>
                                        <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium pt-1 border-t border-amber-200/60 dark:border-amber-800/60">
                                            Note: Downgrading never deletes your
                                            historical data. Existing records
                                            remain preserved.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                                        <span>
                                            Seamless upgrade! All current usage
                                            fits comfortably within{' '}
                                            {selectedPlan.name} plan limits.
                                        </span>
                                    </div>
                                )}

                                {showConfirmNotice && (
                                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-100 space-y-2">
                                        <div className="flex items-center gap-2 font-bold">
                                            <Info className="w-4 h-4 text-blue-600" />
                                            <span>
                                                Online Purchase Coming Soon
                                                (Phase 7)
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-blue-800 dark:text-blue-200">
                                            Automated payment gateway (bKash,
                                            Nagad, Cards) integration is
                                            scheduled for Phase 7. In Phase 2,
                                            subscriptions are managed via
                                            Artisan command:
                                        </p>
                                        <div className="bg-slate-900 text-emerald-400 p-2.5 rounded font-mono text-[11px] flex items-center gap-2 overflow-x-auto">
                                            <Terminal className="w-3.5 h-3.5 shrink-0" />
                                            <span>
                                                php artisan tenant:set-plan{' '}
                                                {tenant?.id || '{tenant}'}{' '}
                                                {selectedPlan.code} {cycle}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowConfirmNotice(true)
                                        }
                                        className="px-4 py-2 rounded-lg bg-[#FF4A1F] hover:bg-[#e03f16] text-white text-xs font-bold transition-colors shadow-2xs"
                                    >
                                        Confirm Plan Selection
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
