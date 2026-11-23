import React, { useMemo, useRef, useState } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    Archive,
    ArchiveRestore,
    Clock,
    DollarSign,
    Edit,
    FolderPlus,
    Layers,
    Package,
    PackagePlus,
    Plus,
    Printer,
    SlidersHorizontal,
    TrendingUp,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { BarcodeCameraModal } from '@/Components/BarcodeCameraModal';
import { BarcodeSvg } from '@/Components/BarcodeSvg';
import { StatusDot } from '@/Components/ui/StatusDot';
import { Badge } from '@/Components/ui/Badge';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { Textarea } from '@/Components/ui/Textarea';
import { MetricCard } from '@/Components/cards/MetricCard';
import {
    DataTable,
    Column,
    EmptyState,
    TableActionMenu,
} from '@/Components/tables';
import { BatchAdjustModal } from '@/Components/inventory/BatchAdjustModal';
import {
    MedicineFormFields,
    MedicineFormValues,
} from '@/Components/inventory/MedicineFormFields';
import {
    BatchRow,
    BranchFilterOption,
    MedicineRow,
    StockMovementRow,
} from '@/Components/inventory/inventoryTypes';
import { SharedPageProps } from '@/types';
import { formatCurrency } from '@/lib/format';

interface InventoryProps {
    medicines: MedicineRow[];
    categories: Array<{ id: number; name: string }>;
    suppliers: Array<{ id: number; name: string }>;
    branches: BranchFilterOption[];
    filters: {
        q: string;
        filter: string;
        category_id: string;
        branch_id?: string;
    };
    activeBranchName?: string | null;
    tabCounts?: {
        all: number;
        low_stock: number;
        expiring: number;
        expiring_90: number;
        expired: number;
        archived: number;
    };
    metrics?: {
        totalSkus: number;
        totalSellableUnits: number;
        lowStockCount: number;
        expiring30Count: number;
        expiring60Count: number;
        expiring90Count: number;
        expiredBatchCount: number;
        purchaseValuation: number;
        retailValuation: number;
        expiredValuation: number;
        archivedCount: number;
    };
}

interface InspectorPayload {
    medicine: {
        id: number;
        name: string;
        sku: string;
        unit: string;
        units_per_box: number;
    };
    batches: BatchRow[];
    movements: StockMovementRow[];
}

function computeDualPricePatch<T extends object>(
    prev: T,
    kind: 'purchase' | 'selling',
    source: 'piece' | 'box',
    val: string,
    unitsPerBoxFallback = 1
): Partial<T> {
    const unitsPerBox = Math.max(
        1,
        Number((prev as { units_per_box?: string }).units_per_box) || unitsPerBoxFallback || 1
    );
    const pieceField = kind === 'purchase' ? 'purchase_price' : 'selling_price';
    const boxField =
        kind === 'purchase' ? 'box_purchase_price' : 'box_selling_price';
    const num = Number(val);

    if (source === 'piece') {
        const nextBox =
            unitsPerBox > 1 && val !== '' && !Number.isNaN(num)
                ? (num * unitsPerBox).toFixed(2)
                : (prev as Record<string, unknown>)[boxField];
        return {
            [pieceField]: val,
            [boxField]: nextBox,
        } as Partial<T>;
    }

    const prevPiece = (prev as Record<string, string>)[pieceField];
    const nextPiece =
        val !== '' && !Number.isNaN(num) && (prevPiece === '' || prevPiece === undefined)
            ? (num / unitsPerBox).toFixed(2)
            : prevPiece;
    return {
        [boxField]: val,
        [pieceField]: nextPiece,
    } as Partial<T>;
}

const EMPTY_CREATE_FORM: MedicineFormValues & {
    supplier_id: string;
    batch_number: string;
    manufacturing_date: string;
    quantity: string;
    expiry_date: string;
    rack_location: string;
} = {
    name: '',
    generic_name: '',
    manufacturer: '',
    sku: '',
    barcode: '',
    category_id: '',
    dosage_form: 'tablet',
    strength: '',
    description: '',
    unit: 'pcs',
    units_per_strip: '1',
    units_per_box: '1',
    reorder_level: '10',
    requires_prescription: false,
    purchase_price: '',
    box_purchase_price: '',
    selling_price: '',
    box_selling_price: '',
    supplier_id: '',
    batch_number: '',
    manufacturing_date: '',
    quantity: '',
    expiry_date: '',
    rack_location: '',
};

export default function InventoryIndex({
    medicines,
    categories,
    suppliers,
    branches = [],
    filters,
    activeBranchName,
    tabCounts,
    metrics,
}: InventoryProps) {
    const { tenant } = usePage<SharedPageProps>().props;
    const currency = tenant?.currentTenant?.currency_code ?? 'BDT';
    const canEdit = Boolean(tenant?.canEditInventory ?? tenant?.canManageInventory);
    const canAdjust = Boolean(tenant?.canAdjustInventory ?? canEdit);

    const [selectedFilter, setSelectedFilter] = useState(
        filters.filter || 'all'
    );
    const [selectedCategory, setSelectedCategory] = useState(
        filters.category_id || ''
    );
    const [selectedBranchId, setSelectedBranchId] = useState(
        filters.branch_id || (tenant?.currentBranch?.id ? String(tenant.currentBranch.id) : 'all')
    );

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingMedicine, setEditingMedicine] = useState<MedicineRow | null>(null);
    const [restockMedicine, setRestockMedicine] = useState<MedicineRow | null>(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [cameraTarget, setCameraTarget] = useState<'create' | 'edit' | null>(null);

    const [labelMedicine, setLabelMedicine] = useState<MedicineRow | null>(null);
    const labelPreviewRef = useRef<HTMLDivElement>(null);

    const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);
    const [bulkSelectedIds, setBulkSelectedIds] = useState<number[]>([]);
    const [bulkCopies, setBulkCopies] = useState<Record<number, number>>({});
    const bulkRenderRef = useRef<HTMLDivElement>(null);

    const [inspectMedicine, setInspectMedicine] = useState<MedicineRow | null>(null);
    const [inspectorData, setInspectorData] = useState<InspectorPayload | null>(null);
    const [inspectorLoading, setInspectorLoading] = useState(false);
    const [adjustingBatch, setAdjustingBatch] = useState<BatchRow | null>(null);

    const createForm = useForm({ ...EMPTY_CREATE_FORM });

    const editForm = useForm<MedicineFormValues>({
        name: '',
        generic_name: '',
        manufacturer: '',
        sku: '',
        barcode: '',
        category_id: '',
        dosage_form: 'tablet',
        strength: '',
        description: '',
        unit: 'pcs',
        units_per_strip: '1',
        units_per_box: '1',
        reorder_level: '10',
        requires_prescription: false,
        purchase_price: '',
        box_purchase_price: '',
        selling_price: '',
        box_selling_price: '',
    });

    const categoryForm = useForm({
        name: '',
        description: '',
    });

    const restockForm = useForm({
        branch_id: tenant?.currentBranch?.id ? String(tenant.currentBranch.id) : '',
        supplier_id: '',
        batch_number: '',
        manufacturing_date: '',
        quantity: '50',
        expiry_date: '',
        purchase_price: '',
        box_purchase_price: '',
        selling_price: '',
        box_selling_price: '',
        rack_location: '',
        notes: '',
    });

    const applyServerFilters = (
        nextFilter = selectedFilter,
        nextCategory = selectedCategory,
        nextBranch = selectedBranchId
    ) => {
        router.get(
            route('inventory.index'),
            {
                filter: nextFilter !== 'all' ? nextFilter : undefined,
                category_id: nextCategory || undefined,
                branch_id: nextBranch || undefined,
            },
            { preserveState: true, replace: true }
        );
    };

    const openEditModal = (med: MedicineRow) => {
        setEditingMedicine(med);
        editForm.setData({
            name: med.name,
            generic_name: med.generic_name ?? '',
            manufacturer: med.manufacturer ?? '',
            sku: med.sku,
            barcode: med.barcode ?? '',
            category_id: med.category_id ?? '',
            dosage_form: med.dosage_form ?? 'tablet',
            strength: med.strength ?? '',
            description: med.description ?? '',
            unit: med.unit ?? 'pcs',
            units_per_strip: String(med.units_per_strip || 1),
            units_per_box: String(med.units_per_box || 1),
            reorder_level: String(med.reorder_level ?? 10),
            requires_prescription: Boolean(med.requires_prescription),
            purchase_price: String(med.default_purchase_price ?? 0),
            box_purchase_price:
                med.box_purchase_price !== null && med.box_purchase_price !== undefined
                    ? String(med.box_purchase_price)
                    : '',
            selling_price: String(med.default_selling_price ?? 0),
            box_selling_price:
                med.box_selling_price !== null && med.box_selling_price !== undefined
                    ? String(med.box_selling_price)
                    : '',
        });
        editForm.clearErrors();
    };

    const openRestockModal = (med: MedicineRow) => {
        setRestockMedicine(med);
        const preferredBranch =
            selectedBranchId !== 'all'
                ? selectedBranchId
                : tenant?.currentBranch?.id
                    ? String(tenant.currentBranch.id)
                    : branches[0]?.id
                        ? String(branches[0].id)
                        : '';

        restockForm.setData({
            branch_id: preferredBranch,
            supplier_id: '',
            batch_number: '',
            quantity: '50',
            expiry_date: '',
            purchase_price: String(med.default_purchase_price ?? ''),
            box_purchase_price:
                med.box_purchase_price !== null && med.box_purchase_price !== undefined
                    ? String(med.box_purchase_price)
                    : '',
            selling_price: String(med.default_selling_price ?? ''),
            box_selling_price:
                med.box_selling_price !== null && med.box_selling_price !== undefined
                    ? String(med.box_selling_price)
                    : '',
            rack_location: '',
            notes: '',
        });
        restockForm.clearErrors();
    };

    const loadMedicineInspector = async (med: MedicineRow) => {
        setInspectMedicine(med);
        setInspectorLoading(true);
        try {
            const url = route('inventory.medicine.batches', med.id);
            const params = selectedBranchId
                ? `?branch_id=${encodeURIComponent(selectedBranchId)}`
                : '';
            const res = await fetch(`${url}${params}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            if (res.ok) {
                const payload = (await res.json()) as InspectorPayload;
                setInspectorData(payload);
            }
        } finally {
            setInspectorLoading(false);
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(route('inventory.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                setShowCreateModal(false);
            },
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMedicine) return;
        editForm.put(route('inventory.update', editingMedicine.id), {
            preserveScroll: true,
            onSuccess: () => {
                setEditingMedicine(null);
            },
        });
    };

    const handleCategorySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        categoryForm.post(route('inventory.categories.store'), {
            preserveScroll: true,
            onSuccess: () => {
                categoryForm.reset();
                setShowCategoryModal(false);
            },
        });
    };

    const handleRestockSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!restockMedicine) return;
        restockForm.post(route('inventory.batches.store', restockMedicine.id), {
            preserveScroll: true,
            onSuccess: () => {
                const target = inspectMedicine;
                setRestockMedicine(null);
                restockForm.reset();
                if (target && target.id === restockMedicine.id) {
                    void loadMedicineInspector(target);
                }
            },
        });
    };

    const handleToggleArchive = (med: MedicineRow) => {
        router.patch(
            route('inventory.toggle', med.id),
            {},
            { preserveScroll: true }
        );
    };

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
        const boxText =
            labelMedicine.units_per_box > 1 && labelMedicine.box_selling_price
                ? ` · Box: ${formatCurrency(labelMedicine.box_selling_price, currency)}`
                : '';
        metaEl.textContent = `${labelMedicine.sku} · ${formatCurrency(
            labelMedicine.default_selling_price,
            currency
        )}/${labelMedicine.unit}${boxText}`;

        card.appendChild(titleEl);
        card.appendChild(metaEl);
        card.appendChild(doc.importNode(svgNode, true));
        doc.body.appendChild(card);

        printWin.focus();
        printWin.print();
        printWin.close();
    };

    const openBulkPrintModal = () => {
        const barcoded = medicines.filter((m) => Boolean(m.barcode));
        const defaultIds = barcoded.slice(0, 12).map((m) => m.id);
        setBulkSelectedIds(defaultIds);
        const initialCopies: Record<number, number> = {};
        barcoded.forEach((m) => {
            initialCopies[m.id] = 1;
        });
        setBulkCopies(initialCopies);
        setShowBulkPrintModal(true);
    };

    const handleBulkPrintSubmit = () => {
        const selectedMeds = medicines.filter(
            (m) => bulkSelectedIds.includes(m.id) && Boolean(m.barcode)
        );
        if (selectedMeds.length === 0) return;

        const printWin = window.open('', '_blank', 'width=860,height=700');
        if (!printWin) return;

        const doc = printWin.document;
        doc.open();
        doc.write(
            '<!doctype html><html><head><title>Bulk Barcode Labels</title><style>body{margin:0;padding:16px;font-family:Inter,Arial,sans-serif;color:#0f172a}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.card{border:1px dashed #cbd5e1;padding:8px 10px;text-align:center;border-radius:4px;page-break-inside:avoid}.name{font-size:11px;font-weight:700;margin-bottom:2px}.meta{font-size:9.5px;color:#475569;margin-bottom:4px}svg{color:#0f172a;max-width:100%}</style></head><body></body></html>'
        );
        doc.close();

        const grid = doc.createElement('div');
        grid.className = 'grid';

        selectedMeds.forEach((med) => {
            const svgEl = bulkRenderRef.current?.querySelector(
                `[data-med-id="${med.id}"] svg`
            );
            if (!svgEl) return;
            const copies = Math.min(20, Math.max(1, bulkCopies[med.id] || 1));

            for (let i = 0; i < copies; i++) {
                const card = doc.createElement('div');
                card.className = 'card';

                const titleEl = doc.createElement('div');
                titleEl.className = 'name';
                titleEl.textContent = `${med.name}${med.strength ? ` (${med.strength})` : ''}`;

                const metaEl = doc.createElement('div');
                metaEl.className = 'meta';
                metaEl.textContent = `${med.sku} · ${formatCurrency(
                    med.default_selling_price,
                    currency
                )}`;

                card.appendChild(titleEl);
                card.appendChild(metaEl);
                card.appendChild(doc.importNode(svgEl, true));
                grid.appendChild(card);
            }
        });

        doc.body.appendChild(grid);
        printWin.focus();
        printWin.print();
        printWin.close();
    };

    const lowStockTotal =
        tabCounts?.low_stock ?? medicines.filter((m) => m.is_low_stock).length;
    const expiringTotal =
        tabCounts?.expiring ??
        medicines.filter(
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

    const branchFilterOptions = [
        { id: 'all', value: 'all', name: 'All Active Branches (Consolidated)' },
        ...branches.map((b) => ({
            id: b.id,
            value: String(b.id),
            name: `${b.name} (${b.code})`,
        })),
    ];

    const activeBranchSelectOptions = branches.map((b) => ({
        id: b.id,
        value: String(b.id),
        name: `${b.name} (${b.code})`,
    }));

    const supplierSelectOptions = [
        { id: '', value: '', name: 'Direct / Unspecified Supplier' },
        ...suppliers.map((s) => ({
            id: s.id,
            value: String(s.id),
            name: s.name,
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
                        <span
                            className={`font-semibold ${med.is_active
                                    ? 'text-slate-900 dark:text-slate-100'
                                    : 'text-slate-400 line-through'
                                }`}
                        >
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
                        {!med.is_active && (
                            <Badge variant="slate">Archived</Badge>
                        )}
                    </div>
                ),
            },
            {
                id: 'generic_name',
                label: 'Generic / Mfg',
                sortable: true,
                render: (med) => {
                    const summary = `${med.generic_name || med.dosage_form}${med.manufacturer ? ` · ${med.manufacturer}` : ''
                        }`;
                    return (
                        <span
                            className="block max-w-[210px] truncate text-[12px] text-slate-500 dark:text-slate-400"
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
                    <div className="inline-flex flex-col items-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                            <span
                                className={`font-semibold tabular-nums ${med.is_low_stock
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
                        {Boolean(med.expired_stock && med.expired_stock > 0) && (
                            <span className="text-[10.5px] font-semibold text-rose-500">
                                +{med.expired_stock} expired
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
                { key: 'all', label: 'All Stock', count: tabCounts?.all ?? medicines.length },
                { key: 'low_stock', label: 'Low Stock', count: lowStockTotal },
                {
                    key: 'expiring',
                    label: 'Expiring <= 30d',
                    count: expiringTotal,
                },
                {
                    key: 'expiring_90',
                    label: 'Expiring <= 90d',
                    count: tabCounts?.expiring_90 ?? 0,
                },
                {
                    key: 'expired',
                    label: 'Expired',
                    count: tabCounts?.expired ?? 0,
                },
                {
                    key: 'archived',
                    label: 'Archived',
                    count: tabCounts?.archived ?? 0,
                },
            ].map((tab) => {
                const isActive = selectedFilter === tab.key;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => {
                            setSelectedFilter(tab.key);
                            applyServerFilters(tab.key, selectedCategory, selectedBranchId);
                        }}
                        className={`flex items-center gap-1.5 pb-2.5 border-b transition-colors whitespace-nowrap cursor-pointer px-1 ${isActive
                                ? 'border-[#ff4a1f] text-[#ff4a1f] dark:border-[#ff4a1f] dark:text-[#ff4a1f]'
                                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                    >
                        <span
                            className={`text-[13px] ${isActive ? 'font-bold' : 'font-medium'
                                }`}
                        >
                            {tab.label}
                        </span>
                        <span
                            className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full transition-colors ${isActive
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
                label="Branch Stock Scope"
                size="sm"
                ariaLabel="Filter by branch"
                value={selectedBranchId}
                options={branchFilterOptions}
                onChange={(e) => {
                    const next = String(e.target.value);
                    setSelectedBranchId(next);
                    applyServerFilters(selectedFilter, selectedCategory, next);
                }}
            />
            <Select
                label="Filter by Category"
                size="sm"
                ariaLabel="Filter by category"
                value={selectedCategory}
                options={categoryFilterOptions}
                onChange={(e) => {
                    const next = String(e.target.value);
                    setSelectedCategory(next);
                    applyServerFilters(selectedFilter, next, selectedBranchId);
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
                            applyServerFilters(selectedFilter, '', selectedBranchId);
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
            subtitle={`Scoped catalog, batch traceability & valuation for ${activeBranchName ?? 'Active Branch'}`}
            actions={
                <div className="flex items-center gap-2">
                    {medicines.some((m) => Boolean(m.barcode)) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={openBulkPrintModal}
                        >
                            <Printer className="h-3.5 w-3.5" />
                            Print Labels
                        </Button>
                    )}
                    {canEdit && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowCategoryModal(true)}
                            >
                                <FolderPlus className="h-3.5 w-3.5" />
                                Category
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setShowCreateModal(true)}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Medicine
                            </Button>
                        </>
                    )}
                </div>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <MetricCard
                        title="Active SKUs"
                        value={metrics?.totalSkus ?? medicines.length}
                        description={`${metrics?.totalSellableUnits ?? 0} sellable units`}
                        icon={Package}
                        colorClass="bg-orange-50 dark:bg-[#ff4a1f]/10 text-[#FF4A1F]"
                    />
                    <MetricCard
                        title="Purchase Valuation"
                        value={formatCurrency(metrics?.purchaseValuation ?? 0, currency)}
                        description={activeBranchName ?? 'Branch cost'}
                        icon={DollarSign}
                        colorClass="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    />
                    <MetricCard
                        title="Retail Valuation"
                        value={formatCurrency(metrics?.retailValuation ?? 0, currency)}
                        description="Sellable shelf retail value"
                        icon={TrendingUp}
                        colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                    />
                    <MetricCard
                        title="Low Stock / Exp <=30d"
                        value={`${lowStockTotal} / ${expiringTotal}`}
                        description={`${metrics?.expiring90Count ?? 0} expiring <=90d`}
                        icon={Clock}
                        colorClass="bg-amber-50 dark:bg-amber-500/10 text-amber-600"
                        valueClassName={
                            lowStockTotal > 0 || expiringTotal > 0
                                ? 'text-amber-600'
                                : ''
                        }
                    />
                    <MetricCard
                        title="Expired Stock Risk"
                        value={formatCurrency(metrics?.expiredValuation ?? 0, currency)}
                        description={`${metrics?.expiredBatchCount ?? 0} batch(es) blocked at POS`}
                        icon={AlertTriangle}
                        colorClass="bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                        valueClassName={
                            (metrics?.expiredValuation ?? 0) > 0
                                ? 'text-rose-600'
                                : ''
                        }
                    />
                </div>

                <DataTable
                    tableId="pharmacy-inventory"
                    data={medicines}
                    columns={columns}
                    headerTabs={headerTabs}
                    filterContent={filterContent}
                    searchPlaceholder="Search by brand name, generic, SKU, or barcode..."
                    selectable={false}
                    hideCheckbox={true}
                    syncUrlParams={false}
                    actions={(med) => (
                        <TableActionMenu
                            items={[
                                {
                                    key: 'inspect',
                                    label: 'Inspect Batches & Adjust',
                                    icon: <Layers className="h-3.5 w-3.5" />,
                                    onClick: () => void loadMedicineInspector(med),
                                },
                                {
                                    key: 'restock',
                                    label: 'Restock / Add Batch',
                                    icon: <PackagePlus className="h-3.5 w-3.5" />,
                                    hidden: !canEdit || !med.is_active,
                                    onClick: () => openRestockModal(med),
                                },
                                {
                                    key: 'edit',
                                    label: 'Edit Medicine',
                                    icon: <Edit className="h-3.5 w-3.5" />,
                                    hidden: !canEdit,
                                    onClick: () => openEditModal(med),
                                },
                                {
                                    key: 'barcode',
                                    label: 'Print Barcode Label',
                                    icon: <Printer className="h-3.5 w-3.5" />,
                                    hidden: !med.barcode,
                                    onClick: () => setLabelMedicine(med),
                                },
                                {
                                    key: 'toggle',
                                    label: med.is_active
                                        ? 'Archive Medicine'
                                        : 'Restore Medicine',
                                    icon: med.is_active ? (
                                        <Archive className="h-3.5 w-3.5" />
                                    ) : (
                                        <ArchiveRestore className="h-3.5 w-3.5" />
                                    ),
                                    variant: med.is_active ? 'danger' : 'brand',
                                    hidden: !canEdit,
                                    onClick: () => handleToggleArchive(med),
                                },
                            ]}
                        />
                    )}
                    emptyState={
                        <EmptyState
                            title="No medicines found"
                            description="No medicines match your current filter criteria. Adjust branch/category filters or add a new SKU to your catalog."
                            actionLabel={canEdit ? 'Add Medicine' : undefined}
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
                                    Catalog entry with optional opening FEFO batch for {tenant?.currentBranch?.name ?? 'current branch'}.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form
                            onSubmit={handleCreateSubmit}
                            className="p-5 space-y-4"
                        >
                            <MedicineFormFields
                                data={createForm.data}
                                errors={createForm.errors}
                                categories={categories}
                                onChangeField={(field, val) =>
                                    createForm.setData((prev) => ({
                                        ...prev,
                                        [field]: val,
                                    }))
                                }
                                onPiecePriceChange={(kind, val) =>
                                    createForm.setData((prev) => ({
                                        ...prev,
                                        ...computeDualPricePatch(
                                            prev,
                                            kind,
                                            'piece',
                                            val
                                        ),
                                    }))
                                }
                                onBoxPriceChange={(kind, val) =>
                                    createForm.setData((prev) => ({
                                        ...prev,
                                        ...computeDualPricePatch(
                                            prev,
                                            kind,
                                            'box',
                                            val
                                        ),
                                    }))
                                }
                                onOpenCamera={() => setCameraTarget('create')}
                            />

                            <div className="rounded-[4px] border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#161a1e] p-3.5 space-y-3">
                                <div className="text-[11px] font-bold text-slate-500">
                                    Opening Stock Batch (Optional FEFO)
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                    <Input
                                        label="Batch Number"
                                        placeholder="BATCH-2026-01"
                                        value={createForm.data.batch_number}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'batch_number',
                                                e.target.value
                                            )
                                        }
                                        error={createForm.errors.batch_number}
                                    />
                                    <Input
                                        label="Opening Qty"
                                        type="number"
                                        placeholder="100"
                                        value={createForm.data.quantity}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'quantity',
                                                e.target.value
                                            )
                                        }
                                        error={createForm.errors.quantity}
                                    />
                                    <Input
                                        label="Mfg Date (উৎপাদন)"
                                        type="date"
                                        value={createForm.data.manufacturing_date}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'manufacturing_date',
                                                e.target.value
                                            )
                                        }
                                        error={createForm.errors.manufacturing_date}
                                    />
                                    <Input
                                        label="Expiry Date"
                                        type="date"
                                        value={createForm.data.expiry_date}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'expiry_date',
                                                e.target.value
                                            )
                                        }
                                        error={createForm.errors.expiry_date}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Select
                                        label="Supplier"
                                        value={createForm.data.supplier_id}
                                        options={supplierSelectOptions}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'supplier_id',
                                                String(e.target.value)
                                            )
                                        }
                                        error={createForm.errors.supplier_id}
                                    />
                                    <Input
                                        label="Shelf / Rack Location"
                                        placeholder="A-12"
                                        value={createForm.data.rack_location}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'rack_location',
                                                e.target.value
                                            )
                                        }
                                        error={createForm.errors.rack_location}
                                    />
                                </div>
                            </div>

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
                                    isLoading={createForm.processing}
                                >
                                    Save Medicine
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editingMedicine && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[4px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Edit Medicine — {editingMedicine.name}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Update catalog pricing, pack ratios, barcode & reorder threshold.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingMedicine(null)}
                                className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form
                            onSubmit={handleEditSubmit}
                            className="p-5 space-y-4"
                        >
                            <MedicineFormFields
                                data={editForm.data}
                                errors={editForm.errors}
                                categories={categories}
                                onChangeField={(field, val) =>
                                    editForm.setData((prev) => ({
                                        ...prev,
                                        [field]: val,
                                    }))
                                }
                                onPiecePriceChange={(kind, val) =>
                                    editForm.setData((prev) => ({
                                        ...prev,
                                        ...computeDualPricePatch(
                                            prev,
                                            kind,
                                            'piece',
                                            val
                                        ),
                                    }))
                                }
                                onBoxPriceChange={(kind, val) =>
                                    editForm.setData((prev) => ({
                                        ...prev,
                                        ...computeDualPricePatch(
                                            prev,
                                            kind,
                                            'box',
                                            val
                                        ),
                                    }))
                                }
                                onOpenCamera={() => setCameraTarget('edit')}
                            />

                            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditingMedicine(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={editForm.processing}
                                >
                                    Update Medicine
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {restockMedicine && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
                    <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[4px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Restock / Add New Batch — {restockMedicine.name}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {restockMedicine.sku} · 1 Box = {restockMedicine.units_per_box} {restockMedicine.unit}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRestockMedicine(null)}
                                className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form
                            onSubmit={handleRestockSubmit}
                            className="p-5 space-y-4"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Select
                                    label="Destination Branch"
                                    required
                                    value={restockForm.data.branch_id}
                                    options={activeBranchSelectOptions}
                                    onChange={(e) =>
                                        restockForm.setData(
                                            'branch_id',
                                            String(e.target.value)
                                        )
                                    }
                                    error={restockForm.errors.branch_id}
                                />
                                <Select
                                    label="Supplier"
                                    value={restockForm.data.supplier_id}
                                    options={supplierSelectOptions}
                                    onChange={(e) =>
                                        restockForm.setData(
                                            'supplier_id',
                                            String(e.target.value)
                                        )
                                    }
                                    error={restockForm.errors.supplier_id}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                <Input
                                    label="Batch Number"
                                    required
                                    placeholder="B-2026-11"
                                    value={restockForm.data.batch_number}
                                    onChange={(e) =>
                                        restockForm.setData(
                                            'batch_number',
                                            e.target.value
                                        )
                                    }
                                    error={restockForm.errors.batch_number}
                                />
                                <Input
                                    label={`Quantity (${restockMedicine.unit})`}
                                    type="number"
                                    required
                                    min={1}
                                    value={restockForm.data.quantity}
                                    onChange={(e) =>
                                        restockForm.setData(
                                            'quantity',
                                            e.target.value
                                        )
                                    }
                                    error={restockForm.errors.quantity}
                                />
                                <Input
                                    label="Mfg Date (উৎপাদন)"
                                    type="date"
                                    value={restockForm.data.manufacturing_date}
                                    onChange={(e) =>
                                        restockForm.setData(
                                            'manufacturing_date',
                                            e.target.value
                                        )
                                    }
                                    error={restockForm.errors.manufacturing_date}
                                />
                                <Input
                                    label="Expiry Date"
                                    type="date"
                                    required
                                    value={restockForm.data.expiry_date}
                                    onChange={(e) =>
                                        restockForm.setData(
                                            'expiry_date',
                                            e.target.value
                                        )
                                    }
                                    error={restockForm.errors.expiry_date}
                                />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <Input
                                    label="Purchase / Pc"
                                    type="number"
                                    step="0.01"
                                    value={restockForm.data.purchase_price}
                                    onChange={(e) =>
                                        restockForm.setData((prev) => ({
                                            ...prev,
                                            ...computeDualPricePatch(
                                                prev,
                                                'purchase',
                                                'piece',
                                                e.target.value,
                                                restockMedicine.units_per_box
                                            ),
                                        }))
                                    }
                                    error={restockForm.errors.purchase_price}
                                />
                                <Input
                                    label="Box Purchase"
                                    type="number"
                                    step="0.01"
                                    value={restockForm.data.box_purchase_price}
                                    onChange={(e) =>
                                        restockForm.setData((prev) => ({
                                            ...prev,
                                            ...computeDualPricePatch(
                                                prev,
                                                'purchase',
                                                'box',
                                                e.target.value,
                                                restockMedicine.units_per_box
                                            ),
                                        }))
                                    }
                                    error={restockForm.errors.box_purchase_price}
                                />
                                <Input
                                    label="Selling / Pc"
                                    type="number"
                                    step="0.01"
                                    value={restockForm.data.selling_price}
                                    onChange={(e) =>
                                        restockForm.setData((prev) => ({
                                            ...prev,
                                            ...computeDualPricePatch(
                                                prev,
                                                'selling',
                                                'piece',
                                                e.target.value,
                                                restockMedicine.units_per_box
                                            ),
                                        }))
                                    }
                                    error={restockForm.errors.selling_price}
                                />
                                <Input
                                    label="Box Selling"
                                    type="number"
                                    step="0.01"
                                    value={restockForm.data.box_selling_price}
                                    onChange={(e) =>
                                        restockForm.setData((prev) => ({
                                            ...prev,
                                            ...computeDualPricePatch(
                                                prev,
                                                'selling',
                                                'box',
                                                e.target.value,
                                                restockMedicine.units_per_box
                                            ),
                                        }))
                                    }
                                    error={restockForm.errors.box_selling_price}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Rack / Shelf Location"
                                    placeholder="Shelf B-04"
                                    value={restockForm.data.rack_location}
                                    onChange={(e) =>
                                        restockForm.setData(
                                            'rack_location',
                                            e.target.value
                                        )
                                    }
                                    error={restockForm.errors.rack_location}
                                />
                                <Input
                                    label="Batch Note / Challan Ref"
                                    placeholder="Optional challan or invoice ref"
                                    value={restockForm.data.notes}
                                    onChange={(e) =>
                                        restockForm.setData(
                                            'notes',
                                            e.target.value
                                        )
                                    }
                                    error={restockForm.errors.notes}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setRestockMedicine(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={restockForm.processing}
                                >
                                    Receive Stock Batch
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {inspectMedicine && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[1px] p-4"
                    onClick={() => setInspectMedicine(null)}
                >
                    <div
                        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[4px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div className="min-w-0">
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                    Batch & Movement Inspector — {inspectMedicine.name}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {inspectMedicine.sku} · Scope: {activeBranchName ?? 'Active Branch'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {canEdit && inspectMedicine.is_active && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="primary"
                                        onClick={() => openRestockModal(inspectMedicine)}
                                    >
                                        <PackagePlus className="h-3.5 w-3.5" />
                                        Restock Batch
                                    </Button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setInspectMedicine(null)}
                                    className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 space-y-5">
                            {inspectorLoading ? (
                                <div className="py-10 text-center text-xs text-slate-500">
                                    Loading batches and movement ledger...
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <div className="mb-2 flex items-center justify-between">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                FEFO Shelf Batches ({inspectorData?.batches.length ?? 0})
                                            </h3>
                                        </div>
                                        <div className="overflow-x-auto rounded-[4px] border border-slate-200 dark:border-slate-800">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#151921] text-[10.5px] font-bold uppercase text-slate-500">
                                                        <th className="px-3 py-2">Batch #</th>
                                                        <th className="px-3 py-2">Branch</th>
                                                        <th className="px-3 py-2">Expiry</th>
                                                        <th className="px-3 py-2 text-right">Avail / Rcvd</th>
                                                        <th className="px-3 py-2 text-right">Cost / Sell</th>
                                                        <th className="px-3 py-2">Status</th>
                                                        {canAdjust && (
                                                            <th className="px-3 py-2 text-right">Action</th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {!inspectorData?.batches.length ? (
                                                        <tr>
                                                            <td
                                                                colSpan={canAdjust ? 7 : 6}
                                                                className="px-3 py-6 text-center text-slate-500"
                                                            >
                                                                No batches found in selected branch scope.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        inspectorData.batches.map((b) => (
                                                            <tr key={b.id}>
                                                                <td className="px-3 py-2 font-mono font-bold text-[#FF4A1F]">
                                                                    {b.batch_number}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    {b.branch_code || b.branch_name}
                                                                </td>
                                                                <td className="px-3 py-2 font-mono">
                                                                    {b.expiry_date || '—'}
                                                                </td>
                                                                <td className="px-3 py-2 text-right tabular-nums">
                                                                    <strong>{b.quantity_available}</strong> / {b.quantity_received}
                                                                </td>
                                                                <td className="px-3 py-2 text-right tabular-nums">
                                                                    {formatCurrency(b.purchase_price, currency)} /{' '}
                                                                    {formatCurrency(b.selling_price, currency)}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    {b.is_expired ? (
                                                                        <StatusDot variant="rose">Expired</StatusDot>
                                                                    ) : b.effective_status === 'damaged' ? (
                                                                        <StatusDot variant="rose">Damaged</StatusDot>
                                                                    ) : b.effective_status === 'disposed' ? (
                                                                        <StatusDot variant="slate">Disposed</StatusDot>
                                                                    ) : b.quantity_available <= 0 ? (
                                                                        <StatusDot variant="slate">Depleted</StatusDot>
                                                                    ) : (
                                                                        <StatusDot variant="emerald">Active</StatusDot>
                                                                    )}
                                                                </td>
                                                                {canAdjust && (
                                                                    <td className="px-3 py-2 text-right">
                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            variant={b.is_expired ? 'danger' : 'outline'}
                                                                            onClick={() =>
                                                                                setAdjustingBatch({
                                                                                    ...b,
                                                                                    medicine_name: inspectMedicine.name,
                                                                                    unit: inspectMedicine.unit,
                                                                                })
                                                                            }
                                                                        >
                                                                            <SlidersHorizontal className="h-3 w-3" />
                                                                            {b.is_expired ? 'Dispose' : 'Adjust'}
                                                                        </Button>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                            Recent Stock Movements
                                        </h3>
                                        <div className="overflow-x-auto rounded-[4px] border border-slate-200 dark:border-slate-800">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#151921] text-[10.5px] font-bold uppercase text-slate-500">
                                                        <th className="px-3 py-2">When</th>
                                                        <th className="px-3 py-2">Batch</th>
                                                        <th className="px-3 py-2">Type</th>
                                                        <th className="px-3 py-2 text-right">Qty</th>
                                                        <th className="px-3 py-2 text-right">Balance</th>
                                                        <th className="px-3 py-2">Reason</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {!inspectorData?.movements.length ? (
                                                        <tr>
                                                            <td
                                                                colSpan={6}
                                                                className="px-3 py-5 text-center text-slate-500"
                                                            >
                                                                No stock movements logged for this SKU yet.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        inspectorData.movements.map((mv) => (
                                                            <tr key={mv.id}>
                                                                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                                                    {mv.occurred_at}
                                                                </td>
                                                                <td className="px-3 py-2 font-mono">
                                                                    {mv.batch_number}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <Badge variant={mv.quantity_change >= 0 ? 'emerald' : 'brand'}>
                                                                        {mv.movement_label}
                                                                    </Badge>
                                                                </td>
                                                                <td
                                                                    className={`px-3 py-2 text-right font-bold tabular-nums ${mv.quantity_change >= 0
                                                                            ? 'text-emerald-600'
                                                                            : 'text-rose-600'
                                                                        }`}
                                                                >
                                                                    {mv.quantity_change > 0
                                                                        ? `+${mv.quantity_change}`
                                                                        : mv.quantity_change}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono tabular-nums">
                                                                    {mv.balance_before} → {mv.balance_after}
                                                                </td>
                                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                                                    {mv.reason || '—'} · {mv.user_name}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
                    <div className="w-full max-w-md rounded-[4px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                Add Medicine Category
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowCategoryModal(false)}
                                className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCategorySubmit} className="p-5 space-y-4">
                            <Input
                                label="Category Name"
                                required
                                placeholder="e.g. Cardiac & Blood Pressure"
                                value={categoryForm.data.name}
                                onChange={(e) =>
                                    categoryForm.setData('name', e.target.value)
                                }
                                error={categoryForm.errors.name}
                            />
                            <Textarea
                                label="Description"
                                rows={2}
                                placeholder="Optional shelf group description"
                                value={categoryForm.data.description}
                                onChange={(e) =>
                                    categoryForm.setData(
                                        'description',
                                        e.target.value
                                    )
                                }
                                error={categoryForm.errors.description}
                            />
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCategoryModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={categoryForm.processing}
                                >
                                    Save Category
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showBulkPrintModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[1px] p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[4px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e2329] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Bulk Barcode Label Sheet
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Select medicines and copy count per shelf/box label.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowBulkPrintModal(false)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-3">
                            <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                                {medicines
                                    .filter((m) => Boolean(m.barcode))
                                    .map((med) => {
                                        const checked = bulkSelectedIds.includes(med.id);
                                        return (
                                            <div
                                                key={med.id}
                                                className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                                            >
                                                <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            setBulkSelectedIds((prev) =>
                                                                e.target.checked
                                                                    ? [...prev, med.id]
                                                                    : prev.filter((id) => id !== med.id)
                                                            );
                                                        }}
                                                        className="table-checkbox"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                            {med.name}
                                                        </div>
                                                        <div className="text-[11px] font-mono text-slate-400">
                                                            {med.sku} · {med.barcode}
                                                        </div>
                                                    </div>
                                                </label>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[11px] text-slate-500">
                                                        Copies
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={20}
                                                        value={bulkCopies[med.id] ?? 1}
                                                        onChange={(e) =>
                                                            setBulkCopies((prev) => ({
                                                                ...prev,
                                                                [med.id]: Math.max(
                                                                    1,
                                                                    Math.min(20, Number(e.target.value) || 1)
                                                                ),
                                                            }))
                                                        }
                                                        className="h-7 w-14 rounded-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161c] px-2 text-center text-xs tabular-nums"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>

                            <div className="hidden" ref={bulkRenderRef}>
                                {medicines
                                    .filter((m) => Boolean(m.barcode))
                                    .map((med) => (
                                        <div key={med.id} data-med-id={med.id}>
                                            <BarcodeSvg
                                                value={med.barcode}
                                                displayValue
                                                height={44}
                                                barWidth={1.6}
                                                fontSize={11}
                                            />
                                        </div>
                                    ))}
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowBulkPrintModal(false)}
                                >
                                    Close
                                </Button>
                                <Button
                                    type="button"
                                    variant="primary"
                                    disabled={bulkSelectedIds.length === 0}
                                    onClick={handleBulkPrintSubmit}
                                >
                                    <Printer className="h-3.5 w-3.5" />
                                    Print Sheet ({bulkSelectedIds.length})
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <BatchAdjustModal
                batch={adjustingBatch}
                currency={currency}
                onClose={() => setAdjustingBatch(null)}
                onAdjusted={() => {
                    if (inspectMedicine) {
                        void loadMedicineInspector(inspectMedicine);
                    }
                }}
            />

            <BarcodeCameraModal
                open={cameraTarget !== null}
                onClose={() => setCameraTarget(null)}
                onDetected={(code) => {
                    if (cameraTarget === 'edit') {
                        editForm.setData('barcode', code);
                    } else {
                        createForm.setData('barcode', code);
                    }
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
