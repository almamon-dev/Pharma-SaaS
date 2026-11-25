import React from 'react';
import { useForm, usePage } from '@inertiajs/react';
import {
    Building2,
    CheckCircle2,
    ExternalLink,
    Globe,
    Save,
    Settings,
    ShieldCheck,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { FormLayoutProvider } from '@/Components/ui/FormLayout';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { Textarea } from '@/Components/ui/Textarea';
import { CurrentTenant, PlanSummary, SharedPageProps } from '@/types';
import { formatCurrency } from '@/lib/format';

interface BusinessSettingsProps {
    business: CurrentTenant & {
        active_subscription?: {
            status?: string;
            plan?: PlanSummary | null;
        } | null;
    };
    plans: PlanSummary[];
}

const currencyOptions = [
    { id: 'BDT', value: 'BDT', name: 'BDT (৳)' },
    { id: 'USD', value: 'USD', name: 'USD ($)' },
    { id: 'EUR', value: 'EUR', name: 'EUR (€)' },
    { id: 'GBP', value: 'GBP', name: 'GBP (£)' },
];

const timezoneOptions = [
    { id: 'Asia/Dhaka', value: 'Asia/Dhaka', name: 'Asia/Dhaka (UTC+6)' },
    { id: 'UTC', value: 'UTC', name: 'UTC (Coordinated Universal Time)' },
    {
        id: 'Asia/Singapore',
        value: 'Asia/Singapore',
        name: 'Asia/Singapore (UTC+8)',
    },
    { id: 'Europe/London', value: 'Europe/London', name: 'Europe/London' },
    {
        id: 'America/New_York',
        value: 'America/New_York',
        name: 'America/New_York',
    },
];

export default function BusinessSettings({
    business,
    plans,
}: BusinessSettingsProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const activePlan =
        business.active_subscription?.plan ?? tenant?.currentTenant?.plan;

    const { data, setData, put, processing, errors } = useForm({
        name: business.name ?? '',
        license_number: business.license_number ?? '',
        tax_id: business.tax_id ?? '',
        email: business.email ?? '',
        phone: business.phone ?? '',
        address: business.address ?? '',
        city: business.city ?? '',
        currency_code: business.currency_code ?? 'BDT',
        timezone: business.timezone ?? 'Asia/Dhaka',
        low_stock_alert_days: String(
            (business.settings?.low_stock_alert_days as number | undefined) ??
                30
        ),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('settings.business.update'), { preserveScroll: true });
    };

    return (
        <AppLayout
            title="Business Tenant Settings"
            subtitle={`Configure legal profile, FEFO threshold, and currency for ${business.name}`}
        >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-8">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-[#FF4A1F]" />
                            <CardTitle>Organization & Compliance</CardTitle>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                            {business.domain && (
                                <a
                                    href={business.domain_url ?? '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-mono text-[#FF4A1F] hover:underline"
                                >
                                    <Globe className="h-3 w-3" />
                                    {business.domain}
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                            <span className="font-mono text-slate-500">
                                {business.slug}
                            </span>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <FormLayoutProvider labelWidth="sm:w-[175px]">
                            <form onSubmit={handleSubmit} className="space-y-3">
                                <Input
                                    label="Business Name"
                                    required
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    error={errors.name}
                                    icon={<Building2 className="h-3.5 w-3.5" />}
                                />
                                <Input
                                    label="Drug License No."
                                    value={data.license_number}
                                    onChange={(e) =>
                                        setData(
                                            'license_number',
                                            e.target.value
                                        )
                                    }
                                    error={errors.license_number}
                                    icon={
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                    }
                                />
                                <Input
                                    label="Tax / VAT ID"
                                    value={data.tax_id}
                                    onChange={(e) =>
                                        setData('tax_id', e.target.value)
                                    }
                                    error={errors.tax_id}
                                />
                                <Input
                                    label="Work Email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) =>
                                        setData('email', e.target.value)
                                    }
                                    error={errors.email}
                                />
                                <Input
                                    label="Support Phone"
                                    value={data.phone}
                                    onChange={(e) =>
                                        setData('phone', e.target.value)
                                    }
                                    error={errors.phone}
                                />
                                <Input
                                    label="City"
                                    value={data.city}
                                    onChange={(e) =>
                                        setData('city', e.target.value)
                                    }
                                    error={errors.city}
                                />
                                <Select
                                    label="Currency"
                                    required
                                    value={data.currency_code}
                                    options={currencyOptions}
                                    onChange={(e) =>
                                        setData(
                                            'currency_code',
                                            String(e.target.value)
                                        )
                                    }
                                    error={errors.currency_code}
                                />
                                <Select
                                    label="Timezone"
                                    required
                                    value={data.timezone}
                                    options={timezoneOptions}
                                    onChange={(e) =>
                                        setData(
                                            'timezone',
                                            String(e.target.value)
                                        )
                                    }
                                    error={errors.timezone}
                                />
                                <Input
                                    label="FEFO Alert Window (Days)"
                                    type="number"
                                    min={7}
                                    max={180}
                                    required
                                    value={data.low_stock_alert_days}
                                    onChange={(e) =>
                                        setData(
                                            'low_stock_alert_days',
                                            e.target.value
                                        )
                                    }
                                    error={errors.low_stock_alert_days}
                                />
                                <Textarea
                                    label="Registered Address"
                                    value={data.address}
                                    onChange={(e) =>
                                        setData('address', e.target.value)
                                    }
                                    error={errors.address}
                                />

                                {tenant?.canManageOrganization && (
                                    <div className="flex justify-end pt-2">
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            isLoading={processing}
                                        >
                                            <Save className="h-3.5 w-3.5" />
                                            Save Business Settings
                                        </Button>
                                    </div>
                                )}
                            </form>
                        </FormLayoutProvider>
                    </CardContent>
                </Card>

                <div className="lg:col-span-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Active Subscription</CardTitle>
                            <span className="text-xs font-bold text-[#FF4A1F]">
                                {activePlan?.name ?? 'Growth'}
                            </span>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs">
                            <div className="rounded-[4px] border border-[#FF4A1F]/25 bg-[#FFF0ED]/70 dark:bg-[#ff4a1f]/10 p-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900 dark:text-slate-100">
                                        Tenant Status
                                    </span>
                                    <StatusDot
                                        variant={
                                            business.status === 'active'
                                                ? 'emerald'
                                                : 'brand'
                                        }
                                        className="capitalize"
                                    >
                                        {business.status}
                                    </StatusDot>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                                    UUID:{' '}
                                    <span className="font-mono">
                                        {business.uuid}
                                    </span>
                                </p>
                            </div>

                            <div className="space-y-2 pt-1">
                                {plans.map((plan) => {
                                    const isCurrent =
                                        plan.key === activePlan?.key;
                                    return (
                                        <div
                                            key={plan.key}
                                            className={`rounded-[4px] border p-3 transition-colors ${
                                                isCurrent
                                                    ? 'border-[#FF4A1F] bg-orange-50/40 dark:bg-[#ff4a1f]/5'
                                                    : 'border-slate-200 dark:border-slate-800'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                                    {plan.name}
                                                </span>
                                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                                    {formatCurrency(
                                                        plan.monthly_price ?? 0,
                                                        'USD'
                                                    )}
                                                    /mo
                                                </span>
                                            </div>
                                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                                                {isCurrent && (
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-[#FF4A1F]" />
                                                )}
                                                <span>
                                                    {plan.max_pharmacies}{' '}
                                                    tenants · {plan.max_branches}{' '}
                                                    branches · {plan.max_users}{' '}
                                                    staff ·{' '}
                                                    {plan.max_medicines.toLocaleString()}{' '}
                                                    SKUs
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

