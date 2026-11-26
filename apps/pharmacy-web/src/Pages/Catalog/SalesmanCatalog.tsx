import React, { useEffect, useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
 AlertTriangle,
 Barcode,
 Building2,
 Calendar,
 CheckCircle2,
 Eye,
 Globe,
 Layers,
 Minus,
 Package,
 Pill,
 Plus,
 Repeat,
 ShoppingCart,
 Sparkles,
 Star,
 Thermometer,
 X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { Select } from '@/Components/ui/Select';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { formatCurrency } from '@/lib/format';

interface CatalogProduct {
 id: number;
 name: string;
 name_bn?: string | null;
 generic_name: string;
 company: string;
 dosage_form: string;
 strength?: string | null;
 unit: string;
 pack_size: string;
 sku?: string | null;
 barcode?: string | null;
 requires_prescription: boolean;
 mrp: number;
 trade_price: number;
 box_price?: number | null;
 stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
 stock_qty: number | null;
 nearest_expiry?: string | null;
 days_to_expiry?: number | null;
 expiry_alert: 'none' | 'critical' | 'warning' | 'ok';
 rack_location?: string | null;
 storage_rule: string;
 description?: string | null;
 offer_label?: string | null;
 offer_discount_pct: number;
}

interface ContractCustomer {
 id: number;
 name: string;
 customer_type: string;
 contract_discount_pct: number;
}

interface SalesmanCatalogProps {
 products: CatalogProduct[];
 customers: ContractCustomer[];
 showExactStock: boolean;
 branchName?: string | null;
 currency: string;
 tenantId: number;
 userId?: number | null;
}

export default function SalesmanCatalog({
 products = [],
 customers = [],
 showExactStock = false,
 branchName,
 currency = 'BDT',
 tenantId,
 userId,
}: SalesmanCatalogProps) {
 const [lang, setLang] = useState<'en' | 'bn'>('en');
 const [formFilter, setFormFilter] = useState('');
 const [companyFilter, setCompanyFilter] = useState('');
 const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
 const [favoritesOnly, setFavoritesOnly] = useState(false);
 const [offersOnly, setOffersOnly] = useState(false);
 const [selectedCustomerId, setSelectedCustomerId] = useState('');

 // Favorites persisted per tenant & user
 const storageKey = `pharmacore_fav_catalog_${tenantId}_${userId ?? 'guest'}`;
 const [favorites, setFavorites] = useState<number[]>(() => {
 if (typeof window === 'undefined') return [];
 try {
 const saved = localStorage.getItem(storageKey);
 return saved ? JSON.parse(saved) : [];
 } catch {
 return [];
 }
 });

 // Detail modal state
 const [activeProduct, setActiveProduct] = useState<CatalogProduct | null>(null);
 const [orderQty, setOrderQty] = useState<number>(1);

 useEffect(() => {
 try {
 localStorage.setItem(storageKey, JSON.stringify(favorites));
 } catch {}
 }, [favorites, storageKey]);

 const toggleFavorite = (productId: number, e?: React.MouseEvent) => {
 e?.stopPropagation();
 setFavorites((prev) =>
 prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
 );
 };

 const selectedCustomer = useMemo(
 () => customers.find((c) => String(c.id) === selectedCustomerId) || null,
 [customers, selectedCustomerId]
 );

 const getContractPrice = (product: CatalogProduct): number | null => {
 if (!selectedCustomer || selectedCustomer.contract_discount_pct <= 0) return null;
 return Number((product.mrp * (1 - selectedCustomer.contract_discount_pct / 100)).toFixed(2));
 };

 const uniqueForms = useMemo(() => {
 return Array.from(new Set(products.map((p) => p.dosage_form).filter(Boolean))).sort();
 }, [products]);

 const uniqueCompanies = useMemo(() => {
 return Array.from(new Set(products.map((p) => p.company).filter(Boolean))).sort();
 }, [products]);

 const filteredProducts = useMemo(() => {
 return products.filter((p) => {
 if (favoritesOnly && !favorites.includes(p.id)) return false;
 if (offersOnly && !p.offer_label) return false;
 if (formFilter && p.dosage_form !== formFilter) return false;
 if (companyFilter && p.company !== companyFilter) return false;
 if (stockFilter !== 'all' && p.stock_status !== stockFilter) return false;
 return true;
 });
 }, [products, formFilter, companyFilter, stockFilter, favoritesOnly, offersOnly, favorites]);

 const alternativesByGeneric = useMemo(() => {
 const map = new Map<string, CatalogProduct[]>();
 for (const p of products) {
 if (p.stock_status === 'out_of_stock') continue;
 const key = p.generic_name.trim().toLowerCase();
 if (!key || key === 'general') continue;
 const list = map.get(key) || [];
 list.push(p);
 map.set(key, list);
 }
 return map;
 }, [products]);

 const getAlternatives = (product: CatalogProduct): CatalogProduct[] => {
 const key = product.generic_name.trim().toLowerCase();
 return (alternativesByGeneric.get(key) || []).filter((alt) => alt.id !== product.id);
 };

 const openProductModal = (product: CatalogProduct) => {
 setActiveProduct(product);
 setOrderQty(1);
 };

 const handleAddToOrder = (product: CatalogProduct, qty = 1) => {
 const params = new URLSearchParams({
 add_medicine_id: String(product.id),
 qty: String(Math.max(1, qty)),
 });
 if (selectedCustomer) {
 params.set('customer_id', String(selectedCustomer.id));
 }
 router.visit(`${route('sales.orders.create')}?${params.toString()}`);
 };

 const isBn = lang === 'bn';

 const renderStockBadge = (p: CatalogProduct) => {
 if (p.stock_status === 'in_stock') {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[11px] font-bold bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
 <span className="w-1.5 h-1.5 rounded-full bg-[#0E5F3F] dark:bg-emerald-400"/>
 {isBn ? 'আছে' : 'In Stock'}
 {showExactStock && p.stock_qty !== null && (
 <span className="tabular-nums ml-0.5">({p.stock_qty})</span>
 )}
 </span>
 );
 }
 if (p.stock_status === 'low_stock') {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
 <span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>
 {isBn ? 'কম স্টক' : 'Low Stock'}
 {showExactStock && p.stock_qty !== null && (
 <span className="tabular-nums ml-0.5">({p.stock_qty})</span>
 )}
 </span>
 );
 }
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
 <span className="w-1.5 h-1.5 rounded-full bg-rose-500"/>
 {isBn ? 'স্টক নেই' : 'Out of Stock'}
 </span>
 );
 };

 const renderExpiryBadge = (p: CatalogProduct) => {
 if (!p.nearest_expiry) {
 return <span className="text-[11px] text-[#777777] dark:text-slate-500">—</span>;
 }
 if (p.expiry_alert === 'critical') {
 return (
 <div className="inline-flex flex-col items-end">
 <span className="tabular-nums text-[11.5px] font-bold text-rose-700 dark:text-rose-400">
 {p.nearest_expiry}
 </span>
 <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
 <AlertTriangle className="h-2.5 w-2.5"/>
 {p.days_to_expiry}d {isBn ? 'বাকি' : 'left'}
 </span>
 </div>
 );
 }
 if (p.expiry_alert === 'warning') {
 return (
 <div className="inline-flex flex-col items-end">
 <span className="tabular-nums text-[11.5px] font-bold text-amber-700 dark:text-amber-400">
 {p.nearest_expiry}
 </span>
 <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
 <AlertTriangle className="h-2.5 w-2.5"/>
 {isBn ? 'মেয়াদ কাছাকাছি' : `${p.days_to_expiry}d left`}
 </span>
 </div>
 );
 }
 return (
 <span className="tabular-nums text-[11.5px] text-[#333333] dark:text-slate-300">
 {p.nearest_expiry}
 </span>
 );
 };

 const catalogColumns: Column<CatalogProduct>[] = useMemo(
 () => [
 {
 id: 'fav',
 label: '★',
 className: 'w-10 text-center',
 render: (p) => {
 const isFav = favorites.includes(p.id);
 return (
 <button
 type="button"
 onClick={(e) => toggleFavorite(p.id, e)}
 aria-label="Toggle favorite"
 className="p-0.5 cursor-pointer inline-flex items-center justify-center"
 >
 <Star
 className={`h-3.5 w-3.5 transition-colors ${
 isFav
 ? 'fill-amber-400 text-amber-500'
 : 'text-[#CCCCCC] hover:text-amber-400 dark:text-slate-600'
 }`}
 />
 </button>
 );
 },
 },
 {
 id: 'name',
 label: isBn ? 'পণ্য ও জেনেরিক' : 'Product & Generic',
 sortable: true,
 className: 'min-w-[230px]',
 render: (p) => (
 <div>
 <div className="flex items-center gap-1.5 flex-wrap">
 <span className="font-bold text-[#222222] dark:text-white">
 {p.name}
 </span>
 <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-[2px] bg-[#EAECE9] dark:bg-slate-800 text-[#444444] dark:text-slate-300">
 {p.dosage_form}
 </span>
 {p.requires_prescription && (
 <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-[2px] bg-rose-50 text-rose-700 border border-rose-200">
 Rx
 </span>
 )}
 </div>
 <div className="text-[11px] text-[#0E5F3F] dark:text-emerald-400 font-medium mt-0.5">
 {p.generic_name}
 {p.strength && (
 <span className="text-[#666666] dark:text-slate-400">
 {' '}
 · {p.strength}
 </span>
 )}
 </div>
 {(p.sku || p.barcode) && (
 <div className="tabular-nums text-[10px] text-[#777777] dark:text-slate-500 mt-0.5">
 {p.sku && <span>{p.sku}</span>}
 {p.barcode && <span> · {p.barcode}</span>}
 </div>
 )}
 </div>
 ),
 },
 {
 id: 'company',
 label: isBn ? 'কোম্পানি ও প্যাক' : 'Company & Pack',
 sortable: true,
 className: 'min-w-[160px]',
 render: (p) => (
 <div>
 <div className="font-medium text-[#333333] dark:text-slate-200">
 {p.company}
 </div>
 <div className="text-[11px] text-[#666666] dark:text-slate-400 mt-0.5">
 {p.pack_size}
 </div>
 </div>
 ),
 },
 {
 id: 'mrp',
 label: isBn ? 'দাম (MRP / TP)' : 'Pricing (MRP / TP)',
 sortable: true,
 className: 'text-right min-w-[140px]',
 render: (p) => {
 const contractPrice = getContractPrice(p);
 return (
 <div className="tabular-nums text-right">
 <div className="font-bold text-[#222222] dark:text-white">
 {formatCurrency(p.mrp, currency)}
 <span className="text-[10px] font-sans font-normal text-[#666666] ml-1">
 MRP
 </span>
 </div>
 <div className="text-[11px] text-[#555555] dark:text-slate-400">
 TP {formatCurrency(p.trade_price, currency)}
 </div>
 {contractPrice !== null && (
 <div className="text-[11px] font-bold text-[#0E5F3F] dark:text-emerald-400">
 {isBn ? 'চুক্তি' : 'Contract'}{' '}
 {formatCurrency(contractPrice, currency)}
 </div>
 )}
 </div>
 );
 },
 },
 {
 id: 'stock_status',
 label: isBn ? 'স্টক' : 'Stock',
 sortable: true,
 className: 'text-center min-w-[125px]',
 render: (p) => {
 const alternatives = getAlternatives(p);
 return (
 <div className="flex flex-col items-center">
 {renderStockBadge(p)}
 {p.stock_status === 'out_of_stock' && alternatives.length > 0 && (
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 openProductModal(p);
 }}
 className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-[#337AB7] hover:underline cursor-pointer"
 >
 <Repeat className="h-3 w-3"/>
 {isBn
 ? `${alternatives.length}টি বিকল্প`
 : `${alternatives.length} alts`}
 </button>
 )}
 </div>
 );
 },
 },
 {
 id: 'nearest_expiry',
 label: isBn ? 'নিকটতম মেয়াদ' : 'Nearest Expiry',
 sortable: true,
 className: 'text-right min-w-[120px]',
 render: (p) => <div className="text-right">{renderExpiryBadge(p)}</div>,
 },
 {
 id: 'offer_label',
 label: isBn ? 'অফার' : 'Offer',
 className: 'text-center min-w-[100px]',
 render: (p) =>
 p.offer_label ? (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10.5px] font-bold bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/30">
 <Sparkles className="h-3 w-3"/>
 {p.offer_label}
 </span>
 ) : (
 <span className="text-[#999999]">—</span>
 ),
 },
 ],
 [favorites, isBn, currency, selectedCustomer, showExactStock, alternativesByGeneric]
 );

 const headerTabs = (
 <div className="flex flex-wrap items-center gap-1.5">
 {(
 [
 { key: 'all', label: isBn ? 'সব পণ্য' : 'All', count: products.length },
 {
 key: 'in_stock',
 label: isBn ? 'আছে' : 'In Stock',
 count: products.filter((p) => p.stock_status === 'in_stock').length,
 },
 {
 key: 'low_stock',
 label: isBn ? 'কম স্টক' : 'Low Stock',
 count: products.filter((p) => p.stock_status === 'low_stock').length,
 },
 {
 key: 'out_of_stock',
 label: isBn ? 'স্টক নেই' : 'Out of Stock',
 count: products.filter((p) => p.stock_status === 'out_of_stock').length,
 },
 ] as const
 ).map((tab) => (
 <button
 key={tab.key}
 type="button"
 onClick={() => setStockFilter(tab.key)}
 className={`h-7 px-2.5 rounded-[2px] text-[11.5px] font-semibold border transition-colors cursor-pointer ${
 stockFilter === tab.key
 ? 'bg-[#0E5F3F] border-[#0A4D33] text-white'
 : 'bg-white dark:bg-[#161b22] border-[#CCCCCC] dark:border-slate-700 text-[#333333] dark:text-slate-300 hover:border-[#0E5F3F]'
 }`}
 >
 {tab.label} <span className="tabular-nums opacity-80">({tab.count})</span>
 </button>
 ))}

 <button
 type="button"
 onClick={() => setFavoritesOnly((prev) => !prev)}
 className={`h-7 px-2.5 rounded-[2px] text-[11.5px] font-semibold border inline-flex items-center gap-1 transition-colors cursor-pointer ${
 favoritesOnly
 ? 'bg-amber-500 border-amber-600 text-white'
 : 'bg-white dark:bg-[#161b22] border-[#CCCCCC] dark:border-slate-700 text-[#333333] dark:text-slate-300 hover:border-amber-500'
 }`}
 >
 <Star className={`h-3 w-3 ${favoritesOnly ? 'fill-white' : 'text-amber-500'}`} />
 <span>{isBn ? 'ফেভারিট' : 'Favorites'}</span>
 <span className="tabular-nums">({favorites.length})</span>
 </button>

 <button
 type="button"
 onClick={() => setOffersOnly((prev) => !prev)}
 className={`h-7 px-2.5 rounded-[2px] text-[11.5px] font-semibold border inline-flex items-center gap-1 transition-colors cursor-pointer ${
 offersOnly
 ? 'bg-[#0E5F3F] border-[#0A4D33] text-white'
 : 'bg-white dark:bg-[#161b22] border-[#CCCCCC] dark:border-slate-700 text-[#333333] dark:text-slate-300 hover:border-[#0E5F3F]'
 }`}
 >
 <Sparkles className="h-3 w-3"/>
 <span>{isBn ? 'অফার' : 'Offers'}</span>
 </button>
 </div>
 );

 const filterContent = (
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-1">
 <Select
 label={isBn ? 'ক্যাটাগরি / ফর্ম' : 'Category / Form'}
 size="sm"
 value={formFilter}
 onChange={(e) => setFormFilter(String(e.target.value))}
 options={[
 { value: '', label: isBn ? 'সব ক্যাটাগরি' : 'All Categories' },
 ...uniqueForms.map((f) => ({ value: f, label: f })),
 ]}
 />
 <Select
 label={isBn ? 'কোম্পানি' : 'Company'}
 size="sm"
 value={companyFilter}
 onChange={(e) => setCompanyFilter(String(e.target.value))}
 options={[
 { value: '', label: isBn ? 'সব কোম্পানি' : 'All Companies' },
 ...uniqueCompanies.map((c) => ({ value: c, label: c })),
 ]}
 />
 <Select
 label={isBn ? 'কাস্টমার চুক্তি মূল্য' : 'Customer Contract Price'}
 size="sm"
 value={selectedCustomerId}
 onChange={(e) => setSelectedCustomerId(String(e.target.value))}
 options={[
 {
 value: '',
 label: isBn ? 'স্ট্যান্ডার্ড দাম (চুক্তি নেই)' : 'Standard Price (No Contract)',
 },
 ...customers.map((c) => ({
 value: String(c.id),
 label:
 c.contract_discount_pct > 0
 ? `${c.name} (-${c.contract_discount_pct}% ${c.customer_type})`
 : `${c.name} (${c.customer_type})`,
 })),
 ]}
 />
 {(formFilter || companyFilter || selectedCustomerId || stockFilter !== 'all' || favoritesOnly || offersOnly) && (
 <div className="sm:col-span-3 flex justify-end">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setFormFilter('');
 setCompanyFilter('');
 setSelectedCustomerId('');
 setStockFilter('all');
 setFavoritesOnly(false);
 setOffersOnly(false);
 }}
 >
 {isBn ? 'ফিল্টার রিসেট' : 'Reset Filters'}
 </Button>
 </div>
 )}
 </div>
 );

 return (
 <AppLayout
 title={isBn ? 'প্রোডাক্ট ক্যাটালগ' : 'Product Catalog'}
 subtitle={
 isBn
 ? `${branchName ?? 'ব্রাঞ্চ'} · দাম, স্টক, মেয়াদ, অফার ও বিকল্প পণ্য দেখুন এবং সরাসরি অর্ডারে যোগ করুন`
 : `${branchName ?? 'Branch'} · Search prices, stock status, nearest expiry, active offers & generic alternatives`
 }
 actions={
 <div className="flex items-center gap-2">
 <div
 role="group"
 className="inline-flex items-center rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#12161c] p-0.5"
 >
 <span className="px-1.5 text-[#555555] dark:text-slate-400">
 <Globe className="h-3.5 w-3.5"/>
 </span>
 <button
 type="button"
 onClick={() => setLang('en')}
 className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] cursor-pointer ${
 lang === 'en'
 ? 'bg-[#0E5F3F] text-white'
 : 'text-[#333333] dark:text-slate-300'
 }`}
 >
 EN
 </button>
 <button
 type="button"
 onClick={() => setLang('bn')}
 className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] cursor-pointer ${
 lang === 'bn'
 ? 'bg-[#0E5F3F] text-white'
 : 'text-[#333333] dark:text-slate-300'
 }`}
 >
 বাংলা
 </button>
 </div>
 </div>
 }
 >
 <Head title="Product Catalog"/>

 <div className="space-y-3.5">
 <DataTable<CatalogProduct>
 tableId="salesman-product-catalog"
 data={filteredProducts}
 columns={catalogColumns}
 keyExtractor={(p) => p.id}
 searchPlaceholder={
 isBn
 ? 'পণ্যের নাম, জেনেরিক, কোম্পানি বা বারকোড দিয়ে খুঁজুন...'
 : 'Search by name, generic, company, SKU or barcode...'
 }
 headerTabs={headerTabs}
 filterContent={filterContent}
 hideCheckbox
 hideViewToggle
 compact
 onRowClick={(p) => openProductModal(p)}
 actions={(p) => (
 <div className="inline-flex items-center justify-end gap-1.5"onClick={(e) => e.stopPropagation()}>
 <Button
 type="button"
 size="sm"
 variant="outline"
 onClick={() => openProductModal(p)}
 className="h-7 px-2 text-[11px]"
 >
 <Eye className="h-3 w-3"/>
 <span>{isBn ? 'বিবরণ' : 'Details'}</span>
 </Button>
 {p.stock_status !== 'out_of_stock' ? (
 <Button
 type="button"
 size="sm"
 variant="primary"
 onClick={() => handleAddToOrder(p, 1)}
 className="h-7 px-2.5 text-[11px]"
 >
 <ShoppingCart className="h-3 w-3"/>
 <span>{isBn ? 'অর্ডারে যোগ' : 'Add'}</span>
 </Button>
 ) : (
 <Button
 type="button"
 size="sm"
 variant="outline"
 onClick={() => openProductModal(p)}
 className="h-7 px-2 text-[11px]"
 >
 <Repeat className="h-3 w-3"/>
 <span>{isBn ? 'বিকল্প' : 'Alts'}</span>
 </Button>
 )}
 </div>
 )}
 emptyState={
 <EmptyState
 icon={Package}
 title={isBn ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products found'}
 description={
 isBn
 ? 'আপনার সার্চ বা ফিল্টারের সাথে কোনো পণ্য মেলেনি।'
 : 'No products matched your current search or filters.'
 }
 />
 }
 />
 </div>

 {/* Product Details, Add to Order & Generic Alternatives Modal */}
 {activeProduct && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 overflow-y-auto"
 onClick={() => setActiveProduct(null)}
 >
 <div
 className="w-full max-w-2xl rounded-[4px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#161b22] shadow-xl overflow-hidden my-6"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Modal Header */}
 <div className="px-5 py-3.5 border-b border-[#E2E6E1] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#1b222c] flex items-start justify-between gap-3">
 <div className="flex items-start gap-3 min-w-0">
 <div className="h-12 w-12 rounded-[2px] border border-[#D5DBD3] dark:border-slate-700 bg-white dark:bg-[#12161c] text-[#0E5F3F] dark:text-emerald-400 flex items-center justify-center shrink-0">
 <Pill className="h-6 w-6"/>
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="text-base font-bold text-[#222222] dark:text-white">
 {activeProduct.name}
 </h3>
 {renderStockBadge(activeProduct)}
 {activeProduct.offer_label && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10.5px] font-bold bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/30">
 <Sparkles className="h-3 w-3"/>
 {activeProduct.offer_label}
 </span>
 )}
 </div>
 <p className="text-xs text-[#0E5F3F] dark:text-emerald-400 font-semibold mt-0.5">
 {activeProduct.generic_name}
 {activeProduct.strength && ` · ${activeProduct.strength}`} ·{' '}
 {activeProduct.dosage_form}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-1 shrink-0">
 <button
 type="button"
 onClick={() => toggleFavorite(activeProduct.id)}
 className="p-1.5 rounded-[2px] hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
 title={isBn ? 'ফেভারিট' : 'Favorite'}
 >
 <Star
 className={`h-4 w-4 ${
 favorites.includes(activeProduct.id)
 ? 'fill-amber-400 text-amber-500'
 : 'text-[#888888]'
 }`}
 />
 </button>
 <button
 type="button"
 onClick={() => setActiveProduct(null)}
 className="p-1.5 rounded-[2px] text-[#555555] hover:text-[#222222] dark:text-slate-400 dark:hover:text-white cursor-pointer"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>
 </div>

 <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
 {/* Pricing Summary Strip */}
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 <div className="rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-[#F9FAF8] dark:bg-[#12161c] p-3">
 <span className="text-[10.5px] font-bold text-[#555555] dark:text-slate-400 block">
 {isBn ? 'MRP (খুচরা মূল্য)' : 'MRP'}
 </span>
 <span className="tabular-nums text-lg font-bold text-[#222222] dark:text-white">
 {formatCurrency(activeProduct.mrp, currency)}
 </span>
 </div>
 <div className="rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-[#F9FAF8] dark:bg-[#12161c] p-3">
 <span className="text-[10.5px] font-bold text-[#555555] dark:text-slate-400 block">
 {isBn ? 'ট্রেড প্রাইস (TP)' : 'Trade Price (TP)'}
 </span>
 <span className="tabular-nums text-lg font-bold text-[#333333] dark:text-slate-200">
 {formatCurrency(activeProduct.trade_price, currency)}
 </span>
 </div>
 <div className="col-span-2 sm:col-span-1 rounded-[2px] border border-[#0E5F3F]/30 dark:border-emerald-800 bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 p-3">
 <span className="text-[10.5px] font-bold text-[#0E5F3F] dark:text-emerald-400 block">
 {isBn ? 'কাস্টমার চুক্তি মূল্য' : 'Contract Price'}
 </span>
 <span className="tabular-nums text-lg font-bold text-[#0E5F3F] dark:text-emerald-300">
 {getContractPrice(activeProduct) !== null
 ? formatCurrency(getContractPrice(activeProduct)!, currency)
 : '—'}
 </span>
 </div>
 </div>

 {/* Detailed Specs Grid */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
 <div className="rounded-[2px] border border-[#E2E6E1] dark:border-slate-800 p-3 space-y-2">
 <div className="flex items-center justify-between gap-2">
 <span className="text-[#555555] dark:text-slate-400 flex items-center gap-1.5">
 <Building2 className="h-3.5 w-3.5"/>
 {isBn ? 'কোম্পানি' : 'Company'}
 </span>
 <span className="font-semibold text-[#222222] dark:text-white text-right">
 {activeProduct.company}
 </span>
 </div>
 <div className="flex items-center justify-between gap-2">
 <span className="text-[#555555] dark:text-slate-400 flex items-center gap-1.5">
 <Layers className="h-3.5 w-3.5"/>
 {isBn ? 'প্যাক সাইজ' : 'Pack Size'}
 </span>
 <span className="font-semibold text-[#222222] dark:text-white text-right">
 {activeProduct.pack_size}
 </span>
 </div>
 <div className="flex items-center justify-between gap-2">
 <span className="text-[#555555] dark:text-slate-400 flex items-center gap-1.5">
 <Barcode className="h-3.5 w-3.5"/>
 SKU / Barcode
 </span>
 <span className="tabular-nums text-[#333333] dark:text-slate-200 text-right">
 {activeProduct.sku || '—'}
 {activeProduct.barcode ? ` · ${activeProduct.barcode}` : ''}
 </span>
 </div>
 </div>

 <div className="rounded-[2px] border border-[#E2E6E1] dark:border-slate-800 p-3 space-y-2">
 <div className="flex items-center justify-between gap-2">
 <span className="text-[#555555] dark:text-slate-400 flex items-center gap-1.5">
 <Calendar className="h-3.5 w-3.5"/>
 {isBn ? 'নিকটতম মেয়াদ' : 'Nearest Expiry'}
 </span>
 <div>{renderExpiryBadge(activeProduct)}</div>
 </div>
 <div className="flex items-start gap-1.5 pt-1 border-t border-[#ECEFEA] dark:border-slate-800">
 <Thermometer className="h-3.5 w-3.5 text-[#0E5F3F] shrink-0 mt-0.5"/>
 <div>
 <span className="font-semibold text-[#333333] dark:text-slate-200 block">
 {isBn ? 'সংরক্ষণের নিয়ম' : 'Storage Condition'}
 </span>
 <span className="text-[11px] text-[#555555] dark:text-slate-400">
 {activeProduct.storage_rule}
 </span>
 </div>
 </div>
 </div>
 </div>

 {/* Direct Add to Order Bar */}
 {activeProduct.stock_status !== 'out_of_stock' && (
 <div className="rounded-[2px] border border-[#0E5F3F]/30 bg-[#EAF5F0]/70 dark:bg-[#0E5F3F]/15 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-[#222222] dark:text-white">
 {isBn ? 'পরিমাণ (Qty):' : 'Order Quantity:'}
 </span>
 <div className="inline-flex items-center border border-[#CCCCCC] dark:border-slate-700 rounded-[2px] bg-white dark:bg-[#12161c]">
 <button
 type="button"
 onClick={() => setOrderQty((q) => Math.max(1, q - 1))}
 className="h-8 w-8 flex items-center justify-center text-[#333333] dark:text-slate-200 hover:bg-[#EAECE9] cursor-pointer"
 >
 <Minus className="h-3.5 w-3.5"/>
 </button>
 <input
 type="number"
 min={1}
 value={orderQty}
 onChange={(e) =>
 setOrderQty(Math.max(1, parseInt(e.target.value, 10) || 1))
 }
 className="w-14 h-8 text-center tabular-nums text-xs font-bold border-x border-[#CCCCCC] dark:border-slate-700 bg-transparent text-[#222222] dark:text-white focus:outline-none"
 />
 <button
 type="button"
 onClick={() => setOrderQty((q) => q + 1)}
 className="h-8 w-8 flex items-center justify-center text-[#333333] dark:text-slate-200 hover:bg-[#EAECE9] cursor-pointer"
 >
 <Plus className="h-3.5 w-3.5"/>
 </button>
 </div>
 <span className="tabular-nums text-xs font-bold text-[#0E5F3F] dark:text-emerald-400">
 = {formatCurrency(
 (getContractPrice(activeProduct) ?? activeProduct.mrp) * orderQty,
 currency
 )}
 </span>
 </div>

 <Button
 type="button"
 variant="primary"
 size="sm"
 onClick={() => handleAddToOrder(activeProduct, orderQty)}
 className="px-4"
 >
 <ShoppingCart className="h-3.5 w-3.5"/>
 <span>{isBn ? 'অর্ডারে যোগ করুন' : 'Add to Order'}</span>
 </Button>
 </div>
 )}

 {/* Same-Generic Alternatives Section */}
 <div className="rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 overflow-hidden">
 <div className="px-3.5 py-2.5 bg-[#F5F7F4] dark:bg-[#1b222c] border-b border-[#E2E6E1] dark:border-slate-800 flex items-center justify-between">
 <h4 className="text-xs font-bold text-[#0E5F3F] dark:text-emerald-400 flex items-center gap-1.5">
 <Repeat className="h-3.5 w-3.5"/>
 {isBn
 ? `একই জেনেরিকের বিকল্প পণ্য (${activeProduct.generic_name})`
 : `Same-Generic Alternatives (${activeProduct.generic_name})`}
 </h4>
 <span className="tabular-nums text-[11px] font-bold text-[#333333] dark:text-slate-300">
 {getAlternatives(activeProduct).length}
 </span>
 </div>

 {getAlternatives(activeProduct).length === 0 ? (
 <div className="p-4 text-center text-xs text-[#666666] dark:text-slate-400">
 {isBn
 ? 'এই জেনেরিকের অন্য কোনো স্টকে থাকা বিকল্প পণ্য পাওয়া যায়নি।'
 : 'No other in-stock alternatives found for this generic.'}
 </div>
 ) : (
 <div className="divide-y divide-[#ECEFEA] dark:divide-slate-800">
 {getAlternatives(activeProduct).slice(0, 6).map((alt) => (
 <div
 key={alt.id}
 className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40"
 >
 <div className="min-w-0">
 <div className="font-bold text-[#222222] dark:text-white truncate">
 {alt.name}
 </div>
 <div className="text-[11px] text-[#555555] dark:text-slate-400">
 {alt.company} · {alt.pack_size}
 {alt.nearest_expiry && ` · Exp ${alt.nearest_expiry}`}
 </div>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <span className="tabular-nums font-bold text-[#222222] dark:text-white">
 {formatCurrency(alt.mrp, currency)}
 </span>
 <Button
 type="button"
 size="sm"
 variant="primary"
 onClick={() => handleAddToOrder(alt, orderQty)}
 className="h-7 px-2.5 text-[11px]"
 >
 <CheckCircle2 className="h-3 w-3"/>
 <span>{isBn ? 'অর্ডারে যোগ' : 'Add to Order'}</span>
 </Button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 )}
 </AppLayout>
 );
}

