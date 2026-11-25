import { useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    Edit,
    RotateCcw,
    Shield,
    Sparkles,
    UserCog,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { FormLayoutProvider } from '@/Components/ui/FormLayout';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { StatusDot } from '@/Components/ui/StatusDot';

export interface DemoRoleData {
    id: number;
    role_id: string;
    role_key: string;
    title_en: string;
    title_bn?: string | null;
    subtitle_en: string;
    subtitle_bn?: string | null;
    description_en?: string | null;
    description_bn?: string | null;
    email: string;
    tags_en?: string[] | null;
    tags_bn?: string[] | null;
    features_en?: string[] | null;
    features_bn?: string[] | null;
    restrictions_en?: string[] | null;
    restrictions_bn?: string[] | null;
    sort_order: number;
    is_active: boolean;
}

interface AdminDemoRolesProps {
    roles: DemoRoleData[];
}

export default function AdminDemoRoles({ roles }: AdminDemoRolesProps) {
    const [editingRole, setEditingRole] = useState<DemoRoleData | null>(null);
    const [search, setSearch] = useState('');

    const form = useForm({
        title_en: '',
        title_bn: '',
        subtitle_en: '',
        subtitle_bn: '',
        description_en: '',
        description_bn: '',
        email: '',
        tags_en: '',
        tags_bn: '',
        features_en: '',
        features_bn: '',
        restrictions_en: '',
        restrictions_bn: '',
        is_active: true,
    });

    const openEdit = (role: DemoRoleData) => {
        setEditingRole(role);
        form.setData({
            title_en: role.title_en || '',
            title_bn: role.title_bn || '',
            subtitle_en: role.subtitle_en || '',
            subtitle_bn: role.subtitle_bn || '',
            description_en: role.description_en || '',
            description_bn: role.description_bn || '',
            email: role.email || '',
            tags_en: (role.tags_en || []).join(', '),
            tags_bn: (role.tags_bn || []).join(', '),
            features_en: (role.features_en || []).join('\n'),
            features_bn: (role.features_bn || []).join('\n'),
            restrictions_en: (role.restrictions_en || []).join('\n'),
            restrictions_bn: (role.restrictions_bn || []).join('\n'),
            is_active: Boolean(role.is_active),
        });
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRole) return;

        form.put(route('admin.demo_roles.update', editingRole.id), {
            preserveScroll: true,
            onSuccess: () => setEditingRole(null),
        });
    };

    const handleToggle = (role: DemoRoleData) => {
        router.patch(
            route('admin.demo_roles.toggle', role.id),
            {},
            { preserveScroll: true }
        );
    };

    const handleReset = () => {
        if (
            confirm(
                'Are you sure you want to reset all demo roles, descriptions, and features to factory defaults?'
            )
        ) {
            router.post(
                route('admin.demo_roles.reset'),
                {},
                { preserveScroll: true }
            );
        }
    };

    const filteredRoles = roles.filter((r) => {
        const q = search.toLowerCase();
        return (
            r.title_en.toLowerCase().includes(q) ||
            r.role_id.toLowerCase().includes(q) ||
            (r.title_bn && r.title_bn.includes(q))
        );
    });

    return (
        <AppLayout
            title="Demo Roles & Landing Features"
            subtitle="Dynamically configure and customize the roles, descriptions, capabilities, and restrictions shown on the public landing page demo explorer."
            actions={
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="flex items-center gap-1.5"
                >
                    <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                    <span>Reset to Defaults</span>
                </Button>
            }
        >
            <div className="space-y-4">
                {/* Search Bar */}
                <Card>
                    <CardContent className="p-3">
                        <Input
                            placeholder="Search demo role by title or key..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </CardContent>
                </Card>

                {/* Roles Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredRoles.map((role) => (
                        <Card
                            key={role.id}
                            className={`flex flex-col justify-between transition-all ${
                                !role.is_active ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/40' : ''
                            }`}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#FF4A1F]/10 text-[#FF4A1F]">
                                            <UserCog className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                                <span>{role.title_en}</span>
                                                {role.title_bn && (
                                                    <span className="text-xs font-normal text-slate-400">
                                                        ({role.title_bn})
                                                    </span>
                                                )}
                                            </CardTitle>
                                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                                                role_key: {role.role_key} · {role.email}
                                            </p>
                                        </div>
                                    </div>
                                    <StatusDot
                                        variant={role.is_active ? 'emerald' : 'slate'}
                                    >
                                        {role.is_active ? 'Active' : 'Disabled'}
                                    </StatusDot>
                                </div>
                            </CardHeader>

                            <CardContent className="pt-0 space-y-3 flex-1 flex flex-col justify-between text-xs">
                                <div className="space-y-2">
                                    {role.subtitle_en && (
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            {role.subtitle_en}
                                        </p>
                                    )}

                                    {role.description_en && (
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                            {role.description_en}
                                        </p>
                                    )}

                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {(role.tags_en || []).map((t, idx) => (
                                            <span
                                                key={idx}
                                                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium"
                                            >
                                                {t}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Features count & Restrictions count */}
                                    <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800">
                                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {(role.features_en || []).length} Features
                                        </span>
                                        <span>·</span>
                                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                            <Shield className="h-3 w-3" />
                                            {(role.restrictions_en || []).length} Restrictions
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        fullWidth
                                        onClick={() => openEdit(role)}
                                        className="flex items-center justify-center gap-1.5"
                                    >
                                        <Edit className="h-3 w-3" />
                                        <span>Edit Features & Info</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleToggle(role)}
                                        className={role.is_active ? 'text-rose-600' : 'text-emerald-600'}
                                    >
                                        {role.is_active ? 'Disable' : 'Enable'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Edit Modal */}
            {editingRole && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
                    <div className="relative w-full max-w-3xl rounded-lg bg-white dark:bg-[#181d24] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-[#FF4A1F]" />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Edit Demo Role: {editingRole.title_en}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingRole(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <FormLayoutProvider labelWidth="sm:w-[175px]">
                            <form onSubmit={handleSave} className="p-5 space-y-3 max-h-[80vh] overflow-y-auto text-xs">
                                <Input
                                    label="Role Key"
                                    readOnly
                                    value={editingRole.role_key}
                                />
                                <Input
                                    label="Title (English)"
                                    required
                                    value={form.data.title_en}
                                    onChange={(e) => form.setData('title_en', e.target.value)}
                                    error={form.errors.title_en}
                                />
                                <Input
                                    label="Title (বাংলা)"
                                    value={form.data.title_bn}
                                    onChange={(e) => form.setData('title_bn', e.target.value)}
                                    error={form.errors.title_bn}
                                />
                                <Input
                                    label="Subtitle (English)"
                                    required
                                    value={form.data.subtitle_en}
                                    onChange={(e) => form.setData('subtitle_en', e.target.value)}
                                    error={form.errors.subtitle_en}
                                />
                                <Input
                                    label="Subtitle (বাংলা)"
                                    value={form.data.subtitle_bn}
                                    onChange={(e) => form.setData('subtitle_bn', e.target.value)}
                                    error={form.errors.subtitle_bn}
                                />
                                <Input
                                    label="Autofill Demo Email"
                                    required
                                    value={form.data.email}
                                    onChange={(e) => form.setData('email', e.target.value)}
                                    error={form.errors.email}
                                />
                                <Textarea
                                    label="Description (English)"
                                    rows={3}
                                    placeholder="Explain the role responsibilities in the pharmacy..."
                                    value={form.data.description_en}
                                    onChange={(e) => form.setData('description_en', e.target.value)}
                                />
                                <Textarea
                                    label="Description (বাংলা)"
                                    rows={3}
                                    placeholder="ফার্মেসিতে এই রোলের কাজ ও দায়িত্ব..."
                                    value={form.data.description_bn}
                                    onChange={(e) => form.setData('description_bn', e.target.value)}
                                />
                                <Input
                                    label="Tags (English)"
                                    placeholder="Dashboard, POS, Reports"
                                    value={form.data.tags_en}
                                    onChange={(e) => form.setData('tags_en', e.target.value)}
                                />
                                <Input
                                    label="Tags (বাংলা)"
                                    placeholder="ড্যাশবোর্ড, পিওএস, রিপোর্ট"
                                    value={form.data.tags_bn}
                                    onChange={(e) => form.setData('tags_bn', e.target.value)}
                                />
                                <Textarea
                                    label="Features (English)"
                                    rows={4}
                                    placeholder="Monitor multi-branch revenue&#10;Scan barcodes and bill"
                                    value={form.data.features_en}
                                    onChange={(e) => form.setData('features_en', e.target.value)}
                                />
                                <Textarea
                                    label="Features (বাংলা)"
                                    rows={4}
                                    placeholder="সব শাখার বিক্রি এক পর্দায় দেখুন&#10;বারকোড স্ক্যান করে বিল তৈরি"
                                    value={form.data.features_bn}
                                    onChange={(e) => form.setData('features_bn', e.target.value)}
                                />
                                <Textarea
                                    label="Restrictions (English)"
                                    rows={3}
                                    placeholder="Other tenant data is isolated&#10;Wholesale costs hidden"
                                    value={form.data.restrictions_en}
                                    onChange={(e) => form.setData('restrictions_en', e.target.value)}
                                />
                                <Textarea
                                    label="Restrictions (বাংলা)"
                                    rows={3}
                                    placeholder="অন্য ব্যবসার ডেটা দেখা যায় না&#10;পাইকারি মূল্য লুকানো"
                                    value={form.data.restrictions_bn}
                                    onChange={(e) => form.setData('restrictions_bn', e.target.value)}
                                />

                                <div className="flex items-center gap-2 sm:pl-[185px] pt-2">
                                    <input
                                        type="checkbox"
                                        id="is_active_demo"
                                        checked={form.data.is_active}
                                        onChange={(e) => form.setData('is_active', e.target.checked)}
                                        className="rounded border-slate-300 text-[#FF4A1F] focus:ring-[#FF4A1F]"
                                    />
                                    <label
                                        htmlFor="is_active_demo"
                                        className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                                    >
                                        Display this role on the public landing page demo explorer
                                    </label>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingRole(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="sm"
                                        isLoading={form.processing}
                                    >
                                        Save Changes & Sync Landing Page
                                    </Button>
                                </div>
                            </form>
                        </FormLayoutProvider>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
