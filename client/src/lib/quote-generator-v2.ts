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

export function generateQuoteLinesV2(project: any, rooms: any[], config: QuoteConfiguration, catalog: any[] = []): QuoteLineItem[] {
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

    // --- CORE LISTING LOGIC ---
    if (config.listingStrategy === 'by_room') {
        rooms.forEach((room: any) => {
            const linesForRoom: QuoteLineItem[] = [];

            // Walls
            const wallArea = (room.length + room.width) * 2 * room.height;
            const wallLabor = getLaborCost(wallArea, 'wall');
            const wallPaint = getPaintCost(wallArea);

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

            linesForRoom.push(paintItem);

            // Ceilings
            if (project.supplyConfig?.includeCeiling) {
                const ceilingArea = room.length * room.width;
                linesForRoom.push({
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

            // Trim (By Room)
            const includeTrim = room.supplyConfig?.includeTrim ?? project.supplyConfig?.includeTrim;
            if (includeTrim) {
                const trimLF = (room.length + room.width) * 2; // Estimate Perimeter
                const trimWidth = room.supplyConfig?.trimWidth ?? project.supplyConfig?.defaultTrimWidth ?? 4;
                const trimRate = room.supplyConfig?.trimRate ?? project.supplyConfig?.defaultTrimRate ?? 1.50;

                linesForRoom.push({
                    id: `trim-${room.id}`,
                    description: `Paint Trim (${trimWidth}" width)`,
                    quantity: trimLF,
                    unit: 'linear_ft',
                    rate: trimRate,
                    amount: trimLF * trimRate,
                    type: 'labor',
                    groupTitle: room.name
                });
            }

            // Prep Tasks
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

            // Misc Items
            if (room.miscItems && room.miscItems.length > 0) {
                // Group items by keys (Name-Unit-Rate-Paint-etc) to support x-Notation
                let processedItems: any[] = [];

                const groupMap = new Map<string, any>();

                room.miscItems.forEach((item: any) => {
                    const key = `${item.name}-${item.unit}-${item.rate}-${item.paintProductId || 'none'}-${item.width || 0}-${item.coverage || 0}`;

                    if (!groupMap.has(key)) {
                        groupMap.set(key, { ...item, _count: 0, _totalQuantity: 0 });
                    }

                    const group = groupMap.get(key);
                    group._count += (item.count || 1);
                    group._totalQuantity += item.quantity;
                });

                processedItems = Array.from(groupMap.values());

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

                    // Check for Paint Requirement
                    if (item.paintProductId) {
                        let area = 0;
                        if (item.unit === 'sqft') area = item._totalQuantity;
                        else if (item.unit === 'linear_ft') area = item._totalQuantity * ((item.width || 0) / 12);

                        if (area > 0) {
                            const coverage = item.coverage || 350;
                            const gallons = Math.ceil(area / coverage);
                            let pricePerGal = 45;
                            let prodName = "Paint";

                            if (item.paintProductId === 'default') {
                                pricePerGal = project.supplyConfig?.pricePerGallon || 45;
                                prodName = project.supplyConfig?.wallProduct?.name || "Standard Paint";
                            } else {
                                const prod = catalog?.find((p: any) => p.id === item.paintProductId);
                                if (prod) {
                                    pricePerGal = (prod as any).unitPrice || (prod as any).price || 45;
                                    prodName = (prod as any).name;
                                }
                            }

                            const paintCost = gallons * pricePerGal;
                            const isBillable = project.supplyConfig?.billablePaint ?? true;

                            if (config.paintPlacement === 'inline') {
                                if (isBillable) {
                                    miscLine.amount = (miscLine.amount || 0) + paintCost;
                                    if (item.unit !== 'fixed' && miscLine.quantity) {
                                        miscLine.rate = miscLine.amount / miscLine.quantity;
                                    }
                                }
                                if (config.paintDetails?.showName) {
                                    miscLine.description += ` (w/ ${prodName})`;
                                }
                            } else if (config.paintPlacement === 'subline') {
                                const subDesc = `${prodName} (${gallons} gal)`;
                                miscLine.subItems?.push({
                                    id: `misc-paint-${item.id}`,
                                    description: subDesc,
                                    quantity: gallons,
                                    unit: 'gal',
                                    rate: isBillable ? pricePerGal : 0,
                                    amount: isBillable ? paintCost : 0,
                                    type: 'material'
                                });
                            } else if (config.paintPlacement === 'separate_area') {
                                collectedMaterials.push({
                                    id: `misc-paint-${room.id}-${item.id}`,
                                    description: `${prodName} for ${item.name} (${room.name})`,
                                    quantity: gallons,
                                    unit: 'gal',
                                    rate: isBillable ? pricePerGal : 0,
                                    amount: isBillable ? paintCost : 0,
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

                    if (area > 0) {
                        const coverage = item.coverage || 350;
                        const gallons = Math.ceil(area / coverage);
                        let pricePerGal = 45;
                        let prodName = "Paint";

                        const prod = (item.paintProductId === 'default' ? project.supplyConfig?.wallProduct : catalog?.find((p: any) => p.id === item.paintProductId));
                        if (prod) {
                            pricePerGal = (prod as any).unitPrice || (prod as any).price || 45;
                            prodName = (prod as any).name;
                        }

                        const paintCost = gallons * pricePerGal;
                        const isBillable = project.supplyConfig?.billablePaint ?? true;

                        if (config.paintPlacement === 'inline') {
                            if (isBillable) {
                                miscLine.amount = (miscLine.amount || 0) + paintCost;
                                if (item.unit !== 'fixed' && miscLine.quantity) {
                                    miscLine.rate = miscLine.amount / miscLine.quantity;
                                }
                            }
                            if (config.paintDetails?.showName) {
                                miscLine.description += ` (w/ ${prodName})`;
                            }
                        } else if (config.paintPlacement === 'subline') {
                            miscLine.subItems?.push({
                                id: `global-misc-paint-${item.id}`,
                                description: `${prodName} (${gallons} gal)`,
                                quantity: gallons,
                                unit: 'gal',
                                rate: isBillable ? pricePerGal : 0,
                                amount: isBillable ? paintCost : 0,
                                type: 'material'
                            });
                        } else if (config.paintPlacement === 'separate_area') {
                            collectedMaterials.push({
                                id: `global-misc-paint-${item.id}`,
                                description: `${prodName} for ${item.name}`,
                                quantity: gallons,
                                unit: 'gal',
                                rate: isBillable ? pricePerGal : 0,
                                amount: isBillable ? paintCost : 0,
                                type: 'material',
                                groupTitle: "Paint Materials"
                            });
                        }
                    }
                }

                sectionLines.push(miscLine);

                // Prep Tasks for Global Item
                if (item.prepTasks && item.prepTasks.length > 0) {
                    item.prepTasks.forEach((task: any) => {
                        sectionLines.push({
                            id: `global-prep-${item.id}-${task.id}`,
                            description: task.name,
                            quantity: task.quantity,
                            unit: task.unit,
                            rate: task.rate,
                            amount: task.unit === 'fixed' ? task.rate : (task.rate * task.quantity),
                            type: 'prep',
                            groupTitle: groupTitle
                        });
                    });
                }

                // Section Total
                const sectionTotal = sectionLines.reduce((sum, l) => {
                    let s = (l.amount || 0);
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

        // Global Materials for By Room
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

    } else {
        // --- BY ACTIVITY / SURFACE STRATEGY ---
        let totalTrimLF = 0;
        let totalPrimerArea = 0;
        let totalWallArea = 0;
        let totalCeilingArea = 0;

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

        // Helper to handle Paint Logic for Activity Lines
        const applyPaintLogic = (lineItem: QuoteLineItem, area: number, coverage: number, product: any, isTrim = false) => {
            const gallons = Math.ceil(area / (coverage || 350));
            // Fix: Check product.pricePerGallon as well
            const pricePerGal = product ? (product.unitPrice || product.price || product.pricePerGallon || 45) : (project.supplyConfig?.pricePerGallon || 45);
            const prodName = product ? product.name : (project.supplyConfig?.wallProduct?.name || "Standard Paint");
            const paintCost = gallons * pricePerGal;
            const isBillable = project.supplyConfig?.billablePaint ?? true;
            const coats = isTrim ? 1 : 2; // Default assumption for calc if input is missing, but usually 2 for walls

            if (config.paintPlacement === 'inline') {
                if (isBillable) {
                    lineItem.amount = (lineItem.amount || 0) + paintCost;
                    // Update rate to reflect inclusion
                    if (lineItem.quantity) lineItem.rate = lineItem.amount / lineItem.quantity;
                }
                if (config.paintDetails?.showName) {
                    lineItem.description += ` (w/ ${prodName}, ${gallons} gal)`;
                }
            } else if (config.paintPlacement === 'subline') {
                lineItem.subItems?.push({
                    id: `${lineItem.id}-paint`,
                    description: `${prodName} (${gallons} gal)`,
                    quantity: gallons,
                    unit: 'gal',
                    rate: isBillable ? pricePerGal : 0,
                    amount: isBillable ? paintCost : 0,
                    type: 'material'
                });
            } else if (config.paintPlacement === 'separate_area') {
                collectedMaterials.push({
                    id: `${lineItem.id}-paint`,
                    // Fix: Use lineItem.description instead of groupTitle for specificity
                    description: `${prodName} for ${lineItem.description}`,
                    quantity: gallons,
                    unit: 'gal',
                    rate: isBillable ? pricePerGal : 0,
                    amount: isBillable ? paintCost : 0,
                    type: 'material',
                    groupTitle: "Paint Materials"
                });
            }
        };

        // PRIMER
        // Check totalWallArea instead of totalPrimerArea to match By Room behavior (which doesn't require explicit includePrimer flag)
        if (totalWallArea > 0 && config.primerStrategy === 'separate_line') {
            const primerLine: QuoteLineItem = {
                id: 'act-primer',
                description: "Prime Walls",
                quantity: totalWallArea,
                unit: 'sqft',
                rate: 0.5,
                amount: getLaborCost(totalWallArea, 'wall') * 0.4, // Approx 0.6 rate? original was wallArea*0.5
                type: 'labor',
                groupTitle: "Preparation"
            };
            // Override amount to match By Room: amount: wallArea * 0.5
            primerLine.amount = totalWallArea * 0.5;
            lines.push(primerLine);
        }

        if (totalWallArea > 0) {
            const wallLine: QuoteLineItem = {
                id: 'act-walls',
                description: "Paint Walls",
                quantity: totalWallArea,
                unit: 'sqft',
                rate: 1.5,
                amount: getLaborCost(totalWallArea, 'wall'),
                type: 'labor',
                groupTitle: "Walls",
                subItems: []
            };

            // Apply Paint
            if (project.supplyConfig?.wallProduct) {
                applyPaintLogic(wallLine, totalWallArea, project.supplyConfig.wallCoverage, project.supplyConfig.wallProduct);
            }

            lines.push(wallLine);
        }

        if (totalCeilingArea > 0) {
            const ceilingLine: QuoteLineItem = {
                id: 'act-ceiling',
                description: "Paint Ceilings",
                quantity: totalCeilingArea,
                unit: 'sqft',
                rate: 1.0,
                amount: getLaborCost(totalCeilingArea, 'ceiling'),
                type: 'labor',
                groupTitle: "Ceilings",
                subItems: []
            };

            if (project.supplyConfig?.ceilingProduct) {
                applyPaintLogic(ceilingLine, totalCeilingArea * (project.supplyConfig.ceilingCoats || 2), project.supplyConfig.ceilingCoverage, project.supplyConfig.ceilingProduct);
            }

            lines.push(ceilingLine);
        }

        if (totalTrimLF > 0) {
            const trimWidth = project.supplyConfig?.defaultTrimWidth || 4;
            const trimLine: QuoteLineItem = {
                id: 'act-trim',
                description: `Paint Trim (${trimWidth}" width)`,
                quantity: totalTrimLF,
                unit: 'linear_ft',
                rate: project.supplyConfig?.defaultTrimRate || 1.5,
                amount: totalTrimLF * (project.supplyConfig?.defaultTrimRate || 1.5),
                type: 'labor',
                groupTitle: "Trim",
                subItems: []
            };

            if (project.supplyConfig?.trimProduct) {
                // Convert LF to SqFt for paint calc? Or assume coverage/LF?
                // Usually Trim Paint Coverage is SqFt.
                // LF * (width/12) * coats
                const trimArea = totalTrimLF * (trimWidth / 12) * (project.supplyConfig.trimCoats || 2);
                applyPaintLogic(trimLine, trimArea, project.supplyConfig.trimCoverage, project.supplyConfig.trimProduct, true);
            }

            lines.push(trimLine);
        }

        // --- GLOBAL ITEM INTEGRATION FOR ACTIVITY VIEW ---
        // Treat Global Misc as Activity Lines
        if (project.globalMiscItems && project.globalMiscItems.length > 0) {
            project.globalMiscItems.forEach((item: any) => {
                const miscLine: QuoteLineItem = {
                    id: `global-misc-${item.id}`,
                    description: item.name,
                    quantity: item.quantity,
                    unit: item.unit,
                    rate: item.rate,
                    amount: item.unit === 'fixed' ? item.rate : (item.rate * item.quantity),
                    type: 'labor',
                    groupTitle: item.name,
                    subItems: []
                };

                // Paint Logic (Same simplified logic as above)
                if (item.paintProductId) {
                    let area = 0;
                    if (item.unit === 'sqft') area = item.quantity * (item.count || 1);
                    else if (item.unit === 'linear_ft') area = item.quantity * (item.count || 1) * ((item.width || 0) / 12);

                    if (area > 0) {
                        const coverage = item.coverage || 350;
                        const gallons = Math.ceil(area / coverage);
                        let pricePerGal = 45;
                        let prodName = "Paint";

                        const prod = (item.paintProductId === 'default' ? project.supplyConfig?.wallProduct : catalog?.find((p: any) => p.id === item.paintProductId));
                        if (prod) {
                            pricePerGal = (prod as any).unitPrice || (prod as any).price || 45;
                            prodName = (prod as any).name;
                        }

                        const paintCost = gallons * pricePerGal;
                        const isBillable = project.supplyConfig?.billablePaint ?? true;

                        if (config.paintPlacement === 'inline') {
                            if (isBillable) {
                                miscLine.amount = (miscLine.amount || 0) + paintCost;
                                if (item.unit !== 'fixed' && miscLine.quantity) {
                                    miscLine.rate = miscLine.amount / miscLine.quantity;
                                }
                            }
                            if (config.paintDetails?.showName) {
                                miscLine.description += ` (w/ ${prodName})`;
                            }
                        } else if (config.paintPlacement === 'subline') {
                            miscLine.subItems?.push({
                                id: `global-misc-paint-${item.id}`,
                                description: `${prodName} (${gallons} gal)`,
                                quantity: gallons,
                                unit: 'gal',
                                rate: isBillable ? pricePerGal : 0,
                                amount: isBillable ? paintCost : 0,
                                type: 'material'
                            });
                        } else if (config.paintPlacement === 'separate_area') {
                            collectedMaterials.push({
                                id: `global-misc-paint-${item.id}`,
                                description: `${prodName} for ${item.name}`,
                                quantity: gallons,
                                unit: 'gal',
                                rate: isBillable ? pricePerGal : 0,
                                amount: isBillable ? paintCost : 0,
                                type: 'material',
                                groupTitle: "Paint Materials"
                            });
                        }
                    }
                }

                lines.push(miscLine);

                // Prep Tasks for Global Item - Add as separate lines
                if (item.prepTasks && item.prepTasks.length > 0) {
                    item.prepTasks.forEach((task: any) => {
                        lines.push({
                            id: `global-prep-${item.id}-${task.id}`,
                            description: `${task.name} (for ${item.name})`,
                            quantity: task.quantity,
                            unit: task.unit,
                            rate: task.rate,
                            amount: task.unit === 'fixed' ? task.rate : (task.rate * task.quantity),
                            type: 'prep',
                            groupTitle: item.name // Or "Preparation"?
                        });
                    });
                }
            });
        }

        // Room-Specific Additional Items (Grouped)
        const roomMiscMap = new Map<string, any>();
        rooms.forEach((r: any) => {
            if (r.miscItems) {
                r.miscItems.forEach((item: any) => {
                    // Create a unique key for grouping
                    // We group by Name, Unit, Rate, and Paint Product to ensuring distinct lines for distinct work
                    const key = `${item.name}-${item.unit}-${item.rate}-${item.paintProductId || 'none'}`;

                    if (!roomMiscMap.has(key)) {
                        roomMiscMap.set(key, { ...item, quantity: 0, amount: 0, count: 0 });
                    }

                    const grouped = roomMiscMap.get(key);
                    grouped.quantity += (item.quantity || 0);
                    // Protect against NaN
                    const rate = item.rate || 0;
                    const qty = item.quantity || 0;
                    grouped.amount += (item.unit === 'fixed' ? rate : rate * qty);
                    grouped.count += (item.count || 1); // Track count for potential paint usage?
                    // Note: if item has coats/width, we assume they are same for same 'key' (which includes name). 
                    // If they differ, we might merge incorrectly? 
                    // To be safe, maybe include ID? No, that breaks grouping.
                    // Name/Rate/PaintProduct usually sufficient.
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

            // Apply Paint Logic for Misc Items
            if (item.paintProductId) {
                let area = 0;
                // Calculate area for paint based on unit
                if (item.unit === 'sqft') {
                    area = item.quantity; // Sum of areas
                } else if (item.unit === 'linear_ft') {
                    // We need width. Item has width?
                    // We use the width from the aggregated item (assuming consistent).
                    // Or we should have summed area in the loop?
                    // Let's assume standard width if missing, or use item.width.
                    area = item.quantity * ((item.width || 4) / 12);
                } else if (item.unit === 'fixed') {
                    // Count * Area estimate? 
                    // Fixed items usually don't have dimension. 
                    // Maybe we can't calc paint easily without more data.
                    // But if it has coverage...
                    area = (item.count || 1) * 10; // Fallback? 
                    // Actually, for fixed items, quantity is usually 1 per item?
                    // If we have 2x 'Door', quantity might be 2?
                    // Let's trust the logic from `quote-generator-v2.ts` line 457 (Global Misc).
                    // verify: item.unit === 'fixed' ? item.rate : ...
                }

                // Recalculate area more precisely if needed, but for now:
                if (area > 0) {
                    // For Misc Items, use 'coats' from item or default 2
                    const coats = item.coats || 2;
                    // We need to fetch product.
                    // We need 'catalog' to find product by ID.
                    // But applyPaintLogic expects 'product' object.
                    // I need to find the product from catalog.
                    let product = null;
                    if (item.paintProductId === 'default') {
                        // Use Wall Product as default?
                        product = project.supplyConfig?.wallProduct;
                    } else if (catalog) {
                        product = catalog.find((p: any) => p.id === item.paintProductId);
                    }

                    if (product || item.paintProductId === 'default') {
                        applyPaintLogic(miscLine, area * coats, item.coverage || 350, product);
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
        const allMaterials: any[] = [];
        rooms.forEach((r: any) => {
            if (r.materialItems) allMaterials.push(...r.materialItems);
        });
        if (project.globalMaterialItems) allMaterials.push(...project.globalMaterialItems);

        if (allMaterials.length > 0) {
            lines.push({ id: 'h-proj-mat-act', description: "Project Materials", amount: 0, type: 'header', isGroupHeader: true, groupTitle: "Project Materials" });
            allMaterials.forEach((m: any, idx: number) => {
                lines.push({
                    id: `mat-all-${idx}`,
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

    // --- SEPARATE PAINT & MATERIALS PROCESSING ---

    // Filter collected materials into Paint vs Other
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
        // If Paint is NOT separate but Materials ARE separate
        // We still need to dump 'otherMaterials' (collectedMaterials that aren't paint? 
        // But collectedMaterials are only populated if materialPlacement is separate_area?
        // YES. But wait.
        // applyPaintLogic populates collectedMaterials ONLY IF paintPlacement === 'separate_area'.
        // So otherMaterials will strictly be non-paint here if paintPlacement !== separate_area?
        // Actually, if paintPlacement is inline, paintMaterials is empty.
        // If materialPlacement is separate, we might have misc items pushed there?
        // Check room Materials...
        // Lines 285+ (By Room) -> collectedMaterials.push if config.materialPlacement === 'separate_area'.
        // So yes, we handle 'otherMaterials' here if config.paintPlacement is NOT separate_area.

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
