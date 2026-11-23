import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { UserPlus, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#12161c]">
                    <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-[#FF4A1F]" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Quick Add Customer (নতুন কাস্টমার)
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-3">
                    {error && (
                        <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-300">
                            {error}
                        </div>
                    )}

                    <Input
                        label="Customer Name *"
                        placeholder="e.g. মো: রফিকুল ইসলাম"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoFocus
                    />

                    <Input
                        label="Phone Number"
                        placeholder="e.g. 017XXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />

                    <Input
                        label="Address / Area"
                        placeholder="e.g. মিরপুর-১০, ঢাকা"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                    />

                    <Input
                        label="Allergies / Drug Sensitivity"
                        placeholder="e.g. Penicillin, Sulfa"
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                    />

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            isLoading={loading}
                        >
                            Save & Select
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

