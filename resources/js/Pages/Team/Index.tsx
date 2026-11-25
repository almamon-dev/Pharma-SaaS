import React, { useMemo, useState } from 'react';
import { useForm, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Edit,
    Eye,
    GitBranch,
    History,
    Key,
    Plus,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { FormLayoutProvider, HorizontalFormRow } from '@/Components/ui/FormLayout';
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
    branch_name?: string | null;
    branch_code?: string | null;
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
    activeBranchId?: number | null;
    currentTab?: 'users' | 'matrix' | 'activity';
}

export default function TeamIndex({
    members,
    roles,
    permissionsCatalog,
    branches = [],
    activityLog,
    canManageRoles,
    activeBranchId,
    currentTab,
}: TeamProps) {
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const tabFromUrl = (currentTab || searchParams?.get('tab')) as 'users' | 'matrix' | 'activity';
    const activeTab: 'users' | 'matrix' | 'activity' =
        tabFromUrl === 'matrix' ? 'matrix' : tabFromUrl === 'activity' ? 'activity' : 'users';
    const [selectedBranchId, setSelectedBranchId] = useState<number | 'all'>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [inspectingUser, setInspectingUser] = useState<TeamMember | null>(null);
    const [pinModalUser, setPinModalUser] = useState<TeamMember | null>(null);
    const [overrideModalUser, setOverrideModalUser] = useState<TeamMember | null>(null);
    const [editingRoleLimits, setEditingRoleLimits] = useState<RoleItem | null>(null);
    const [showNewRoleModal, setShowNewRoleModal] = useState(false);

    const defaultBranchId = activeBranchId ?? branches[0]?.id ?? '';

    // Add User Form
    const addForm = useForm({
        name: '',
        email: '',
        phone: '',
        role_id: roles[3]?.id ?? roles[0]?.id ?? '',
        branch_id: defaultBranchId as number | string,
        branch_ids: defaultBranchId ? [Number(defaultBranchId)] : ([] as number[]),
        access_all_branches: false,
        manager_pin: '',
        password: '',
    });

    // Edit Member Form
    const editForm = useForm({
        role_id: 0,
        branch_id: '' as number | string,
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

    const openAddModal = (presetBranchId?: number) => {
        const targetBranchId =
            presetBranchId ??
            (selectedBranchId !== 'all'
                ? selectedBranchId
                : activeBranchId ?? branches[0]?.id ?? '');
        addForm.setData((prev) => ({
            ...prev,
            branch_id: targetBranchId,
            branch_ids: targetBranchId ? [Number(targetBranchId)] : [],
        }));
        setShowAddModal(true);
    };

    const openEdit = (member: TeamMember) => {
        setEditingMember(member);
        const primaryId = member.branch_id ?? member.branch_ids[0] ?? branches[0]?.id ?? '';
        editForm.setData({
            role_id: member.role_id ?? roles[0]?.id ?? 0,
            branch_id: primaryId,
            branch_ids: member.branch_ids.length > 0 ? member.branch_ids : (primaryId ? [Number(primaryId)] : []),
            access_all_branches: member.access_all_branches,
            is_active: member.is_active,
            manager_pin: '',
        });
    };

    const filteredMembers = useMemo(() => {
        if (selectedBranchId === 'all') {
            return members;
        }
        return members.filter((m) => {
            if (m.access_all_branches) return true;
            if (m.branch_id === selectedBranchId) return true;
            if (m.branch_ids && m.branch_ids.includes(selectedBranchId)) return true;
            return false;
        });
    }, [members, selectedBranchId]);

    const branchCounts = useMemo(() => {
        const counts: Record<number | string, number> = { all: members.length };
        branches.forEach((b) => {
            counts[b.id] = members.filter(
                (m) => m.access_all_branches || m.branch_id === b.id || (m.branch_ids && m.branch_ids.includes(b.id))
            ).length;
        });
        return counts;
    }, [members, branches]);

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
                        {row.role_name && row.role_name !== 'No Role'
                            ? row.role_name
                            : row.is_owner
                            ? 'Pharmacy Admin (Owner)'
                            : 'Staff'}
                    </span>
                ),
            },
            {
                id: 'branches',
                label: 'Assigned Branch',
                render: (row) => (
                    <div className="text-xs space-y-0.5">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                            <GitBranch className="w-3 h-3 text-[#FF4A1F] shrink-0" />
                            {row.branch_name ? (
                                <span>
                                    {row.branch_name}{' '}
                                    {row.branch_code && (
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            ({row.branch_code})
                                        </span>
                                    )}
                                </span>
                            ) : row.access_all_branches ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    All Branches
                                </span>
                            ) : (
                                <span className="text-slate-400">Head Office</span>
                            )}
                        </div>
                        {row.access_all_branches ? (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                Full Central Access
                            </div>
                        ) : row.branch_ids.length > 1 ? (
                            <div className="text-[10px] text-slate-400">
                                +{row.branch_ids.length - 1} roaming branch(es)
                            </div>
                        ) : null}
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

    const headerConfig = {
        users: {
            title: 'Staff Directory',
            subtitle: 'Active pharmacy staff accounts and branch assignments.',
            icon: Users,
            actions: (
                <Button
                    size="sm"
                    onClick={() => openAddModal()}
                    className="bg-[#FF4A1F] hover:bg-[#e03e15] text-white gap-1.5 text-xs shadow-xs cursor-pointer"
                >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add Employee
                </Button>
            ),
        },
        matrix: {
            title: 'Roles & Permissions',
            subtitle: 'Access permissions, discount caps and supervisor limits.',
            icon: Shield,
            actions: canManageRoles ? (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowNewRoleModal(true)}
                    className="gap-1.5 text-xs cursor-pointer"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Custom Role
                </Button>
            ) : null,
        },
        activity: {
            title: 'Activity & Audit Log',
            subtitle: 'Security audit logs for role changes and overrides.',
            icon: History,
            actions: null,
        },
    };

    const currentHeader = headerConfig[activeTab] || headerConfig.users;

    return (
        <AppLayout
            title={currentHeader.title}
            subtitle={currentHeader.subtitle}
            icon={currentHeader.icon}
            actions={currentHeader.actions}
        >
            <div className="space-y-4 max-w-7xl mx-auto pb-12">
                {/* Tab 1: Users */}
                {activeTab === 'users' && (
                    <div className="space-y-3">
                        {branches.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/90 dark:bg-[#1a1f26] rounded-[4px] border border-slate-200/90 dark:border-slate-800 text-xs">
                                <span className="text-[11px] font-semibold text-slate-500 uppercase px-2 py-1 flex items-center gap-1.5">
                                    <GitBranch className="w-3.5 h-3.5 text-[#FF4A1F]" />
                                    Filter Branch:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedBranchId('all')}
                                    className={`px-2.5 py-1 rounded-[4px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
                                        selectedBranchId === 'all'
                                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <span>All Branches</span>
                                    <span
                                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                            selectedBranchId === 'all'
                                                ? 'bg-[#FF4A1F]/10 text-[#FF4A1F] font-bold'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        {branchCounts['all'] ?? members.length}
                                    </span>
                                </button>
                                {branches.map((b) => (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => setSelectedBranchId(b.id)}
                                        className={`px-2.5 py-1 rounded-[4px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
                                            selectedBranchId === b.id
                                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        <span>{b.name}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">({b.code})</span>
                                        <span
                                            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                                selectedBranchId === b.id
                                                    ? 'bg-[#FF4A1F]/10 text-[#FF4A1F] font-bold'
                                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}
                                        >
                                            {branchCounts[b.id] ?? 0}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="bg-white dark:bg-[#1e2329] border border-slate-200/90 dark:border-slate-800 rounded-[4px] overflow-hidden shadow-2xs">
                            <DataTable
                                columns={userColumns}
                                data={filteredMembers}
                                emptyState={
                                    <EmptyState
                                        icon={Users}
                                        title="No employees found"
                                        description={
                                            selectedBranchId === 'all'
                                                ? 'No team members have been added to this pharmacy yet.'
                                                : 'No employees assigned to the selected branch.'
                                        }
                                    />
                                }
                            />
                        </div>
                    </div>
                )}

                {/* Tab 2: Roles Matrix */}
                {activeTab === 'matrix' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {roles.map((r) => (
                                <div
                                    key={r.id}
                                    className="bg-white dark:bg-[#1e2329] border border-slate-200/90 dark:border-slate-800 rounded-[4px] p-3.5 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                                                <Shield className="w-4 h-4 text-[#FF4A1F] shrink-0" />
                                                <span className="truncate">{r.name}</span>
                                            </span>
                                            {r.is_locked ? (
                                                <span className="text-[10px] bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 px-1.5 py-0.5 rounded-[3px] font-bold">
                                                    Locked
                                                </span>
                                            ) : (
                                                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-1.5 py-0.5 rounded-[3px] font-bold">
                                                    System
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                                            {r.description}
                                        </p>

                                        {/* Limits Preview */}
                                        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-[4px] p-2.5 text-[11px] space-y-1 mb-3">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 dark:text-slate-400">Discount Cap:</span>
                                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                                    {r.limits['discount_percent'] !== null && r.limits['discount_percent'] !== undefined
                                                        ? `${r.limits['discount_percent']}%`
                                                        : 'Unlimited'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 dark:text-slate-400">Max Refund:</span>
                                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                                    {r.limits['max_refund_amount'] !== null && r.limits['max_refund_amount'] !== undefined
                                                        ? `৳${r.limits['max_refund_amount']}`
                                                        : 'Unlimited'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 dark:text-slate-400">Void Window:</span>
                                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                                    {r.limits['void_window_hours'] !== null && r.limits['void_window_hours'] !== undefined
                                                        ? `${r.limits['void_window_hours']} hrs`
                                                        : 'Unlimited'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                                        <span>{Object.keys(r.permissions).length} permissions</span>
                                        {!r.is_locked && canManageRoles && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openLimitsEditor(r)}
                                                className="h-6 px-2 text-[11px] font-medium rounded-[4px] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#FF4A1F] hover:text-[#FF4A1F] cursor-pointer"
                                            >
                                                Configure Limits
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Full Permissions Breakdown Table */}
                        <div className="bg-white dark:bg-[#1e2329] border border-slate-200/90 dark:border-slate-800 rounded-[4px] p-4 sm:p-5 shadow-2xs">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
                                Master RBAC Permissions Matrix
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase font-semibold">
                                        <tr>
                                            <th className="py-2.5 px-3">Permission Group / Action</th>
                                            <th className="py-2.5 px-3">Feature Req.</th>
                                            {roles.map((r) => (
                                                <th key={r.id} className="py-2.5 px-2 text-center text-slate-800 dark:text-slate-200">
                                                    {r.name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {Object.entries(permissionsCatalog).map(([moduleName, items]) => (
                                            <React.Fragment key={moduleName}>
                                                <tr className="bg-slate-100/70 dark:bg-slate-800/40">
                                                    <td
                                                        colSpan={2 + roles.length}
                                                        className="py-1.5 px-3 font-bold text-[#ea580c] dark:text-[#ff4a1f] uppercase tracking-wider text-[11px]"
                                                    >
                                                        {moduleName}
                                                    </td>
                                                </tr>
                                                {items.map((perm) => (
                                                    <tr key={perm.key} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                                                        <td className="py-2 px-3">
                                                            <div className="flex items-center gap-1.5">
                                                                {perm.is_sensitive && (
                                                                    <span title="Sensitive permission - audited">
                                                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                                    </span>
                                                                )}
                                                                <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
                                                                    {perm.key}
                                                                </span>
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                {perm.description}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                                            {perm.requires_feature ? (
                                                                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700/60">
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
                                                                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                                                                    : scope === 'branch'
                                                                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                                                                                    : 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30'
                                                                            }`}
                                                                        >
                                                                            {scope}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-300 dark:text-slate-600">—</span>
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
                    <div className="bg-white dark:bg-[#1e2329] border border-slate-200/90 dark:border-slate-800 rounded-[4px] p-4 sm:p-5 shadow-2xs">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                            <History className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF4A1F]" />
                            RBAC & Staff Activity Audit Trail
                        </h2>
                        {activityLog.length === 0 ? (
                            <p className="text-slate-500 dark:text-slate-400 text-xs">No administrative actions logged yet.</p>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {activityLog.map((log) => (
                                    <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="font-mono text-[#ea580c] dark:text-orange-400 font-semibold mr-2">
                                                [{log.action}]
                                            </span>
                                            <span className="text-slate-700 dark:text-slate-200">{log.description}</span>
                                        </div>
                                        <div className="text-slate-400 dark:text-slate-500 text-[11px] shrink-0 ml-4 font-mono">
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
                    <div className="bg-white dark:bg-[#1e2329] border border-slate-200/90 dark:border-slate-800 rounded-[4px] max-w-lg w-full p-5 sm:p-6 text-slate-900 dark:text-slate-100 space-y-4 shadow-xl">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <UserPlus className="w-5 h-5 text-[#FF4A1F]" />
                                Onboard New Employee
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <FormLayoutProvider labelWidth="sm:w-[160px]">
                            <form onSubmit={handleAddUser} className="space-y-3 text-xs">
                                <Input
                                    label="Full Name"
                                    value={addForm.data.name}
                                    onChange={(e) => addForm.setData('name', e.target.value)}
                                    placeholder="e.g. Tareq Hasan"
                                    required
                                />
                                <Input
                                    label="Email"
                                    type="email"
                                    value={addForm.data.email}
                                    onChange={(e) => addForm.setData('email', e.target.value)}
                                    placeholder="tareq@pharma.com"
                                    required
                                />
                                <Input
                                    label="Phone"
                                    value={addForm.data.phone}
                                    onChange={(e) => addForm.setData('phone', e.target.value)}
                                    placeholder="017XXXXXXXX"
                                />
                                <Select
                                    label="Assign Role"
                                    required
                                    value={String(addForm.data.role_id)}
                                    onChange={(e) => addForm.setData('role_id', Number(e.target.value))}
                                >
                                    {roles.map((r) => (
                                        <option key={r.id} value={String(r.id)}>
                                            {r.name} {r.is_locked ? '(Owner)' : ''}
                                        </option>
                                    ))}
                                </Select>
                                <Select
                                    label="Primary Branch"
                                    required
                                    value={String(addForm.data.branch_id)}
                                    onChange={(e) => {
                                        const newId = Number(e.target.value);
                                        addForm.setData((prev) => ({
                                            ...prev,
                                            branch_id: newId,
                                            branch_ids: prev.branch_ids.includes(newId)
                                                ? prev.branch_ids
                                                : [...prev.branch_ids, newId],
                                        }));
                                    }}
                                >
                                    <option value="" disabled>Select Primary Branch</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={String(b.id)}>
                                            {b.name} ({b.code})
                                        </option>
                                    ))}
                                </Select>
                                <HorizontalFormRow label="Additional Branches">
                                    <div className="space-y-1.5 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-[2px] p-2.5 bg-slate-50/50 dark:bg-slate-900/30">
                                        <label className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={addForm.data.access_all_branches}
                                                onChange={(e) =>
                                                    addForm.setData('access_all_branches', e.target.checked)
                                                }
                                            />
                                            Grant Roaming Access to ALL Current and Future Branches
                                        </label>
                                        {!addForm.data.access_all_branches &&
                                            branches.map((b) => {
                                                const isPrimary = Number(addForm.data.branch_id) === b.id;
                                                return (
                                                    <label
                                                        key={b.id}
                                                        className={`flex items-center justify-between text-xs cursor-pointer ${
                                                            isPrimary
                                                                ? 'opacity-75 font-medium'
                                                                : 'text-slate-700 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                disabled={isPrimary}
                                                                checked={isPrimary || addForm.data.branch_ids.includes(b.id)}
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
                                                        </span>
                                                        {isPrimary && (
                                                            <span className="text-[10px] text-[#FF4A1F] font-semibold px-1.5 py-0.2 rounded bg-orange-500/10">
                                                                Primary Branch
                                                            </span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                    </div>
                                </HorizontalFormRow>
                                <Input
                                    label="Manager PIN (4 digits)"
                                    type="password"
                                    maxLength={4}
                                    value={addForm.data.manager_pin}
                                    onChange={(e) => addForm.setData('manager_pin', e.target.value)}
                                    placeholder="Optional 4-digit PIN"
                                />
                                <Input
                                    label="Initial Password"
                                    type="password"
                                    value={addForm.data.password}
                                    onChange={(e) => addForm.setData('password', e.target.value)}
                                    placeholder="Default: PharmaStaff@2026"
                                />
                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={addForm.processing} className="bg-[#FF4A1F] text-white">
                                        {addForm.processing ? 'Saving...' : 'Onboard Employee'}
                                    </Button>
                                </div>
                            </form>
                        </FormLayoutProvider>
                    </div>
                </div>
            )}

            {/* Modal: Edit Member */}
            {editingMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white dark:bg-[#1e2329] border border-slate-200/90 dark:border-slate-800 rounded-[4px] max-w-lg w-full p-5 sm:p-6 text-slate-900 dark:text-slate-100 space-y-4 shadow-xl">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <Edit className="w-5 h-5 text-[#FF4A1F]" />
                                Edit Employee: {editingMember.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setEditingMember(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <FormLayoutProvider labelWidth="sm:w-[160px]">
                            <form onSubmit={handleUpdateMember} className="space-y-3 text-xs">
                                <Input
                                    label="Employee Name"
                                    readOnly
                                    value={editingMember.name}
                                />
                                <Input
                                    label="Email"
                                    readOnly
                                    value={editingMember.email}
                                />
                                <Select
                                    label="Assigned System Role"
                                    required
                                    value={String(editForm.data.role_id)}
                                    onChange={(e) => editForm.setData('role_id', Number(e.target.value))}
                                >
                                    {roles.map((r) => (
                                        <option key={r.id} value={String(r.id)}>
                                            {r.name}
                                        </option>
                                    ))}
                                </Select>
                                <Select
                                    label="Primary Branch"
                                    required
                                    value={String(editForm.data.branch_id)}
                                    onChange={(e) => {
                                        const newId = Number(e.target.value);
                                        editForm.setData((prev) => ({
                                            ...prev,
                                            branch_id: newId,
                                            branch_ids: prev.branch_ids.includes(newId)
                                                ? prev.branch_ids
                                                : [...prev.branch_ids, newId],
                                        }));
                                    }}
                                >
                                    <option value="" disabled>Select Primary Branch</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={String(b.id)}>
                                            {b.name} ({b.code})
                                        </option>
                                    ))}
                                </Select>
                                <HorizontalFormRow label="Additional Branches">
                                    <div className="space-y-1.5 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-[2px] p-2.5 bg-slate-50/50 dark:bg-slate-900/30">
                                        <label className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={editForm.data.access_all_branches}
                                                onChange={(e) =>
                                                    editForm.setData('access_all_branches', e.target.checked)
                                                }
                                            />
                                            Grant Roaming Access to ALL Branches
                                        </label>
                                        {!editForm.data.access_all_branches &&
                                            branches.map((b) => {
                                                const isPrimary = Number(editForm.data.branch_id) === b.id;
                                                return (
                                                    <label
                                                        key={b.id}
                                                        className={`flex items-center justify-between text-xs cursor-pointer ${
                                                            isPrimary
                                                                ? 'opacity-75 font-medium'
                                                                : 'text-slate-700 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                disabled={isPrimary}
                                                                checked={isPrimary || editForm.data.branch_ids.includes(b.id)}
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
                                                        </span>
                                                        {isPrimary && (
                                                            <span className="text-[10px] text-[#FF4A1F] font-semibold px-1.5 py-0.2 rounded bg-orange-500/10">
                                                                Primary Branch
                                                            </span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                    </div>
                                </HorizontalFormRow>
                                <Select
                                    label="Account Status"
                                    value={editForm.data.is_active ? '1' : '0'}
                                    onChange={(e) => editForm.setData('is_active', e.target.value === '1')}
                                >
                                    <option value="1">Active</option>
                                    <option value="0">Suspended / Deactivated</option>
                                </Select>
                                <Input
                                    label="Manager PIN"
                                    type="password"
                                    maxLength={4}
                                    value={editForm.data.manager_pin}
                                    onChange={(e) => editForm.setData('manager_pin', e.target.value)}
                                    placeholder="Leave blank to keep existing"
                                />
                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <Button type="button" variant="secondary" onClick={() => setEditingMember(null)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={editForm.processing} className="bg-[#FF4A1F] text-white">
                                        {editForm.processing ? 'Updating...' : 'Save Changes'}
                                    </Button>
                                </div>
                            </form>
                        </FormLayoutProvider>
                    </div>
                </div>
            )}

            {/* Modal: Set PIN */}
            {pinModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white dark:bg-[#1e2329] border border-slate-200/90 dark:border-slate-800 rounded-[4px] max-w-sm w-full p-5 sm:p-6 text-slate-900 dark:text-slate-100 space-y-4 shadow-xl">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <Key className="w-5 h-5 text-amber-500" />
                                Manager PIN: {pinModalUser.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setPinModalUser(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <FormLayoutProvider labelWidth="sm:w-[130px]">
                            <form onSubmit={handleSetPin} className="space-y-3 text-xs">
                                <Input
                                    label="Staff Member"
                                    readOnly
                                    value={pinModalUser.name}
                                />
                                <Input
                                    label="4-Digit PIN"
                                    type="password"
                                    maxLength={4}
                                    value={pinForm.data.pin}
                                    onChange={(e) => pinForm.setData('pin', e.target.value)}
                                    placeholder="4 digits"
                                    required
                                />
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Used for inline cashier approvals (discounts over cap, below cost, void).
                                </p>
                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <Button type="button" variant="secondary" onClick={() => setPinModalUser(null)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={pinForm.processing} className="bg-[#FF4A1F] text-white">
                                        Save PIN
                                    </Button>
                                </div>
                            </form>
                        </FormLayoutProvider>
                    </div>
                </div>
            )}

            {/* Modal: Role Limits Editor */}
            {editingRoleLimits && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white dark:bg-[#1e2329] border border-slate-200/90 dark:border-slate-800 rounded-[4px] max-w-md w-full p-5 sm:p-6 text-slate-900 dark:text-slate-100 space-y-4 shadow-xl">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <Shield className="w-5 h-5 text-[#FF4A1F]" />
                                Operating Limits: {editingRoleLimits.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setEditingRoleLimits(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveLimits} className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Discount Cap (%)</label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={limitsForm.data.discount_percent}
                                        onChange={(e) => limitsForm.setData('discount_percent', e.target.value)}
                                        placeholder="e.g. 10"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Max Refund (৳)</label>
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
                                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Max Void (৳)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={limitsForm.data.max_void_amount}
                                        onChange={(e) => limitsForm.setData('max_void_amount', e.target.value)}
                                        placeholder="0 = not allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Void Window (Hours)</label>
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
                                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Max Voucher (৳)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={limitsForm.data.max_voucher_amount}
                                        onChange={(e) => limitsForm.setData('max_voucher_amount', e.target.value)}
                                        placeholder="e.g. 50000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">Stock Adjust Cap (৳)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={limitsForm.data.max_stock_adjust_value}
                                        onChange={(e) => limitsForm.setData('max_stock_adjust_value', e.target.value)}
                                        placeholder="e.g. 5000"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
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
                    <div className="bg-white dark:bg-[#1e2329] border border-slate-200/90 dark:border-slate-800 rounded-[4px] max-w-lg w-full p-5 sm:p-6 text-slate-900 dark:text-slate-100 space-y-4 shadow-xl">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <Plus className="w-5 h-5 text-[#FF4A1F]" />
                                Create Custom Role
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowNewRoleModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <FormLayoutProvider labelWidth="sm:w-[140px]">
                            <form onSubmit={handleCreateRole} className="space-y-3 text-xs">
                                <Input
                                    label="Role Name"
                                    value={newRoleForm.data.name}
                                    onChange={(e) => newRoleForm.setData('name', e.target.value)}
                                    placeholder="e.g. Shift Supervisor"
                                    required
                                />
                                <Input
                                    label="Description"
                                    value={newRoleForm.data.description}
                                    onChange={(e) => newRoleForm.setData('description', e.target.value)}
                                    placeholder="Describe responsibilities"
                                />
                                <HorizontalFormRow label="Base Permissions">
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-[2px] p-2.5 bg-slate-50/50 dark:bg-slate-900/30">
                                        {Object.values(permissionsCatalog).flat().map((p) => (
                                            <label key={p.key} className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
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
                                                <span className="font-mono text-slate-800 dark:text-slate-200">{p.key}</span>
                                                <span className="text-[10px] text-slate-500">({p.module})</span>
                                            </label>
                                        ))}
                                    </div>
                                </HorizontalFormRow>
                                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <Button type="button" variant="secondary" onClick={() => setShowNewRoleModal(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={newRoleForm.processing} className="bg-[#FF4A1F] text-white">
                                        Create Role
                                    </Button>
                                </div>
                            </form>
                        </FormLayoutProvider>
                    </div>
                </div>
            )}

            {/* Modal: User Permission Overrides */}
            {overrideModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white dark:bg-[#1e2329] border border-slate-200/90 dark:border-slate-800 rounded-[4px] max-w-lg w-full p-5 sm:p-6 text-slate-900 dark:text-slate-100 space-y-4 shadow-xl">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                Permission Overrides: {overrideModalUser.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setOverrideModalUser(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Existing overrides */}
                        {overrideModalUser.overrides.length > 0 && (
                            <div className="border border-slate-200 dark:border-slate-800 rounded-[4px] p-3 space-y-2 text-xs bg-slate-50/50 dark:bg-slate-900/30">
                                <div className="font-semibold text-slate-700 dark:text-slate-300">Active Overrides:</div>
                                {overrideModalUser.overrides.map((ov) => (
                                    <div key={ov.id} className="flex justify-between items-center bg-white dark:bg-slate-900/60 p-2 rounded-[3px] border border-slate-200/80 dark:border-slate-800">
                                        <div>
                                            <span className="font-mono text-purple-600 dark:text-purple-300 mr-2">{ov.permission_key}</span>
                                            <span
                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                    ov.effect === 'allow'
                                                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                                        : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                                                }`}
                                            >
                                                {ov.effect.toUpperCase()}
                                            </span>
                                            {ov.reason && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{ov.reason}</div>}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteOverride(ov.id)}
                                            className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 p-1 cursor-pointer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add new override */}
                        <form onSubmit={handleSaveOverride} className="space-y-3 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                            <div className="font-semibold text-slate-700 dark:text-slate-300">Add New Override:</div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-700 dark:text-slate-400 mb-1">Permission Key *</label>
                                    <Input
                                        value={overrideForm.data.permission_key}
                                        onChange={(e) => overrideForm.setData('permission_key', e.target.value)}
                                        placeholder="e.g. discount.manage"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-700 dark:text-slate-400 mb-1">Effect *</label>
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
                                    <label className="block text-slate-700 dark:text-slate-400 mb-1">Scope</label>
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
                                    <label className="block text-slate-700 dark:text-slate-400 mb-1">Reason</label>
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
                    <div className="bg-white dark:bg-[#1e2329] border border-slate-200/90 dark:border-slate-800 rounded-[4px] max-w-xl w-full p-5 sm:p-6 text-slate-900 dark:text-slate-100 space-y-4 max-h-[85vh] overflow-y-auto shadow-xl">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div>
                                <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                    <Eye className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                    What can {inspectingUser.name} do?
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Role: <strong className="text-slate-900 dark:text-white">{inspectingUser.role_name}</strong> | Primary Branch: <strong className="text-slate-900 dark:text-white">{inspectingUser.branch_name || 'Head Office'}</strong> | Data Scope: {inspectingUser.access_all_branches ? 'All Branches' : `${inspectingUser.branch_ids.length} Branch(es)`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInspectingUser(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            {Object.entries(permissionsCatalog).map(([mod, items]) => {
                                const roleModel = roles.find((r) => r.id === inspectingUser.role_id);
                                return (
                                    <div key={mod} className="border border-slate-200/80 dark:border-slate-800/80 rounded-[4px] p-3 space-y-1.5 bg-slate-50/40 dark:bg-slate-900/20">
                                        <div className="font-bold text-[#ea580c] dark:text-orange-400 uppercase text-[11px]">{mod}</div>
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
                                                        className={`p-2 rounded-[3px] flex items-center justify-between text-[11px] ${
                                                            isAllowed
                                                                ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200'
                                                                : 'bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 opacity-60 text-slate-500'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="font-mono font-medium">{p.key}</div>
                                                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{source}</div>
                                                        </div>
                                                        {isAllowed ? (
                                                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[10px]">
                                                                ✓ {scope}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 dark:text-slate-500">—</span>
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
