import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { QuoteConfiguration } from '@/types/quote-config';
import { generateQuoteLinesV2 } from '@/lib/quote-generator-v2';

// Copying Mock Data locally for preview purposes or importing if shared. 
// Assuming shared mock data structure for consistency.
const MOCK_PROJECT: any = {
    name: "Sample Project",
    supplyConfig: {
        wallCoats: 2,
        coveragePerGallon: 350,
        pricePerGallon: 48,
        deductionFactor: 0.15,
        wallProduct: { name: "Benjamin Moore Regal Select", pricePerGallon: 48 },
        ceilingProduct: { name: "Waterborne Ceiling Paint", pricePerGallon: 42 },
        ceilingCoats: 2,
        ceilingCoverage: 400,
        includeTrim: false,
        trimProduct: { name: "Advance Satin", pricePerGallon: 65, unitPrice: 65 },
        includeWallpaperRemoval: true,
        wallpaperRemovalRate: 0.75,
        billablePaint: true,
        includePrimer: true
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
        {
            id: 'stair',
            name: 'Refinish Staircase',
            unit: 'sqft',
            quantity: 120,
            rate: 12.50,
            roomId: 'global',
            prepTasks: [
                { id: 'stair_sand', name: 'Sanding', unit: 'sqft', quantity: 120, rate: 2.00 }
            ]
        },
    ],
    globalPrepTasks: [
        { id: 'gp1', name: 'Mask Floors', unit: 'sqft', quantity: 0, rate: 0.15, globalId: 'gp1', roomId: 'global' },
    ]
};

const MOCK_CATALOG: any[] = [
    { id: 'prod_bm_regal', name: 'Benjamin Moore Regal Select', unitPrice: 48 },
    { id: 'prod_trim', name: 'Benjamin Moore Advance', unitPrice: 55 }
];

const MOCK_ROOMS: any[] = [
    {
        id: '1', name: 'Living Room', length: 20, width: 15, height: 9,
        prepTasks: [
            { id: 'p_move', name: 'Move Heavy Furniture', unit: 'fixed', quantity: 1, rate: 120 },
            { id: 'p_wall', name: 'Remove Wallpaper', unit: 'sqft', quantity: 100, rate: 2.50 }
        ]
    },
    {
        id: '2', name: 'Master Bedroom', length: 16, width: 14, height: 9,
        prepTasks: [
            { id: 'p_sand_k', name: 'Sand Trim', unit: 'ft', quantity: 51, rate: 0.50, linkedWorkItemId: 'w_trim' }
        ],
        materialItems: [
            { id: 'mat_stencil', name: 'Custom Stencil Template', quantity: 3, rate: 75, unit: 'ea', type: 'material' }
        ],
        miscItems: [
            { id: 'w_trim', name: 'Paint Trim', unit: 'linear_ft', quantity: 51, width: 6, rate: 1.50, paintProductId: 'prod_trim', coverage: 350 },
            { id: 'w_win1', name: 'Window Frame Painting', unit: 'linear_ft', quantity: 12, width: 4, rate: 3.00, paintProductId: 'prod_trim', coverage: 350 },
            { id: 'w_win2', name: 'Window Frame Painting', unit: 'linear_ft', quantity: 12, width: 4, rate: 3.00, paintProductId: 'prod_trim', coverage: 350 }
        ]
    }
];

interface QuotePreviewProps {
    config: QuoteConfiguration;
    orgBranding?: any;
    showMobilePreview?: boolean;
}

export function QuotePreview({ config, orgBranding, showMobilePreview }: QuotePreviewProps) {

    // Generate Line Items
    const lineItems = useMemo(() => {
        return generateQuoteLinesV2(MOCK_PROJECT, MOCK_ROOMS, config, MOCK_CATALOG);
    }, [config]);

    // Refs & State
    const containerRef = useRef<HTMLDivElement>(null);
    const paperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [paperHeight, setPaperHeight] = useState(1056); // Default min height

    // Auto-Fit Logic
    const fitToWidth = () => {
        if (!containerRef.current) return;
        const { clientWidth } = containerRef.current;
        if (clientWidth <= 0) return;

        const paperWidthPixels = 816; // 8.5in * 96dpi
        const paddingPixels = 64; // Horizontal padding

        const targetScale = (clientWidth - paddingPixels) / paperWidthPixels;
        // Clamp scale reasonably so it's not microscopic or excessively huge
        const clampedScale = Math.min(Math.max(targetScale, 0.25), 1.5);

        setScale(clampedScale);
    };

    // Resize Observer
    useEffect(() => {
        if (!containerRef.current) return;

        const ro = new ResizeObserver(() => {
            // Debounce if needed, but direct call is usually responsive enough
            requestAnimationFrame(fitToWidth);
        });

        ro.observe(containerRef.current);
        // Initial fit
        fitToWidth();

        ro.observe(containerRef.current);
        // Initial fit
        fitToWidth();

        return () => ro.disconnect();
    }, [showMobilePreview]);

    // Observe Paper Height for Wrapper
    useEffect(() => {
        if (!paperRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                setPaperHeight(entry.contentRect.height);
            }
        });
        ro.observe(paperRef.current);
        return () => ro.disconnect();
    }, []);

    // Handlers
    const handleZoomIn = () => setScale(s => Math.min(s + 0.1, 2.5));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.1, 0.25));
    const handleReset = () => fitToWidth();

    // Calculate Totals
    const { subtotal, tax, total } = useMemo(() => {
        let s = 0;
        const traverse = (items: any[]) => {
            items.forEach(i => {
                if (i.type !== 'header') s += (i.amount || 0);
                if (i.subItems) traverse(i.subItems);
            });
        };
        traverse(lineItems);
        const t = config.showTaxLine ? s * 0.08 : 0;
        return { subtotal: s, tax: t, total: s + t };
    }, [lineItems, config.showTaxLine]);

    return (
        <div className="h-full w-full relative flex flex-col bg-gray-100/50">

            {/* Controls - Fixed Top Right */}
            <div className="absolute top-4 right-4 z-50 flex gap-2">
                <div className="flex items-center gap-1 bg-white border shadow-md rounded-md p-1">
                    <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8 hover:bg-gray-100" title="Zoom Out">
                        <ZoomOut className="h-4 w-4 text-gray-600" />
                    </Button>
                    <div className="w-10 text-center text-xs font-mono text-gray-600 select-none">
                        {Math.round(scale * 100)}%
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8 hover:bg-gray-100" title="Zoom In">
                        <ZoomIn className="h-4 w-4 text-gray-600" />
                    </Button>
                </div>
                <Button variant="default" size="sm" onClick={handleReset} className="h-10 px-3 shadow-md bg-white hover:bg-gray-50 text-gray-700 border" title="Fit Width">
                    <Maximize className="h-4 w-4 mr-2" />
                    Fit
                </Button>
            </div>

            {/* Scrollable Viewport */}
            {/* We attach the ref here because this is the container defining available width */}
            <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-8 custom-scrollbar">

                {/* Paper - Scaled via Transform */}
                <div ref={paperRef}
                    className="bg-white shadow-2xl origin-top transition-transform duration-100 ease-out"
                    style={{
                        width: '816px',        // Fixed internal width
                        minHeight: '1056px',   // Fixed internal min-height
                        transform: `scale(${scale})`,
                        // Margins ensure that when scaled up, the scrollable area grows
                        marginBottom: `${(scale - 1) * 1056}px`,
                        // Note: Horizontal scaling usually handled by flex center, but large scaling might need margin compensation
                        // For now flex justify-center handles horizontal centering well
                    }}
                >
                    <div className="w-full h-full p-12 flex flex-col">

                        {/* Header */}
                        <div className="flex justify-between items-start border-b pb-6 mb-8">
                            <div>
                                <div className="text-xl font-bold text-gray-800">{orgBranding?.name || "Your Company"}</div>
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

                        {/* Items */}
                        <div className="flex-1">
                            {/* Table Header */}
                            <div className="flex border-b border-gray-800 pb-2 mb-2 font-bold text-gray-700 text-[10px] uppercase tracking-wider">
                                <div className="flex-1">Description</div>
                                {config.showUnits && <div className="w-12 text-right">Qty</div>}
                                {config.showUnits && <div className="w-12 text-left pl-2">Unit</div>}
                                {config.showRates && <div className="w-20 text-right">Rate</div>}
                                <div className="w-20 text-right">Amount</div>
                            </div>

                            {lineItems.map((item) => {
                                if (item.type === 'header') {
                                    return (
                                        <div key={item.id} className="mt-6 mb-2 pt-2 border-t border-gray-100 first:mt-0 first:border-0 flex justify-between items-end">
                                            <h4 className="font-bold text-gray-800 text-sm">{item.description}</h4>
                                            {(item.amount || 0) > 0 && (
                                                <div className="font-bold text-gray-800 text-sm">${(item.amount || 0).toFixed(2)}</div>
                                            )}
                                        </div>
                                    );
                                }
                                return (
                                    <React.Fragment key={item.id}>
                                        <div className="flex items-start py-1.5 text-gray-600 text-[11px] leading-tight">
                                            <div className="flex-1 pr-4 font-medium text-gray-800">{item.description}</div>
                                            {config.showUnits && <div className="w-12 text-right text-gray-500">{item.quantity ? item.quantity.toFixed(0) : '-'}</div>}
                                            {config.showUnits && <div className="w-12 text-left pl-2 text-gray-400 text-[9px] uppercase tracking-wide pt-0.5">{item.quantity ? (item.unit === 'linear_ft' ? 'ft' : item.unit) : ''}</div>}
                                            {config.showRates && <div className="w-20 text-right text-gray-500">{item.rate ? `$${item.rate.toFixed(2)}` : '-'}</div>}
                                            <div className="w-20 text-right font-medium text-gray-800">{item.amount ? `$${item.amount.toFixed(2)}` : ''}</div>
                                        </div>
                                        {/* Sub Items */}
                                        {item.subItems?.map(sub => (
                                            <div key={sub.id} className="flex items-start py-1 text-gray-500 text-[10px] leading-tight pl-4">
                                                <div className="flex-1 pr-4 border-l-2 border-gray-100 pl-2">{sub.description}</div>
                                                {config.showUnits && <div className="w-12 text-right text-gray-500">{sub.quantity ? sub.quantity.toFixed(0) : '-'}</div>}
                                                {config.showUnits && <div className="w-12 text-left pl-2 text-gray-400 text-[9px] uppercase tracking-wide pt-0.5">{sub.quantity ? (sub.unit === 'linear_ft' ? 'ft' : sub.unit) : ''}</div>}
                                                {config.showRates && <div className="w-20 text-right text-gray-500">{sub.rate ? `$${sub.rate.toFixed(2)}` : ''}</div>}
                                                <div className="w-20 text-right text-gray-500">{sub.amount ? `$${sub.amount.toFixed(2)}` : ''}</div>
                                            </div>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        {/* Totals */}
                        <div className="mt-8 flex justify-end">
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
                        <div className="mt-12 text-[10px] text-gray-400 border-t pt-4 text-center">
                            {config.showDisclaimers && "Terms and conditions apply. Estimate valid for 30 days."}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
