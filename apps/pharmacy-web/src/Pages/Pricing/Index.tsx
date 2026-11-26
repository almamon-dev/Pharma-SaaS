import React, { useMemo, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import {
 Check,
 Copy,
 Globe,
 Moon,
 Send,
 Sun,
 X,
} from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { SharedPageProps } from '@/types';

/* ============================================================================
 * EDITABLE PRICING CONFIGURATION
 * Edit prices, descriptions, or add new groups (e.g."Add-ons") here.
 * The page renders every group dynamically — no layout code changes needed.
 * ========================================================================== */

export type BillingCycle = 'monthly' | 'one_time';
export type Lang = 'en' | 'bn';

export interface LocalizedText {
 en: string;
 bn: string;
}

export interface PricingItem {
 id: string;
 price: number;
 name: LocalizedText;
 description: LocalizedText;
}

export interface PricingGroup {
 id: string;
 billingCycle: BillingCycle;
 defaultChecked: boolean;
 title: LocalizedText;
 subtitle: LocalizedText;
 itemColumnLabel: LocalizedText;
 priceColumnLabel: LocalizedText;
 items: PricingItem[];
}

export const PRICING_CONFIG: {
 currencySymbol: string;
 groups: PricingGroup[];
} = {
 currencySymbol: '৳',
 groups: [
 {
 id: 'features',
 billingCycle: 'monthly',
 defaultChecked: true,
 title: {
 en: 'Features',
 bn: 'ফিচারসমূহ',
 },
 subtitle: {
 en: 'Every module has its own monthly price. Untick anything your team does not need.',
 bn: 'প্রতিটি মডিউলের আলাদা মাসিক মূল্য রয়েছে। যেগুলো লাগবে না তা আনটিক করে দিন।',
 },
 itemColumnLabel: {
 en: 'Feature',
 bn: 'ফিচার',
 },
 priceColumnLabel: {
 en: 'Price (monthly)',
 bn: 'মূল্য (মাসিক)',
 },
 items: [
 {
 id: 'dashboard',
 price: 200,
 name: {
 en: 'Dashboard',
 bn: 'ড্যাশবোর্ড',
 },
 description: {
 en:"Sales, target, dues, today's work, alerts",
 bn: 'বিক্রয়, টার্গেট, বকেয়া, আজকের কাজ ও অ্যালার্ট',
 },
 },
 {
 id: 'new_sales_order',
 price: 500,
 name: {
 en: 'New Sales Order',
 bn: 'নতুন সেলস অর্ডার',
 },
 description: {
 en: 'Pick customer, products, credit limit warning',
 bn: 'কাস্টমার নির্বাচন, প্রোডাক্ট বাছাই ও ক্রেডিট লিমিট সতর্কতা',
 },
 },
 {
 id: 'my_orders_tracking',
 price: 250,
 name: {
 en: 'My Orders & Tracking',
 bn: 'আমার অর্ডার ও ট্র্যাকিং',
 },
 description: {
 en: 'Order status tracking',
 bn: 'অর্ডারের বর্তমান স্ট্যাটাস ট্র্যাকিং',
 },
 },
 {
 id: 'my_customers',
 price: 300,
 name: {
 en: 'My Customers',
 bn: 'আমার কাস্টমার',
 },
 description: {
 en: 'Customer list, profile, credit limit',
 bn: 'কাস্টমার তালিকা, প্রোফাইল ও ক্রেডিট লিমিট',
 },
 },
 {
 id: 'collections_dues',
 price: 500,
 name: {
 en: 'Collections & Dues',
 bn: 'কালেকশন ও বকেয়া',
 },
 description: {
 en: 'Due ageing, collection entry',
 bn: 'বকেয়ার সময়কাল বিশ্লেষণ ও কালেকশন এন্ট্রি',
 },
 },
 {
 id: 'product_catalog',
 price: 200,
 name: {
 en: 'Product Catalog',
 bn: 'প্রোডাক্ট ক্যাটালগ',
 },
 description: {
 en: 'Price, stock, expiry (view only)',
 bn: 'মূল্য, স্টক ও মেয়াদোত্তীর্ণের তারিখ (শুধুমাত্র দেখার জন্য)',
 },
 },
 {
 id: 'returns',
 price: 250,
 name: {
 en: 'Returns',
 bn: 'রিটার্নস',
 },
 description: {
 en: 'Return requests and credit note status',
 bn: 'রিটার্ন রিকোয়েস্ট ও ক্রেডিট নোট স্ট্যাটাস',
 },
 },
 {
 id: 'profile_security',
 price: 100,
 name: {
 en: 'Profile & Security',
 bn: 'প্রোফাইল ও নিরাপত্তা',
 },
 description: {
 en: 'Profile, password, login devices',
 bn: 'প্রোফাইল, পাসওয়ার্ড ও লগইন ডিভাইস ব্যবস্থাপনা',
 },
 },
 ],
 },
 {
 id: 'one_time_services',
 billingCycle: 'one_time',
 defaultChecked: false,
 title: {
 en: 'One-time services',
 bn: 'এককালীন সার্ভিসসমূহ',
 },
 subtitle: {
 en: 'Optional onboarding assistance — tick to add. Billed once, not monthly.',
 bn: 'ঐচ্ছিক অনবোর্ডিং সহায়তা — যোগ করতে টিক দিন। শুধুমাত্র একবার বিল হবে, মাসিক নয়।',
 },
 itemColumnLabel: {
 en: 'Service',
 bn: 'সার্ভিস',
 },
 priceColumnLabel: {
 en: 'Price (one-time)',
 bn: 'মূল্য (এককালীন)',
 },
 items: [
 {
 id: 'setup_training',
 price: 8000,
 name: {
 en: 'Setup & Training',
 bn: 'সেটআপ ও ট্রেনিং',
 },
 description: {
 en: 'Workspace configuration, branch setup, and team training session',
 bn: 'ওয়ার্কস্পেস কনফিগারেশন, ব্রাঞ্চ সেটআপ ও টিম ট্রেনিং সেশন',
 },
 },
 {
 id: 'data_import',
 price: 3000,
 name: {
 en: 'Data Import',
 bn: 'ডেটা ইমপোর্ট',
 },
 description: {
 en: 'Product catalog, customer directory, and opening due migration',
 bn: 'প্রোডাক্ট ক্যাটালগ, কাস্টমার তালিকা ও প্রারম্ভিক বকেয়া মাইগ্রেশন',
 },
 },
 ],
 },
 /* Example: uncomment or add more groups anytime — zero page code changes required!
 {
 id: 'add_ons',
 billingCycle: 'monthly',
 defaultChecked: false,
 title: { en: 'Add-ons', bn: 'অ্যাড-অনস' },
 subtitle: { en: 'Optional monthly extensions.', bn: 'ঐচ্ছিক মাসিক এক্সটেনশন।' },
 itemColumnLabel: { en: 'Add-on', bn: 'অ্যাড-অন' },
 priceColumnLabel: { en: 'Price (monthly)', bn: 'মূল্য (মাসিক)' },
 items: [
 {
 id: 'sms_alerts',
 price: 400,
 name: { en: 'SMS Order Alerts', bn: 'এসএমএস অর্ডার অ্যালার্ট' },
 description: { en: 'Automated SMS updates to pharmacy buyers', bn: 'ক্রেতাদের কাছে স্বয়ংক্রিয় এসএমএস আপডেট' },
 },
 ],
 },
 */
 ],
};

/* ============================================================================
 * UI COPY (EN / BN)
 * ========================================================================== */

const UI_TEXT = {
 en: {
 pageTitle: 'Choose your features',
 subtitle:
 'Pay only for the modules your medicine or hospital supply distribution team uses. Tick or untick items below for an instant price breakdown.',
 whatYouGet: 'What you get',
 perMonth: '/mo',
 oneTimeTag: 'one-time',
 summaryTitle: 'Quote Summary',
 monthlyTotal: 'Monthly total',
 oneTimeTotal: 'One-time total',
 selectedFeatures: 'Selected items',
 noItemsSelected: 'No features selected yet. Tick items from the tables to build your quote.',
 monthlySection: 'Monthly modules',
 oneTimeSection: 'One-time services',
 requestQuote: 'Request quote',
 selectAll: 'Select all',
 clearAll: 'Clear',
 selectedCount: (n: number, total: number) => `${n} of ${total} selected`,
 modalTitle: 'Request a Custom Quote',
 modalSubtitle: 'Review your selected modules and share your distribution details.',
 companyLabel: 'Distribution Company / Organization',
 companyPlaceholder: 'e.g. Bengal MedTech Distributors Ltd.',
 contactLabel: 'Your Name',
 contactPlaceholder: 'e.g. Tariqul Islam',
 phoneLabel: 'Phone / WhatsApp',
 phonePlaceholder: 'e.g. +880 17XX-XXXXXX',
 emailLabel: 'Work Email',
 emailPlaceholder: 'e.g. ops@company.com.bd',
 submitQuote: 'Submit Quote Request',
 copyBreakdown: 'Copy Breakdown',
 copied: 'Copied!',
 quoteSubmittedTitle: 'Quote request prepared',
 quoteSubmittedDesc:
 'Your selected feature breakdown has been captured. Our onboarding team will contact you shortly.',
 done: 'Done',
 backHome: 'Back to Home',
 },
 bn: {
 pageTitle: 'আপনার ফিচার বেছে নিন',
 subtitle:
 'আপনার ওষুধ বা হাসপাতাল সাপ্লাই ডিস্ট্রিবিউশন টিমের যে মডিউলগুলো প্রয়োজন শুধু সেগুলোর জন্যই পে করুন। টিক বা আনটিক করলেই সাথে সাথে মোট মূল্য আপডেট হবে।',
 whatYouGet: 'যা যা পাবেন',
 perMonth: '/মাস',
 oneTimeTag: 'এককালীন',
 summaryTitle: 'কোটেশন সারসংক্ষেপ',
 monthlyTotal: 'মাসিক মোট',
 oneTimeTotal: 'এককালীন মোট',
 selectedFeatures: 'নির্বাচিত আইটেম',
 noItemsSelected: 'এখনো কোনো ফিচার নির্বাচন করা হয়নি। কোটেশন তৈরি করতে টেবিল থেকে টিক দিন।',
 monthlySection: 'মাসিক মডিউল',
 oneTimeSection: 'এককালীন সার্ভিস',
 requestQuote: 'কোটেশন চান',
 selectAll: 'সব নির্বাচন',
 clearAll: 'সব বাদ দিন',
 selectedCount: (n: number, total: number) => `${total}টির মধ্যে ${n}টি নির্বাচিত`,
 modalTitle: 'কাস্টম কোটেশন অনুরোধ',
 modalSubtitle: 'আপনার নির্বাচিত মডিউলগুলো যাচাই করে কোম্পানির তথ্য দিন।',
 companyLabel: 'ডিস্ট্রিবিউশন কোম্পানি / প্রতিষ্ঠানের নাম',
 companyPlaceholder: 'যেমন: বেঙ্গল মেডটেক ডিস্ট্রিবিউটরস লিমিটেড',
 contactLabel: 'আপনার নাম',
 contactPlaceholder: 'যেমন: তারিকুল ইসলাম',
 phoneLabel: 'মোবাইল / হোয়াটসঅ্যাপ নম্বর',
 phonePlaceholder: 'যেমন: ০১৭XX-XXXXXX',
 emailLabel: 'অফিশিয়াল ইমেইল',
 emailPlaceholder: 'যেমন: ops@company.com.bd',
 submitQuote: 'কোটেশন পাঠান',
 copyBreakdown: 'তালিকা কপি করুন',
 copied: 'কপি হয়েছে!',
 quoteSubmittedTitle: 'কোটেশন অনুরোধ প্রস্তুত',
 quoteSubmittedDesc:
 'আপনার নির্বাচিত ফিচারের তালিকা সংরক্ষণ করা হয়েছে। আমাদের টিম দ্রুত আপনার সাথে যোগাযোগ করবে।',
 done: 'সম্পন্ন',
 backHome: 'হোম পেজ',
 },
} as const;

function formatBdt(amount: number): string {
 return `${PRICING_CONFIG.currencySymbol}${amount.toLocaleString('en-US')}`;
}

function buildInitialSelection(): Record<string, boolean> {
 const map: Record<string, boolean> = {};
 for (const group of PRICING_CONFIG.groups) {
 for (const item of group.items) {
 map[item.id] = group.defaultChecked;
 }
 }
 return map;
}

export default function PricingIndex() {
 const { auth } = usePage<SharedPageProps>().props;
 const isAuthenticated = Boolean(auth?.user);
 const [lang, setLang] = useState<Lang>('en');
 const [selected, setSelected] = useState<Record<string, boolean>>(buildInitialSelection);
 const [quoteModalOpen, setQuoteModalOpen] = useState(false);
 const [quoteSubmitted, setQuoteSubmitted] = useState(false);
 const [copied, setCopied] = useState(false);
 const [isDark, setIsDark] = useState<boolean>(() => {
 if (typeof document !== 'undefined') {
 return document.documentElement.classList.contains('dark');
 }
 return false;
 });

 const [quoteForm, setQuoteForm] = useState({
 company: '',
 contact: '',
 phone: '',
 email: '',
 });

 const t = UI_TEXT[lang];

 const toggleDarkMode = () => {
 const next = !isDark;
 setIsDark(next);
 if (typeof document !== 'undefined') {
 document.documentElement.classList.toggle('dark', next);
 }
 };

 const toggleItem = (id: string) => {
 setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
 };

 const setGroupSelection = (group: PricingGroup, checked: boolean) => {
 setSelected((prev) => {
 const next = { ...prev };
 for (const item of group.items) {
 next[item.id] = checked;
 }
 return next;
 });
 };

 const summary = useMemo(() => {
 const selectedMonthly: { groupId: string; item: PricingItem }[] = [];
 const selectedOneTime: { groupId: string; item: PricingItem }[] = [];
 let monthlyTotal = 0;
 let oneTimeTotal = 0;

 for (const group of PRICING_CONFIG.groups) {
 for (const item of group.items) {
 if (!selected[item.id]) continue;
 if (group.billingCycle === 'monthly') {
 selectedMonthly.push({ groupId: group.id, item });
 monthlyTotal += item.price;
 } else {
 selectedOneTime.push({ groupId: group.id, item });
 oneTimeTotal += item.price;
 }
 }
 }

 return {
 selectedMonthly,
 selectedOneTime,
 monthlyTotal,
 oneTimeTotal,
 totalSelectedCount: selectedMonthly.length + selectedOneTime.length,
 };
 }, [selected]);

 const handleCopyBreakdown = () => {
 const lines: string[] = [
 `Sales Portal SaaS Quote (${lang === 'bn' ? 'Bangla' : 'English'})`,
 '---',
 ];
 if (summary.selectedMonthly.length > 0) {
 lines.push(`${t.monthlySection}:`);
 for (const { item } of summary.selectedMonthly) {
 lines.push(`- ${item.name[lang]}: ${formatBdt(item.price)}${t.perMonth}`);
 }
 }
 if (summary.selectedOneTime.length > 0) {
 lines.push('', `${t.oneTimeSection}:`);
 for (const { item } of summary.selectedOneTime) {
 lines.push(`- ${item.name[lang]}: ${formatBdt(item.price)} (${t.oneTimeTag})`);
 }
 }
 lines.push(
 '---',
 `${t.monthlyTotal}: ${formatBdt(summary.monthlyTotal)}${t.perMonth}`,
 `${t.oneTimeTotal}: ${formatBdt(summary.oneTimeTotal)}`
 );

 navigator.clipboard?.writeText(lines.join('\n'));
 setCopied(true);
 window.setTimeout(() => setCopied(false), 2000);
 };

 const handleQuoteSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 setQuoteSubmitted(true);
 };

 const headerControls = (
 <div className="flex items-center gap-2 shrink-0">
 {/* Language Toggle (Bangla / English) */}
 <div
 role="group"
 aria-label="Language toggle"
 className="inline-flex items-center rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#12161c] p-0.5"
 >
 <span className="px-2 text-[#555555] dark:text-slate-400 hidden sm:inline-flex items-center">
 <Globe className="h-3.5 w-3.5"/>
 </span>
 <button
 type="button"
 onClick={() => setLang('en')}
 aria-pressed={lang === 'en'}
 className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer ${
 lang === 'en'
 ? 'bg-[#0E5F3F] text-white'
 : 'text-[#333333] dark:text-slate-300 hover:bg-[#EAF5F0] dark:hover:bg-slate-800'
 }`}
 >
 English
 </button>
 <button
 type="button"
 onClick={() => setLang('bn')}
 aria-pressed={lang === 'bn'}
 className={`px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer ${
 lang === 'bn'
 ? 'bg-[#0E5F3F] text-white'
 : 'text-[#333333] dark:text-slate-300 hover:bg-[#EAF5F0] dark:hover:bg-slate-800'
 }`}
 >
 বাংলা
 </button>
 </div>

 {/* Dark Mode Toggle */}
 <button
 type="button"
 onClick={toggleDarkMode}
 aria-label="Toggle dark mode"
 title="Toggle dark mode"
 className="h-[34px] w-[34px] inline-flex items-center justify-center rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#12161c] text-[#333333] dark:text-slate-200 hover:border-[#0E5F3F] hover:text-[#0E5F3F] dark:hover:text-emerald-400 transition-colors cursor-pointer"
 >
 {isDark ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
 </button>
 </div>
 );

 const pricingBody = (
 <div className={isAuthenticated ? 'pb-20 lg:pb-2' : 'w-full px-4 sm:px-6 lg:px-8 py-5'}>
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
 {/* Left Column: Dynamic Pricing Group Tables */}
 <div className="lg:col-span-8 space-y-5 min-w-0">
 {PRICING_CONFIG.groups.map((group) => {
 const selectedInGroup = group.items.filter((item) => selected[item.id]).length;
 const allSelected =
 group.items.length > 0 && selectedInGroup === group.items.length;
 const groupSubtotal = group.items.reduce(
 (sum, item) => (selected[item.id] ? sum + item.price : sum),
 0
 );

 return (
 <section
 key={group.id}
 className="rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#161b22] overflow-hidden"
 >
 {/* Section Header */}
 <div className="px-4 py-3 border-b border-[#E2E6E1] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#1b222c] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div>
 <div className="flex items-center gap-2">
 <h2 className="text-sm sm:text-[15px] font-bold text-[#0E5F3F] dark:text-emerald-400">
 {group.title[lang]}
 </h2>
 <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-[2px] bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-700 text-[#333333] dark:text-slate-300">
 {t.selectedCount(selectedInGroup, group.items.length)}
 </span>
 </div>
 <p className="text-[12px] text-[#555555] dark:text-slate-400 mt-0.5">
 {group.subtitle[lang]}
 </p>
 </div>

 <div className="flex items-center gap-3 shrink-0">
 <span className="font-mono text-xs font-bold text-[#0E5F3F] dark:text-emerald-400">
 {formatBdt(groupSubtotal)}
 <span className="text-[11px] font-normal text-[#555555] dark:text-slate-400 ml-0.5">
 {group.billingCycle === 'monthly'
 ? t.perMonth
 : ` (${t.oneTimeTag})`}
 </span>
 </span>
 <button
 type="button"
 onClick={() => setGroupSelection(group, !allSelected)}
 className="text-[11.5px] font-semibold text-[#0E5F3F] dark:text-emerald-400 hover:underline cursor-pointer"
 >
 {allSelected ? t.clearAll : t.selectAll}
 </button>
 </div>
 </div>

 {/* Responsive Scrollable Table */}
 <div className="overflow-x-auto">
 <table className="w-full min-w-[540px] border-collapse text-left">
 <thead>
 <tr className="border-b border-[#D5DBD3] dark:border-slate-800 bg-[#FAFBF9] dark:bg-[#141920] text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 <th className="w-12 py-2.5 pl-4 pr-2 text-center">
 <input
 type="checkbox"
 checked={allSelected}
 onChange={(e) =>
 setGroupSelection(group, e.target.checked)
 }
 aria-label={`${t.selectAll} ${group.title[lang]}`}
 className="h-4 w-4 rounded-[2px] border-[#CCCCCC] accent-[#0E5F3F] cursor-pointer align-middle"
 />
 </th>
 <th className="py-2.5 px-3 w-[28%]">
 {group.itemColumnLabel[lang]}
 </th>
 <th className="py-2.5 px-3">{t.whatYouGet}</th>
 <th className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap w-[150px]">
 {group.priceColumnLabel[lang]}
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[#ECEFEA] dark:divide-slate-800/90">
 {group.items.map((item) => {
 const isChecked = Boolean(selected[item.id]);
 return (
 <tr
 key={item.id}
 onClick={() => toggleItem(item.id)}
 className={`cursor-pointer transition-colors select-none ${
 isChecked
 ? 'bg-[#EAF5F0]/55 dark:bg-[#0E5F3F]/15 hover:bg-[#EAF5F0] dark:hover:bg-[#0E5F3F]/25'
 : 'bg-white dark:bg-[#161b22] hover:bg-[#F5F7F4] dark:hover:bg-slate-800/40'
 }`}
 >
 <td
 className="py-3.5 pl-4 pr-2 text-center align-middle"
 onClick={(e) => e.stopPropagation()}
 >
 <input
 id={`item-${item.id}`}
 type="checkbox"
 checked={isChecked}
 onChange={() => toggleItem(item.id)}
 className="h-4 w-4 rounded-[2px] border-[#CCCCCC] accent-[#0E5F3F] cursor-pointer align-middle"
 />
 </td>
 <td className="py-3.5 px-3 align-middle">
 <label
 htmlFor={`item-${item.id}`}
 onClick={(e) => e.stopPropagation()}
 className={`block text-[13px] font-semibold cursor-pointer ${
 isChecked
 ? 'text-[#0E5F3F] dark:text-emerald-300'
 : 'text-[#222222] dark:text-slate-100'
 }`}
 >
 {item.name[lang]}
 </label>
 </td>
 <td className="py-3.5 px-3 align-middle text-[12.5px] text-[#555555] dark:text-slate-300">
 {item.description[lang]}
 </td>
 <td className="py-3.5 pl-3 pr-4 text-right align-middle whitespace-nowrap">
 <span
 className={`font-mono text-[13px] font-bold ${
 isChecked
 ? 'text-[#0E5F3F] dark:text-emerald-400'
 : 'text-[#333333] dark:text-slate-300'
 }`}
 >
 {formatBdt(item.price)}
 </span>
 <span className="ml-1 text-[11px] text-[#777777] dark:text-slate-400 font-sans">
 {group.billingCycle === 'monthly'
 ? t.perMonth
 : ''}
 </span>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </section>
 );
 })}
 </div>

 {/* Right Column: Sticky Summary Card */}
 <aside className="lg:col-span-4 lg:sticky lg:top-5">
 <div className="rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-white dark:bg-[#161b22] overflow-hidden">
 <div className="px-4 py-3 border-b border-[#E2E6E1] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#1b222c] flex items-center justify-between">
 <h2 className="text-sm sm:text-[15px] font-bold text-[#0E5F3F] dark:text-emerald-400">
 {t.summaryTitle}
 </h2>
 <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-[2px] bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-700 text-[#333333] dark:text-slate-300">
 {summary.totalSelectedCount}
 </span>
 </div>

 {/* Totals Box */}
 <div className="p-4 border-b border-[#E2E6E1] dark:border-slate-800 grid grid-cols-2 gap-3">
 <div className="rounded-[2px] border border-[#0E5F3F]/25 dark:border-emerald-800/60 bg-[#EAF5F0] dark:bg-[#0E5F3F]/15 p-3">
 <div className="text-[11px] font-bold tracking-wider text-[#0E5F3F] dark:text-emerald-400">
 {t.monthlyTotal}
 </div>
 <div className="mt-1 font-mono text-xl font-bold text-[#222222] dark:text-white">
 {formatBdt(summary.monthlyTotal)}
 <span className="text-[11px] font-normal text-[#555555] dark:text-slate-400 ml-0.5 font-sans">
 {t.perMonth}
 </span>
 </div>
 </div>

 <div className="rounded-[2px] border border-[#D5DBD3] dark:border-slate-700 bg-[#F9FAF8] dark:bg-[#12161c] p-3">
 <div className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400">
 {t.oneTimeTotal}
 </div>
 <div className="mt-1 font-mono text-xl font-bold text-[#222222] dark:text-white">
 {formatBdt(summary.oneTimeTotal)}
 </div>
 </div>
 </div>

 {/* Selected Features List */}
 <div className="p-4">
 <div className="text-[11px] font-bold tracking-wider text-[#555555] dark:text-slate-400 mb-2.5">
 {t.selectedFeatures}
 </div>

 {summary.totalSelectedCount === 0 ? (
 <div className="py-6 px-3 text-center rounded-[2px] border border-dashed border-[#CCCCCC] dark:border-slate-700 text-xs text-[#666666] dark:text-slate-400">
 {t.noItemsSelected}
 </div>
 ) : (
 <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
 {summary.selectedMonthly.length > 0 && (
 <div>
 <div className="text-[10.5px] font-bold tracking-wide text-[#0E5F3F] dark:text-emerald-400 mb-1.5">
 {t.monthlySection}
 </div>
 <ul className="divide-y divide-[#ECEFEA] dark:divide-slate-800/80 text-xs">
 {summary.selectedMonthly.map(({ item }) => (
 <li
 key={item.id}
 className="py-1.5 flex items-center justify-between gap-2"
 >
 <span className="flex items-center gap-1.5 text-[#333333] dark:text-slate-200 min-w-0">
 <Check className="h-3.5 w-3.5 text-[#0E5F3F] dark:text-emerald-400 shrink-0"/>
 <span className="truncate font-medium">
 {item.name[lang]}
 </span>
 </span>
 <span className="font-mono font-semibold text-[#222222] dark:text-white shrink-0">
 {formatBdt(item.price)}
 </span>
 </li>
 ))}
 </ul>
 </div>
 )}

 {summary.selectedOneTime.length > 0 && (
 <div className="pt-2 border-t border-[#E2E6E1] dark:border-slate-800">
 <div className="text-[10.5px] font-bold tracking-wide text-[#555555] dark:text-slate-400 mb-1.5">
 {t.oneTimeSection}
 </div>
 <ul className="divide-y divide-[#ECEFEA] dark:divide-slate-800/80 text-xs">
 {summary.selectedOneTime.map(({ item }) => (
 <li
 key={item.id}
 className="py-1.5 flex items-center justify-between gap-2"
 >
 <span className="flex items-center gap-1.5 text-[#333333] dark:text-slate-200 min-w-0">
 <Check className="h-3.5 w-3.5 text-[#0E5F3F] dark:text-emerald-400 shrink-0"/>
 <span className="truncate font-medium">
 {item.name[lang]}
 </span>
 </span>
 <span className="font-mono font-semibold text-[#222222] dark:text-white shrink-0">
 {formatBdt(item.price)}
 </span>
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Action Buttons */}
 <div className="px-4 py-3.5 border-t border-[#E2E6E1] dark:border-slate-800 bg-[#F9FAF8] dark:bg-[#1b222c]/60 space-y-2">
 <button
 type="button"
 disabled={summary.totalSelectedCount === 0}
 onClick={() => {
 setQuoteSubmitted(false);
 setQuoteModalOpen(true);
 }}
 className="w-full h-10 px-4 rounded-[2px] bg-[#0E5F3F] hover:bg-[#0A4D33] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
 >
 <Send className="h-4 w-4"/>
 <span>{t.requestQuote}</span>
 </button>

 <button
 type="button"
 disabled={summary.totalSelectedCount === 0}
 onClick={handleCopyBreakdown}
 className="w-full h-9 px-3 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#12161c] hover:border-[#0E5F3F] hover:text-[#0E5F3F] dark:hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-[#333333] dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
 >
 {copied ? (
 <>
 <Check className="h-3.5 w-3.5 text-[#0E5F3F] dark:text-emerald-400"/>
 <span>{t.copied}</span>
 </>
 ) : (
 <>
 <Copy className="h-3.5 w-3.5"/>
 <span>{t.copyBreakdown}</span>
 </>
 )}
 </button>
 </div>
 </div>
 </aside>
 </div>
 </div>
 );

 const modalsAndMobileBar = (
 <>
 {/* Mobile Fixed Bottom Summary Bar */}
 <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-[#161b22] border-t border-[#D5DBD3] dark:border-slate-800 px-4 py-2.5 shadow-lg">
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0">
 <div className="flex items-baseline gap-1.5">
 <span className="text-[11px] font-semibold text-[#555555] dark:text-slate-400">
 {t.monthlyTotal}:
 </span>
 <span className="font-mono text-base font-bold text-[#0E5F3F] dark:text-emerald-400">
 {formatBdt(summary.monthlyTotal)}
 <span className="text-[10.5px] font-normal font-sans">
 {t.perMonth}
 </span>
 </span>
 </div>
 <div className="flex items-baseline gap-1.5 mt-0.5">
 <span className="text-[11px] text-[#555555] dark:text-slate-400">
 {t.oneTimeTotal}:
 </span>
 <span className="font-mono text-xs font-bold text-[#333333] dark:text-slate-200">
 {formatBdt(summary.oneTimeTotal)}
 </span>
 </div>
 </div>

 <button
 type="button"
 disabled={summary.totalSelectedCount === 0}
 onClick={() => {
 setQuoteSubmitted(false);
 setQuoteModalOpen(true);
 }}
 className="h-10 px-4 rounded-[2px] bg-[#0E5F3F] hover:bg-[#0A4D33] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
 >
 <Send className="h-3.5 w-3.5"/>
 <span>{t.requestQuote}</span>
 </button>
 </div>
 </div>

 {/* Request Quote Modal */}
 {quoteModalOpen && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 overflow-y-auto"
 onClick={() => setQuoteModalOpen(false)}
 >
 <div
 className="w-full max-w-lg rounded-[4px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#161b22] shadow-xl overflow-hidden"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="px-5 py-3.5 border-b border-[#E2E6E1] dark:border-slate-800 bg-[#F5F7F4] dark:bg-[#1b222c] flex items-center justify-between">
 <div>
 <h3 className="text-sm font-bold text-[#0E5F3F] dark:text-emerald-400">
 {t.modalTitle}
 </h3>
 <p className="text-[11.5px] text-[#555555] dark:text-slate-400 mt-0.5">
 {t.modalSubtitle}
 </p>
 </div>
 <button
 type="button"
 onClick={() => setQuoteModalOpen(false)}
 className="p-1 rounded-[2px] text-[#555555] hover:text-[#222222] dark:text-slate-400 dark:hover:text-white cursor-pointer"
 aria-label="Close modal"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>

 {quoteSubmitted ? (
 <div className="p-6 text-center space-y-3">
 <div className="mx-auto h-11 w-11 rounded-full bg-[#EAF5F0] dark:bg-[#0E5F3F]/25 text-[#0E5F3F] dark:text-emerald-400 flex items-center justify-center">
 <Check className="h-6 w-6"/>
 </div>
 <h4 className="text-base font-bold text-[#222222] dark:text-white">
 {t.quoteSubmittedTitle}
 </h4>
 <p className="text-xs text-[#555555] dark:text-slate-400 max-w-sm mx-auto">
 {t.quoteSubmittedDesc}
 </p>
 <div className="rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-[#F9FAF8] dark:bg-[#12161c] p-3 text-xs space-y-1">
 <div className="flex justify-between">
 <span className="text-[#555555] dark:text-slate-400">
 {t.monthlyTotal}
 </span>
 <span className="font-mono font-bold text-[#0E5F3F] dark:text-emerald-400">
 {formatBdt(summary.monthlyTotal)}
 {t.perMonth}
 </span>
 </div>
 <div className="flex justify-between">
 <span className="text-[#555555] dark:text-slate-400">
 {t.oneTimeTotal}
 </span>
 <span className="font-mono font-bold text-[#222222] dark:text-white">
 {formatBdt(summary.oneTimeTotal)}
 </span>
 </div>
 </div>
 <button
 type="button"
 onClick={() => setQuoteModalOpen(false)}
 className="mt-2 h-9 px-5 rounded-[2px] bg-[#0E5F3F] hover:bg-[#0A4D33] text-white text-xs font-semibold cursor-pointer"
 >
 {t.done}
 </button>
 </div>
 ) : (
 <form onSubmit={handleQuoteSubmit} className="p-5 space-y-3.5">
 <div className="rounded-[2px] border border-[#D5DBD3] dark:border-slate-800 bg-[#F9FAF8] dark:bg-[#12161c] p-3 flex items-center justify-between text-xs">
 <div>
 <span className="text-[#555555] dark:text-slate-400 block">
 {t.monthlyTotal}
 </span>
 <span className="font-mono text-base font-bold text-[#0E5F3F] dark:text-emerald-400">
 {formatBdt(summary.monthlyTotal)}
 {t.perMonth}
 </span>
 </div>
 <div className="text-right">
 <span className="text-[#555555] dark:text-slate-400 block">
 {t.oneTimeTotal}
 </span>
 <span className="font-mono text-base font-bold text-[#222222] dark:text-white">
 {formatBdt(summary.oneTimeTotal)}
 </span>
 </div>
 </div>

 <div>
 <label className="block text-xs font-semibold text-[#333333] dark:text-slate-200 mb-1">
 {t.companyLabel} *
 </label>
 <input
 type="text"
 required
 value={quoteForm.company}
 onChange={(e) =>
 setQuoteForm({ ...quoteForm, company: e.target.value })
 }
 placeholder={t.companyPlaceholder}
 className="w-full h-9 px-3 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#12161c] text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
 />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-semibold text-[#333333] dark:text-slate-200 mb-1">
 {t.contactLabel} *
 </label>
 <input
 type="text"
 required
 value={quoteForm.contact}
 onChange={(e) =>
 setQuoteForm({
 ...quoteForm,
 contact: e.target.value,
 })
 }
 placeholder={t.contactPlaceholder}
 className="w-full h-9 px-3 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#12161c] text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
 />
 </div>
 <div>
 <label className="block text-xs font-semibold text-[#333333] dark:text-slate-200 mb-1">
 {t.phoneLabel} *
 </label>
 <input
 type="tel"
 required
 value={quoteForm.phone}
 onChange={(e) =>
 setQuoteForm({
 ...quoteForm,
 phone: e.target.value,
 })
 }
 placeholder={t.phonePlaceholder}
 className="w-full h-9 px-3 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#12161c] text-xs font-mono text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
 />
 </div>
 </div>

 <div>
 <label className="block text-xs font-semibold text-[#333333] dark:text-slate-200 mb-1">
 {t.emailLabel}
 </label>
 <input
 type="email"
 value={quoteForm.email}
 onChange={(e) =>
 setQuoteForm({ ...quoteForm, email: e.target.value })
 }
 placeholder={t.emailPlaceholder}
 className="w-full h-9 px-3 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#12161c] text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#0E5F3F]"
 />
 </div>

 <div className="pt-2 flex items-center justify-end gap-2">
 <button
 type="button"
 onClick={() => setQuoteModalOpen(false)}
 className="h-9 px-4 rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#12161c] text-xs font-semibold text-[#333333] dark:text-slate-200 hover:bg-[#F5F7F4] dark:hover:bg-slate-800 cursor-pointer"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="h-9 px-4 rounded-[2px] bg-[#0E5F3F] hover:bg-[#0A4D33] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
 >
 <Send className="h-3.5 w-3.5"/>
 <span>{t.submitQuote}</span>
 </button>
 </div>
 </form>
 )}
 </div>
 </div>
 )}
 </>
 );

 if (isAuthenticated) {
 return (
 <AppLayout
 title={t.pageTitle}
 subtitle={t.subtitle}
 actions={headerControls}
 >
 <Head title={`${t.pageTitle} — Sales Portal SaaS`} />
 {pricingBody}
 {modalsAndMobileBar}
 </AppLayout>
 );
 }

 return (
 <div className="min-h-screen w-full bg-[#EAECE9] dark:bg-[#0f1318] text-[#333333] dark:text-slate-100 pb-24 lg:pb-10 transition-colors">
 <Head title={`${t.pageTitle} — Sales Portal SaaS`} />

 <header className="w-full bg-[#F5F7F4] dark:bg-[#151a22] border-b border-[#D5DBD3] dark:border-slate-800">
 <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
 <div className="min-w-0">
 <div className="flex items-center gap-2.5 flex-wrap">
 <h1 className="text-xl sm:text-2xl font-bold text-[#0E5F3F] dark:text-emerald-400 tracking-tight">
 {t.pageTitle}
 </h1>
 <Link
 href="/"
 className="text-xs font-medium text-[#555555] dark:text-slate-400 hover:text-[#0E5F3F] dark:hover:text-emerald-400 underline underline-offset-2"
 >
 {t.backHome}
 </Link>
 </div>
 <p className="mt-1 text-xs sm:text-[13px] text-[#555555] dark:text-slate-400 max-w-3xl leading-relaxed">
 {t.subtitle}
 </p>
 </div>
 {headerControls}
 </div>
 </header>

 <main>{pricingBody}</main>
 {modalsAndMobileBar}
 </div>
 );
}

