import React, { useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Building2,
    Eye,
    EyeOff,
    Globe,
    Lock,
    Mail,
    Phone,
    User,
} from 'lucide-react';
import { AuthLayout } from '@/Layouts/AuthLayout';
import { Input } from '@/Components/ui/Input';
import { Button } from '@/Components/ui/Button';
import { SharedPageProps } from '@/types';

function slugifySubdomain(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export default function Register() {
    const { tenancy } = usePage<SharedPageProps>().props;
    const baseDomain = tenancy?.baseDomain ?? 'localhost';
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [domainCustomized, setDomainCustomized] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        business_name: '',
        domain: '',
        name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
    });

    const handleBusinessNameChange = (value: string) => {
        if (!domainCustomized) {
            setData((prev) => ({
                ...prev,
                business_name: value,
                domain: slugifySubdomain(value),
            }));
            return;
        }
        setData('business_name', value);
    };

    const handleDomainChange = (value: string) => {
        setDomainCustomized(value.trim() !== '');
        setData('domain', value);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('register'));
    };

    return (
        <AuthLayout
            title="Create Your Workspace"
            subtitle="Enter your business details and administrator credentials. You will select a subscription plan on the next step."
            badge="Pharmacy Onboarding"
            size="md"
            highlights={[
                'Step 1 — Register your business & workspace subdomain',
                'Step 2 — Select your subscription plan on the next step',
                'Step 3 — Operate on your isolated domain with Branches, POS & Staff RBAC',
            ]}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Business Name"
                    required
                    placeholder="MedCore Pharmacy Ltd."
                    value={data.business_name}
                    onChange={(e) => handleBusinessNameChange(e.target.value)}
                    error={errors.business_name}
                    icon={<Building2 className="h-3.5 w-3.5" />}
                />

                <Input
                    label="Subdomain"
                    placeholder="medcore"
                    value={data.domain}
                    onChange={(e) => handleDomainChange(e.target.value)}
                    error={errors.domain}
                    icon={<Globe className="h-3.5 w-3.5" />}
                />

                <Input
                    label="Full Name"
                    required
                    placeholder="Enter your full name"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    error={errors.name}
                    icon={<User className="h-3.5 w-3.5" />}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                        label="Email"
                        type="email"
                        required
                        placeholder="you@pharmacy.com"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        error={errors.email}
                        icon={<Mail className="h-3.5 w-3.5" />}
                    />
                    <Input
                        label="Phone"
                        placeholder="+880 1700-000000"
                        value={data.phone}
                        onChange={(e) => setData('phone', e.target.value)}
                        error={errors.phone}
                        icon={<Phone className="h-3.5 w-3.5" />}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Minimum 8 characters"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        error={errors.password}
                        icon={<Lock className="h-3.5 w-3.5" />}
                        rightIcon={
                            <button
                                type="button"
                                onClick={() =>
                                    setShowPassword((prev) => !prev)
                                }
                                className="text-slate-400 hover:text-slate-600 focus:outline-none"
                                aria-label="Toggle password visibility"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                    <Eye className="h-3.5 w-3.5" />
                                )}
                            </button>
                        }
                    />
                    <Input
                        label="Confirm Password"
                        type={showConfirm ? 'text' : 'password'}
                        required
                        placeholder="Confirm your password"
                        value={data.password_confirmation}
                        onChange={(e) =>
                            setData('password_confirmation', e.target.value)
                        }
                        icon={<Lock className="h-3.5 w-3.5" />}
                        rightIcon={
                            <button
                                type="button"
                                onClick={() =>
                                    setShowConfirm((prev) => !prev)
                                }
                                className="text-slate-400 hover:text-slate-600 focus:outline-none"
                                aria-label="Toggle confirmation password visibility"
                            >
                                {showConfirm ? (
                                    <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                    <Eye className="h-3.5 w-3.5" />
                                )}
                            </button>
                        }
                    />
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    isLoading={processing}
                    className="h-10 font-semibold mt-1"
                >
                    Continue to Plans
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-slate-500 dark:text-slate-400">
                <span>Already have a workspace?</span>
                <a
                    href={
                        tenancy?.demoLoginUrl ??
                        `http://demo.${baseDomain}:8001/login`
                    }
                    className="font-semibold text-[#FF4A1F] hover:text-[#E03E15] transition-colors"
                >
                    Demo Pharmacy Portal
                </a>
                <span>·</span>
                <a
                    href={
                        tenancy?.adminLoginUrl ??
                        `http://admin.${baseDomain}:8001/login`
                    }
                    className="font-semibold text-slate-600 dark:text-slate-300 hover:text-[#FF4A1F] transition-colors"
                >
                    Platform Owner Login
                </a>
            </div>
        </AuthLayout>
    );
}
