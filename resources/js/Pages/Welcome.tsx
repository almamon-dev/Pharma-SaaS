import { useEffect, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { Check, Languages, UserCog } from 'lucide-react';
import { SharedPageProps } from '@/types';

interface PlanModule {
    id: number;
    key: string;
    name: string;
}

interface PlanSummary {
    id: number;
    key: string;
    name: string;
    name_bn?: string | null;
    description?: string | null;
    description_bn?: string | null;
    monthly_price?: number | string | null;
    annual_price?: number | string | null;
    price_monthly?: number | string | null;
    price_yearly?: number | string | null;
    max_branches?: number;
    max_users?: number;
    max_medicines?: number;
    features?: string[] | null;
    features_bn?: string[] | null;
    modules?: PlanModule[];
    badge?: string | null;
}

interface WelcomeProps {
    plans?: PlanSummary[];
    demoRoles?: any[];
}

interface RoleDemoItem {
    id: string;
    roleKey: string;
    titleBn: string;
    titleEn: string;
    subtitleBn: string;
    subtitleEn: string;
    descriptionBn?: string | null;
    descriptionEn?: string | null;
    email: string;
    tagsBn: string[];
    tagsEn: string[];
    canDoBn: string[];
    canDoEn: string[];
    cannotDoBn: string[];
    cannotDoEn: string[];
}

const roleDemoItems: RoleDemoItem[] = [
    {
        id: 'owner',
        roleKey: 'admin',
        titleBn: 'মালিক / অ্যাডমিন',
        titleEn: 'Owner / Admin',
        subtitleBn: 'সব শাখা ও রিপোর্ট',
        subtitleEn: 'All branches & reports',
        email: 'admin@pharmacore.test',
        tagsBn: ['ড্যাশবোর্ড', 'শাখা ব্যবস্থাপনা', 'কর্মী ও রোল', 'রিপোর্ট', 'সাবস্ক্রিপশন'],
        tagsEn: ['Dashboard', 'Branch Management', 'Staff & Roles', 'Reports', 'Subscription'],
        canDoBn: [
            'সব শাখার বিক্রি এক পর্দায় দেখুন',
            'নতুন কর্মী ও রোল বানান',
            'মুনাফা ও স্টকের রিপোর্ট খুলুন',
        ],
        canDoEn: [
            'Monitor multi-branch revenue on one screen',
            'Create staff members and assign custom roles',
            'Inspect gross profit and dead stock reports',
        ],
        cannotDoBn: [
            'অন্য ব্যবসার ডেটা দেখা যায় না',
            'বিলিং তথ্য ডেমোতে লুকানো',
        ],
        cannotDoEn: [
            'Other subscriber tenant data is isolated',
            'Billing & payment gateway keys hidden in demo',
        ],
    },
    {
        id: 'pharmacist',
        roleKey: 'pharmacist',
        titleBn: 'ফার্মাসিস্ট',
        titleEn: 'Pharmacist',
        subtitleBn: 'প্রেসক্রিপশন ও ডিসপেনসিং',
        subtitleEn: 'Prescriptions & dispensing',
        email: 'pharmacist@pharmacore.test',
        tagsBn: ['প্রেসক্রিপশন ভেরিফিকেশন', 'FEFO স্টক', 'ওষুধ ডিসপেনসিং', 'অ্যালার্জি চেক'],
        tagsEn: ['Prescription Verification', 'FEFO Stock', 'Medicine Dispensing', 'Allergy Alerts'],
        canDoBn: [
            'কাউন্টারে প্রেসক্রিপশন-অনলি ওষুধ অনুমোদন',
            'রোগীর অ্যালার্জি ও ড্রাগ রিয়েকশন যাচাই',
            'ব্যাচ মেয়াদ ও FEFO অগ্রাধিকার পর্যবেক্ষণ',
        ],
        canDoEn: [
            'Approve and dispense prescription-only drugs',
            'Verify patient allergy notes and contraindications',
            'Track nearest expiry batches with FEFO priority',
        ],
        cannotDoBn: [
            'পাইকারি ক্রয়মূল্য বা মার্জিন দেখতে পারবে না',
            'সিস্টেম সেটিং ও ব্রাঞ্চ কনফিগারেশন বন্ধ',
        ],
        cannotDoEn: [
            'Wholesale COGS purchase cost is concealed',
            'Business settings and branch setup are locked',
        ],
    },
    {
        id: 'cashier',
        roleKey: 'cashier',
        titleBn: 'ক্যাশিয়ার',
        titleEn: 'Cashier',
        subtitleBn: 'দ্রুত বিক্রি ও বিল',
        subtitleEn: 'Fast counter & billing',
        email: 'cashier@pharmacore.test',
        tagsBn: ['দ্রুত POS টার্মিনাল', 'বারকোড স্ক্যান', 'ক্যাশ ও ওয়ালেট', 'রসিদ প্রিন্ট'],
        tagsEn: ['Fast POS Terminal', 'Barcode Scan', 'Cash & Mobile Wallet', 'Receipt Print'],
        canDoBn: [
            'বারকোড স্ক্যান করে সেকেন্ডে বিল তৈরি',
            'ক্যাশ, কার্ড ও বিকাশ/নগদ পেমেন্ট কালেকশন',
            'রেজিস্টার্ড ও ওয়াক-ইন গ্রাহক বিলিং',
        ],
        canDoEn: [
            'Sub-second barcode scan & instant checkout',
            'Collect Cash, Card, bKash & Nagad payments',
            'Serve walk-in and loyalty CRM customers',
        ],
        cannotDoBn: [
            'ইনভয়েস মুছে ফেলা বা রিফান্ড সরাসরি বন্ধ',
            'স্টক সমন্বয় ও ব্যাকডেটেড ডিসকাউন্ট ব্লক',
        ],
        cannotDoEn: [
            'Cannot delete sales invoices or issue unapproved refunds',
            'Stock adjustments and bulk price changes blocked',
        ],
    },
    {
        id: 'salesman',
        roleKey: 'salesman',
        titleBn: 'সেলসম্যান',
        titleEn: 'Salesman',
        subtitleBn: 'সেলস অর্ডার ও ট্র্যাকিং',
        subtitleEn: 'Sales orders & tracking',
        email: 'salesman@pharmacore.test',
        tagsBn: ['সেলস অর্ডার', 'ওষুধ সার্চ', 'প্রেসক্রিপশন আপলোড', 'অর্ডার ট্র্যাকিং'],
        tagsEn: ['Sales Orders', 'Medicine Search', 'Prescription Upload', 'Order Tracking'],
        canDoBn: [
            'গ্রাহকের জন্য দ্রুত সেলস অর্ডার তৈরি',
            'বারকোড স্ক্যান ও প্রেসক্রিপশন আপলোড',
            'কাউন্টার অ্যাসাইনমেন্ট ও অর্ডারের লাইভ ট্র্যাকিং',
        ],
        canDoEn: [
            'Create sales orders for customers instantly',
            'Scan barcodes and upload prescriptions',
            'Track automatic counter routing in real time',
        ],
        cannotDoBn: [
            'ক্যাশ ড্রয়ার বা পেমেন্ট কালেকশন বন্ধ',
            'স্টক সমন্বয় ও পাইকারি ক্রয়মূল্য লকড',
        ],
        cannotDoEn: [
            'Direct cash collection & drawer register locked',
            'Stock adjustments and cost pricing concealed',
        ],
    },
    {
        id: 'manager',
        roleKey: 'manager',
        titleBn: 'ব্রাঞ্চ ম্যানেজার',
        titleEn: 'Branch Manager',
        subtitleBn: 'শাখা নিয়ন্ত্রণ ও ইনভেন্টরি',
        subtitleEn: 'Branch control & inventory',
        email: 'manager@pharmacore.test',
        tagsBn: ['শাখা ড্যাশবোর্ড', 'ইনভেন্টরি রিস্টক', 'স্টক মুভমেন্ট', 'দৈনিক রিপোর্ট'],
        tagsEn: ['Branch Dashboard', 'Inventory Restock', 'Stock Movements', 'Daily Ledger'],
        canDoBn: [
            'শাখার দৈনিক বিক্রি ও ক্যাশ ড্রয়ার মিলানো',
            'নতুন ব্যাচ স্টক-ইন ও সরবরাহকারী চালান এন্ট্রি',
            'মেয়াদোত্তীর্ণ ও ড্যামেজ ওষুধ নিষ্পত্তির আবেদন',
        ],
        canDoEn: [
            'Reconcile daily counter cash and branch register',
            'Record purchase shipments and restock batches',
            'Initiate damaged and near-expiry returns to vendor',
        ],
        cannotDoBn: [
            'অন্য শাখার গোপনীয় ক্যাশ লেজার দেখা যায় না',
            'প্ল্যাটফর্মের সাবস্ক্রিপশন পরিবর্তন বন্ধ',
        ],
        cannotDoEn: [
            'Cannot view cash balances of other branches',
            'Cannot alter master SaaS subscription plan',
        ],
    },
    {
        id: 'clerk',
        roleKey: 'inventory_clerk',
        titleBn: 'ইনভেন্টরি ক্লার্ক',
        titleEn: 'Inventory Clerk',
        subtitleBn: 'স্টক ইনটেক ও সরবরাহকারী',
        subtitleEn: 'Stock intake & suppliers',
        email: 'clerk@pharmacore.test',
        tagsBn: ['স্টক ইনটেক', 'ব্যাচ ট্র্যাকার', 'সাপ্লায়ার', 'লট ট্র্যাকিং'],
        tagsEn: ['Stock Intake', 'Batch Tracker', 'Suppliers', 'Lot Tracking'],
        canDoBn: [
            'নতুন ওষুধ ব্যাচ ও সরবরাহকারী চালান এন্ট্রি',
            'মেয়াদোত্তীর্ণ ও ড্যামেজ ওষুধের স্টক ট্র্যাকিং',
            'সাপ্লায়ার ডিরেক্টরি ও ডেলিভারি চালান সংরক্ষণ',
        ],
        canDoEn: [
            'Record purchase delivery shipments and stock-in batches',
            'Monitor FEFO expiry dates and defective lot disposal',
            'Maintain vendor directory and delivery notes',
        ],
        cannotDoBn: [
            'বিক্রি রাজস্ব বা লাভের মার্জিন দেখা যায় না',
            'সাবস্ক্রিপশন ও কেন্দ্রীয় সেটিংস বন্ধ',
        ],
        cannotDoEn: [
            'Cannot view retail revenue or net gross margins',
            'SaaS master subscription and company settings locked',
        ],
    },
    {
        id: 'pathologist',
        roleKey: 'manager',
        titleBn: 'প্যাথলজিস্ট',
        titleEn: 'Pathologist',
        subtitleBn: 'টেস্ট ও রিপোর্ট',
        subtitleEn: 'Lab tests & reports',
        email: 'manager@pharmacore.test',
        tagsBn: ['ল্যাব টেস্ট', 'স্যাম্পল কালেকশন', 'টেস্ট রিপোর্ট', 'ডায়াগনস্টিক'],
        tagsEn: ['Lab Tests', 'Sample Collection', 'Test Reports', 'Diagnostics'],
        canDoBn: [
            'প্যাথলজি টেস্ট অর্ডার ও রিপোর্ট এন্ট্রি',
            'রোগীর ডায়াগনস্টিক রিপোর্ট ভেরিফিকেশন',
            'ল্যাব ইনভেন্টরি ও রিএজেন্ট পর্যবেক্ষণ',
        ],
        canDoEn: [
            'Enter lab test orders and diagnostic results',
            'Verify patient clinical pathology reports',
            'Track lab inventory reagents and supplies',
        ],
        cannotDoBn: [
            'ফার্মেসির সামগ্রিক আর্থিক খতিয়ান দেখা যায় না',
            'ওষুধ ক্রয় চালান অনুমোদন বন্ধ',
        ],
        cannotDoEn: [
            'Cannot access pharmacy master financial ledgers',
            'Wholesale drug purchase approvals locked',
        ],
    },
    {
        id: 'radiologist',
        roleKey: 'manager',
        titleBn: 'রেডিওলজিস্ট',
        titleEn: 'Radiologist',
        subtitleBn: 'ইমেজিং ও রিপোর্ট',
        subtitleEn: 'Imaging & diagnostics',
        email: 'manager@pharmacore.test',
        tagsBn: ['এক্স-রে ও আল্ট্রাসনোগ্রাম', 'ইমেজিং রিপোর্ট', 'প্যাকস ভিউয়ার', 'ডায়াগনস্টিক'],
        tagsEn: ['X-Ray & USG', 'Imaging Reports', 'PACS Viewer', 'Diagnostics'],
        canDoBn: [
            'রেডিওলজি ও ইমেজিং রিপোর্ট আপলোড',
            'ডায়াগনস্টিক রোগীর কেস স্টাডি যাচাই',
            'ইমেজিং সরঞ্জাম স্থিতি পর্যবেক্ষণ',
        ],
        canDoEn: [
            'Upload radiology and medical imaging findings',
            'Review diagnostic patient imaging cases',
            'Inspect imaging equipment operational logs',
        ],
        cannotDoBn: [
            'ক্যাশ কাউন্টারের দৈনিক টাকা সংগ্রহ দেখা যায় না',
            'ফার্মেসি স্টক ডিসপোজাল বন্ধ',
        ],
        cannotDoEn: [
            'Cash counter register collections hidden',
            'Pharmacy stock write-offs locked',
        ],
    },
];

interface DefaultPlanItem {
    key: string;
    titleBn: string;
    titleEn: string;
    descBn: string;
    descEn: string;
    priceMonthly: number;
    priceYearlyMonthly: number;
    priceYearlyTotal: number;
    isPopular?: boolean;
    featuresBn: string[];
    featuresEn: string[];
}

const defaultPlanItems: DefaultPlanItem[] = [
    {
        key: 'starter',
        titleBn: 'স্টার্টার ডিসপেনসারি',
        titleEn: 'Starter Dispensary',
        descBn: 'একক ফার্মেসি ও এক শাখার জন্য পিওএস, সিআরএম ও ইনভেন্টরি।',
        descEn: 'Single pharmacy dispensary for rapid counter POS, CRM, and batch inventory.',
        priceMonthly: 29,
        priceYearlyMonthly: 24,
        priceYearlyTotal: 290,
        featuresBn: [
            '১টি ফার্মেসি আউটলেট',
            'সর্বোচ্চ ৩ জন কর্মী',
            'সর্বোচ্চ ১,০০০ ওষুধ ও ব্যাচ',
            'গ্রাহক সিআরএম ও অ্যালার্জি প্রোফাইল',
            'দৈনিক সেলস ও ইনভয়েস',
        ],
        featuresEn: [
            '1 Pharmacy Branch',
            'Up to 3 Staff Accounts',
            '1,000 SKUs & Batches',
            'Patient CRM & Allergy Warnings',
            'Daily Sales & Invoice Printing',
        ],
    },
    {
        key: 'growth',
        titleBn: 'গ্রোথ চেইন',
        titleEn: 'Growth Chain',
        descBn: 'মাল্টি-রোল RBAC ও সরবরাহকারী অটোমেশনসহ একাধিক শাখা পরিচালনা।',
        descEn: 'Multi-branch chain management with granular RBAC and supplier automation.',
        priceMonthly: 79,
        priceYearlyMonthly: 65,
        priceYearlyTotal: 790,
        isPopular: true,
        featuresBn: [
            '৫টি ফার্মেসি শাখা ও আউটলেট',
            'সর্বোচ্চ ১৫ জন কর্মী ও ক্যাশিয়ার',
            '১০,০০০ ওষুধ ও স্বয়ংক্রিয় FEFO',
            'আন্তঃশাখা স্টক স্থানান্তর',
            'কাস্টম রোল ও কর্মী নিয়োগ',
            'সরবরাহকারী ডিরেক্টরি ও কমপ্লায়েন্স অডিট',
        ],
        featuresEn: [
            'Up to 5 Outlets',
            '15 Staff Accounts',
            '10,000 SKUs & Automated FEFO',
            'Inter-Branch Stock Transfers',
            'Custom Permission Matrices',
            'Supplier Ledger & Audits',
        ],
    },
    {
        key: 'enterprise',
        titleBn: 'এন্টারপ্রাইজ হসপিটাল',
        titleEn: 'Enterprise Hospital',
        descBn: 'ডেডিকেটেড কমপ্লায়েন্স কন্ট্রোলসহ সীমাহীন ব্যবসা ও শাখা।',
        descEn: 'Unlimited business tenants, hospital dispensing compliance, and audit exports.',
        priceMonthly: 199,
        priceYearlyMonthly: 165,
        priceYearlyTotal: 1990,
        featuresBn: [
            'সীমাহীন ফার্মেসি ব্যবসা ও শাখা',
            'সীমাহীন কর্মী ও কাউন্টার টার্মিনাল',
            'সীমাহীন ওষুধ, ব্যাচ ও মুভমেন্ট লগ',
            '২৪/৭ অগ্রাধিকার সাপোর্ট',
            'লেজার এক্সপোর্ট ও এন্টারপ্রাইজ অডিট',
        ],
        featuresEn: [
            'Unlimited Branches & Tenants',
            'Unlimited Staff & Terminals',
            'Unlimited SKUs & Batch Logs',
            '24/7 Priority SLA Support',
            'Full Ledger Export & Audit',
        ],
    },
];

export default function Welcome({ plans = [], demoRoles = [] }: WelcomeProps) {
    const { auth, tenancy } = usePage<SharedPageProps>().props;
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [activeRoleId, setActiveRoleId] = useState<string>('owner');
    const [lang, setLang] = useState<'bn' | 'en'>('bn');
    const [heroTab, setHeroTab] = useState<'demo' | 'trial'>('demo');
    const [isEnteringDemo, setIsEnteringDemo] = useState(false);

    const displayRoles: RoleDemoItem[] = (demoRoles && demoRoles.length > 0)
        ? demoRoles.map((r: any) => ({
            id: r.role_id,
            roleKey: r.role_key,
            titleBn: r.title_bn || r.title_en,
            titleEn: r.title_en,
            subtitleBn: r.subtitle_bn || r.subtitle_en,
            subtitleEn: r.subtitle_en,
            descriptionBn: r.description_bn || r.description_en,
            descriptionEn: r.description_en,
            email: r.email,
            tagsBn: r.tags_bn || r.tags_en || [],
            tagsEn: r.tags_en || [],
            canDoBn: r.features_bn || r.features_en || [],
            canDoEn: r.features_en || [],
            cannotDoBn: r.restrictions_bn || r.restrictions_en || [],
            cannotDoEn: r.restrictions_en || [],
        }))
        : roleDemoItems;

    const activeRole = displayRoles.find((r) => r.id === activeRoleId) || displayRoles[0];

    useEffect(() => {
        // Reset loading state on mount and when returning from bfcache (browser back/forward)
        setIsEnteringDemo(false);
        const handlePageShow = () => {
            setIsEnteringDemo(false);
        };
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, []);

    const enterDemo = (email: string, roleKey?: string) => {
        setIsEnteringDemo(true);
        // Safety timeout: automatically reset spinner if navigation takes longer than 4s or fails
        setTimeout(() => setIsEnteringDemo(false), 4000);

        const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        const isIpOrLocal = currentHost === 'localhost' || currentHost === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(currentHost);

        const selectedRole = roleKey || activeRoleId;

        if (selectedRole === 'superadmin' || selectedRole === 'super_admin') {
            window.location.href = '/login';
            return;
        }

        let targetUrl: string;

        if (isIpOrLocal) {
            targetUrl = `/demo/enter?role=${encodeURIComponent(selectedRole)}&email=${encodeURIComponent(email)}`;
        } else {
            const scheme = tenancy?.scheme || (typeof window !== 'undefined' ? window.location.protocol.replace(':', '') : 'http');
            const portSuffix = tenancy?.portSuffix || (typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '');
            const baseDomain = tenancy?.baseDomain || currentHost;
            const targetHost = `demo.${baseDomain}`;

            targetUrl = `${scheme}://${targetHost}${portSuffix}/demo/enter?role=${encodeURIComponent(selectedRole)}&email=${encodeURIComponent(email)}`;
        }

        window.location.href = targetUrl;
    };

    const isBn = lang === 'bn';

    return (
        <div className="min-h-screen bg-[#0e1217] text-slate-100 font-sans antialiased selection:bg-[#FF4A1C] selection:text-white overflow-x-hidden no-scrollbar">
            <Head title={isBn ? 'PharmaCore - ডেমো ও ফ্রি ট্রায়াল' : 'PharmaCore - Demo & Free Trial'} />

            {/* Top Amber Demo & Free Trial Notification Banner */}
            <div className="bg-[#2a220e] border-b border-[#4d3c17] text-[#e5b352] text-center text-xs py-1.5 px-4 font-medium flex items-center justify-center gap-2">
                <span>
                    {isBn
                        ? '🎉 নতুন গ্রাহকদের জন্য ১৪ দিনের ফ্রি ট্রায়াল চালু আছে | ১ ক্লিকে ডেমো দেখুন অথবা আপনার ফার্মেসির ট্রায়াল শুরু করুন'
                        : '🎉 14-Day Free Trial available for all pharmacies | Explore instant demo or launch your free trial with zero card requirement'}
                </span>
            </div>

            {/* Main Header / Navigation */}
            <header className="sticky top-0 z-40 bg-[#0e1217]/95 backdrop-blur border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-md bg-[#FF4A1C] flex items-center justify-center text-white font-bold text-lg shadow-sm">
                            +
                        </div>
                        <span className="text-lg font-bold text-white tracking-tight">
                            PharmaCore
                        </span>
                    </Link>

                    <div className="flex items-center gap-2.5">
                        {/* Language Switcher */}
                        <button
                            type="button"
                            onClick={() => setLang(isBn ? 'en' : 'bn')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold text-slate-300 hover:text-white bg-[#161c24] border border-slate-700/60 transition-colors cursor-pointer"
                        >
                            <Languages className="h-3.5 w-3.5 text-[#FF4A1C]" />
                            <span>{isBn ? 'English' : 'বাংলা'}</span>
                        </button>

                        {auth?.user ? (
                            <Link
                                href={auth.user.is_super_admin ? route('admin.dashboard') : route('dashboard')}
                                className="h-8 px-3.5 rounded bg-[#FF4A1C] hover:bg-[#e03e15] text-white text-xs font-bold inline-flex items-center transition-colors shadow-sm"
                            >
                                {isBn ? 'ড্যাশবোর্ড' : 'Dashboard'}
                            </Link>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => enterDemo('admin@pharmacore.test', 'admin')}
                                    className="h-8 px-3 rounded bg-[#1c232c] hover:bg-[#252f3b] text-slate-200 border border-slate-700/60 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>{isBn ? 'ডেমো দেখুন' : 'Live Demo'}</span>
                                </button>
                                <Link
                                    href={route('login')}
                                    className="h-8 px-2.5 rounded text-slate-300 hover:text-white text-xs font-semibold inline-flex items-center transition-colors"
                                >
                                    {isBn ? 'সাইন ইন' : 'Sign In'}
                                </Link>
                                <Link
                                    href={route('register')}
                                    className="h-8 px-3.5 rounded bg-[#FF4A1C] hover:bg-[#e03e15] text-white text-xs font-bold inline-flex items-center transition-colors shadow-sm"
                                >
                                    {isBn ? '১৪ দিন ফ্রি ট্রায়াল' : '14-Day Free Trial'}
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero Section: Two Options - Instant Demo & 14-Day Free Trial */}
            <section className="px-4 sm:px-6 lg:px-8 pt-10 pb-16 lg:pt-14 lg:pb-20 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    {/* Left Hero Pitch */}
                    <div className="lg:col-span-7">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#1c232c] border border-slate-700/60 text-[#FF4A1C] text-[11px] font-bold uppercase tracking-wider mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF4A1C] animate-ping" />
                            <span>{isBn ? 'স্মার্ট ফার্মেসি ক্লাউড ম্যানেজমেন্ট ও পিওএস' : 'SMART PHARMACY CLOUD SAAS'}</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4 tracking-tight">
                            {isBn ? (
                                <>দুটো সহজ উপায়ে শুরু করুন:<br /><span className="text-[#FF4A1C]">লাইভ ডেমো</span> অথবা <span className="text-emerald-400">ফ্রি ট্রায়াল</span></>
                            ) : (
                                <>Start in Two Easy Ways:<br /><span className="text-[#FF4A1C]">Live Demo</span> or <span className="text-emerald-400">Free Trial</span></>
                            )}
                        </h1>
                        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-6 max-w-xl">
                            {isBn
                                ? 'কোনো রেজিস্ট্রেশন ছাড়াই ১ ক্লিকে নমুনা ডেটা দিয়ে পুরো সিস্টেম ঘুরে দেখুন, অথবা আপনার নিজস্ব ফার্মেসির জন্য শুরু করুন ১৪ দিনের ফ্রি ট্রায়াল (০ টাকা, কোনো কার্ড লাগবে না)।'
                                : 'Explore the full system in 1-click with pre-loaded sample data, or start a 14-day free trial for your own pharmacy workspace ($0, no credit card required).'}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 mb-6">
                            <Link
                                href={route('register')}
                                className="h-11 px-5 rounded-md bg-[#FF4A1C] hover:bg-[#e03e15] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors shadow-lg cursor-pointer"
                            >
                                <span>🚀</span>
                                <span>{isBn ? '১৪ দিনের ফ্রি ট্রায়াল শুরু' : 'Start 14-Day Free Trial'}</span>
                            </Link>
                            <button
                                type="button"
                                disabled={isEnteringDemo}
                                onClick={() => enterDemo('admin@pharmacore.test', 'admin')}
                                className="h-11 px-5 rounded-md bg-[#161c24] hover:bg-[#1e2632] text-slate-200 border border-slate-700/80 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                            >
                                <span>⚡</span>
                                <span>{isBn ? 'ইনস্ট্যান্ট ডেমো খুলুন' : 'Open Instant Demo'}</span>
                            </button>
                            <a
                                href="#compare"
                                className="h-11 px-4 rounded-md text-slate-400 hover:text-white text-xs sm:text-sm font-medium inline-flex items-center justify-center transition-colors"
                            >
                                {isBn ? 'পার্থক্য দেখুন ↓' : 'Compare Options ↓'}
                            </a>
                        </div>

                        {/* Trust Points */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-400">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {isBn ? 'কার্ড লাগবে না' : 'No credit card required'}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {isBn ? '১৪ দিন সম্পূর্ণ ফ্রি' : '14 days 100% free'}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {isBn ? '১ ক্লিকে ডেমো টেস্ট' : '1-click instant demo'}
                            </span>
                        </div>
                    </div>

                    {/* Right Hero Interactive 2-Option Card */}
                    <div className="lg:col-span-5">
                        <div className="rounded-xl border border-slate-800 bg-[#161c24] p-5 sm:p-6 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4A1C]/5 rounded-full blur-2xl pointer-events-none" />

                            {/* Two Options Segmented Switcher */}
                            <div className="w-full grid grid-cols-2 p-1.5 rounded-xl bg-[#0b0f14] border border-slate-800/90 mb-5 gap-1.5 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setHeroTab('demo')}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 select-none ${
                                        heroTab === 'demo'
                                            ? 'bg-[#1e2632] text-white shadow border border-slate-700/80 ring-1 ring-slate-700/50'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#141b24]/60 border border-transparent'
                                    }`}
                                >
                                    <span>⚡</span>
                                    <span className="truncate">{isBn ? 'অপশন ১: লাইভ ডেমো' : 'Option 1: Live Demo'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHeroTab('trial')}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 select-none ${
                                        heroTab === 'trial'
                                            ? 'bg-[#FF4A1C] text-white shadow-md shadow-[#FF4A1C]/25 border border-[#ff5f38]'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#141b24]/60 border border-transparent'
                                    }`}
                                >
                                    <span>🚀</span>
                                    <span className="truncate">{isBn ? 'অপশন ২: ফ্রি ট্রায়াল' : 'Option 2: Free Trial'}</span>
                                </button>
                            </div>

                            {heroTab === 'demo' ? (
                                <div>
                                    <h2 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
                                        <span>{isBn ? 'ডেমো অ্যাকাউন্টে ঢুকুন' : 'Access Demo Account'}</span>
                                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-2 py-0.5 rounded">
                                            {isBn ? 'নমুনা ডেটা লাইভ' : 'Sample Data Live'}
                                        </span>
                                    </h2>

                                    <div className="divide-y divide-slate-800/80 text-xs mb-5">
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-slate-400 font-medium">{isBn ? 'ডেমো ব্যবসা' : 'Demo Business'}</span>
                                            <span className="text-white font-semibold font-mono">{isBn ? 'সিটি কেয়ার ফার্মেসি (নমুনা)' : 'City Care Pharmacy (Demo)'}</span>
                                        </div>
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-slate-400 font-medium">{isBn ? 'শাখা' : 'Branches'}</span>
                                            <span className="text-white font-semibold">{isBn ? '৩টি শাখা' : '3 Outlets'}</span>
                                        </div>
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-slate-400 font-medium">{isBn ? 'নমুনা ওষুধ' : 'Sample Medicines'}</span>
                                            <span className="text-white font-semibold">{isBn ? '৫০০+ SKUs' : '500+ SKUs'}</span>
                                        </div>
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-slate-400 font-medium">{isBn ? 'নমুনা রোগী' : 'Sample Patients'}</span>
                                            <span className="text-white font-semibold">{isBn ? '১২০ জন' : '120 Patients'}</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={isEnteringDemo}
                                        onClick={() => enterDemo('admin@pharmacore.test', 'admin')}
                                        className="w-full h-10 rounded-md bg-[#FF4A1C] hover:bg-[#e03e15] text-white font-bold text-xs sm:text-sm flex items-center justify-center transition-colors shadow-lg cursor-pointer disabled:opacity-75"
                                    >
                                        {isEnteringDemo ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                {isBn ? 'ড্যাশবোর্ড লোড হচ্ছে...' : 'Loading Dashboard...'}
                                            </span>
                                        ) : (
                                            isBn ? 'ডেমো ড্যাশবোর্ড খুলুন' : 'Open Demo Dashboard'
                                        )}
                                    </button>

                                    <p className="text-center text-[11px] text-slate-400 mt-2.5">
                                        {isBn
                                            ? 'লগইন তথ্য নিজে থেকে পূরণ হয়ে যাবে। কিছু টাইপ করতে হবে না।'
                                            : 'Login credentials autofilled instantly. No typing required.'}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <h2 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
                                        <span>{isBn ? 'আপনার নিজস্ব ফার্মেসি সেটআপ' : 'Your Own Pharmacy Setup'}</span>
                                        <span className="text-[11px] font-semibold text-[#FF4A1C] bg-[#FF4A1C]/10 border border-[#FF4A1C]/30 px-2 py-0.5 rounded">
                                            {isBn ? '১৪ দিন ফ্রি' : '14 Days Free'}
                                        </span>
                                    </h2>

                                    <div className="divide-y divide-slate-800/80 text-xs mb-5">
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-slate-400 font-medium">{isBn ? 'নিজস্ব সাবডোমেন' : 'Custom Subdomain'}</span>
                                            <span className="text-emerald-400 font-semibold font-mono">{isBn ? 'yourshop.domain' : 'yourshop.domain'}</span>
                                        </div>
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-slate-400 font-medium">{isBn ? 'আসল স্টক ও ইনভেন্টরি' : 'Real Stock & SKUs'}</span>
                                            <span className="text-white font-semibold">{isBn ? 'আপনার দোকানের আসল ওষুধ' : 'Your Real Medicine Catalog'}</span>
                                        </div>
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-slate-400 font-medium">{isBn ? 'পিওএস ও প্রিন্টার' : 'POS & Printing'}</span>
                                            <span className="text-white font-semibold">{isBn ? 'আসল থার্মাল রসিদ ও ক্যাশ' : 'Real Invoices & Thermal Print'}</span>
                                        </div>
                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-slate-400 font-medium">{isBn ? 'ট্রায়াল খরচ' : 'Trial Cost'}</span>
                                            <span className="text-[#FF4A1C] font-bold font-mono">$0 ({isBn ? 'কোনো কার্ড লাগবে না' : 'No card required'})</span>
                                        </div>
                                    </div>

                                    <Link
                                        href={route('register')}
                                        className="w-full h-10 rounded-md bg-[#FF4A1C] hover:bg-[#e03e15] text-white font-bold text-xs sm:text-sm flex items-center justify-center transition-colors shadow-none cursor-pointer"
                                    >
                                        {isBn ? 'আপনার ফার্মেসির ফ্রি ট্রায়াল শুরু করুন' : 'Start Your Pharmacy Free Trial'}
                                    </Link>

                                    <p className="text-center text-[11px] text-slate-400 mt-2.5">
                                        {isBn
                                            ? 'আজকে $০ চার্জ। ১৪ দিন পর পছন্দ হলে সাবস্ক্রিপশন নিতে পারবেন।'
                                            : '$0 today. Subscribe only if you love it after 14 days.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Step 1: Role-Based Explorer Section */}
            <section id="roles" className="px-4 sm:px-6 lg:px-8 py-10 sm:py-12 border-t border-slate-800/80 max-w-7xl mx-auto scroll-mt-14">
                <div className="mb-5 sm:mb-6">
                    <span className="text-[#FF4A1C] text-[11px] font-bold uppercase tracking-wider block mb-0.5">
                        {isBn ? 'ধাপ ১' : 'Step 1'}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-1">
                        {isBn ? 'কোন রোল হিসেবে দেখবেন?' : 'Which Role Do You Want to Explore As?'}
                    </h2>
                    <p className="text-slate-400 text-xs">
                        {isBn
                            ? 'প্রতিটি রোলের মেনু ও পারমিশন আলাদা। বাঁদিকে একটি রোল বেছে নিন।'
                            : 'Every role has isolated menus, actions, and permissions. Pick a role on the left.'}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
                    {/* Left Vertical Role Selector */}
                    <div className="lg:col-span-4 xl:col-span-4 space-y-1.5">
                        {displayRoles.map((item) => {
                            const isSelected = item.id === activeRoleId;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setActiveRoleId(item.id)}
                                    className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-all cursor-pointer ${
                                        isSelected
                                            ? 'border-[#FF4A1C] bg-[#1a1f27] shadow-md ring-1 ring-[#FF4A1F]/30'
                                            : 'border-slate-800/90 bg-[#141920] hover:border-slate-700 hover:bg-[#181e26]'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs font-bold ${isSelected ? 'text-[#FF4A1C]' : 'text-white'}`}>
                                            {isBn ? item.titleBn : item.titleEn}
                                        </span>
                                        {isSelected && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF4A1C] animate-pulse" />
                                        )}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                        {isBn ? item.subtitleBn : item.subtitleEn}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right Role Detail Card (Compact & Modern) */}
                    <div className="lg:col-span-8 xl:col-span-8">
                        <div className="rounded-xl border border-slate-800 bg-[#151a22] p-4 sm:p-5 shadow-xl relative overflow-hidden">
                            {/* Ambient Glow */}
                            <div className="absolute top-0 right-0 w-60 h-60 bg-[#FF4A1C]/5 rounded-full blur-3xl pointer-events-none" />

                            {/* Card Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 flex items-center justify-center text-[#FF4A1C] shrink-0">
                                        <UserCog className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                                                {isBn
                                                    ? `${activeRole.titleBn} হিসেবে ডেমো`
                                                    : `Demo as ${activeRole.titleEn}`}
                                            </h3>
                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-slate-300 bg-[#1f2631] border border-slate-700/60">
                                                {activeRole.roleKey}
                                            </span>
                                        </div>
                                        <p className="text-[11px] font-medium text-[#FF4A1C]">
                                            {isBn ? activeRole.subtitleBn : activeRole.subtitleEn}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-[10px] shrink-0">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/80 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span>{isBn ? 'লাইভ স্যান্ডবক্স' : 'Live Sandbox'}</span>
                                    </span>
                                    <span className="text-slate-400 font-mono hidden sm:inline">
                                        {activeRole.email}
                                    </span>
                                </div>
                            </div>

                            {/* Description (clean text paragraph) */}
                            {(activeRole.descriptionBn || activeRole.descriptionEn) && (
                                <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
                                    {isBn
                                        ? (activeRole.descriptionBn || activeRole.descriptionEn)
                                        : (activeRole.descriptionEn || activeRole.descriptionBn)}
                                </p>
                            )}

                            {/* Tags / Module Badges */}
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                {(isBn ? activeRole.tagsBn : activeRole.tagsEn).map((tag, idx) => (
                                    <span
                                        key={idx}
                                        className="rounded px-2 py-0.5 text-[10px] font-semibold bg-[#1a212b] border border-slate-700/60 text-slate-200"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            {/* Can Do vs Cannot Do (2-Column Sleek Lists) */}
                            <div className="mt-3.5 pt-3.5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Can Do Column */}
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-bold text-[#FF4A1C] uppercase tracking-wider block">
                                        {isBn ? 'যা যা করতে পারবেন' : 'WHAT YOU CAN DO'}
                                    </span>
                                    <ul className="space-y-1">
                                        {(isBn ? activeRole.canDoBn : activeRole.canDoEn).map((point, idx) => (
                                            <li
                                                key={idx}
                                                className="flex items-start gap-1.5 text-xs text-slate-300 leading-snug"
                                            >
                                                <span className="text-[#FF4A1C] font-bold shrink-0 mt-0.5">•</span>
                                                <span>{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Restrictions Column */}
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-bold text-[#FF4A1C] uppercase tracking-wider block">
                                        {isBn ? 'সীমাবদ্ধতা / নিরাপদ অ্যাক্সেস' : 'WHAT IS HIDDEN / RESTRICTED'}
                                    </span>
                                    <ul className="space-y-1">
                                        {(isBn ? activeRole.cannotDoBn : activeRole.cannotDoEn).map((point, idx) => (
                                            <li
                                                key={idx}
                                                className="flex items-start gap-1.5 text-xs text-slate-400 leading-snug"
                                            >
                                                <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                                                <span>{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Bottom Action Footer */}
                            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                <p className="text-[11px] text-slate-400">
                                    {isBn
                                        ? '💡 লগইন তথ্য স্বয়ংক্রিয়ভাবে পূরণ হয়ে সরাসরি ড্যাশবোর্ড চালু হবে।'
                                        : 'Login credentials filled automatically.'}
                                </p>

                                <button
                                    type="button"
                                    disabled={isEnteringDemo}
                                    onClick={() => enterDemo(activeRole.email, activeRole.roleKey)}
                                    className="h-9 px-5 rounded-md bg-[#FF4A1C] hover:bg-[#e03e15] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors shadow-md cursor-pointer disabled:opacity-75 shrink-0"
                                >
                                    {isEnteringDemo ? (
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            {isBn ? 'ঢুকছে...' : 'Entering...'}
                                        </span>
                                    ) : (
                                        <>
                                            <span>🚀</span>
                                            <span>
                                                {isBn
                                                    ? `${activeRole.titleBn} হিসেবে ডেমোতে ঢুকুন`
                                                    : `Enter Demo as ${activeRole.titleEn}`}
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Section: "আসল সিস্টেমের মতোই সব ফিচার" */}
            <section className="px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800/80 max-w-7xl mx-auto">
                <div className="mb-8">
                    <span className="text-[#FF4A1C] text-xs font-bold uppercase tracking-wider block mb-1">
                        {isBn ? 'ডেমোতে যা আছে' : 'Inside the Demo'}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                        {isBn ? 'আসল সিস্টেমের মতোই সব ফিচার' : 'Every Feature Works Just Like the Real System'}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Card 1 */}
                    <div className="rounded-xl border border-slate-800 bg-[#161c24] p-5">
                        <div className="w-6 h-6 rounded bg-[#FF4A1C] text-white font-bold text-xs flex items-center justify-center mb-3">
                            {isBn ? '১' : '1'}
                        </div>
                        <h3 className="text-sm font-bold text-white mb-2">
                            {isBn ? 'নমুনা তথ্য আগে থেকে ভরা' : 'Pre-Populated Sample Data'}
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {isBn
                                ? 'ওষুধ, ব্যাচ, মেয়াদ, রোগী ও গত ৩০ দিনের বিক্রি তৈরি করা আছে। ফাঁকা পর্দা দেখবেন না।'
                                : 'Medicines, batches, expiries, patients, and last 30 days sales are fully populated. No empty screens.'}
                        </p>
                    </div>

                    {/* Card 2 */}
                    <div className="rounded-xl border border-slate-800 bg-[#161c24] p-5">
                        <div className="w-6 h-6 rounded bg-[#FF4A1C] text-white font-bold text-xs flex items-center justify-center mb-3">
                            {isBn ? '২' : '2'}
                        </div>
                        <h3 className="text-sm font-bold text-white mb-2">
                            {isBn ? 'সব কাজ করে দেখা যায়' : 'Everything Can Be Tested Live'}
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {isBn
                                ? 'বিল বানান, ওষুধ যোগ করুন, রিটার্ন করুন, রিপোর্ট খুলুন। যা করবেন তা সত্যিই কাজ করবে।'
                                : 'Generate invoices, add medicines, process sales returns, export reports. Everything executes for real.'}
                        </p>
                    </div>

                    {/* Card 3 */}
                    <div className="rounded-xl border border-slate-800 bg-[#161c24] p-5">
                        <div className="w-6 h-6 rounded bg-[#FF4A1C] text-white font-bold text-xs flex items-center justify-center mb-3">
                            {isBn ? '৩' : '3'}
                        </div>
                        <h3 className="text-sm font-bold text-white mb-2">
                            {isBn ? 'আসল তথ্য নিরাপদ' : 'Production Data is Completely Safe'}
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {isBn
                                ? 'ডেমো আলাদা ডেটা স্পেসে চলে। এখানে কিছু বদলালে কোনো আসল ব্যবসার তথ্যে প্রভাব পড়ে না।'
                                : 'The demo operates in an isolated workspace sandbox. Testing never affects any real subscriber data.'}
                        </p>
                    </div>
                </div>
            </section>

            {/* Section: "৫ মিনিটে যা যা চেষ্টা করবেন" (Guided Tour) */}
            <section id="tour" className="px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800/80 max-w-7xl mx-auto scroll-mt-14">
                <div className="mb-8">
                    <span className="text-[#FF4A1C] text-xs font-bold uppercase tracking-wider block mb-1">
                        {isBn ? 'গাইডেড ট্যুর' : 'Guided Tour'}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                        {isBn ? '৫ মিনিটে যা যা চেষ্টা করবেন' : 'What to Try in 5 Minutes'}
                    </h2>
                    <p className="text-slate-400 text-xs sm:text-sm">
                        {isBn
                            ? 'ডেমোর ভেতরে এই চারটি কাজ ধাপে ধাপে দেখানো হবে।'
                            : 'These four core operational workflows are highlighted step by step in the demo.'}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* Step 1 */}
                    <div className="rounded-xl border border-slate-800 bg-[#161c24] p-5">
                        <div className="w-7 h-7 rounded-full bg-[#FF4A1C] text-white font-bold text-xs flex items-center justify-center mb-3">
                            {isBn ? '১' : '1'}
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1.5">
                            {isBn ? 'বিল বানান' : 'Create an Invoice'}
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {isBn
                                ? 'পিওএসে ওষুধ স্ক্যান করুন। FEFO অনুযায়ী পুরোনো ব্যাচ নিজে বাছাই হবে।'
                                : 'Scan barcode at POS counter. Earliest expiring batch is deducted automatically by FEFO.'}
                        </p>
                    </div>

                    {/* Step 2 */}
                    <div className="rounded-xl border border-slate-800 bg-[#161c24] p-5">
                        <div className="w-7 h-7 rounded-full bg-[#FF4A1C] text-white font-bold text-xs flex items-center justify-center mb-3">
                            {isBn ? '২' : '2'}
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1.5">
                            {isBn ? 'অ্যালার্জি সতর্কতা দেখুন' : 'See Allergy Warning'}
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {isBn
                                ? 'অ্যালার্জি আছে এমন রোগী বেছে নিন। ভুল ওষুধ যোগ করলে সতর্কতা আসবে।'
                                : 'Select a customer with allergy records. The system flashes instant clinical warnings on conflict.'}
                        </p>
                    </div>

                    {/* Step 3 */}
                    <div className="rounded-xl border border-slate-800 bg-[#161c24] p-5">
                        <div className="w-7 h-7 rounded-full bg-[#FF4A1C] text-white font-bold text-xs flex items-center justify-center mb-3">
                            {isBn ? '৩' : '3'}
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1.5">
                            {isBn ? 'মেয়াদ ও স্টক দেখুন' : 'Expiry & Stock Alerts'}
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {isBn
                                ? 'মেয়াদ শেষের কাছাকাছি ব্যাচ ও কম স্টকের তালিকা খুলুন।'
                                : 'Filter medicines by 30/60/90 days near-expiry alerts and minimum reorder stock levels.'}
                        </p>
                    </div>

                    {/* Step 4 */}
                    <div className="rounded-xl border border-slate-800 bg-[#161c24] p-5">
                        <div className="w-7 h-7 rounded-full bg-[#FF4A1C] text-white font-bold text-xs flex items-center justify-center mb-3">
                            {isBn ? '৪' : '4'}
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1.5">
                            {isBn ? 'রিপোর্ট খুলুন' : 'Open Sales & Ledger Reports'}
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {isBn
                                ? 'শাখাভিত্তিক বিক্রি ও লাভের রিপোর্ট দেখুন এবং এক্সপোর্ট করুন।'
                                : 'Review branch-wise daily revenue, gross profit margin, customer dues, and cash drawers.'}
                        </p>
                    </div>
                </div>

                {/* Two-Option Comparison Section */}
                <div id="compare" className="mt-14 scroll-mt-14">
                    <div className="text-center max-w-2xl mx-auto mb-8">
                        <span className="text-[#FF4A1C] text-xs font-bold uppercase tracking-wider block mb-1">
                            {isBn ? 'সিদ্ধান্ত নিন' : 'Choose Your Pathway'}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-2">
                            {isBn ? 'দুইটি অপশনের মধ্যে কোনটি আপনার জন্য সঠিক?' : 'Which Option is Right for You?'}
                        </h3>
                        <p className="text-slate-400 text-xs sm:text-sm">
                            {isBn
                                ? 'সফটওয়্যার শুধু পরীক্ষা করতে চান নাকি দোকানে সরাসরি চালাতে চান—দুটোর জন্যই প্রস্তুত।'
                                : 'Whether you want to test drive features or deploy immediately to your real pharmacy counters.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                        {/* Option 1: Live Demo */}
                        <div className="rounded-xl border border-slate-800 bg-[#141920] p-6 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
                                        ⚡ {isBn ? 'অপশন ১: লাইভ ডেমো' : 'Option 1: Live Demo'}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium">
                                        {isBn ? '১০ সেকেন্ড এক্সেস' : '10s Instant Access'}
                                    </span>
                                </div>

                                <h4 className="text-base font-bold text-white mb-2">
                                    {isBn ? 'সফটওয়্যার ঘুরে দেখা ও পরখ করা' : 'Explore & Test Drive All Features'}
                                </h4>
                                <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                                    {isBn
                                        ? 'কোনো অ্যাকাউন্ট বা ইমেইল ছাড়াই আগে থেকে ভরা নমুনা তথ্য দিয়ে পুরো সিস্টেম নিজের হাতে চালিয়ে দেখুন।'
                                        : 'Sub-second access to fully loaded sample multi-branch data without creating an account.'}
                                </p>

                                <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                                    <li className="flex items-start gap-2">
                                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                        <span>{isBn ? 'কোনো সাইনআপ বা ইমেইল লাগবে না' : 'Zero signup, no email or password needed'}</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                        <span>{isBn ? '৫০০+ নমুনা ওষুধ, ৩টি শাখা ও ১২০ রোগী প্রস্তুত' : '500+ sample medicines, 3 branches & 120 patients pre-loaded'}</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                        <span>{isBn ? 'মালিক, ফার্মাসিস্ট, ক্যাশিয়ার সব রোল টেস্ট করুন' : 'Test Owner, Pharmacist, Cashier & Manager roles'}</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-slate-400">
                                        <span className="text-slate-500 font-bold">•</span>
                                        <span>{isBn ? 'পাবলিক এনভায়রনমেন্ট, প্রতি ২৪ ঘণ্টায় রিসেট হয়' : 'Public shared sandbox, auto-resets every 24 hours'}</span>
                                    </li>
                                </ul>
                            </div>

                            <button
                                type="button"
                                disabled={isEnteringDemo}
                                onClick={() => enterDemo('admin@pharmacore.test', 'admin')}
                                className="w-full h-10 rounded-md bg-[#1e2632] hover:bg-[#283342] text-slate-200 border border-slate-700/80 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer disabled:opacity-75"
                            >
                                {isEnteringDemo ? (
                                    <span className="inline-flex items-center gap-2">
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        {isBn ? 'ড্যাশবোর্ড লোড হচ্ছে...' : 'Loading...'}
                                    </span>
                                ) : (
                                    isBn ? '⚡ ডেমো ড্যাশবোর্ডে ঢুকুন' : '⚡ Enter Demo Dashboard'
                                )}
                            </button>
                        </div>

                        {/* Option 2: 14-Day Free Trial */}
                        <div className="rounded-xl border-2 border-[#FF4A1C] bg-[#161c24] p-6 flex flex-col justify-between relative shadow-xl">
                            <div className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full bg-[#FF4A1C] text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                {isBn ? 'প্রস্তাবিত' : 'Recommended'}
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF4A1C]/10 text-[#FF4A1C] text-xs font-bold border border-[#FF4A1C]/30">
                                        🚀 {isBn ? 'অপশন ২: ১৪ দিনের ফ্রি ট্রায়াল' : 'Option 2: 14-Day Free Trial'}
                                    </span>
                                    <span className="text-xs font-bold text-emerald-400 font-mono">
                                        $0 / ১৪ দিন
                                    </span>
                                </div>

                                <h4 className="text-base font-bold text-white mb-2">
                                    {isBn ? 'নিজের ফার্মেসিতে বাস্তবে চালানো' : 'Run Your Real Pharmacy Operations'}
                                </h4>
                                <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                                    {isBn
                                        ? 'আপনার নিজস্ব ফার্মেসির প্রাইভেট ওয়ার্কস্পেস খুলুন, আসল ওষুধ ও কর্মচারী অ্যাড করে দোকানে লাইভ বিক্রি শুরু করুন।'
                                        : 'Create your private isolated workspace, import your real medicine batches and start billing customers at your counters.'}
                                </p>

                                <ul className="space-y-2.5 text-xs text-slate-300 mb-6">
                                    <li className="flex items-start gap-2">
                                        <Check className="h-3.5 w-3.5 text-[#FF4A1C] shrink-0 mt-0.5" />
                                        <span>{isBn ? 'আপনার নিজস্ব ব্র্যান্ডেড সাবডোমেন' : 'Your own custom isolated pharmacy domain'}</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="h-3.5 w-3.5 text-[#FF4A1C] shrink-0 mt-0.5" />
                                        <span>{isBn ? 'আপনার দোকানের আসল ওষুধ, ব্যাচ ও দাম এন্ট্রি' : 'Import and manage your real stock, costs & retail prices'}</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="h-3.5 w-3.5 text-[#FF4A1C] shrink-0 mt-0.5" />
                                        <span>{isBn ? 'আসল কাস্টমার স্লিপ প্রিন্টিং ও দৈনিক ক্যাশ ক্লোজিং' : 'Print real POS receipts and track daily counter drawer cash'}</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="h-3.5 w-3.5 text-[#FF4A1C] shrink-0 mt-0.5" />
                                        <span>{isBn ? '১৪ দিন সম্পূর্ণ ফ্রি — কোনো ক্রেডিট কার্ড লাগবে না' : '14 days full access — zero credit card required'}</span>
                                    </li>
                                </ul>
                            </div>

                            <Link
                                href={route('register')}
                                className="w-full h-10 rounded-md bg-[#FF4A1C] hover:bg-[#e03e15] text-white font-bold text-xs flex items-center justify-center transition-colors shadow-lg cursor-pointer"
                            >
                                {isBn ? '🚀 ১৪ দিনের ফ্রি ট্রায়াল শুরু করুন' : '🚀 Start 14-Day Free Trial'}
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Plans & Pricing Section */}
            <section id="plans" className="px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800/80 max-w-7xl mx-auto scroll-mt-14">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
                    <div>
                        <span className="text-[#FF4A1C] text-xs font-bold uppercase tracking-wider block mb-1">
                            {isBn ? 'সাবস্ক্রিপশন প্ল্যান' : 'Subscription Plans'}
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                            {isBn ? 'ডেমো ভালো লাগলে নিজের প্ল্যান বেছে নিন' : 'Liked the Demo? Choose Your Own Plan'}
                        </h2>
                        <p className="text-slate-400 text-xs sm:text-sm">
                            {isBn
                                ? 'প্রতিটি প্ল্যানে ১৪ দিনের ফ্রি ট্রায়াল। যেকোনো সময় আপগ্রেড করা যাবে।'
                                : '14-day free trial on all plans. Upgrade or cancel anytime.'}
                        </p>
                    </div>

                    {/* Monthly / Yearly Toggle */}
                    <div className="inline-flex rounded-lg border border-slate-800 bg-[#161c24] p-1 self-start md:self-auto">
                        <button
                            type="button"
                            onClick={() => setBillingCycle('monthly')}
                            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                billingCycle === 'monthly'
                                    ? 'bg-[#FF4A1C] text-white shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {isBn ? 'মাসিক' : 'Monthly'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setBillingCycle('yearly')}
                            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                billingCycle === 'yearly'
                                    ? 'bg-[#FF4A1C] text-white shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            {isBn ? 'বার্ষিক (২ মাস ফ্রি)' : 'Yearly (2 Months Free)'}
                        </button>
                    </div>
                </div>

                {/* 3 Pricing Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {defaultPlanItems.map((planItem) => {
                        const dynamicPlan = plans.find((p) => p.key === planItem.key);
                        let price = planItem.priceMonthly;
                        if (billingCycle === 'monthly') {
                            const rawMonthly = dynamicPlan?.monthly_price ?? dynamicPlan?.price_monthly;
                            if (rawMonthly != null) {
                                const parsed = parseFloat(String(rawMonthly));
                                if (!isNaN(parsed) && parsed > 0) price = parsed;
                            }
                        } else {
                            const rawAnnual = dynamicPlan?.annual_price ?? dynamicPlan?.price_yearly;
                            if (rawAnnual != null) {
                                const parsed = parseFloat(String(rawAnnual));
                                if (!isNaN(parsed) && parsed > 0) {
                                    price = Math.round((parsed / 12) * 100) / 100;
                                } else {
                                    price = planItem.priceYearlyMonthly;
                                }
                            } else {
                                price = planItem.priceYearlyMonthly;
                            }
                        }

                        return (
                            <div
                                key={planItem.key}
                                className={`rounded-xl bg-[#161c24] p-6 flex flex-col justify-between ${
                                    planItem.isPopular
                                        ? 'border-2 border-[#FF4A1C] shadow-2xl relative'
                                        : 'border border-slate-800'
                                }`}
                            >
                                {planItem.isPopular && (
                                    <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-[#FF4A1C] text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                        {isBn ? 'জনপ্রিয়' : 'Most Popular'}
                                    </div>
                                )}

                                <div>
                                    <h3 className={`text-base font-bold text-white mb-2 ${planItem.isPopular ? 'mt-1' : ''}`}>
                                        {isBn
                                            ? (dynamicPlan?.name_bn || dynamicPlan?.name || planItem.titleBn)
                                            : (dynamicPlan?.name || planItem.titleEn)}
                                    </h3>
                                    <p className="text-xs text-slate-400 min-h-[36px] mb-4 leading-relaxed">
                                        {isBn
                                            ? (dynamicPlan?.description_bn || dynamicPlan?.description || planItem.descBn)
                                            : (dynamicPlan?.description || planItem.descEn)}
                                    </p>

                                    <div className="mb-6">
                                        <div className="text-3xl font-extrabold text-white">
                                            ${price.toFixed(2)}
                                            <span className="text-xs font-normal text-slate-400">
                                                {' '}/ {isBn ? 'মাস' : 'month'}
                                            </span>
                                        </div>
                                        {billingCycle === 'yearly' && (
                                            <div className="text-[11px] text-emerald-400 mt-1">
                                                ${(price * 12).toFixed(0)} {isBn ? '/ বার্ষিক বিল' : 'billed annually'}
                                            </div>
                                        )}
                                    </div>

                                    <ul className="space-y-2.5 text-xs text-slate-300 mb-8 border-t border-slate-800/80 pt-5">
                                        {(isBn ? planItem.featuresBn : planItem.featuresEn).map((feat, fIdx) => (
                                            <li key={fIdx} className="flex items-center gap-2">
                                                <Check className="h-3.5 w-3.5 text-[#FF4A1C] shrink-0" />
                                                <span>{feat}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <Link
                                    href={`${route('register')}?plan=${planItem.key}`}
                                    className={`w-full h-10 rounded-md text-xs font-bold flex items-center justify-center transition-colors ${
                                        planItem.isPopular
                                            ? 'bg-[#FF4A1C] hover:bg-[#e03e15] text-white shadow-lg'
                                            : 'bg-[#1e2632] hover:bg-[#283342] text-slate-200 border border-slate-700/80'
                                    }`}
                                >
                                    {isBn
                                        ? `${planItem.titleBn} ট্রায়াল শুরু`
                                        : `Start ${planItem.titleEn} Trial`}
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Bottom Call to Action Card Banner */}
            <section className="px-4 sm:px-6 lg:px-8 py-14 max-w-7xl mx-auto">
                <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-[#181d26] to-[#12161e] p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
                        {isBn ? 'ডেমো দেখা শেষ? এবার নিজের ফার্মেসি চালু করুন' : 'Finished Exploring? Launch Your Real Pharmacy Today'}
                    </h2>
                    <p className="text-slate-400 text-xs sm:text-sm mb-6">
                        {isBn ? '১৪ দিনের ফ্রি ট্রায়াল। কোনো কার্ড লাগবে না।' : '14-day free trial. No credit card required.'}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Link
                            href={route('register')}
                            className="h-11 px-6 rounded-md bg-[#FF4A1C] hover:bg-[#e03e15] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors shadow-lg cursor-pointer"
                        >
                            <span>🚀</span>
                            <span>{isBn ? 'ব্যবসা নিবন্ধন ও ফ্রি ট্রায়াল' : 'Register Business & Start Free Trial'}</span>
                        </Link>
                        <button
                            type="button"
                            disabled={isEnteringDemo}
                            onClick={() => enterDemo('admin@pharmacore.test', 'admin')}
                            className="h-11 px-6 rounded-md bg-[#141920] hover:bg-[#1a212b] text-slate-200 border border-slate-700/80 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-75"
                        >
                            <span>⚡</span>
                            <span>{isBn ? 'ইনস্ট্যান্ট ডেমো খুলুন' : 'Open Instant Demo'}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-800/80 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    {isBn
                        ? '© ২০২৬ PharmaCore SaaS | ডেমো পরিবেশের সব তথ্য নমুনা।'
                        : '© 2026 PharmaCore SaaS | All demo environment data is sample.'}
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                    <a href="#roles" className="hover:text-slate-200 transition-colors">
                        {isBn ? 'রোল ডেমো' : 'Role Demo'}
                    </a>
                    <a href="#tour" className="hover:text-slate-200 transition-colors">
                        {isBn ? 'গাইডেড ট্যুর' : 'Guided Tour'}
                    </a>
                    <a href="#plans" className="hover:text-slate-200 transition-colors">
                        {isBn ? 'প্ল্যান ও দাম' : 'Plans & Pricing'}
                    </a>
                    <Link href={route('login')} className="hover:text-slate-200 transition-colors">
                        {isBn ? 'সাইন ইন' : 'Sign In'}
                    </Link>
                </div>
            </footer>
        </div>
    );
}
