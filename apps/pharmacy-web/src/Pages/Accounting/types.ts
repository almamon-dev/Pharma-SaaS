export interface AccountingSettingsData {
    mode: 'simple' | 'advanced';
    coa_template: 'pharmacy' | 'distributor' | 'hospital_pharmacy';
    fiscal_year_start_month: number;
    default_currency: string;
    vat_enabled: boolean;
    vat_rate_bps: number;
    vat_rate_percent: number;
    approval_threshold_paisa: number;
    approval_threshold_bdt: string;
    default_cash_account_id: number | null;
    default_bank_account_id: number | null;
    default_wallet_account_id: number | null;
    default_receivable_account_id: number | null;
    default_payable_account_id: number | null;
    default_inventory_account_id: number | null;
    default_cogs_account_id: number | null;
    default_sales_account_id: number | null;
    default_vat_input_account_id: number | null;
    default_vat_output_account_id: number | null;
}

export interface AccountingPermissions {
    view: boolean;
    expense_create: boolean;
    voucher_create: boolean;
    voucher_post: boolean;
    voucher_approve: boolean;
    voucher_reverse: boolean;
    journal_create: boolean;
    coa_manage: boolean;
    period_close: boolean;
    period_reopen: boolean;
    reports_view: boolean;
    settings_manage: boolean;
    cost_and_profit_view: boolean;
    all_branches: boolean;
}

export interface AccountingBranchOption {
    id: number;
    name: string;
    code: string;
}

export interface SimpleCategoryItem {
    id: number;
    kind: 'income' | 'expense';
    code: string;
    name_en: string;
    name_bn: string;
    debit_account_id: number | null;
    credit_account_id: number | null;
}

export interface PlainVoucherItem {
    id: number;
    number: string | null;
    type: string;
    date: string;
    status: 'draft' | 'pending_approval' | 'posted' | 'reversed';
    direction: 'in' | 'out' | 'transfer';
    amount_paisa: number;
    category_en: string;
    category_bn: string;
    payment_method: string;
    narration: string | null;
    branch_name: string;
    branch_code: string;
    created_by: string;
    is_reversal: boolean;
    reversed_by_number: string | null;
    reversal_of_number: string | null;
    lines: Array<{
        id: number;
        account_code: string;
        account_name_en: string;
        account_name_bn: string;
        debit_paisa: number;
        credit_paisa: number;
        narration: string | null;
    }>;
}

/**
 * Pure integer paisa formatter — never uses floating-point division for currency display.
 */
export function formatPaisa(paisa: number | null | undefined): string {
    if (paisa === null || paisa === undefined) return '—';
    const intVal = Math.trunc(paisa);
    const negative = intVal < 0;
    const abs = Math.abs(intVal);
    const taka = Math.floor(abs / 100);
    const rem = abs % 100;
    const takaStr = taka.toLocaleString('en-US');
    const remStr = String(rem).padStart(2, '0');
    return `${negative ? '-৳' : '৳'}${takaStr}.${remStr}`;
}

export function useAccountingLang(): ['en' | 'bn', () => void] {
    const [lang, setLang] = React.useState<'en' | 'bn'>(() => {
        if (typeof window === 'undefined') return 'en';
        return window.localStorage.getItem('accounting_ui_lang') === 'bn' ? 'bn' : 'en';
    });

    const toggle = () => {
        setLang((prev) => {
            const next = prev === 'en' ? 'bn' : 'en';
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('accounting_ui_lang', next);
            }
            return next;
        });
    };

    return [lang, toggle];
}

import React from 'react';

