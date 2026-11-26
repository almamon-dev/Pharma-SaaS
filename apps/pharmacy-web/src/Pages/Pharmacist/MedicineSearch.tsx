import React, { useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import { ArrowLeftRight, Pill, Search, ShieldCheck, X } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import PharmacistMobileNav from './components/PharmacistMobileNav';
import { PharmacistBranchContext } from './types';

interface MedicineItem {
    id: number;
    key: string;
    name: string;
    generic_name: string;
    strength: string;
    dosage_form: string;
    manufacturer: string;
    sku: string;
    barcode: string | null;
    storage_condition: string;
    requires_prescription: boolean;
    stock_status: 'in_stock' | 'low' | 'out_of_stock';
}

interface MedicineSearchProps {
    context: PharmacistBranchContext;
    medicines: MedicineItem[];
}

export default function PharmacistMedicineSearch({ context, medicines }: MedicineSearchProps) {
    const [query, setQuery] = useState('');
    const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low' | 'out_of_stock'>('all');
    const [formFilter, setFormFilter] = useState<string>('all');
    const [rxOnly, setRxOnly] = useState(false);
    const [altTarget, setAltTarget] = useState<MedicineItem | null>(null);

    const dosageForms = useMemo(() => {
        const set = new Set<string>();
        medicines.forEach((m) => {
            if (m.dosage_form) set.add(m.dosage_form);
        });
        return Array.from(set).sort();
    }, [medicines]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return medicines.filter((m) => {
            if (stockFilter !== 'all' && m.stock_status !== stockFilter) return false;
            if (formFilter !== 'all' && m.dosage_form !== formFilter) return false;
            if (rxOnly && !m.requires_prescription) return false;
            if (!q) return true;
            return (
                m.name.toLowerCase().includes(q) ||
                m.generic_name.toLowerCase().includes(q) ||
                m.manufacturer.toLowerCase().includes(q) ||
                m.sku.toLowerCase().includes(q) ||
                (m.barcode && m.barcode.toLowerCase().includes(q))
            );
        });
    }, [medicines, query, stockFilter, formFilter, rxOnly]);

    const alternatives = useMemo(() => {
        if (!altTarget) return [];
        const gen = altTarget.generic_name.toLowerCase();
        if (!gen || gen === '—') return [];
        return medicines.filter(
            (m) =>
                m.id !== altTarget.id &&
                m.generic_name.toLowerCase() === gen &&
                m.stock_status !== 'out_of_stock'
        );
    }, [altTarget, medicines]);

    const renderStockBadge = (status: MedicineItem['stock_status']) => {
        if (status === 'out_of_stock') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                    Out of stock
                </span>
            );
        }
        if (status === 'low') {
            return (
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
                    Low
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 dark:bg-emerald-950/40 dark:text-emerald-300">
                In stock
            </span>
        );
    };

    return (
        <AppLayout title="Medicine Search">
            <Head title="Medicine Search" />
            <PharmacistMobileNav />

            <div className="w-full space-y-4">
                {/* Header & Search */}
                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                            <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                                Medicine Search & Clinical Reference
                            </h1>
                            <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                                {context.branch_name} (<span className="font-mono">{context.branch_code}</span>) • Availability shown as In stock / Low / Out of stock (cost & profit hidden)
                            </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-mono text-[#555555] dark:text-slate-400">
                            <ShieldCheck className="w-4 h-4 text-[#0E5F3F]" />
                            {filtered.length} of {medicines.length} items
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                        <div className="md:col-span-5 relative">
                            <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search brand, generic, company, SKU or barcode..."
                                className="w-full h-[36px] pl-9 pr-3 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[13px] text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
                            />
                        </div>

                        <div className="md:col-span-3">
                            <select
                                value={formFilter}
                                onChange={(e) => setFormFilter(e.target.value)}
                                className="w-full h-[36px] px-2.5 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#181d25] text-[13px] text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
                            >
                                <option value="all">All dosage forms</option>
                                {dosageForms.map((f) => (
                                    <option key={f} value={f}>
                                        {f}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-4 flex items-center gap-1.5 flex-wrap">
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'in_stock', label: 'In stock' },
                                { id: 'low', label: 'Low' },
                                { id: 'out_of_stock', label: 'Out of stock' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setStockFilter(opt.id as typeof stockFilter)}
                                    className={`px-2 py-1 text-[11.5px] font-semibold rounded-[2px] cursor-pointer transition-colors ${
                                        stockFilter === opt.id
                                            ? 'bg-[#0E5F3F] text-white'
                                            : 'bg-[#F5F7F4] dark:bg-slate-800 text-[#444444] dark:text-slate-300 border border-[#D5DBD3] dark:border-slate-700'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setRxOnly((v) => !v)}
                                className={`px-2 py-1 text-[11.5px] font-semibold rounded-[2px] cursor-pointer transition-colors ${
                                    rxOnly
                                        ? 'bg-[#D9534F] text-white'
                                        : 'bg-[#F5F7F4] dark:bg-slate-800 text-[#444444] dark:text-slate-300 border border-[#D5DBD3] dark:border-slate-700'
                                }`}
                            >
                                Rx only
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Table */}
                <DataTable<MedicineItem>
                    tableId="pharmacist-medicine-search-table"
                    data={filtered}
                    columns={[
                        {
                            id: 'name',
                            label: 'Medicine / Brand',
                            render: (med) => (
                                <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold text-[#222222] dark:text-white">
                                            {med.name}
                                        </span>
                                        {med.requires_prescription && (
                                            <span className="px-1.5 py-0.2 text-[10.5px] font-semibold rounded-[2px] bg-rose-50 text-[#C9302C] border border-rose-200">
                                                Rx
                                            </span>
                                        )}
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666666] dark:text-slate-400">
                                        {med.sku}
                                        {med.barcode ? ` · ${med.barcode}` : ''}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'generic_name',
                            label: 'Generic',
                            render: (med) => (
                                <span className="text-[#0E5F3F] dark:text-emerald-400 font-medium">
                                    {med.generic_name}
                                </span>
                            ),
                        },
                        {
                            id: 'manufacturer',
                            label: 'Company & Form',
                            render: (med) => (
                                <div>
                                    <div className="text-[#222222] dark:text-slate-200">
                                        {med.manufacturer}
                                    </div>
                                    <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                        {med.dosage_form}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            id: 'storage_condition',
                            label: 'Storage / Rules',
                            render: (med) => (
                                <span className="text-[12px] text-[#555555] dark:text-slate-400">
                                    {med.storage_condition}
                                </span>
                            ),
                        },
                        {
                            id: 'stock_status',
                            label: 'Branch Stock',
                            render: (med) => renderStockBadge(med.stock_status),
                        },
                    ] as Column<MedicineItem>[]}
                    keyExtractor={(med) => med.id}
                    hideToolbar
                    hideCheckbox
                    syncUrlParams={false}
                    actions={(med) => (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => setAltTarget(med)}
                        >
                            <ArrowLeftRight className="w-3 h-3 mr-1" />
                            Same generic
                        </Button>
                    )}
                    actionsColumnClassName="w-[130px] min-w-[130px]"
                    emptyState={
                        <EmptyState icon={Pill} title="No medicines match your search criteria." />
                    }
                />
            </div>

            {/* Same-Generic Alternatives Modal */}
            {altTarget && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-white dark:bg-[#12161c] border border-[#CCCCCC] dark:border-slate-700 rounded-[4px] shadow-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#D5DBD3] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#161a22] flex items-center justify-between">
                            <div>
                                <h3 className="text-[14.5px] font-bold text-[#222222] dark:text-white">
                                    Same-Generic Alternatives
                                </h3>
                                <p className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                    {altTarget.name} — Generic: <strong>{altTarget.generic_name}</strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAltTarget(null)}
                                className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 max-h-[360px] overflow-y-auto space-y-2">
                            {alternatives.length === 0 ? (
                                <div className="text-[13px] text-[#666666] dark:text-slate-400 py-4 text-center">
                                    No other in-stock brands with the same generic ({altTarget.generic_name}) found in this branch.
                                </div>
                            ) : (
                                alternatives.map((alt) => (
                                    <div
                                        key={alt.id}
                                        className="p-3 rounded-[2px] border border-[#D5DBD3] dark:border-slate-700 flex items-center justify-between gap-2"
                                    >
                                        <div>
                                            <div className="font-semibold text-[#222222] dark:text-white flex items-center gap-1.5">
                                                <Pill className="w-3.5 h-3.5 text-[#0E5F3F]" />
                                                <span>{alt.name}</span>
                                            </div>
                                            <div className="text-[11.5px] text-[#555555] dark:text-slate-400">
                                                {alt.manufacturer} • {alt.dosage_form}
                                            </div>
                                        </div>
                                        {renderStockBadge(alt.stock_status)}
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="px-4 py-3 border-t border-[#D5DBD3] dark:border-slate-800 flex justify-end">
                            <Button type="button" variant="outline" onClick={() => setAltTarget(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

