import { Link, usePage } from '@inertiajs/react';
import {
    ArrowUpRight,
    CheckCircle2,
    Layers,
    Lock,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { SharedPageProps, TenantFeatureItem } from '@/types';

interface PlanReference {
    id: number;
    name: string;
    key: string;
    monthly_price: string | number;
    modules?: Array<{ id: number; key: string; name: string }>;
}

interface FeaturesIndexProps {
    tenantFeatures: TenantFeatureItem[];
    plans: PlanReference[];
}

const featureRoutes: Record<string, { label: string; routeName: string }> = {
    pos: { label: 'Open POS Terminal', routeName: 'pos.index' },
    inventory: { label: 'Open Inventory', routeName: 'inventory.index' },
    branches: { label: 'Manage Branches', routeName: 'branches.index' },
    crm: { label: 'Open Customer CRM', routeName: 'crm.customers' },
    team_rbac: { label: 'Manage Team & Roles', routeName: 'team.index' },
};

export default function FeaturesIndex({
    tenantFeatures,
    plans,
}: FeaturesIndexProps) {
    const { auth, subscription, tenant } = usePage<SharedPageProps>().props;
    const isAdminOwner = Boolean(auth?.user?.is_subscriber_admin);

    const unlockedCount = tenantFeatures.filter((f) => f.is_enabled).length;
    const lockedCount = tenantFeatures.filter((f) => !f.is_enabled).length;
    const coreCount = tenantFeatures.filter((f) => f.is_core).length;

    const plansUnlockingKey = (key: string, isCore: boolean) => {
        if (isCore) return 'Included in all plans';
        const matching = plans
            .filter((p) => (p.modules ?? []).some((m) => m.key === key))
            .map((p) => p.name);
        return matching.length > 0
            ? `Available on: ${matching.join(', ')}`
            : 'Custom Plan Add-on';
    };

    return (
        <AppLayout
            title="Plan Features & Access Control"
            subtitle={`Feature-wise entitlements active for "${tenant?.currentTenant?.name ?? 'Your Business'}" under the ${subscription?.plan?.name ?? 'Active'} plan.`}
            actions={
                isAdminOwner ? (
                    <Link href={route('plans.index')}>
                        <Button variant="primary" size="md">
                            <Layers className="h-3.5 w-3.5" />
                            Upgrade / Change Plan
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                    </Link>
                ) : null
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <MetricCard
                    title="Current Plan"
                    value={subscription?.plan?.name ?? 'Active Plan'}
                    description={`Status: ${subscription?.status ?? 'active'}`}
                    icon={ShieldCheck}
                    colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                />
                <MetricCard
                    title="Unlocked Features"
                    value={unlockedCount}
                    description="Accessible right now in your tenant"
                    icon={CheckCircle2}
                    colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                />
                <MetricCard
                    title="Locked Features"
                    value={lockedCount}
                    description="Require plan upgrade or add-on"
                    icon={Lock}
                    colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                />
                <MetricCard
                    title="Core Capabilities"
                    value={coreCount}
                    description="Always unlocked platform essentials"
                    icon={Sparkles}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-[#FF4A1F]" />
                        <CardTitle>Feature Access Matrix</CardTitle>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {unlockedCount} / {tenantFeatures.length} Enabled
                    </span>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {tenantFeatures.map((feat) => {
                            const unlocked = Boolean(feat.is_enabled);
                            const actionMeta = featureRoutes[feat.key];

                            return (
                                <div
                                    key={feat.key}
                                    className={`rounded-[4px] border p-4 flex flex-col justify-between transition-colors ${
                                        unlocked
                                            ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10'
                                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 opacity-90'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                    {feat.name}
                                                </h3>
                                                <p className="mt-0.5 text-[11px] text-slate-500">
                                                    <span className="font-mono">
                                                        {feat.key}
                                                    </span>
                                                    {feat.category
                                                        ? ` · ${feat.category}`
                                                        : ''}
                                                </p>
                                            </div>
                                            {unlocked ? (
                                                <StatusDot variant="emerald">
                                                    Unlocked
                                                </StatusDot>
                                            ) : (
                                                <StatusDot variant="slate">
                                                    Locked
                                                </StatusDot>
                                            )}
                                        </div>

                                        {feat.description && (
                                            <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                                {feat.description}
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-medium text-slate-500">
                                            {plansUnlockingKey(
                                                feat.key,
                                                feat.is_core
                                            )}
                                        </span>

                                        {unlocked && actionMeta ? (
                                            <Link href={route(actionMeta.routeName)}>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                >
                                                    {actionMeta.label}
                                                </Button>
                                            </Link>
                                        ) : !unlocked && isAdminOwner ? (
                                            <Link href={route('plans.index')}>
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                >
                                                    Upgrade Plan
                                                </Button>
                                            </Link>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </AppLayout>
    );
}

