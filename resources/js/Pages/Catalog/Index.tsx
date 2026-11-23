import React, { useEffect, useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import {
    Barcode,
    Check,
    Download,
    Edit2,
    FileSpreadsheet,
    FileText,
    FolderPlus,
    Layers,
    Lock,
    Package,
    Plus,
    Printer,
    RefreshCw,
    Search,
    Tag,
    Trash2,
    UploadCloud,
    X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Badge } from '@/Components/ui/Badge';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { SharedPageProps } from '@/types';

interface CategoryItem {
    id: string;
    parent_id: string | null;
    name: string;
    name_bn: string | null;
    depth: number;
    is_active: boolean;
    products_count?: number;
}

interface CompanyItem {
    id: string;
    name: string;
    name_bn: string | null;
    is_active: boolean;
    products_count?: number;
}

interface GenericItem {
    id: string;
    name: string;
    is_active: boolean;
    products_count?: number;
}

interface BranchItem {
    id: number;
    name: string;
    code: string;
}

interface UnitRow {
    unit_name: string;
    conversion_to_base: number;
    is_sale_unit: boolean;
    is_purchase_unit: boolean;
    is_default_sale: boolean;
}

interface BarcodeRow {
    barcode: string;
    is_primary: boolean;
}

interface BranchSettingRow {
    branch_id: number;
    min_stock: number;
    max_stock: number;
    reorder_level: number;
    shelf_location: string;
}

interface ProductItem {
    id: string;
    type: 'medicine' | 'non_medicine';
    name: string;
    name_bn: string | null;
    sku: string | null;
    strength: string | null;
    dosage_form: string | null;
    base_unit: string;
    is_active: boolean;
    is_controlled: boolean;
    track_batch: boolean;
    category?: { id: string; name: string } | null;
    company?: { id: string; name: string; name_bn: string | null } | null;
    generic?: { id: string; name: string } | null;
    units: UnitRow[];
    barcodes: BarcodeRow[];
    default_discount_type?: string | null;
    default_discount_value?: number;
}

interface Props extends SharedPageProps {
    categories: CategoryItem[];
    companies: CompanyItem[];
    generics: GenericItem[];
    branches: BranchItem[];
    planLimit: {
        allowed: boolean;
        used: number;
        limit: number;
        isUnlimited: boolean;
    };
    canImport: boolean;
    canExport: boolean;
    canPrintLabels: boolean;
}

export default function CatalogIndex({
    categories: initialCategories,
    companies: initialCompanies,
    generics: initialGenerics,
    branches,
    planLimit,
    canImport,
    canExport,
    canPrintLabels,
}: Props) {
    const { locale } = usePage<SharedPageProps>().props;
    const isBn = locale === 'bn';

    const [activeTab, setActiveTab] = useState<
        'products' | 'categories' | 'companies' | 'generics' | 'discounts' | 'import_export'
    >('products');

    // Products state
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterCompany, setFilterCompany] = useState('');
    const [filterGeneric, setFilterGeneric] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Modals
    const [productDrawerOpen, setProductDrawerOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
    const [labelModalOpen, setLabelModalOpen] = useState(false);
    const [selectedLabelProduct, setSelectedLabelProduct] = useState<ProductItem | null>(null);
    const [labelPreset, setLabelPreset] = useState<'38x25' | '50x30' | 'a4_3x8'>('38x25');
    const [labelQuantity, setLabelQuantity] = useState(1);

    // Master data modals
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [companyModalOpen, setCompanyModalOpen] = useState(false);
    const [genericModalOpen, setGenericModalOpen] = useState(false);
    const [ruleModalOpen, setRuleModalOpen] = useState(false);

    // Master data modal forms
    const [catForm, setCatForm] = useState({ name: '', name_bn: '', parent_id: '' });
    const [compForm, setCompForm] = useState({ name: '', name_bn: '' });
    const [genForm, setGenForm] = useState({ name: '' });
    const [ruleForm, setRuleForm] = useState({
        scope: 'category' as 'product' | 'category' | 'company',
        scope_id: '',
        type: 'percent' as 'percent' | 'fixed',
        value: 5,
        note: '',
    });
    const [submittingMaster, setSubmittingMaster] = useState(false);

    // Import state
    const [importStep, setImportStep] = useState<1 | 2 | 3 | 4 | 5>(1);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importJobId, setImportJobId] = useState<string | null>(null);
    const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});

    // Form data for product create/edit
    const [prodForm, setProdForm] = useState<{
        type: 'medicine' | 'non_medicine';
        name: string;
        name_bn: string;
        sku: string;
        category_id: string;
        company_id: string;
        generic_id: string;
        strength: string;
        dosage_form: string;
        base_unit: string;
        track_batch: boolean;
        is_controlled: boolean;
        default_discount_type: string;
        default_discount_value: number;
        units: UnitRow[];
        barcodes: BarcodeRow[];
        branch_settings: BranchSettingRow[];
    }>({
        type: 'medicine',
        name: '',
        name_bn: '',
        sku: '',
        category_id: '',
        company_id: '',
        generic_id: '',
        strength: '',
        dosage_form: 'tablet',
        base_unit: 'pcs',
        track_batch: true,
        is_controlled: false,
        default_discount_type: 'none',
        default_discount_value: 0,
        units: [
            { unit_name: 'pcs', conversion_to_base: 1, is_sale_unit: true, is_purchase_unit: true, is_default_sale: true },
        ],
        barcodes: [],
        branch_settings: branches.map((b) => ({
            branch_id: b.id,
            min_stock: 10,
            max_stock: 500,
            reorder_level: 20,
            shelf_location: '',
        })),
    });

    // Fetch products with debounced search
    const fetchProducts = async (q = searchQuery) => {
        setLoadingProducts(true);
        try {
            if (q.trim() !== '') {
                const params = new URLSearchParams({
                    q,
                    ...(filterType ? { type: filterType } : {}),
                    limit: '30',
                });
                const res = await fetch(`/api/catalog/products/search?${params.toString()}`);
                const data = await res.json();
                setProducts(data.data || []);
            } else {
                const params = new URLSearchParams({
                    ...(filterType ? { type: filterType } : {}),
                    ...(filterCategory ? { category_id: filterCategory } : {}),
                    ...(filterCompany ? { company_id: filterCompany } : {}),
                    ...(filterGeneric ? { generic_id: filterGeneric } : {}),
                    ...(filterStatus !== '' ? { is_active: filterStatus } : {}),
                    per_page: '30',
                });
                const res = await fetch(`/api/catalog/products?${params.toString()}`);
                const data = await res.json();
                setProducts(data.data || []);
            }
        } catch (e) {
            console.error('Failed to load products', e);
        } finally {
            setLoadingProducts(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts(searchQuery);
        }, 200);
        return () => clearTimeout(timer);
    }, [searchQuery, filterType, filterCategory, filterCompany, filterGeneric, filterStatus]);

    // Live unit conversion preview: e.g. "1 box = 10 strips = 100 pcs"
    const unitConversionSummary = useMemo(() => {
        const sorted = [...prodForm.units].sort((a, b) => b.conversion_to_base - a.conversion_to_base);
        if (sorted.length <= 1) {
            return `Base: 1 ${prodForm.base_unit}`;
        }
        return sorted.map((u) => `${u.conversion_to_base} ${prodForm.base_unit} / ${u.unit_name}`).join(' · ');
    }, [prodForm.units, prodForm.base_unit]);

    // Generate EAN-13 barcode
    const handleGenerateBarcode = async () => {
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch('/api/catalog/products/generate-barcode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
            });
            const data = await res.json();
            if (data.barcode) {
                setProdForm((prev) => ({
                    ...prev,
                    barcodes: [...prev.barcodes, { barcode: data.barcode, is_primary: prev.barcodes.length === 0 }],
                }));
            }
        } catch (e) {
            alert('Failed to generate internal barcode');
        }
    };

    // Add unit row
    const addUnitRow = () => {
        setProdForm((prev) => ({
            ...prev,
            units: [
                ...prev.units,
                {
                    unit_name: '',
                    conversion_to_base: 10,
                    is_sale_unit: true,
                    is_purchase_unit: true,
                    is_default_sale: false,
                },
            ],
        }));
    };

    // Remove unit row
    const removeUnitRow = (index: number) => {
        if (prodForm.units[index].conversion_to_base === 1) {
            alert('Base unit (conversion=1) cannot be removed.');
            return;
        }
        setProdForm((prev) => ({
            ...prev,
            units: prev.units.filter((_, i) => i !== index),
        }));
    };

    // Save product
    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...prodForm,
                default_discount_type: prodForm.default_discount_type === 'none' ? null : prodForm.default_discount_type,
            };

            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const endpoint = editingProduct
                ? `/api/catalog/products/${editingProduct.id}`
                : '/api/catalog/products';
            const method = editingProduct ? 'PUT' : 'POST';

            const res = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Failed to save product');
            }

            setProductDrawerOpen(false);
            setEditingProduct(null);
            fetchProducts();
        } catch (err: any) {
            alert(err.message || 'Failed to save product');
        }
    };

    // Toggle active
    const handleToggleActive = async (prod: ProductItem) => {
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const endpoint = prod.is_active
                ? `/api/catalog/products/${prod.id}/deactivate`
                : `/api/catalog/products/${prod.id}/activate`;
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Action failed');
            }
            fetchProducts();
        } catch (e: any) {
            alert(e.message || 'Action failed');
        }
    };

    // Delete product
    const handleDeleteProduct = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch(`/api/catalog/products/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Cannot delete product referenced in other records');
            }
            fetchProducts();
        } catch (e: any) {
            alert(e.message || 'Cannot delete product referenced in other records');
        }
    };

    // Save category
    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingMaster(true);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch('/api/catalog/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    name: catForm.name,
                    name_bn: catForm.name_bn || null,
                    parent_id: catForm.parent_id || null,
                }),
            });
            if (res.ok) {
                setCategoryModalOpen(false);
                setCatForm({ name: '', name_bn: '', parent_id: '' });
                router.reload();
            } else {
                const errData = await res.json();
                alert(errData.message || (isBn ? 'ক্যাটাগরি তৈরি ব্যর্থ হয়েছে' : 'Failed to create category'));
            }
        } catch {
            alert(isBn ? 'ক্যাটাগরি তৈরি ব্যর্থ হয়েছে' : 'Failed to create category');
        } finally {
            setSubmittingMaster(false);
        }
    };

    // Save company
    const handleSaveCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingMaster(true);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch('/api/catalog/companies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    name: compForm.name,
                    name_bn: compForm.name_bn || null,
                }),
            });
            if (res.ok) {
                setCompanyModalOpen(false);
                setCompForm({ name: '', name_bn: '' });
                router.reload();
            } else {
                const errData = await res.json();
                alert(errData.message || (isBn ? 'কোম্পানি তৈরি ব্যর্থ হয়েছে' : 'Failed to create company'));
            }
        } catch {
            alert(isBn ? 'কোম্পানি তৈরি ব্যর্থ হয়েছে' : 'Failed to create company');
        } finally {
            setSubmittingMaster(false);
        }
    };

    // Save generic
    const handleSaveGeneric = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingMaster(true);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch('/api/catalog/generics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    name: genForm.name,
                }),
            });
            if (res.ok) {
                setGenericModalOpen(false);
                setGenForm({ name: '' });
                router.reload();
            } else {
                const errData = await res.json();
                alert(errData.message || (isBn ? 'জেনেরিক তৈরি ব্যর্থ হয়েছে' : 'Failed to create generic'));
            }
        } catch {
            alert(isBn ? 'জেনেরিক তৈরি ব্যর্থ হয়েছে' : 'Failed to create generic');
        } finally {
            setSubmittingMaster(false);
        }
    };

    // Save discount rule
    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingMaster(true);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch('/api/catalog/discount-rules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    scope: ruleForm.scope,
                    scope_id: ruleForm.scope_id,
                    type: ruleForm.type,
                    value: ruleForm.value,
                    note: ruleForm.note || null,
                }),
            });
            if (res.ok) {
                setRuleModalOpen(false);
                setRuleForm({ scope: 'category', scope_id: '', type: 'percent', value: 5, note: '' });
                router.reload();
            } else {
                const errData = await res.json();
                alert(errData.message || (isBn ? 'ডিসকাউন্ট রুল তৈরি ব্যর্থ হয়েছে' : 'Failed to create discount rule'));
            }
        } catch {
            alert(isBn ? 'ডিসকাউন্ট রুল তৈরি ব্যর্থ হয়েছে' : 'Failed to create discount rule');
        } finally {
            setSubmittingMaster(false);
        }
    };

    const handleOpenCreateProduct = () => {
        if (!planLimit.allowed) {
            alert('You have reached the maximum product limit for your plan. Please upgrade.');
            return;
        }
        setEditingProduct(null);
        setProdForm({
            type: 'medicine',
            name: '',
            name_bn: '',
            sku: '',
            category_id: '',
            company_id: '',
            generic_id: '',
            strength: '',
            dosage_form: 'tablet',
            base_unit: 'pcs',
            track_batch: true,
            is_controlled: false,
            default_discount_type: 'none',
            default_discount_value: 0,
            units: [
                { unit_name: 'pcs', conversion_to_base: 1, is_sale_unit: true, is_purchase_unit: true, is_default_sale: true },
            ],
            barcodes: [],
            branch_settings: branches.map((b) => ({
                branch_id: b.id,
                min_stock: 10,
                max_stock: 500,
                reorder_level: 20,
                shelf_location: '',
            })),
        });
        setProductDrawerOpen(true);
    };

    return (
        <AppLayout
            title={isBn ? 'প্রোডাক্ট ক্যাটালগ' : 'Product Catalog'}
            subtitle={
                isBn
                    ? 'ওষুধ, ইউনিট কনভার্সন, বারকোড এবং ডিসকাউন্ট মাস্টার ডেটা'
                    : 'Manage products, units, internal barcodes, and branch inventory parameters'
            }
            actions={
                <div className="flex items-center gap-2">
                    <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                        <span className="text-slate-400">{isBn ? 'লিমিট' : 'Limit'}:</span>
                        <span className={`font-semibold ${planLimit.allowed ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {planLimit.used} / {planLimit.isUnlimited ? '∞' : planLimit.limit}
                        </span>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleOpenCreateProduct}
                        className="bg-[#FF4A1C] hover:bg-[#ff5d33] text-white font-semibold cursor-pointer shadow-xs text-xs h-8 px-3"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        {isBn ? 'নতুন পণ্য' : 'Add Product'}
                    </Button>
                </div>
            }
        >
            <Head title={isBn ? 'ক্যাটালগ' : 'Catalog'} />

            <div className="space-y-4">
                {/* Tab Navigation */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
                    {[
                        { id: 'products', label: isBn ? 'ওষুধ ও পণ্য' : 'Products', icon: Package },
                        { id: 'categories', label: isBn ? 'ক্যাটাগরি' : 'Categories', icon: FolderPlus },
                        { id: 'companies', label: isBn ? 'কোম্পানি' : 'Companies', icon: Layers },
                        { id: 'generics', label: isBn ? 'জেনেরিক' : 'Generics', icon: FileText },
                        { id: 'discounts', label: isBn ? 'ডিসকাউন্ট রুলস' : 'Discount Rules', icon: Tag },
                        {
                            id: 'import_export',
                            label: isBn ? 'ইমপোর্ট / এক্সপোর্ট' : 'Import / Export',
                            icon: UploadCloud,
                            locked: !canImport && !canExport,
                        },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${isActive
                                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                    }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                <span>{tab.label}</span>
                                {tab.locked && <Lock className="h-3 w-3 text-amber-400" />}
                            </button>
                        );
                    })}
                </div>

                {/* TAB 1: Products */}
                {activeTab === 'products' && (
                    <div className="space-y-4">
                        {/* Filters Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                            <div className="relative md:col-span-2">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={
                                        isBn ? 'নাম, জেনেরিক বা বারকোড দিয়ে সার্চ...' : 'Search by name, generic, barcode...'
                                    }
                                    className="pl-9 bg-slate-950 text-xs text-white border-slate-800"
                                />
                            </div>

                            <Select
                                value={filterType}
                                onChange={(e) => setFilterType(String(e.target.value))}
                                className="bg-slate-950 text-xs text-white border-slate-800"
                            >
                                <option value="">{isBn ? 'সব ধরন' : 'All Types'}</option>
                                <option value="medicine">{isBn ? 'ওষুধ (Medicine)' : 'Medicine'}</option>
                                <option value="non_medicine">{isBn ? 'অন্যান্য (Non-Medicine)' : 'Non-Medicine'}</option>
                            </Select>

                            <Select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(String(e.target.value))}
                                className="bg-slate-950 text-xs text-white border-slate-800"
                            >
                                <option value="">{isBn ? 'সব ক্যাটাগরি' : 'All Categories'}</option>
                                {initialCategories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </Select>

                            <Select
                                value={filterCompany}
                                onChange={(e) => setFilterCompany(String(e.target.value))}
                                className="bg-slate-950 text-xs text-white border-slate-800"
                            >
                                <option value="">{isBn ? 'সব কোম্পানি' : 'All Companies'}</option>
                                {initialCompanies.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </Select>

                            <Select
                                value={filterGeneric}
                                onChange={(e) => setFilterGeneric(String(e.target.value))}
                                className="bg-slate-950 text-xs text-white border-slate-800"
                            >
                                <option value="">{isBn ? 'সব জেনেরিক' : 'All Generics'}</option>
                                {initialGenerics.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.name}
                                    </option>
                                ))}
                            </Select>

                            <Select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(String(e.target.value))}
                                className="bg-slate-950 text-xs text-white border-slate-800"
                            >
                                <option value="">{isBn ? 'সকল স্ট্যাটাস' : 'All Status'}</option>
                                <option value="true">{isBn ? 'সক্রিয় (Active)' : 'Active'}</option>
                                <option value="false">{isBn ? 'নিষ্ক্রিয় (Inactive)' : 'Inactive'}</option>
                            </Select>
                        </div>

                        {/* Products Table */}
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="px-4 py-3">{isBn ? 'পণ্যের নাম' : 'Product Name'}</th>
                                        <th className="px-4 py-3">{isBn ? 'ধরন / গ্রুপ' : 'Type / Group'}</th>
                                        <th className="px-4 py-3">{isBn ? 'জেনেরিক ও কোম্পানি' : 'Generic & Company'}</th>
                                        <th className="px-4 py-3">{isBn ? 'ইউনিট' : 'Base Unit'}</th>
                                        <th className="px-4 py-3">{isBn ? 'বারকোড' : 'Barcodes'}</th>
                                        <th className="px-4 py-3">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                                        <th className="px-4 py-3 text-right">{isBn ? 'অ্যাকশন' : 'Actions'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {loadingProducts ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-500">
                                                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-orange-400" />
                                                <span>{isBn ? 'লোড হচ্ছে...' : 'Loading catalog...'}</span>
                                            </td>
                                        </tr>
                                    ) : products.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-500">
                                                <Package className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                                                <p className="font-semibold text-slate-400">
                                                    {isBn ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products found'}
                                                </p>
                                                <p className="text-[11px] mt-1">
                                                    {isBn ? 'সার্চ ফিল্টার পরিবর্তন করুন বা নতুন পণ্য যোগ করুন।' : 'Try adjusting filters or add your first product.'}
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        products.map((p) => (
                                            <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-white flex items-center gap-1.5">
                                                        <span>{p.name}</span>
                                                        {p.strength && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                                                {p.strength}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {p.name_bn && (
                                                        <div className="text-[11px] text-slate-400 font-bengali">
                                                            {p.name_bn}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.type === 'medicine'
                                                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                            : 'bg-slate-800 text-slate-300'
                                                            }`}
                                                    >
                                                        {p.type === 'medicine' ? (isBn ? 'ওষুধ' : 'Medicine') : (isBn ? 'অন্যান্য' : 'Item')}
                                                    </span>
                                                    {p.dosage_form && (
                                                        <span className="block text-[11px] text-slate-500 capitalize mt-0.5">
                                                            {p.dosage_form}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-slate-300 font-medium">{p.generic?.name || '—'}</div>
                                                    <div className="text-[11px] text-slate-500">{p.company?.name || '—'}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-slate-200 uppercase font-semibold text-xs">
                                                        {p.base_unit}
                                                    </span>
                                                    <span className="block text-[10px] text-slate-500">
                                                        {p.units?.length || 1} {isBn ? 'টি ইউনিট' : 'units'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <Barcode className="h-3.5 w-3.5 text-slate-500" />
                                                        <span className="font-mono text-xs text-slate-300">
                                                            {p.barcodes?.[0]?.barcode || '—'}
                                                        </span>
                                                        {p.barcodes && p.barcodes.length > 1 && (
                                                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1 rounded">
                                                                +{p.barcodes.length - 1}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${p.is_active
                                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                                            }`}
                                                    >
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${p.is_active ? 'bg-emerald-400' : 'bg-rose-400'
                                                                }`}
                                                        />
                                                        {p.is_active ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'নিষ্ক্রিয়' : 'Inactive')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {canPrintLabels && (
                                                            <button
                                                                title={isBn ? 'বারকোড লেবেল প্রিন্ট' : 'Print Barcode Label'}
                                                                onClick={() => {
                                                                    setSelectedLabelProduct(p);
                                                                    setLabelModalOpen(true);
                                                                }}
                                                                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                                                            >
                                                                <Printer className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            title={isBn ? 'স্ট্যাটাস টগল' : 'Toggle Active'}
                                                            onClick={() => handleToggleActive(p)}
                                                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            title={isBn ? 'এডিট করুন' : 'Edit Product'}
                                                            onClick={() => {
                                                                setEditingProduct(p);
                                                                setProdForm({
                                                                    type: p.type,
                                                                    name: p.name,
                                                                    name_bn: p.name_bn || '',
                                                                    sku: p.sku || '',
                                                                    category_id: p.category?.id || '',
                                                                    company_id: p.company?.id || '',
                                                                    generic_id: p.generic?.id || '',
                                                                    strength: p.strength || '',
                                                                    dosage_form: p.dosage_form || 'tablet',
                                                                    base_unit: p.base_unit || 'pcs',
                                                                    track_batch: p.track_batch,
                                                                    is_controlled: p.is_controlled,
                                                                    default_discount_type: p.default_discount_type || 'none',
                                                                    default_discount_value: p.default_discount_value || 0,
                                                                    units: p.units || [
                                                                        { unit_name: p.base_unit, conversion_to_base: 1, is_sale_unit: true, is_purchase_unit: true, is_default_sale: true },
                                                                    ],
                                                                    barcodes: p.barcodes || [],
                                                                    branch_settings: branches.map((b) => ({
                                                                        branch_id: b.id,
                                                                        min_stock: 10,
                                                                        max_stock: 500,
                                                                        reorder_level: 20,
                                                                        shelf_location: '',
                                                                    })),
                                                                });
                                                                setProductDrawerOpen(true);
                                                            }}
                                                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            title={isBn ? 'ডিলিট করুন' : 'Delete Product'}
                                                            onClick={() => handleDeleteProduct(p.id)}
                                                            className="p-1.5 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 2: Categories */}
                {activeTab === 'categories' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <FolderPlus className="h-4 w-4 text-orange-400" />
                                {isBn ? 'ক্যাটাগরি তালিকা' : 'Categories Directory'}
                            </h2>
                            <Button
                                onClick={() => setCategoryModalOpen(true)}
                                className="bg-[#FF4A1C] hover:bg-[#ff5d33] text-white text-xs font-semibold cursor-pointer"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                {isBn ? 'নতুন ক্যাটাগরি' : 'Add Category'}
                            </Button>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px]">
                                    <tr>
                                        <th className="px-4 py-3">{isBn ? 'ক্যাটাগরির নাম' : 'Category Name'}</th>
                                        <th className="px-4 py-3">{isBn ? 'বাংলা নাম' : 'Bengali Name'}</th>
                                        <th className="px-4 py-3">{isBn ? 'লেভেল / ডেপথ' : 'Depth'}</th>
                                        <th className="px-4 py-3">{isBn ? 'প্যারেন্ট ক্যাটাগরি' : 'Parent'}</th>
                                        <th className="px-4 py-3 text-right">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {initialCategories.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-800/40">
                                            <td className="px-4 py-3 font-semibold text-white">
                                                <div style={{ paddingLeft: `${c.depth * 16}px` }}>
                                                    {c.depth > 0 && <span className="text-slate-600 mr-1.5">└─</span>}
                                                    {c.name}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 font-bengali">{c.name_bn || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                                                    Level {c.depth + 1}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-400">
                                                {initialCategories.find((p) => p.id === c.parent_id)?.name || 'Root'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Badge variant={c.is_active ? 'success' : 'neutral'}>
                                                    {c.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 3: Companies */}
                {activeTab === 'companies' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <Layers className="h-4 w-4 text-orange-400" />
                                {isBn ? 'ফার্মাসিউটিক্যাল কোম্পানি তালিকা' : 'Pharmaceutical Companies'}
                            </h2>
                            <Button
                                onClick={() => setCompanyModalOpen(true)}
                                className="bg-[#FF4A1C] hover:bg-[#ff5d33] text-white text-xs font-semibold cursor-pointer"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                {isBn ? 'নতুন কোম্পানি' : 'Add Company'}
                            </Button>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px]">
                                    <tr>
                                        <th className="px-4 py-3">{isBn ? 'কোম্পানির নাম' : 'Company Name'}</th>
                                        <th className="px-4 py-3">{isBn ? 'বাংলা নাম' : 'Bengali Name'}</th>
                                        <th className="px-4 py-3 text-right">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {initialCompanies.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-800/40">
                                            <td className="px-4 py-3 font-semibold text-white">{c.name}</td>
                                            <td className="px-4 py-3 text-slate-400 font-bengali">{c.name_bn || '—'}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Badge variant={c.is_active ? 'success' : 'neutral'}>
                                                    {c.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 4: Generics */}
                {activeTab === 'generics' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <FileText className="h-4 w-4 text-orange-400" />
                                {isBn ? 'ওষুধের জেনেরিক গ্রুপ তালিকা' : 'Generic Molecules'}
                            </h2>
                            <Button
                                onClick={() => setGenericModalOpen(true)}
                                className="bg-[#FF4A1C] hover:bg-[#ff5d33] text-white text-xs font-semibold cursor-pointer"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                {isBn ? 'নতুন জেনেরিক' : 'Add Generic'}
                            </Button>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px]">
                                    <tr>
                                        <th className="px-4 py-3">{isBn ? 'জেনেরিক নাম' : 'Generic Name'}</th>
                                        <th className="px-4 py-3 text-right">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {initialGenerics.map((g) => (
                                        <tr key={g.id} className="hover:bg-slate-800/40">
                                            <td className="px-4 py-3 font-semibold text-white">{g.name}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Badge variant={g.is_active ? 'success' : 'neutral'}>
                                                    {g.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 5: Discount Rules */}
                {activeTab === 'discounts' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-orange-400" />
                                    {isBn ? 'ডিসকাউন্ট অফার ও প্রমোশন' : 'Discount Offers & Promotions'}
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {isBn
                                        ? 'নির্দিষ্ট ক্যাটাগরি বা কোম্পানির জন্য নির্ধারিত শতাংশ বা টাকার ছাড়'
                                        : 'Configure category or company level percentage or fixed discount offers'}
                                </p>
                            </div>
                            <Button
                                onClick={() => setRuleModalOpen(true)}
                                className="bg-[#FF4A1C] hover:bg-[#ff5d33] text-white text-xs font-semibold cursor-pointer"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                {isBn ? 'নতুন অফার যোগ করুন' : 'Add Discount Offer'}
                            </Button>
                        </div>

                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
                            <Tag className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                            <p className="text-xs font-semibold text-slate-300">
                                {isBn ? 'কোনো ডিসকাউন্ট রুল সক্রিয় নেই' : 'No active discount rules configured'}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1">
                                {isBn
                                    ? 'নতুন ডিসকাউন্ট অফার তৈরি করতে উপরের বাটনে ক্লিক করুন।'
                                    : 'Create promotional or quantity-based discount schedules.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* TAB 6: Import / Export */}
                {activeTab === 'import_export' && (
                    <div className="space-y-6">
                        {!canImport && !canExport ? (
                            <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-6 text-center">
                                <Lock className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                                <h3 className="text-sm font-bold text-white mb-1">
                                    {isBn ? 'ক্যাটালগ ইমপোর্ট / এক্সপোর্ট লক করা' : 'Catalog Import/Export Locked'}
                                </h3>
                                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                                    {isBn
                                        ? 'এক্সেল বা সিএসভি থেকে বাল্ক প্রোডাক্ট ইমপোর্ট এবং এক্সপোর্ট ফিচারটি প্রফেশনাল ও এন্টারপ্রাইজ প্ল্যানে উপলব্ধ।'
                                        : 'Bulk spreadsheet catalog import and export is available on Professional plan and above.'}
                                </p>
                                <Button
                                    onClick={() => router.visit(route('plans.index'))}
                                    className="bg-[#FF4A1C] hover:bg-[#ff5d33] text-white text-xs font-semibold"
                                >
                                    {isBn ? 'প্ল্যান আপগ্রেড করুন' : 'Upgrade Plan'}
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Export Box */}
                                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Download className="h-5 w-5 text-orange-400" />
                                            <h3 className="text-sm font-bold text-white">
                                                {isBn ? 'ক্যাটালগ এক্সপোর্ট ও টেমপ্লেট' : 'Export Catalog & Templates'}
                                            </h3>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed mb-6">
                                            {isBn
                                                ? 'আপনার সমস্ত মাস্টার পণ্য ডেটা সিএসভি ফরম্যাটে ডাউনলোড করুন অথবা নতুন পণ্য ইমপোর্ট করার জন্য অফিসিয়াল টেমপ্লেট সংগ্রহ করুন।'
                                                : 'Download your full tenant catalog or grab standard import templates with Bengali/English headers.'}
                                        </p>
                                    </div>

                                    <div className="space-y-2.5">
                                        <a
                                            href="/api/catalog/export/template"
                                            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition-colors"
                                        >
                                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                                            <span>{isBn ? 'ইমপোর্ট টেমপ্লেট ডাউনলোড (CSV)' : 'Download Import Template (CSV)'}</span>
                                        </a>

                                        <a
                                            href="/api/catalog/export"
                                            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-semibold text-white transition-colors"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                            <span>{isBn ? 'সম্পূর্ণ ক্যাটালগ এক্সপোর্ট করুন' : 'Export Full Catalog (CSV)'}</span>
                                        </a>
                                    </div>
                                </div>

                                {/* Import Wizard Box */}
                                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <UploadCloud className="h-5 w-5 text-blue-400" />
                                        <h3 className="text-sm font-bold text-white">
                                            {isBn ? 'এক্সেল বা সিএসভি থেকে বাল্ক পণ্য আপলোড' : 'Bulk Spreadsheet Import'}
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-400 mb-5">
                                        {isBn
                                            ? 'এক্সেল বা সিএসভি ফাইল আপলোড করুন। ডুপ্লিকেট স্কিপ হবে এবং স্বয়ংক্রিয়ভাবে জেনেরিক ও কোম্পানি তৈরি হবে।'
                                            : 'Upload CSV or XLSX file. Deduplication is automatic with 24-hour rollback guarantee.'}
                                    </p>

                                    {/* Upload Box */}
                                    <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/50 mb-4">
                                        <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-slate-500" />
                                        <label className="cursor-pointer">
                                            <span className="text-xs font-bold text-orange-400 hover:underline">
                                                {isBn ? 'ফাইল সিলেক্ট করুন' : 'Select a file'}
                                            </span>
                                            <span className="text-xs text-slate-500"> {isBn ? 'বা ড্র্যাগ করুন' : 'or drag and drop'}</span>
                                            <input
                                                type="file"
                                                accept=".csv,.xlsx"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    setImportFile(file);
                                                    const fd = new FormData();
                                                    fd.append('file', file);
                                                    try {
                                                        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
                                                        const res = await fetch('/api/catalog/import/upload', {
                                                            method: 'POST',
                                                            headers: {
                                                                'X-CSRF-TOKEN': csrfToken,
                                                                Accept: 'application/json',
                                                            },
                                                            body: fd,
                                                        });
                                                        const data = await res.json();
                                                        if (!res.ok) throw new Error(data.message || 'Upload failed');
                                                        setImportJobId(data.import_job_id);
                                                        setColumnMappings(data.suggested_mapping || {});
                                                        setImportStep(2);
                                                    } catch (err: any) {
                                                        alert(err.message || 'Upload failed');
                                                    }
                                                }}
                                            />
                                        </label>
                                        <p className="text-[10px] text-slate-600 mt-1">.CSV or .XLSX up to 10MB</p>
                                    </div>

                                    {importFile && (
                                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-300 font-mono truncate">{importFile.name}</span>
                                                {importJobId && (
                                                    <span className="text-[10px] text-emerald-400 font-mono">
                                                        (Job: {importJobId.slice(0, 8)} · Step {importStep} · {Object.keys(columnMappings).length} fields)
                                                    </span>
                                                )}
                                            </div>
                                            <Badge variant="neutral">{(importFile.size / 1024).toFixed(1)} KB</Badge>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* PRODUCT DRAWER / MODAL */}
                {productDrawerOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
                        <div className="bg-[#12171e] border border-slate-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#161c24]">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Package className="h-4 w-4 text-orange-400" />
                                    <span>
                                        {editingProduct
                                            ? isBn
                                                ? 'ওষুধ বা পণ্যের বিবরণ পরিবর্তন করুন'
                                                : 'Edit Medicine / Product'
                                            : isBn
                                                ? 'নতুন ওষুধ বা পণ্য যোগ করুন'
                                                : 'Add New Medicine / Product'}
                                    </span>
                                </h3>
                                <button
                                    onClick={() => setProductDrawerOpen(false)}
                                    className="text-slate-400 hover:text-white cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveProduct} className="p-6 space-y-6">
                                {/* Basic Info */}
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                                        <span className="h-5 w-5 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center text-[11px] font-bold">1</span>
                                        <span>{isBn ? 'সাধারণ তথ্য (ওষুধের নাম, ধরন ও কোম্পানি)' : 'General Information'}</span>
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                                {isBn ? 'পণ্যের নাম (ইংরেজি) *' : 'Product Name (English) *'}
                                            </label>
                                            <Input
                                                required
                                                value={prodForm.name}
                                                onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                                                placeholder="e.g. Napa Extra"
                                                className="bg-slate-950 text-xs text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                                {isBn ? 'বাংলা নাম (ঐচ্ছিক)' : 'Bengali Name (Optional)'}
                                            </label>
                                            <Input
                                                value={prodForm.name_bn}
                                                onChange={(e) => setProdForm({ ...prodForm, name_bn: e.target.value })}
                                                placeholder="উদাঃ নাপা এক্সট্রা"
                                                className="bg-slate-950 text-xs text-white font-bengali"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                                {isBn ? 'পণ্য ধরন' : 'Type'}
                                            </label>
                                            <Select
                                                value={prodForm.type}
                                                onChange={(e) =>
                                                    setProdForm({ ...prodForm, type: e.target.value as any })
                                                }
                                                className="bg-slate-950 text-xs text-white"
                                            >
                                                <option value="medicine">{isBn ? 'ওষুধ (Medicine)' : 'Medicine'}</option>
                                                <option value="non_medicine">{isBn ? 'অন্যান্য পণ্য' : 'Non-Medicine'}</option>
                                            </Select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                                SKU ({isBn ? 'ঐচ্ছিক' : 'Optional'})
                                            </label>
                                            <Input
                                                value={prodForm.sku}
                                                onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                                                placeholder="e.g. NAPA-EXT-500"
                                                className="bg-slate-950 text-xs text-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                                {isBn ? 'ক্যাটাগরি' : 'Category'}
                                            </label>
                                            <Select
                                                value={prodForm.category_id}
                                                onChange={(e) => setProdForm({ ...prodForm, category_id: String(e.target.value) })}
                                                className="bg-slate-950 text-xs text-white"
                                            >
                                                <option value="">{isBn ? 'সিলেক্ট করুন' : 'Select Category'}</option>
                                                {initialCategories.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </Select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                                {isBn ? 'কোম্পানি' : 'Company'}
                                            </label>
                                            <Select
                                                value={prodForm.company_id}
                                                onChange={(e) => setProdForm({ ...prodForm, company_id: String(e.target.value) })}
                                                className="bg-slate-950 text-xs text-white"
                                            >
                                                <option value="">{isBn ? 'সিলেক্ট করুন' : 'Select Company'}</option>
                                                {initialCompanies.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                            </Select>
                                        </div>

                                        {prodForm.type === 'medicine' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-300 mb-1">
                                                        {isBn ? 'জেনেরিক নাম' : 'Generic'}
                                                    </label>
                                                    <Select
                                                        value={prodForm.generic_id}
                                                        onChange={(e) =>
                                                            setProdForm({ ...prodForm, generic_id: String(e.target.value) })
                                                        }
                                                        className="bg-slate-950 text-xs text-white"
                                                    >
                                                        <option value="">{isBn ? 'সিলেক্ট করুন' : 'Select Generic'}</option>
                                                        {initialGenerics.map((g) => (
                                                            <option key={g.id} value={g.id}>
                                                                {g.name}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-slate-300 mb-1">
                                                        {isBn ? 'স্ট্রেন্থ' : 'Strength'}
                                                    </label>
                                                    <Input
                                                        value={prodForm.strength}
                                                        onChange={(e) =>
                                                            setProdForm({ ...prodForm, strength: e.target.value })
                                                        }
                                                        placeholder="e.g. 500mg, 10ml"
                                                        className="bg-slate-950 text-xs text-white"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Units Table */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                            <span className="h-5 w-5 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center text-[11px] font-bold">2</span>
                                            <span>{isBn ? 'প্যাকিং ও ইউনিট অনুপাত (পিস / পাতা / বক্স)' : 'Packaging & Units (Pcs / Strip / Box)'}</span>
                                        </h4>
                                        <Button
                                            type="button"
                                            onClick={addUnitRow}
                                            className="h-7 text-[11px] px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            {isBn ? 'নতুন ইউনিট' : 'Add Unit'}
                                        </Button>
                                    </div>

                                    {/* Live Conversion Preview */}
                                    <div className="p-2.5 rounded-lg bg-orange-950/20 border border-orange-800/40 text-xs text-orange-300 font-mono mb-3">
                                        <span className="text-slate-400 font-sans mr-2">{isBn ? 'হিসাব:' : 'Formula:'}</span>
                                        {unitConversionSummary}
                                    </div>

                                    <div className="space-y-2">
                                        {prodForm.units.map((u, i) => (
                                            <div
                                                key={i}
                                                className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs"
                                            >
                                                <div className="col-span-4">
                                                    <Input
                                                        value={u.unit_name}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            const updated = [...prodForm.units];
                                                            updated[i].unit_name = val;
                                                            if (u.conversion_to_base === 1) {
                                                                setProdForm({ ...prodForm, base_unit: val, units: updated });
                                                            } else {
                                                                setProdForm({ ...prodForm, units: updated });
                                                            }
                                                        }}
                                                        placeholder="e.g. pcs, strip, box"
                                                        className="h-8 bg-slate-900 text-xs"
                                                    />
                                                </div>

                                                <div className="col-span-3 flex items-center gap-1.5">
                                                    <span className="text-slate-500">=</span>
                                                    <Input
                                                        type="number"
                                                        disabled={u.conversion_to_base === 1}
                                                        value={u.conversion_to_base}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 1;
                                                            const updated = [...prodForm.units];
                                                            updated[i].conversion_to_base = Math.max(1, val);
                                                            setProdForm({ ...prodForm, units: updated });
                                                        }}
                                                        className="h-8 bg-slate-900 text-xs"
                                                    />
                                                    <span className="text-slate-400 font-mono text-[11px]">
                                                        {prodForm.base_unit}
                                                    </span>
                                                </div>

                                                <div className="col-span-4 flex items-center gap-3">
                                                    <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="default_sale_radio"
                                                            checked={u.is_default_sale}
                                                            onChange={() => {
                                                                const updated = prodForm.units.map((item, idx) => ({
                                                                    ...item,
                                                                    is_default_sale: idx === i,
                                                                }));
                                                                setProdForm({ ...prodForm, units: updated });
                                                            }}
                                                        />
                                                        <span>{isBn ? 'খুচরা বিক্রির মূল ইউনিট' : 'Retail Sale Unit'}</span>
                                                    </label>
                                                </div>

                                                <div className="col-span-1 text-right">
                                                    {u.conversion_to_base > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeUnitRow(i)}
                                                            className="text-slate-500 hover:text-rose-400 cursor-pointer"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Barcodes Table */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                            <span className="h-5 w-5 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center text-[11px] font-bold">3</span>
                                            <span>{isBn ? 'বারকোড ও স্ক্যান কোড' : 'Barcodes & Scan Codes'}</span>
                                        </h4>
                                        <Button
                                            type="button"
                                            onClick={handleGenerateBarcode}
                                            className="h-7 text-[11px] px-2.5 bg-orange-600 hover:bg-orange-500 text-white cursor-pointer"
                                        >
                                            <Barcode className="h-3.5 w-3.5 mr-1" />
                                            {isBn ? 'বারকোড তৈরি করুন' : 'Generate Barcode'}
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        {prodForm.barcodes.length === 0 ? (
                                            <p className="text-xs text-slate-500 py-2">
                                                {isBn
                                                    ? 'কোনো বারকোড যোগ করা হয়নি। ম্যানুয়ালি যোগ করুন বা স্বয়ংক্রিয় তৈরি করুন।'
                                                    : 'No barcodes assigned yet. Click generate or enter one.'}
                                            </p>
                                        ) : (
                                            prodForm.barcodes.map((b, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Barcode className="h-4 w-4 text-orange-400" />
                                                        <span className="font-mono text-white font-bold tracking-wider">
                                                            {b.barcode}
                                                        </span>
                                                        {b.is_primary && (
                                                            <Badge variant="success">Primary</Badge>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setProdForm({
                                                                ...prodForm,
                                                                barcodes: prodForm.barcodes.filter((_, idx) => idx !== i),
                                                            });
                                                        }}
                                                        className="text-slate-500 hover:text-rose-400 cursor-pointer"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Submit buttons */}
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                    <Button
                                        type="button"
                                        onClick={() => setProductDrawerOpen(false)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                                    >
                                        {isBn ? 'বাতিল' : 'Cancel'}
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="bg-[#FF4A1C] hover:bg-[#ff5d33] text-white text-xs font-semibold cursor-pointer shadow-md"
                                    >
                                        <Check className="h-4 w-4 mr-1.5" />
                                        {editingProduct
                                            ? isBn
                                                ? 'তথ্য আপডেট করুন'
                                                : 'Save Changes'
                                            : isBn
                                                ? 'ওষুধ সংরক্ষণ করুন'
                                                : 'Save Medicine'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* BARCODE LABEL MODAL */}
                {labelModalOpen && selectedLabelProduct && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
                        <div className="bg-[#12171e] border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Printer className="h-4 w-4 text-orange-400" />
                                    <span>{isBn ? 'বারকোড লেবেল প্রিন্ট' : 'Print Barcode Labels'}</span>
                                </h3>
                                <button
                                    onClick={() => setLabelModalOpen(false)}
                                    className="text-slate-400 hover:text-white cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">
                                        {isBn ? 'লেবেল সাইজ প্রিসেট' : 'Label Size Preset'}
                                    </label>
                                    <Select
                                        value={labelPreset}
                                        onChange={(e) => setLabelPreset(e.target.value as any)}
                                        className="bg-slate-950 text-xs text-white"
                                    >
                                        <option value="38x25">38mm x 25mm (Standard Counter Single)</option>
                                        <option value="50x30">50mm x 30mm (Large Pharmacy Thermal)</option>
                                        <option value="a4_3x8">A4 Sheet (3x8 - 24 Labels/Page)</option>
                                    </Select>
                                </div>

                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">
                                        {isBn ? 'পরিমাণ (কপি সংখ্যা)' : 'Quantity / Copies'}
                                    </label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={labelQuantity}
                                        onChange={(e) => setLabelQuantity(parseInt(e.target.value) || 1)}
                                        className="bg-slate-950 text-xs text-white"
                                    />
                                </div>

                                {/* Preview Card */}
                                <div className="border border-slate-700 bg-white text-slate-900 p-4 rounded-lg text-center shadow-inner font-sans">
                                    <div className="text-xs font-bold truncate">{selectedLabelProduct.name}</div>
                                    {selectedLabelProduct.name_bn && (
                                        <div className="text-[11px] text-slate-700 font-bengali">
                                            {selectedLabelProduct.name_bn}
                                        </div>
                                    )}
                                    <div className="my-2 flex justify-center">
                                        <Barcode className="h-10 w-44 text-slate-900" />
                                    </div>
                                    <div className="text-xs font-mono font-bold tracking-widest">
                                        {selectedLabelProduct.barcodes?.[0]?.barcode || '2000000000010'}
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                    <Button
                                        onClick={() => setLabelModalOpen(false)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                                    >
                                        {isBn ? 'বন্ধ করুন' : 'Close'}
                                    </Button>
                                    <a
                                        href={`/api/catalog/products/${selectedLabelProduct.id}/labels?preset=${labelPreset}&quantity=${labelQuantity}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="py-2 px-4 rounded-lg bg-[#FF4A1C] hover:bg-[#ff5d33] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                        <span>{isBn ? 'প্রিন্ট পেজ খুলুন' : 'Open Print Dialog'}</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CATEGORY MODAL */}
                {categoryModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
                        <div className="bg-[#12171e] border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <FolderPlus className="h-4 w-4 text-orange-400" />
                                    <span>{isBn ? 'নতুন ক্যাটাগরি তৈরি করুন' : 'Add New Category'}</span>
                                </h3>
                                <button
                                    onClick={() => setCategoryModalOpen(false)}
                                    className="text-slate-400 hover:text-white cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <form onSubmit={handleSaveCategory} className="space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-300 mb-1">
                                        {isBn ? 'ক্যাটাগরির নাম (ইংরেজি) *' : 'Category Name (English) *'}
                                    </label>
                                    <Input
                                        required
                                        value={catForm.name}
                                        onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                                        placeholder="e.g. Antibiotics, Syrups"
                                        className="bg-slate-950 text-xs text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-300 mb-1">
                                        {isBn ? 'বাংলা নাম (ঐচ্ছিক)' : 'Bengali Name (Optional)'}
                                    </label>
                                    <Input
                                        value={catForm.name_bn}
                                        onChange={(e) => setCatForm({ ...catForm, name_bn: e.target.value })}
                                        placeholder="উদাঃ এন্টিবায়োটিক, সিরাপ"
                                        className="bg-slate-950 text-xs text-white font-bengali"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-300 mb-1">
                                        {isBn ? 'মূল ক্যাটাগরি (ঐচ্ছিক)' : 'Parent Category (Optional)'}
                                    </label>
                                    <Select
                                        value={catForm.parent_id}
                                        onChange={(e) => setCatForm({ ...catForm, parent_id: String(e.target.value) })}
                                        className="bg-slate-950 text-xs text-white"
                                    >
                                        <option value="">{isBn ? 'কোনোটি নয় (মূল ক্যাটাগরি)' : 'None (Top Level)'}</option>
                                        {initialCategories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                    <Button
                                        type="button"
                                        onClick={() => setCategoryModalOpen(false)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                                    >
                                        {isBn ? 'বাতিল' : 'Cancel'}
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submittingMaster}
                                        className="bg-[#FF4A1C] hover:bg-[#ff5d33] text-white text-xs font-semibold cursor-pointer shadow-md"
                                    >
                                        <Check className="h-4 w-4 mr-1.5" />
                                        {isBn ? 'ক্যাটাগরি সংরক্ষণ' : 'Save Category'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* COMPANY MODAL */}
                {companyModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
                        <div className="bg-[#12171e] border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-orange-400" />
                                    <span>{isBn ? 'নতুন ওষুধ কোম্পানি যোগ করুন' : 'Add Pharmaceutical Company'}</span>
                                </h3>
                                <button
                                    onClick={() => setCompanyModalOpen(false)}
                                    className="text-slate-400 hover:text-white cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <form onSubmit={handleSaveCompany} className="space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-300 mb-1">
                                        {isBn ? 'কোম্পানির নাম (ইংরেজি) *' : 'Company Name (English) *'}
                                    </label>
                                    <Input
                                        required
                                        value={compForm.name}
                                        onChange={(e) => setCompForm({ ...compForm, name: e.target.value })}
                                        placeholder="e.g. Square Pharmaceuticals, Beximco"
                                        className="bg-slate-950 text-xs text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-300 mb-1">
                                        {isBn ? 'বাংলা নাম (ঐচ্ছিক)' : 'Bengali Name (Optional)'}
                                    </label>
                                    <Input
                                        value={compForm.name_bn}
                                        onChange={(e) => setCompForm({ ...compForm, name_bn: e.target.value })}
                                        placeholder="উদাঃ স্কয়ার ফার্মাসিউটিক্যালস"
                                        className="bg-slate-950 text-xs text-white font-bengali"
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                    <Button
                                        type="button"
                                        onClick={() => setCompanyModalOpen(false)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                                    >
                                        {isBn ? 'বাতিল' : 'Cancel'}
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submittingMaster}
                                        className="bg-[#FF4A1C] hover:bg-[#ff5d33] text-white text-xs font-semibold cursor-pointer shadow-md"
                                    >
                                        <Check className="h-4 w-4 mr-1.5" />
                                        {isBn ? 'কোম্পানি সংরক্ষণ' : 'Save Company'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* GENERIC MODAL */}
                {genericModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
                        <div className="bg-[#12171e] border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-orange-400" />
                                    <span>{isBn ? 'নতুন জেনেরিক গ্রুপ যোগ করুন' : 'Add Generic Molecule'}</span>
                                </h3>
                                <button
                                    onClick={() => setGenericModalOpen(false)}
                                    className="text-slate-400 hover:text-white cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <form onSubmit={handleSaveGeneric} className="space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-300 mb-1">
                                        {isBn ? 'জেনেরিক নাম *' : 'Generic Name *'}
                                    </label>
                                    <Input
                                        required
                                        value={genForm.name}
                                        onChange={(e) => setGenForm({ ...genForm, name: e.target.value })}
                                        placeholder="e.g. Paracetamol, Azithromycin"
                                        className="bg-slate-950 text-xs text-white"
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                    <Button
                                        type="button"
                                        onClick={() => setGenericModalOpen(false)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                                    >
                                        {isBn ? 'বাতিল' : 'Cancel'}
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submittingMaster}
                                        className="bg-[#FF4A1C] hover:bg-[#ff5d33] text-white text-xs font-semibold cursor-pointer shadow-md"
                                    >
                                        <Check className="h-4 w-4 mr-1.5" />
                                        {isBn ? 'জেনেরিক সংরক্ষণ' : 'Save Generic'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* DISCOUNT RULE MODAL */}
                {ruleModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
                        <div className="bg-[#12171e] border border-slate-800 rounded-xl w-full max-w-md shadow-2xl p-6">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-orange-400" />
                                    <span>{isBn ? 'নতুন ডিসকাউন্ট অফার তৈরি করুন' : 'Add Discount Offer'}</span>
                                </h3>
                                <button
                                    onClick={() => setRuleModalOpen(false)}
                                    className="text-slate-400 hover:text-white cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <form onSubmit={handleSaveRule} className="space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-300 mb-1">
                                        {isBn ? 'ডিসকাউন্টের আওতা (Scope)' : 'Discount Scope'}
                                    </label>
                                    <Select
                                        value={ruleForm.scope}
                                        onChange={(e) => setRuleForm({ ...ruleForm, scope: e.target.value as any, scope_id: '' })}
                                        className="bg-slate-950 text-xs text-white"
                                    >
                                        <option value="category">{isBn ? 'নির্দিষ্ট ক্যাটাগরির জন্য' : 'Apply to Category'}</option>
                                        <option value="company">{isBn ? 'নির্দিষ্ট কোম্পানির জন্য' : 'Apply to Company'}</option>
                                    </Select>
                                </div>
                                {ruleForm.scope === 'category' ? (
                                    <div>
                                        <label className="block text-xs text-slate-300 mb-1">
                                            {isBn ? 'ক্যাটাগরি সিলেক্ট করুন *' : 'Select Category *'}
                                        </label>
                                        <Select
                                            required
                                            value={ruleForm.scope_id}
                                            onChange={(e) => setRuleForm({ ...ruleForm, scope_id: String(e.target.value) })}
                                            className="bg-slate-950 text-xs text-white"
                                        >
                                            <option value="">{isBn ? 'ক্যাটাগরি বেছে নিন' : 'Choose Category'}</option>
                                            {initialCategories.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs text-slate-300 mb-1">
                                            {isBn ? 'কোম্পানি সিলেক্ট করুন *' : 'Select Company *'}
                                        </label>
                                        <Select
                                            required
                                            value={ruleForm.scope_id}
                                            onChange={(e) => setRuleForm({ ...ruleForm, scope_id: String(e.target.value) })}
                                            className="bg-slate-950 text-xs text-white"
                                        >
                                            <option value="">{isBn ? 'কোম্পানি বেছে নিন' : 'Choose Company'}</option>
                                            {initialCompanies.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-300 mb-1">
                                            {isBn ? 'ছাড়ের ধরন' : 'Type'}
                                        </label>
                                        <Select
                                            value={ruleForm.type}
                                            onChange={(e) => setRuleForm({ ...ruleForm, type: e.target.value as any })}
                                            className="bg-slate-950 text-xs text-white"
                                        >
                                            <option value="percent">{isBn ? 'শতকরা (%)' : 'Percentage (%)'}</option>
                                            <option value="fixed">{isBn ? 'নির্দিষ্ট টাকা (BDT)' : 'Fixed Amount (BDT)'}</option>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-300 mb-1">
                                            {isBn ? 'পরিমাণ (Value) *' : 'Value *'}
                                        </label>
                                        <Input
                                            type="number"
                                            min={0}
                                            required
                                            value={ruleForm.value}
                                            onChange={(e) => setRuleForm({ ...ruleForm, value: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-950 text-xs text-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-300 mb-1">
                                        {isBn ? 'বিবরণ / নোট (ঐচ্ছিক)' : 'Note / Description (Optional)'}
                                    </label>
                                    <Input
                                        value={ruleForm.note}
                                        onChange={(e) => setRuleForm({ ...ruleForm, note: e.target.value })}
                                        placeholder="e.g. Ramadan Offer 2026"
                                        className="bg-slate-950 text-xs text-white"
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                    <Button
                                        type="button"
                                        onClick={() => setRuleModalOpen(false)}
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                                    >
                                        {isBn ? 'বাতিল' : 'Cancel'}
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={submittingMaster}
                                        className="bg-[#FF4A1C] hover:bg-[#ff5d33] text-white text-xs font-semibold cursor-pointer shadow-md"
                                    >
                                        <Check className="h-4 w-4 mr-1.5" />
                                        {isBn ? 'অফার সংরক্ষণ' : 'Save Offer'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
