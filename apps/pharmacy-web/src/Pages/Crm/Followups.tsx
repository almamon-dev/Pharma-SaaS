import React, { useMemo, useState } from 'react';
import { Link, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    BellRing,
    Calendar,
    CheckCircle2,
    GitBranch,
    PhoneCall,
    Plus,
    Trash2,
    Users,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { Button } from '@/Components/ui/Button';
import { Badge } from '@/Components/ui/Badge';
import Select from '@/Components/ui/select';
import {
    BrtaField,
    BrtaFormGrid,
    BrtaFormModal,
    brtaInputClass,
    brtaTextareaClass,
} from '@/Components/ui/BrtaForm';
import {
    Column,
    DataTable,
    EmptyState,
    TableActionMenu,
} from '@/Components/tables';

interface BranchOption {
    id: number;
    name: string;
}

interface CustomerOption {
    id: number;
    branch_id?: number | null;
    name: string;
    phone?: string | null;
}

interface StaffOption {
    id: number;
    name: string;
}

interface FollowupRow {
    id: number;
    customer_id: number;
    customer_name: string;
    customer_phone?: string | null;
    customer_segment: string;
    branch_id?: number | null;
    branch_name: string;
    assigned_to?: number | null;
    assignee_name: string;
    followup_type: 'refill_reminder' | 'due_followup' | 'health_check' | 'general';
    title: string;
    medicines_summary?: string | null;
    due_date: string;
    is_overdue: boolean;
    is_today: boolean;
    channel: 'phone' | 'sms' | 'whatsapp' | 'in_person';
    status: 'pending' | 'contacted' | 'completed' | 'cancelled';
    notes?: string | null;
    outcome_notes?: string | null;
    completed_at?: string | null;
}

interface FollowupsProps {
    followups: FollowupRow[];
    customers: CustomerOption[];
    branches: BranchOption[];
    staffUsers: StaffOption[];
    selectedBranchId: number | null;
    tenantName?: string | null;
    summary: {
        overdue: number;
        due_today: number;
        open_total: number;
        completed: number;
    };
}

const TYPE_LABELS: Record<string, string> = {
    refill_reminder: 'Medicine Refill',
    due_followup: 'Due Collection',
    health_check: 'Health Check',
    general: 'General',
};

export default function CrmFollowups({
    followups,
    customers,
    branches,
    staffUsers,
    selectedBranchId,
    tenantName,
    summary,
}: FollowupsProps) {
    const [tab, setTab] = useState('open');
    const [showModal, setShowModal] = useState(false);

    const today = new Date().toISOString().slice(0, 10);
    const form = useForm({
        customer_id: customers[0] ? String(customers[0].id) : '',
        branch_id: selectedBranchId ? String(selectedBranchId) : branches[0] ? String(branches[0].id) : '',
        assigned_to: staffUsers[0] ? String(staffUsers[0].id) : '',
        followup_type: 'refill_reminder',
        title: '',
        medicines_summary: '',
        due_date: today,
        channel: 'phone',
        notes: '',
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(route('crm.followups.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setShowModal(false);
                form.reset('title', 'medicines_summary', 'notes');
            },
        });
    };

    const updateStatus = (row: FollowupRow, status: 'contacted' | 'completed' | 'pending') => {
        router.patch(
            route('crm.followups.status', row.id),
            { status },
            { preserveScroll: true }
        );
    };

    const filteredRows = useMemo(() => {
        if (tab === 'all') return followups;
        if (tab === 'overdue') return followups.filter((f) => f.is_overdue);
        if (tab === 'today') return followups.filter((f) => f.is_today);
        if (tab === 'open') return followups.filter((f) => ['pending', 'contacted'].includes(f.status));
        return followups.filter((f) => f.status === 'completed');
    }, [followups, tab]);

    const columns: Column<FollowupRow>[] = useMemo(
        () => [
            {
                id: 'customer_name',
                label: 'Patient / Customer',
                sortable: true,
                render: (row) => (
                    <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {row.customer_name}
                        </div>
                        <div className="text-[11.5px] text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
                            <span>{row.customer_phone || 'No phone'}</span>
                            <span>·</span>
                            <GitBranch className="h-3 w-3 text-[#0E5F3F]" />
                            <span>{row.branch_name}</span>
                        </div>
                    </div>
                ),
            },
            {
                id: 'title',
                label: 'Reminder & Medicines',
                sortable: true,
                render: (row) => (
                    <div className="max-w-[280px]">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {row.title}
                        </div>
                        <div className="text-[11.5px] text-slate-500 truncate">
                            {row.medicines_summary || row.notes || '—'}
                        </div>
                    </div>
                ),
            },
            {
                id: 'followup_type',
                label: 'Type & Channel',
                render: (row) => (
                    <div className="whitespace-nowrap">
                        <Badge
                            variant={
                                row.followup_type === 'refill_reminder'
                                    ? 'sky'
                                    : row.followup_type === 'due_followup'
                                      ? 'amber'
                                      : 'slate'
                            }
                        >
                            {TYPE_LABELS[row.followup_type] ?? row.followup_type}
                        </Badge>
                        <div className="text-[11px] text-slate-500 mt-0.5 capitalize">
                            via {row.channel} · {row.assignee_name}
                        </div>
                    </div>
                ),
            },
            {
                id: 'due_date',
                label: 'Due Date',
                sortable: true,
                render: (row) => (
                    <div className="whitespace-nowrap">
                        <div
                            className={`font-mono text-[12px] font-semibold ${
                                row.is_overdue
                                    ? 'text-rose-600'
                                    : row.is_today
                                      ? 'text-amber-600'
                                      : 'text-slate-700 dark:text-slate-300'
                            }`}
                        >
                            {row.due_date}
                        </div>
                        {row.is_overdue && (
                            <span className="text-[10.5px] font-semibold text-rose-600">Overdue</span>
                        )}
                        {row.is_today && (
                            <span className="text-[10.5px] font-semibold text-amber-600">Due Today</span>
                        )}
                    </div>
                ),
            },
            {
                id: 'status',
                label: 'Status',
                sortable: true,
                render: (row) => (
                    <Badge
                        variant={
                            row.status === 'completed'
                                ? 'success'
                                : row.status === 'contacted'
                                  ? 'sky'
                                  : row.status === 'cancelled'
                                    ? 'slate'
                                    : 'amber'
                        }
                    >
                        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </Badge>
                ),
            },
        ],
        []
    );

    const branchOptions = [
        { value: 'all', label: 'All Branches' },
        ...branches.map((b) => ({ value: String(b.id), label: b.name })),
    ];

    return (
        <AppLayout
            title="Medicine Refills & Patient Follow-ups"
            subtitle={`Never miss a chronic medicine refill or credit due follow-up call across branches of ${tenantName ?? 'your pharmacy'}`}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <div className="w-44">
                        <Select
                            value={selectedBranchId ? String(selectedBranchId) : 'all'}
                            onChange={(val) =>
                                router.get(
                                    route('crm.followups'),
                                    String(val) === 'all' ? {} : { branch_id: String(val) },
                                    { preserveState: true, preserveScroll: true }
                                )
                            }
                            options={branchOptions}
                            size="sm"
                        />
                    </div>
                    <Link href={route('crm.customers')}>
                        <Button size="md" variant="secondary">
                            <Users className="h-3.5 w-3.5" />
                            Customers
                        </Button>
                    </Link>
                    <Button size="md" variant="primary" onClick={() => setShowModal(true)}>
                        <Plus className="h-3.5 w-3.5" />
                        Schedule Reminder
                    </Button>
                </div>
            }
        >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <MetricCard
                    title="Overdue Calls"
                    value={summary.overdue}
                    description="Need immediate follow-up"
                    icon={AlertCircle}
                    colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                />
                <MetricCard
                    title="Due Today"
                    value={summary.due_today}
                    description="Scheduled for today"
                    icon={Calendar}
                    colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                />
                <MetricCard
                    title="Total Open"
                    value={summary.open_total}
                    description="Pending + Contacted"
                    icon={BellRing}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
                <MetricCard
                    title="Completed"
                    value={summary.completed}
                    description="Refills & calls closed"
                    icon={CheckCircle2}
                    colorClass="bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 text-[#0E5F3F]"
                />
            </div>

            <DataTable<FollowupRow>
                data={filteredRows}
                columns={columns}
                tableId="crm-followups-table"
                selectable={false}
                hideCheckbox
                syncUrlParams={false}
                searchPlaceholder="Search patient name, phone, medicine, branch..."
                headerTabs={
                    <div className="flex items-center gap-1 overflow-x-auto">
                        {[
                            { key: 'open', label: 'Open Queue', count: summary.open_total },
                            { key: 'overdue', label: 'Overdue', count: summary.overdue },
                            { key: 'today', label: 'Due Today', count: summary.due_today },
                            { key: 'completed', label: 'Completed', count: summary.completed },
                            { key: 'all', label: 'All', count: followups.length },
                        ].map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                                    tab === t.key
                                        ? 'border-[#0E5F3F] text-[#0E5F3F] font-semibold'
                                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                <span>{t.label}</span>
                                <span className={`px-1.5 py-0.5 text-[11px] rounded-full font-mono ${tab === t.key ? 'bg-[#EAF5F0] text-[#0E5F3F]' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    {t.count}
                                </span>
                            </button>
                        ))}
                    </div>
                }
                actions={(row) => (
                    <TableActionMenu
                        items={[
                            ...(row.status !== 'contacted' && row.status !== 'completed'
                                ? [
                                      {
                                          key: 'contacted',
                                          label: 'Mark Contacted',
                                          icon: <PhoneCall className="h-3.5 w-3.5 text-sky-600" />,
                                          onClick: () => updateStatus(row, 'contacted'),
                                      },
                                  ]
                                : []),
                            ...(row.status !== 'completed'
                                ? [
                                      {
                                          key: 'completed',
                                          label: 'Mark Completed',
                                          icon: <CheckCircle2 className="h-3.5 w-3.5 text-[#0E5F3F]" />,
                                          onClick: () => updateStatus(row, 'completed'),
                                      },
                                  ]
                                : []),
                            {
                                key: 'delete',
                                label: 'Delete Reminder',
                                icon: <Trash2 className="h-3.5 w-3.5 text-rose-600" />,
                                onClick: () =>
                                    router.delete(route('crm.followups.destroy', row.id), {
                                        preserveScroll: true,
                                    }),
                            },
                        ]}
                    />
                )}
                emptyState={
                    <EmptyState
                        title="No follow-up reminders in this view"
                        description="Schedule medicine refill reminders or due collection calls for chronic and credit customers."
                        icon={BellRing}
                    />
                }
            />

            <BrtaFormModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={handleCreate}
                title="Schedule Patient Refill / Follow-up"
                icon={<BellRing className="h-4 w-4" />}
                maxWidth="3xl"
                footerProps={{
                    cancelLabel: 'Cancel',
                    submitLabel: 'Save Reminder',
                    submitting: form.processing,
                }}
            >
                <BrtaFormGrid>
                    <BrtaField label="Patient / Customer" required error={form.errors.customer_id}>
                        <Select
                            value={form.data.customer_id}
                            onChange={(val) => form.setData('customer_id', String(val))}
                            options={customers.map((c) => ({
                                value: String(c.id),
                                label: c.phone ? `${c.name} (${c.phone})` : c.name,
                            }))}
                            placeholder="Select Customer"
                            showSearch
                        />
                    </BrtaField>
                    <BrtaField label="Branch">
                        <Select
                            value={form.data.branch_id}
                            onChange={(val) => form.setData('branch_id', String(val))}
                            options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
                        />
                    </BrtaField>
                    <BrtaField label="Reminder Type" required>
                        <Select
                            value={form.data.followup_type}
                            onChange={(val) => form.setData('followup_type', String(val))}
                            options={[
                                { value: 'refill_reminder', label: 'Medicine Refill Reminder' },
                                { value: 'due_followup', label: 'Credit Due Collection' },
                                { value: 'health_check', label: 'Post-Course Health Check' },
                                { value: 'general', label: 'General Follow-up' },
                            ]}
                        />
                    </BrtaField>
                    <BrtaField label="Due Date" required error={form.errors.due_date}>
                        <input
                            type="date"
                            required
                            value={form.data.due_date}
                            onChange={(e) => form.setData('due_date', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Contact Channel" required>
                        <Select
                            value={form.data.channel}
                            onChange={(val) => form.setData('channel', String(val))}
                            options={[
                                { value: 'phone', label: 'Phone Call' },
                                { value: 'whatsapp', label: 'WhatsApp' },
                                { value: 'sms', label: 'SMS' },
                                { value: 'in_person', label: 'In-Person Visit' },
                            ]}
                        />
                    </BrtaField>
                    <BrtaField label="Assign To Staff">
                        <Select
                            value={form.data.assigned_to}
                            onChange={(val) => form.setData('assigned_to', String(val))}
                            options={[
                                { value: '', label: 'Unassigned' },
                                ...staffUsers.map((u) => ({ value: String(u.id), label: u.name })),
                            ]}
                        />
                    </BrtaField>
                </BrtaFormGrid>
                <BrtaField label="Reminder Title" required error={form.errors.title}>
                    <input
                        required
                        placeholder="e.g. 30-day BP & Diabetes Medicine Refill"
                        value={form.data.title}
                        onChange={(e) => form.setData('title', e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
                <BrtaField label="Medicines (Optional)">
                    <input
                        placeholder="e.g. Camlosart 5/20mg (30 pcs), Comet 500mg (60 pcs)"
                        value={form.data.medicines_summary}
                        onChange={(e) => form.setData('medicines_summary', e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
                <BrtaField label="Notes" alignTop>
                    <textarea
                        rows={2}
                        value={form.data.notes}
                        onChange={(e) => form.setData('notes', e.target.value)}
                        placeholder="Delivery preference or reminder instructions..."
                        className={brtaTextareaClass}
                    />
                </BrtaField>
            </BrtaFormModal>
        </AppLayout>
    );
}
