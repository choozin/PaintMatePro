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

// --- Helper Class for Shared Paint Logic ---
class PaintUsageTracker {
    private products = new Map<string, {
        gallonsBought: number;
        usedArea: number; // Normalized area (e.g. sqft / coverage = gallons needed)
        productName: string;
    }>();

    // Returns: { cost: number, quantity: number, isShared: boolean, descriptionSuffix: string }
    registerUsage(productId: string, productName: string, area: number, coverage: number, pricePerGallon: number, excludeFromSharing: boolean = false): { cost: number, quantity: number, isShared: boolean, descriptionSuffix: string } {
        if (excludeFromSharing) {
            // Standalone calculation: Buy exactly what is needed (ceil) for this item
            const gallonsNeeded = area / (coverage || 350);
            const gallonsToBuy = Math.ceil(gallonsNeeded);
            return {
                cost: gallonsToBuy * pricePerGallon,
                quantity: gallonsToBuy,
                isShared: false,
                descriptionSuffix: ""
            };
        }

        if (!this.products.has(productId)) {
            this.products.set(productId, { gallonsBought: 0, usedArea: 0, productName });
        }

        const state = this.products.get(productId)!;
        const gallonsNeededForThisItem = area / (coverage || 350);

        // Calculate Total Gallons Needed so far (Project level including this item)
        // We track total 'gallons worth' of area
        const previousUsedGallons = state.usedArea / (coverage || 350);

        // Normalized used gallons
        const currentTotalUsedGallons = state.usedArea + gallonsNeededForThisItem;
        const totalGallonsToBuy = Math.ceil(currentTotalUsedGallons);

        // New gallons to purchase for this step
        let newGallonsToBuy = totalGallonsToBuy - state.gallonsBought;

        let isShared = false;

        if (newGallonsToBuy === 0) {
            isShared = true;
        } else {
            isShared = false;
        }

        state.usedArea += gallonsNeededForThisItem; // Track actual usage
        state.gallonsBought += newGallonsToBuy;

        if (isShared) {
            return {
                cost: 0,
                quantity: 0,
                isShared: true,
                descriptionSuffix: ` (Shared with previous tasks)`
            };
        } else {
            return {
                cost: newGallonsToBuy > 0 ? (newGallonsToBuy * pricePerGallon) : 0,
                quantity: newGallonsToBuy > 0 ? newGallonsToBuy : Math.ceil(gallonsNeededForThisItem),
                isShared: false,
                descriptionSuffix: ""
            };
        }
    }
}

export function generateQuoteLinesV2(project: any, rooms: any[], config: QuoteConfiguration, catalog: any[] = []): QuoteLineItem[] {
    const lines: QuoteLineItem[] = [];
    const collectedMaterials: QuoteLineItem[] = [];
    const paintTracker = new PaintUsageTracker();

    // --- Helper Calculations ---
    const getLaborCost = (area: number, type: 'wall' | 'ceiling' | 'trim') => {
        // Simplified mock logic
        const rate = type === 'wall' ? 1.5 : type === 'ceiling' ? 1.0 : 2.0;
        return area * rate;
    };

    // Legacy helper kept for bulk calc if needed, though we use tracker mostly
    const getPaintCost = (area: number) => {
        const gallons = Math.ceil(area / (project.supplyConfig?.coveragePerGallon || 350));
        return gallons * (project.supplyConfig?.pricePerGallon || 45);
    };

    // --- CORE LISTING LOGIC ---
    if (config.listingStrategy === 'by_room') {
        rooms.forEach((room: any) => {
            const linesForRoom: QuoteLineItem[] = [];

            // Walls
            const wallArea = (room.length + room.width) * 2 * room.height;
            const wallLabor = getLaborCost(wallArea, 'wall');

            // Paint Tracker - Walls
            const wallProd = project.supplyConfig?.wallProduct;
            const wallProdId = wallProd?.id || 'default_wall';
            const wallProdName = wallProd?.name || 'Standard Paint';
            const wallPrice = wallProd ? (wallProd.unitPrice || wallProd.price || wallProd.pricePerGallon || 45) : (project.supplyConfig?.pricePerGallon || 45);
            const wallCoverage = project.supplyConfig?.coveragePerGallon || 350;
            const wallCoats = project.supplyConfig?.wallCoats || 2;

            const wallPaintAlloc = paintTracker.registerUsage(wallProdId, wallProdName, wallArea * wallCoats, wallCoverage, wallPrice);

            // Primer Logic
            if (config.primerStrategy === 'separate_line') {
                linesForRoom.push({
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

            if (config.paintPlacement === 'inline') {
                if (isBillable) {
                    paintItem.amount = (paintItem.amount || 0) + wallPaintAlloc.cost;
                    if (paintItem.quantity && wallPaintAlloc.cost > 0) {
                        paintItem.rate = (paintItem.amount || 0) / paintItem.quantity;
                    }
                }
                if (config.paintDetails?.showName) {
                    paintItem.description += ` (${wallProdName})`;
                }
                if (wallPaintAlloc.isShared) {
                    paintItem.description += wallPaintAlloc.descriptionSuffix;
                }
                if (config.paintDetails?.showCoats) {
                    paintItem.description += ` - ${wallCoats} Coats`;
                }
            } else if (config.paintPlacement === 'subline') {
                let subDesc = config.paintDetails?.showName ? wallProdName : "Paint Material";
                if (wallPaintAlloc.isShared) {
                    subDesc += wallPaintAlloc.descriptionSuffix;
                } else if (config.paintDetails?.showVolume) {
                    subDesc += ` (${wallPaintAlloc.quantity} gal)`;
                }
                if (config.paintDetails?.showCoats) subDesc += ` - ${wallCoats} Coats`;

                const shouldShowPrice = config.paintDetails?.showPrice ?? true;
                const costOnLine = (isBillable && shouldShowPrice);

                paintItem.subItems?.push({
                    id: `paint-mat-${room.id}`,
                    description: subDesc,
                    quantity: wallPaintAlloc.quantity,
                    unit: 'gal',
                    rate: costOnLine ? (wallPaintAlloc.cost > 0 ? wallPrice : 0) : 0,
                    amount: costOnLine ? (isBillable ? wallPaintAlloc.cost : 0) : undefined,
                    type: 'material'
                });

                if (isBillable && !shouldShowPrice) {
                    paintItem.amount = (paintItem.amount || 0) + wallPaintAlloc.cost;
                    // Recalculate rate driven by amount update
                    if (paintItem.quantity) paintItem.rate = (paintItem.amount || 0) / paintItem.quantity;
                }
            } else if (config.paintPlacement === 'separate_area') {
                collectedMaterials.push({
                    id: `paint-mat-${room.id}`,
                    description: `${wallProdName} for ${room.name} Walls${wallPaintAlloc.isShared ? wallPaintAlloc.descriptionSuffix : ''}`,
                    quantity: wallPaintAlloc.quantity,
                    unit: 'gal',
                    rate: isBillable ? (wallPaintAlloc.cost > 0 ? wallPrice : 0) : 0,
                    amount: isBillable ? wallPaintAlloc.cost : 0,
                    type: 'material',
                    groupTitle: "Paint Materials"
                });
            }

            // --- MATERIAL HANDLER (Room Specific) ---
            const roomMaterials = room.materialItems || [];
            if (roomMaterials.length > 0) {
                if (config.materialPlacement === 'inline') {
                    paintItem.amount = (paintItem.amount || 0) + roomMaterials.reduce((s: number, m: any) => s + (m.rate * m.quantity), 0);
                    if (paintItem.quantity) paintItem.rate = (paintItem.amount || 0) / paintItem.quantity;
                } else if (config.materialPlacement === 'subline') {
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

            linesForRoom.push(paintItem);

            // Ceilings (With Paint Tracker)
            if (project.supplyConfig?.includeCeiling) {
                const ceilingArea = room.length * room.width;
                const ceilProd = project.supplyConfig?.ceilingProduct;
                const ceilProdId = ceilProd?.id || 'default_ceiling';
                const ceilProdName = ceilProd?.name || 'Ceiling Paint';
                const ceilPrice = ceilProd ? (ceilProd.unitPrice || ceilProd.price || ceilProd.pricePerGallon || 42) : 42;
                const ceilCoverage = project.supplyConfig?.ceilingCoverage || 400;
                const ceilCoats = project.supplyConfig?.ceilingCoats || 2;

                const ceilAlloc = paintTracker.registerUsage(ceilProdId, ceilProdName, ceilingArea * ceilCoats, ceilCoverage, ceilPrice);

                const ceilingLine: QuoteLineItem = {
                    id: `ceiling-${room.id}`,
                    description: "Paint Ceiling",
                    quantity: ceilingArea,
                    unit: 'sqft',
                    rate: 1.00,
                    amount: getLaborCost(ceilingArea, 'ceiling'),
                    type: 'labor',
                    groupTitle: room.name,
                    subItems: []
                };

                const isBillable = project.supplyConfig?.billablePaint ?? true;
                if (config.paintPlacement === 'inline') {
                    if (isBillable) ceilingLine.amount = (ceilingLine.amount || 0) + ceilAlloc.cost;
                    if (config.paintDetails?.showName) ceilingLine.description += ` (${ceilProdName})`;
                    if (ceilAlloc.isShared) ceilingLine.description += ceilAlloc.descriptionSuffix;
                } else if (config.paintPlacement === 'subline') {
                    ceilingLine.subItems?.push({
                        id: `ceil-paint-${room.id}`,
                        description: `${ceilProdName}${ceilAlloc.isShared ? ceilAlloc.descriptionSuffix : ` (${ceilAlloc.quantity} gal)`}`,
                        quantity: ceilAlloc.quantity,
                        unit: 'gal',
                        rate: ceilAlloc.cost > 0 ? ceilPrice : 0,
                        amount: isBillable ? ceilAlloc.cost : 0,
                        type: 'material'
                    });
                } else if (config.paintPlacement === 'separate_area') {
                    collectedMaterials.push({
                        id: `ceil-paint-${room.id}`,
                        description: `${ceilProdName} for ${room.name} Ceiling${ceilAlloc.isShared ? ceilAlloc.descriptionSuffix : ''}`,
                        quantity: ceilAlloc.quantity,
                        unit: 'gal',
                        rate: ceilAlloc.cost > 0 ? ceilPrice : 0,
                        amount: isBillable ? ceilAlloc.cost : 0,
                        type: 'material',
                        groupTitle: "Paint Materials"
                    });
                }

                linesForRoom.push(ceilingLine);
            }

            // Trim (By Room) - With Paint Tracker
            const includeTrim = room.supplyConfig?.includeTrim ?? project.supplyConfig?.includeTrim;
            if (includeTrim) {
                const trimLF = (room.length + room.width) * 2;
                const trimWidth = room.supplyConfig?.trimWidth ?? project.supplyConfig?.defaultTrimWidth ?? 4;
                const trimRate = room.supplyConfig?.trimRate ?? project.supplyConfig?.defaultTrimRate ?? 1.50;

                const trimProd = project.supplyConfig?.trimProduct;
                const trimProdId = trimProd?.id || 'default_trim';
                const trimProdName = trimProd?.name || 'Trim Paint';
                const trimPrice = trimProd ? (trimProd.unitPrice || trimProd.price || trimProd.pricePerGallon || 65) : 65;
                const trimCoverage = project.supplyConfig?.trimCoverage || 400;
                const trimCoats = project.supplyConfig?.trimCoats || 2;

                const trimArea = trimLF * (trimWidth / 12);

                const trimAlloc = paintTracker.registerUsage(trimProdId, trimProdName, trimArea * trimCoats, trimCoverage, trimPrice);

                const trimLine: QuoteLineItem = {
                    id: `trim-${room.id}`,
                    description: `Paint Trim (${trimWidth}" width)`,
                    quantity: trimLF,
                    unit: 'linear_ft',
                    rate: trimRate,
                    amount: trimLF * trimRate,
                    type: 'labor',
                    groupTitle: room.name,
                    subItems: []
                };

                if (config.paintPlacement === 'inline') {
                    if (project.supplyConfig?.billablePaint ?? true) trimLine.amount = (trimLine.amount || 0) + trimAlloc.cost;
                    if (config.paintDetails?.showName) trimLine.description += ` (${trimProdName})`;
                    if (trimAlloc.isShared) trimLine.description += trimAlloc.descriptionSuffix;
                } else if (config.paintPlacement === 'subline') {
                    trimLine.subItems?.push({
                        id: `trim-paint-${room.id}`,
                        description: `${trimProdName}${trimAlloc.isShared ? trimAlloc.descriptionSuffix : ` (${trimAlloc.quantity} gal)`}`,
                        quantity: trimAlloc.quantity,
                        unit: 'gal',
                        rate: trimAlloc.cost > 0 ? trimPrice : 0,
                        amount: (project.supplyConfig?.billablePaint ?? true) ? trimAlloc.cost : 0,
                        type: 'material'
                    });
                } else if (config.paintPlacement === 'separate_area') {
                    collectedMaterials.push({
                        id: `trim-paint-${room.id}`,
                        description: `${trimProdName} for ${room.name} Trim${trimAlloc.isShared ? trimAlloc.descriptionSuffix : ''}`,
                        quantity: trimAlloc.quantity,
                        unit: 'gal',
                        rate: trimAlloc.cost > 0 ? trimPrice : 0,
                        amount: (project.supplyConfig?.billablePaint ?? true) ? trimAlloc.cost : 0,
                        type: 'material',
                        groupTitle: "Paint Materials"
                    });
                }

                linesForRoom.push(trimLine);
            }

            // Prep Tasks (Preserve existing)
            if (room.prepTasks && room.prepTasks.length > 0) {
                if (config.prepStrategy === 'group_total') {
                    const totalPrep = room.prepTasks.reduce((s: number, t: any) => s + (t.unit === 'fixed' ? t.rate : (t.rate * t.quantity)), 0);
                    linesForRoom.push({
                        id: `prep-group-${room.id}`,
                        description: "Room Preparation",
                        amount: totalPrep,
                        type: 'prep',
                        groupTitle: room.name
                    });
                } else {
                    room.prepTasks.forEach((task: any) => {
                        linesForRoom.push({
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

            // Misc Items (Preserve existing but UPDATE PAINT LOGIC)
            if (room.miscItems && room.miscItems.length > 0) {
                const groupMap = new Map<string, any>();
                room.miscItems.forEach((item: any) => {
                    const key = `${item.name}-${item.unit}-${item.rate}-${item.paintProductId || 'none'}-${item.width || 0}-${item.coverage || 0}`;
                    if (!groupMap.has(key)) groupMap.set(key, { ...item, _count: 0, _totalQuantity: 0 });
                    const group = groupMap.get(key);
                    group._count += (item.count || 1);
                    group._totalQuantity += item.quantity;
                });
                const processedItems = Array.from(groupMap.values());

                processedItems.forEach((item: any) => {
                    const isGrouped = item._count > 1;
                    const displayName = isGrouped ? `${item.name} (x${item._count})` : item.name;
                    const miscLine: QuoteLineItem = {
                        id: `misc-${room.id}-${item.id}`,
                        description: displayName,
                        quantity: item._totalQuantity,
                        unit: item.unit,
                        rate: item.rate,
                        amount: item.unit === 'fixed' ? (item.rate * item._count) : (item.rate * item._totalQuantity),
                        type: 'labor',
                        groupTitle: room.name,
                        subItems: []
                    };

                    // Paint for Misc
                    if (item.paintProductId) {
                        let area = 0;
                        if (item.unit === 'sqft') area = item._totalQuantity;
                        else if (item.unit === 'linear_ft') area = item._totalQuantity * ((item.width || 4) / 12);
                        else if (item.customPaintArea) area = item.customPaintArea * item._count;
                        else if (item.unit === 'fixed') area = (item._count || 1) * 10; // Fallback? Or remove?

                        if (area > 0) {
                            const coats = item.coats || 2;
                            const prodId = item.paintProductId === 'default' ? (project.supplyConfig?.wallProduct?.id || 'default_wall') : item.paintProductId;
                            const prodName = item.paintProductId === 'default' ? (project.supplyConfig?.wallProduct?.name || 'Standard Paint') : 'Custom Paint';

                            let price = 45;
                            let name = prodName;

                            if (item.paintProductId !== 'default') {
                                const p = catalog.find((x: any) => x.id === item.paintProductId);
                                if (p) { price = p.unitPrice || p.price || 45; name = p.name; }
                            } else {
                                price = project.supplyConfig?.pricePerGallon || 45;
                            }

                            const miscAlloc = paintTracker.registerUsage(prodId, name, area * coats, item.coverage || 350, price, item.excludeFromSharedPaint);
                            const isBillable = project.supplyConfig?.billablePaint ?? true;

                            if (config.paintPlacement === 'inline') {
                                if (isBillable) miscLine.amount = (miscLine.amount || 0) + miscAlloc.cost;
                                if (config.paintDetails?.showName) miscLine.description += ` (w/ ${name})`;
                                if (miscAlloc.isShared) miscLine.description += miscAlloc.descriptionSuffix;
                            } else if (config.paintPlacement === 'subline') {
                                miscLine.subItems?.push({
                                    id: `misc-paint-${item.id}`,
                                    description: `${name}${miscAlloc.isShared ? miscAlloc.descriptionSuffix : ` (${miscAlloc.quantity} gal)`}`,
                                    quantity: miscAlloc.quantity,
                                    unit: 'gal',
                                    rate: miscAlloc.cost > 0 ? price : 0,
                                    amount: isBillable ? miscAlloc.cost : 0,
                                    type: 'material'
                                });
                            } else if (config.paintPlacement === 'separate_area') {
                                collectedMaterials.push({
                                    id: `misc-paint-${room.id}-${item.id}`,
                                    description: `${name} for ${displayName}${miscAlloc.isShared ? miscAlloc.descriptionSuffix : ''}`,
                                    quantity: miscAlloc.quantity,
                                    unit: 'gal',
                                    rate: miscAlloc.cost > 0 ? price : 0,
                                    amount: isBillable ? miscAlloc.cost : 0,
                                    type: 'material',
                                    groupTitle: "Paint Materials"
                                });
                            }
                        }
                    }
                    linesForRoom.push(miscLine);
                });
            }

            // Calculate Room Total for Header
            const roomTotal = linesForRoom.reduce((sum, item) => {
                let s = (item.amount || 0);
                if (item.subItems) {
                    s += item.subItems.reduce((ss, si) => ss + (si.amount || 0), 0);
                }
                return sum + s;
            }, 0);

            const roomHeader = {
                id: `room-${room.id}`,
                description: room.name,
                amount: roomTotal,
                type: 'header' as const,
                isGroupHeader: true,
                groupTitle: room.name
            };

            lines.push(roomHeader, ...linesForRoom);
        });

        // --- GLOBAL ADDITIONAL ITEMS (Sectioned for By Room) ---
        if (project.globalMiscItems && project.globalMiscItems.length > 0) {
            project.globalMiscItems.forEach((item: any) => {
                const sectionLines: QuoteLineItem[] = [];
                const groupTitle = item.name;

                const miscLine: QuoteLineItem = {
                    id: `global-misc-${item.id}`,
                    description: item.name,
                    quantity: item.quantity,
                    unit: item.unit,
                    rate: item.rate,
                    amount: item.unit === 'fixed' ? item.rate : (item.rate * item.quantity),
                    type: 'labor',
                    groupTitle: groupTitle,
                    subItems: []
                };

                // Paint Logic for Global Items
                if (item.paintProductId) {
                    let area = 0;
                    if (item.unit === 'sqft') area = item.quantity * (item.count || 1);
                    else if (item.unit === 'linear_ft') area = item.quantity * (item.count || 1) * ((item.width || 0) / 12);
                    else if (item.customPaintArea) area = item.customPaintArea * (item.count || 1);

                    if (area > 0) {
                        const coverage = item.coverage || 350;

                        let pricePerGal = 45;
                        let prodName = "Paint";
                        let prodId = item.paintProductId;

                        const prod = (item.paintProductId === 'default' ? project.supplyConfig?.wallProduct : catalog?.find((p: any) => p.id === item.paintProductId));
                        if (prod) {
                            pricePerGal = (prod as any).unitPrice || (prod as any).price || 45;
                            prodName = (prod as any).name;
                            prodId = prod.id;
                        }

                        const coats = item.coats || 2;

                        const gallAlloc = paintTracker.registerUsage(prodId, prodName, area * coats, coverage, pricePerGal, item.excludeFromSharedPaint);
                        const isBillable = project.supplyConfig?.billablePaint ?? true;

                        if (config.paintPlacement === 'inline') {
                            if (isBillable) {
                                miscLine.amount = (miscLine.amount || 0) + gallAlloc.cost;
                            }
                            if (config.paintDetails?.showName) {
                                miscLine.description += ` (w/ ${prodName})`;
                            }
                            if (gallAlloc.isShared) miscLine.description += gallAlloc.descriptionSuffix;
                        } else if (config.paintPlacement === 'subline') {
                            miscLine.subItems?.push({
                                id: `global-misc-paint-${item.id}`,
                                description: `${prodName}${gallAlloc.isShared ? gallAlloc.descriptionSuffix : ` (${gallAlloc.quantity} gal)`}`,
                                quantity: gallAlloc.quantity,
                                unit: 'gal',
                                rate: isBillable ? pricePerGal : 0,
                                amount: isBillable ? gallAlloc.cost : 0,
                                type: 'material'
                            });
                        } else if (config.paintPlacement === 'separate_area') {
                            collectedMaterials.push({
                                id: `global-misc-paint-${item.id}`,
                                description: `${prodName} for ${item.name}${gallAlloc.isShared ? gallAlloc.descriptionSuffix : ''}`,
                                quantity: gallAlloc.quantity,
                                unit: 'gal',
                                rate: isBillable ? pricePerGal : 0,
                                amount: isBillable ? gallAlloc.cost : 0,
                                type: 'material',
                                groupTitle: "Paint Materials"
                            });
                        }
                    }
                }

                sectionLines.push(miscLine);
                // ... Prep Tasks ...
                if (item.prepTasks) {
                    item.prepTasks.forEach((task: any) => {
                        sectionLines.push({
                            id: `global-prep-${item.id}-${task.id}`,
                            description: task.name,
                            quantity: task.quantity,
                            unit: task.unit,
                            rate: task.rate, // ...
                            amount: task.unit === 'fixed' ? task.rate : task.rate * task.quantity,
                            type: 'prep',
                            groupTitle: groupTitle
                        });
                    });
                }

                // Section Total (Reduce)
                const sectionTotal = sectionLines.reduce((sum, l) => {
                    let s = l.amount || 0;
                    if (l.subItems) s += l.subItems.reduce((ss, si) => ss + (si.amount || 0), 0);
                    return sum + s;
                }, 0);

                lines.push({
                    id: `h-global-${item.id}`,
                    description: item.name,
                    amount: sectionTotal,
                    type: 'header',
                    isGroupHeader: true,
                    groupTitle: groupTitle
                }, ...sectionLines);
            });
        }

        // Global Materials (Preserve)
        const globalMaterials = project.globalMaterialItems || [];
        if (globalMaterials.length > 0) {
            if (config.materialPlacement === 'separate_area') {
                globalMaterials.forEach((m: any) => collectedMaterials.push({ ...m, description: m.description || m.name, groupTitle: "Materials", amount: m.rate * m.quantity }));
            } else {
                lines.push({ id: 'h-proj-mat', description: "Project Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Project Materials" });
                globalMaterials.forEach((m: any) => lines.push({ ...m, description: m.description || m.name, amount: m.rate * m.quantity, type: 'material' }));
            }
        }

    } else {
        // --- BY ACTIVITY / SURFACE STRATEGY ---
        let totalWallArea = 0;
        let totalCeilingArea = 0;
        let totalTrimLF = 0;
        let totalPrimerArea = 0;

        rooms.forEach((r: any) => {
            const wallArea = (r.length + r.width) * 2 * r.height;
            totalWallArea += wallArea;
            if (r.supplyConfig?.includePrimer ?? project.supplyConfig?.includePrimer) {
                totalPrimerArea += wallArea;
            }
            if (project.supplyConfig?.includeCeiling) {
                totalCeilingArea += r.length * r.width;
            }
            if (r.supplyConfig?.includeTrim ?? project.supplyConfig?.includeTrim) {
                totalTrimLF += (r.length + r.width) * 2;
            }
        });

        const applyPaintLogic = (lineItem: QuoteLineItem, area: number, coverage: number, coats: number, product: any, isTrim = false) => {
            // New Tracker Logic
            const prodId = product ? product.id : 'default_prod';
            const prodName = product ? product.name : (project.supplyConfig?.wallProduct?.name || "Standard Paint");
            const pricePerGal = product ? (product.unitPrice || product.price || product.pricePerGallon || 45) : (project.supplyConfig?.pricePerGallon || 45);

            // Register allocation
            const alloc = paintTracker.registerUsage(prodId, prodName, area, coverage || 350, pricePerGal);
            const isBillable = project.supplyConfig?.billablePaint ?? true;

            if (config.paintPlacement === 'inline') {
                if (isBillable) lineItem.amount = (lineItem.amount || 0) + alloc.cost;

                if (config.paintDetails?.showName) lineItem.description += ` (w/ ${prodName})`;
                if (alloc.isShared) lineItem.description += alloc.descriptionSuffix;
                if (config.paintDetails?.showCoats) lineItem.description += ` - ${coats} Coats`;

                // Update rate if quantity present
                if (lineItem.quantity && alloc.cost > 0) lineItem.rate = (lineItem.amount || 0) / lineItem.quantity;

            } else if (config.paintPlacement === 'subline') {
                let subDesc = config.paintDetails?.showName ? prodName : "Paint Material";
                if (alloc.isShared) {
                    subDesc += alloc.descriptionSuffix;
                } else if (config.paintDetails?.showVolume) {
                    subDesc += ` (${alloc.quantity} gal)`;
                }
                if (config.paintDetails?.showCoats) subDesc += ` - ${coats} Coats`;

                const shouldShowPrice = config.paintDetails?.showPrice ?? true;
                const costOnLine = (isBillable && shouldShowPrice);

                lineItem.subItems?.push({
                    id: `${lineItem.id}-paint`,
                    description: subDesc,
                    quantity: alloc.quantity,
                    unit: 'gal',
                    rate: costOnLine ? (alloc.cost > 0 ? pricePerGal : 0) : 0,
                    amount: costOnLine ? (isBillable ? alloc.cost : 0) : undefined,
                    type: 'material'
                });

                if (isBillable && !shouldShowPrice) {
                    lineItem.amount = (lineItem.amount || 0) + alloc.cost;
                    if (lineItem.quantity) lineItem.rate = (lineItem.amount || 0) / lineItem.quantity;
                }

            } else if (config.paintPlacement === 'separate_area') {
                collectedMaterials.push({
                    id: `${lineItem.id}-paint`,
                    description: `${prodName} for ${lineItem.description}${alloc.isShared ? alloc.descriptionSuffix : ''}`,
                    quantity: alloc.quantity,
                    unit: 'gal',
                    rate: isBillable ? (alloc.cost > 0 ? pricePerGal : 0) : 0,
                    amount: isBillable ? alloc.cost : 0,
                    type: 'material',
                    groupTitle: "Paint Materials"
                });
            }
        };

        // ... Generatre Lines (Primer, Walls, Ceiling, Trim) ...

        if (totalPrimerArea > 0 && config.primerStrategy === 'separate_line') {
            lines.push({
                id: 'act-primer',
                description: "Prime Walls",
                quantity: totalWallArea,
                unit: 'sqft',
                rate: 0.5,
                amount: totalWallArea * 0.5,
                type: 'labor',
                groupTitle: "Preparation"
            });
        }

        if (totalWallArea > 0) {
            // Calculate Primer Cost Component
            let primerCost = 0;
            if (totalPrimerArea > 0 && config.primerStrategy !== 'separate_line') {
                primerCost = totalPrimerArea * 0.50;
            }

            const wallLine: QuoteLineItem = {
                id: 'act-walls',
                description: "Paint Walls",
                quantity: totalWallArea,
                unit: 'sqft',
                rate: 1.5,
                amount: getLaborCost(totalWallArea, 'wall') + primerCost,
                type: 'labor',
                groupTitle: "Walls",
                subItems: []
            };

            // If combined, update the effective rate
            if (primerCost > 0) {
                wallLine.rate = (wallLine.amount || 0) / wallLine.quantity;
                wallLine.description += " (Incl. Primer)";
            }

            if (project.supplyConfig?.wallProduct) {
                const coats = project.supplyConfig.wallCoats || 2;
                const coverage = project.supplyConfig.wallCoverage || project.supplyConfig.coveragePerGallon || 350;
                applyPaintLogic(wallLine, totalWallArea * coats, coverage, coats, project.supplyConfig.wallProduct);
            }
            lines.push(wallLine);
        }

        if (totalCeilingArea > 0) {
            const ceilLine = { id: 'act-ceil', description: "Paint Ceilings", quantity: totalCeilingArea, unit: 'sqft', rate: 1.0, amount: getLaborCost(totalCeilingArea, 'ceiling'), type: 'labor' as const, groupTitle: "Ceilings", subItems: [] };
            if (project.supplyConfig?.ceilingProduct) {
                const coats = project.supplyConfig.ceilingCoats || 2;
                applyPaintLogic(ceilLine, totalCeilingArea * coats, project.supplyConfig.ceilingCoverage, coats, project.supplyConfig.ceilingProduct);
            }
            lines.push(ceilLine);
        }

        if (totalTrimLF > 0) {
            const trimWidth = project.supplyConfig?.defaultTrimWidth || 4;
            const trimLine = { id: 'act-trim', description: `Paint Trim (${trimWidth}" width)`, quantity: totalTrimLF, unit: 'linear_ft', rate: 1.5, amount: totalTrimLF * 1.5, type: 'labor' as const, groupTitle: "Trim", subItems: [] };
            if (project.supplyConfig?.trimProduct) {
                const coats = project.supplyConfig.trimCoats || 2;
                const trimArea = totalTrimLF * (trimWidth / 12) * coats;
                applyPaintLogic(trimLine, trimArea, project.supplyConfig.trimCoverage, coats, project.supplyConfig.trimProduct, true);
            }
            lines.push(trimLine);
        }

        // Global Misc Items (By Activity)
        if (project.globalMiscItems) {
            project.globalMiscItems.forEach((item: any) => {
                const miscLine: QuoteLineItem = { id: `global-misc-${item.id}`, description: item.name, quantity: item.quantity, unit: item.unit, rate: item.rate, amount: item.unit === 'fixed' ? item.rate : (item.rate * item.quantity), type: 'labor', groupTitle: item.name, subItems: [] };

                if (item.paintProductId) {
                    let area = 0;
                    if (item.unit === 'sqft') area = item.quantity;
                    else if (item.unit === 'linear_ft') area = item.quantity * ((item.width || 4) / 12);
                    else if (item.unit === 'fixed') area = (item.count || 1) * 10;

                    if (area > 0) {
                        const coats = item.coats || 2;
                        const prod = (item.paintProductId === 'default' ? project.supplyConfig?.wallProduct : catalog?.find((p: any) => p.id === item.paintProductId));
                        if (prod || item.paintProductId === 'default') {
                            applyPaintLogic(miscLine, area * coats, item.coverage || 350, coats, prod);
                        }
                    }
                }
                lines.push(miscLine);
                // Prep...
                if (item.prepTasks) {
                    item.prepTasks.forEach((t: any) => lines.push({ id: `global-prep-${t.name}`, description: `${t.name} (for ${item.name})`, quantity: t.quantity, unit: t.unit, rate: t.rate, amount: t.unit === 'fixed' ? t.rate : t.rate * t.quantity, type: 'prep', groupTitle: "Preparation" }));
                }
            });
        }

        // Room Misc Items in Activity View
        // Logic similar to By-Room grouping but aggregated differently?
        // Actually, previous logic (lines 723) generated aggregated lines. 
        // We should replicate that or reuse it.
        const roomMiscMap = new Map<string, any>();
        rooms.forEach((r: any) => {
            if (r.miscItems) {
                r.miscItems.forEach((item: any) => {
                    const key = `${item.name}-${item.unit}-${item.rate}-${item.paintProductId || 'none'}`;
                    if (!roomMiscMap.has(key)) {
                        roomMiscMap.set(key, { ...item, quantity: 0, amount: 0, count: 0, _areas: 0 }); // Track total area sum
                    }
                    const grouped = roomMiscMap.get(key);
                    grouped.quantity += item.quantity;
                    grouped.amount += (item.unit === 'fixed' ? item.rate : item.rate * item.quantity);
                    grouped.count += (item.count || 1);
                    // Area calc for this item
                    let a = 0;
                    if (item.unit === 'sqft') a = item.quantity;
                    else if (item.unit === 'linear_ft') a = item.quantity * ((item.width || 4) / 12);
                    else if (item.unit === 'fixed') a = (item.count || 1) * 10;
                    grouped._areas += a;
                });
            }
        });

        roomMiscMap.forEach((item) => {
            const miscLine: QuoteLineItem = {
                id: `act-room-misc-${item.name.replace(/\s+/g, '-').toLowerCase()}`,
                description: item.name,
                quantity: item.quantity,
                unit: item.unit,
                rate: item.rate,
                amount: item.amount,
                type: 'labor',
                groupTitle: "Additional Work Items",
                subItems: []
            };
            if (item.paintProductId) {
                // Use aggregated area
                const area = item._areas;
                if (area > 0) {
                    const coats = item.coats || 2;
                    const prod = (item.paintProductId === 'default' ? project.supplyConfig?.wallProduct : catalog?.find((p: any) => p.id === item.paintProductId));
                    if (prod || item.paintProductId === 'default') {
                        applyPaintLogic(miscLine, area * coats, item.coverage || 350, coats, prod);
                    }
                }
            }
            lines.push(miscLine);
        });

        // Prep Tasks (Grouped)
        const prepMap = new Map<string, any>();
        rooms.forEach((r: any) => {
            if (r.prepTasks) {
                r.prepTasks.forEach((t: any) => {
                    const key = t.name;
                    if (!prepMap.has(key)) {
                        prepMap.set(key, { ...t, quantity: 0, amount: 0 });
                    }
                    const item = prepMap.get(key);
                    item.quantity += t.quantity;
                    item.amount += (t.unit === 'fixed' ? t.rate : t.rate * t.quantity);
                });
            }
        });

        prepMap.forEach((item, key) => {
            lines.push({
                id: `act-prep-${key}`,
                description: key,
                quantity: item.quantity,
                unit: item.unit,
                rate: item.rate,
                amount: item.amount,
                type: 'prep',
                groupTitle: "Preparation"
            });
        });

        // Materials
        const roomMaterials: any[] = [];
        rooms.forEach((r: any) => {
            if (r.materialItems) roomMaterials.push(...r.materialItems);
        });

        const globalMaterials = project.globalMaterialItems || [];

        // 1. Handle Room Materials (Configurable Placement)
        if (roomMaterials.length > 0) {
            // We attach these to the main "Paint Walls" line (act-walls) if present, 
            // otherwise we might need a fallback, but assuming act-walls exists for now if there are rooms.
            // Find the wall line:
            const wallLineIndex = lines.findIndex(l => l.id === 'act-walls');
            const targetLine = wallLineIndex >= 0 ? lines[wallLineIndex] : null;

            if (config.materialPlacement === 'inline' && targetLine) {
                const totalMatCost = roomMaterials.reduce((s, m) => s + (m.amount ?? (m.rate * m.quantity)), 0);
                targetLine.amount = (targetLine.amount || 0) + totalMatCost;

                // Recalculate rate
                if (targetLine.quantity && targetLine.amount) targetLine.rate = targetLine.amount / targetLine.quantity;

                targetLine.description += " (Incl. Materials)";

            } else if (config.materialPlacement === 'subline' && targetLine) {
                roomMaterials.forEach((m: any, idx: number) => {
                    targetLine.subItems?.push({
                        id: `mat-sub-${idx}`,
                        description: m.description || m.name,
                        quantity: m.quantity,
                        unit: m.unit,
                        rate: m.rate,
                        amount: m.amount ?? (m.rate * m.quantity),
                        type: 'material'
                    });
                });

            } else {
                // Separate Area (or fallback if no wall line) -> Collect them
                // We'll treat them as "Project Materials" or general collected if separate
                roomMaterials.forEach(m => collectedMaterials.push({
                    ...m,
                    description: m.description || m.name,
                    groupTitle: "Materials",
                    amount: m.amount ?? (m.rate * m.quantity),
                    type: 'material'
                }));
            }
        }

        // 2. Handle Global Materials (Always Separate/Section per user request)
        if (globalMaterials.length > 0) {
            // In By Surface, we typically list these in the main list if not "Separate Area" for everything?
            // User said: "Sub-line option should have the material cost line appear in a separate area if it's a global material cost"

            // If Strategy is Separate Area -> push to collected
            if (config.materialPlacement === 'separate_area') {
                globalMaterials.forEach((m: any) => collectedMaterials.push({ ...m, description: m.description || m.name, groupTitle: "Materials", amount: m.rate * m.quantity, type: 'material' }));
            } else {
                // Otherwise, list them as a section in the main body (standard list)
                lines.push({ id: 'h-proj-mat-act', description: "Project Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Project Materials" });
                globalMaterials.forEach((m: any) => {
                    lines.push({
                        id: `mat-global-${m.id}`,
                        description: m.description || m.name,
                        quantity: m.quantity,
                        unit: m.unit,
                        rate: m.rate,
                        amount: m.amount ?? (m.rate * m.quantity),
                        type: 'material',
                        groupTitle: "Project Materials"
                    });
                });
            }
        }

        // Add any accumulated Separate Area Room Materials to lines if we aren't in 'separate_area' mode but missed the wall line?
        // logic above pushes to 'collectedMaterials' which handles the 'separate_area' grouping at the end of the function.
        // But if config is 'subline' but no 'act-walls' existed, we pushed to collectedMaterials.
        // We need to ensure collectedMaterials are rendered if placement is NOT separate_area? 
        // Actually, collectedMaterials is processed at the end primarily for 'separate_area' config.
        // If config is 'subline' but we pushed there, they might disappear if we don't handle them.

        // Let's refine the fallback: If config !== separate_area, but we have loose materials (e.g. no wall line), just list them.
        if (config.materialPlacement !== 'separate_area' && roomMaterials.length > 0 && lines.findIndex(l => l.id === 'act-walls') === -1) {
            lines.push({ id: 'h-room-mat-fallback', description: "Room Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Materials" });
            roomMaterials.forEach((m: any, idx: number) => {
                lines.push({
                    id: `mat-room-fb-${idx}`,
                    description: m.description || m.name,
                    quantity: m.quantity,
                    unit: m.unit,
                    rate: m.rate,
                    amount: m.amount ?? (m.rate * m.quantity),
                    type: 'material',
                    groupTitle: "Materials"
                });
            });
        }
    }

    // --- SEPARATE PAINT & MATERIALS PROCESSING ---
    const paintMaterials = collectedMaterials.filter(m => m.groupTitle === "Paint Materials");
    const otherMaterials = collectedMaterials.filter(m => m.groupTitle !== "Paint Materials");

    // Recalculate Bulk Total (Fallback if no detailed paint items exist)
    let totalPaintArea = 0;
    if (paintMaterials.length === 0) {
        rooms.forEach((r: any) => {
            totalPaintArea += (r.length + r.width) * 2 * r.height; // Walls
            if (r.supplyConfig?.includeTrim ?? project.supplyConfig?.includeTrim) {
                const trimLF = (r.length + r.width) * 2;
                const trimWidth = r.supplyConfig?.trimWidth ?? project.supplyConfig?.defaultTrimWidth ?? 4;
                totalPaintArea += trimLF * (trimWidth / 12);
            }
            if (project.supplyConfig?.includeCeiling) {
                totalPaintArea += r.length * r.width;
            }
        });
    }
    const totalPaintCost = getPaintCost(totalPaintArea);

    if (config.paintPlacement === 'separate_area') {
        if (config.materialPlacement === 'separate_area' && config.separateAreaStrategy === 'combined') {
            lines.push({ id: 'h-pm', description: "Paint & Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Paint & Materials" });

            // Paint Logic
            if (paintMaterials.length > 0) {
                paintMaterials.forEach(m => lines.push(m));
            } else {
                lines.push({
                    id: 'paint-total-c',
                    description: "Paint Products",
                    amount: totalPaintCost,
                    type: 'material',
                    groupTitle: "Paint & Materials"
                });
            }

            // Other Materials
            if (otherMaterials.length > 0) {
                otherMaterials.forEach(m => lines.push(m));
            }

        } else {
            // Distinct Paint Section
            // Only create if we have paint materials OR calculated bulk cost > 0
            if (paintMaterials.length > 0 || totalPaintCost > 0) {
                lines.push({ id: 'h-paint', description: "Paint Products", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Paint Products" });

                if (paintMaterials.length > 0) {
                    paintMaterials.forEach(m => lines.push(m));
                } else {
                    lines.push({
                        id: 'paint-total',
                        description: "Paint Products (Bulk)",
                        amount: totalPaintCost,
                        type: 'material',
                        groupTitle: "Paint Products"
                    });
                }
            }

            // Distinct Materials Section
            if (otherMaterials.length > 0) {
                lines.push({ id: 'h-materials-section', description: "Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Materials" });
                if (config.materialStrategy === 'group_total') {
                    const total = otherMaterials.reduce((s, m) => s + (m.amount || 0), 0);
                    lines.push({
                        id: 'mat-group-total',
                        description: "Materials Package",
                        amount: total,
                        type: 'material',
                        groupTitle: "Materials"
                    });
                } else {
                    otherMaterials.forEach(m => lines.push(m));
                }
            }
        }
    } else {
        if (config.materialPlacement === 'separate_area' && otherMaterials.length > 0) {
            lines.push({ id: 'h-materials-section', description: "Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Materials" });
            otherMaterials.forEach(m => lines.push(m));
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
                quantity: 0, rate: 0, unit: '',
                isHeader: true,
                amount: item.amount // Pass calculated section total
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
