export function formatCurrency(amount: number | string, currency = 'BDT'): string {
    const value = Number(amount || 0);
    const symbolMap: Record<string, string> = {
        BDT: '৳',
        USD: '$',
        EUR: '€',
        GBP: '£',
    };
    const symbol = symbolMap[currency] ?? `${currency} `;

    return `${symbol}${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export function formatQuotaLimit(value: number): string {
    return value >= 999 ? 'Unlimited' : value.toLocaleString();
}

