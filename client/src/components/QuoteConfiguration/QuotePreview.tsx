import React, { useMemo } from 'react';
import { QuoteDisplayConfig } from '@/lib/firestore';
import { generateQuoteItems } from '@/lib/quote-engine';

// Mock Data for Preview
const MOCK_PROJECT: any = {
    name: "Sample Project",
    supplyConfig: {
        wallCoats: 2,
        coveragePerGallon: 350,
        pricePerGallon: 45,
        deductionFactor: 0.15,
        wallProduct: { name: "Benjamin Moore Regal Select", pricePerGallon: 45 },
        includeCeiling: true,
        includeTrim: true,
        includeWallpaperRemoval: true,
        wallpaperRemovalRate: 0.75
    },
    laborConfig: {
        laborPricePerSqFt: 1.50,
        difficultyFactor: 1.0,
        productionRate: 150,
        hourlyRate: 60
    },
    internalCostConfig: { method: 'standard', averageWage: 25 }
};

const MOCK_ROOMS: any[] = [
    { id: '1', name: 'Living Room', length: 20, width: 15, height: 9 }, // 350 sqft floor, ~630 wall
    { id: '2', name: 'Master Bedroom', length: 16, width: 14, height: 9 }, // 224 sqft floor, ~540 wall
    { id: '3', name: 'Kitchen', length: 12, width: 14, height: 9 } // 168 sqft floor, ~468 wall
];

const MOCK_COMMERCIAL_ROOMS: any[] = [
    { id: 'c1', name: 'Main Lobby', length: 30, width: 20, height: 12 },
    { id: 'c2', name: 'Conference Room A', length: 18, width: 14, height: 10 },
    { id: 'c3', name: 'Executive Office', length: 14, width: 12, height: 9 }
];

interface QuotePreviewProps {
    config: QuoteDisplayConfig;
    orgBranding?: any;
    variant?: 'residential' | 'commercial';
}

export function QuotePreview({ config, orgBranding, variant = 'residential' }: QuotePreviewProps) {

    const lineItems = useMemo(() => {
        const rooms = variant === 'commercial' ? MOCK_COMMERCIAL_ROOMS : MOCK_ROOMS;
        return generateQuoteItems(MOCK_PROJECT, rooms, config);
    }, [config, variant]);

    // Calculate totals based on line items
    const { subtotal, tax, total } = useMemo(() => {
        const s = lineItems.reduce((acc, item) => acc + item.total, 0);
        const t = config.showTaxLine ? s * 0.08 : 0;
        return { subtotal: s, tax: t, total: s + t };
    }, [lineItems, config.showTaxLine]);

    // Grouping helper: transform flat items into list with header objects
    const renderList = useMemo(() => {
        const list: any[] = [];
        let lastGroup = '';

        lineItems.forEach(item => {
            if (item.groupTitle && item.groupTitle !== lastGroup) {
                list.push({ isHeader: true, title: item.groupTitle });
                lastGroup = item.groupTitle;
            }
            list.push(item);
        });
        return list;
    }, [lineItems]);

    return (
        <div className="flex justify-center bg-gray-100/50 py-8 min-h-full">
            {/* Paper Container */}
            <div className="bg-white shadow-lg mx-auto relative overflow-hidden transition-all duration-300 flex flex-col box-border font-sans"
                style={{ width: '215.9mm', minHeight: '279.4mm', padding: '12.7mm' }}>

                {/* Header */}
                <div className="flex justify-between items-start border-b pb-6 mb-8">
                    <div>
                        {orgBranding?.logoUrl ? (
                            <img src={orgBranding.logoUrl} alt="Logo" className="h-10 w-auto object-contain mb-2" />
                        ) : (
                            <div className="text-xl font-bold text-gray-800">Your Company</div>
                        )}
                        <div className="text-xs text-gray-500">123 Painter Lane</div>
                        <div className="text-xs text-gray-500">Cityville, ST 12345</div>
                    </div>
                    <div className="text-right">
                        <h1 className="text-2xl font-bold text-primary mb-2">QUOTE</h1>
                        <div className="text-xs text-gray-500">Date: {new Date().toLocaleDateString()}</div>
                    </div>
                </div>

                {/* Client Info Mock */}
                <div className="mb-8 text-sm">
                    <h3 className="font-bold text-gray-700 mb-1">Prepared For:</h3>
                    <div>John Doe</div>
                    <div className="text-gray-500 text-xs">789 Client Street</div>
                </div>

                {/* Line Items Table */}
                <div className="w-full mb-6 flex-1">
                    <div className="flex border-b border-gray-800 pb-2 mb-2 font-bold text-gray-700 text-[10px] uppercase tracking-wider">
                        <div className="flex-1">Description</div>
                        {config.showQuantities && <div className="w-12 text-right">Qty</div>}
                        {config.showQuantities && <div className="w-12 text-left pl-2">Unit</div>}
                        {config.showRates && <div className="w-20 text-right">Rate</div>}
                        <div className="w-20 text-right">Amount</div>
                    </div>

                    {renderList.map((item, idx) => {
                        if (item.isHeader) {
                            return (
                                <div key={`head-${idx}`} className="mt-6 mb-2 pt-2 border-t border-gray-100 first:mt-0 first:border-0">
                                    <h4 className="font-bold text-gray-800 text-sm">{item.title}</h4>
                                </div>
                            );
                        }

                        return (
                            <div key={idx} className={`flex items-start py-1.5 text-gray-600 text-[11px] leading-tight ${item.isMaterial ? 'italic text-gray-400 pl-4' : ''}`}>
                                <div className="flex-1 pr-4">
                                    <div className="font-medium text-gray-800">{item.description}</div>
                                </div>
                                {config.showQuantities && <div className="w-12 text-right text-gray-500">{item.quantity > 0 ? item.quantity : '-'}</div>}
                                {config.showQuantities && <div className="w-12 text-left pl-2 text-gray-400 text-[9px] uppercase tracking-wide pt-0.5 max-w-[40px] truncate" title={item.unit}>{item.quantity > 0 ? item.unit : ''}</div>}
                                {config.showRates && <div className="w-20 text-right text-gray-500">${item.rate ? item.rate.toFixed(2) : '0.00'}</div>}
                                <div className="w-20 text-right font-medium text-gray-800">${item.total.toFixed(2)}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                    <div className="w-64 space-y-1">
                        {config.showSubtotals && (
                            <div className="flex justify-between text-gray-500 text-xs">
                                <span>Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                        )}

                        {config.showTaxLine && (
                            <div className="flex justify-between text-gray-500 text-xs">
                                <span>Tax (8.0%)</span>
                                <span>${tax.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg text-gray-800 border-t border-gray-300 pt-2 mt-2">
                            <span>Total</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Disclaimers */}
                <div className="mt-12 text-[10px] text-gray-400 border-t pt-4">
                    {config.showDisclaimers && (config.customFooterText || "Terms and conditions apply. Estimate valid for 30 days.")}
                </div>

            </div>
        </div>
    );
}
