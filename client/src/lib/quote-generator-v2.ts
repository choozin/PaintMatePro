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
    const collectedMaterials: QuoteLineItem[] = [];

    // --- Helper Calculations ---
    const getPaintCost = (area: number) => {
        const gallons = Math.ceil(area / (project.supplyConfig?.coveragePerGallon || 350));
        return gallons * (project.supplyConfig?.pricePerGallon || 45);
    };

    const getLaborCost = (area: number, type: 'wall' | 'ceiling' | 'trim') => {
        // Simplified mock logic
        const rate = type === 'wall' ? 1.5 : type === 'ceiling' ? 1.0 : 2.0;
        return area * rate;
    };

    // --- SETUP & PREPARATION (Removed - Always Sub-line/Itemized) ---
    // User requested Prep always be part of the room/sub-line context.

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
                    paintItem.amount = (paintItem.amount || 0) + wallPaint;
                    if (paintItem.rate !== undefined && paintItem.quantity) {
                        paintItem.rate += (wallPaint / paintItem.quantity);
                    }
                }
                if (config.paintDetails?.showName) {
                    paintItem.description += ` (${productName})`;
                }
                if (config.paintDetails?.showCoats) {
                    const coats = project.supplyConfig?.wallCoats || 2;
                    paintItem.description += ` - ${coats} Coats`;
                }
            } else if (config.paintPlacement === 'subline') {
                const gallons = Math.ceil(wallArea / (project.supplyConfig?.coveragePerGallon || 350));
                let subDesc = config.paintDetails?.showName ? productName : "Paint Material";
                if (config.paintDetails?.showVolume) subDesc += ` (${gallons} gal)`;
                if (config.paintDetails?.showCoats) subDesc += ` - ${project.supplyConfig?.wallCoats || 2} Coats`;

                const shouldShowPrice = config.paintDetails?.showPrice ?? true;
                const costOnLine = (isBillable && shouldShowPrice);

                paintItem.subItems?.push({
                    id: `paint-mat-${room.id}`,
                    description: subDesc,
                    quantity: gallons,
                    unit: 'gal',
                    rate: costOnLine ? (project.supplyConfig?.pricePerGallon || 45) : 0,
                    amount: costOnLine ? (isBillable ? wallPaint : 0) : undefined,
                    type: 'material'
                });

                if (isBillable && !shouldShowPrice) {
                    paintItem.amount = (paintItem.amount || 0) + wallPaint;
                    if (paintItem.rate !== undefined && paintItem.quantity) {
                        paintItem.rate += (wallPaint / paintItem.quantity);
                    }
                }
            }

            // --- MATERIAL HANDLER (Room Specific) ---
            const roomMaterials = room.materialItems || [];
            if (roomMaterials.length > 0) {
                if (config.materialPlacement === 'inline') {
                    // Absorb
                    paintItem.amount = (paintItem.amount || 0) + roomMaterials.reduce((s: number, m: any) => s + (m.rate * m.quantity), 0);
                } else if (config.materialPlacement === 'subline') {
                    // SubItems
                    roomMaterials.forEach((m: any) => {
                        paintItem.subItems?.push({
                            id: `mat-${room.id}-${m.id}`,
                            description: m.name,
                            quantity: m.quantity,
                            unit: m.unit,
                            rate: m.rate,
                            amount: m.rate * m.quantity,
                            type: 'material'
                        });
                    });
                } else if (config.materialPlacement === 'separate_area') {
                    // Collect
                    roomMaterials.forEach((m: any) => {
                        collectedMaterials.push({
                            id: `mat-${room.id}-${m.id}`,
                            description: `${m.name} (${room.name})`,
                            quantity: m.quantity,
                            unit: m.unit,
                            rate: m.rate,
                            amount: m.rate * m.quantity,
                            type: 'material',
                            groupTitle: "Materials"
                        });
                    });
                }
            }

            lines.push(paintItem);

            // Ceilings
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

            // Prep Tasks
            if (room.prepTasks && room.prepTasks.length > 0) {
                if (config.prepStrategy === 'group_total') {
                    const totalPrep = room.prepTasks.reduce((s: number, t: any) => s + (t.unit === 'fixed' ? t.rate : (t.rate * t.quantity)), 0);
                    lines.push({
                        id: `prep-group-${room.id}`,
                        description: "Room Preparation",
                        amount: totalPrep,
                        type: 'prep',
                        groupTitle: room.name
                    });
                } else {
                    room.prepTasks.forEach((task: any) => {
                        lines.push({
                            id: `prep-${room.id}-${task.id}`,
                            description: task.name,
                            quantity: task.quantity,
                            unit: task.unit,
                            rate: task.rate,
                            amount: task.unit === 'fixed' ? task.rate : task.rate * task.quantity,
                            type: 'prep',
                            groupTitle: room.name
                        });
                    });
                }
            }

            // Misc Items
            if (room.miscItems && room.miscItems.length > 0) {
                room.miscItems.forEach((item: any) => {
                    lines.push({
                        id: `misc-${room.id}-${item.id}`,
                        description: item.name,
                        quantity: item.quantity,
                        unit: item.unit,
                        rate: item.rate,
                        amount: item.unit === 'fixed' ? item.rate : (item.rate * item.quantity),
                        type: 'labor',
                        groupTitle: room.name
                    });
                });
            }
        });
    } else {
        // BY ACTIVITY (Simplified for restoration)
        lines.push({ id: 'h-walls', description: "Walls", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Walls" });
        rooms.forEach(room => {
            lines.push({
                id: `walls-${room.id}`,
                description: `${room.name} Walls`,
                quantity: (room.length + room.width) * 2 * room.height,
                unit: 'sqft',
                amount: getLaborCost((room.length + room.width) * 2 * room.height, 'wall'),
                type: 'labor',
                groupTitle: "Walls"
            });
        });
    }

    // --- GLOBAL ADDITIONAL ITEMS ---
    if (project.globalMiscItems && project.globalMiscItems.length > 0) {
        lines.push({ id: 'h-global-misc', description: "Additional Work Items", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Additional Work Items" });
        project.globalMiscItems.forEach((item: any) => lines.push({
            id: `global-misc-${item.id}`,
            description: item.name,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            amount: item.unit === 'fixed' ? item.rate : (item.rate * item.quantity),
            type: 'labor',
            groupTitle: "Additional Work Items"
        }));
    }

    // --- GLOBAL MATERIALS ---
    const globalMaterials = project.globalMaterialItems || [];
    if (globalMaterials.length > 0) {
        if (config.materialPlacement === 'separate_area') {
            globalMaterials.forEach((m: any) => {
                collectedMaterials.push({
                    id: `mat-global-${m.id}`,
                    description: m.name,
                    quantity: m.quantity,
                    unit: m.unit,
                    rate: m.rate,
                    amount: m.rate * m.quantity,
                    type: 'material',
                    groupTitle: "Materials"
                });
            });
        } else {
            // Subline OR Inline: List them as individual Line Items under PROJECT MATERIALS
            // For Global Materials, "Inline" vs "Subline" is effectively the same (just listing them),
            // because there is no "Room" to absorb them into.

            // Add Header if not exists (check logical flow, usually we just add it once)
            lines.push({ id: 'h-proj-mat', description: "Project Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Project Materials" });

            globalMaterials.forEach((m: any) => {
                lines.push({
                    id: `global-mat-${m.id}`,
                    description: m.name,
                    quantity: m.quantity,
                    unit: m.unit,
                    rate: m.rate,
                    amount: m.rate * m.quantity,
                    type: 'material',
                    groupTitle: "Project Materials"
                });
            });
        }
    }

    // --- SEPARATE PAINT (Combined Strategy) ---
    // Calculate Total Paint Cost dynamically
    let totalWallArea = 0;
    rooms.forEach(r => totalWallArea += (r.length + r.width) * 2 * r.height);
    const totalPaintCost = getPaintCost(totalWallArea);

    // If Paint is separate and Materials is separate & combined...
    if (config.paintPlacement === 'separate_area' && config.materialPlacement === 'separate_area' && config.separateAreaStrategy === 'combined') {
        lines.push({ id: 'h-pm', description: "Paint & Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Paint & Materials" });
        lines.push({
            id: 'paint-total-c',
            description: "Paint Products",
            amount: totalPaintCost,
            type: 'material',
            groupTitle: "Paint & Materials"
        });
        collectedMaterials.forEach(m => lines.push(m)); // Dump materials here
    }
    else {
        // Handle Paint Separate (Standalone)
        if (config.paintPlacement === 'separate_area') {
            lines.push({ id: 'h-paint', description: "Paint Products", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Paint Products" });
            lines.push({
                id: 'paint-total',
                description: "Paint Products (Bulk)",
                amount: totalPaintCost,
                type: 'material',
                groupTitle: "Paint Products"
            });
        }

        // Handle Materials Separate (Standalone)
        if (collectedMaterials.length > 0) {
            lines.push({ id: 'h-materials-section', description: "Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Materials" });
            if (config.materialStrategy === 'group_total') {
                const total = collectedMaterials.reduce((s, m) => s + (m.amount || 0), 0);
                lines.push({
                    id: 'mat-group-total',
                    description: "Materials Package",
                    amount: total,
                    type: 'material',
                    groupTitle: "Materials"
                });
            } else {
                collectedMaterials.forEach(m => lines.push(m));
            }
        }
    }

    return lines;
}

export function flattenQuoteLines(lines: QuoteLineItem[]): any[] {
    const flat: any[] = [];
    lines.forEach(item => {
        if (item.type === 'header') {
            flat.push({
                description: item.description.toUpperCase(),
                quantity: 0, rate: 0, unit: '', isHeader: true
            });
        } else {
            flat.push({
                description: item.description,
                quantity: item.quantity || 1,
                unit: item.unit || 'ea',
                rate: item.rate || item.amount,
                unitCost: 0
            });
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
