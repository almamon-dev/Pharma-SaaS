import React, { useState } from 'react';
import { AlertCircle, Building2, Check, Stethoscope, User, UserCheck, UserPlus, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { BrtaField, BrtaFormGrid, BrtaFormModal, BrtaOptionItem, BrtaOptionStrip, brtaInputClass } from '@/Components/ui/BrtaForm';
import { CustomerItem } from '../CreateOrder';

interface SalesCustomerModalProps {
    open: boolean;
    onClose: () => void;
    onCustomerCreated: (customer: CustomerItem) => void;
    defaultType?: CustomerType;
}

type CustomerType = 'walk_in' | 'registered' | 'patient' | 'corporate';

const CUSTOMER_TYPES: Array<{
    type: CustomerType;
    label: string;
    sublabel: string;
    icon: React.ElementType;
}> = [
    {
        type: 'registered',
        label: 'Registered Customer',
        sublabel: 'নিয়মিত গ্রাহক',
        icon: UserCheck,
    },
    {
        type: 'walk_in',
        label: 'Walk-in Customer',
        sublabel: 'তাৎক্ষণিক নগদ ক্রেতা',
        icon: User,
    },
    {
        type: 'patient',
        label: 'Registered Patient',
        sublabel: 'ফার্মেসি রোগী',
        icon: Stethoscope,
    },
    {
        type: 'corporate',
        label: 'Corporate / Org',
        sublabel: 'প্রাতিষ্ঠানিক ক্লায়েন্ট',
        icon: Building2,
    },
];

export default function SalesCustomerModal({
    open,
    onClose,
    onCustomerCreated,
    defaultType = 'registered',
}: SalesCustomerModalProps) {
    const [customerType, setCustomerType] = useState<CustomerType>(defaultType);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [allergies, setAllergies] = useState('');
    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Customer name is required.');
            return;
        }

        setLoading(true);
        setError(null);
        setInfoMessage(null);

        try {
            // Get CSRF token from meta tag or XSRF-TOKEN cookie
            const metaCsrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const xsrfCookie = document.cookie
                .split('; ')
                .find((row) => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1];
            const decodedXsrf = xsrfCookie ? decodeURIComponent(xsrfCookie) : '';

            const res = await fetch('/sales/customers/quick-store', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(metaCsrf ? { 'X-CSRF-TOKEN': metaCsrf } : {}),
                    ...(decodedXsrf ? { 'X-XSRF-TOKEN': decodedXsrf } : {}),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    name: name.trim(),
                    phone: phone.trim() || null,
                    customer_type: customerType,
                    allergies: allergies.trim() || null,
                    address: address.trim() || null,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                const firstError = data.errors ? Object.values(data.errors)[0] : data.message;
                setError(Array.isArray(firstError) ? firstError[0] : (firstError || 'Failed to save customer.'));
                setLoading(false);
                return;
            }

            const customer = data.customer as CustomerItem;
            onCustomerCreated(customer);

            if (data.is_existing) {
                setInfoMessage(data.message || 'Existing customer profile found and selected.');
                setTimeout(() => {
                    onClose();
                }, 800);
            } else {
                onClose();
            }
        } catch (err: any) {
            setError(err.message || 'Network error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <BrtaFormModal
            open={open}
            onClose={onClose}
            onSubmit={handleSubmit}
            title="Customer Registration (কাস্টমার নিবন্ধন)"
            subtitle="Quick create customer without leaving Sales Order screen"
            icon={<UserPlus className="h-4 w-4" />}
            maxWidth="3xl"
            footerProps={{
                cancelLabel: 'Cancel',
                submitLabel: 'Save & Select Customer',
                submitting: loading,
            }}
        >
            {error && (
                <div className="p-2.5 rounded-[2px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {infoMessage && (
                <div className="p-2.5 rounded-[2px] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>{infoMessage}</span>
                </div>
            )}

            <BrtaField label="Customer Type" required>
                <BrtaOptionStrip>
                    {CUSTOMER_TYPES.map((t) => (
                        <BrtaOptionItem key={t.type}>
                            <input
                                type="radio"
                                name="sales_cust_type"
                                checked={customerType === t.type}
                                onChange={() => setCustomerType(t.type)}
                                className="accent-[#337AB7]"
                            />
                            <span>{t.label}</span>
                        </BrtaOptionItem>
                    ))}
                </BrtaOptionStrip>
            </BrtaField>

            <BrtaFormGrid>
                <BrtaField label="Full Name (পূর্ণ নাম)" required>
                    <input
                        placeholder="e.g. Dr. Rafiqul Islam / Rahim Mia"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={brtaInputClass}
                        autoFocus
                        required
                    />
                </BrtaField>
                <BrtaField
                    label="Phone Number"
                    required={customerType !== 'walk_in'}
                    hint="Auto-links if phone already exists."
                >
                    <input
                        placeholder="017XXXXXXXX or +8801..."
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>
                <BrtaField label="Medical / Allergies">
                    <input
                        placeholder="e.g. Penicillin allergy, Diabetic"
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
                <BrtaField label="Address / Org">
                    <input
                        placeholder="e.g. House 42, Road 11, Banani, Dhaka"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
            </BrtaFormGrid>
        </BrtaFormModal>
    );
}

