import { useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    Edit,
    RotateCcw,
    Shield,
    Sparkles,
    UserCog,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { StatusDot } from '@/Components/ui/StatusDot';
import {
    BrtaField,
    BrtaFormGrid,
    BrtaFormModal,
    BrtaOptionItem,
    BrtaOptionStrip,
    brtaInputClass,
    brtaTextareaClass,
} from '@/Components/ui/BrtaForm';

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
                                        <div className="flex h-9 w-9 items-center justify-center rounded-[2px] bg-[#0E5F3F]/10 text-[#0E5F3F]">
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
                                            <p className="text-xs text-slate-500 tabular-nums mt-0.5">
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
                                                className="px-1.5 py-0.5 rounded-[2px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium"
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
                                        variant={role.is_active ? 'danger' : 'primary'}
                                        size="sm"
                                        onClick={() => handleToggle(role)}
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
            <BrtaFormModal
                open={Boolean(editingRole)}
                onClose={() => setEditingRole(null)}
                onSubmit={handleSave}
                title={editingRole ? `Edit Demo Role: ${editingRole.title_en}` : 'Edit Demo Role'}
                subtitle="Customize landing page demo explorer title, capabilities, and restrictions"
                icon={<Sparkles className="h-4 w-4" />}
                maxWidth="4xl"
                footerProps={{
                    submitLabel: 'Save Changes & Sync Landing Page',
                    submitting: form.processing,
                }}
            >
                <BrtaFormGrid>
                    <BrtaField label="Title (English)" required error={form.errors.title_en}>
                        <input
                            type="text"
                            required
                            value={form.data.title_en}
                            onChange={(e) => form.setData('title_en', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Title (বাংলা)" error={form.errors.title_bn}>
                        <input
                            type="text"
                            value={form.data.title_bn}
                            onChange={(e) => form.setData('title_bn', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>

                    <BrtaField label="Subtitle (English)" required error={form.errors.subtitle_en}>
                        <input
                            type="text"
                            required
                            value={form.data.subtitle_en}
                            onChange={(e) => form.setData('subtitle_en', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Subtitle (বাংলা)" error={form.errors.subtitle_bn}>
                        <input
                            type="text"
                            value={form.data.subtitle_bn}
                            onChange={(e) => form.setData('subtitle_bn', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>

                    <BrtaField
                        label="Autofill Demo Email"
                        required
                        error={form.errors.email}
                        className="md:col-span-2"
                    >
                        <input
                            type="email"
                            required
                            value={form.data.email}
                            onChange={(e) => form.setData('email', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>

                    <BrtaField label="Description (EN)" alignTop>
                        <textarea
                            rows={3}
                            placeholder="Explain the role responsibilities in the pharmacy..."
                            value={form.data.description_en}
                            onChange={(e) => form.setData('description_en', e.target.value)}
                            className={brtaTextareaClass}
                        />
                    </BrtaField>
                    <BrtaField label="Description (বাংলা)" alignTop>
                        <textarea
                            rows={3}
                            placeholder="ফার্মেসিতে এই রোলের কাজ ও দায়িত্ব..."
                            value={form.data.description_bn}
                            onChange={(e) => form.setData('description_bn', e.target.value)}
                            className={brtaTextareaClass}
                        />
                    </BrtaField>

                    <BrtaField label="Tags (English)" hint="Comma separated">
                        <input
                            type="text"
                            placeholder="Dashboard, POS, Reports"
                            value={form.data.tags_en}
                            onChange={(e) => form.setData('tags_en', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>
                    <BrtaField label="Tags (বাংলা)" hint="কমা দিয়ে আলাদা করুন">
                        <input
                            type="text"
                            placeholder="ড্যাশবোর্ড, পিওএস, রিপোর্ট"
                            value={form.data.tags_bn}
                            onChange={(e) => form.setData('tags_bn', e.target.value)}
                            className={brtaInputClass}
                        />
                    </BrtaField>

                    <BrtaField label="Features (EN)" alignTop hint="1 per line">
                        <textarea
                            rows={4}
                            placeholder="Monitor multi-branch revenue&#10;Scan barcodes and bill"
                            value={form.data.features_en}
                            onChange={(e) => form.setData('features_en', e.target.value)}
                            className={brtaTextareaClass}
                        />
                    </BrtaField>
                    <BrtaField label="Features (বাংলা)" alignTop hint="প্রতি লাইনে ১টি">
                        <textarea
                            rows={4}
                            placeholder="সব শাখার বিক্রি এক পর্দায় দেখুন&#10;বারকোড স্ক্যান করে বিল তৈরি"
                            value={form.data.features_bn}
                            onChange={(e) => form.setData('features_bn', e.target.value)}
                            className={brtaTextareaClass}
                        />
                    </BrtaField>

                    <BrtaField label="Restrictions (EN)" alignTop hint="1 per line">
                        <textarea
                            rows={3}
                            placeholder="Other tenant data is isolated&#10;Wholesale costs hidden"
                            value={form.data.restrictions_en}
                            onChange={(e) => form.setData('restrictions_en', e.target.value)}
                            className={brtaTextareaClass}
                        />
                    </BrtaField>
                    <BrtaField label="Restrictions (বাংলা)" alignTop hint="প্রতি লাইনে ১টি">
                        <textarea
                            rows={3}
                            placeholder="অন্য ব্যবসার ডেটা দেখা যায় না&#10;পাইকারি মূল্য লুকানো"
                            value={form.data.restrictions_bn}
                            onChange={(e) => form.setData('restrictions_bn', e.target.value)}
                            className={brtaTextareaClass}
                        />
                    </BrtaField>

                    <BrtaField label="Landing Visibility" className="md:col-span-2">
                        <BrtaOptionStrip>
                            <BrtaOptionItem>
                                <input
                                    type="checkbox"
                                    id="is_active_demo"
                                    checked={form.data.is_active}
                                    onChange={(e) => form.setData('is_active', e.target.checked)}
                                    className="rounded-[2px] border-slate-300 text-[#0E5F3F] focus:ring-[#0E5F3F]"
                                />
                                <span>Display this role on the public landing page demo explorer</span>
                            </BrtaOptionItem>
                        </BrtaOptionStrip>
                    </BrtaField>
                </BrtaFormGrid>
            </BrtaFormModal>
        </AppLayout>
    );
}
