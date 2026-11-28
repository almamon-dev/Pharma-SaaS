import { useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock,
    FileSpreadsheet,
    Percent,
    RotateCcw,
    ShieldCheck,
    XCircle,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { BrtaFormModal } from '@/Components/ui/BrtaFormModal';
import { Button } from '@/Components/ui/Button';
import { formatCurrency } from '@/lib/format';

interface ApprovalRow {
    uid: string;
    entity_id: number;
    category: 'discount' | 'return' | 'voucher';
    category_label: string;
    reference: string;
    branch_name: string;
    branch_code: string;
    requested_by: string;
    party_name: string;
    amount: number;
    total_context: number;
    summary: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    sort_ts: number;
}

interface BranchOption {
    id: number;
    name: string;
    code: string;
}

interface ApprovalsPageProps {
    items: ApprovalRow[];
    stats: {
        pendingTotal: number;
        pendingDiscounts: number;
        pendingReturns: number;
        pendingVouchers: number;
        pendingValue: number;
        resolvedCount: number;
    };
    branches: BranchOption[];
    selectedBranchId: string;
    canFilterBranches: boolean;
    roleLevel: 'owner' | 'co_admin' | 'manager';
    currency: string;
}

type FilterTab = 'pending' | 'discount' | 'return' | 'voucher' | 'history';

export default function ApprovalsIndex({
    items = [],
    stats,
    branches = [],
    selectedBranchId = 'all',
    canFilterBranches = false,
    roleLevel = 'owner',
    currency = 'BDT',
}: ApprovalsPageProps) {
    const [activeTab, setActiveTab] = useState<FilterTab>('pending');
    const [processingUid, setProcessingUid] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<ApprovalRow | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const filteredItems = useMemo(() => {
        if (activeTab === 'pending') {
            return items.filter((item) => item.status === 'pending');
        }
        if (activeTab === 'history') {
            return items.filter((item) => item.status !== 'pending');
        }
        return items.filter((item) => item.category === activeTab);
    }, [items, activeTab]);

    const decideRouteFor = (row: ApprovalRow) => {
        if (row.category === 'discount') {
            return route('approvals.discounts.decide', row.entity_id);
        }
        if (row.category === 'return') {
            return route('approvals.returns.decide', row.entity_id);
        }
        return route('approvals.vouchers.decide', row.entity_id);
    };

    const handleApprove = (row: ApprovalRow) => {
        setProcessingUid(row.uid);
        router.post(
            decideRouteFor(row),
            { action: 'approve' },
            {
                preserveScroll: true,
                onFinish: () => setProcessingUid(null),
            }
        );
    };

    const submitReject = (e: React.FormEvent) => {
        e.preventDefault();
        if (!rejectTarget) return;
        setProcessingUid(rejectTarget.uid);
        router.post(
            decideRouteFor(rejectTarget),
            {
                action: 'reject',
                reason: rejectReason.trim() || 'Rejected by approver.',
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setRejectTarget(null);
                    setRejectReason('');
                },
                onFinish: () => setProcessingUid(null),
            }
        );
    };

    const handleBranchChange = (branchValue: string) => {
        router.get(
            route('approvals.index'),
            branchValue === 'all' ? {} : { branch_id: branchValue },
            { preserveState: true, preserveScroll: true }
        );
    };

    const columns = useMemo<Column<ApprovalRow>[]>(
        () => [
            {
                id: 'reference',
                label: 'Reference',
                sortable: true,
                render: (row) => (
                    <div>
                        <span className="font-bold tabular-nums text-[#0E5F3F] dark:text-emerald-400">
                            {row.reference}
                        </span>
                        <div className="text-[11px] text-slate-400">
                            {row.created_at}
                        </div>
                    </div>
                ),
            },
            {
                id: 'category_label',
                label: 'Type',
                sortable: true,
                render: (row) => {
                    const badgeStyle =
                        row.category === 'discount'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                            : row.category === 'return'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60'
                              : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60';
                    return (
                        <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-[2px] border text-[11px] font-semibold ${badgeStyle}`}
                        >
                            {row.category_label}
                        </span>
                    );
                },
            },
            {
                id: 'branch_name',
                label: 'Branch',
                sortable: true,
                render: (row) => (
                    <div className="text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {row.branch_name}
                        </span>
                        <span className="ml-1 text-[11px] text-slate-400 tabular-nums">
                            ({row.branch_code})
                        </span>
                    </div>
                ),
            },
            {
                id: 'summary',
                label: 'Details & Requester',
                render: (row) => (
                    <div className="max-w-[340px]">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                            {row.summary}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Requested by{' '}
                            <span className="font-semibold">
                                {row.requested_by}
                            </span>{' '}
                            · {row.party_name}
                        </p>
                    </div>
                ),
            },
            {
                id: 'amount',
                label: 'Impact Amount',
                sortable: true,
                className: 'text-right',
                render: (row) => (
                    <div className="text-right tabular-nums">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(row.amount, currency)}
                        </div>
                        {row.total_context > row.amount && (
                            <div className="text-[10.5px] text-slate-400">
                                Bill: {formatCurrency(row.total_context, currency)}
                            </div>
                        )}
                    </div>
                ),
            },
            {
                id: 'status',
                label: 'Status',
                sortable: true,
                render: (row) => {
                    if (row.status === 'approved') {
                        return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] dark:bg-emerald-950/40 dark:text-emerald-400 text-[11px] font-bold">
                                <CheckCircle2 className="h-3 w-3" />
                                Approved
                            </span>
                        );
                    }
                    if (row.status === 'rejected') {
                        return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-[11px] font-bold">
                                <XCircle className="h-3 w-3" />
                                Rejected
                            </span>
                        );
                    }
                    return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] font-bold">
                            <Clock className="h-3 w-3" />
                            Pending
                        </span>
                    );
                },
            },
            {
                id: 'actions',
                label: 'Action',
                className: 'text-right',
                render: (row) => {
                    if (row.status !== 'pending') {
                        return (
                            <span className="text-[11px] text-slate-400">
                                Decided
                            </span>
                        );
                    }
                    const busy = processingUid === row.uid;
                    return (
                        <div className="flex items-center justify-end gap-1.5">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleApprove(row)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] bg-[#0E5F3F] hover:bg-[#0B4D33] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Approve
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                    setRejectTarget(row);
                                    setRejectReason('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] border border-rose-200 dark:border-rose-800/70 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-600 hover:text-white text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                            </button>
                        </div>
                    );
                },
            },
        ],
        [currency, processingUid]
    );

    const subtitleText =
        roleLevel === 'owner'
            ? 'Company-wide high-value discounts, customer returns, and accounting vouchers'
            : roleLevel === 'co_admin'
              ? 'Operational discount, return, and voucher approvals across assigned branches'
              : 'Branch-level discount overrides, returns, and cash/voucher adjustments';

    const tabs: Array<{ id: FilterTab; label: string; count: number }> = [
        { id: 'pending', label: 'All Pending', count: stats.pendingTotal },
        {
            id: 'discount',
            label: 'Discount Overrides',
            count: stats.pendingDiscounts,
        },
        { id: 'return', label: 'Sales Returns', count: stats.pendingReturns },
        { id: 'voucher', label: 'Vouchers', count: stats.pendingVouchers },
        { id: 'history', label: 'Resolved History', count: stats.resolvedCount },
    ];

    return (
        <AppLayout
            title="Approvals Center"
            subtitle={subtitleText}
            actions={
                canFilterBranches ? (
                    <select
                        value={selectedBranchId}
                        onChange={(e) => handleBranchChange(e.target.value)}
                        className="h-8 rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#0E5F3F]"
                    >
                        <option value="all">All Assigned Branches</option>
                        {branches.map((b) => (
                            <option key={b.id} value={String(b.id)}>
                                {b.name} ({b.code})
                            </option>
                        ))}
                    </select>
                ) : undefined
            }
        >
            <div className="space-y-4">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                        title="Pending Approvals"
                        value={stats.pendingTotal}
                        description={`${formatCurrency(stats.pendingValue, currency)} awaiting decision`}
                        icon={ShieldCheck}
                        colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                        valueClassName={
                            stats.pendingTotal > 0 ? 'text-amber-600' : ''
                        }
                        onClick={() => setActiveTab('pending')}
                    />
                    <MetricCard
                        title="Discount Overrides"
                        value={stats.pendingDiscounts}
                        description="Orders exceeding role discount cap"
                        icon={Percent}
                        colorClass="bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 text-[#0E5F3F]"
                        onClick={() => setActiveTab('discount')}
                    />
                    <MetricCard
                        title="Return & Credit Notes"
                        value={stats.pendingReturns}
                        description="Customer medicine return requests"
                        icon={RotateCcw}
                        colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600"
                        onClick={() => setActiveTab('return')}
                    />
                    <MetricCard
                        title="Threshold Vouchers"
                        value={stats.pendingVouchers}
                        description="Accounting entries needing approval"
                        icon={FileSpreadsheet}
                        colorClass="bg-purple-50 dark:bg-purple-500/10 text-purple-600"
                        onClick={() => setActiveTab('voucher')}
                    />
                </div>

                {/* Filter Tabs + DataTable */}
                <div className="bg-white dark:bg-[#12161c] rounded-[2px] border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#161a22]">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs font-semibold transition-colors cursor-pointer ${
                                            isActive
                                                ? 'bg-[#0E5F3F] text-white'
                                                : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-[#0E5F3F] hover:text-[#0E5F3F]'
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                        <span
                                            className={`px-1.5 py-0.2 rounded-full text-[10.5px] tabular-nums font-bold ${
                                                isActive
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}
                                        >
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="[&_.border]:border-0 [&_.rounded-\[3px\]]:rounded-none">
                        <DataTable
                            data={filteredItems}
                            columns={columns}
                            rowKey="uid"
                            searchPlaceholder="Search by reference, requester, customer, or branch..."
                            selectable={false}
                            hideCheckbox={true}
                            hideViewToggle={true}
                            syncUrlParams={false}
                            emptyState={
                                <EmptyState
                                    title="No approvals waiting in this view"
                                    description="All discount overrides, sales returns, and voucher requests are caught up."
                                    icon={ShieldCheck}
                                />
                            }
                        />
                    </div>
                </div>
            </div>

            <BrtaFormModal
                isOpen={rejectTarget !== null}
                onClose={() => setRejectTarget(null)}
                title={`Reject ${rejectTarget?.category_label ?? 'Request'}`}
                subtitle={
                    rejectTarget
                        ? `${rejectTarget.reference} · ${formatCurrency(rejectTarget.amount, currency)}`
                        : ''
                }
                maxWidth="md"
            >
                <form onSubmit={submitReject} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Rejection Reason
                        </label>
                        <textarea
                            rows={3}
                            required
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Provide a brief operational reason for rejecting this request..."
                            className="w-full rounded-[2px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setRejectTarget(null)}
                            className="px-3 py-1.5 rounded-[2px] border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <Button
                            type="submit"
                            variant="danger"
                            size="sm"
                            disabled={processingUid !== null}
                        >
                            Confirm Reject
                        </Button>
                    </div>
                </form>
            </BrtaFormModal>
        </AppLayout>
    );
}

