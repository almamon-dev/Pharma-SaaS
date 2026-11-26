import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { UserPlus, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { BrtaField, BrtaFormGrid, BrtaFormModal, brtaInputClass } from '@/Components/ui/BrtaForm';

interface QuickCustomerModalProps {
    open: boolean;
    onClose: () => void;
    onCustomerCreated: (customer: { id: number; name: string; phone?: string | null }) => void;
}

export default function QuickCustomerModal({
    open,
    onClose,
    onCustomerCreated,
}: QuickCustomerModalProps) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [allergies, setAllergies] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Customer name is required.');
            return;
        }

        setLoading(true);
        setError(null);

        router.post(
            route('crm.customers.store'),
            {
                name: name.trim(),
                phone: phone.trim() || null,
                address: address.trim() || null,
                allergies: allergies.trim() || null,
            },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    setLoading(false);
                    // Find the newly created customer from page props if available
                    const customers = (page.props as any)?.customers as Array<any> | undefined;
                    const created = customers?.find((c) => c.name === name.trim() || (phone && c.phone === phone.trim()));
                    if (created) {
                        onCustomerCreated(created);
                    }
                    onClose();
                    setName('');
                    setPhone('');
                    setAddress('');
                    setAllergies('');
                },
                onError: (errs) => {
                    setLoading(false);
                    const firstMsg = Object.values(errs)[0];
                    setError(typeof firstMsg === 'string' ? firstMsg : 'Failed to create customer.');
                },
            }
        );
    };

    return (
        <BrtaFormModal
            open={open}
            onClose={onClose}
            onSubmit={handleSubmit}
            title="Quick Add Customer (নতুন কাস্টমার)"
            icon={<UserPlus className="h-4 w-4" />}
            maxWidth="2xl"
            footerProps={{
                cancelLabel: 'Cancel',
                submitLabel: 'Save & Select',
                submitting: loading,
            }}
        >
            {error && (
                <div className="p-2.5 rounded-[2px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-300">
                    {error}
                </div>
            )}

            <BrtaFormGrid>
                <BrtaField label="Customer Name" required>
                    <input
                        placeholder="e.g. মো: রফিকুল ইসলাম"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoFocus
                        className={brtaInputClass}
                    />
                </BrtaField>
                <BrtaField label="Phone Number">
                    <input
                        placeholder="e.g. 017XXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={`${brtaInputClass} font-mono`}
                    />
                </BrtaField>
                <BrtaField label="Address / Area">
                    <input
                        placeholder="e.g. মিরপুর-১০, ঢাকা"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
                <BrtaField label="Drug Allergies">
                    <input
                        placeholder="e.g. Penicillin, Sulfa"
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                        className={brtaInputClass}
                    />
                </BrtaField>
            </BrtaFormGrid>
        </BrtaFormModal>
    );
}

