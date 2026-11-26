import React from 'react';
import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    BarChart3,
    BookOpen,
    BookText,
    CalendarRange,
    FileSpreadsheet,
    FolderTree,
    Landmark,
    Languages,
    LayoutDashboard,
    NotebookPen,
    Percent,
    ReceiptText,
    Scale,
    Settings,
    Users,
} from 'lucide-react';
import { AccountingPermissions, AccountingSettingsData } from '../types';

interface AccountingNavProps {
    active:
        | 'overview'
        | 'dashboard'
        | 'vouchers'
        | 'journal'
        | 'ledger'
        | 'trial-balance'
        | 'balance-sheet'
        | 'day-book'
        | 'cash-book'
        | 'bank-book'
        | 'bank-reconciliation'
        | 'operations'
        | 'extra-reports'
        | 'parties'
        | 'simple-pnl'
        | 'vat-summary'
        | 'accounts'
        | 'periods'
        | 'posting-errors'
        | 'settings';
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    lang: 'en' | 'bn';
    onToggleLang: () => void;
}

export default function AccountingNav({
    active,
    settings,
    permissions,
    lang,
    onToggleLang,
}: AccountingNavProps) {
    const isBn = lang === 'bn';
    const isAdvanced = settings.mode === 'advanced';

    const items = [
        {
            key: 'overview',
            href: route('accounting.overview'),
            label: isBn ? 'ওভারভিউ' : 'Overview',
            icon: BarChart3,
            show: isAdvanced && permissions.reports_view,
        },
        {
            key: 'dashboard',
            href: isAdvanced ? route('accounting.dashboard', { simple: 1 }) : route('accounting.dashboard'),
            label: isBn ? 'ড্যাশবোর্ড' : isAdvanced ? 'Quick Entry' : 'Dashboard',
            icon: LayoutDashboard,
            show: permissions.view,
        },
        {
            key: 'vouchers',
            href: route('accounting.vouchers.index'),
            label: isBn ? 'ভাউচার' : 'Vouchers',
            icon: ReceiptText,
            show: permissions.view,
        },
        {
            key: 'journal',
            href: route('accounting.journal.index'),
            label: isBn ? 'জার্নাল' : 'Journal',
            icon: NotebookPen,
            show: isAdvanced && permissions.journal_create,
        },
        {
            key: 'ledger',
            href: route('accounting.ledger'),
            label: isBn ? 'খতিয়ান' : 'Ledger',
            icon: BookText,
            show: isAdvanced && permissions.reports_view,
        },
        {
            key: 'trial-balance',
            href: route('accounting.trial-balance'),
            label: isBn ? 'রেওয়ামিল' : 'Trial Balance',
            icon: Scale,
            show: isAdvanced && permissions.reports_view,
        },
        {
            key: 'balance-sheet',
            href: route('accounting.balance-sheet'),
            label: isBn ? 'ব্যালেন্স শিট' : 'Balance Sheet',
            icon: FileSpreadsheet,
            show: isAdvanced && permissions.reports_view,
        },
        {
            key: 'parties',
            href: route('accounting.parties.index'),
            label: isBn ? 'পার্টি ও বকেয়া' : 'Parties',
            icon: Users,
            show: permissions.reports_view,
        },
        {
            key: 'day-book',
            href: route('accounting.day-book'),
            label: isBn ? 'দৈনিক খাতা' : 'Day Book',
            icon: BookOpen,
            show: permissions.reports_view,
        },
        {
            key: 'cash-book',
            href: route('accounting.cash-book'),
            label: isBn ? 'ক্যাশ বই' : 'Cash Book',
            icon: Landmark,
            show: permissions.reports_view,
        },
        {
            key: 'bank-book',
            href: route('accounting.bank-book'),
            label: isBn ? 'ব্যাংক বই' : 'Bank Book',
            icon: Landmark,
            show: permissions.reports_view,
        },
        {
            key: 'bank-reconciliation',
            href: route('accounting.bank-reconciliation.index'),
            label: isBn ? 'ব্যাংক রিকন' : 'Bank Recon',
            icon: Scale,
            show: isAdvanced && permissions.reports_view,
        },
        {
            key: 'operations',
            href: route('accounting.operations.index'),
            label: isBn ? 'বেতন ও স্টক' : 'Payroll & Stock',
            icon: ReceiptText,
            show: isAdvanced && permissions.voucher_create,
        },
        {
            key: 'extra-reports',
            href: route('accounting.extra-reports'),
            label: isBn ? 'ক্যাশ ফ্লো ও রিপোর্ট' : 'Cash Flow & Reports',
            icon: BarChart3,
            show: permissions.reports_view,
        },
        {
            key: 'simple-pnl',
            href: route('accounting.simple-pnl'),
            label: isBn ? 'লাভ-ক্ষতি' : 'P&L',
            icon: FileSpreadsheet,
            show: permissions.reports_view,
        },
        {
            key: 'vat-summary',
            href: route('accounting.vat-summary'),
            label: isBn ? 'ভ্যাট' : 'VAT',
            icon: Percent,
            show: permissions.reports_view,
        },
        {
            key: 'accounts',
            href: route('accounting.accounts.index'),
            label: isBn ? 'COA' : 'COA',
            icon: FolderTree,
            show: isAdvanced && (permissions.coa_manage || permissions.view),
        },
        {
            key: 'periods',
            href: route('accounting.periods.index'),
            label: isBn ? 'সময়কাল' : 'Periods',
            icon: CalendarRange,
            show: isAdvanced && (permissions.period_close || permissions.period_reopen || permissions.view),
        },
        {
            key: 'posting-errors',
            href: route('accounting.posting-errors.index'),
            label: isBn ? 'ত্রুটি' : 'Errors',
            icon: AlertTriangle,
            show: isAdvanced && permissions.voucher_post,
        },
        {
            key: 'settings',
            href: route('accounting.settings.index'),
            label: isBn ? 'সেটিংস' : 'Settings',
            icon: Settings,
            show: permissions.settings_manage || permissions.view,
        },
    ].filter((i) => i.show);

    return (
        <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] px-3 py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 lg:pb-0">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.key === active;
                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold rounded-[2px] whitespace-nowrap transition-colors ${
                                isActive
                                    ? 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/30 dark:bg-[#0E5F3F]/20 dark:text-emerald-300'
                                    : 'text-[#444444] dark:text-slate-300 hover:bg-[#F5F7F4] dark:hover:bg-slate-800 border border-transparent'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <span
                    className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-[2px] border ${
                        isAdvanced
                            ? 'bg-blue-50 text-[#286090] border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900'
                            : 'bg-[#EAF5F0] text-[#0E5F3F] border-[#0E5F3F]/25 dark:bg-emerald-950/40 dark:text-emerald-300'
                    }`}
                >
                    {isAdvanced
                        ? isBn
                            ? 'অ্যাডভান্সড মোড'
                            : 'Advanced Mode'
                        : isBn
                          ? 'সহজ মোড'
                          : 'Simple Mode'}
                </span>

                <button
                    type="button"
                    onClick={onToggleLang}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-[#F5F7F4] dark:bg-slate-800 text-[#333333] dark:text-slate-200 hover:bg-slate-200/70 cursor-pointer"
                >
                    <Languages className="w-3.5 h-3.5 text-[#0E5F3F]" />
                    <span>{isBn ? 'English' : 'বাংলা'}</span>
                </button>
            </div>
        </div>
    );
}
