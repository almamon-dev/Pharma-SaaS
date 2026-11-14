import React, { useMemo, useRef, useState } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera,
    Clock,
    GitBranch,
    Package,
    Plus,
    Printer,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { BarcodeCameraModal } from '@/Components/BarcodeCameraModal';
import { BarcodeSvg } from '@/Components/BarcodeSvg';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { MetricCard } from '@/Components/cards/MetricCard';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { SharedPageProps } from '@/types';
import { formatCurrency } from '@/lib/format';

interface MedicineRow {
    id: number;
    name: string;
    generic_name?: string | null;
    manufacturer?: string | null;
    sku: string;
    barcode?: string | null;
    dosage_form: string;
    strength?: string | null;
    unit: string;
    units_per_strip: number;
    units_per_box: number;
    category_name: string;
    reorder_level: number;
    requires_prescription: boolean;
    default_selling_price: number;
    box_selling_price?: number | null;
    available_stock: number;
    is_low_stock: boolean;
    nearest_expiry?: string | null;
    days_to_expiry?: number | null;
    batch_count: number;
}

interface InventoryProps {
    medicines: MedicineRow[];
    categories: Array<{ id: number; name: string }>;
    suppliers: Array<{ id: number; name: string }>;
    filters: {
        q: string;
        filter: string;
        category_id: string;
    };
    activeBranchName?: string | null;
}

const dosageFormOptions = [
    'tablet',
    'capsule',
    'syrup',
    'injection',
    'cream',
    'drops',
    'inhaler',
    'other',
].map((form) => ({
    id: form,
    value: form,
    name: form.charAt(0).toUpperCase() + form.slice(1),
}));

const unitOptions = ['pcs', 'strip', 'box', 'bottle', 'tube', 'vial'].map(
    (unit) => ({
        id: unit,
        value: unit,
        name: unit.charAt(0).toUpperCase() + unit.slice(1),
    })
);

function generateEan13Preview(): string {
    const randomTen = Math.floor(Math.random() * 10_000_000_000)
        .toString()
        .padStart(10, '0');
    const base = `20${randomTen}`;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return `${base}${checkDigit}`;
}

export default function InventoryIndex({
    medicines,
    categories,
    filters,
    activeBranchName,
}: InventoryProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const currency = tenant?.currentTenant?.currency_code ?? 'BDT';

    const [selectedFilter, setSelectedFilter] = useState(
        filters.filter || 'all'
    );
    const [selectedCategory, setSelectedCategory] = useState(
        filters.category_id || ''
    );
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showBarcodeCamera, setShowBarcodeCamera] = useState(false);
    const [labelMedicine, setLabelMedicine] = useState<MedicineRow | null>(null);
    const labelPreviewRef = useRef<HTMLDivElement>(null);

    const handlePrintBarcodeLabel = () => {
        if (!labelMedicine?.barcode) return;
        const svgNode = labelPreviewRef.current?.querySelector('svg');
        const printWin = window.open('', '_blank', 'width=420,height=320');
        if (!printWin || !svgNode) {
            window.print();
            return;
        }

        const doc = printWin.document;
        doc.open();
        doc.write(
            '<!doctype html><html><head><title>Barcode Label</title><style>body{margin:0;padding:16px;font-family:Inter,Arial,sans-serif;display:flex;justify-content:center;color:#0f172a}.card{border:1px dashed #cbd5e1;padding:10px 14px;text-align:center;border-radius:4px}.name{font-size:12px;font-weight:700;margin-bottom:2px}.meta{font-size:10px;color:#475569;margin-bottom:6px}svg{color:#0f172a}</style></head><body></body></html>'
        );
        doc.close();

        const card = doc.createElement('div');
        card.className = 'card';

        const titleEl = doc.createElement('div');
        titleEl.className = 'name';
        titleEl.textContent = labelMedicine.name;

        const metaEl = doc.createElement('div');
        metaEl.className = 'meta';
        metaEl.textContent = `${labelMedicine.sku} · ${formatCurrency(
            labelMedicine.default_selling_price,
            currency
        )}`;

        card.appendChild(titleEl);
        card.appendChild(metaEl);
        card.appendChild(doc.importNode(svgNode, true));
        doc.body.appendChild(card);

        printWin.focus();
        printWin.print();
        printWin.close();
    };

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        generic_name: '',
        manufacturer: '',
        sku: '',
        barcode: '',
        category_id: '',
        dosage_form: 'tablet',
        strength: '',
        unit: 'pcs',
        units_per_strip: '1',
        units_per_box: '1',
        reorder_level: '10',
        requires_prescription: false,
        purchase_price: '',
        box_purchase_price: '',
        selling_price: '',
        box_selling_price: '',
        batch_number: '',
        quantity: '',
        expiry_date: '',
    });

    const parsedUnitsPerBox = Math.max(1, Number(data.units_per_box) || 1);

    const handlePiecePriceInput = (
        kind: 'purchase' | 'selling',
        val: string
    ) => {
        const pieceField =
            kind === 'purchase' ? 'purchase_price' : 'selling_price';
        const boxField =
            kind === 'purchase' ? 'box_purchase_price' : 'box_selling_price';
        const num = Number(val);

        setData((prev) => ({
            ...prev,
            [pieceField]: val,
            [boxField]:
                parsedUnitsPerBox > 1 && val !== '' && !Number.isNaN(num)
                    ? (num * parsedUnitsPerBox).toFixed(2)
                    : prev[boxField],
        }));
    };

    const handleBoxPriceInput = (
        kind: 'purchase' | 'selling',
        val: string
    ) => {
        const pieceField =
            kind === 'purchase' ? 'purchase_price' : 'selling_price';
        const boxField =
            kind === 'purchase' ? 'box_purchase_price' : 'box_selling_price';
        const num = Number(val);

        setData((prev) => ({
            ...prev,
            [boxField]: val,
            [pieceField]:
                val !== '' && !Number.isNaN(num) && prev[pieceField] === ''
                    ? (num / parsedUnitsPerBox).toFixed(2)
                    : prev[pieceField],
        }));
    };

    const applyServerFilters = (
        nextFilter = selectedFilter,
        nextCategory = selectedCategory
    ) => {
        router.get(
            route('inventory.index'),
            {
                filter: nextFilter !== 'all' ? nextFilter : undefined,
                category_id: nextCategory || undefined,
            },
            { preserveState: true, replace: true }
        );
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('inventory.store'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setShowCreateModal(false);
            },
        });
    };

    const lowStockTotal = medicines.filter((m) => m.is_low_stock).length;
    const expiringTotal = medicines.filter(
        (m) =>
            m.days_to_expiry !== null &&
            m.days_to_expiry !== undefined &&
            m.days_to_expiry <= 30
    ).length;

    const categoryFilterOptions = [
        { id: '', value: '', name: 'All Categories' },
        ...categories.map((cat) => ({
            id: cat.id,
            value: String(cat.id),
            name: cat.name,
        })),
    ];

    const categoryModalOptions = [
        { id: '', value: '', name: 'Uncategorized' },
        ...categories.map((cat) => ({
            id: cat.id,
            value: String(cat.id),
            name: cat.name,
        })),
    ];

    const columns = useMemo<Column<MedicineRow>[]>(
        () => [
            {
                id: 'sku',
                label: 'SKU',
                sortable: true,
                render: (med) => (
                    <span className="font-mono font-bold text-[#FF4A1F] text-[11.5px]">
                        {med.sku}
                    </span>
                ),
            },
            {
                id: 'barcode',
                label: 'Barcode',
                sortable: true,
                render: (med) =>
                    med.barcode ? (
                        <button
                            type="button"
                            onClick={() => setLabelMedicine(med)}
                            title={`Barcode ${med.barcode} · Click to view / print label`}
                            className="inline-flex items-center hover:opacity-85 transition-opacity cursor-pointer"
                        >
                            <BarcodeSvg value={med.barcode} compact />
                        </button>
                    ) : (
                        <span className="text-[11.5px] text-slate-400">—</span>
                    ),
            },
            {
                id: 'name',
                label: 'Medicine',
                sortable: true,
                render: (med) => (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {med.name}
                        </span>
                        {med.strength && (
                            <span className="text-[11px] text-slate-400">
                                {med.strength}
                            </span>
                        )}
                        {med.requires_prescription && (
                            <span className="text-[10.5px] font-bold text-[#FF4A1F]">
                                Rx
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'generic_name',
                label: 'Generic / Mfg',
                sortable: true,
                render: (med) => {
                    const summary = `${med.generic_name || med.dosage_form}${
                        med.manufacturer ? ` · ${med.manufacturer}` : ''
                    }`;
                    return (
                        <span
                            className="block max-w-[230px] truncate text-[12px] text-slate-500 dark:text-slate-400"
                            title={summary}
                        >
                            {summary}
                        </span>
                    );
                },
            },
            {
                id: 'category_name',
                label: 'Category',
                sortable: true,
                render: (med) => (
                    <span className="text-[12px] text-slate-600 dark:text-slate-300">
                        {med.category_name}
                    </span>
                ),
            },
            {
                id: 'available_stock',
                label: 'On Hand',
                sortable: true,
                className: 'text-right',
                render: (med) => (
                    <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <span
                            className={`font-semibold tabular-nums ${
                                med.is_low_stock
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-900 dark:text-slate-100'
                            }`}
                        >
                            {med.available_stock} {med.unit}
                        </span>
                        {med.is_low_stock ? (
                            <span className="text-[11px] font-medium text-rose-500 dark:text-rose-400">
                                (Min {med.reorder_level})
                            </span>
                        ) : (
                            <span className="text-[11px] text-slate-400">
                                · {med.batch_count}b
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'nearest_expiry',
                label: 'FEFO Expiry',
                sortable: true,
                render: (med) =>
                    med.nearest_expiry ? (
                        <div className="inline-flex items-center gap-2 whitespace-nowrap">
                            <span className="font-mono text-[11.5px] text-slate-700 dark:text-slate-300">
                                {med.nearest_expiry}
                            </span>
                            {med.days_to_expiry !== null &&
                                med.days_to_expiry !== undefined &&
                                med.days_to_expiry <= 30 && (
                                    <StatusDot
                                        variant={
                                            med.days_to_expiry <= 7
                                                ? 'rose'
                                                : 'amber'
                                        }
                                        className="text-[11px]"
                                    >
                                        {med.days_to_expiry < 0
                                            ? 'Expired'
                                            : `${med.days_to_expiry}d left`}
                                    </StatusDot>
                                )}
                        </div>
                    ) : (
                        <span className="text-slate-400 text-[11.5px]">—</span>
                    ),
            },
            {
                id: 'default_selling_price',
                label: 'Price (Pc / Box)',
                sortable: true,
                className: 'text-right',
                render: (med) => (
                    <div
                        className="inline-flex items-baseline justify-end gap-1 whitespace-nowrap"
                        title={
                            med.units_per_box > 1 && med.box_selling_price
                                ? `${formatCurrency(med.default_selling_price, currency)} / ${med.unit} · ${formatCurrency(med.box_selling_price, currency)} / Box (${med.units_per_box})`
                                : undefined
                        }
                    >
                        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {formatCurrency(med.default_selling_price, currency)}
                        </span>
                        {med.units_per_box > 1 && med.box_selling_price ? (
                            <span className="text-[11px] text-slate-400 tabular-nums">
                                / {formatCurrency(med.box_selling_price, currency)}
                            </span>
                        ) : null}
                    </div>
                ),
            },
        ],
        [currency]
    );

    const headerTabs = (
        <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto hide-scrollbar mb-[-1px]">
            {[
                { key: 'all', label: 'All Stock', count: medicines.length },
                { key: 'low_stock', label: 'Low Stock', count: lowStockTotal },
                {
                    key: 'expiring',
                    label: 'Expiring Soon',
                    count: expiringTotal,
                },
            ].map((tab) => {
                const isActive = selectedFilter === tab.key;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                            setSelectedFilter(tab.key);
                            applyServerFilters(tab.key, selectedCategory);
                        }}
                        className={`flex items-center gap-1.5 pb-2.5 border-b transition-colors whitespace-nowrap cursor-pointer px-1 ${
                            isActive
                                ? 'border-[#ff4a1f] text-[#ff4a1f] dark:border-[#ff4a1f] dark:text-[#ff4a1f]'
                                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <span
                            className={`text-[13px] ${
                                isActive ? 'font-bold' : 'font-medium'
                            }`}
                        >
                            {tab.label}
                        </span>
                        <span
                            className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full transition-colors ${
                                isActive
                                    ? 'bg-orange-50 dark:bg-[#ff4a1f]/20 text-[#ff4a1f] dark:text-orange-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}
                        >
                            {tab.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );

    const filterContent = (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Select
                label="Filter by Category"
                size="sm"
                ariaLabel="Filter by category"
                value={selectedCategory}
                options={categoryFilterOptions}
                onChange={(e) => {
                    const next = String(e.target.value);
                    setSelectedCategory(next);
                    applyServerFilters(selectedFilter, next);
                }}
            />
            {selectedCategory && (
                <div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSelectedCategory('');
                            applyServerFilters(selectedFilter, '');
                        }}
                    >
                        Reset Category
                    </Button>
                </div>
            )}
        </div>
    );

    return (
        <AppLayout
            title="Inventory & FEFO Batches"
            subtitle={`Scoped catalog and active shelf batches for ${activeBranchName ?? 'Active Branch'}`}
            actions={
                tenant?.canManageInventory ? (
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Medicine
                    </Button>
                ) : null
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                        title="Listed Medicines"
                        value={medicines.length}
                        description="Matches current filter"
                        icon={Package}
                        colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                    />
                    <MetricCard
                        title="Low Stock SKUs"
                        value={lowStockTotal}
                        description="Reorder level triggered"
                        icon={AlertTriangle}
                        colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                        valueClassName={lowStockTotal > 0 ? 'text-rose-600' : ''}
                    />
                    <MetricCard
                        title="Expiring <= 30d"
                        value={expiringTotal}
                        description="FEFO priority batches"
                        icon={Clock}
                        colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                        valueClassName={expiringTotal > 0 ? 'text-amber-600' : ''}
                    />
                    <MetricCard
                        title="Active Branch"
                        value={activeBranchName ?? 'Main'}
                        description="Batch stock scope"
                        icon={GitBranch}
                        colorClass="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        valueClassName="text-base sm:text-lg truncate"
                    />
                </div>

                <DataTable
                    tableId="pharmacy-inventory"
                    data={medicines}
                    columns={columns}
                    headerTabs={headerTabs}
                    filterContent={filterContent}
                    searchPlaceholder="Search by brand name, generic, or SKU..."
                    selectable={false}
                    hideCheckbox={true}
                    syncUrlParams={false}
                    emptyState={
                        <EmptyState
                            title="No medicines found"
                            description="No medicines match your current filter criteria. Adjust filters or add a new SKU to your catalog."
                            actionLabel={
                                tenant?.canManageInventory
                                    ? 'Add Medicine'
                                    : undefined
                            }
                            onAction={() => setShowCreateModal(true)}
                        />
                    }
                />
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[4px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Add Medicine & Opening Batch
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Catalog entry with optional opening FEFO
                                    batch for{' '}
                                    {activeBranchName ?? 'current branch'}.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form
                            onSubmit={handleCreateSubmit}
                            className="p-5 space-y-4"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Input
                                    label="Medicine Name"
                                    required
                                    placeholder="Napa Extend"
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    error={errors.name}
                                />
                                <Input
                                    label="SKU Code"
                                    required
                                    placeholder="MED-NAPA-665"
                                    value={data.sku}
                                    onChange={(e) =>
                                        setData('sku', e.target.value)
                                    }
                                    error={errors.sku}
                                />
                                <Input
                                    label="Barcode (EAN / UPC)"
                                    placeholder="Scan box barcode or auto EAN-13"
                                    value={data.barcode}
                                    onChange={(e) =>
                                        setData('barcode', e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                        }
                                    }}
                                    className="pr-20 font-mono text-[12px]"
                                    rightIcon={
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setData(
                                                        'barcode',
                                                        generateEan13Preview()
                                                    )
                                                }
                                                title="Auto-generate valid EAN-13 barcode"
                                                className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-[#FF4A1F] hover:text-[#FF4A1F] cursor-pointer"
                                            >
                                                Auto
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowBarcodeCamera(true)
                                                }
                                                title="Scan barcode with camera"
                                                aria-label="Scan barcode with camera"
                                                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#FF4A1F] cursor-pointer"
                                            >
                                                <Camera className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    }
                                    error={errors.barcode}
                                />
                            </div>

                            {data.barcode.trim() && (
                                <div className="flex items-center justify-between gap-3 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151921] px-3 py-2">
                                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                        Live Barcode Preview
                                    </span>
                                    <BarcodeSvg
                                        value={data.barcode}
                                        height={28}
                                        barWidth={1.3}
                                        fontSize={10}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Generic Name"
                                    placeholder="Paracetamol"
                                    value={data.generic_name}
                                    onChange={(e) =>
                                        setData('generic_name', e.target.value)
                                    }
                                    error={errors.generic_name}
                                />
                                <Input
                                    label="Manufacturer"
                                    placeholder="Beximco Pharma"
                                    value={data.manufacturer}
                                    onChange={(e) =>
                                        setData('manufacturer', e.target.value)
                                    }
                                    error={errors.manufacturer}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Select
                                    label="Category"
                                    value={data.category_id}
                                    options={categoryModalOptions}
                                    onChange={(e) =>
                                        setData(
                                            'category_id',
                                            String(e.target.value)
                                        )
                                    }
                                    error={errors.category_id}
                                />
                                <Select
                                    label="Dosage Form"
                                    required
                                    value={data.dosage_form}
                                    options={dosageFormOptions}
                                    onChange={(e) =>
                                        setData(
                                            'dosage_form',
                                            String(e.target.value)
                                        )
                                    }
                                    error={errors.dosage_form}
                                />
                                <Input
                                    label="Strength"
                                    placeholder="500mg"
                                    value={data.strength}
                                    onChange={(e) =>
                                        setData('strength', e.target.value)
                                    }
                                    error={errors.strength}
                                />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <Select
                                    label="Base Unit"
                                    required
                                    value={data.unit}
                                    options={unitOptions}
                                    onChange={(e) =>
                                        setData('unit', String(e.target.value))
                                    }
                                    error={errors.unit}
                                />
                                <Input
                                    label="Pcs / Strip"
                                    type="number"
                                    min="1"
                                    placeholder="10"
                                    value={data.units_per_strip}
                                    onChange={(e) =>
                                        setData(
                                            'units_per_strip',
                                            e.target.value
                                        )
                                    }
                                    error={errors.units_per_strip}
                                />
                                <Input
                                    label="Pcs / Box"
                                    type="number"
                                    min="1"
                                    placeholder="100"
                                    value={data.units_per_box}
                                    onChange={(e) =>
                                        setData('units_per_box', e.target.value)
                                    }
                                    error={errors.units_per_box}
                                />
                                <Input
                                    label="Reorder Level"
                                    type="number"
                                    required
                                    value={data.reorder_level}
                                    onChange={(e) =>
                                        setData('reorder_level', e.target.value)
                                    }
                                    error={errors.reorder_level}
                                />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <Input
                                    label="Purchase / Pc"
                                    type="number"
                                    step="0.01"
                                    required={!data.box_purchase_price}
                                    placeholder="1.50"
                                    value={data.purchase_price}
                                    onChange={(e) =>
                                        handlePiecePriceInput(
                                            'purchase',
                                            e.target.value
                                        )
                                    }
                                    error={errors.purchase_price}
                                />
                                <Input
                                    label="Box Purchase"
                                    type="number"
                                    step="0.01"
                                    placeholder="150.00"
                                    value={data.box_purchase_price}
                                    onChange={(e) =>
                                        handleBoxPriceInput(
                                            'purchase',
                                            e.target.value
                                        )
                                    }
                                    error={errors.box_purchase_price}
                                />
                                <Input
                                    label="Selling / Pc"
                                    type="number"
                                    step="0.01"
                                    required={!data.box_selling_price}
                                    placeholder="2.00"
                                    value={data.selling_price}
                                    onChange={(e) =>
                                        handlePiecePriceInput(
                                            'selling',
                                            e.target.value
                                        )
                                    }
                                    error={errors.selling_price}
                                />
                                <Input
                                    label="Box Selling"
                                    type="number"
                                    step="0.01"
                                    placeholder="195.00"
                                    value={data.box_selling_price}
                                    onChange={(e) =>
                                        handleBoxPriceInput(
                                            'selling',
                                            e.target.value
                                        )
                                    }
                                    error={errors.box_selling_price}
                                />
                            </div>

                            <div className="rounded-[4px] border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#161a1e] p-3.5 space-y-3">
                                <div className="text-[11px] font-bold text-slate-500">
                                    Opening Stock Batch (Optional FEFO)
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Input
                                        label="Batch Number"
                                        placeholder="BATCH-2026-01"
                                        value={data.batch_number}
                                        onChange={(e) =>
                                            setData(
                                                'batch_number',
                                                e.target.value
                                            )
                                        }
                                        error={errors.batch_number}
                                    />
                                    <Input
                                        label="Opening Qty"
                                        type="number"
                                        placeholder="100"
                                        value={data.quantity}
                                        onChange={(e) =>
                                            setData('quantity', e.target.value)
                                        }
                                        error={errors.quantity}
                                    />
                                    <Input
                                        label="Expiry Date"
                                        type="date"
                                        value={data.expiry_date}
                                        onChange={(e) =>
                                            setData(
                                                'expiry_date',
                                                e.target.value
                                            )
                                        }
                                        error={errors.expiry_date}
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={data.requires_prescription}
                                    onChange={(e) =>
                                        setData(
                                            'requires_prescription',
                                            e.target.checked
                                        )
                                    }
                                    className="table-checkbox"
                                />
                                Requires valid medical prescription (Rx)
                            </label>

                            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={processing}
                                >
                                    Save Medicine
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <BarcodeCameraModal
                open={showBarcodeCamera}
                onClose={() => setShowBarcodeCamera(false)}
                onDetected={(code) => {
                    setData('barcode', code);
                    return {
                        ok: true,
                        tone: 'success',
                        message: `Captured barcode: ${code}`,
                    };
                }}
                title="Scan Product Barcode"
                subtitle="Capture box or strip barcode into the medicine catalog form"
            />

            {labelMedicine && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
                    onClick={() => setLabelMedicine(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-[6px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161c] shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151921]">
                            <div className="min-w-0">
                                <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {labelMedicine.name}
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {labelMedicine.sku} ·{' '}
                                    {formatCurrency(
                                        labelMedicine.default_selling_price,
                                        currency
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLabelMedicine(null)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div
                            ref={labelPreviewRef}
                            className="p-6 flex flex-col items-center justify-center gap-2 bg-slate-50/40 dark:bg-[#151921]/40"
                        >
                            <BarcodeSvg
                                value={labelMedicine.barcode}
                                displayValue
                                height={56}
                                barWidth={2}
                                fontSize={12}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200/80 dark:border-slate-800">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setLabelMedicine(null)}
                            >
                                Close
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                onClick={handlePrintBarcodeLabel}
                            >
                                <Printer className="h-3.5 w-3.5" />
                                Print Label
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
