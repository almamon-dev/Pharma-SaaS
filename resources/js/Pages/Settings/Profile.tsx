import React, { useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Eye, EyeOff, Lock, Mail, Phone, Save, User } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
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
                            <User className="h-4 w-4 text-[#FF4A1F]" />
                            <CardTitle>Personal Details</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submitProfile} className="space-y-4">
                            <Input
                                label="Full Name"
                                required
                                value={profileForm.data.name}
                                onChange={(e) =>
                                    profileForm.setData('name', e.target.value)
                                }
                                error={profileForm.errors.name}
                                icon={<User className="h-3.5 w-3.5" />}
                            />
                            <Input
                                label="Email Address"
                                type="email"
                                required
                                value={profileForm.data.email}
                                onChange={(e) =>
                                    profileForm.setData('email', e.target.value)
                                }
                                error={profileForm.errors.email}
                                icon={<Mail className="h-3.5 w-3.5" />}
                            />
                            <Input
                                label="Phone Number"
                                value={profileForm.data.phone}
                                onChange={(e) =>
                                    profileForm.setData('phone', e.target.value)
                                }
                                error={profileForm.errors.phone}
                                icon={<Phone className="h-3.5 w-3.5" />}
                            />

                            <div className="flex justify-end pt-2">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={profileForm.processing}
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    Save Profile
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4 text-[#FF4A1F]" />
                            <CardTitle>Change Password</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submitPassword} className="space-y-4">
                            <Input
                                label="Current Password"
                                type={showCurrent ? 'text' : 'password'}
                                required
                                value={passwordForm.data.current_password}
                                onChange={(e) =>
                                    passwordForm.setData(
                                        'current_password',
                                        e.target.value
                                    )
                                }
                                error={passwordForm.errors.current_password}
                                icon={<Lock className="h-3.5 w-3.5" />}
                                rightIcon={
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowCurrent((prev) => !prev)
                                        }
                                        className="text-slate-400 hover:text-slate-600 focus:outline-none"
                                    >
                                        {showCurrent ? (
                                            <EyeOff className="h-3.5 w-3.5" />
                                        ) : (
                                            <Eye className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                }
                            />

                            <Input
                                label="New Password"
                                type={showNew ? 'text' : 'password'}
                                required
                                value={passwordForm.data.password}
                                onChange={(e) =>
                                    passwordForm.setData(
                                        'password',
                                        e.target.value
                                    )
                                }
                                error={passwordForm.errors.password}
                                icon={<Lock className="h-3.5 w-3.5" />}
                                rightIcon={
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowNew((prev) => !prev)
                                        }
                                        className="text-slate-400 hover:text-slate-600 focus:outline-none"
                                    >
                                        {showNew ? (
                                            <EyeOff className="h-3.5 w-3.5" />
                                        ) : (
                                            <Eye className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                }
                            />

                            <Input
                                label="Confirm New Password"
                                type={showNew ? 'text' : 'password'}
                                required
                                value={passwordForm.data.password_confirmation}
                                onChange={(e) =>
                                    passwordForm.setData(
                                        'password_confirmation',
                                        e.target.value
                                    )
                                }
                                icon={<Lock className="h-3.5 w-3.5" />}
                            />

                            <div className="flex justify-end pt-2">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={passwordForm.processing}
                                >
                                    <Save className="h-3.5 w-3.5" />
                                    Update Password
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
