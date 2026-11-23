import React, { useMemo, useState } from 'react';
import { useForm, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Edit,
    Eye,
    History,
    Key,
    Plus,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    UserCheck,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { MetricCard } from '@/Components/cards/MetricCard';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { DataTable, Column, EmptyState } from '@/Components/tables';

interface UserOverride {
    id: number;
    permission_key: string;
    effect: 'allow' | 'deny';
    scope?: string | null;
    expires_at?: string | null;
    reason?: string | null;
    is_expired: boolean;
}

interface TeamMember {
    id: number;
    user_id: number;
    tenant_id: number;
    name: string;
    email: string;
    phone?: string | null;
    role_id: number | null;
    role_name: string;
    role_slug: string;
    branch_id: number | null;
    branch_ids: number[];
    access_all_branches: boolean;
    has_pin: boolean;
    is_active: boolean;
    is_owner: boolean;
    joined_at: string;
    overrides: UserOverride[];
}

interface RoleItem {
    id: number;
    name: string;
    slug: string;
    description: string;
    is_system: boolean;
    is_locked: boolean;
    sort: number;
    permissions: Record<string, string>; // permission_key => scope ('all', 'branch', 'own')
    limits: Record<string, number | null>;
}

interface PermissionCatalogItem {
    key: string;
    name: string;
    module: string;
    action: string;
    description: string;
    is_sensitive: boolean;
    requires_feature: string | null;
    supports_scope: boolean;
}

interface BranchItem {
    id: number;
    tenant_id: number;
    name: string;
    code: string;
}

interface AuditLogItem {
    id: number;
    action: string;
    description: string;
    user_id?: number | null;
    created_at: string;
}

interface TeamProps {
    members: TeamMember[];
    roles: RoleItem[];
    permissionsCatalog: Record<string, PermissionCatalogItem[]>;
    branches: BranchItem[];
    activityLog: AuditLogItem[];
    currentTenantId: number;
    isOwner: boolean;
    canManageRoles: boolean;
}

export default function TeamIndex({
    members,
    roles,
    permissionsCatalog,
    branches,
    activityLog,
    canManageRoles,
}: TeamProps) {
    const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'activity'>('users');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [inspectingUser, setInspectingUser] = useState<TeamMember | null>(null);
    const [pinModalUser, setPinModalUser] = useState<TeamMember | null>(null);
    const [overrideModalUser, setOverrideModalUser] = useState<TeamMember | null>(null);
    const [editingRoleLimits, setEditingRoleLimits] = useState<RoleItem | null>(null);
    const [showNewRoleModal, setShowNewRoleModal] = useState(false);

    // Add User Form
    const addForm = useForm({
        name: '',
        email: '',
        phone: '',
        role_id: roles[3]?.id ?? roles[0]?.id ?? '',
        branch_ids: [] as number[],
        access_all_branches: false,
        manager_pin: '',
        password: '',
    });

    // Edit Member Form
    const editForm = useForm({
        role_id: 0,
        branch_ids: [] as number[],
        access_all_branches: false,
        is_active: true,
        manager_pin: '',
    });

    // PIN Form
    const pinForm = useForm({
        pin: '',
    });

    // Override Form
    const overrideForm = useForm({
        permission_key: '',
        effect: 'allow' as 'allow' | 'deny',
        scope: 'all',
        expires_at: '',
        reason: '',
    });

    // Limits Form
    const limitsForm = useForm({
        discount_percent: '' as string | number,
        max_refund_amount: '' as string | number,
        max_void_amount: '' as string | number,
        max_voucher_amount: '' as string | number,
        max_stock_adjust_value: '' as string | number,
        backdate_hours: '' as string | number,
        void_window_hours: '' as string | number,
    });

    // New Role Form
    const newRoleForm = useForm({
        name: '',
        description: '',
        permissions: [] as string[],
        scopes: {} as Record<string, string>,
    });

    const openEdit = (member: TeamMember) => {
        setEditingMember(member);
        editForm.setData({
            role_id: member.role_id ?? roles[0]?.id ?? 0,
            branch_ids: member.branch_ids,
            access_all_branches: member.access_all_branches,
            is_active: member.is_active,
            manager_pin: '',
        });
    };

    const openLimitsEditor = (role: RoleItem) => {
        setEditingRoleLimits(role);
        limitsForm.setData({
            discount_percent: role.limits['discount_percent'] ?? '',
            max_refund_amount: role.limits['max_refund_amount'] ?? '',
            max_void_amount: role.limits['max_void_amount'] ?? '',
            max_voucher_amount: role.limits['max_voucher_amount'] ?? '',
            max_stock_adjust_value: role.limits['max_stock_adjust_value'] ?? '',
            backdate_hours: role.limits['backdate_hours'] ?? '',
            void_window_hours: role.limits['void_window_hours'] ?? '',
        });
    };

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        addForm.post(route('team.store'), {
            preserveScroll: true,
            onSuccess: () => {
                addForm.reset();
                setShowAddModal(false);
            },
        });
    };

    const handleUpdateMember = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMember) return;
        editForm.put(route('team.memberships.update', editingMember.id), {
            preserveScroll: true,
            onSuccess: () => setEditingMember(null),
        });
    };

    const handleSetPin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!pinModalUser) return;
        pinForm.post(route('team.users.pin', pinModalUser.user_id), {
            preserveScroll: true,
            onSuccess: () => {
                pinForm.reset();
                setPinModalUser(null);
            },
        });
    };

    const handleSaveOverride = (e: React.FormEvent) => {
        e.preventDefault();
        if (!overrideModalUser) return;
        overrideForm.post(route('team.users.overrides.store', overrideModalUser.user_id), {
            preserveScroll: true,
            onSuccess: () => {
                overrideForm.reset();
                setOverrideModalUser(null);
            },
        });
    };

    const handleDeleteOverride = (overrideId: number) => {
        if (!confirm('Are you sure you want to remove this permission override?')) return;
        router.delete(route('team.overrides.delete', overrideId), { preserveScroll: true });
    };

    const handleSaveLimits = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRoleLimits) return;
        limitsForm.put(route('team.roles.limits.update', editingRoleLimits.id), {
            preserveScroll: true,
            onSuccess: () => setEditingRoleLimits(null),
        });
    };

    const handleCreateRole = (e: React.FormEvent) => {
        e.preventDefault();
        newRoleForm.post(route('team.roles.store'), {
            preserveScroll: true,
            onSuccess: () => {
                newRoleForm.reset();
                setShowNewRoleModal(false);
            },
        });
    };

    const userColumns: Column<TeamMember>[] = useMemo(
        () => [
            {
                id: 'name',
                label: 'Employee',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-[#FF4A1F] text-xs font-bold border border-orange-500/20">
                            {row.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                <span>{row.name}</span>
                                {row.is_owner && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-[#FF4A1F]/10 text-[#FF4A1F] border border-[#FF4A1F]/30">
                                        Owner
                                    </span>
                                )}
                            </div>
                            <div className="text-[11px] text-slate-400">{row.email}</div>
                        </div>
                    </div>
                ),
            },
            {
                id: 'role_name',
                label: 'System Role',
                sortable: true,
                render: (row) => (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                        <Shield className="w-3.5 h-3.5 text-orange-500" />
                        {row.role_name}
                    </span>
                ),
            },
            {
                id: 'branches',
                label: 'Branch Scope',
                render: (row) => (
                    <div className="text-xs">
                        {row.access_all_branches ? (
                            <span className="text-emerald-500 font-medium">All Branches</span>
                        ) : row.branch_ids.length > 0 ? (
                            <span className="text-slate-600 dark:text-slate-300">
                                {row.branch_ids.length} branch(es) assigned
                            </span>
                        ) : (
                            <span className="text-slate-400">Head Office</span>
                        )}
                    </div>
                ),
            },
            {
                id: 'security',
                label: 'Security & PIN',
                render: (row) => (
                    <div className="flex items-center gap-1.5 text-xs">
                        {row.has_pin ? (
                            <span className="text-emerald-500 flex items-center gap-1">
                                <Key className="w-3 h-3" /> PIN active
                            </span>
                        ) : (
                            <span className="text-slate-400 flex items-center gap-1">
                                <Key className="w-3 h-3" /> No PIN
                            </span>
                        )}
                        {row.overrides.length > 0 && (
                            <span className="px-1.5 py-0.2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[10px] font-bold">
                                {row.overrides.length} override(s)
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'is_active',
                label: 'Status',
                render: (row) => (
                    <StatusDot variant={row.is_active ? 'emerald' : 'slate'}>
                        {row.is_active ? 'Active' : 'Suspended'}
                    </StatusDot>
                ),
            },
            {
                id: 'actions',
                label: 'Actions',
                align: 'right',
                render: (row) => (
                    <div className="flex items-center justify-end gap-1">
                        <button
                            type="button"
                            onClick={() => setInspectingUser(row)}
                            title="Inspect effective permissions"
                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPinModalUser(row);
                                pinForm.reset();
                            }}
                            title="Set Manager PIN"
                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-400"
                        >
                            <Key className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setOverrideModalUser(row);
                                overrideForm.reset();
                            }}
                            title="Add permission override"
                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-purple-400"
                        >
                            <ShieldAlert className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => openEdit(row)}
                            title="Edit Role & Branches"
                            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                    </div>
                ),
            },
        ],
        [roles]
    );

    return (
        <AppLayout title="Employees & Roles">
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                            <Users className="w-6 h-6 text-[#FF4A1F]" />
                            Employees & Roles (RBAC)
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Manage pharmacy staff, data scopes (own/branch/all), operating limits and audit trail.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {canManageRoles && (
                            <Button
                                variant="secondary"
                                onClick={() => setShowNewRoleModal(true)}
                                className="gap-1.5 text-xs"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Custom Role
                            </Button>
                        )}
                        <Button
                            onClick={() => setShowAddModal(true)}
                            className="bg-[#FF4A1F] hover:bg-[#e03e15] text-white gap-1.5 text-xs"
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            Add Employee
                        </Button>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <MetricCard
                        title="Total Employees"
                        value={members.length}
                        icon={Users}
                        colorClass="bg-orange-500/10 text-orange-400"
                    />
                    <MetricCard
                        title="Active Staff"
                        value={members.filter((m) => m.is_active).length}
                        icon={UserCheck}
                        colorClass="bg-emerald-500/10 text-emerald-400"
                    />
                    <MetricCard
                        title="System Roles"
                        value={roles.length}
                        icon={ShieldCheck}
                        colorClass="bg-amber-500/10 text-amber-400"
                    />
                    <MetricCard
                        title="PIN Enabled"
                        value={members.filter((m) => m.has_pin).length}
                        icon={Key}
                        colorClass="bg-blue-500/10 text-blue-400"
                    />
                </div>

                {/* Navigation Tabs */}
                <div className="border-b border-slate-200 dark:border-slate-800 flex gap-6 text-sm font-medium">
                    <button
                        type="button"
                        onClick={() => setActiveTab('users')}
                        className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'users'
                                ? 'border-[#FF4A1F] text-[#FF4A1F] font-bold'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <Users className="w-4 h-4" />
                        Users & Staff ({members.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('matrix')}
                        className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'matrix'
                                ? 'border-[#FF4A1F] text-[#FF4A1F] font-bold'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <Shield className="w-4 h-4" />
                        Roles Matrix & Operating Limits
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('activity')}
                        className={`pb-3 px-1 border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'activity'
                                ? 'border-[#FF4A1F] text-[#FF4A1F] font-bold'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <History className="w-4 h-4" />
                        Activity Log ({activityLog.length})
                    </button>
                </div>

                {/* Tab 1: Users */}
                {activeTab === 'users' && (
                    <div className="bg-white dark:bg-[#12161c] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <DataTable
                            columns={userColumns}
                            data={members}
                            emptyState={
                                <EmptyState
                                    icon={Users}
                                    title="No employees found"
                                    description="Onboard pharmacists and cashiers to manage operations."
                                />
                            }
                        />
                    </div>
                )}

                {/* Tab 2: Roles Matrix */}
                {activeTab === 'matrix' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {roles.map((r) => (
                                <div
                                    key={r.id}
                                    className="bg-white dark:bg-[#12161c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                                                <Shield className="w-4 h-4 text-[#FF4A1F]" />
                                                {r.name}
                                            </span>
                                            {r.is_locked ? (
                                                <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-bold">
                                                    Locked
                                                </span>
                                            ) : (
                                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                                                    System
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                                            {r.description}
                                        </p>

                                        {/* Limits Preview */}
                                        <div className="bg-slate-900/60 rounded-lg p-2.5 text-[11px] space-y-1 mb-3">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Discount Cap:</span>
                                                <span className="font-mono font-bold text-white">
                                                    {r.limits['discount_percent'] !== null && r.limits['discount_percent'] !== undefined
                                                        ? `${r.limits['discount_percent']}%`
                                                        : 'Unlimited'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Max Refund:</span>
                                                <span className="font-mono font-bold text-white">
                                                    {r.limits['max_refund_amount'] !== null && r.limits['max_refund_amount'] !== undefined
                                                        ? `৳${r.limits['max_refund_amount']}`
                                                        : 'Unlimited'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Void Window:</span>
                                                <span className="font-mono font-bold text-white">
                                                    {r.limits['void_window_hours'] !== null && r.limits['void_window_hours'] !== undefined
                                                        ? `${r.limits['void_window_hours']} hrs`
                                                        : 'Unlimited'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                                        <span>{Object.keys(r.permissions).length} permissions</span>
                                        {!r.is_locked && canManageRoles && (
                                            <button
                                                type="button"
                                                onClick={() => openLimitsEditor(r)}
                                                className="text-[#FF4A1F] hover:underline font-bold"
                                            >
                                                Configure Limits →
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Full Permissions Breakdown Table */}
                        <div className="bg-white dark:bg-[#12161c] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                Master RBAC Permissions Matrix
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase font-semibold">
                                        <tr>
                                            <th className="py-2.5 px-3">Permission Group / Action</th>
                                            <th className="py-2.5 px-3">Feature Req.</th>
                                            {roles.map((r) => (
                                                <th key={r.id} className="py-2.5 px-2 text-center">
                                                    {r.name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {Object.entries(permissionsCatalog).map(([moduleName, items]) => (
                                            <React.Fragment key={moduleName}>
                                                <tr className="bg-slate-900/40">
                                                    <td
                                                        colSpan={2 + roles.length}
                                                        className="py-1.5 px-3 font-bold text-orange-400 uppercase tracking-wider text-[11px]"
                                                    >
                                                        {moduleName}
                                                    </td>
                                                </tr>
                                                {items.map((perm) => (
                                                    <tr key={perm.key} className="hover:bg-slate-800/30">
                                                        <td className="py-2 px-3">
                                                            <div className="flex items-center gap-1.5">
                                                                {perm.is_sensitive && (
                                                                    <span title="Sensitive permission - audited">
                                                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                                    </span>
                                                                )}
                                                                <span className="font-mono font-semibold text-slate-200">
                                                                    {perm.key}
                                                                </span>
                                                            </div>
                                                            <div className="text-[11px] text-slate-400">
                                                                {perm.description}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                                                            {perm.requires_feature ? (
                                                                <span className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">
                                                                    {perm.requires_feature}
                                                                </span>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </td>
                                                        {roles.map((r) => {
                                                            const scope = r.permissions[perm.key];
                                                            return (
                                                                <td key={r.id} className="py-2 px-2 text-center">
                                                                    {scope ? (
                                                                        <span
                                                                            className={`inline-block px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                                                                                scope === 'all'
                                                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                                                                    : scope === 'branch'
                                                                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                                                                    : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                                                                            }`}
                                                                        >
                                                                            {scope}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-600">—</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 3: Activity Log */}
                {activeTab === 'activity' && (
                    <div className="bg-white dark:bg-[#12161c] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
                        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                            <History className="w-5 h-5 text-[#FF4A1F]" />
                            RBAC & Staff Activity Audit Trail
                        </h2>
                        {activityLog.length === 0 ? (
                            <p className="text-slate-400 text-xs">No administrative actions logged yet.</p>
                        ) : (
                            <div className="divide-y divide-slate-800">
                                {activityLog.map((log) => (
                                    <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="font-mono text-orange-400 font-semibold mr-2">
                                                [{log.action}]
                                            </span>
                                            <span className="text-slate-200">{log.description}</span>
                                        </div>
                                        <div className="text-slate-500 text-[11px] shrink-0 ml-4">
                                            {new Date(log.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal: Add Employee */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[#12161c] border border-slate-800 rounded-xl max-w-lg w-full p-6 text-white space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-[#FF4A1F]" />
                                Onboard New Employee
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddUser} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Full Name *</label>
                                <Input
                                    value={addForm.data.name}
                                    onChange={(e) => addForm.setData('name', e.target.value)}
                                    placeholder="e.g. Tareq Hasan"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-300 mb-1 font-semibold">Email *</label>
                                    <Input
                                        type="email"
                                        value={addForm.data.email}
                                        onChange={(e) => addForm.setData('email', e.target.value)}
                                        placeholder="tareq@pharma.com"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-300 mb-1 font-semibold">Phone</label>
                                    <Input
                                        value={addForm.data.phone}
                                        onChange={(e) => addForm.setData('phone', e.target.value)}
                                        placeholder="017XXXXXXXX"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Assign Role *</label>
                                <Select
                                    value={String(addForm.data.role_id)}
                                    onChange={(e) => addForm.setData('role_id', Number(e.target.value))}
                                >
                                    {roles.map((r) => (
                                        <option key={r.id} value={String(r.id)}>
                                            {r.name} {r.is_locked ? '(Owner)' : ''}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Assign Branches</label>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-slate-800 rounded-lg p-2.5">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-emerald-400 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={addForm.data.access_all_branches}
                                            onChange={(e) =>
                                                addForm.setData('access_all_branches', e.target.checked)
                                            }
                                        />
                                        Grant Access to ALL Current and Future Branches
                                    </label>
                                    {!addForm.data.access_all_branches &&
                                        branches.map((b) => (
                                            <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={addForm.data.branch_ids.includes(b.id)}
                                                    onChange={(e) => {
                                                        const cur = addForm.data.branch_ids;
                                                        addForm.setData(
                                                            'branch_ids',
                                                            e.target.checked
                                                                ? [...cur, b.id]
                                                                : cur.filter((id) => id !== b.id)
                                                        );
                                                    }}
                                                />
                                                <span>{b.name} ({b.code})</span>
                                            </label>
                                        ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-300 mb-1 font-semibold">Manager PIN (4 digits)</label>
                                    <Input
                                        type="password"
                                        maxLength={4}
                                        value={addForm.data.manager_pin}
                                        onChange={(e) => addForm.setData('manager_pin', e.target.value)}
                                        placeholder="Optional 4-digit PIN"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-300 mb-1 font-semibold">Initial Password</label>
                                    <Input
                                        type="password"
                                        value={addForm.data.password}
                                        onChange={(e) => addForm.setData('password', e.target.value)}
                                        placeholder="Default: PharmaStaff@2026"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={addForm.processing} className="bg-[#FF4A1F] text-white">
                                    {addForm.processing ? 'Saving...' : 'Onboard Employee'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Edit Member */}
            {editingMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[#12161c] border border-slate-800 rounded-xl max-w-lg w-full p-6 text-white space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Edit className="w-5 h-5 text-[#FF4A1F]" />
                                Edit Employee: {editingMember.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setEditingMember(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateMember} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Assigned System Role *</label>
                                <Select
                                    value={String(editForm.data.role_id)}
                                    onChange={(e) => editForm.setData('role_id', Number(e.target.value))}
                                >
                                    {roles.map((r) => (
                                        <option key={r.id} value={String(r.id)}>
                                            {r.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Assigned Branches</label>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-slate-800 rounded-lg p-2.5">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-emerald-400 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editForm.data.access_all_branches}
                                            onChange={(e) =>
                                                editForm.setData('access_all_branches', e.target.checked)
                                            }
                                        />
                                        Grant Access to ALL Branches
                                    </label>
                                    {!editForm.data.access_all_branches &&
                                        branches.map((b) => (
                                            <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.data.branch_ids.includes(b.id)}
                                                    onChange={(e) => {
                                                        const cur = editForm.data.branch_ids;
                                                        editForm.setData(
                                                            'branch_ids',
                                                            e.target.checked
                                                                ? [...cur, b.id]
                                                                : cur.filter((id) => id !== b.id)
                                                        );
                                                    }}
                                                />
                                                <span>{b.name} ({b.code})</span>
                                            </label>
                                        ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Account Status</label>
                                <Select
                                    value={editForm.data.is_active ? '1' : '0'}
                                    onChange={(e) => editForm.setData('is_active', e.target.value === '1')}
                                >
                                    <option value="1">Active</option>
                                    <option value="0">Suspended / Deactivated</option>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Manager PIN (Leave blank to keep existing)</label>
                                <Input
                                    type="password"
                                    maxLength={4}
                                    value={editForm.data.manager_pin}
                                    onChange={(e) => editForm.setData('manager_pin', e.target.value)}
                                    placeholder="New 4-digit PIN"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                <Button type="button" variant="secondary" onClick={() => setEditingMember(null)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={editForm.processing} className="bg-[#FF4A1F] text-white">
                                    {editForm.processing ? 'Updating...' : 'Save Changes'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Set PIN */}
            {pinModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[#12161c] border border-slate-800 rounded-xl max-w-sm w-full p-6 text-white space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Key className="w-5 h-5 text-amber-400" />
                                Manager PIN: {pinModalUser.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setPinModalUser(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSetPin} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Enter 4-Digit Security PIN</label>
                                <Input
                                    type="password"
                                    maxLength={4}
                                    value={pinForm.data.pin}
                                    onChange={(e) => pinForm.setData('pin', e.target.value)}
                                    placeholder="4 digits"
                                    required
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Used for inline cashier approvals (discounts over cap, below cost, void).
                                </p>
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                <Button type="button" variant="secondary" onClick={() => setPinModalUser(null)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={pinForm.processing} className="bg-[#FF4A1F] text-white">
                                    Save PIN
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Role Limits Editor */}
            {editingRoleLimits && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[#12161c] border border-slate-800 rounded-xl max-w-md w-full p-6 text-white space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Shield className="w-5 h-5 text-[#FF4A1F]" />
                                Operating Limits: {editingRoleLimits.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setEditingRoleLimits(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveLimits} className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-300 mb-1 font-semibold">Discount Cap (%)</label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={limitsForm.data.discount_percent}
                                        onChange={(e) => limitsForm.setData('discount_percent', e.target.value)}
                                        placeholder="e.g. 10"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-300 mb-1 font-semibold">Max Refund (৳)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={limitsForm.data.max_refund_amount}
                                        onChange={(e) => limitsForm.setData('max_refund_amount', e.target.value)}
                                        placeholder="e.g. 2000"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-300 mb-1 font-semibold">Max Void (৳)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={limitsForm.data.max_void_amount}
                                        onChange={(e) => limitsForm.setData('max_void_amount', e.target.value)}
                                        placeholder="0 = not allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-300 mb-1 font-semibold">Void Window (Hours)</label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        value={limitsForm.data.void_window_hours}
                                        onChange={(e) => limitsForm.setData('void_window_hours', e.target.value)}
                                        placeholder="e.g. 2"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-300 mb-1 font-semibold">Max Voucher (৳)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={limitsForm.data.max_voucher_amount}
                                        onChange={(e) => limitsForm.setData('max_voucher_amount', e.target.value)}
                                        placeholder="e.g. 50000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-300 mb-1 font-semibold">Stock Adjust Cap (৳)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={limitsForm.data.max_stock_adjust_value}
                                        onChange={(e) => limitsForm.setData('max_stock_adjust_value', e.target.value)}
                                        placeholder="e.g. 5000"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                <Button type="button" variant="secondary" onClick={() => setEditingRoleLimits(null)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={limitsForm.processing} className="bg-[#FF4A1F] text-white">
                                    Save Role Limits
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Custom Role */}
            {showNewRoleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[#12161c] border border-slate-800 rounded-xl max-w-lg w-full p-6 text-white space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Plus className="w-5 h-5 text-[#FF4A1F]" />
                                Create Custom Role
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowNewRoleModal(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateRole} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Role Name *</label>
                                <Input
                                    value={newRoleForm.data.name}
                                    onChange={(e) => newRoleForm.setData('name', e.target.value)}
                                    placeholder="e.g. Shift Supervisor"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Description</label>
                                <Input
                                    value={newRoleForm.data.description}
                                    onChange={(e) => newRoleForm.setData('description', e.target.value)}
                                    placeholder="Describe responsibilities"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-300 mb-1 font-semibold">Select Base Permissions</label>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-800 rounded-lg p-2.5">
                                    {Object.values(permissionsCatalog).flat().map((p) => (
                                        <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newRoleForm.data.permissions.includes(p.key)}
                                                onChange={(e) => {
                                                    const cur = newRoleForm.data.permissions;
                                                    newRoleForm.setData(
                                                        'permissions',
                                                        e.target.checked
                                                            ? [...cur, p.key]
                                                            : cur.filter((k) => k !== p.key)
                                                    );
                                                }}
                                            />
                                            <span className="font-mono text-slate-300">{p.key}</span>
                                            <span className="text-[10px] text-slate-500">({p.module})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                <Button type="button" variant="secondary" onClick={() => setShowNewRoleModal(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={newRoleForm.processing} className="bg-[#FF4A1F] text-white">
                                    Create Role
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: User Permission Overrides */}
            {overrideModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[#12161c] border border-slate-800 rounded-xl max-w-lg w-full p-6 text-white space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-purple-400" />
                                Permission Overrides: {overrideModalUser.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setOverrideModalUser(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Existing overrides */}
                        {overrideModalUser.overrides.length > 0 && (
                            <div className="border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
                                <div className="font-semibold text-slate-300">Active Overrides:</div>
                                {overrideModalUser.overrides.map((ov) => (
                                    <div key={ov.id} className="flex justify-between items-center bg-slate-900/60 p-2 rounded">
                                        <div>
                                            <span className="font-mono text-purple-300 mr-2">{ov.permission_key}</span>
                                            <span
                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                    ov.effect === 'allow'
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'bg-red-500/10 text-red-400'
                                                }`}
                                            >
                                                {ov.effect.toUpperCase()}
                                            </span>
                                            {ov.reason && <div className="text-[11px] text-slate-400">{ov.reason}</div>}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteOverride(ov.id)}
                                            className="text-red-400 hover:text-red-300 p-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add new override */}
                        <form onSubmit={handleSaveOverride} className="space-y-3 text-xs border-t border-slate-800 pt-3">
                            <div className="font-semibold text-slate-300">Add New Override:</div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 mb-1">Permission Key *</label>
                                    <Input
                                        value={overrideForm.data.permission_key}
                                        onChange={(e) => overrideForm.setData('permission_key', e.target.value)}
                                        placeholder="e.g. discount.manage"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 mb-1">Effect *</label>
                                    <Select
                                        value={overrideForm.data.effect}
                                        onChange={(e) => overrideForm.setData('effect', e.target.value as 'allow' | 'deny')}
                                    >
                                        <option value="allow">ALLOW (Grant permission)</option>
                                        <option value="deny">DENY (Explicitly block permission)</option>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 mb-1">Scope</label>
                                    <Select
                                        value={overrideForm.data.scope}
                                        onChange={(e) => overrideForm.setData('scope', String(e.target.value))}
                                    >
                                        <option value="all">All (Whole tenant)</option>
                                        <option value="branch">Branch (Assigned branches)</option>
                                        <option value="own">Own (Only own records)</option>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-slate-400 mb-1">Reason</label>
                                    <Input
                                        value={overrideForm.data.reason}
                                        onChange={(e) => overrideForm.setData('reason', e.target.value)}
                                        placeholder="Reason for audit"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="secondary" onClick={() => setOverrideModalUser(null)}>
                                    Close
                                </Button>
                                <Button type="submit" disabled={overrideForm.processing} className="bg-[#FF4A1F] text-white">
                                    Save Override
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Inspect User: "What can this user do?" Read-Only Preview */}
            {inspectingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[#12161c] border border-slate-800 rounded-xl max-w-xl w-full p-6 text-white space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                            <div>
                                <h3 className="font-bold text-base flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-emerald-400" />
                                    What can {inspectingUser.name} do?
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Role: <strong className="text-white">{inspectingUser.role_name}</strong> | Data Scope: {inspectingUser.access_all_branches ? 'All Branches' : `${inspectingUser.branch_ids.length} Branch(es)`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInspectingUser(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            {Object.entries(permissionsCatalog).map(([mod, items]) => {
                                const roleModel = roles.find((r) => r.id === inspectingUser.role_id);
                                return (
                                    <div key={mod} className="border border-slate-800/80 rounded-lg p-3 space-y-1.5">
                                        <div className="font-bold text-orange-400 uppercase text-[11px]">{mod}</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                            {items.map((p) => {
                                                const override = inspectingUser.overrides.find((ov) => ov.permission_key === p.key && !ov.is_expired);
                                                let isAllowed = false;
                                                let source = '';
                                                let scope = 'all';

                                                if (override) {
                                                    isAllowed = override.effect === 'allow';
                                                    source = `Override (${override.effect})`;
                                                    scope = override.scope || 'all';
                                                } else if (inspectingUser.is_owner) {
                                                    isAllowed = true;
                                                    source = 'Owner';
                                                } else if (roleModel && roleModel.permissions[p.key]) {
                                                    isAllowed = true;
                                                    source = roleModel.name;
                                                    scope = roleModel.permissions[p.key];
                                                }

                                                return (
                                                    <div
                                                        key={p.key}
                                                        className={`p-2 rounded flex items-center justify-between text-[11px] ${
                                                            isAllowed ? 'bg-emerald-950/20 border border-emerald-900/30' : 'bg-slate-900/40 opacity-50'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="font-mono font-medium">{p.key}</div>
                                                            <div className="text-[10px] text-slate-400">{source}</div>
                                                        </div>
                                                        {isAllowed ? (
                                                            <span className="font-bold text-emerald-400 text-[10px]">
                                                                ✓ {scope}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500">—</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
