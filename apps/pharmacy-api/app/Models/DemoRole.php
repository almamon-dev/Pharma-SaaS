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
                'title_en' => 'Super Admin (Business Owner)',
                'title_bn' => 'সুপার অ্যাডমিন (মালিক)',
                'subtitle_en' => 'Company overview, financials & billing',
                'subtitle_bn' => 'পুরো কোম্পানির ওভারভিউ ও ফিন্যান্স',
                'description_en' => 'Full business authority across all branches, total sales, critical approvals, cash discrepancy alerts, gross profit, master catalog, financials, audit logs & billing.',
                'description_bn' => 'পুরো কোম্পানির সব ব্রাঞ্চের টোটাল সেলস, পেন্ডিং ক্রিটিক্যাল অ্যাপ্রুভাল, ক্যাশ ডিসক্রিপেন্সি অ্যালার্ট, গ্রস প্রফিট, প্রোডাক্ট ক্যাটালগ ও বিলিং নিয়ন্ত্রণ।',
                'email' => 'admin@pharmacore.test',
                'tags_en' => ['Dashboard', 'Organization', 'Users & Roles', 'Approvals', 'Product Catalog', 'Financial Reports', 'Audit Log', 'Settings & Billing'],
                'tags_bn' => ['ড্যাশবোর্ড', 'অর্গানাইজেশন', 'ইউজার ও রোল', 'অ্যাপ্রুভাল', 'প্রোডাক্ট ক্যাটালগ', 'ফিন্যান্সিয়াল রিপোর্ট', 'অডিট লগ', 'সেটিংস ও বিলিং'],
                'features_en' => [
                    'Monitor total sales across all branches, gross profit summary, and cash discrepancy alerts',
                    'Approve high-value discounts, customer returns, and accounting vouchers',
                    'Control master medicine catalog pricing, financial P&L / VAT reports, and full audit logs',
                    'Manage organizations, branches, staff roles, business settings, and SaaS subscriptions',
                ],
                'features_bn' => [
                    'সব ব্রাঞ্চের টোটাল সেলস, গ্রস প্রফিট সামারি ও ক্যাশ ডিসক্রিপেন্সি অ্যালার্ট পর্যবেক্ষণ',
                    'হাই-ভ্যালু ডিসকাউন্ট, রিটার্ন এবং অ্যাকাউন্টিং ভাউচার অ্যাপ্রুভাল',
                    'মাস্টার প্রোডাক্ট ও প্রাইসিং কন্ট্রোল, P&L / ক্যাশ ফ্লো / ভ্যাট রিপোর্ট ও অডিট লগ',
                    'ব্রাঞ্চ, টেন্যান্ট, রোল পারমিশন এবং সাবস্ক্রিপশন ও প্ল্যান ব্যবস্থাপনা',
                ],
                'restrictions_en' => [
                    'Other subscriber tenant data is strictly isolated',
                    'Live payment gateway API keys concealed in demo mode',
                ],
                'restrictions_bn' => [
                    'অন্য কোনো ফার্মেসির ডেটা সম্পূর্ণ আলাদা ও সুরক্ষিত',
                    'লাইভ পেমেন্ট গেটওয়ে সিক্রেট ডেমো মোডে লুকানো',
                ],
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'role_id' => 'co_admin',
                'role_key' => 'co_admin',
                'title_en' => 'Admin (Operations Head)',
                'title_bn' => 'অ্যাডমিন (অপারেশনস হেড)',
                'subtitle_en' => 'Assigned branches & counter ops',
                'subtitle_bn' => 'অ্যাসাইন করা ব্রাঞ্চ ও কাউন্টার মনিটরিং',
                'description_en' => 'Delegated Co-Admin overseeing assigned branches sales performance, pending operational approvals, live counter monitoring, staff & operational reports.',
                'description_bn' => 'অ্যাসাইন করা ব্রাঞ্চগুলোর সেলস পারফরম্যান্স, পেন্ডিং অ্যাপ্রুভাল, স্টাফ ম্যানেজমেন্ট, স্টক ও লাইভ কাউন্টার মনিটরিং (প্রফিট ও বিলিং ছাড়া)।',
                'email' => 'coadmin@pharmacore.test',
                'tags_en' => ['Operations Overview', 'Branches', 'Approvals', 'Staff & Roles', 'Counter Monitoring', 'Operational Reports', 'Audit Log'],
                'tags_bn' => ['অপারেশনস ড্যাশবোর্ড', 'ব্রাঞ্চ স্ট্যাটাস', 'অ্যাপ্রুভাল', 'স্টাফ ও রোল', 'কাউন্টার মনিটরিং', 'সেলস ও স্টক রিপোর্ট', 'অডিট লগ'],
                'features_en' => [
                    'Track sales performance and live counter queues across assigned branches',
                    'Review and decide pending discount, return, and voucher approvals',
                    'Manage lower-level staff accounts and view operational sales & stock reports',
                    'Inspect operational audit logs without access to confidential profit or billing',
                ],
                'features_bn' => [
                    'অ্যাসাইন করা ব্রাঞ্চগুলোর সেলস পারফরম্যান্স ও লাইভ কাউন্টার স্ট্যাটাস পর্যবেক্ষণ',
                    'ডিসকাউন্ট, রিটার্ন এবং অপারেশনাল ভাউচার অ্যাপ্রুভাল নিষ্পত্তি',
                    'নিচের লেভেলের স্টাফ ম্যানেজমেন্ট এবং সেলস ও স্টক রিপোর্ট দেখা',
                    'অপারেশনাল অডিট লগ নিরীক্ষণ (মুনাফা ও বিলিং তথ্য ছাড়া)',
                ],
                'restrictions_en' => [
                    'Gross profit margins, COGS purchase valuation, and P&L statements are hidden',
                    'Subscription plans, SaaS billing, and owner-level tenant settings are restricted',
                ],
                'restrictions_bn' => [
                    'গ্রস প্রফিট, ক্রয়মূল্য (COGS) এবং P&L রিপোর্ট সম্পূর্ণ লুকানো',
                    'সাবস্ক্রিপশন বিলিং এবং মালিকানা সেটিংস পরিবর্তন বন্ধ',
                ],
                'sort_order' => 2,
                'is_active' => true,
            ],
            [
                'role_id' => 'manager',
                'role_key' => 'manager',
                'title_en' => 'Branch Manager',
                'title_bn' => 'ব্রাঞ্চ ম্যানেজার',
                'subtitle_en' => 'Single branch control & stock',
                'subtitle_bn' => 'নির্দিষ্ট ব্রাঞ্চ ও স্টক নিয়ন্ত্রণ',
                'description_en' => 'Heads a specific assigned branch: manages today’s branch sales, open counters, low-stock alerts, branch approvals, inventory, and branch staff.',
                'description_bn' => 'একটি নির্দিষ্ট ব্রাঞ্চের প্রধান — নিজ ব্রাঞ্চের আজকের সেলস, ওপেন কাউন্টার, লো-স্টক আইটেম, অ্যাপ্রুভাল, ইনভেন্টরি ও ব্রাঞ্চ স্টাফ পরিচালনা।',
                'email' => 'manager@pharmacore.test',
                'tags_en' => ['Branch Overview', 'Approvals', 'Sales & Orders', 'Inventory & Stock', 'Branch Staff', 'Reports', 'Audit Log'],
                'tags_bn' => ['ব্রাঞ্চ ড্যাশবোর্ড', 'অ্যাপ্রুভাল', 'সেলস ও অর্ডার', 'ইনভেন্টরি ও স্টক', 'ব্রাঞ্চ স্টাফ', 'রিপোর্ট', 'ব্রাঞ্চ লগ'],
                'features_en' => [
                    'Monitor own branch today’s sales, total bills, open counters, and low-stock medicines',
                    'Approve branch-level discounts, customer returns, and cash/voucher adjustments',
                    'Supervise branch order queues, live counters, stock intake, and expiry tracker',
                    'Manage own branch staff roster and inspect branch sales & stock reports',
                ],
                'features_bn' => [
                    'নিজ ব্রাঞ্চের আজকের সেলস, টোটাল বিল, ওপেন কাউন্টার ও লো-স্টক পর্যবেক্ষণ',
                    'ব্রাঞ্চ লেভেলের রিটার্ন, ডিসকাউন্ট ও ক্যাশ অ্যাডজাস্টমেন্ট অ্যাপ্রুভাল',
                    'অর্ডার ট্র্যাকিং, কাউন্টার লাইভ ভিউ, স্টক ইনভেন্টরি ও এক্সপায়ারি ট্র্যাকার',
                    'নিজ ব্রাঞ্চের এমপ্লয়ি লিস্ট এবং ব্রাঞ্চ সেলস ও স্টক রিপোর্ট',
                ],
                'restrictions_en' => [
                    'Strictly scoped to own assigned branch; cannot access other branches',
                    'Company-wide P&L, master tenant billing, and subscription plans are restricted',
                ],
                'restrictions_bn' => [
                    'শুধুমাত্র নিজ ব্রাঞ্চের ডেটা দেখতে পারবে; অন্য ব্রাঞ্চের তথ্য বন্ধ',
                    'কোম্পানির কেন্দ্রীয় বিলিং ও সাবস্ক্রিপশন প্ল্যান পরিবর্তন বন্ধ',
                ],
                'sort_order' => 3,
                'is_active' => true,
            ],
            [
                'role_id' => 'pharmacist',
                'role_key' => 'pharmacist',
                'title_en' => 'Pharmacist',
                'title_bn' => 'ফার্মাসিস্ট',
                'subtitle_en' => 'Clinical Rx & pharmacy stock',
                'subtitle_bn' => 'ক্লিনিক্যাল Rx ও ফার্মেসি স্টক',
                'description_en' => 'Clinical & pharmacy stock specialist managing pending Rx verification queue, dispensed orders today, FEFO batches, stock adjustments, and supplier returns.',
                'description_bn' => 'ভেরিফিকেশনের জন্য অপেক্ষমাণ প্রেসক্রিপশন (Rx), আজকের ডিসপেন্সড অর্ডার, লো-স্টক, মেয়াদোত্তীর্ণ হতে যাওয়া ওষুধ ও স্টক অ্যাডজাস্টমেন্ট পরিচালনা।',
                'email' => 'pharmacist@pharmacore.test',
                'tags_en' => ['Pharmacy Today', 'Rx to Verify', 'Dispensed Today', 'Medicines & Batches', 'Stock Adjustment', 'Purchases & Returns', 'Reports'],
                'tags_bn' => ['ফার্মেসি ড্যাশবোর্ড', 'Rx ভেরিফিকেশন কিউ', 'ডিসপেন্সড টুডে', 'ব্যাচ ও এক্সপায়ারি', 'স্টক অ্যাডজাস্টমেন্ট', 'পারচেজ ও রিটার্ন', 'এক্সপায়ারি রিপোর্ট'],
                'features_en' => [
                    'Verify waiting prescriptions (Rx) and review patient allergies & dosage safety',
                    'Track medicines dispensed today and monitor controlled drugs register',
                    'Manage FEFO batches, expiry alerts, and record damaged stock adjustments',
                    'Create supplier purchase requests and process vendor/customer returns',
                ],
                'features_bn' => [
                    'প্রেসক্রিপশন ভেরিফিকেশন কিউ (Rx to Verify) ও ডোজ যাচাইকরণ',
                    'আজকের ডিসপেন্স হওয়া ওষুধের হিস্ট্রি ও কন্ট্রোলড ড্রাগ লগ',
                    'ব্যাচ, FEFO ও এক্সপায়ারি ট্র্যাকার এবং ড্যামেজ বা স্টক অ্যাডজাস্টমেন্ট',
                    'সাপ্লায়ার পারচেজ রিকোয়েস্ট, রিসিভ ও রিটার্ন এবং ফার্মেসি রিপোর্ট',
                ],
                'restrictions_en' => [
                    'Company gross profit margins, accounting ledgers, and staff RBAC are hidden',
                    'Global business settings, branch creation, and billing are locked',
                ],
                'restrictions_bn' => [
                    'কোম্পানির নিট প্রফিট, অ্যাকাউন্টিং ও রোল সেটিংস লুকানো',
                    'ব্রাঞ্চ তৈরি ও সাবস্ক্রিপশন সেটিংস পরিবর্তন বন্ধ',
                ],
                'sort_order' => 4,
                'is_active' => true,
            ],
            [
                'role_id' => 'salesman',
                'role_key' => 'salesman',
                'title_en' => 'Salesman',
                'title_bn' => 'সেলসম্যান',
                'subtitle_en' => 'Orders & customer handling',
                'subtitle_bn' => 'অর্ডার ও কাস্টমার হ্যান্ডলিং',
                'description_en' => 'Front-line order & customer specialist tracking own daily sales, target achievement (%), orders awaiting payment, customer dues, and top products.',
                'description_bn' => 'নিজের আজকের সেলস, টার্গেট অ্যাচিভমেন্ট (%), পেমেন্টের অপেক্ষায় থাকা অর্ডার, নতুন অর্ডার তৈরি ও ক্যাশিয়ারে পাঠানো এবং কাস্টমার ডিউ ট্র্যাকিং।',
                'email' => 'salesman@pharmacore.test',
                'tags_en' => ['Sales Home', 'New Order', 'My Orders', 'Customers', 'My Sales'],
                'tags_bn' => ['সেলস হোম', 'নতুন অর্ডার', 'মাই অর্ডারস', 'কাস্টমার ও ডিউ', 'মাই সেলস সামারি'],
                'features_en' => [
                    'View own today’s sales, daily target achievement %, and orders awaiting payment',
                    'Create new sales orders with barcode/PDF scan and send automatically to cashier',
                    'Track live status of own submitted orders across counter queues',
                    'Manage customer profiles, due balances, and own daily sales summary',
                ],
                'features_bn' => [
                    'নিজের আজকের সেলস, টার্গেট অ্যাচিভমেন্ট (%) ও পেমেন্ট পেন্ডিং অর্ডার পর্যবেক্ষণ',
                    'নতুন সেলস অর্ডার তৈরি করে অটোমেটিক ক্যাশিয়ার কাউন্টারে পাঠানো',
                    'নিজের অর্ডারের লাইভ স্ট্যাটাস ট্র্যাকিং (My Orders)',
                    'কাস্টমার লিস্ট, ডিউ ইনফো এবং নিজের ডেইলি সেলস সামারি',
                ],
                'restrictions_en' => [
                    'Direct cash drawer operation and register closing are restricted to Cashiers',
                    'Inventory stock write-offs, branch settings, and financial reports are locked',
                ],
                'restrictions_bn' => [
                    'ক্যাশ ড্রয়ার পরিচালনা ও শিফট ক্লোজ শুধুমাত্র ক্যাশিয়ারের জন্য নির্ধারিত',
                    'স্টক রাইট-অফ, ফিন্যান্সিয়াল রিপোর্ট ও সিস্টেম সেটিংস বন্ধ',
                ],
                'sort_order' => 5,
                'is_active' => true,
            ],
            [
                'role_id' => 'cashier',
                'role_key' => 'cashier',
                'title_en' => 'Cashier',
                'title_bn' => 'ক্যাশিয়ার',
                'subtitle_en' => 'POS & payment collection',
                'subtitle_bn' => 'POS ও পেমেন্ট কালেকশন',
                'description_en' => 'Counter billing & payment specialist managing today’s counter collection, total bills, cash-in-drawer balance, pending salesman orders, and walk-in POS.',
                'description_bn' => 'কাউন্টারের আজকের কালেকশন, টোটাল বিল সংখ্যা, ক্যাশ-ইন-ড্রয়ার ব্যালেন্স, সেলসম্যানের পাঠানো অর্ডারের পেমেন্ট রিসিভ এবং সরাসরি ওয়াক-ইন POS বিলিং।',
                'email' => 'cashier@pharmacore.test',
                'tags_en' => ['Cashier Station', 'Pending Orders', 'New Bill (Direct POS)', 'My Shift'],
                'tags_bn' => ['ক্যাশিয়ার স্টেশন', 'পেন্ডিং অর্ডার কিউ', 'নিউ বিল (Direct POS)', 'মাই শিফট ও রিকনসিলিয়েশন'],
                'features_en' => [
                    'Monitor counter today’s collection, bill count, cash-in-drawer, and waiting queue',
                    'Accept & receive Cash, Card, bKash, or Nagad payments for salesman-sent orders',
                    'Create instant direct POS bills for walk-in customers with thermal receipt print',
                    'Open/close register shift and perform end-of-shift cash reconciliation',
                ],
                'features_bn' => [
                    'কাউন্টারের আজকের কালেকশন, টোটাল বিল ও ক্যাশ-ইন-ড্রয়ার ব্যালেন্স পর্যবেক্ষণ',
                    'সেলসম্যানের পাঠানো পেন্ডিং অর্ডারের পেমেন্ট রিসিভ ও রসিদ প্রিন্ট',
                    'সরাসরি ওয়াক-ইন কাস্টমারদের দ্রুত Direct POS বিলিং',
                    'নিজের কাউন্টার শিফট ওপেন/ক্লোজ এবং ক্যাশ রিকনসিলিয়েশন',
                ],
                'restrictions_en' => [
                    'Cannot delete posted invoices or approve high-value discounts',
                    'Stock adjustments, wholesale purchasing, and global reports are locked',
                ],
                'restrictions_bn' => [
                    'পোস্ট হওয়া ইনভয়েস ডিলিট বা হাই-ভ্যালু ডিসকাউন্ট অনুমোদন বন্ধ',
                    'স্টক অ্যাডজাস্টমেন্ট, পারচেজ এবং কোম্পানির রিপোর্ট লুকানো',
                ],
                'sort_order' => 6,
                'is_active' => true,
            ],
        ];

        $activeIds = array_column($defaults, 'role_id');
        self::query()->whereNotIn('role_id', $activeIds)->delete();

        foreach ($defaults as $data) {
            self::query()->updateOrCreate(['role_id' => $data['role_id']], $data);
        }
    }
}

