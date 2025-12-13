import { QuoteConfiguration, LaborUnit, CostPlacement, ListingStrategy } from "@/types/quote-config";

export interface QuoteLineItem {
    id: string;
    description: string;
    quantity?: number;
    unit?: string;
    rate?: number;
    amount?: number;
    type: 'header' | 'labor' | 'material' | 'paint' | 'prep' | 'combined' | 'tax' | 'total';
    subItems?: QuoteLineItem[];
    isGroupHeader?: boolean;
    groupTitle?: string;
}

export function generateQuoteLinesV2(project: any, rooms: any[], config: QuoteConfiguration): QuoteLineItem[] {
    const lines: QuoteLineItem[] = [];

    // --- Helper Calculations ---
    const getPaintCost = (area: number) => {
        const gallons = Math.ceil(area / (project.supplyConfig?.coveragePerGallon || 350));
        return gallons * (project.supplyConfig?.pricePerGallon || 45);
    };

    const getLaborCost = (area: number, type: 'wall' | 'ceiling' | 'trim') => {
        // Simplified mock logic
        const rate = type === 'wall' ? 1.5 : type === 'ceiling' ? 1.0 : 2.0;
        return area * rate; // Mock rate
    };

    // --- SETUP & PREPARATION (If Separate Area) ---
    if (config.prepPlacement === 'separate_area') {
        const setupCost = 150; // Mock setup
        lines.push({
            id: 'setup-header',
            description: "Setup & Preparation",
            amount: 0,
            type: 'header',
            isGroupHeader: true,
            groupTitle: "Setup & Preparation"
        });
        lines.push({
            id: 'setup-base',
            description: "Project Setup & Protection",
            quantity: 1,
            unit: 'ea',
            rate: setupCost,
            amount: setupCost,
            type: 'prep',
            groupTitle: "Setup & Preparation"
        });
        // Add specific prep tasks here if they are "Separate Area"
        // For now using mock fix items
    }

    // --- CORE LISTING LOGIC ---
    if (config.listingStrategy === 'by_room') {
        rooms.forEach(room => {
            const roomHeader = {
                id: `room-${room.id}`,
                description: room.name,
                amount: 0,
                type: 'header' as const,
                isGroupHeader: true,
                groupTitle: room.name
            };
            lines.push(roomHeader);

            // Walls
            const wallArea = (room.length + room.width) * 2 * room.height;
            const wallLabor = getLaborCost(wallArea, 'wall');
            const wallPaint = getPaintCost(wallArea);

            // Primer Logic
            if (config.primerStrategy === 'separate_line') {
                lines.push({
                    id: `prime-${room.id}`,
                    description: `Prime Walls`,
                    quantity: config.laborUnit === 'geometric' ? wallArea : undefined,
                    unit: 'sqft',
                    rate: config.laborUnit === 'geometric' ? 0.50 : undefined,
                    amount: wallArea * 0.5,
                    type: 'prep',
                    groupTitle: room.name
                });
            }

            // Paint Line
            const paintItem: QuoteLineItem = {
                id: `paint-${room.id}`,
                description: "Paint Walls",
                quantity: config.laborUnit === 'geometric' ? wallArea : undefined,
                unit: 'sqft',
                rate: config.laborUnit === 'geometric' ? 1.50 : undefined,
                amount: wallLabor, // Base labor
                type: 'labor',
                groupTitle: room.name,
                subItems: []
            };

            // Handling Paint Placement
            const isBillable = project.supplyConfig?.billablePaint ?? true;
            const productName = project.supplyConfig?.wallProduct?.name || 'Standard Paint';

            if (config.paintPlacement === 'inline') {
                if (isBillable) {
                    paintItem.amount += wallPaint;
                    // Update rate if it exists (e.g. per sqft)
                    if (paintItem.rate !== undefined && paintItem.quantity) {
                        paintItem.rate += (wallPaint / paintItem.quantity);
                    }
                }

                if (config.paintDetails?.showName) {
                    paintItem.description += ` (${productName})`;
                }
                // If showName is off, we do NOT append "(includes Paint)" as per user request.

                if (config.paintDetails?.showCoats) {
                    const coats = project.supplyConfig?.wallCoats || 2;
                    paintItem.description += ` - ${coats} Coats`;
                }
            } else if (config.paintPlacement === 'subline') {
                const gallons = Math.ceil(wallArea / (project.supplyConfig?.coveragePerGallon || 350));

                let subDesc = config.paintDetails?.showName ? productName : "Paint Material";
                if (config.paintDetails?.showVolume) {
                    subDesc += ` (${gallons} gal)`;
                }
                if (config.paintDetails?.showCoats) {
                    const coats = project.supplyConfig?.wallCoats || 2;
                    subDesc += ` - ${coats} Coats`;
                }

                const shouldShowPrice = config.paintDetails?.showPrice ?? true;
                const costOnLine = (isBillable && shouldShowPrice);

                paintItem.subItems?.push({
                    id: `paint-mat-${room.id}`,
                    description: subDesc,
                    quantity: gallons,
                    unit: 'gal',
                    rate: costOnLine ? (project.supplyConfig?.pricePerGallon || 45) : 0,
                    amount: costOnLine ? (isBillable ? wallPaint : 0) : undefined // Hide amount if !showPrice
                });

                if (isBillable && !shouldShowPrice) {
                    // If we are hiding price on the subline, move cost to parent so it's not lost
                    paintItem.amount += wallPaint;
                    // And update parent rate
                    if (paintItem.rate !== undefined && paintItem.quantity) {
                        paintItem.rate += (wallPaint / paintItem.quantity);
                    }
                }
            }
            // If separate_area, we don't add it here.

            lines.push(paintItem);

            // Ceilings (if included)
            if (project.supplyConfig?.includeCeiling) {
                const ceilingArea = room.length * room.width;
                lines.push({
                    id: `ceiling-${room.id}`,
                    description: "Paint Ceiling",
                    quantity: ceilingArea,
                    unit: 'sqft',
                    rate: 1.00,
                    amount: getLaborCost(ceilingArea, 'ceiling'),
                    type: 'labor',
                    groupTitle: room.name
                });
            }
        });
    } else {
        // BY SURFACE / ACTIVITY

        // Walls Section
        lines.push({ id: 'h-walls', description: "Walls", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Walls" });
        rooms.forEach(room => {
            const wallArea = (room.length + room.width) * 2 * room.height;
            lines.push({
                id: `walls-${room.id}`,
                description: `${room.name} Walls`,
                quantity: wallArea,
                unit: 'sqft',
                amount: getLaborCost(wallArea, 'wall'),
                type: 'labor',
                groupTitle: "Walls"
            });
        });

        // Ceilings Section
        if (project.supplyConfig?.includeCeiling) {
            lines.push({ id: 'h-ceilings', description: "Ceilings", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Ceilings" });
            rooms.forEach(room => {
                const ceilingArea = room.length * room.width;
                lines.push({
                    id: `ceil-${room.id}`,
                    description: `${room.name} Ceiling`,
                    quantity: ceilingArea,
                    unit: 'sqft',
                    amount: getLaborCost(ceilingArea, 'ceiling'),
                    type: 'labor',
                    groupTitle: "Ceilings"
                });
            });
        }
    }

    // --- SEPARATE AREAS (Paint & Materials) ---
    if (config.paintPlacement === 'separate_area') {
        const totalPaintCost = getPaintCost(2000); // Mock total

        // Check 3.5 Strategy
        if (config.materialPlacement === 'separate_area' && config.separateAreaStrategy === 'combined') {
            // "Paint & Materials" Section handled below
        } else {
            if (config.paintDetails?.showName) {
                // Standard behavior: Header + Item with Name
                lines.push({ id: 'h-paint', description: "Paint Products", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Paint Products" });
                lines.push({
                    id: 'paint-total',
                    description: `${project.supplyConfig?.wallProduct?.name || 'Paint'} (Bulk)`,
                    amount: totalPaintCost,
                    type: 'material',
                    groupTitle: "Paint Products"
                });
            } else {
                // collapsed behavior: Single grouped line
                lines.push({
                    id: 'paint-total-grouped',
                    description: "Paint Products",
                    amount: totalPaintCost, // The user wants "sum total" on this line
                    type: 'material', // Treat as material so it shows cost
                    isGroupHeader: false, // It's a line item now
                    groupTitle: "Paint Products"
                });
            }
        }
    }

    if (config.materialPlacement === 'separate_area') {
        // If combined
        if (config.paintPlacement === 'separate_area' && config.separateAreaStrategy === 'combined') {
            lines.push({ id: 'h-pm', description: "Paint & Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Paint & Materials" });
            lines.push({
                id: 'paint-total-c',
                description: "Paint Products",
                amount: 500, // Mock
                type: 'material',
                groupTitle: "Paint & Materials"
            });
            lines.push({
                id: 'mat-total-c',
                description: "Consumable Materials",
                amount: 100, // Mock
                type: 'material',
                groupTitle: "Paint & Materials"
            });
        } else {
            lines.push({ id: 'h-mat', description: "Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Materials" });
            lines.push({
                id: 'mat-total',
                description: "Consumable Materials",
                amount: 100, // Mock
                type: 'material',
                groupTitle: "Materials"
            });
        }
    }

    return lines;
}

export function flattenQuoteLines(lines: QuoteLineItem[]): any[] {
    const flat: any[] = [];

    lines.forEach(item => {
        // Handle Header
        if (item.type === 'header') {
            flat.push({
                description: item.description.toUpperCase(),
                quantity: 0,
                unit: '',
                rate: 0,
                isHeader: true // Custom flag (QuoteBuilder might ignore or just show 0)
            });
        } else {
            // Main Item
            flat.push({
                description: item.description,
                quantity: item.quantity || 1,
                unit: item.unit || 'ea',
                rate: item.rate || item.amount, // Fallback to amount if rate missing (lump sum)
                unitCost: 0
            });

            // Sub Items
            if (item.subItems) {
                item.subItems.forEach(sub => {
                    flat.push({
                        description: `  — ${sub.description}`,
                        quantity: sub.quantity || 1,
                        unit: sub.unit || 'ea',
                        rate: sub.rate || sub.amount,
                        unitCost: 0
                    });
                });
            }
        }
    });

    return flat;
}
