/**
 * Formats a numeric amount into a currency string based on organization settings.
 */
export function formatCurrency(amount: number, currency: string = 'USD', locale: string = 'en-US'): string {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency.toUpperCase(),
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch (error) {
        console.error(`Error formatting currency (${currency}):`, error);
        // Fallback to basic formatting
        const symbol = currency.toUpperCase() === 'CAD' ? 'CA$' : '$';
        return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

/**
 * Returns the currency symbol for a given currency code.
 */
export function getCurrencySymbol(currency: string = 'USD', locale: string = 'en-US'): string {
    try {
        const formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency.toUpperCase(),
        });
        return formatter.formatToParts(0).find(part => part.type === 'currency')?.value || '$';
    } catch {
        return '$';
    }
}
