const CURRENCY_SYMBOLS: Record<string, string> = {
    BDT: '৳',
    USD: '$',
    EUR: '€',
    GBP: '£',
};

export function getCurrencySymbol(currency = 'BDT'): string {
    return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}

export function formatCurrency(amount: number | string, currency = 'BDT'): string {
    const value = Number(amount || 0);
    const symbol = getCurrencySymbol(currency);

    return `${symbol}${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export function formatQuotaLimit(value: number): string {
    return value >= 999 ? 'Unlimited' : value.toLocaleString();
}

