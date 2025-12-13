import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { QuoteConfiguration } from '@/types/quote-config';
import { generateQuoteLinesV2 } from '@/lib/quote-generator-v2';

// Mock Data for Preview
const MOCK_PROJECT: any = {
    name: "Sample Project",
    supplyConfig: {
        wallCoats: 2,
        coveragePerGallon: 350,
        pricePerGallon: 48,
        deductionFactor: 0.15,
        wallProduct: { name: "Benjamin Moore Regal Select", pricePerGallon: 48 },
        includeCeiling: true,
        includeTrim: true,
        includeWallpaperRemoval: true,
        wallpaperRemovalRate: 0.75,
        billablePaint: true
    },
    globalMaterialItems: [
        { id: 'mat_pva', name: 'PVA Primer Seal', quantity: 2, unit: 'gal', rate: 45, type: 'material' }
    ],
    laborConfig: {
        laborPricePerSqFt: 1.50,
        difficultyFactor: 1.0,
        productionRate: 150,
        hourlyRate: 60
    },
    internalCostConfig: { method: 'standard', averageWage: 25 },
    globalMiscItems: [
        { id: 'stair', name: 'Refinish Staircase', unit: 'sqft', quantity: 120, rate: 12.50, roomId: 'global' },
    ],
    globalPrepTasks: [
        { id: 'gp1', name: 'Mask Floors', unit: 'sqft', quantity: 0, rate: 0.15, globalId: 'gp1', roomId: 'global' },
    ]
};

const MOCK_ROOMS: any[] = [
    {
        id: '1', name: 'Living Room', length: 20, width: 15, height: 9, // 350 sqft floor, ~630 wall
        prepTasks: [
            { id: 'p_move', name: 'Move Heavy Furniture', unit: 'fixed', quantity: 1, rate: 120 },
            { id: 'p_wall', name: 'Remove Wallpaper', unit: 'sqft', quantity: 100, rate: 2.50 }
        ]
    },
    {
        id: '2', name: 'Master Bedroom', length: 16, width: 14, height: 9, // 224 sqft floor, ~540 wall
        prepTasks: [
            { id: 'p_sand_k', name: 'Sand Trim', unit: 'ft', quantity: 51, rate: 0.50 }
        ],
        materialItems: [
            { id: 'mat_stencil', name: 'Custom Stencil Template', quantity: 3, rate: 75, unit: 'ea', type: 'material' }
        ],
        miscItems: [
            { id: 'w_trim', name: 'Paint Baseboards', unit: 'ft', quantity: 51, rate: 1.50 },
            { id: 'w_win1', name: 'Window Frame Painting', unit: 'ft', quantity: 12, rate: 3.00 },
            { id: 'w_win2', name: 'Window Frame Painting', unit: 'ft', quantity: 12, rate: 3.00 }
        ]
    },

];

interface QuotePreviewProps {
    config: QuoteConfiguration;
    orgBranding?: any;
}

export function QuotePreview({ config, orgBranding }: QuotePreviewProps) {

    const lineItems = useMemo(() => {
        return generateQuoteLinesV2(MOCK_PROJECT, MOCK_ROOMS, config);
    }, [config]);

    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    // Initial Fit to Width
    useEffect(() => {
        if (containerRef.current) {
            const { clientWidth } = containerRef.current;
            // Paper width is approx 816px (215.9mm * 3.78)
            const paperWidth = 816;
            const padding = 64; // Standard comfortable padding
            const targetScale = (clientWidth - padding) / paperWidth;
            if (targetScale > 0) {
                setScale(targetScale);
            }
        }
    }, []);

    const handleZoomIn = () => setScale(s => Math.min(s + 0.1, 2.0));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.1, 0.4));
    const handleReset = () => {
        if (containerRef.current) {
            const { clientWidth } = containerRef.current;
            const targetScale = (clientWidth - 2) / 816;
            setScale(targetScale);
        } else {
            setScale(1);
        }
    };

    // Calculate totals
    const { subtotal, tax, total } = useMemo(() => {
        let s = 0;
        const calculateTotal = (items: any[]) => {
            items.forEach(item => {
                s += (item.amount || 0);
                if (item.subItems) {
                    calculateTotal(item.subItems);
                }
            });
        };
        calculateTotal(lineItems);

        const t = config.showTaxLine ? s * 0.08 : 0;
        return { subtotal: s, tax: t, total: s + t };
    }, [lineItems, config.showTaxLine]);

    return (
        <div className="flex flex-col h-full bg-gray-100/50">
            {/* Toolbar */}
            <div className="flex items-center justify-end gap-2 p-2 bg-white border-b shadow-sm z-10">
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8 hover:bg-white shadow-sm" title="Zoom Out">
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <div className="w-12 text-center text-xs font-mono text-gray-600 select-none">
                        {Math.round(scale * 100)}%
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8 hover:bg-white shadow-sm" title="Zoom In">
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                </div>
                <div className="h-6 w-px bg-gray-200 mx-1" />
                <Button variant="outline" size="sm" onClick={handleReset} className="h-8 text-xs gap-2" title="Fit Width">
                    <Maximize className="h-3 w-3" />
                    Fit Width
                </Button>
            </div>

            {/* Scrollable Viewport */}
            <div ref={containerRef} className="flex-1 overflow-auto p-8 flex justify-center items-start">
                {/* Paper */}
                <div className="bg-white shadow-lg transition-all duration-200 flex flex-col box-border font-sans origin-top bg-white"
                    style={{
                        width: '215.9mm',
                        minHeight: '279.4mm',
                        padding: '12.7mm',
                        flexShrink: 0, // Prevent shrinking
                        transform: `scale(${scale})`, // Use transform for better browser support/rendering
                        marginBottom: `${(scale - 1) * 300}px`, // Simple compensation for vertical growth
                        marginRight: `${(scale - 1) * 200}px`  // Simple compensation for horizontal growth
                    }}>

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
                            {config.showUnits && <div className="w-12 text-right">Qty</div>}
                            {config.showUnits && <div className="w-12 text-left pl-2">Unit</div>}
                            {config.showRates && <div className="w-20 text-right">Rate</div>}
                            <div className="w-20 text-right">Amount</div>
                        </div>

                        {lineItems.map((item, idx) => {
                            if (item.type === 'header') {
                                return (
                                    <div key={item.id} className="mt-6 mb-2 pt-2 border-t border-gray-100 first:mt-0 first:border-0">
                                        <h4 className="font-bold text-gray-800 text-sm">{item.description}</h4>
                                    </div>
                                );
                            }

                            return (
                                <React.Fragment key={item.id}>
                                    <div className="flex items-start py-1.5 text-gray-600 text-[11px] leading-tight">
                                        <div className="flex-1 pr-4">
                                            <div className="font-medium text-gray-800">{item.description}</div>
                                        </div>
                                        {config.showUnits && <div className="w-12 text-right text-gray-500">{item.quantity ? item.quantity.toFixed(0) : '-'}</div>}
                                        {config.showUnits && <div className="w-12 text-left pl-2 text-gray-400 text-[9px] uppercase tracking-wide pt-0.5">{item.quantity ? item.unit : ''}</div>}
                                        {config.showRates && <div className="w-20 text-right text-gray-500">{item.rate !== undefined ? `$${item.rate.toFixed(2)}` : '-'}</div>}
                                        <div className="w-20 text-right font-medium text-gray-800">{item.amount !== undefined ? `$${item.amount.toFixed(2)}` : ''}</div>
                                    </div>
                                    {/* Sub Items */}
                                    {item.subItems && item.subItems.map(sub => (
                                        <div key={sub.id} className="flex items-start py-1 text-gray-500 text-[10px] leading-tight pl-4 italic">
                                            <div className="flex-1 pr-4 border-l-2 border-gray-100 pl-2">
                                                <div>{sub.description}</div>
                                            </div>
                                            {config.showRates && <div className="w-20 text-right text-gray-400">{sub.rate !== undefined ? `$${sub.rate.toFixed(2)}` : ''}</div>}
                                            <div className="w-20 text-right text-gray-500">{sub.amount !== undefined ? `$${sub.amount.toFixed(2)}` : ''}</div>
                                        </div>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                        <div className="w-64 space-y-1">
                            <div className="flex justify-between text-gray-500 text-xs">
                                <span>Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>

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
                        {config.showDisclaimers && "Terms and conditions apply. Estimate valid for 30 days."}
                    </div>

                </div>
            </div>
        </div>
    );
}
