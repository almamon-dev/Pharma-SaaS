import React, { useMemo, useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import {
    Edit,
    Plus,
    ShieldCheck,
    Store,
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
import {
    DataTable,
    Column,
    EmptyState,
    TableActionMenu,
} from '@/Components/tables';
import { SharedPageProps, SubscriptionUsage } from '@/types';

interface TeamMember {
    id: number;
    user_id: number;
    tenant_id: number;
    tenant_name: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    roles: string[];
    role_labels: string[];
    role_label: string;
    branch_id: number | null;
    branch_name: string;
    is_active: boolean;
    is_owner: boolean;
    joined_at: string;
}

interface RoleOption {
    value: string;
    label: string;
    description: string;
    permissions: string[];
    is_system: boolean;
}

interface PermissionOption {
    key: string;
    label: string;
}

interface BranchOption {
    id: number;
    tenant_id: number;
    name: string;
    code: string;
}

interface TenantOption {
    id: number;
    name: string;
    city?: string | null;
}

interface TeamProps {
    members: TeamMember[];
    roles: RoleOption[];
    permissionCatalog: PermissionOption[];
    branches: BranchOption[];
    tenants: TenantOption[];
    currentTenantId: number;
    isOwner: boolean;
    usage?: SubscriptionUsage | null;
}

export default function TeamIndex({
    members,
    roles,
    permissionCatalog,
    branches,
    tenants,
    currentTenantId,
    isOwner,
    usage,
}: TeamProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const [activeTab, setActiveTab] = useState<'employees' | 'roles'>(
        'employees'
    );
    const [tenantFilter, setTenantFilter] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

    const addForm = useForm<{
        name: string;
        email: string;
        phone: string;
        tenant_id: string;
        branch_id: string;
        roles: string[];
        password: string;
    }>({
        name: '',
        email: '',
        phone: '',
        tenant_id: String(currentTenantId ?? tenants[0]?.id ?? ''),
        branch_id: '',
        roles: [roles[1]?.value ?? roles[0]?.value ?? 'pharmacist'],
        password: '',
    });

    const editForm = useForm<{
        branch_id: string;
        roles: string[];
        is_active: boolean;
    }>({
        branch_id: '',
        roles: [],
        is_active: true,
    });

    const roleForm = useForm<{
        name: string;
        description: string;
        permissions: string[];
    }>({
        name: '',
        description: '',
        permissions: ['crm.view', 'inventory.view'],
    });

    const filteredMembers = useMemo(() => {
        if (!tenantFilter) return members;
        return members.filter(
            (m) => String(m.tenant_id) === String(tenantFilter)
        );
    }, [members, tenantFilter]);

    const addBranchOptions = useMemo(() => {
        const list = branches.filter(
            (b) => String(b.tenant_id) === String(addForm.data.tenant_id)
        );
        return [
            { id: 'all', value: '', name: 'All Branches of This Business' },
            ...list.map((b) => ({
                id: b.id,
                value: String(b.id),
                name: `${b.name} (${b.code})`,
            })),
        ];
    }, [branches, addForm.data.tenant_id]);

    const editBranchOptions = useMemo(() => {
        if (!editingMember) return [];
        const list = branches.filter(
            (b) => b.tenant_id === editingMember.tenant_id
        );
        return [
            { id: 'all', value: '', name: 'All Branches of This Business' },
            ...list.map((b) => ({
                id: b.id,
                value: String(b.id),
                name: `${b.name} (${b.code})`,
            })),
        ];
    }, [branches, editingMember]);

    const toggleFormRole = (
        current: string[],
        slug: string,
        setter: (next: string[]) => void
    ) => {
        if (current.includes(slug)) {
            if (current.length <= 1) return;
            setter(current.filter((r) => r !== slug));
        } else {
            setter([...current, slug]);
        }
    };

    const togglePermission = (permKey: string) => {
        const cur = roleForm.data.permissions;
        if (cur.includes(permKey)) {
            if (cur.length <= 1) return;
            roleForm.setData(
                'permissions',
                cur.filter((p) => p !== permKey)
            );
        } else {
            roleForm.setData('permissions', [...cur, permKey]);
        }
    };

    const openEditMember = (member: TeamMember) => {
        setEditingMember(member);
        editForm.setData({
            branch_id: member.branch_id ? String(member.branch_id) : '',
            roles: member.roles.length > 0 ? member.roles : [member.role],
            is_active: member.is_active,
        });
    };

    const handleAddEmployee = (e: React.FormEvent) => {
        e.preventDefault();
        addForm.post(route('team.store'), {
            preserveScroll: true,
            onSuccess: () => {
                addForm.reset('name', 'email', 'phone', 'password');
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

    const handleCreateRole = (e: React.FormEvent) => {
        e.preventDefault();
        roleForm.post(route('team.roles.store'), {
            preserveScroll: true,
            onSuccess: () => {
                roleForm.reset();
                setShowRoleModal(false);
            },
        });
    };

    const employeeColumns: Column<TeamMember>[] = useMemo(
        () => [
            {
                id: 'name',
                label: 'Employee',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#FF4A1F] text-[10px] font-bold">
                            {row.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.name}
                        </span>
                        {row.is_owner && (
                            <span className="text-[11px] font-semibold text-[#FF4A1F]">
                                · Owner
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'email',
                label: 'Email',
                sortable: true,
                render: (row) => (
                    <span className="text-[12px] text-slate-500 dark:text-slate-400">
                        {row.email}
                    </span>
                ),
            },
            {
                id: 'tenant_name',
                label: 'Business & Branch',
                sortable: true,
                render: (row) => (
                    <span className="text-[12px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <strong className="font-semibold text-slate-800 dark:text-slate-200">
                            {row.tenant_name}
                        </strong>
                        <span className="text-slate-400"> · {row.branch_name}</span>
                    </span>
                ),
            },
            {
                id: 'role_label',
                label: 'Assigned Roles',
                render: (row) => (
                    <span
                        className="block max-w-[200px] truncate text-[12px] font-medium text-slate-700 dark:text-slate-200"
                        title={
                            row.is_owner
                                ? 'Store Admin (Owner)'
                                : row.role_labels.join(', ')
                        }
                    >
                        {row.is_owner ? (
                            <span className="font-semibold text-[#FF4A1F]">
                                Store Admin (Owner)
                            </span>
                        ) : (
                            row.role_labels.join(', ')
                        )}
                    </span>
                ),
            },
            {
                id: 'joined_at',
                label: 'Joined',
                sortable: true,
            },
            {
                id: 'is_active',
                label: 'Status',
                sortable: true,
                render: (row) => (
                    <StatusDot variant={row.is_active ? 'emerald' : 'slate'}>
                        {row.is_active ? 'Active' : 'Suspended'}
                    </StatusDot>
                ),
            },
        ],
        []
    );

    const roleColumns: Column<RoleOption>[] = useMemo(
        () => [
            {
                id: 'label',
                label: 'Role',
                sortable: true,
                render: (row) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.label}
                        </span>
                        <span
                            className={`text-[11px] font-medium ${row.is_system ? 'text-slate-400' : 'text-[#FF4A1F]'}`}
                        >
                            ({row.is_system ? 'System' : 'Custom'})
                        </span>
                    </div>
                ),
            },
            {
                id: 'description',
                label: 'Description',
                render: (row) => (
                    <span
                        className="block max-w-[260px] truncate text-[12px] text-slate-500 dark:text-slate-400"
                        title={row.description}
                    >
                        {row.description}
                    </span>
                ),
            },
            {
                id: 'permissions',
                label: 'Granted Permissions',
                render: (row) => (
                    <span
                        className="block max-w-[340px] truncate font-mono text-[11px] text-slate-600 dark:text-slate-300"
                        title={row.permissions.join(', ')}
                    >
                        {row.permissions.join(', ')}
                    </span>
                ),
            },
        ],
        []
    );

    const tenantFilterOptions = [
        { id: 'all', value: '', name: 'All Business Tenants' },
        ...tenants.map((t) => ({
            id: t.id,
            value: String(t.id),
            name: t.name,
        })),
    ];

    const headerTabs = (
        <div className="flex items-center gap-5 border-b border-slate-200 dark:border-slate-700/80 w-full">
            <button
                type="button"
                onClick={() => setActiveTab('employees')}
                className={`relative pb-2.5 text-[12.5px] font-semibold transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                    activeTab === 'employees'
                        ? 'text-slate-900 dark:text-slate-100'
                        : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                <Users className="h-3.5 w-3.5" />
                Employees Directory
                <span className="rounded-full bg-[#FF4A1F] text-white px-1.5 py-0.5 text-[10px] font-bold">
                    {filteredMembers.length}
                </span>
                {activeTab === 'employees' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF4A1F]" />
                )}
            </button>
            <button
                type="button"
                onClick={() => setActiveTab('roles')}
                className={`relative pb-2.5 text-[12.5px] font-semibold transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                    activeTab === 'roles'
                        ? 'text-slate-900 dark:text-slate-100'
                        : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                <ShieldCheck className="h-3.5 w-3.5" />
                Roles & Multi-Role Matrix
                <span className="rounded-full bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px] font-bold">
                    {roles.length}
                </span>
                {activeTab === 'roles' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF4A1F]" />
                )}
            </button>
        </div>
    );

    return (
        <AppLayout
            title="Employees & Multi-Role RBAC"
            subtitle="Manage staff across all business tenants and branches with multiple roles & custom permission sets."
            actions={
                <div className="flex items-center gap-2">
                    {isOwner && (
                        <Button
                            variant="outline"
                            size="md"
                            onClick={() => setShowRoleModal(true)}
                        >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Create Custom Role
                        </Button>
                    )}
                    {tenant?.canManageOrganization && (
                        <Button
                            variant="primary"
                            size="md"
                            onClick={() => setShowAddModal(true)}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Employee
                        </Button>
                    )}
                </div>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <MetricCard
                    title="Employee Seats Used"
                    value={
                        usage
                            ? `${usage.employees} / ${usage.max_users}`
                            : members.length
                    }
                    description="Active staff seats under your subscription"
                    icon={Users}
                    colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                />
                <MetricCard
                    title="Business Tenants Covered"
                    value={tenants.length}
                    description="Manage staff per business and branch"
                    icon={Store}
                    colorClass="bg-sky-50 dark:bg-sky-500/10 text-sky-600"
                />
                <MetricCard
                    title="Available Assignable Roles"
                    value={roles.length}
                    description="Assign 1 or multiple roles per employee"
                    icon={ShieldCheck}
                    colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                />
            </div>

            {activeTab === 'employees' ? (
                <DataTable<TeamMember>
                    data={filteredMembers}
                    columns={employeeColumns}
                    tableId="team-employees-table"
                    headerTabs={headerTabs}
                    selectable={false}
                    hideCheckbox
                    syncUrlParams={false}
                    searchPlaceholder="Search employee name, email, role, branch..."
                    filterContent={
                        tenants.length > 1 ? (
                            <div className="w-56">
                                <Select
                                    size="sm"
                                    label="Filter by Business Tenant"
                                    value={tenantFilter}
                                    onChange={(e) =>
                                        setTenantFilter(
                                            String(e.target.value)
                                        )
                                    }
                                    options={tenantFilterOptions}
                                />
                            </div>
                        ) : undefined
                    }
                    actions={(row) => (
                        <TableActionMenu
                            items={[
                                {
                                    key: 'assign-roles',
                                    label: 'Assign Roles',
                                    icon: <Edit className="h-3.5 w-3.5" />,
                                    onClick: () => openEditMember(row),
                                    hidden: row.is_owner,
                                },
                            ]}
                        />
                    )}
                    emptyState={
                        <EmptyState
                            title="No employees found"
                            description="Add staff members and assign one or multiple roles across branches."
                            icon={Users}
                        />
                    }
                />
            ) : (
                <DataTable<RoleOption>
                    data={roles}
                    columns={roleColumns}
                    tableId="team-roles-table"
                    keyExtractor={(item) => item.value}
                    headerTabs={headerTabs}
                    selectable={false}
                    hideCheckbox
                    hideViewToggle
                    syncUrlParams={false}
                    searchPlaceholder="Search role or permission..."
                    emptyState={
                        <EmptyState
                            title="No roles configured"
                            icon={ShieldCheck}
                        />
                    }
                />
            )}

            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-lg rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e2329] shadow-xl max-h-[92vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div className="flex items-center gap-2">
                                <UserPlus className="h-4 w-4 text-[#FF4A1F]" />
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Onboard Employee & Assign Roles
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form
                            onSubmit={handleAddEmployee}
                            className="p-5 space-y-3.5"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Full Name"
                                    required
                                    placeholder="Dr. Karim Uddin"
                                    value={addForm.data.name}
                                    onChange={(e) =>
                                        addForm.setData('name', e.target.value)
                                    }
                                    error={addForm.errors.name}
                                />
                                <Input
                                    label="Work Email"
                                    type="email"
                                    required
                                    placeholder="karim@pharmacy.com"
                                    value={addForm.data.email}
                                    onChange={(e) =>
                                        addForm.setData('email', e.target.value)
                                    }
                                    error={addForm.errors.email}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Phone Number"
                                    placeholder="+880 17..."
                                    value={addForm.data.phone}
                                    onChange={(e) =>
                                        addForm.setData('phone', e.target.value)
                                    }
                                />
                                <Input
                                    label="Initial Password"
                                    type="password"
                                    placeholder="Min 8 chars (optional)"
                                    value={addForm.data.password}
                                    onChange={(e) =>
                                        addForm.setData(
                                            'password',
                                            e.target.value
                                        )
                                    }
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Select
                                    label="Business Tenant"
                                    required
                                    value={addForm.data.tenant_id}
                                    onChange={(e) => {
                                        addForm.setData(
                                            'tenant_id',
                                            String(e.target.value)
                                        );
                                        addForm.setData('branch_id', '');
                                    }}
                                    options={tenants.map((t) => ({
                                        id: t.id,
                                        value: String(t.id),
                                        name: t.name,
                                    }))}
                                />
                                <Select
                                    label="Assigned Branch"
                                    value={addForm.data.branch_id}
                                    onChange={(e) =>
                                        addForm.setData(
                                            'branch_id',
                                            String(e.target.value)
                                        )
                                    }
                                    options={addBranchOptions}
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Assign Roles (Select one or multiple)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {roles.map((r) => {
                                        const checked =
                                            addForm.data.roles.includes(
                                                r.value
                                            );
                                        return (
                                            <label
                                                key={r.value}
                                                className={`flex items-start gap-2 rounded-[4px] border p-2.5 cursor-pointer transition-colors ${
                                                    checked
                                                        ? 'border-[#FF4A1F] bg-orange-50/60 dark:bg-[#FF4A1F]/10'
                                                        : 'border-slate-200 dark:border-slate-700'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() =>
                                                        toggleFormRole(
                                                            addForm.data.roles,
                                                            r.value,
                                                            (next) =>
                                                                addForm.setData(
                                                                    'roles',
                                                                    next
                                                                )
                                                        )
                                                    }
                                                    className="mt-0.5 rounded-[2px] border-slate-300 text-[#FF4A1F] focus:ring-[#FF4A1F]"
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                                        {r.label}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 line-clamp-2">
                                                        {r.description}
                                                    </p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowAddModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={addForm.processing}
                                >
                                    Add Employee
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editingMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e2329] shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Update Roles: {editingMember.name}
                                </h2>
                                <p className="text-[11px] text-slate-400">
                                    {editingMember.tenant_name}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingMember(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form
                            onSubmit={handleUpdateMember}
                            className="p-5 space-y-3.5"
                        >
                            <Select
                                label="Assigned Branch"
                                value={editForm.data.branch_id}
                                onChange={(e) =>
                                    editForm.setData(
                                        'branch_id',
                                        String(e.target.value)
                                    )
                                }
                                options={editBranchOptions}
                            />

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Assigned Roles (Multi-Role)
                                </label>
                                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                    {roles.map((r) => {
                                        const checked =
                                            editForm.data.roles.includes(
                                                r.value
                                            );
                                        return (
                                            <label
                                                key={r.value}
                                                className={`flex items-center gap-2 rounded-[4px] border px-3 py-2 cursor-pointer ${
                                                    checked
                                                        ? 'border-[#FF4A1F] bg-orange-50/50 dark:bg-[#FF4A1F]/10'
                                                        : 'border-slate-200 dark:border-slate-700'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() =>
                                                        toggleFormRole(
                                                            editForm.data.roles,
                                                            r.value,
                                                            (next) =>
                                                                editForm.setData(
                                                                    'roles',
                                                                    next
                                                                )
                                                        )
                                                    }
                                                    className="rounded-[2px] border-slate-300 text-[#FF4A1F] focus:ring-[#FF4A1F]"
                                                />
                                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                    {r.label}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                                <input
                                    type="checkbox"
                                    checked={editForm.data.is_active}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'is_active',
                                            e.target.checked
                                        )
                                    }
                                    className="rounded-[2px] border-slate-300 text-[#FF4A1F]"
                                />
                                Account membership active
                            </label>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setEditingMember(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={editForm.processing}
                                >
                                    Save Assignment
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showRoleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e2329] shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-[#FF4A1F]" />
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Define Custom Staff Role
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRoleModal(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form
                            onSubmit={handleCreateRole}
                            className="p-5 space-y-3"
                        >
                            <Input
                                label="Role Name"
                                required
                                placeholder="e.g. Shift Supervisor"
                                value={roleForm.data.name}
                                onChange={(e) =>
                                    roleForm.setData('name', e.target.value)
                                }
                                error={roleForm.errors.name}
                            />
                            <Input
                                label="Description"
                                placeholder="Brief responsibility summary"
                                value={roleForm.data.description}
                                onChange={(e) =>
                                    roleForm.setData(
                                        'description',
                                        e.target.value
                                    )
                                }
                            />

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Permissions Included
                                </label>
                                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                    {permissionCatalog.map((perm) => (
                                        <label
                                            key={perm.key}
                                            className="flex items-center gap-2 rounded-[4px] border border-slate-200 dark:border-slate-700 px-3 py-1.5 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={roleForm.data.permissions.includes(
                                                    perm.key
                                                )}
                                                onChange={() =>
                                                    togglePermission(perm.key)
                                                }
                                                className="rounded-[2px] border-slate-300 text-[#FF4A1F]"
                                            />
                                            <span className="text-xs text-slate-800 dark:text-slate-200">
                                                {perm.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowRoleModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={roleForm.processing}
                                >
                                    Create Role
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
