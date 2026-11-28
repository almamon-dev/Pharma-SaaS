import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { SlidersHorizontal } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    BrtaField,
    BrtaFormFooter,
    BrtaFormGrid,
    brtaInputClass,
} from '@/Components/ui/BrtaForm';
import AccountingNav from './components/AccountingNav';
import {
    AccountingPermissions,
    AccountingSettingsData,
    useAccountingLang,
} from './types';

interface AccountOption {
    id: number;
    code: string;
    name_en: string;
    name_bn: string;
    type: string;
    report_group: string;
}

interface SettingsProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    accounts: AccountOption[];
}

export default function AccountingSettings({
    settings,
    permissions,
    accounts,
}: SettingsProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const mode: 'simple' | 'advanced' = 'simple';
    const [fyMonth, setFyMonth] = useState(String(settings.fiscal_year_start_month));
    const [vatEnabled, setVatEnabled] = useState(settings.vat_enabled);
    const [vatRate, setVatRate] = useState(String(settings.vat_rate_percent));
    const [threshold, setThreshold] = useState(settings.approval_threshold_bdt);
    const [cashAcc, setCashAcc] = useState(String(settings.default_cash_account_id ?? ''));
    const [bankAcc, setBankAcc] = useState(String(settings.default_bank_account_id ?? ''));
    const [walletAcc, setWalletAcc] = useState(String(settings.default_wallet_account_id ?? ''));
    const [saving, setSaving] = useState(false);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        router.put(
            route('accounting.settings.update'),
            {
                mode,
                fiscal_year_start_month: Number(fyMonth),
                vat_enabled: vatEnabled,
                vat_rate_percent: Number(vatRate) || 0,
                approval_threshold_bdt: threshold || '0',
                default_cash_account_id: cashAcc ? Number(cashAcc) : null,
                default_bank_account_id: bankAcc ? Number(bankAcc) : null,
                default_wallet_account_id: walletAcc ? Number(walletAcc) : null,
            },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
            }
        );
    };

    return (
        <AppLayout title={isBn ? 'হিসাব সেটিংস' : 'Accounting Settings'}>
            <Head title="Accounting Settings" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="settings"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                <form
                    onSubmit={handleSave}
                    className="bg-white dark:bg-[#151921] border border-[#CCCCCC] dark:border-slate-800 rounded-[4px] overflow-hidden"
                >
                    <div className="px-6 py-3.5 border-b border-[#E5E7EB] dark:border-slate-800 bg-[#F8FAF8] dark:bg-[#12161c] flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-[#0E5F3F] shrink-0" />
                        <div>
                            <h1 className="text-[15px] font-bold text-[#222222] dark:text-white">
                                {isBn ? 'অ্যাকাউন্টিং মোড ও সেটিংস' : 'Accounting Mode & Configuration'}
                            </h1>
                            <p className="text-[11.5px] text-[#666666] dark:text-slate-400">
                                {isBn
                                    ? 'সহজ আয়-ব্যয় ভিত্তিক সিঙ্গেল এন্ট্রি হিসাব।'
                                    : 'Simple single-entry income & expense bookkeeping.'}
                            </p>
                        </div>
                    </div>

                    <div className="px-6 py-5 space-y-5">
                        {/* Mode: always Simple */}
                        <div className="p-4 rounded-[2px] border border-[#0E5F3F] bg-[#EAF5F0]/70 dark:bg-emerald-950/25">
                            <div className="font-bold text-[14px] text-[#222222] dark:text-white">
                                {isBn ? 'সহজ মোড (Simple Mode)' : 'Simple Mode (Owner Friendly)'}
                            </div>
                            <p className="text-[12px] text-[#555555] dark:text-slate-400 mt-1">
                                {isBn
                                    ? 'দোকান মালিকদের জন্য সহজ আয়-ব্যয় এন্ট্রি। ডেবিট/ক্রেডিট বা ব্যালেন্স শিট ছাড়াই পরিষ্কার রিপোর্ট।'
                                    : 'Plain-language Income & Expense entry, Day Book, Cash & Bank, and Simple P&L without debit/credit jargon.'}
                            </p>
                        </div>

                        <BrtaFormGrid>
                            <BrtaField label={isBn ? 'অর্থবছর শুরুর মাস' : 'Fiscal Year Start'}>
                                <select
                                    value={fyMonth}
                                    onChange={(e) => setFyMonth(e.target.value)}
                                    className={brtaInputClass}
                                >
                                    {[
                                        [7, 'July (Bangladesh Standard FY)'],
                                        [1, 'January (Calendar Year)'],
                                        [4, 'April'],
                                        [10, 'October'],
                                    ].map(([m, label]) => (
                                        <option key={m} value={m}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </BrtaField>

                            <BrtaField label={isBn ? 'ভ্যাট হার (%)' : 'Default VAT Rate (%)'}>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={vatEnabled}
                                        onChange={(e) => setVatEnabled(e.target.checked)}
                                        className="table-checkbox"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="50"
                                        disabled={!vatEnabled}
                                        value={vatRate}
                                        onChange={(e) => setVatRate(e.target.value)}
                                        className={`${brtaInputClass} flex-1 font-mono`}
                                    />
                                </div>
                            </BrtaField>

                            <BrtaField label={isBn ? 'অনুমোদন সীমা (৳)' : 'Approval Threshold (৳)'}>
                                <input
                                    type="text"
                                    value={threshold}
                                    onChange={(e) => setThreshold(e.target.value)}
                                    placeholder="0.00"
                                    className={`${brtaInputClass} font-mono`}
                                />
                            </BrtaField>

                            <BrtaField label="Default Cash Account">
                                <select
                                    value={cashAcc}
                                    onChange={(e) => setCashAcc(e.target.value)}
                                    className={brtaInputClass}
                                >
                                    {accounts
                                        .filter((a) => a.report_group === 'cash')
                                        .map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.code} — {a.name_en}
                                            </option>
                                        ))}
                                </select>
                            </BrtaField>

                            <BrtaField label="Default Bank Account">
                                <select
                                    value={bankAcc}
                                    onChange={(e) => setBankAcc(e.target.value)}
                                    className={brtaInputClass}
                                >
                                    {accounts
                                        .filter((a) => a.report_group === 'bank')
                                        .map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.code} — {a.name_en}
                                            </option>
                                        ))}
                                </select>
                            </BrtaField>

                            <BrtaField label="Default bKash / Nagad">
                                <select
                                    value={walletAcc}
                                    onChange={(e) => setWalletAcc(e.target.value)}
                                    className={brtaInputClass}
                                >
                                    {accounts
                                        .filter((a) => a.report_group === 'bank')
                                        .map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.code} — {a.name_en}
                                            </option>
                                        ))}
                                </select>
                            </BrtaField>
                        </BrtaFormGrid>
                    </div>

                    {permissions.settings_manage && (
                        <BrtaFormFooter
                            submitLabel={isBn ? 'সেটিংস সংরক্ষণ করুন' : 'Save Settings'}
                            submitting={saving}
                        />
                    )}
                </form>
            </div>
        </AppLayout>
    );
}

