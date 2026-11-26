import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
 Sparkles,
 Shield,
 CheckCircle2,
 Lock,
 Users,
 Store,
 Pill,
 Receipt,
 MessageSquare,
 AlertTriangle,
 ArrowUpRight,
 Info,
 Layers,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface OperatingLimit {
 key: string;
 label: string;
 icon: string;
 limit: number | null;
 used: number;
 remaining: number | null;
 percent: number;
 status: 'normal' | 'warning' | 'exceeded';
 is_unlimited: boolean;
}

interface FeatureItem {
 key: string;
 name: string;
 type: 'boolean' | 'limit' | 'level';
 group_name: string;
 description?: string;
 value: boolean | number | string | null;
 bool_value: boolean;
 limit_value: number | null;
 level_value: string | null;
 used: number | null;
 remaining: number | null;
 is_overridden: boolean;
 override_expires_at?: string | null;
 override_note?: string | null;
 addon_extra_limit: number;
}

interface FeatureAccessProps {
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
 operatingLimits: Record<string, OperatingLimit>;
 groupedFeatures: Record<string, FeatureItem[]>;
 tenant: {
 id: number;
 name: string;
 };
 canManageBilling: boolean;
}

export default function FeatureAccess({
 subscription,
 statusBadge,
 banner,
 operatingLimits,
 groupedFeatures,
 tenant,
 canManageBilling,
}: FeatureAccessProps) {
 const [selectedGroup, setSelectedGroup] = useState<string>('all');
 const groups = ['all', ...Object.keys(groupedFeatures)];

 const getLimitIcon = (icon: string) => {
 switch (icon) {
 case 'users':
 return <Users className="w-5 h-5"/>;
 case 'store':
 return <Store className="w-5 h-5"/>;
 case 'pill':
 return <Pill className="w-5 h-5"/>;
 case 'receipt':
 return <Receipt className="w-5 h-5"/>;
 case 'message-square':
 return <MessageSquare className="w-5 h-5"/>;
 default:
 return <Layers className="w-5 h-5"/>;
 }
 };

 return (
 <AppLayout
 title="Feature Access & Limits"
 subtitle={`${tenant.name} • Plan Entitlements & Resource Quotas`}
 actions={
 canManageBilling && (
 <Link
 href="/billing/plans"
 className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#5CB85C] hover:bg-[#449D44] border border-[#4CAE4C] text-white text-xs font-semibold shadow-xs transition-colors"
 >
 <Sparkles className="w-3.5 h-3.5"/>
 Browse Plans & Upgrade
 </Link>
 )
 }
 >
 <Head title="Feature Access & Limits"/>

 <div className="space-y-6 max-w-7xl mx-auto">
 {/* Global Plan Header Banner */}
 <div className="bg-white dark:bg-[#1a1f26] border border-slate-200 dark:border-slate-800 rounded-[2px] p-5 shadow-xs">
 <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-[2px] bg-[#EAF5F0] dark:bg-emerald-950/40 border border-[#0E5F3F]/25 dark:border-orange-800/40 flex items-center justify-center text-[#0E5F3F]">
 <Shield className="w-6 h-6"/>
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
 {subscription.plan_name} Plan
 </h2>
 <span
 className={cn(
 'text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border',
 statusBadge.color === 'emerald' &&
 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
 statusBadge.color === 'sky' &&
 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800',
 statusBadge.color === 'amber' &&
 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
 statusBadge.color === 'rose' &&
 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
 statusBadge.color === 'gray' &&
 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
 )}
 >
 {statusBadge.label}
 </span>
 </div>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
 <span>
 Billing Cycle:{' '}
 <strong className="capitalize text-slate-700 dark:text-slate-300">
 {subscription.billing_cycle}
 </strong>
 </span>
 <span>•</span>
 <span>
 Renewal / Expiry:{' '}
 <strong className="text-slate-700 dark:text-slate-300">
 {subscription.ends_at
 ? new Date(
 subscription.ends_at
 ).toLocaleDateString(
 'en-US',
 {
 day: 'numeric',
 month: 'short',
 year: 'numeric',
 }
 )
 : 'No expiry'}
 </strong>{' '}
 ({subscription.days_left} days left)
 </span>
 </p>
 </div>
 </div>

 {canManageBilling && (
 <div className="flex items-center gap-2">
 <Link
 href="/billing/plans"
 className="px-3.5 py-1.5 rounded-[2px] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors inline-flex items-center gap-1.5"
 >
 Change Plan
 <ArrowUpRight className="w-3.5 h-3.5"/>
 </Link>
 </div>
 )}
 </div>

 {banner && (
 <div
 className={cn(
 'mt-4 p-3.5 rounded-[2px] border text-xs flex items-center justify-between gap-3',
 banner.type === 'error' &&
 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200',
 banner.type === 'warning' &&
 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
 )}
 >
 <div className="flex items-center gap-2.5">
 <AlertTriangle className="w-4 h-4 shrink-0"/>
 <div>
 <strong className="font-semibold block">
 {banner.title}
 </strong>
 <span>{banner.message}</span>
 </div>
 </div>
 <Link
 href={banner.action_url}
 className="shrink-0 px-3 py-1 rounded-[2px] bg-[#0E5F3F] text-white font-semibold text-[11px] hover:bg-[#0A4D33] transition-colors"
 >
 {banner.action_label}
 </Link>
 </div>
 )}
 </div>

 {/* Section 1: Resource Limits */}
 <div>
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-bold tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
 <Layers className="w-4 h-4 text-[#0E5F3F]"/>
 Operating Limits & Resource Quotas
 </h3>
 <span className="text-[11px] text-slate-500">
 Server-enforced live counters
 </span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
 {Object.values(operatingLimits).map((limit) => (
 <div
 key={limit.key}
 className="bg-white dark:bg-[#1a1f26] border border-slate-200 dark:border-slate-800 rounded-[2px] p-4 shadow-2xs flex flex-col justify-between"
 >
 <div>
 <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
 <span className="p-2 rounded-[2px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
 {getLimitIcon(limit.icon)}
 </span>
 {limit.is_unlimited ? (
 <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
 Unlimited
 </span>
 ) : (
 <span
 className={cn(
 'text-[11px] font-bold px-2 py-0.5 rounded-full border',
 limit.status === 'normal' &&
 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
 limit.status === 'warning' &&
 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800',
 limit.status ===
 'exceeded' &&
 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950 border-rose-300 dark:border-rose-800'
 )}
 >
 {limit.percent}%
 </span>
 )}
 </div>
 <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
 {limit.label}
 </h4>
 <div className="mt-2 flex items-baseline gap-1">
 <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
 {limit.used.toLocaleString()}
 </span>
 <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
 /{' '}
 {limit.is_unlimited
 ? '∞'
 : limit.limit?.toLocaleString()}
 </span>
 </div>
 </div>

 {!limit.is_unlimited && (
 <div className="mt-3">
 <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
 <div
 className={cn(
 'h-full transition-all duration-300 rounded-full',
 limit.status === 'normal' &&
 'bg-emerald-500',
 limit.status ===
 'warning' &&
 'bg-amber-500',
 limit.status ===
 'exceeded' &&
 'bg-rose-500'
 )}
 style={{
 width: `${Math.min(
 100,
 limit.percent
 )}%`,
 }}
 />
 </div>
 <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
 <span>
 {limit.remaining !== null
 ? `${limit.remaining.toLocaleString()} left`
 : 'Unlimited'}
 </span>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 </div>

 {/* Section 2: Plan Features Catalog */}
 <div>
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
 <div>
 <h3 className="text-sm font-bold tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
 <Sparkles className="w-4 h-4 text-[#0E5F3F]"/>
 Module & Feature Access Matrix
 </h3>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
 Real-time capability status resolved from plan
 subscription, add-ons, and overrides.
 </p>
 </div>

 {/* Filter by Group Tabs */}
 <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-[2px] border border-slate-200 dark:border-slate-700">
 {groups.map((group) => (
 <button
 key={group}
 type="button"
 onClick={() => setSelectedGroup(group)}
 className={cn(
 'px-2.5 py-1 text-xs font-semibold rounded-[2px] transition-colors capitalize',
 selectedGroup === group
 ? 'bg-white dark:bg-slate-700 text-[#0E5F3F] shadow-2xs font-bold'
 : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
 )}
 >
 {group === 'all' ? 'All Modules' : group}
 </button>
 ))}
 </div>
 </div>

 <div className="space-y-6">
 {Object.entries(groupedFeatures)
 .filter(
 ([group]) =>
 selectedGroup === 'all' ||
 selectedGroup === group
 )
 .map(([groupName, items]) => (
 <div
 key={groupName}
 className="bg-white dark:bg-[#1a1f26] border border-slate-200 dark:border-slate-800 rounded-[2px] overflow-hidden shadow-2xs"
 >
 <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
 <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wider">
 {groupName}
 </h4>
 <span className="text-[11px] text-slate-500">
 {items.length} features
 </span>
 </div>

 <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
 {items.map((feat) => {
 const isEnabled =
 feat.type === 'boolean'
 ? Boolean(feat.bool_value)
 : true;

 return (
 <div
 key={feat.key}
 className={cn(
 'p-3.5 flex items-center justify-between gap-4 transition-colors',
 !isEnabled &&
 'bg-slate-50/40 dark:bg-slate-900/20'
 )}
 >
 <div className="flex items-start gap-3">
 <div
 className={cn(
 'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
 isEnabled
 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
 : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
 )}
 >
 {isEnabled ? (
 <CheckCircle2 className="w-4 h-4"/>
 ) : (
 <Lock className="w-3.5 h-3.5"/>
 )}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span
 className={cn(
 'text-xs font-bold',
 isEnabled
 ? 'text-slate-900 dark:text-slate-100'
 : 'text-slate-500 dark:text-slate-400'
 )}
 >
 {feat.name}
 </span>

 {feat.type ===
 'level' &&
 feat.level_value && (
 <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-[2px] bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
 Level:{' '}
 {
 feat.level_value
 }
 </span>
 )}

 {feat.is_overridden && (
 <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[2px] bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
 <Info className="w-3 h-3"/>
 Custom
 Override
 </span>
 )}

 {feat.addon_extra_limit >
 0 && (
 <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[2px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
 +
 {feat.addon_extra_limit.toLocaleString()}{' '}
 Add-on
 </span>
 )}
 </div>

 <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
 {
 feat.description
 }
 </p>

 {feat.is_overridden &&
 feat.override_note && (
 <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 italic">
 Note:{' '}
 {
 feat.override_note
 }
 </p>
 )}
 </div>
 </div>

 <div className="shrink-0 flex items-center gap-2">
 {isEnabled ? (
 <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-[2px] border border-emerald-200 dark:border-emerald-800">
 Active
 </span>
 ) : (
 <Link
 href="/billing/plans"
 className="text-xs font-semibold px-2.5 py-1 rounded-[2px] bg-slate-100 dark:bg-slate-800 hover:bg-[#0E5F3F] hover:text-white text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 border border-slate-200 dark:border-slate-700"
 >
 <Lock className="w-3 h-3"/>
 Upgrade
 </Link>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 </AppLayout>
 );
}
