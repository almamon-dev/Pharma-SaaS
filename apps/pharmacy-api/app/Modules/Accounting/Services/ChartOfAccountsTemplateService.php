<?php

namespace App\Modules\Accounting\Services;

class ChartOfAccountsTemplateService
{
    public const TEMPLATE_PHARMACY = 'pharmacy';
    public const TEMPLATE_DISTRIBUTOR = 'distributor';
    public const TEMPLATE_HOSPITAL_PHARMACY = 'hospital_pharmacy';

    /**
     * @return array<int, array<string, mixed>>
     */
    public function accountsForTemplate(string $template = self::TEMPLATE_PHARMACY): array
    {
        $base = [
            // Assets
            ['code' => '1010', 'name_en' => 'Cash in Hand', 'name_bn' => 'নগদ টাকা (ক্যাশ)', 'type' => 'asset', 'report_group' => 'cash', 'is_contra' => false, 'is_system' => true],
            ['code' => '1020', 'name_en' => 'Bank Account', 'name_bn' => 'ব্যাংক হিসাব', 'type' => 'asset', 'report_group' => 'bank', 'is_contra' => false, 'is_system' => true],
            ['code' => '1030', 'name_en' => 'bKash/Nagad Wallet', 'name_bn' => 'বিকাশ / নগদ ওয়ালেট', 'type' => 'asset', 'report_group' => 'bank', 'is_contra' => false, 'is_system' => false],
            ['code' => '1100', 'name_en' => 'Accounts Receivable', 'name_bn' => 'প্রাপ্য হিসাব (ক্রেতা বকেয়া)', 'type' => 'asset', 'report_group' => 'receivable', 'is_contra' => false, 'is_system' => true],
            ['code' => '1200', 'name_en' => 'Inventory - Medicines', 'name_bn' => 'মজুত পণ্য - ওষুধ', 'type' => 'asset', 'report_group' => 'inventory', 'is_contra' => false, 'is_system' => true],
            ['code' => '1210', 'name_en' => 'Inventory - Surgical and Consumables', 'name_bn' => 'মজুত পণ্য - সার্জিক্যাল ও কনজিউমেবল', 'type' => 'asset', 'report_group' => 'inventory', 'is_contra' => false, 'is_system' => false],
            ['code' => '1300', 'name_en' => 'Input VAT', 'name_bn' => 'ইনপুট ভ্যাট', 'type' => 'asset', 'report_group' => 'vat_input', 'is_contra' => false, 'is_system' => true],
            ['code' => '1400', 'name_en' => 'Advance to Suppliers', 'name_bn' => 'সরবরাহকারীকে অগ্রিম', 'type' => 'asset', 'report_group' => 'other_current_asset', 'is_contra' => false, 'is_system' => false],
            ['code' => '1500', 'name_en' => 'Furniture and Equipment', 'name_bn' => 'আসবাবপত্র ও যন্ত্রপাতি', 'type' => 'asset', 'report_group' => 'fixed_asset', 'is_contra' => false, 'is_system' => false],
            ['code' => '1510', 'name_en' => 'Accumulated Depreciation', 'name_bn' => 'পুঞ্জীভূত অবচয়', 'type' => 'asset', 'report_group' => 'fixed_asset', 'is_contra' => true, 'is_system' => false],

            // Liabilities
            ['code' => '2010', 'name_en' => 'Accounts Payable', 'name_bn' => 'প্রদেয় হিসাব (সরবরাহকারী বকেয়া)', 'type' => 'liability', 'report_group' => 'payable', 'is_contra' => false, 'is_system' => true],
            ['code' => '2100', 'name_en' => 'VAT Payable', 'name_bn' => 'প্রদেয় ভ্যাট (আউটপুট)', 'type' => 'liability', 'report_group' => 'vat_output', 'is_contra' => false, 'is_system' => true],
            ['code' => '2200', 'name_en' => 'Salary Payable', 'name_bn' => 'বকেয়া বেতন', 'type' => 'liability', 'report_group' => 'other_liability', 'is_contra' => false, 'is_system' => false],
            ['code' => '2300', 'name_en' => 'Loans', 'name_bn' => 'ঋণ হিসাব', 'type' => 'liability', 'report_group' => 'other_liability', 'is_contra' => false, 'is_system' => false],

            // Equity
            ['code' => '3010', 'name_en' => 'Owner Capital', 'name_bn' => 'মালিকের মূলধন', 'type' => 'equity', 'report_group' => 'equity', 'is_contra' => false, 'is_system' => true],
            ['code' => '3020', 'name_en' => 'Retained Earnings', 'name_bn' => 'অবন্টিত মুনাফা', 'type' => 'equity', 'report_group' => 'equity', 'is_contra' => false, 'is_system' => true],
            ['code' => '3030', 'name_en' => 'Owner Drawings', 'name_bn' => 'মালিকের উত্তোলন', 'type' => 'equity', 'report_group' => 'equity', 'is_contra' => true, 'is_system' => false],

            // Income
            ['code' => '4010', 'name_en' => 'Sales - Medicine', 'name_bn' => 'বিক্রয় - ওষুধ', 'type' => 'income', 'report_group' => 'revenue', 'is_contra' => false, 'is_system' => true],
            ['code' => '4020', 'name_en' => 'Sales - Other', 'name_bn' => 'বিক্রয় - অন্যান্য', 'type' => 'income', 'report_group' => 'revenue', 'is_contra' => false, 'is_system' => false],
            ['code' => '4030', 'name_en' => 'Sales Returns', 'name_bn' => 'বিক্রয় ফেরত', 'type' => 'income', 'report_group' => 'revenue', 'is_contra' => true, 'is_system' => true],
            ['code' => '4100', 'name_en' => 'Other Income', 'name_bn' => 'অন্যান্য আয়', 'type' => 'income', 'report_group' => 'other_income', 'is_contra' => false, 'is_system' => false],
            ['code' => '4110', 'name_en' => 'Rental Income', 'name_bn' => 'ভাড়া আয়', 'type' => 'income', 'report_group' => 'other_income', 'is_contra' => false, 'is_system' => false],

            // Cost of Goods Sold
            ['code' => '5010', 'name_en' => 'Cost of Goods Sold', 'name_bn' => 'বিক্রীত পণ্যের ব্যয় (COGS)', 'type' => 'expense', 'report_group' => 'cogs', 'is_contra' => false, 'is_system' => true],
            ['code' => '5020', 'name_en' => 'Expired and Damaged Stock Loss', 'name_bn' => 'মেয়াদোত্তীর্ণ ও নষ্ট পণ্যের ক্ষতি', 'type' => 'expense', 'report_group' => 'cogs', 'is_contra' => false, 'is_system' => true],
            ['code' => '5030', 'name_en' => 'Stock Adjustment Loss', 'name_bn' => 'স্টক সমন্বয় ক্ষতি', 'type' => 'expense', 'report_group' => 'cogs', 'is_contra' => false, 'is_system' => false],

            // Operating Expenses
            ['code' => '6010', 'name_en' => 'Salary', 'name_bn' => 'কর্মচারীদের বেতন', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false],
            ['code' => '6020', 'name_en' => 'Rent', 'name_bn' => 'দোকান / অফিস ভাড়া', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false],
            ['code' => '6030', 'name_en' => 'Electricity', 'name_bn' => 'বিদ্যুৎ বিল', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false],
            ['code' => '6040', 'name_en' => 'Transport', 'name_bn' => 'যাতায়াত ও পরিবহন', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false],
            ['code' => '6050', 'name_en' => 'Internet and Phone', 'name_bn' => 'ইন্টারনেট ও ফোন বিল', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false],
            ['code' => '6060', 'name_en' => 'Repairs and Maintenance', 'name_bn' => 'মেরামত ও রক্ষণাবেক্ষণ', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false],
            ['code' => '6070', 'name_en' => 'Marketing', 'name_bn' => 'মার্কেটিং ও প্রচার', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false],
            ['code' => '6080', 'name_en' => 'Bank Charges', 'name_bn' => 'ব্যাংক চার্জ', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false],
            ['code' => '6090', 'name_en' => 'Depreciation', 'name_bn' => 'অবচয় ব্যয়', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false],
            ['code' => '6100', 'name_en' => 'Miscellaneous', 'name_bn' => 'বিবিধ খরচ', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false],
        ];

        if ($template === self::TEMPLATE_DISTRIBUTOR) {
            $base[] = ['code' => '4040', 'name_en' => 'Trade Discount Allowed', 'name_bn' => 'ট্রেড ডিসকাউন্ট প্রদান', 'type' => 'income', 'report_group' => 'revenue', 'is_contra' => true, 'is_system' => false];
            $base[] = ['code' => '6110', 'name_en' => 'Sales Commission', 'name_bn' => 'বিক্রয় কমিশন', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false];
            $base[] = ['code' => '6120', 'name_en' => 'Delivery Vehicle Expense', 'name_bn' => 'ডেলিভারি গাড়ির খরচ', 'type' => 'expense', 'report_group' => 'operating_expense', 'is_contra' => false, 'is_system' => false];
        } elseif ($template === self::TEMPLATE_HOSPITAL_PHARMACY) {
            $base[] = ['code' => '1110', 'name_en' => 'IPD Sales Receivable', 'name_bn' => 'আইপিডি (ভর্তি রোগী) প্রাপ্য', 'type' => 'asset', 'report_group' => 'receivable', 'is_contra' => false, 'is_system' => false];
            $base[] = ['code' => '1120', 'name_en' => 'Insurance / Corporate Receivable', 'name_bn' => 'ইন্স্যুরেন্স ও কর্পোরেট প্রাপ্য', 'type' => 'asset', 'report_group' => 'receivable', 'is_contra' => false, 'is_system' => false];
        }

        return $base;
    }

    /**
     * Default Simple Mode categories mapped to standard account codes.
     *
     * @return array<int, array<string, mixed>>
     */
    public function defaultSimpleCategories(): array
    {
        return [
            // Expenses (debit = expense account, credit = chosen cash/bank/wallet at entry time; default 1010)
            ['kind' => 'expense', 'code' => 'electricity', 'name_en' => 'Electricity', 'name_bn' => 'বিদ্যুৎ বিল', 'debit_code' => '6030', 'credit_code' => '1010'],
            ['kind' => 'expense', 'code' => 'shop_rent', 'name_en' => 'Shop Rent', 'name_bn' => 'দোকান ভাড়া', 'debit_code' => '6020', 'credit_code' => '1010'],
            ['kind' => 'expense', 'code' => 'staff_salary', 'name_en' => 'Staff Salary', 'name_bn' => 'কর্মচারীদের বেতন', 'debit_code' => '6010', 'credit_code' => '1010'],
            ['kind' => 'expense', 'code' => 'transport', 'name_en' => 'Transport', 'name_bn' => 'যাতায়াত ও পরিবহন', 'debit_code' => '6040', 'credit_code' => '1010'],
            ['kind' => 'expense', 'code' => 'internet', 'name_en' => 'Internet & Phone', 'name_bn' => 'ইন্টারনেট ও ফোন', 'debit_code' => '6050', 'credit_code' => '1010'],
            ['kind' => 'expense', 'code' => 'repairs', 'name_en' => 'Repairs & Maintenance', 'name_bn' => 'মেরামত ও রক্ষণাবেক্ষণ', 'debit_code' => '6060', 'credit_code' => '1010'],
            ['kind' => 'expense', 'code' => 'other_expense', 'name_en' => 'Other Expense', 'name_bn' => 'অন্যান্য খরচ', 'debit_code' => '6100', 'credit_code' => '1010'],

            // Income (debit = chosen cash/bank/wallet at entry time; credit = income account)
            ['kind' => 'income', 'code' => 'medicine_sales', 'name_en' => 'Medicine Sales', 'name_bn' => 'ওষুধ বিক্রয়', 'debit_code' => '1010', 'credit_code' => '4010'],
            ['kind' => 'income', 'code' => 'other_income', 'name_en' => 'Other Income', 'name_bn' => 'অন্যান্য আয়', 'debit_code' => '1010', 'credit_code' => '4100'],
            ['kind' => 'income', 'code' => 'rent_received', 'name_en' => 'Rent Received', 'name_bn' => 'ভাড়া প্রাপ্তি', 'debit_code' => '1010', 'credit_code' => '4110'],
        ];
    }
}

