import React, { useState } from 'react';
import { AlertCircle, Building2, Check, Stethoscope, User, UserCheck, UserPlus, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { FormLayoutProvider, HorizontalFormRow } from '@/Components/ui/FormLayout';
import { Input } from '@/Components/ui/Input';
import { CustomerItem } from '../CreateOrder';

interface SalesCustomerModalProps {
    open: boolean;
    onClose: () => void;
    onCustomerCreated: (customer: CustomerItem) => void;
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
}: SalesCustomerModalProps) {
    const [customerType, setCustomerType] = useState<CustomerType>('registered');
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
            // Get CSRF token from meta tag or cookie
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

            const res = await fetch('/sales/customers/quick-store', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-[4px] bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#12161c]">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-[3px] bg-[#FF4A1F]/10 dark:bg-[#FF4A1F]/20 flex items-center justify-center text-[#FF4A1F]">
                            <UserPlus className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Customer Registration (কাস্টমার নিবন্ধন)
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Quick create customer without leaving Sales Order screen
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-[3px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <FormLayoutProvider labelWidth="sm:w-[135px]">
                    <form onSubmit={handleSubmit} className="p-4 space-y-3">
                        {error && (
                            <div className="p-2.5 rounded-[3px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {infoMessage && (
                            <div className="p-2.5 rounded-[3px] bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                                <Check className="h-4 w-4 shrink-0" />
                                <span>{infoMessage}</span>
                            </div>
                        )}

                        {/* Customer Type Selector (4 Pills) */}
                        <HorizontalFormRow label="Customer Type" required>
                            <div className="grid grid-cols-2 gap-2">
                                {CUSTOMER_TYPES.map((t) => {
                                    const Icon = t.icon;
                                    const isSelected = customerType === t.type;
                                    return (
                                        <button
                                            key={t.type}
                                            type="button"
                                            onClick={() => setCustomerType(t.type)}
                                            className={`p-2 rounded-[3px] border text-left transition-all cursor-pointer flex items-start gap-2 ${
                                                isSelected
                                                    ? 'border-[#FF4A1F] bg-[#FF4A1F]/5 dark:bg-[#FF4A1F]/10 ring-1 ring-[#FF4A1F]'
                                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181d26] hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                        >
                                            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${isSelected ? 'text-[#FF4A1F]' : 'text-slate-400'}`} />
                                            <div className="min-w-0">
                                                <div className={`text-xs font-bold leading-tight ${isSelected ? 'text-[#FF4A1F]' : 'text-slate-800 dark:text-slate-200'}`}>
                                                    {t.label}
                                                </div>
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                                                    {t.sublabel}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </HorizontalFormRow>

                        {/* Name */}
                        <Input
                            label="Full Name *"
                            placeholder="e.g. Dr. Rafiqul Islam / Rahim Mia"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-8 text-xs"
                            autoFocus
                        />

                        {/* Phone & Duplicate Warning Notice */}
                        <div>
                            <Input
                                label={`Phone Number ${customerType === 'walk_in' ? '(ঐচ্ছিক)' : '*'}`}
                                placeholder="017XXXXXXXX or +8801..."
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="h-8 text-xs"
                            />
                            <p className="mt-1 sm:pl-[145px] text-[10px] text-slate-400 dark:text-slate-500">
                                Duplicate prevention: If this phone already exists, the existing profile will be automatically linked.
                            </p>
                        </div>

                        {/* Allergies / Medical Note */}
                        <Input
                            label="Allergies / Notes"
                            placeholder="e.g. Penicillin allergy, Diabetic, Asthma"
                            value={allergies}
                            onChange={(e) => setAllergies(e.target.value)}
                            className="h-8 text-xs"
                        />

                        {/* Address (Optional) */}
                        <Input
                            label="Address / Org"
                            placeholder="e.g. House 42, Road 11, Banani, Dhaka"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="h-8 text-xs"
                        />

                        {/* Footer Actions */}
                        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onClose}
                                className="rounded-[3px] text-xs"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                isLoading={loading}
                                className="bg-[#FF4A1F] hover:bg-[#e03d15] text-white rounded-[3px] text-xs font-bold"
                            >
                                Save & Select Customer
                            </Button>
                        </div>
                    </form>
                </FormLayoutProvider>
            </div>
        </div>
    );
}

