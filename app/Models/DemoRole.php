<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DemoRole extends Model
{
    protected $fillable = [
        'role_id',
        'role_key',
        'title_en',
        'title_bn',
        'subtitle_en',
        'subtitle_bn',
        'description_en',
        'description_bn',
        'email',
        'tags_en',
        'tags_bn',
        'features_en',
        'features_bn',
        'restrictions_en',
        'restrictions_bn',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'tags_en' => 'array',
            'tags_bn' => 'array',
            'features_en' => 'array',
            'features_bn' => 'array',
            'restrictions_en' => 'array',
            'restrictions_bn' => 'array',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Seed or restore all default demo roles.
     */
    public static function seedDefaults(): void
    {
        $defaults = [
            [
                'role_id' => 'owner',
                'role_key' => 'admin',
                'title_en' => 'Owner / Admin',
                'title_bn' => 'মালিক / অ্যাডমিন',
                'subtitle_en' => 'All branches & reports',
                'subtitle_bn' => 'সব শাখা ও রিপোর্ট',
                'description_en' => 'Full operational and administrative authority across all registered pharmacy branches, inventory control, staff assignments, and commercial subscription management.',
                'description_bn' => 'সকল ফার্মেসি শাখা, ইনভেন্টরি স্টক, কর্মীদের রোল বরাদ্দ এবং সাবস্ক্রিপশন নিয়ন্ত্রণের সম্পূর্ণ প্রশাসনিক ক্ষমতা।',
                'email' => 'admin@pharmacore.test',
                'tags_en' => ['Dashboard', 'Branch Management', 'Staff & Roles', 'Reports', 'Subscription'],
                'tags_bn' => ['ড্যাশবোর্ড', 'শাখা ব্যবস্থাপনা', 'কর্মী ও রোল', 'রিপোর্ট', 'সাবস্ক্রিপশন'],
                'features_en' => [
                    'Monitor multi-branch revenue and gross profit in real-time on one unified screen',
                    'Create staff members and assign custom roles with granular permission matrices',
                    'Inspect gross profit margins, low-stock warnings, and slow-moving dead stock reports',
                    'Manage supplier directories, commercial plans, and branch billing quotas',
                ],
                'features_bn' => [
                    'সব শাখার মোট বিক্রি ও মুনাফা এক পর্দায় রিয়েল-টাইমে পর্যবেক্ষণ',
                    'নতুন কর্মী যুক্ত করুন এবং প্রতিটি রোলের আলাদা পারমিশন সেট করুন',
                    'মুনাফা, স্টক শর্টেজ অ্যালার্ট এবং অবিক্রিত ওষুধের পুঙ্খানুপুঙ্খ রিপোর্ট খুলুন',
                    'সরবরাহকারী ডিরেক্টরি, সাবস্ক্রিপশন কোটা এবং ব্রাঞ্চ বিলিং নিয়ন্ত্রণ',
                ],
                'restrictions_en' => [
                    'Other subscriber tenant data is isolated and strictly inaccessible',
                    'Live payment gateway credentials and private API keys concealed in demo',
                ],
                'restrictions_bn' => [
                    'অন্য কোনো ফার্মেসির ডেটা দেখার সুযোগ নেই (কঠোর মাল্টি-টেন্যান্ট আইসোলেশন)',
                    'পেমেন্ট গেটওয়ের গোপনীয় এপিআই কি ও বাণিজ্যিক বিলিং ডেমোতে লুকানো',
                ],
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'role_id' => 'pharmacist',
                'role_key' => 'pharmacist',
                'title_en' => 'Pharmacist',
                'title_bn' => 'ফার্মাসিস্ট',
                'subtitle_en' => 'Prescriptions & dispensing',
                'subtitle_bn' => 'প্রেসক্রিপশন ও ডিসপেনসিং',
                'description_en' => 'Specialized clinical dispensing role dedicated to verifying medical prescriptions, patient allergy warnings, contraindications, and inspecting batch FEFO expiry priorities.',
                'description_bn' => 'মেডিকেল প্রেসক্রিপশন যাচাইকরণ, রোগীর অ্যালার্জি ও পার্শ্বপ্রতিক্রিয়া নিরীক্ষণ এবং মেয়াদভিত্তিক সঠিক ওষুধ সরবরাহের দায়িত্বপ্রাপ্ত রোল।',
                'email' => 'pharmacist@pharmacore.test',
                'tags_en' => ['Prescription Verification', 'FEFO Stock', 'Medicine Dispensing', 'Allergy Alerts'],
                'tags_bn' => ['প্রেসক্রিপশন ভেরিফিকেশন', 'FEFO স্টক', 'ওষুধ ডিসপেনসিং', 'অ্যালার্জি চেক'],
                'features_en' => [
                    'Approve and dispense prescription-only drugs safely at the counter',
                    'Verify patient allergy records, drug interactions, and contraindication flags',
                    'Track nearest expiry batches with automatic FEFO (First-Expiry-First-Out) priority',
                    'Request branch restock shipments and flag damaged or near-expiry batches',
                ],
                'features_bn' => [
                    'কাউন্টারে প্রেসক্রিপশন-অনলি ওষুধের সঠিক ডোজ ও অনুমোদন প্রদান',
                    'রোগীর অ্যালার্জি রেকর্ড ও ওষুধের ক্ষতিকর পার্শ্বপ্রতিক্রিয়া পরীক্ষা',
                    'ব্যাচ মেয়াদ ও FEFO অগ্রাধিকার স্বয়ংক্রিয়ভাবে পর্যবেক্ষণ ও ডিসপেনসিং',
                    'মেয়াদোত্তীর্ণ ও ড্যামেজ ওষুধ ফ্ল্যাগ করা এবং হেড অফিসে রিস্টক রিকোয়েস্ট পাঠানো',
                ],
                'restrictions_en' => [
                    'Wholesale COGS purchase costs and net profit margins are concealed',
                    'Global business settings, branch setups, and tax configurations are locked',
                ],
                'restrictions_bn' => [
                    'পাইকারি ক্রয়মূল্য এবং মোট নিট মুনাফার মার্জিন দেখতে পারবে না',
                    'সিস্টেম কনফিগারেশন, নতুন ব্রাঞ্চ তৈরি ও ট্যাক্স সেটিংস পরিবর্তন বন্ধ',
                ],
                'sort_order' => 2,
                'is_active' => true,
            ],
            [
                'role_id' => 'cashier',
                'role_key' => 'cashier',
                'title_en' => 'Cashier',
                'title_bn' => 'ক্যাশিয়ার',
                'subtitle_en' => 'Fast counter & billing',
                'subtitle_bn' => 'দ্রুত বিক্রি ও বিল',
                'description_en' => 'High-speed point of sale terminal operator optimized for barcode scanner workflows, dual unit packaging calculations (full box & loose pieces), and fast receipt thermal printing.',
                'description_bn' => 'দ্রুত বারকোড স্ক্যানিং, বক্স ও পাতা ভিত্তিক খুচরা হিসাব, ক্যাশ ও বিকাশ গ্রহণ এবং সেকেন্ডে থার্মাল রসিদ প্রিন্টের জন্য অপ্টিমাইজড সেলস কাউন্টার রোল।',
                'email' => 'cashier@pharmacore.test',
                'tags_en' => ['Fast POS Terminal', 'Barcode Scan', 'Cash & Mobile Wallet', 'Receipt Print'],
                'tags_bn' => ['দ্রুত POS টার্মিনাল', 'বারকোড স্ক্যান', 'ক্যাশ ও ওয়ালেট', 'রসিদ প্রিন্ট'],
                'features_en' => [
                    'Sub-second barcode scan & instant checkout at branch counter',
                    'Collect Cash, Debit/Credit Card, bKash & Nagad payments with quick balance calculator',
                    'Serve registered loyalty CRM customers and walk-in patients with custom receipts',
                    'Seamlessly switch between full pack and single piece / strip retail pricing',
                ],
                'features_bn' => [
                    'বারকোড স্ক্যান করে চোখের পলকে সেকেন্ডে নির্ভুল বিল তৈরি ও চেকআউট',
                    'ক্যাশ, কার্ড এবং বিকাশ/নগদ পেমেন্ট কালেকশন ও দ্রুত ব্যালেন্স হিসাব',
                    'রেজিস্টার্ড নিয়মিত রোগী এবং ওয়াক-ইন গ্রাহক উভয়ের জন্য তাৎক্ষণিক বিলিং',
                    'পুরো বক্স অথবা খুচরা পাতা/পিস উভয়ের সঠিক দাম স্বয়ংক্রিয় ক্যালকুলেশন',
                ],
                'restrictions_en' => [
                    'Cannot delete historical sales invoices or issue unapproved counter refunds',
                    'Stock adjustments, manual batch deletions, and backdated bulk discounts blocked',
                ],
                'restrictions_bn' => [
                    'পূর্বের ইনভয়েস মুছে ফেলা বা অনুমতি ছাড়া ক্যাশ রিফান্ড প্রদান বন্ধ',
                    'ম্যানুয়াল স্টক সমন্বয় এবং ব্যাকডেটেড বিশেষ ডিসকাউন্ট পরিবর্তন ব্লক',
                ],
                'sort_order' => 3,
                'is_active' => true,
            ],
            [
                'role_id' => 'manager',
                'role_key' => 'manager',
                'title_en' => 'Branch Manager',
                'title_bn' => 'ব্রাঞ্চ ম্যানেজার',
                'subtitle_en' => 'Branch control & inventory',
                'subtitle_bn' => 'শাখা নিয়ন্ত্রণ ও ইনভেন্টরি',
                'description_en' => 'Branch supervisor handling daily shift reconciliations, inventory intake shipments from suppliers, inter-branch stock transfers, and counter cash drawers.',
                'description_bn' => 'শাখার দৈনন্দিন কার্যক্রম পরিচালনা, ক্যাশ ড্রয়ার হিসাব মিলানো, সরবরাহকারী চালান এন্ট্রি ও স্টক ইনভেন্টরি পর্যবেক্ষণের দায়িত্বপ্রাপ্ত রোল।',
                'email' => 'manager@pharmacore.test',
                'tags_en' => ['Branch Dashboard', 'Inventory Restock', 'Stock Movements', 'Daily Ledger'],
                'tags_bn' => ['শাখা ড্যাশবোর্ড', 'ইনভেন্টরি রিস্টক', 'স্টক মুভমেন্ট', 'দৈনিক রিপোর্ট'],
                'features_en' => [
                    'Reconcile daily counter cash, shift registers, and drawer balance summaries',
                    'Record purchase shipments, restock batches, and vendor PO delivery notes',
                    'Initiate damaged and near-expiry returns to pharmaceutical distributors',
                    'Supervise staff shifts, counter attendance, and branch sales targets',
                ],
                'features_bn' => [
                    'শাখার দৈনিক কাউন্টার ক্যাশ, শিফট রেজিস্টার এবং ড্রয়ার ব্যালেন্স মিলানো',
                    'নতুন ব্যাচ স্টক-ইন, সরবরাহকারী চালান এন্ট্রি ও লট নম্বর সংরক্ষণ',
                    'মেয়াদোত্তীর্ণ ও ড্যামেজ ওষুধ ফেরত প্রক্রিয়াকরণ এবং সাপ্লায়ার রিটার্ন নোট',
                    'শাখার কর্মীদের শিফট, সেলস টার্গেট এবং পারফরম্যান্স তদারকি',
                ],
                'restrictions_en' => [
                    'Restricted to own assigned branch; cannot view other branches data',
                    'Company bank payout accounts and SaaS subscription changes are owner-only',
                ],
                'restrictions_bn' => [
                    'শুধুমাত্র নিজ শাখার ডেটা দেখতে পারবে; অন্য শাখার তথ্য লুকানো',
                    'কোম্পানির কেন্দ্রীয় ব্যাংক তথ্য এবং সাবস্ক্রিপশন প্ল্যান বদলানোর ক্ষমতা নেই',
                ],
                'sort_order' => 4,
                'is_active' => true,
            ],
            [
                'role_id' => 'pathologist',
                'role_key' => 'pathologist',
                'title_en' => 'Pathologist',
                'title_bn' => 'প্যাথলজিস্ট',
                'subtitle_en' => 'Lab tests & reports',
                'subtitle_bn' => 'ল্যাব টেস্ট ও রিপোর্ট',
                'description_en' => 'Diagnostic laboratory specialist processing clinical test queues, recording lab specimen parameters, managing testing reagents, and certifying diagnostic test results.',
                'description_bn' => 'ডায়াগনস্টিক টেস্ট কিউ পরিচালনা, প্যাথলজি নমুনা পর্যবেক্ষণ, রিএজেন্ট ইনভেন্টরি এবং সার্টিফায়েড টেস্ট রিপোর্ট তৈরির দায়িত্বপ্রাপ্ত রোল।',
                'email' => 'pathologist@pharmacore.test',
                'tags_en' => ['Pathology Queue', 'Lab Reagents', 'Test Reports', 'Sample Tracking'],
                'tags_bn' => ['প্যাথলজি কিউ', 'ল্যাব রিএজেন্ট', 'টেস্ট রিপোর্ট', 'নমুনা ট্র্যাকিং'],
                'features_en' => [
                    'View assigned clinical test queue and patient specimen collection status',
                    'Input quantitative lab test parameters, biological reference ranges, and notes',
                    'Generate certified pathology diagnostic reports directly into patient CRM files',
                    'Track lab consumable reagents, expiry dates, and quality control batches',
                ],
                'features_bn' => [
                    'অ্যাসাইন করা প্যাথলজি টেস্ট তালিকা এবং রোগীর নমুনা সংগ্রহের স্ট্যাটাস দেখুন',
                    'ল্যাব টেস্টের প্যারামিটার, রেফারেন্স মান এবং প্যাথলজিক্যাল পর্যবেক্ষণ এন্ট্রি',
                    'রোগীর প্রোফাইলে সরাসরি ডিজিটাল সার্টিফায়েড টেস্ট রিপোর্ট প্রকাশ ও প্রিন্ট',
                    'ল্যাব কেমিক্যাল ও রিএজেন্টের মেয়াদ এবং ব্যবহার ট্র্যাক করা',
                ],
                'restrictions_en' => [
                    'Pharmacy point-of-sale retail counter billing locked',
                    'Core pharmacy business accounting and wholesale procurement concealed',
                ],
                'restrictions_bn' => [
                    'ফার্মেসির পিওএস কাউন্টার বিলিং ও ওষুধ বিক্রির অপশন বন্ধ',
                    'ফার্মেসির মূল হিসাবনিকাশ ও পাইকারি সাপ্লায়ার কেনাকাটা লুকানো',
                ],
                'sort_order' => 5,
                'is_active' => true,
            ],
            [
                'role_id' => 'radiologist',
                'role_key' => 'radiologist',
                'title_en' => 'Radiologist',
                'title_bn' => 'রেডিওলজিস্ট',
                'subtitle_en' => 'Imaging & diagnostics',
                'subtitle_bn' => 'ইমেজিং ও রিপোর্ট',
                'description_en' => 'Diagnostic imaging specialist interpreting X-Ray, Ultrasound, and CT scans, recording radiological findings, and linking reports to patient records.',
                'description_bn' => 'এক্স-রে, আল্ট্রাসাউন্ড ও সিটি স্ক্যান ইমেজিং বিশ্লেষণ, চিকিৎসকের ফাইন্ডিংস নোট প্রদান এবং সার্টিফায়েড রেডিওলজি রিপোর্ট প্রকাশের দায়িত্বপ্রাপ্ত রোল।',
                'email' => 'radiologist@pharmacore.test',
                'tags_en' => ['Imaging Worklist', 'X-Ray & Ultrasound', 'Diagnostic Findings', 'Patient History'],
                'tags_bn' => ['ইমেজিং ওয়ার্কলিস্ট', 'এক্স-রে ও আল্ট্রাসাউন্ড', 'ডায়াগনস্টিক ফাইন্ডিংস', 'রোগীর ইতিহাস'],
                'features_en' => [
                    'Inspect radiology imaging worklists and patient previous clinical history',
                    'Draft structured radiological findings, impressions, and diagnostic interpretations',
                    'Attach digital imaging notes and diagnostic summaries to patient profiles',
                    'Verify diagnostic compliance with referring physicians and clinics',
                ],
                'features_bn' => [
                    'রেডিওলজি ওয়ার্কলিস্ট এবং রোগীর পূর্ববর্তী রোগের ইতিহাস পর্যবেক্ষণ',
                    'এক্স-রে, আল্ট্রাসাউন্ডের ফাইন্ডিংস, ইমপ্রেশন ও রেডিওলজিক্যাল ডায়াগনোসিস এন্ট্রি',
                    'রোগীর ফাইলে ডিজিটাল ইমেজ ও বিস্তারিত মেডিকেল রিপোর্ট সংযুক্ত করা',
                    'প্রেসক্রাইবকারী চিকিৎসকের সাথে রিপোর্টের সামঞ্জস্য যাচাই ও সাইন-অফ',
                ],
                'restrictions_en' => [
                    'Pharmacy inventory stock-in and physical batch management restricted',
                    'Subscription licensing and business financial credentials concealed',
                ],
                'restrictions_bn' => [
                    'ওষুধের স্টক এন্ট্রি ও ফার্মেসি ইনভেন্টরি ম্যানেজমেন্ট বন্ধ',
                    'সাবস্ক্রিপশন প্ল্যান ও প্ল্যাটফর্ম ফাইন্যান্সিয়াল সেটিংস লুকানো',
                ],
                'sort_order' => 6,
                'is_active' => true,
            ],
            [
                'role_id' => 'superadmin',
                'role_key' => 'superadmin',
                'title_en' => 'Super Admin',
                'title_bn' => 'সুপার অ্যাডমিন',
                'subtitle_en' => 'SaaS platform & subscribers',
                'subtitle_bn' => 'প্ল্যাটফর্ম ও সাবস্ক্রিপশন',
                'description_en' => 'Central SaaS platform owner overseeing multi-tenant pharmacy subscribers, subscription plan limits, custom feature module overrides, and platform compliance audit logs.',
                'description_bn' => 'সেন্ট্রাল প্ল্যাটফর্ম বিজনেস অ্যাডমিনিস্ট্রেটর — সকল নিবন্ধিত ফার্মেসি সাবস্ক্রাইবার, প্ল্যান কনফিগারেশন, কাস্টম মডিউল অ্যাক্সেস এবং অডিট লগ পরিচালনার শীর্ষ রোল।',
                'email' => 'superadmin@pharmacore.test',
                'tags_en' => ['SaaS Console', 'Plan Management', 'Pharmacy Subscribers', 'Audit Logs', 'Platform Compliance'],
                'tags_bn' => ['SaaS কনসোল', 'প্ল্যান ব্যবস্থাপনা', 'ফার্মেসি সাবস্ক্রাইবার', 'অডিট লগ', 'প্ল্যাটফর্ম কমপ্লায়েন্স'],
                'features_en' => [
                    'Create, update, and configure pricing for multi-tier SaaS subscription plans',
                    'Override and customize feature modules per subscriber business or trial user',
                    'Monitor platform-wide pharmacy businesses, active branches, and tenant quotas',
                    'Inspect tamper-proof platform audit trails, ledger transactions, and compliance records',
                ],
                'features_bn' => [
                    'SaaS সাবস্ক্রিপশন প্ল্যান তৈরি, মূল্য নির্ধারণ ও কোটা লিমিট পরিচালনা',
                    'যেকোনো ফার্মেসি বা ডেমো ইউজারের জন্য মডিউলভিত্তিক কাস্টম ফিচার আনলক বা বন্ধ',
                    'প্ল্যাটফর্মের সকল ফার্মেসি ব্যবসা, মোট শাখা এবং লাইভ ইউজার মনিটরিং',
                    'সিস্টেম-ওয়াইড অডিট ট্রেইল, লেজার ট্রানজ্যাকশন এবং কমপ্লায়েন্স অ্যাক্টিভিটি পরিদর্শন',
                ],
                'restrictions_en' => [
                    'Patient private clinical notes and prescriptions remain tenant-encrypted',
                    'Individual store daily drawer cash cannot be tampered with centrally',
                ],
                'restrictions_bn' => [
                    'রোগীর ব্যক্তিগত প্রেসক্রিপশন নোট টেন্যান্টের নিজস্ব চাবিতে এনক্রিপ্টেড থাকে',
                    'নির্দিষ্ট কোনো দোকানের স্থানীয় ক্যাশ রেজিস্টার ট্রানজ্যাকশন কেন্দ্রীয়ভাবে পরিবর্তন নিষিদ্ধ',
                ],
                'sort_order' => 7,
                'is_active' => true,
            ],
        ];

        foreach ($defaults as $data) {
            self::query()->updateOrCreate(['role_id' => $data['role_id']], $data);
        }
    }
}

