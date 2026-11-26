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
                'role_id' => 'salesman',
                'role_key' => 'salesman',
                'title_en' => 'Salesman',
                'title_bn' => 'সেলসম্যান',
                'subtitle_en' => 'Sales orders & tracking',
                'subtitle_bn' => 'সেলস অর্ডার ও ট্র্যাকিং',
                'description_en' => 'Front-line pharmacy sales representative creating customer sales orders with prescription upload, batch selection, and real-time counter assignment tracking.',
                'description_bn' => 'ফার্মেসি সেলস রিপ্রেজেন্টেটিভ — গ্রাহকের জন্য দ্রুত সেলস অর্ডার তৈরি, ওষুধ ও ব্যাচ নির্বাচন, প্রেসক্রিপশন আপলোড এবং ক্যাশ কাউন্টারে অর্ডারের লাইভ ট্র্যাকিং।',
                'email' => 'salesman@pharmacore.test',
                'tags_en' => ['Sales Orders', 'Medicine Search', 'Prescription Upload', 'Live Order Tracking', 'Draft Orders'],
                'tags_bn' => ['সেলস অর্ডার', 'ওষুধ সার্চ', 'প্রেসক্রিপশন আপলোড', 'অর্ডার ট্র্যাকিং', 'ড্রাফট অর্ডার'],
                'features_en' => [
                    'Create sales orders for registered and walk-in customers instantly',
                    'Scan barcodes or search medicines with real-time stock and batch expiry info',
                    'Attach digital prescriptions and notes for pharmacist verification',
                    'Track automatically assigned counter status from waiting to completed',
                ],
                'features_bn' => [
                    'রেজিস্টার্ড ও ওয়াক-ইন রোগীদের জন্য চোখের পলকে সেলস অর্ডার তৈরি',
                    'রিয়েল-টাইম স্টক ও মেয়াদ দেখে বারকোড স্ক্যান বা ওষুধ নির্বাচন',
                    'প্রেসক্রিপশন ছবি ও চিকিৎসকের নোট সংযুক্ত করার সুবিধা',
                    'কাউন্টারে অর্ডারের লাইভ স্ট্যাটাস (অ্যাসাইনড, ওয়েটিং, পেইড) রিয়েল-টাইম ট্র্যাক',
                ],
                'restrictions_en' => [
                    'Direct cash collection, drawer registers, and payment processing restricted',
                    'Branch stock adjustments, wholesale purchasing, and settings locked',
                ],
                'restrictions_bn' => [
                    'ক্যাশ কাউন্টার পরিচালনা বা সরাসরি পেমেন্ট কালেকশন গ্রহণ বন্ধ',
                    'ইনভেন্টরি স্টক সমন্বয়, পাইকারি কেনাকাটা এবং সিস্টেম সেটিংস বন্ধ',
                ],
                'sort_order' => 4,
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
        ];

        foreach ($defaults as $data) {
            self::query()->updateOrCreate(['role_id' => $data['role_id']], $data);
        }
    }
}

