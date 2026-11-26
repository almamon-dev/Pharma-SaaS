import React, { useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { DataTable, Column, EmptyState } from '@/Components/tables';
import { BrtaField, BrtaFormGrid, BrtaFormModal, BrtaOptionItem, BrtaOptionStrip, brtaInputClass } from '@/Components/ui/BrtaForm';
import AccountingNav from './components/AccountingNav';
import {
    AccountingPermissions,
    AccountingSettingsData,
    useAccountingLang,
} from './types';

interface AccountRow {
    id: number;
    parent_id: number | null;
    code: string;
    name_en: string;
    name_bn: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    report_group: string;
    is_contra: boolean;
    is_system: boolean;
    is_active: boolean;
    has_entries: boolean;
}

interface ChartOfAccountsProps {
    settings: AccountingSettingsData;
    permissions: AccountingPermissions;
    accounts: AccountRow[];
    reportGroups: string[];
}

export default function ChartOfAccounts({
    settings,
    permissions,
    accounts,
    reportGroups,
}: ChartOfAccountsProps) {
    const [lang, toggleLang] = useAccountingLang();
    const isBn = lang === 'bn';

    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [code, setCode] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [nameBn, setNameBn] = useState('');
    const [type, setType] = useState<AccountRow['type']>('expense');
    const [reportGroup, setReportGroup] = useState('operating_expense');
    const [isContra, setIsContra] = useState(false);
    const [busy, setBusy] = useState(false);

    const filtered = useMemo(
        () => (typeFilter === 'all' ? accounts : accounts.filter((a) => a.type === typeFilter)),
        [accounts, typeFilter]
    );

    const columns: Column<AccountRow>[] = useMemo(
        () => [
            {
                id: 'code',
                label: 'Code',
                render: (acc) => (
                    <span className="font-mono font-bold text-[#0E5F3F] dark:text-emerald-400 whitespace-nowrap">
                        {acc.code}
                    </span>
                ),
            },
            {
                id: 'name_en',
                label: 'Account Name (EN / বাংলা)',
                render: (acc) => (
                    <div>
                        <div className="font-semibold text-[#222222] dark:text-white flex items-center gap-1.5">
                            <span>{acc.name_en}</span>
                            {acc.is_system && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-semibold rounded-[2px] bg-slate-100 text-[#555555] border border-slate-200 dark:bg-slate-800 dark:text-slate-300">
                                    <Lock className="w-2.5 h-2.5" />
                                    System
                                </span>
                            )}
                            {acc.is_contra && (
                                <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded-[2px] bg-amber-50 text-amber-800 border border-amber-200">
                                    Contra
                                </span>
                            )}
                        </div>
                        <div className="text-[11.5px] text-[#666666] dark:text-slate-400">
                            {acc.name_bn}
                        </div>
                    </div>
                ),
            },
            {
                id: 'type',
                label: 'Type',
                render: (acc) => <span className="capitalize whitespace-nowrap">{acc.type}</span>,
            },
            {
                id: 'report_group',
                label: 'Report Group',
                render: (acc) => (
                    <span className="font-mono text-[12px] text-[#555555] dark:text-slate-400 whitespace-nowrap">
                        {acc.report_group}
                    </span>
                ),
            },
            {
                id: 'is_active',
                label: 'Status',
                render: (acc) => (
                    <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-[2px] whitespace-nowrap ${
                            acc.is_active
                                ? 'bg-[#EAF5F0] text-[#0E5F3F] border border-[#0E5F3F]/25'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                    >
                        {acc.is_active ? 'Active' : 'Inactive'}
                    </span>
                ),
            },
        ],
        []
    );

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        router.post(
            route('accounting.accounts.store'),
            {
                code,
                name_en: nameEn,
                name_bn: nameBn,
                type,
                report_group: reportGroup,
                is_contra: isContra,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setModalOpen(false);
                    setCode('');
                    setNameEn('');
                    setNameBn('');
                },
                onFinish: () => setBusy(false),
            }
        );
    };

    const handleToggle = (acc: AccountRow) => {
        router.patch(route('accounting.accounts.toggle', acc.id), {}, { preserveScroll: true });
    };

    const handleDelete = (acc: AccountRow) => {
        if (!window.confirm(`Delete unused account ${acc.code} (${acc.name_en})?`)) return;
        router.delete(route('accounting.accounts.destroy', acc.id), { preserveScroll: true });
    };

    return (
        <AppLayout title={isBn ? 'হিসাবের তালিকা (Chart of Accounts)' : 'Chart of Accounts'}>
            <Head title="Chart of Accounts" />

            <div className="w-full space-y-4">
                <AccountingNav
                    active="accounts"
                    settings={settings}
                    permissions={permissions}
                    lang={lang}
                    onToggleLang={toggleLang}
                />

                <div className="bg-white dark:bg-[#12161c] border border-[#D5DBD3] dark:border-slate-800 rounded-[2px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-[#222222] dark:text-white">
                            {isBn ? 'হিসাবের তালিকা (Chart of Accounts)' : 'Chart of Accounts'}
                        </h1>
                        <p className="text-[12.5px] text-[#555555] dark:text-slate-400 mt-0.5">
                            Template: <strong className="capitalize">{settings.coa_template.replace('_', ' ')}</strong> • System accounts cannot be deleted; accounts with posted entries can only be deactivated.
                        </p>
                    </div>
                    {permissions.coa_manage && (
                        <Button size="sm" variant="default" onClick={() => setModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-1" />
                            {isBn ? 'নতুন হিসাব যোগ করুন' : 'Add account'}
                        </Button>
                    )}
                </div>

                <DataTable<AccountRow>
                    tableId="accounting-coa-table"
                    data={filtered}
                    columns={columns}
                    keyExtractor={(acc) => acc.id}
                    searchPlaceholder={isBn ? 'কোড বা হিসাব খুঁজুন...' : 'Search code, account name, or group...'}
                    hideCheckbox
                    hideViewToggle
                    hideFilter
                    syncUrlParams={false}
                    headerTabs={
                        <div className="flex items-center gap-1.5 pb-1.5 flex-wrap">
                            {['all', 'asset', 'liability', 'equity', 'income', 'expense'].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTypeFilter(t)}
                                    className={`px-2.5 py-1 text-[12px] font-semibold rounded-[2px] capitalize cursor-pointer transition-colors ${
                                        typeFilter === t
                                            ? 'bg-[#0E5F3F] text-white'
                                            : 'bg-white dark:bg-slate-800 text-[#444444] dark:text-slate-300 border border-[#D5DBD3] dark:border-slate-700'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    }
                    actions={(acc) =>
                        permissions.coa_manage && !acc.is_system ? (
                            <div className="inline-flex items-center justify-end gap-1.5">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => handleToggle(acc)}
                                >
                                    {acc.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                                {!acc.has_entries && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(acc)}
                                        className="p-1.5 rounded-[2px] bg-[#D9534F] text-white hover:bg-[#C9302C] cursor-pointer"
                                        title="Delete unused account"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                        )
                    }
                    actionsColumnClassName="w-[140px] min-w-[140px]"
                    emptyState={<EmptyState title="No accounts found" />}
                />
            </div>

            <BrtaFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleCreate}
                title="Add Chart of Account"
                maxWidth="3xl"
                footerProps={{
                    cancelLabel: 'Cancel',
                    submitLabel: 'Create Account',
                    submitting: busy,
                }}
            >
                <BrtaFormGrid>
                    <BrtaField label="Account Code" required>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="6150"
                            className={`${brtaInputClass} font-mono`}
                            required
                        />
                    </BrtaField>
                    <BrtaField label="Account Type" required>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as AccountRow['type'])}
                            className={brtaInputClass}
                        >
                            <option value="asset">Asset</option>
                            <option value="liability">Liability</option>
                            <option value="equity">Equity</option>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                        </select>
                    </BrtaField>
                    <BrtaField label="Name (English)" required>
                        <input
                            type="text"
                            value={nameEn}
                            onChange={(e) => setNameEn(e.target.value)}
                            placeholder="Generator Fuel Expense"
                            className={brtaInputClass}
                            required
                        />
                    </BrtaField>
                    <BrtaField label="Name (বাংলা)" required>
                        <input
                            type="text"
                            value={nameBn}
                            onChange={(e) => setNameBn(e.target.value)}
                            placeholder="জেনারেটর জ্বালানি খরচ"
                            className={`${brtaInputClass} font-bengali`}
                            required
                        />
                    </BrtaField>
                    <BrtaField label="Report Group" required>
                        <select
                            value={reportGroup}
                            onChange={(e) => setReportGroup(e.target.value)}
                            className={`${brtaInputClass} font-mono`}
                        >
                            {reportGroups.map((rg) => (
                                <option key={rg} value={rg}>
                                    {rg}
                                </option>
                            ))}
                        </select>
                    </BrtaField>
                    <BrtaField label="Account Flag">
                        <BrtaOptionStrip>
                            <BrtaOptionItem>
                                <input
                                    type="checkbox"
                                    checked={isContra}
                                    onChange={(e) => setIsContra(e.target.checked)}
                                    className="accent-[#337AB7]"
                                />
                                <span>Contra Account</span>
                            </BrtaOptionItem>
                        </BrtaOptionStrip>
                    </BrtaField>
                </BrtaFormGrid>
            </BrtaFormModal>
        </AppLayout>
    );
}

