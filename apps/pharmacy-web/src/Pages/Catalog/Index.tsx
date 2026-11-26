import React, { useEffect, useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import {
 Barcode,
 Check,
 ChevronLeft,
 ChevronRight,
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
 Save,
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
import { BrtaField, BrtaFormGrid, BrtaFormModal, brtaInputClass } from '@/Components/ui/BrtaForm';
import { MetricCard } from '@/Components/cards/MetricCard';
import { DataTable, Column, EmptyState, TableActionMenu } from '@/Components/tables';
import { BarcodeSvg } from '@/Components/BarcodeSvg';
import { formatCurrency } from '@/lib/format';
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
 mrp?: number | string | null;
 selling_price?: number | string | null;
 purchase_price?: number | string | null;
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
 const { locale, tenant } = usePage<SharedPageProps>().props;
 const isBn = locale === 'bn';
 const currency = tenant?.currentTenant?.currency_code ?? 'BDT';

 const [activeTab, setActiveTab] = useState<
 'products' | 'categories' | 'companies' | 'generics' | 'discounts' | 'import_export'
 >('products');

 // Products state
 const [products, setProducts] = useState<ProductItem[]>([]);
 const [loadingProducts, setLoadingProducts] = useState(false);
 const [searchQuery] = useState('');
 const [filterType, setFilterType] = useState('');
 const [filterCategory, setFilterCategory] = useState('');
 const [filterCompany, setFilterCompany] = useState('');
 const [filterGeneric, setFilterGeneric] = useState('');
 const [filterStatus, setFilterStatus] = useState('');

 // Modals
 const [productDrawerOpen, setProductDrawerOpen] = useState(false);
 const [productFormStep, setProductFormStep] = useState<1 | 2 | 3 | 4>(1);
 const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
 const [manualBarcodeInput, setManualBarcodeInput] = useState('');

 useEffect(() => {
 if (productDrawerOpen) {
 setProductFormStep(1);
 setManualBarcodeInput('');
 }
 }, [productDrawerOpen]);
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
 mrp: string;
 selling_price: string;
 purchase_price: string;
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
 mrp: '',
 selling_price: '',
 purchase_price: '',
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
 limit: '50',
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
 per_page: '100',
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

 const [activeProductTab, setActiveProductTab] = useState<'all' | 'medicine' | 'non_medicine' | 'active' | 'inactive'>('all');

 // Enriched products for fast in-memory filtering and column rendering
 const enrichedProducts = useMemo(() => {
 return products.map((p) => ({
 ...p,
 category_name: p.category?.name || '',
 company_name: p.company?.name || '',
 generic_name: p.generic?.name || '',
 barcode_list: p.barcodes?.map((b) => b.barcode).join(' ') || '',
 }));
 }, [products]);

 // Product columns matching PharmaCore standard design
 const productColumns = useMemo<Column<any>[]>(
 () => [
 {
 id: 'sku',
 label: isBn ? 'এসকেইউ' : 'SKU',
 sortable: true,
 render: (p) => (
 <span className="tabular-nums font-bold text-[#0E5F3F] text-[11.5px]">
 {p.sku || '—'}
 </span>
 ),
 },
 {
 id: 'barcode',
 label: isBn ? 'বারকোড' : 'Barcode',
 render: (p) => {
 const primary = p.barcodes?.find((b: any) => b.is_primary) || p.barcodes?.[0];
 return primary ? (
 <div className="py-0.5">
 <BarcodeSvg value={primary.barcode} compact />
 </div>
 ) : (
 <span className="text-[11.5px] font-medium text-slate-400">—</span>
 );
 },
 },
 {
 id: 'name',
 label: isBn ? 'ওষুধ / পণ্যের নাম' : 'Medicine / Product',
 sortable: true,
 render: (p) => (
 <div>
 <div className="font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap">
 <span className="text-[11.5px] font-bold text-slate-900 dark:text-slate-200">{p.name}</span>
 {p.strength && (
 <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
 {p.strength}
 </span>
 )}
 {p.is_controlled && (
 <span className="text-[9.5px] font-extrabold text-[#0E5F3F] px-1 py-0.2 rounded-[2px] bg-[#EAF5F0] dark:bg-emerald-950/40 border border-[#0E5F3F]/25 dark:border-emerald-900">
 Rx
 </span>
 )}
 </div>
 {p.name_bn && (
 <div className="text-[9.5px] text-slate-500 dark:text-slate-400 font-bengali mt-0.5">
 {p.name_bn}
 </div>
 )}
 </div>
 ),
 },
 {
 id: 'generic_company',
 label: isBn ? 'জেনেরিক ও কোম্পানি' : 'Generic / Mfg',
 sortable: true,
 render: (p) => {
 const summary = `${p.generic?.name || ''}${
 p.company?.name ? ` · ${p.company.name}` : ''
 }`;
 return (
 <span
 className="block max-w-[220px] truncate text-[11.5px] font-bold text-slate-900 dark:text-slate-200"
 title={summary}
 >
 {summary || '—'}
 </span>
 );
 },
 },
 {
 id: 'category',
 label: isBn ? 'ক্যাটাগরি' : 'Category',
 sortable: true,
 render: (p) => (
 <span className="text-[11.5px] font-bold text-slate-900 dark:text-slate-200">
 {p.category?.name || '—'}
 </span>
 ),
 },
 {
 id: 'type',
 label: isBn ? 'ধরন' : 'Type / Form',
 sortable: true,
 render: (p) => (
 <div className="flex flex-col items-start gap-0.5">
 <Badge variant={p.type === 'medicine' ? 'sky' : 'neutral'} className="text-[9.5px]">
 {p.type === 'medicine' ? (isBn ? 'ওষুধ' : 'Medicine') : (isBn ? 'অন্যান্য' : 'Item')}
 </Badge>
 {p.dosage_form && (
 <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300 capitalize">
 {p.dosage_form}
 </span>
 )}
 </div>
 ),
 },
 {
 id: 'base_unit',
 label: isBn ? 'ইউনিট' : 'Base Unit',
 render: (p) => (
 <span className="text-[11.5px] font-bold text-slate-900 dark:text-slate-200">
 {p.base_unit}
 </span>
 ),
 },
 {
 id: 'pricing',
 label: isBn ? 'বিক্রয় মূল্য / MRP' : 'Sale / MRP',
 sortable: true,
 className: 'text-right',
 render: (p) => {
 const mrp = Number(p.mrp ?? 0);
 const sale = Number(p.selling_price ?? 0) || mrp;
 return (
 <div className="inline-flex flex-col items-end whitespace-nowrap tabular-nums">
 <span className="text-[11.5px] font-bold text-slate-900 dark:text-slate-200">
 {sale > 0 ? formatCurrency(sale, currency) : '—'}
 </span>
 {mrp > 0 && (
 <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
 MRP {formatCurrency(mrp, currency)}
 </span>
 )}
 </div>
 );
 },
 },
 {
 id: 'is_active',
 label: isBn ? 'স্ট্যাটাস' : 'Status',
 sortable: true,
 render: (p) => (
 <Badge variant={p.is_active ? 'success' : 'neutral'} className="text-[9.5px]">
 {p.is_active ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'নিষ্ক্রিয়' : 'Inactive')}
 </Badge>
 ),
 },
 ],
 [isBn, currency]
 );

 // Categories columns
 const categoryColumns = useMemo<Column<CategoryItem>[]>(
 () => [
 {
 id: 'name',
 label: isBn ? 'ক্যাটাগরির নাম' : 'Category Name',
 sortable: true,
 render: (c) => (
 <div style={{ paddingLeft: `${c.depth * 16}px` }} className="text-[11.5px] font-bold text-slate-900 dark:text-slate-200 flex items-center">
 {c.depth > 0 && <span className="text-slate-400 dark:text-slate-500 mr-1.5 tabular-nums">└─</span>}
 <span>{c.name}</span>
 </div>
 ),
 },
 {
 id: 'name_bn',
 label: isBn ? 'বাংলা নাম' : 'Bengali Name',
 render: (c) => (
 <span className="text-slate-500 dark:text-slate-400 font-bengali text-[11.5px] font-bold">
 {c.name_bn || '—'}
 </span>
 ),
 },
 {
 id: 'depth',
 label: isBn ? 'লেভেল / ডেপথ' : 'Depth',
 render: (c) => (
 <Badge variant="slate"className="text-[9.5px]">
 Level {c.depth + 1}
 </Badge>
 ),
 },
 {
 id: 'parent',
 label: isBn ? 'প্যারেন্ট ক্যাটাগরি' : 'Parent',
 render: (c) => {
 const parent = initialCategories.find((p) => p.id === c.parent_id);
 return (
 <span className="text-[11.5px] font-bold text-slate-900 dark:text-slate-200">
 {parent?.name || 'Root'}
 </span>
 );
 },
 },
 {
 id: 'is_active',
 label: isBn ? 'স্ট্যাটাস' : 'Status',
 sortable: true,
 render: (c) => (
 <Badge variant={c.is_active ? 'success' : 'neutral'} className="text-[9.5px]">
 {c.is_active ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'নিষ্ক্রিয়' : 'Inactive')}
 </Badge>
 ),
 },
 ],
 [isBn, initialCategories]
 );

 // Companies columns
 const companyColumns = useMemo<Column<CompanyItem>[]>(
 () => [
 {
 id: 'name',
 label: isBn ? 'কোম্পানির নাম' : 'Company Name',
 sortable: true,
 render: (c) => (
 <span className="text-[11.5px] font-bold text-slate-900 dark:text-slate-200">
 {c.name}
 </span>
 ),
 },
 {
 id: 'name_bn',
 label: isBn ? 'বাংলা নাম' : 'Bengali Name',
 render: (c) => (
 <span className="text-slate-500 dark:text-slate-400 font-bengali text-[11.5px] font-bold">
 {c.name_bn || '—'}
 </span>
 ),
 },
 {
 id: 'is_active',
 label: isBn ? 'স্ট্যাটাস' : 'Status',
 sortable: true,
 render: (c) => (
 <Badge variant={c.is_active ? 'success' : 'neutral'} className="text-[9.5px]">
 {c.is_active ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'নিষ্ক্রিয়' : 'Inactive')}
 </Badge>
 ),
 },
 ],
 [isBn]
 );

 // Generics columns
 const genericColumns = useMemo<Column<GenericItem>[]>(
 () => [
 {
 id: 'name',
 label: isBn ? 'জেনেরিক নাম' : 'Generic Name',
 sortable: true,
 render: (g) => (
 <span className="text-[11.5px] font-bold text-slate-900 dark:text-slate-200">
 {g.name}
 </span>
 ),
 },
 {
 id: 'is_active',
 label: isBn ? 'স্ট্যাটাস' : 'Status',
 sortable: true,
 render: (g) => (
 <Badge variant={g.is_active ? 'success' : 'neutral'} className="text-[9.5px]">
 {g.is_active ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'নিষ্ক্রিয়' : 'Inactive')}
 </Badge>
 ),
 },
 ],
 [isBn]
 );

 // Header tabs for Products table
 const productHeaderTabs = (
 <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto hide-scrollbar mb-[-1px]">
 {[
 { key: 'all', label: isBn ? 'সকল পণ্য' : 'All Products', count: products.length },
 {
 key: 'medicine',
 label: isBn ? 'ওষুধ' : 'Medicines',
 count: products.filter((p) => p.type === 'medicine').length,
 },
 {
 key: 'non_medicine',
 label: isBn ? 'অন্যান্য পণ্য' : 'Non-Medicine',
 count: products.filter((p) => p.type !== 'medicine').length,
 },
 {
 key: 'active',
 label: isBn ? 'সক্রিয়' : 'Active',
 count: products.filter((p) => p.is_active).length,
 },
 {
 key: 'inactive',
 label: isBn ? 'নিষ্ক্রিয়' : 'Inactive',
 count: products.filter((p) => !p.is_active).length,
 },
 ].map((tab) => {
 const isActive = activeProductTab === tab.key;
 return (
 <button
 key={tab.key}
 type="button"
 onClick={() => {
 setActiveProductTab(tab.key as any);
 if (tab.key === 'all') {
 setFilterType('');
 setFilterStatus('');
 } else if (tab.key === 'medicine' || tab.key === 'non_medicine') {
 setFilterType(tab.key);
 setFilterStatus('');
 } else if (tab.key === 'active') {
 setFilterType('');
 setFilterStatus('true');
 } else if (tab.key === 'inactive') {
 setFilterType('');
 setFilterStatus('false');
 }
 }}
 className={`flex items-center gap-1.5 pb-2.5 border-b transition-colors whitespace-nowrap cursor-pointer px-1 ${
 isActive
 ? 'border-[#0E5F3F] text-[#0E5F3F] dark:border-[#0E5F3F] dark:text-[#0E5F3F]'
 : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
 }`}
 >
 <span className={`text-[13px] ${isActive ? 'font-bold' : 'font-medium'}`}>
 {tab.label}
 </span>
 <span
 className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full transition-colors ${
 isActive
 ? 'bg-[#EAF5F0] dark:bg-[#0E5F3F]/20 text-[#0E5F3F] dark:text-emerald-400'
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

 // Filter popover content for Products table
 const productFilterContent = (
 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
 <div>
 <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
 {isBn ? 'ক্যাটাগরি' : 'Category'}
 </label>
 <Select
 value={filterCategory}
 onChange={(e) => setFilterCategory(String(e.target.value))}
 size="sm"
 >
 <option value="">{isBn ? 'সব ক্যাটাগরি' : 'Select Category'}</option>
 {initialCategories.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </Select>
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
 {isBn ? 'কোম্পানি' : 'Company'}
 </label>
 <Select
 value={filterCompany}
 onChange={(e) => setFilterCompany(String(e.target.value))}
 size="sm"
 >
 <option value="">{isBn ? 'সব কোম্পানি' : 'Select Company'}</option>
 {initialCompanies.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </Select>
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
 {isBn ? 'জেনেরিক' : 'Generic'}
 </label>
 <Select
 value={filterGeneric}
 onChange={(e) => setFilterGeneric(String(e.target.value))}
 size="sm"
 >
 <option value="">{isBn ? 'সব জেনেরিক' : 'Select Generic'}</option>
 {initialGenerics.map((g) => (
 <option key={g.id} value={g.id}>
 {g.name}
 </option>
 ))}
 </Select>
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
 {isBn ? 'স্ট্যাটাস' : 'Status'}
 </label>
 <Select
 value={filterStatus}
 onChange={(e) => setFilterStatus(String(e.target.value))}
 size="sm"
 >
 <option value="">{isBn ? 'সকল স্ট্যাটাস' : 'All Status'}</option>
 <option value="true">{isBn ? 'সক্রিয় (Active)' : 'Active'}</option>
 <option value="false">{isBn ? 'নিষ্ক্রিয় (Inactive)' : 'Inactive'}</option>
 </Select>
 </div>
 {(filterCategory || filterCompany || filterGeneric || filterStatus || filterType) && (
 <div className="sm:col-span-2 md:col-span-4 flex justify-end">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setFilterCategory('');
 setFilterCompany('');
 setFilterGeneric('');
 setFilterStatus('');
 setFilterType('');
 setActiveProductTab('all');
 }}
 >
 {isBn ? 'ফিল্টার রিসেট করুন' : 'Reset Filters'}
 </Button>
 </div>
 )}
 </div>
 );

 // Live unit conversion preview: e.g."1 box = 10 strips = 100 pcs"
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
 mrp: prodForm.mrp !== '' ? Number(prodForm.mrp) : 0,
 selling_price:
 prodForm.selling_price !== ''
 ? Number(prodForm.selling_price)
 : prodForm.mrp !== ''
 ? Number(prodForm.mrp)
 : 0,
 purchase_price: prodForm.purchase_price !== '' ? Number(prodForm.purchase_price) : 0,
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
 mrp: '',
 selling_price: '',
 purchase_price: '',
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
 <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
 <span className="text-slate-500 dark:text-slate-400">{isBn ? 'লিমিট' : 'Limit'}:</span>
 <span className={`font-semibold ${planLimit.allowed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
 {planLimit.used} / {planLimit.isUnlimited ? '∞' : planLimit.limit}
 </span>
 </div>
 <Button
 size="md"
 variant="primary"
 onClick={handleOpenCreateProduct}
 className="gap-1.5 shadow-xs"
 >
 <Plus className="h-4 w-4"/>
 {isBn ? 'নতুন পণ্য যোগ' : 'Add Product'}
 </Button>
 </div>
 }
 >
 <Head title={isBn ? 'ক্যাটালগ' : 'Catalog'} />

 <div className="space-y-4">
 {/* Executive Metric Cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 <MetricCard
 title={isBn ? 'মোট পণ্য ও ওষুধ' : 'Total Products'}
 value={products.length > 0 ? products.length : (planLimit.used || 0)}
 description={isBn ? 'ক্যাটালগে মোট এসকেইউ' : 'Catalog SKU items'}
 icon={Package}
 colorClass="bg-[#EAF5F0] dark:bg-[#0E5F3F]/10 text-[#0E5F3F]"
 />
 <MetricCard
 title={isBn ? 'মোট ক্যাটাগরি' : 'Categories'}
 value={initialCategories.length}
 description={isBn ? 'ওষুধ ও কনজিউমার গ্রুপ' : 'Classification groups'}
 icon={FolderPlus}
 colorClass="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
 />
 <MetricCard
 title={isBn ? 'কোম্পানি / ম্যানুফ্যাকচারার' : 'Manufacturers'}
 value={initialCompanies.length}
 description={isBn ? 'ফার্মা কোম্পানি তালিকা' : 'Pharma companies'}
 icon={Layers}
 colorClass="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
 />
 <MetricCard
 title={isBn ? 'জেনেরিক মলিকিউল' : 'Generic Molecules'}
 value={initialGenerics.length}
 description={isBn ? 'ড্রাগ ফর্মুলেশন গ্রুপ' : 'Active formulations'}
 icon={FileText}
 colorClass="bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400"
 />
 </div>

 {/* Tab Navigation */}
 <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto hide-scrollbar">
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
 type="button"
 onClick={() => setActiveTab(tab.id as any)}
 className={`px-3.5 py-2 rounded-[2px] text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${isActive
 ? 'bg-[#0E5F3F] text-white shadow-xs'
 : 'bg-white dark:bg-[#151921] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
 }`}
 >
 <Icon className="h-3.5 w-3.5"/>
 <span>{tab.label}</span>
 {tab.locked && <Lock className="h-3 w-3 text-amber-500"/>}
 </button>
 );
 })}
 </div>

 {/* TAB 1: Products */}
 {activeTab === 'products' && (
 <div className="space-y-4">
 <DataTable
 tableId="catalog-products-table"
 data={enrichedProducts}
 columns={productColumns}
 isLoading={loadingProducts}
 headerTabs={productHeaderTabs}
 filterContent={productFilterContent}
 searchPlaceholder={
 isBn
 ?"নাম, জেনেরিক বা বারকোড দিয়ে সার্চ..."
 :"Search by brand name, generic, SKU, or barcode..."
 }
 selectable={false}
 hideCheckbox={true}
 compact={true}
 syncUrlParams={false}
 onRefresh={() => fetchProducts()}
 isRefreshing={loadingProducts}
 actions={(p) => (
 <TableActionMenu
 items={[
 {
 key:"barcode",
 label: isBn ?"বারকোড লেবেল প্রিন্ট":"Print Barcode Label",
 icon: <Printer className="h-3.5 w-3.5"/>,
 hidden: !canPrintLabels || !p.barcodes?.length,
 onClick: () => {
 setSelectedLabelProduct(p);
 setLabelModalOpen(true);
 },
 },
 {
 key:"toggle",
 label: p.is_active
 ? (isBn ?"নিষ্ক্রিয় করুন":"Deactivate Product")
 : (isBn ?"সক্রিয় করুন":"Activate Product"),
 icon: <Check className="h-3.5 w-3.5"/>,
 onClick: () => handleToggleActive(p),
 },
 {
 key:"edit",
 label: isBn ?"এডিট করুন":"Edit Product",
 icon: <Edit2 className="h-3.5 w-3.5"/>,
 onClick: () => {
 setEditingProduct(p);
 setProdForm({
 type: p.type,
 name: p.name,
 name_bn: p.name_bn ||"",
 sku: p.sku ||"",
 category_id: p.category?.id ||"",
 company_id: p.company?.id ||"",
 generic_id: p.generic?.id ||"",
 strength: p.strength ||"",
 dosage_form: p.dosage_form ||"tablet",
 base_unit: p.base_unit ||"pcs",
 mrp: p.mrp !== null && p.mrp !== undefined && Number(p.mrp) > 0 ? String(p.mrp) :"",
 selling_price: p.selling_price !== null && p.selling_price !== undefined && Number(p.selling_price) > 0 ? String(p.selling_price) :"",
 purchase_price: p.purchase_price !== null && p.purchase_price !== undefined && Number(p.purchase_price) > 0 ? String(p.purchase_price) :"",
 track_batch: p.track_batch,
 is_controlled: p.is_controlled,
 default_discount_type: p.default_discount_type ||"none",
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
 shelf_location:"",
 })),
 });
 setProductDrawerOpen(true);
 },
 },
 {
 key:"delete",
 label: isBn ?"ডিলিট করুন":"Delete Product",
 icon: <Trash2 className="h-3.5 w-3.5 text-rose-500"/>,
 variant:"danger",
 onClick: () => handleDeleteProduct(p.id),
 },
 ]}
 />
 )}
 emptyState={
 <EmptyState
 icon={Package}
 title={isBn ?"কোনো পণ্য পাওয়া যায়নি":"No products found"}
 description={
 isBn
 ?"সার্চ ফিল্টার পরিবর্তন করুন বা নতুন পণ্য যোগ করুন।"
 :"Try adjusting filters or add your first product."
 }
 />
 }
 />
 </div>
 )}

 {/* TAB 2: Categories */}
 {activeTab === 'categories' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
 <FolderPlus className="h-4 w-4 text-[#0E5F3F]"/>
 <span>{isBn ?"ক্যাটাগরি তালিকা":"Categories Directory"}</span>
 </h2>
 <Button
 size="sm"
 variant="primary"
 onClick={() => setCategoryModalOpen(true)}
 className="gap-1.5 shadow-xs"
 >
 <Plus className="h-3.5 w-3.5"/>
 <span>{isBn ?"নতুন ক্যাটাগরি":"Add Category"}</span>
 </Button>
 </div>

 <DataTable
 tableId="catalog-categories-table"
 data={initialCategories}
 columns={categoryColumns}
 searchPlaceholder={isBn ?"ক্যাটাগরি সার্চ করুন...":"Search categories..."}
 selectable={false}
 hideCheckbox={true}
 compact={true}
 syncUrlParams={false}
 emptyState={
 <EmptyState
 icon={FolderPlus}
 title={isBn ?"কোনো ক্যাটাগরি পাওয়া যায়নি":"No categories found"}
 description={
 isBn
 ?"নতুন ক্যাটাগরি তৈরি করতে উপরের বাটনে ক্লিক করুন।"
 :"Create your first product category."
 }
 />
 }
 />
 </div>
 )}

 {/* TAB 3: Companies */}
 {activeTab === 'companies' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
 <Layers className="h-4 w-4 text-[#0E5F3F]"/>
 <span>{isBn ?"ফার্মাসিউটিক্যাল কোম্পানি তালিকা":"Pharmaceutical Companies"}</span>
 </h2>
 <Button
 size="sm"
 variant="primary"
 onClick={() => setCompanyModalOpen(true)}
 className="gap-1.5 shadow-xs"
 >
 <Plus className="h-3.5 w-3.5"/>
 <span>{isBn ?"নতুন কোম্পানি":"Add Company"}</span>
 </Button>
 </div>

 <DataTable
 tableId="catalog-companies-table"
 data={initialCompanies}
 columns={companyColumns}
 searchPlaceholder={isBn ?"কোম্পানি সার্চ করুন...":"Search companies..."}
 selectable={false}
 hideCheckbox={true}
 compact={true}
 syncUrlParams={false}
 emptyState={
 <EmptyState
 icon={Layers}
 title={isBn ?"কোনো কোম্পানি পাওয়া যায়নি":"No companies found"}
 description={
 isBn
 ?"নতুন কোম্পানি যোগ করতে উপরের বাটনে ক্লিক করুন।"
 :"Add pharmaceutical manufacturers and brands."
 }
 />
 }
 />
 </div>
 )}

 {/* TAB 4: Generics */}
 {activeTab === 'generics' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
 <FileText className="h-4 w-4 text-[#0E5F3F]"/>
 <span>{isBn ?"ওষুধের জেনেরিক গ্রুপ তালিকা":"Generic Molecules"}</span>
 </h2>
 <Button
 size="sm"
 variant="primary"
 onClick={() => setGenericModalOpen(true)}
 className="gap-1.5 shadow-xs"
 >
 <Plus className="h-3.5 w-3.5"/>
 <span>{isBn ?"নতুন জেনেরিক":"Add Generic"}</span>
 </Button>
 </div>

 <DataTable
 tableId="catalog-generics-table"
 data={initialGenerics}
 columns={genericColumns}
 searchPlaceholder={isBn ?"জেনেরিক মলিকিউল সার্চ করুন...":"Search generics..."}
 selectable={false}
 hideCheckbox={true}
 compact={true}
 syncUrlParams={false}
 emptyState={
 <EmptyState
 icon={FileText}
 title={isBn ?"কোনো জেনেরিক পাওয়া যায়নি":"No generics found"}
 description={
 isBn
 ?"নতুন জেনেরিক মলিকিউল যোগ করতে উপরের বাটনে ক্লিক করুন।"
 :"Add drug active ingredients and molecule generics."
 }
 />
 }
 />
 </div>
 )}


 {/* TAB 5: Discount Rules */}
 {activeTab === 'discounts' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
 <Tag className="h-4 w-4 text-[#0E5F3F]"/>
 <span>{isBn ? 'ডিসকাউন্ট অফার ও প্রমোশন' : 'Discount Offers & Promotions'}</span>
 </h2>
 <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
 {isBn
 ? 'নির্দিষ্ট ক্যাটাগরি বা কোম্পানির জন্য নির্ধারিত শতাংশ বা টাকার ছাড়'
 : 'Configure category or company level percentage or fixed discount offers'}
 </p>
 </div>
 <Button
 size="sm"
 variant="primary"
 onClick={() => setRuleModalOpen(true)}
 className="gap-1.5 shadow-xs"
 >
 <Plus className="h-3.5 w-3.5"/>
 <span>{isBn ? 'নতুন অফার যোগ করুন' : 'Add Discount Offer'}</span>
 </Button>
 </div>

 <div className="bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 rounded-[2px] p-8 text-center text-slate-500 dark:text-slate-400 shadow-xs">
 <Tag className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600"/>
 <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
 {isBn ? 'কোনো ডিসকাউন্ট রুল সক্রিয় নেই' : 'No active discount rules configured'}
 </p>
 <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
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
 <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-[2px] p-6 text-center">
 <Lock className="h-8 w-8 mx-auto mb-2 text-amber-500"/>
 <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">
 {isBn ? 'ক্যাটালগ ইমপোর্ট / এক্সপোর্ট লক করা' : 'Catalog Import/Export Locked'}
 </h3>
 <p className="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto mb-4">
 {isBn
 ? 'এক্সেল বা সিএসভি থেকে বাল্ক প্রোডাক্ট ইমপোর্ট এবং এক্সপোর্ট ফিচারটি প্রফেশনাল ও এন্টারপ্রাইজ প্ল্যানে উপলব্ধ।'
 : 'Bulk spreadsheet catalog import and export is available on Professional plan and above.'}
 </p>
 <Button
 variant="primary"
 onClick={() => router.visit(route('plans.index'))}
 >
 {isBn ? 'প্ল্যান আপগ্রেড করুন' : 'Upgrade Plan'}
 </Button>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Export Box */}
 <div className="rounded-[2px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] p-6 flex flex-col justify-between shadow-xs">
 <div>
 <div className="flex items-center gap-2 mb-3">
 <Download className="h-5 w-5 text-[#0E5F3F]"/>
 <h3 className="text-sm font-bold text-slate-900 dark:text-white">
 {isBn ? 'ক্যাটালগ এক্সপোর্ট ও টেমপ্লেট' : 'Export Catalog & Templates'}
 </h3>
 </div>
 <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
 {isBn
 ? 'আপনার সমস্ত মাস্টার পণ্য ডেটা সিএসভি ফরম্যাটে ডাউনলোড করুন অথবা নতুন পণ্য ইমপোর্ট করার জন্য অফিসিয়াল টেমপ্লেট সংগ্রহ করুন।'
 : 'Download your full tenant catalog or grab standard import templates with Bengali/English headers.'}
 </p>
 </div>

 <div className="space-y-2.5">
 <a
 href="/api/catalog/export/template"
 className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-[2px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-colors"
 >
 <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"/>
 <span>{isBn ? 'ইমপোর্ট টেমপ্লেট ডাউনলোড (CSV)' : 'Download Import Template (CSV)'}</span>
 </a>

 <a
 href="/api/catalog/export"
 className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-[2px] bg-[#5CB85C] hover:bg-[#449D44] border border-[#4CAE4C] text-xs font-semibold text-white shadow-xs transition-colors"
 >
 <Download className="h-3.5 w-3.5"/>
 <span>{isBn ? 'সম্পূর্ণ ক্যাটালগ এক্সপোর্ট করুন' : 'Export Full Catalog (CSV)'}</span>
 </a>
 </div>
 </div>

 {/* Import Wizard Box */}
 <div className="rounded-[2px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151921] p-6 shadow-xs">
 <div className="flex items-center gap-2 mb-3">
 <UploadCloud className="h-5 w-5 text-blue-500"/>
 <h3 className="text-sm font-bold text-slate-900 dark:text-white">
 {isBn ? 'এক্সেল বা সিএসভি থেকে বাল্ক পণ্য আপলোড' : 'Bulk Spreadsheet Import'}
 </h3>
 </div>
 <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
 {isBn
 ? 'এক্সেল বা সিএসভি ফাইল আপলোড করুন। ডুপ্লিকেট স্কিপ হবে এবং স্বয়ংক্রিয়ভাবে জেনেরিক ও কোম্পানি তৈরি হবে।'
 : 'Upload CSV or XLSX file. Deduplication is automatic with 24-hour rollback guarantee.'}
 </p>

 {/* Upload Box */}
 <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#0E5F3F] dark:hover:border-[#0E5F3F] rounded-[2px] p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/30 mb-4">
 <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-slate-400 dark:text-slate-500"/>
 <label className="cursor-pointer">
 <span className="text-xs font-bold text-[#0E5F3F] hover:underline">
 {isBn ? 'ফাইল সিলেক্ট করুন' : 'Select a file'}
 </span>
 <span className="text-xs text-slate-500 dark:text-slate-400"> {isBn ? 'বা ড্র্যাগ করুন' : 'or drag and drop'}</span>
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
 <p className="text-[11.5px] text-slate-400 mt-1">.CSV or .XLSX up to 10MB</p>
 </div>

 {importFile && (
 <div className="p-3 bg-slate-50 dark:bg-[#12161c] rounded-[2px] border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="text-slate-800 dark:text-slate-200 tabular-nums truncate">{importFile.name}</span>
 {importJobId && (
 <span className="text-[11.5px] text-emerald-600 dark:text-emerald-400 tabular-nums">
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

 {/* PRODUCT DRAWER / MODAL — BRTA Clean Stepped Horizontal Form */}
 {productDrawerOpen && (
 <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
 <div className="bg-white dark:bg-[#151921] border border-[#CCCCCC] dark:border-slate-800 rounded-[4px] w-full max-w-4xl shadow-2xl overflow-hidden my-6">
 {/* Header */}
 <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#E5E7EB] dark:border-slate-800 bg-[#F8FAF8] dark:bg-[#12161c]">
 <h3 className="text-[15px] font-bold text-[#222222] dark:text-slate-100 flex items-center gap-2">
 <Package className="h-4 w-4 text-[#0E5F3F]"/>
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
 type="button"
 onClick={() => setProductDrawerOpen(false)}
 className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>

 {/* Step Bar */}
 <div className="px-6 py-2.5 border-b border-[#E5E7EB] dark:border-slate-800 bg-white dark:bg-[#151921] flex flex-wrap items-center gap-2">
 {[
 { step: 1 as const, en: '1. General Info', bn: '১. সাধারণ তথ্য' },
 { step: 2 as const, en: '2. Pricing', bn: '২. মূল্য নির্ধারণ' },
 { step: 3 as const, en: '3. Packaging & Units', bn: '৩. প্যাকিং ও ইউনিট' },
 { step: 4 as const, en: '4. Barcodes', bn: '৪. বারকোড' },
 ].map((item) => {
 const isActive = productFormStep === item.step;
 const isDone = productFormStep > item.step;
 return (
 <button
 key={item.step}
 type="button"
 onClick={() => {
 if (item.step > 1 && !prodForm.name.trim()) {
 return;
 }
 setProductFormStep(item.step);
 }}
 className={`px-3 py-1.5 text-[12px] font-semibold rounded-[2px] border transition-colors cursor-pointer ${
 isActive
 ? 'bg-[#0E5F3F] text-white border-[#0E5F3F]'
 : isDone
 ? 'bg-[#EAF5F0] text-[#0E5F3F] border-[#0E5F3F]/30 dark:bg-emerald-950/30 dark:text-emerald-300'
 : 'bg-[#F5F7F4] dark:bg-[#181d25] text-[#555555] dark:text-slate-400 border-[#D5DBD3] dark:border-slate-700 hover:text-[#222222]'
 }`}
 >
 {isBn ? item.bn : item.en}
 </button>
 );
 })}
 </div>

 <form onSubmit={handleSaveProduct} className="bg-white dark:bg-[#151921]">
 <div className="px-6 py-6 min-h-[290px]">
 {/* STEP 1: General Information (BRTA 2-column horizontal label-left + input-right) */}
 {productFormStep === 1 && (
 <div className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[155px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'পণ্যের নাম (ইংরেজি)' : 'Product Name'}{' '}
 <span className="text-[#D9534F]">*</span>
 </label>
 <div className="flex-1 min-w-0">
 <Input
 required
 value={prodForm.name}
 onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
 placeholder="e.g. Napa Extra"
 className="h-[36px] text-[13px] rounded-[2px] border-[#CCCCCC]"
 />
 </div>
 </div>

 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[155px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'বাংলা নাম' : 'Bengali Name'}
 </label>
 <div className="flex-1 min-w-0">
 <Input
 value={prodForm.name_bn}
 onChange={(e) => setProdForm({ ...prodForm, name_bn: e.target.value })}
 placeholder="উদাঃ নাপা এক্সট্রা"
 className="h-[36px] text-[13px] rounded-[2px] border-[#CCCCCC] font-bengali"
 />
 </div>
 </div>

 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[155px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'ক্যাটাগরি' : 'Category'}
 </label>
 <div className="flex-1 min-w-0">
 <Select
 value={prodForm.category_id}
 onChange={(e) => setProdForm({ ...prodForm, category_id: String(e.target.value) })}
 className="h-[36px] text-[13px] rounded-[2px]"
 >
 <option value="">{isBn ? 'সিলেক্ট করুন' : 'Select Category'}</option>
 {initialCategories.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </Select>
 </div>
 </div>

 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[155px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'কোম্পানি' : 'Company'}
 </label>
 <div className="flex-1 min-w-0">
 <Select
 value={prodForm.company_id}
 onChange={(e) => setProdForm({ ...prodForm, company_id: String(e.target.value) })}
 className="h-[36px] text-[13px] rounded-[2px]"
 >
 <option value="">{isBn ? 'সিলেক্ট করুন' : 'Select Company'}</option>
 {initialCompanies.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </Select>
 </div>
 </div>

 {prodForm.type === 'medicine' && (
 <>
 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[155px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'জেনেরিক নাম' : 'Generic Name'}
 </label>
 <div className="flex-1 min-w-0">
 <Select
 value={prodForm.generic_id}
 onChange={(e) => setProdForm({ ...prodForm, generic_id: String(e.target.value) })}
 className="h-[36px] text-[13px] rounded-[2px]"
 >
 <option value="">{isBn ? 'সিলেক্ট করুন' : 'Select Generic'}</option>
 {initialGenerics.map((g) => (
 <option key={g.id} value={g.id}>
 {g.name}
 </option>
 ))}
 </Select>
 </div>
 </div>

 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[155px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'স্ট্রেন্থ' : 'Strength'}
 </label>
 <div className="flex-1 min-w-0">
 <Input
 value={prodForm.strength}
 onChange={(e) => setProdForm({ ...prodForm, strength: e.target.value })}
 placeholder="e.g. 500mg, 10ml"
 className="h-[36px] text-[13px] rounded-[2px] border-[#CCCCCC]"
 />
 </div>
 </div>
 </>
 )}

 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[155px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'এসকেইউ কোড' : 'SKU Code'}
 </label>
 <div className="flex-1 min-w-0">
 <Input
 value={prodForm.sku}
 onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
 placeholder="e.g. NAPA-EXT-500"
 className="h-[36px] text-[13px] rounded-[2px] border-[#CCCCCC]"
 />
 </div>
 </div>

 {prodForm.type === 'medicine' && (
 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[155px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'ডোজের ধরন' : 'Dosage Form'}
 </label>
 <div className="flex-1 min-w-0">
 <Select
 value={prodForm.dosage_form}
 onChange={(e) => setProdForm({ ...prodForm, dosage_form: String(e.target.value) })}
 className="h-[36px] text-[13px] rounded-[2px]"
 >
 <option value="tablet">Tablet</option>
 <option value="capsule">Capsule</option>
 <option value="syrup">Syrup</option>
 <option value="injection">Injection</option>
 <option value="ointment">Ointment / Cream</option>
 <option value="drops">Drops</option>
 <option value="inhaler">Inhaler</option>
 <option value="other">Other</option>
 </Select>
 </div>
 </div>
 )}
 </div>

 {/* Bordered Segmented Checkbox/Type Strip (BRTA style) */}
 <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
 <label className="sm:w-[155px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'পণ্যের ধরন ও সেটিংস' : 'Product Type & Flags'}{' '}
 <span className="text-[#D9534F]">*</span>
 </label>
 <div className="flex flex-wrap items-stretch border border-[#CCCCCC] dark:border-slate-700 rounded-[2px] divide-y sm:divide-y-0 sm:divide-x divide-[#CCCCCC] dark:divide-slate-700 bg-white dark:bg-[#181d25]">
 <label className="inline-flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold text-[#333333] dark:text-slate-200 cursor-pointer hover:bg-[#F5F7F4] dark:hover:bg-slate-800">
 <input
 type="radio"
 name="brta_prod_type"
 checked={prodForm.type === 'medicine'}
 onChange={() => setProdForm({ ...prodForm, type: 'medicine' })}
 className="accent-[#337AB7]"
 />
 <span>{isBn ? 'ওষুধ (Medicine)' : 'Medicine'}</span>
 </label>
 <label className="inline-flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold text-[#333333] dark:text-slate-200 cursor-pointer hover:bg-[#F5F7F4] dark:hover:bg-slate-800">
 <input
 type="radio"
 name="brta_prod_type"
 checked={prodForm.type === 'non_medicine'}
 onChange={() => setProdForm({ ...prodForm, type: 'non_medicine' })}
 className="accent-[#337AB7]"
 />
 <span>{isBn ? 'অন্যান্য পণ্য (Non-Medicine)' : 'Non-Medicine'}</span>
 </label>
 <label className="inline-flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold text-[#333333] dark:text-slate-200 cursor-pointer hover:bg-[#F5F7F4] dark:hover:bg-slate-800">
 <input
 type="checkbox"
 checked={prodForm.track_batch}
 onChange={(e) => setProdForm({ ...prodForm, track_batch: e.target.checked })}
 className="accent-[#337AB7]"
 />
 <span>{isBn ? 'ব্যাচ ও মেয়াদ ট্র্যাক' : 'Track Batch & Expiry'}</span>
 </label>
 <label className="inline-flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold text-[#333333] dark:text-slate-200 cursor-pointer hover:bg-[#F5F7F4] dark:hover:bg-slate-800">
 <input
 type="checkbox"
 checked={prodForm.is_controlled}
 onChange={(e) => setProdForm({ ...prodForm, is_controlled: e.target.checked })}
 className="accent-[#337AB7]"
 />
 <span>{isBn ? 'নিয়ন্ত্রিত ওষুধ (Controlled)' : 'Controlled Drug'}</span>
 </label>
 </div>
 </div>
 </div>
 )}

 {/* STEP 2: Pricing */}
 {productFormStep === 2 && (
 <div className="space-y-5">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[165px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'সর্বোচ্চ খুচরা মূল্য (MRP)' : 'MRP (Max Retail)'}{' '}
 <span className="text-[#D9534F]">*</span>
 </label>
 <div className="flex-1 min-w-0">
 <Input
 type="number"
 step="0.01"
 min="0"
 value={prodForm.mrp}
 onChange={(e) => {
 const nextMrp = e.target.value;
 setProdForm((prev) => ({
 ...prev,
 mrp: nextMrp,
 selling_price:
 prev.selling_price === '' || prev.selling_price === prev.mrp
 ? nextMrp
 : prev.selling_price,
 }));
 }}
 placeholder="0.00"
 className="h-[36px] text-[13px] font-mono rounded-[2px] border-[#CCCCCC]"
 />
 </div>
 </div>

 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[165px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'লোকাল বিক্রয় মূল্য' : 'Local Selling Price'}
 </label>
 <div className="flex-1 min-w-0">
 <Input
 type="number"
 step="0.01"
 min="0"
 value={prodForm.selling_price}
 onChange={(e) => setProdForm({ ...prodForm, selling_price: e.target.value })}
 placeholder="0.00"
 className="h-[36px] text-[13px] font-mono rounded-[2px] border-[#CCCCCC]"
 />
 </div>
 </div>

 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[165px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'ক্রয় মূল্য / TP' : 'Purchase Price (TP)'}
 </label>
 <div className="flex-1 min-w-0">
 <Input
 type="number"
 step="0.01"
 min="0"
 value={prodForm.purchase_price}
 onChange={(e) => setProdForm({ ...prodForm, purchase_price: e.target.value })}
 placeholder="0.00"
 className="h-[36px] text-[13px] font-mono rounded-[2px] border-[#CCCCCC]"
 />
 </div>
 </div>

 <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
 <label className="sm:w-[165px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'মূল্য ইউনিট' : 'Price Per Unit'}
 </label>
 <div className="flex-1 min-w-0">
 <Input
 disabled
 value={prodForm.base_unit || 'pcs'}
 className="h-[36px] text-[13px] rounded-[2px] border-[#CCCCCC] bg-[#EDEDED] dark:bg-slate-800"
 />
 </div>
 </div>
 </div>

 {(() => {
 const mrpVal = parseFloat(prodForm.mrp) || 0;
 const saleVal = parseFloat(prodForm.selling_price) || 0;
 const tpVal = parseFloat(prodForm.purchase_price) || 0;
 if (mrpVal <= 0 && saleVal <= 0 && tpVal <= 0) return null;
 const discountPct =
 mrpVal > 0 && saleVal > 0 && saleVal < mrpVal
 ? (((mrpVal - saleVal) / mrpVal) * 100).toFixed(1)
 : null;
 const exceedsMrp = mrpVal > 0 && saleVal > mrpVal;
 const profit = tpVal > 0 && saleVal > 0 ? saleVal - tpVal : null;
 const marginPct = profit !== null && saleVal > 0 ? ((profit / saleVal) * 100).toFixed(1) : null;

 return (
 <div className="sm:pl-[177px] flex flex-wrap items-center gap-2 text-[12px]">
 {discountPct && (
 <span className="px-2.5 py-1 rounded-[2px] bg-[#EAF5F0] border border-[#0E5F3F]/25 text-[#0E5F3F] font-semibold">
 {isBn
 ? `MRP থেকে ${discountPct}% কম (${formatCurrency(mrpVal - saleVal, currency)} ছাড়)`
 : `${discountPct}% below MRP (Save ${formatCurrency(mrpVal - saleVal, currency)})`}
 </span>
 )}
 {exceedsMrp && (
 <span className="px-2.5 py-1 rounded-[2px] bg-rose-50 border border-rose-200 text-[#C9302C] font-semibold">
 {isBn
 ? 'সতর্কতা: লোকাল বিক্রয় মূল্য MRP-এর চেয়ে বেশি!'
 : 'Warning: Local selling price exceeds MRP'}
 </span>
 )}
 {profit !== null && (
 <span
 className={`px-2.5 py-1 rounded-[2px] border font-semibold font-mono ${
 profit >= 0
 ? 'bg-[#F5F7F4] border-[#D5DBD3] text-[#222222]'
 : 'bg-rose-50 border-rose-200 text-[#C9302C]'
 }`}
 >
 {isBn ? 'লাভ:' : 'Profit:'} {formatCurrency(profit, currency)}
 {marginPct ? ` (${marginPct}%)` : ''}
 </span>
 )}
 </div>
 );
 })()}
 </div>
 )}

 {/* STEP 3: Packaging & Units */}
 {productFormStep === 3 && (
 <div className="space-y-4">
 <div className="flex items-center justify-between gap-2">
 <div className="px-3 py-2 rounded-[2px] bg-[#F5F7F4] dark:bg-slate-800 border border-[#D5DBD3] dark:border-slate-700 text-[12.5px] text-[#333333] dark:text-slate-200 tabular-nums">
 <span className="font-bold mr-2">{isBn ? 'ইউনিট হিসাব:' : 'Conversion Formula:'}</span>
 <span className="font-mono text-[#0E5F3F] dark:text-emerald-400 font-semibold">
 {unitConversionSummary}
 </span>
 </div>
 <Button type="button" variant="outline" size="sm" onClick={addUnitRow} className="h-8 text-[12px]">
 <Plus className="h-3.5 w-3.5 mr-1"/>
 {isBn ? 'নতুন ইউনিট' : 'Add Unit'}
 </Button>
 </div>

 <div className="space-y-2">
 {prodForm.units.map((u, i) => (
 <div
 key={i}
 className="grid grid-cols-12 gap-2.5 items-center bg-[#F8FAF8] dark:bg-[#12161c] p-2.5 rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 text-[12.5px]"
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
 className="h-[34px] text-[12.5px] rounded-[2px]"
 />
 </div>

 <div className="col-span-3 flex items-center gap-1.5">
 <span className="text-slate-500 font-bold">=</span>
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
 className="h-[34px] text-[12.5px] font-mono rounded-[2px]"
 />
 <span className="text-slate-600 dark:text-slate-400 tabular-nums text-[12px]">
 {prodForm.base_unit}
 </span>
 </div>

 <div className="col-span-4 flex items-center gap-3">
 <label className="flex items-center gap-1.5 text-[12px] font-medium text-[#333333] dark:text-slate-300 cursor-pointer">
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
 className="accent-[#337AB7]"
 />
 <span>{isBn ? 'খুচরা বিক্রির মূল ইউনিট' : 'Default Retail Sale Unit'}</span>
 </label>
 </div>

 <div className="col-span-1 text-right">
 {u.conversion_to_base > 1 && (
 <button
 type="button"
 onClick={() => removeUnitRow(i)}
 className="text-slate-400 hover:text-[#D9534F] transition-colors cursor-pointer"
 >
 <X className="h-4 w-4"/>
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* STEP 4: Barcodes & Scan Codes */}
 {productFormStep === 4 && (
 <div className="space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
 <label className="sm:w-[155px] sm:text-right text-[13px] font-bold text-[#333333] dark:text-slate-200 shrink-0">
 {isBn ? 'বারকোড যোগ করুন' : 'Add Barcode'}
 </label>
 <div className="flex-1 flex flex-wrap items-center gap-2">
 <Input
 value={manualBarcodeInput}
 onChange={(e) => setManualBarcodeInput(e.target.value)}
 placeholder="Scan or type EAN-13 / UPC barcode"
 className="flex-1 min-w-[180px] h-[36px] text-[13px] font-mono rounded-[2px] border-[#CCCCCC]"
 />
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 const code = manualBarcodeInput.trim();
 if (!code) return;
 setProdForm((prev) => ({
 ...prev,
 barcodes: [...prev.barcodes, { barcode: code, is_primary: prev.barcodes.length === 0 }],
 }));
 setManualBarcodeInput('');
 }}
 >
 <Plus className="h-3.5 w-3.5 mr-1"/>
 {isBn ? 'যোগ করুন' : 'Add'}
 </Button>
 <Button
 type="button"
 size="sm"
 onClick={handleGenerateBarcode}
 className="bg-[#5CB85C] hover:bg-[#449D44] border border-[#4CAE4C] text-white"
 >
 <Barcode className="h-3.5 w-3.5 mr-1"/>
 {isBn ? 'স্বয়ংক্রিয় বারকোড' : 'Auto Generate'}
 </Button>
 </div>
 </div>

 <div className="sm:pl-[167px] space-y-2">
 {prodForm.barcodes.length === 0 ? (
 <p className="text-[12.5px] text-[#666666] py-3 px-3 rounded-[2px] bg-[#F8FAF8] dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800">
 {isBn
 ? 'কোনো বারকোড যোগ করা হয়নি। ম্যানুয়ালি যোগ করুন বা স্বয়ংক্রিয় তৈরি করুন।'
 : 'No barcodes assigned yet. Scan/enter one or click Auto Generate.'}
 </p>
 ) : (
 prodForm.barcodes.map((b, i) => (
 <div
 key={i}
 className="flex items-center justify-between bg-[#F8FAF8] dark:bg-[#12161c] p-2.5 rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 text-[12.5px]"
 >
 <div className="flex items-center gap-2">
 <Barcode className="h-4 w-4 text-[#0E5F3F]"/>
 <span className="font-mono text-slate-900 dark:text-slate-100 font-bold tracking-wider">
 {b.barcode}
 </span>
 {b.is_primary && <Badge variant="success">Primary</Badge>}
 </div>
 <button
 type="button"
 onClick={() => {
 setProdForm({
 ...prodForm,
 barcodes: prodForm.barcodes.filter((_, idx) => idx !== i),
 });
 }}
 className="text-slate-400 hover:text-[#D9534F] transition-colors cursor-pointer"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>
 ))
 )}
 </div>
 </div>
 )}
 </div>

 {/* BRTA Bottom Footer Bar: < Previous (Blue) | Next > (Green) | Submit (Cyan) */}
 <div className="px-6 py-3.5 border-t border-[#E5E7EB] dark:border-slate-800 bg-[#FAFAFA] dark:bg-[#12161c] flex items-center justify-between gap-3">
 <span className="text-[12px] font-medium text-[#666666] dark:text-slate-400">
 {isBn ? `ধাপ ${productFormStep} / ৪` : `Step ${productFormStep} of 4`}
 </span>

 <div className="flex items-center gap-2">
 <button
 type="button"
 disabled={productFormStep === 1}
 onClick={() => setProductFormStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
 className="inline-flex items-center gap-1 h-[34px] px-3.5 text-[13px] font-semibold rounded-[2px] bg-[#337AB7] hover:bg-[#286090] border border-[#2E6DA4] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
 >
 <ChevronLeft className="h-4 w-4"/>
 <span>{isBn ? 'পূর্ববর্তী' : 'Previous'}</span>
 </button>

 {productFormStep < 4 && (
 <button
 type="button"
 onClick={() => {
 if (productFormStep === 1 && !prodForm.name.trim()) {
 alert(isBn ? 'পণ্যের নাম (ইংরেজি) দিন।' : 'Please enter Product Name first.');
 return;
 }
 setProductFormStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s));
 }}
 className="inline-flex items-center gap-1 h-[34px] px-3.5 text-[13px] font-semibold rounded-[2px] bg-[#5CB85C] hover:bg-[#449D44] border border-[#4CAE4C] text-white cursor-pointer transition-colors"
 >
 <span>{isBn ? 'পরবর্তী' : 'Next'}</span>
 <ChevronRight className="h-4 w-4"/>
 </button>
 )}

 <button
 type="submit"
 disabled={!prodForm.name.trim()}
 className="inline-flex items-center gap-1.5 h-[34px] px-4 text-[13px] font-semibold rounded-[2px] bg-[#5BC0DE] hover:bg-[#31B0D5] border border-[#46B8DA] text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
 >
 <Save className="h-3.5 w-3.5"/>
 <span>
 {editingProduct
 ? isBn
 ? 'আপডেট করুন'
 : 'Update'
 : isBn
 ? 'সাবমিট'
 : 'Submit'}
 </span>
 </button>
 </div>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* BARCODE LABEL MODAL */}
 {labelModalOpen && selectedLabelProduct && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
 <div className="bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 rounded-[4px] w-full max-w-md shadow-2xl overflow-hidden">
 <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#12161c]">
 <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
 <Printer className="h-4 w-4 text-[#0E5F3F]"/>
 <span>{isBn ? 'বারকোড লেবেল প্রিন্ট' : 'Print Barcode Labels'}</span>
 </h3>
 <button
 onClick={() => setLabelModalOpen(false)}
 className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>

 <div className="p-5 space-y-4">
 <div>
 <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
 {isBn ? 'লেবেল সাইজ প্রিসেট' : 'Label Size Preset'}
 </label>
 <Select
 value={labelPreset}
 onChange={(e) => setLabelPreset(e.target.value as any)}
 className="text-xs"
 >
 <option value="38x25">38mm x 25mm (Standard Counter Single)</option>
 <option value="50x30">50mm x 30mm (Large Pharmacy Thermal)</option>
 <option value="a4_3x8">A4 Sheet (3x8 - 24 Labels/Page)</option>
 </Select>
 </div>

 <div>
 <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
 {isBn ? 'পরিমাণ (কপি সংখ্যা)' : 'Quantity / Copies'}
 </label>
 <Input
 type="number"
 min={1}
 max={100}
 value={labelQuantity}
 onChange={(e) => setLabelQuantity(parseInt(e.target.value) || 1)}
 className="text-xs"
 />
 </div>

 {/* Preview Card */}
 <div className="border border-slate-200 dark:border-slate-700 bg-white text-slate-900 p-4 rounded-[2px] text-center shadow-xs font-sans">
 <div className="text-xs font-bold truncate">{selectedLabelProduct.name}</div>
 {selectedLabelProduct.name_bn && (
 <div className="text-[11px] text-slate-600 font-bengali">
 {selectedLabelProduct.name_bn}
 </div>
 )}
 <div className="my-2 flex justify-center">
 <Barcode className="h-10 w-44 text-slate-900"/>
 </div>
 <div className="text-xs tabular-nums font-bold tracking-widest text-slate-800">
 {selectedLabelProduct.barcodes?.[0]?.barcode || '2000000000010'}
 </div>
 </div>

 <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
 <Button
 variant="outline"
 size="sm"
 onClick={() => setLabelModalOpen(false)}
 >
 {isBn ? 'বন্ধ করুন' : 'Close'}
 </Button>
 <a
 href={`/api/catalog/products/${selectedLabelProduct.id}/labels?preset=${labelPreset}&quantity=${labelQuantity}`}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center justify-center gap-1.5 text-xs font-medium h-8 px-4 rounded-[2px] bg-[#5CB85C] hover:bg-[#449D44] border border-[#4CAE4C] text-white transition-colors shadow-xs"
 >
 <Printer className="h-3.5 w-3.5"/>
 <span>{isBn ? 'প্রিন্ট পেজ খুলুন' : 'Open Print Dialog'}</span>
 </a>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* CATEGORY MODAL */}
 <BrtaFormModal
 open={categoryModalOpen}
 onClose={() => setCategoryModalOpen(false)}
 onSubmit={handleSaveCategory}
 title={isBn ? 'নতুন ক্যাটাগরি তৈরি করুন' : 'Add New Category'}
 icon={<FolderPlus className="h-4 w-4"/>}
 maxWidth="2xl"
 footerProps={{
 cancelLabel: isBn ? 'বাতিল' : 'Cancel',
 submitLabel: isBn ? 'ক্যাটাগরি সংরক্ষণ' : 'Save Category',
 submitting: submittingMaster,
 }}
 >
 <BrtaField label={isBn ? 'ক্যাটাগরির নাম (ইংরেজি)' : 'Category Name (English)'} required>
 <input
 required
 value={catForm.name}
 onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
 placeholder="e.g. Antibiotics, Syrups"
 className={brtaInputClass}
 />
 </BrtaField>
 <BrtaField label={isBn ? 'বাংলা নাম' : 'Bengali Name'}>
 <input
 value={catForm.name_bn}
 onChange={(e) => setCatForm({ ...catForm, name_bn: e.target.value })}
 placeholder="উদাঃ এন্টিবায়োটিক, সিরাপ"
 className={`${brtaInputClass} font-bengali`}
 />
 </BrtaField>
 <BrtaField label={isBn ? 'মূল ক্যাটাগরি' : 'Parent Category'}>
 <Select
 value={catForm.parent_id}
 onChange={(e) => setCatForm({ ...catForm, parent_id: String(e.target.value) })}
 className="h-[36px] text-[13px] rounded-[2px]"
 >
 <option value="">{isBn ? 'কোনোটি নয় (মূল ক্যাটাগরি)' : 'None (Top Level)'}</option>
 {initialCategories.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </Select>
 </BrtaField>
 </BrtaFormModal>

 {/* COMPANY MODAL */}
 <BrtaFormModal
 open={companyModalOpen}
 onClose={() => setCompanyModalOpen(false)}
 onSubmit={handleSaveCompany}
 title={isBn ? 'নতুন ওষুধ কোম্পানি যোগ করুন' : 'Add Pharmaceutical Company'}
 icon={<Layers className="h-4 w-4"/>}
 maxWidth="2xl"
 footerProps={{
 cancelLabel: isBn ? 'বাতিল' : 'Cancel',
 submitLabel: isBn ? 'কোম্পানি সংরক্ষণ' : 'Save Company',
 submitting: submittingMaster,
 }}
 >
 <BrtaField label={isBn ? 'কোম্পানির নাম (ইংরেজি)' : 'Company Name (English)'} required>
 <input
 required
 value={compForm.name}
 onChange={(e) => setCompForm({ ...compForm, name: e.target.value })}
 placeholder="e.g. Square Pharmaceuticals, Beximco"
 className={brtaInputClass}
 />
 </BrtaField>
 <BrtaField label={isBn ? 'বাংলা নাম' : 'Bengali Name'}>
 <input
 value={compForm.name_bn}
 onChange={(e) => setCompForm({ ...compForm, name_bn: e.target.value })}
 placeholder="উদাঃ স্কয়ার ফার্মাসিউটিক্যালস"
 className={`${brtaInputClass} font-bengali`}
 />
 </BrtaField>
 </BrtaFormModal>

 {/* GENERIC MODAL */}
 <BrtaFormModal
 open={genericModalOpen}
 onClose={() => setGenericModalOpen(false)}
 onSubmit={handleSaveGeneric}
 title={isBn ? 'নতুন জেনেরিক গ্রুপ যোগ করুন' : 'Add Generic Molecule'}
 icon={<FileText className="h-4 w-4"/>}
 maxWidth="xl"
 footerProps={{
 cancelLabel: isBn ? 'বাতিল' : 'Cancel',
 submitLabel: isBn ? 'জেনেরিক সংরক্ষণ' : 'Save Generic',
 submitting: submittingMaster,
 }}
 >
 <BrtaField label={isBn ? 'জেনেরিক নাম' : 'Generic Name'} required>
 <input
 required
 value={genForm.name}
 onChange={(e) => setGenForm({ ...genForm, name: e.target.value })}
 placeholder="e.g. Paracetamol, Azithromycin"
 className={brtaInputClass}
 />
 </BrtaField>
 </BrtaFormModal>

 {/* DISCOUNT RULE MODAL */}
 <BrtaFormModal
 open={ruleModalOpen}
 onClose={() => setRuleModalOpen(false)}
 onSubmit={handleSaveRule}
 title={isBn ? 'নতুন ডিসকাউন্ট অফার তৈরি করুন' : 'Add Discount Offer'}
 icon={<Tag className="h-4 w-4"/>}
 maxWidth="3xl"
 footerProps={{
 cancelLabel: isBn ? 'বাতিল' : 'Cancel',
 submitLabel: isBn ? 'অফার সংরক্ষণ' : 'Save Offer',
 submitting: submittingMaster,
 }}
 >
 <BrtaFormGrid>
 <BrtaField label={isBn ? 'ডিসকাউন্টের আওতা' : 'Discount Scope'} required>
 <Select
 value={ruleForm.scope}
 onChange={(e) => setRuleForm({ ...ruleForm, scope: e.target.value as any, scope_id: '' })}
 className="h-[36px] text-[13px] rounded-[2px]"
 >
 <option value="category">{isBn ? 'নির্দিষ্ট ক্যাটাগরির জন্য' : 'Apply to Category'}</option>
 <option value="company">{isBn ? 'নির্দিষ্ট কোম্পানির জন্য' : 'Apply to Company'}</option>
 </Select>
 </BrtaField>
 {ruleForm.scope === 'category' ? (
 <BrtaField label={isBn ? 'ক্যাটাগরি সিলেক্ট' : 'Select Category'} required>
 <Select
 required
 value={ruleForm.scope_id}
 onChange={(e) => setRuleForm({ ...ruleForm, scope_id: String(e.target.value) })}
 className="h-[36px] text-[13px] rounded-[2px]"
 >
 <option value="">{isBn ? 'ক্যাটাগরি বেছে নিন' : 'Choose Category'}</option>
 {initialCategories.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </Select>
 </BrtaField>
 ) : (
 <BrtaField label={isBn ? 'কোম্পানি সিলেক্ট' : 'Select Company'} required>
 <Select
 required
 value={ruleForm.scope_id}
 onChange={(e) => setRuleForm({ ...ruleForm, scope_id: String(e.target.value) })}
 className="h-[36px] text-[13px] rounded-[2px]"
 >
 <option value="">{isBn ? 'কোম্পানি বেছে নিন' : 'Choose Company'}</option>
 {initialCompanies.map((c) => (
 <option key={c.id} value={c.id}>
 {c.name}
 </option>
 ))}
 </Select>
 </BrtaField>
 )}
 <BrtaField label={isBn ? 'ছাড়ের ধরন' : 'Discount Type'} required>
 <Select
 value={ruleForm.type}
 onChange={(e) => setRuleForm({ ...ruleForm, type: e.target.value as any })}
 className="h-[36px] text-[13px] rounded-[2px]"
 >
 <option value="percent">{isBn ? 'শতকরা (%)' : 'Percentage (%)'}</option>
 <option value="fixed">{isBn ? 'নির্দিষ্ট টাকা (BDT)' : 'Fixed Amount (BDT)'}</option>
 </Select>
 </BrtaField>
 <BrtaField label={isBn ? 'পরিমাণ (Value)' : 'Value'} required>
 <input
 type="number"
 min={0}
 required
 value={ruleForm.value}
 onChange={(e) => setRuleForm({ ...ruleForm, value: parseFloat(e.target.value) || 0 })}
 className={`${brtaInputClass} font-mono`}
 />
 </BrtaField>
 </BrtaFormGrid>
 <BrtaField label={isBn ? 'বিবরণ / নোট' : 'Note / Description'}>
 <input
 value={ruleForm.note}
 onChange={(e) => setRuleForm({ ...ruleForm, note: e.target.value })}
 placeholder="e.g. Ramadan Offer 2026"
 className={brtaInputClass}
 />
 </BrtaField>
 </BrtaFormModal>
 </div>
 </AppLayout>
 );
}
