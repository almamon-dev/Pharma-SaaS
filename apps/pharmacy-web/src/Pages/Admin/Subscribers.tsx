import React, { useMemo, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Edit, ShieldCheck, Users } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { StatusDot } from '@/Components/ui/StatusDot';
import {
 BrtaField,
 BrtaFormGrid,
 BrtaFormModal,
 brtaInputClass,
} from '@/Components/ui/BrtaForm';
import {
 DataTable,
 Column,
 EmptyState,
 TableActionMenu,
} from '@/Components/tables';
import { PlanModuleSummary, PlanSummary } from '@/types';
import { formatCurrency } from '@/lib/format';

interface SubscriberRow {
 id: number;
 name: string;
 email: string;
 phone?: string | null;
 business_name?: string | null;
 account_status: string;
 plan_id?: number | null;
 plan_key: string;
 plan_name: string;
 subscription_status: string;
 billing_cycle: string;
 amount: number;
 ends_at: string;
 tenants_used: number;
 max_tenants: number;
 branches_used: number;
 max_branches: number;
 employees_used: number;
 max_users: number;
 enabled_module_ids?: number[];
}

interface AdminSubscribersProps {
 subscribers: SubscriberRow[];
 plans: PlanSummary[];
 modules?: PlanModuleSummary[];
}

export default function AdminSubscribers({
 subscribers,
 plans,
 modules = [],
}: AdminSubscribersProps) {
 const [editing, setEditing] = useState<SubscriberRow | null>(null);

 const form = useForm<{
 plan_key: string;
 status: string;
 billing_cycle: string;
 module_ids: number[];
 }>({
 plan_key: '',
 status: 'active',
 billing_cycle: 'monthly',
 module_ids: [],
 });

 const openManage = (sub: SubscriberRow) => {
 setEditing(sub);
 const planKey = sub.plan_key || plans[0]?.key || 'growth';
 const foundPlan = plans.find((p) => p.key === planKey);
 const planModuleIds = foundPlan?.modules?.map((m) => m.id) ?? [];
 const coreModuleIds = modules.filter((m) => m.is_core).map((m) => m.id);
 const defaultModuleIds = Array.from(new Set([...coreModuleIds, ...planModuleIds]));
 const initialModuleIds = sub.enabled_module_ids && sub.enabled_module_ids.length > 0
 ? sub.enabled_module_ids
 : defaultModuleIds;

 form.setData({
 plan_key: planKey,
 status:
 sub.subscription_status === 'none'
 ? 'active'
 : sub.subscription_status,
 billing_cycle: sub.billing_cycle || 'monthly',
 module_ids: initialModuleIds,
 });
 };

 const handlePlanChange = (newPlanKey: string) => {
 const foundPlan = plans.find((p) => p.key === newPlanKey);
 const planModuleIds = foundPlan?.modules?.map((m) => m.id) ?? [];
 const coreModuleIds = modules.filter((m) => m.is_core).map((m) => m.id);
 const combined = Array.from(new Set([...coreModuleIds, ...planModuleIds]));

 form.setData((data) => ({
 ...data,
 plan_key: newPlanKey,
 module_ids: combined,
 }));
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!editing) return;
 form.patch(route('admin.subscribers.update', editing.id), {
 preserveScroll: true,
 onSuccess: () => setEditing(null),
 });
 };

 const columns: Column<SubscriberRow>[] = useMemo(
 () => [
 {
 id: 'name',
 label: 'Business Admin',
 sortable: true,
 render: (row) => (
 <div className="flex items-center gap-1.5 whitespace-nowrap">
 <span className="font-semibold text-slate-900 dark:text-slate-100">
 {row.name}
 </span>
 {row.business_name && (
 <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
 · {row.business_name}
 </span>
 )}
 </div>
 ),
 },
 {
 id: 'email',
 label: 'Contact',
 sortable: true,
 render: (row) => (
 <span className="text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
 {row.email}
 {row.phone ? ` · ${row.phone}` : ''}
 </span>
 ),
 },
 {
 id: 'plan_name',
 label: 'Plan',
 sortable: true,
 render: (row) => (
 <span className="text-[12px] whitespace-nowrap">
 <strong className="font-semibold text-slate-800 dark:text-slate-200">
 {row.plan_name}
 </strong>
 <span className="text-slate-400">
 {' '}
 · {row.billing_cycle} ({formatCurrency(row.amount, 'USD')})
 </span>
 </span>
 ),
 },
 {
 id: 'tenants_used',
 label: 'Tenants / Branches / Staff',
 render: (row) => (
 <div className="text-xs tabular-nums text-slate-700 dark:text-slate-300">
 <span className="font-semibold text-slate-900 dark:text-slate-100">
 {row.tenants_used}/{row.max_tenants >= 999 ? '∞' : row.max_tenants}
 </span>{' '}
 tenants ·{' '}
 <span className="font-semibold text-slate-900 dark:text-slate-100">
 {row.branches_used}/{row.max_branches >= 999 ? '∞' : row.max_branches}
 </span>{' '}
 branches ·{' '}
 <span className="font-semibold text-slate-900 dark:text-slate-100">
 {row.employees_used}/{row.max_users}
 </span>{' '}
 staff
 </div>
 ),
 },
 {
 id: 'ends_at',
 label: 'Renews / Expires',
 sortable: true,
 },
 {
 id: 'subscription_status',
 label: 'Status',
 sortable: true,
 render: (row) => (
 <StatusDot
 variant={
 row.subscription_status === 'active'
 ? 'emerald'
 : row.subscription_status === 'trialing'
 ? 'brand'
 : 'rose'
 }
 className="capitalize"
 >
 {row.subscription_status}
 </StatusDot>
 ),
 },
 ],
 []
 );

 const planOptions = plans.map((p) => ({
 id: p.key,
 value: p.key,
 name: `${p.name} ($${p.monthly_price}/mo · ${p.max_pharmacies} tenants)`,
 }));

 return (
 <AppLayout
 title="Subscribers & Business Accounts"
 subtitle="Super Admin — monitor every Business Admin's active plan, quota consumption, and billing status."
 >
 <DataTable<SubscriberRow>
 data={subscribers}
 columns={columns}
 tableId="admin-subscribers-table"
 selectable={false}
 hideCheckbox
 syncUrlParams={false}
 searchPlaceholder="Search business admin name, email, plan..."
 actions={(row) => (
 <TableActionMenu
 items={[
 {
 key: 'manage',
 label: 'Manage Plan & Quota',
 icon: <Edit className="h-3.5 w-3.5"/>,
 onClick: () => openManage(row),
 },
 ]}
 />
 )}
 emptyState={
 <EmptyState
 title="No subscriber admins registered yet"
 icon={Users}
 />
 }
 />

 <BrtaFormModal
 open={Boolean(editing)}
 onClose={() => setEditing(null)}
 onSubmit={handleSubmit}
 title={editing ? `Manage Subscription: ${editing.name}` : 'Manage Subscription'}
 subtitle="Update assigned SaaS plan, billing cycle, status, and module access"
 icon={<ShieldCheck className="h-4 w-4"/>}
 maxWidth="3xl"
 footerProps={{
 submitLabel: 'Apply Subscription',
 submitting: form.processing,
 }}
 >
 <BrtaFormGrid>
 <BrtaField label="Assigned Plan" required className="md:col-span-2">
 <select
 value={form.data.plan_key}
 onChange={(e) => handlePlanChange(String(e.target.value))}
 className={brtaInputClass}
 >
 {planOptions.map((opt) => (
 <option key={opt.id} value={opt.value}>
 {opt.name}
 </option>
 ))}
 </select>
 </BrtaField>

 <BrtaField label="Subscription Status" required>
 <select
 value={form.data.status}
 onChange={(e) => form.setData('status', String(e.target.value))}
 className={brtaInputClass}
 >
 <option value="active">Active</option>
 <option value="trialing">Trialing</option>
 <option value="suspended">Suspended</option>
 <option value="cancelled">Cancelled</option>
 </select>
 </BrtaField>

 <BrtaField label="Billing Cycle" required>
 <select
 value={form.data.billing_cycle}
 onChange={(e) => form.setData('billing_cycle', String(e.target.value))}
 className={brtaInputClass}
 >
 <option value="monthly">Monthly</option>
 <option value="annual">Annual</option>
 </select>
 </BrtaField>
 </BrtaFormGrid>

 {/* Direct Module & Feature Access Control */}
 <div className="space-y-2 pt-3 border-t border-[#E5E7EB] dark:border-slate-800">
 <div className="flex items-center justify-between">
 <div>
 <label className="text-[13px] font-bold text-[#333333] dark:text-slate-200">
 Feature & Module Privileges
 </label>
 <p className="text-[11px] text-[#666666] dark:text-slate-400">
 Control which modules are enabled for this pharmacy workspace.
 </p>
 </div>
 <span className="text-[11px] tabular-nums font-bold text-[#0E5F3F] bg-[#EAF5F0] dark:bg-emerald-950/40 border border-[#0E5F3F]/25 dark:border-emerald-900/50 px-2 py-0.5 rounded-[2px]">
 {form.data.module_ids.length} Active
 </span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F8FAF8] dark:bg-slate-900/30">
 {modules.map((mod) => {
 const isCore = Boolean(mod.is_core);
 const isChecked = isCore || form.data.module_ids.includes(mod.id);

 return (
 <label
 key={mod.id}
 className={`flex items-start gap-2 p-2 rounded-[2px] border text-xs cursor-pointer transition-colors ${
 isCore
 ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
 : isChecked
 ? 'bg-[#EAF5F0] dark:bg-emerald-950/30 border-[#0E5F3F]/50 text-[#222222] dark:text-slate-100'
 : 'bg-white dark:bg-[#181d25] border-[#CCCCCC] dark:border-slate-700 text-[#555555] dark:text-slate-400'
 }`}
 >
 <input
 type="checkbox"
 checked={isChecked}
 disabled={isCore}
 onChange={(e) => {
 if (isCore) return;
 const next = e.target.checked
 ? [...form.data.module_ids, mod.id]
 : form.data.module_ids.filter((id) => id !== mod.id);
 form.setData('module_ids', next);
 }}
 className="mt-0.5 rounded-[2px] text-[#0E5F3F] focus:ring-[#0E5F3F]"
 />
 <div className="flex-1 min-w-0">
 <div className="font-semibold truncate flex items-center gap-1.5">
 <span>{mod.name}</span>
 {isCore && (
 <span className="text-[9.5px] px-1 py-0.2 rounded-[2px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
 Core
 </span>
 )}
 </div>
 <div className="text-[10.5px] text-slate-400 font-mono">
 {mod.key}
 </div>
 </div>
 </label>
 );
 })}
 </div>
 </div>
 </BrtaFormModal>
 </AppLayout>
 );
}
