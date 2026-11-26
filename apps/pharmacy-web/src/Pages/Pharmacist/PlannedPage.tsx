import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, ClipboardList, Lock, ShieldCheck } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import PharmacistMobileNav from './components/PharmacistMobileNav';
import { PharmacistAuditItem, PharmacistBranchContext } from './types';

interface PlannedPageProps {
    context: PharmacistBranchContext;
    page: {
        key: string;
        title: string;
        subtitle: string;
        planned_items: string[];
    };
    purchaseRequests: Array<{
        medicine_name: string;
        requested_qty: number;
        requested_by: string;
        requested_at: string;
    }>;
    recentAuditLogs: PharmacistAuditItem[];
}

export default function PharmacistPlannedPage({
    context,
    page,
    purchaseRequests,
    recentAuditLogs,
}: PlannedPageProps) {
    return (
        <AppLayout title={page.title}>
            <Head title={page.title} />
            <PharmacistMobileNav />

            <div className="w-full space-y-4">
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                                {page.title}
                            </h1>
                            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Planned Module
                            </span>
                        </div>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-1">
                            {page.subtitle}
                        </p>
                        <p className="text-[11.5px] text-[#666666] dark:text-slate-500 mt-0.5">
                            {context.branch_name} (<span className="font-mono">{context.branch_code}</span>) • {context.tenant_name} • {context.today_display}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Link href={route('dashboard')}>
                            <Button size="sm" variant="outline">
                                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                                Dashboard
                            </Button>
                        </Link>
                        <Link href={route('pharmacist.prescriptions')}>
                            <Button size="sm" variant="default">
                                Prescription Queue
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Planned Scope Card */}
                    <div className="lg:col-span-8 bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-[#0E5F3F]" />
                            <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                What this module will contain
                            </h2>
                        </div>
                        <div className="p-4 space-y-2.5">
                            {page.planned_items.map((item, index) => (
                                <div
                                    key={index}
                                    className="flex items-start gap-2.5 p-2.5 rounded-[2px] border border-slate-200/80 dark:border-slate-800 bg-[#fafbfa] dark:bg-[#161a22]/60 text-[13px] text-[#333333] dark:text-slate-200"
                                >
                                    <CheckCircle2 className="w-4 h-4 text-[#0E5F3F] dark:text-emerald-400 shrink-0 mt-0.5" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pharmacist Compliance Rules Card */}
                    <div className="lg:col-span-4 bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-[#0E5F3F]" />
                            <h2 className="text-[14px] font-bold text-[#222222] dark:text-white">
                                Active role safeguards
                            </h2>
                        </div>
                        <div className="p-4 space-y-2.5 text-[12.5px] text-[#444444] dark:text-slate-300">
                            <div className="flex items-start gap-2">
                                <Lock className="w-3.5 h-3.5 text-[#0E5F3F] shrink-0 mt-0.5" />
                                <span>Expired batches are blocked automatically from dispensing.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Lock className="w-3.5 h-3.5 text-[#0E5F3F] shrink-0 mt-0.5" />
                                <span>Every dispense writes an immutable audit log (who, when, batch).</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Lock className="w-3.5 h-3.5 text-[#0E5F3F] shrink-0 mt-0.5" />
                                <span>Controlled drugs enforce an extra confirmation & register serial #.</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Lock className="w-3.5 h-3.5 text-[#0E5F3F] shrink-0 mt-0.5" />
                                <span>Sales totals, income, accounting, HR/salary, purchase cost, profit, and other branches stay hidden.</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Live Submitted Purchase Requests (shown on Purchase Request page) */}
                {page.key === 'purchase-requests' && purchaseRequests.length > 0 && (
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] font-bold text-[13.5px] text-[#222222] dark:text-white">
                            Submitted purchase requests in this shift ({purchaseRequests.length})
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {purchaseRequests.map((req, idx) => (
                                <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-[13px]">
                                    <div>
                                        <span className="font-semibold text-[#222222] dark:text-white">{req.medicine_name}</span>
                                        <span className="text-[#555555] dark:text-slate-400 ml-2">
                                            Requested qty: <strong className="font-mono">{req.requested_qty}</strong>
                                        </span>
                                    </div>
                                    <span className="font-mono text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {req.requested_by} · {req.requested_at}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Immutable Audit Logs */}
                {recentAuditLogs.length > 0 && (
                    <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] font-bold text-[13.5px] text-[#222222] dark:text-white">
                            Recent branch clinical audit trail
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {recentAuditLogs.map((log) => (
                                <div key={log.id} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[12.5px]">
                                    <span className="text-[#222222] dark:text-slate-200">
                                        <strong className="text-[#0E5F3F] dark:text-emerald-400 mr-1.5">{log.user_name}:</strong>
                                        {log.description}
                                    </span>
                                    <span className="font-mono text-[11px] text-[#666666] dark:text-slate-400 shrink-0">
                                        {log.created_at}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
