export interface TaxLine {
    name: string;
    rate: number;
    amount: number;
}

/**
 * Calculates detailed tax lines based on a subtotal and an array of tax definitions.
 */
export function calculateTaxLines(subtotal: number, taxes: Array<{ name: string; rate: number }>): {
    taxLines: TaxLine[];
    taxTotal: number;
} {
    const taxLines = taxes.map(t => {
        const amount = subtotal * (t.rate / 100);
        return {
            name: t.name,
            rate: t.rate,
            amount: amount
        };
    });

    const taxTotal = taxLines.reduce((sum, line) => sum + line.amount, 0);

    return {
        taxLines,
        taxTotal
    };
}

/**
 * Backward compatibility helper to migrate single tax rate to multi-tax line.
 */
export function migrateLegacyTax(name: string = 'Tax', rate: number = 0, subtotal: number) {
    return calculateTaxLines(subtotal, [{ name, rate }]);
}
