import { Languages } from 'lucide-react';
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
    settings,
    lang,
    onToggleLang,
}: AccountingNavProps) {
    const isBn = lang === 'bn';
    const isAdvanced = settings.mode === 'advanced';

    return (
        <div className="flex items-center justify-end gap-2">
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
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold rounded-[2px] border border-[#CCCCCC] dark:border-slate-700 bg-white dark:bg-[#12161c] text-[#333333] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
                <Languages className="w-3.5 h-3.5 text-[#0E5F3F]" />
                <span>{isBn ? 'English' : 'বাংলা'}</span>
            </button>
        </div>
    );
}
