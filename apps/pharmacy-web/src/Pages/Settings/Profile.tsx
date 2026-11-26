import React, { useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Eye, EyeOff, Lock, Mail, Phone, Save, User } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { BrtaField, BrtaFormFooter, brtaInputClass } from '@/Components/ui/BrtaForm';
import { SharedPageProps } from '@/types';

export default function ProfileSettings() {
    const { auth } = usePage<SharedPageProps>().props;
    const user = auth?.user;

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);

    const profileForm = useForm({
        name: user?.name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
    });

    const passwordForm = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const submitProfile = (e: React.FormEvent) => {
        e.preventDefault();
        profileForm.put(route('settings.profile.update'), {
            preserveScroll: true,
        });
    };

    const submitPassword = (e: React.FormEvent) => {
        e.preventDefault();
        passwordForm.put(route('settings.password.update'), {
            preserveScroll: true,
            onSuccess: () => passwordForm.reset(),
        });
    };

    return (
        <AppLayout
            title="Profile & Security"
            subtitle="Manage your personal identity and workspace login password"
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-[#0E5F3F]" />
                            <CardTitle>Personal Details</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <form onSubmit={submitProfile}>
                            <div className="p-5 space-y-4">
                                <BrtaField label="Full Name" required error={profileForm.errors.name}>
                                    <input
                                        required
                                        value={profileForm.data.name}
                                        onChange={(e) => profileForm.setData('name', e.target.value)}
                                        className={brtaInputClass}
                                    />
                                </BrtaField>
                                <BrtaField label="Email Address" required error={profileForm.errors.email}>
                                    <input
                                        type="email"
                                        required
                                        value={profileForm.data.email}
                                        onChange={(e) => profileForm.setData('email', e.target.value)}
                                        className={brtaInputClass}
                                    />
                                </BrtaField>
                                <BrtaField label="Phone Number" error={profileForm.errors.phone}>
                                    <input
                                        value={profileForm.data.phone}
                                        onChange={(e) => profileForm.setData('phone', e.target.value)}
                                        className={brtaInputClass}
                                    />
                                </BrtaField>
                            </div>
                            <BrtaFormFooter submitLabel="Save Profile" submitting={profileForm.processing} />
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4 text-[#0E5F3F]" />
                            <CardTitle>Change Password</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <form onSubmit={submitPassword}>
                            <div className="p-5 space-y-4">
                                <BrtaField label="Current Password" required error={passwordForm.errors.current_password}>
                                    <div className="relative">
                                        <input
                                            type={showCurrent ? 'text' : 'password'}
                                            required
                                            value={passwordForm.data.current_password}
                                            onChange={(e) => passwordForm.setData('current_password', e.target.value)}
                                            className={`${brtaInputClass} pr-9`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrent((prev) => !prev)}
                                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </BrtaField>
                                <BrtaField label="New Password" required error={passwordForm.errors.password}>
                                    <div className="relative">
                                        <input
                                            type={showNew ? 'text' : 'password'}
                                            required
                                            value={passwordForm.data.password}
                                            onChange={(e) => passwordForm.setData('password', e.target.value)}
                                            className={`${brtaInputClass} pr-9`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNew((prev) => !prev)}
                                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </BrtaField>
                                <BrtaField label="Confirm Password" required>
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        required
                                        value={passwordForm.data.password_confirmation}
                                        onChange={(e) => passwordForm.setData('password_confirmation', e.target.value)}
                                        className={brtaInputClass}
                                    />
                                </BrtaField>
                            </div>
                            <BrtaFormFooter submitLabel="Update Password" submitting={passwordForm.processing} />
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
