import { Project, Room } from './firestore';
import { QuoteDisplayConfig } from './firestore';

// --- INTERFACES ---

export interface AtomicTask {
    id: string; // unique
    roomId: string;
    roomName: string;
    surfaceType: 'wall' | 'ceiling' | 'trim' | 'door' | 'window' | 'cabinet' | 'other' | 'wallpaper';
    phase: 'prep' | 'prime' | 'finish' | 'cleanup';

    cost: number;
    laborCost: number;
    materialCost: number;

    hours: number;
    quantity: number;
    unit: string;

    productName: string;
    coatCount: number;
}

export interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number; // Unit Price
    total: number; // Quantity * Rate

    // Logic tags
    isMaterial?: boolean;
    isTax?: boolean;
    roomId?: string; // For grouping
    groupTitle?: string; // For visual headers
}

// --- ENGINE CORE ---

/**
 * 1. Generate Atomic Tasks (The "Truth" of the project cost)
 *    - Breaks down every surface into labor/material components
 */
function generateAtomicTasks(project: Project, rooms: Room[]): AtomicTask[] {
    const tasks: AtomicTask[] = [];
    const supply = project.supplyConfig || {};
    const labor = project.laborConfig || {};

    // Factors
    const laborRate = Number(labor.laborPricePerSqFt) || 1.50;
    const diffFactor = Number(labor.difficultyFactor) || 1.0;
    const prodRate = Number(labor.productionRate) || 150; // sqft/hr
    const hourlyWage = Number(labor.hourlyRate) || 60;

    rooms.forEach(room => {
        const wallArea = (room.length + room.width) * 2 * room.height;
        const ceilingArea = room.length * room.width;

        // --- WALLS ---
        // Prep
        tasks.push({
            id: `${room.id}_wall_prep`,
            roomId: (room as any).id || room.name,
            roomName: room.name,
            surfaceType: 'wall',
            phase: 'prep',
            cost: wallArea * 0.20 * diffFactor, // Mock prep cost
            laborCost: wallArea * 0.20 * diffFactor,
            materialCost: 0,
            hours: (wallArea / prodRate) * 0.2,
            quantity: wallArea,
            unit: 'sqft',
            productName: '',
            coatCount: 0
        });

        // Finish
        const wallCoats = Number(supply.wallCoats) || 2;
        const wallMatCost = (wallArea / 350) * wallCoats * 45; // Mock mat cost
        const wallLabCost = wallArea * laborRate * diffFactor;

        tasks.push({
            id: `${room.id}_wall_finish`,
            roomId: (room as any).id || room.name,
            roomName: room.name,
            surfaceType: 'wall',
            phase: 'finish',
            cost: wallMatCost + wallLabCost,
            laborCost: wallLabCost,
            materialCost: wallMatCost,
            hours: (wallArea / prodRate) * wallCoats,
            quantity: wallArea,
            unit: 'sqft',
            productName: supply.wallProduct?.name || 'Standard Paint',
            coatCount: wallCoats
        });

        // --- CEILING ---
        if (supply.includeCeiling) {
            const ceilLab = ceilingArea * laborRate * 0.8;
            const ceilMat = (ceilingArea / 350) * 2 * 35;

            tasks.push({
                id: `${room.id}_ceil_finish`,
                roomId: (room as any).id || room.name,
                roomName: room.name,
                surfaceType: 'ceiling',
                phase: 'finish',
                cost: ceilLab + ceilMat,
                laborCost: ceilLab,
                materialCost: ceilMat,
                hours: (ceilingArea / prodRate) * 2,
                quantity: ceilingArea,
                unit: 'sqft',
                productName: 'Ceiling Paint',
                coatCount: 2
            });
        }

        // --- WALLPAPER REMOVAL ---
        if (supply.includeWallpaperRemoval) {
            const wpRate = Number(supply.wallpaperRemovalRate) || 0.75;
            const wpLabor = wallArea * wpRate;

            tasks.push({
                id: `${room.id}_wp_rem`,
                roomId: (room as any).id || room.name,
                roomName: room.name,
                surfaceType: 'wallpaper',
                phase: 'prep',
                cost: wpLabor, // Labor only usually
                laborCost: wpLabor,
                materialCost: 0,
                hours: wpLabor / 60,
                quantity: wallArea,
                unit: 'sqft',
                productName: 'Removal Solution',
                coatCount: 0
            });
        }
    });

    // --- GLOBAL SETUP & CLEANUP ---
    // Added per user request to have setup/cleanup items
    tasks.push({
        id: 'global_setup',
        roomId: 'global',
        roomName: 'General',
        surfaceType: 'other',
        phase: 'prep',
        cost: 150,
        laborCost: 150,
        materialCost: 0,
        hours: 2.5,
        quantity: 1,
        unit: 'ea',
        productName: '',
        coatCount: 0
    });

    tasks.push({
        id: 'global_cleanup',
        roomId: 'global',
        roomName: 'General',
        surfaceType: 'other',
        phase: 'cleanup',
        cost: 100,
        laborCost: 100,
        materialCost: 0,
        hours: 1.5,
        quantity: 1,
        unit: 'ea',
        productName: '',
        coatCount: 0
    });

    return tasks;
}

/**
 * 2. Generate Quote Items (The Presentation Layer)
 *    - Aggregates tasks based on display config
 */
export function generateQuoteItems(
    project: Project,
    rooms: Room[],
    config: QuoteDisplayConfig
): LineItem[] {

    // A. Generate Atomic Tasks (The Truth)
    const atomicTasks = generateAtomicTasks(project, rooms);

    // B. Grouping Logic
    const groupedTasks: Record<string, AtomicTask[]> = {};
    const groupOrder: string[] = [];

    atomicTasks.forEach(task => {
        let groupKey = '';

        switch (config.organization) {
            case 'room':
                groupKey = task.roomId; // e.g. "room_123"
                if (task.roomId === 'global') groupKey = 'global'; // Ensure global sits together or separate?
                // Actually if grouping by room, 'global' tasks (Setup/Cleanup) should probably be their own group
                // or put in a 'General' room. Our task.roomId='global' logic handles this.
                break;
            case 'surface':
                groupKey = task.surfaceType;
                break;
            case 'floor':
                groupKey = (task as any).floorId || 'main_floor';
                break;
            case 'phase':
                groupKey = task.phase;
                break;
            default:
                groupKey = 'all';
        }

        if (!groupedTasks[groupKey]) {
            groupedTasks[groupKey] = [];
            groupOrder.push(groupKey);
        }
        groupedTasks[groupKey].push(task);
    });
    const lineItems: LineItem[] = [];
    const hourlyRate = (project.laborConfig as any)?.hourlyRate || 60;

    // C. Line Item Construction (per group)
    const pendingMaterials: { totalCost: number, desc: string, groupTitle: string }[] = [];
    let setupMaterialCost = 0;

    groupOrder.forEach(key => {
        const groupTasks = groupedTasks[key];
        const groupTitle = getGroupName(config.organization, groupTasks[0], key);

        const tasksBySubGroup: Record<string, AtomicTask[]> = {};
        groupTasks.forEach(t => {
            const subKey = `${t.surfaceType}_${t.phase}`;
            if (!tasksBySubGroup[subKey]) tasksBySubGroup[subKey] = [];
            tasksBySubGroup[subKey].push(t);
        });

        // Generate lines
        Object.keys(tasksBySubGroup).forEach(subKey => {
            const tasks = tasksBySubGroup[subKey];

            // Aggregates
            const totalLabor = tasks.reduce((sum, t) => sum + t.laborCost, 0);
            const totalMaterial = tasks.reduce((sum, t) => sum + t.materialCost, 0);
            const totalHours = tasks.reduce((sum, t) => sum + t.hours, 0);
            const totalQty = tasks.reduce((sum, t) => sum + t.quantity, 0);
            const refTask = tasks[0];

            const baseDesc = getBaseDescription(config, refTask, groupTitle, tasks.length > 1);

            if (config.itemComposition === 'bundled') {
                let qty = 1;
                let unit = 'lot';
                let rate = totalLabor + totalMaterial;
                let desc = baseDesc;

                if (config.laborPricingModel === 'hourly') {
                    const hrs = Math.ceil(totalHours);
                    qty = hrs;
                    unit = 'hrs';
                    desc += ` (${hrs} hrs est)`;
                    if (qty > 0) rate = (totalLabor + totalMaterial) / qty;
                }
                else if (config.laborPricingModel === 'unit_sqft') {
                    if (refTask.unit === 'sqft') {
                        qty = Math.round(totalQty);
                        unit = 'sqft';
                        if (qty > 0) rate = (totalLabor + totalMaterial) / qty;
                    }
                }

                if (config.laborPricingModel === 'day_rate') {
                    const hrs = totalHours;
                    const days = Math.ceil(hrs / 8);
                    qty = days;
                    unit = 'days';
                    if (qty > 0) rate = (totalLabor + totalMaterial) / qty;
                }

                lineItems.push({
                    id: `${key}_${subKey}_bundle`,
                    description: desc,
                    quantity: qty,
                    unit: unit,
                    rate: rate,
                    total: qty * rate,
                    roomId: key,
                    groupTitle: groupTitle
                });

            } else {
                // SEPARATED (Labor Line + Material Line)

                // 1. Labor Line
                let lQty = 1;
                let lUnit = 'lot';
                let lRate = totalLabor;
                let lDesc = `Labor: ${baseDesc}`;

                if (config.laborPricingModel === 'hourly') {
                    lQty = Math.ceil(totalHours);
                    lUnit = 'hrs';
                    if (lQty > 0) lRate = totalLabor / lQty;
                }
                else if (config.laborPricingModel === 'unit_sqft') {
                    if (refTask.unit === 'sqft') {
                        lQty = Math.round(totalQty);
                        lUnit = 'sqft';
                        if (lQty > 0) lRate = totalLabor / lQty;
                    }
                }
                else if (config.laborPricingModel === 'day_rate') {
                    lQty = Math.ceil(totalHours / 8);
                    lUnit = 'days';
                    if (lQty > 0) lRate = totalLabor / lQty;
                }

                lineItems.push({
                    id: `${key}_${subKey}_labor`,
                    description: lDesc,
                    quantity: lQty,
                    unit: lUnit,
                    rate: lRate,
                    total: lQty * lRate,
                    roomId: key,
                    groupTitle: groupTitle
                });

                // 2. Material Logic
                const grouping = config.materialGrouping || 'itemized_per_task';

                if (grouping === 'hidden') {
                    // Inject cost into Labor line above
                    const lastLine = lineItems[lineItems.length - 1];
                    // Recalculate rate? Or just add total?
                    // If unit is lot, easy. If sqft, rate increases.
                    // For simplicity, add to total and rate.
                    lastLine.total += totalMaterial;
                    if (lastLine.quantity > 0) lastLine.rate = lastLine.total / lastLine.quantity;
                }
                else if (grouping === 'combined_setup') {
                    setupMaterialCost += totalMaterial;
                }
                else if (grouping === 'combined_section') {
                    if (totalMaterial > 0) {
                        pendingMaterials.push({
                            totalCost: totalMaterial,
                            desc: `Materials for ${baseDesc}`,
                            groupTitle: 'Materials'
                        });
                    }
                }
                else { // 'itemized_per_task' (Default)
                    if (totalMaterial > 0.01 || config.materialStrategy === 'allowance') {
                        let mQty = 1;
                        let mUnit = 'lot';
                        let mRate = totalMaterial;
                        let mDesc = `Materials: ${baseDesc}`;

                        if (config.materialStrategy === 'specific_product') {
                            mDesc = `${refTask.productName}`;
                        } else {
                            // Smart Naming
                            mDesc = `Paint & Supplies: ${formatSurface(refTask.surfaceType)}`;
                        }

                        if (config.materialStrategy === 'itemized_volume') {
                            const coverage = 350;
                            const annualGals = totalQty / coverage;
                            mQty = Math.ceil(annualGals);
                            mUnit = 'gal';
                            if (mQty > 0) mRate = totalMaterial / mQty;
                        }

                        lineItems.push({
                            id: `${key}_${subKey}_mat`,
                            description: mDesc,
                            quantity: mQty,
                            unit: mUnit,
                            rate: mRate,
                            total: mQty * mRate,
                            isMaterial: true,
                            roomId: key,
                            groupTitle: groupTitle
                        });
                    }
                }
            }
        });
    });

    // Post-Process: Add Combined/Setup Materials
    const grouping = config.materialGrouping || 'itemized_per_task';

    if (grouping === 'combined_section' && pendingMaterials.length > 0) {
        pendingMaterials.forEach((pm, idx) => {
            lineItems.push({
                id: `global_mat_${idx}`,
                description: pm.desc,
                quantity: 1,
                unit: 'lot',
                rate: pm.totalCost,
                total: pm.totalCost,
                isMaterial: true,
                roomId: 'materials_section',
                groupTitle: 'Project Materials'
            });
        });
    }

    if (grouping === 'combined_setup' && setupMaterialCost > 0) {
        lineItems.push({
            id: `global_setup_materials`,
            description: "Project Materials & Supplies Package",
            quantity: 1,
            unit: 'lot',
            rate: setupMaterialCost,
            total: setupMaterialCost,
            isMaterial: true,
            roomId: 'global',
            groupTitle: 'Project General'
        });
    }

    return lineItems;
}

// --- HELPERS ---

function formatSurface(s: string) {
    if (s === 'wall') return 'Walls';
    if (s === 'ceiling') return 'Ceiling';
    if (s === 'trim') return 'Trim & Baseboards';
    if (s === 'wallpaper') return 'Wallpaper Removal';
    if (s === 'other') return 'General';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPhase(p: string) {
    if (p === 'prep') return 'Preparation';
    if (p === 'finish') return 'Application';
    if (p === 'cleanup') return 'Cleanup';
    return p.charAt(0).toUpperCase() + p.slice(1);
}

function getGroupName(org: string, task: AtomicTask, key: string) {
    if (task.roomId === 'global') return 'Project General';
    if (org === 'room') return task.roomName;
    if (org === 'surface') return formatSurface(task.surfaceType);
    if (org === 'floor') {
        if (key.includes('main')) return 'Main Level / Unit A';
        return 'Other Level';
    }
    if (org === 'phase') return formatPhase(task.phase);
    return 'Project Scope';
}

function getBaseDescription(config: QuoteDisplayConfig, task: AtomicTask, groupLabel: string, isAggregated: boolean) {
    const surfaceName = formatSurface(task.surfaceType);
    let desc = '';

    // Setup/Cleanup Special Case
    if (task.roomId === 'global') {
        if (task.phase === 'cleanup') return 'Job Site Cleanup & Disposal';
        if (task.phase === 'prep') return 'Site Protection & Setup';
        return 'General Task';
    }

    if (config.organization === 'room') {
        let action = 'Paint';
        if (task.phase === 'prep') action = 'Prepare';
        if (task.surfaceType === 'wallpaper') {
            desc = 'Remove Wallpaper';
        } else {
            desc = `${action} ${surfaceName}`;
        }
    } else {
        // Not grouped by room
        if (task.surfaceType === 'wallpaper') {
            desc = 'Remove Wallpaper';
        } else {
            const action = task.phase === 'prep' ? 'Prepare' : 'Paint';
            desc = `${action} ${surfaceName}`;
        }
    }

    // Config toggles (Apply to ALL)
    if (config.showCoatCounts && task.coatCount > 0 && task.phase !== 'prep' && task.surfaceType !== 'wallpaper') {
        desc += ` - ${task.coatCount} Coats`;
    }

    return desc;
}

// --- DEFAULTS ---
export const DEFAULT_QUOTE_CONFIG: QuoteDisplayConfig = {
    organization: 'room',
    itemComposition: 'bundled',
    laborPricingModel: 'unit_sqft',
    materialStrategy: 'inclusive',
    materialGrouping: 'itemized_per_task', // Default
    showCoatCounts: false, // Default OFF
    showPrepTasks: true,
    showColors: false,
    showDimensions: false,
    showQuantities: true,
    showRates: true,
    showDisclaimers: true, // Default ON
    showTaxLine: true,
    showSubtotals: false
};
