import { SupplyRule } from './firestore';

export const DEFAULT_SUPPLY_RULES: SupplyRule[] = [
    {
        id: 'default-brush',
        name: "2-inch Angled Sash Brush",
        category: "Application",
        unit: "each",
        unitPrice: 12.99,
        condition: 'always',
        quantityType: 'fixed',
        quantityBase: 2
    },
    {
        id: 'default-roller-frame',
        name: "9-inch Roller Frame",
        category: "Application",
        unit: "each",
        unitPrice: 8.50,
        condition: 'always',
        quantityType: 'fixed',
        quantityBase: 1
    },
    {
        id: 'default-roller-cover',
        name: "9-inch Roller Covers (3/8\" nap)",
        category: "Application",
        unit: "each",
        unitPrice: 5.99,
        condition: 'always',
        quantityType: 'per_gallon_total',
        quantityBase: 2 // 1 per 2 gallons
    },
    {
        id: 'default-tray',
        name: "Paint Tray and Liners",
        category: "Application",
        unit: "each",
        unitPrice: 7.50,
        condition: 'always',
        quantityType: 'fixed',
        quantityBase: 1
    },
    {
        id: 'default-pole',
        name: "Extension Pole",
        category: "Application",
        unit: "each",
        unitPrice: 24.00,
        condition: 'always',
        quantityType: 'fixed',
        quantityBase: 1
    },
    {
        id: 'default-spackle',
        name: "Spackling Paste & Putty Knife",
        category: "Prep",
        unit: "each",
        unitPrice: 6.99,
        condition: 'always',
        quantityType: 'fixed',
        quantityBase: 1
    },
    {
        id: 'default-sandpaper',
        name: "Sandpaper (120 grit)",
        category: "Prep",
        unit: "pack",
        unitPrice: 4.50,
        condition: 'always',
        quantityType: 'fixed',
        quantityBase: 1
    },
    {
        id: 'default-primer',
        name: "PVA Primer Sealer",
        category: "Prep",
        unit: "gal",
        unitPrice: 18.00,
        condition: 'if_primer',
        quantityType: 'per_gallon_primer',
        quantityBase: 5
    },
    {
        id: 'default-drop-cloth',
        name: "Canvas Drop Cloth (9x12)",
        category: "Prep",
        unit: "each",
        unitPrice: 22.00,
        condition: 'if_floor_area',
        quantityType: 'per_sqft_floor',
        quantityBase: 200
    },
    {
        id: 'default-plastic',
        name: "Plastic Sheeting (9x400)",
        category: "Prep",
        unit: "roll",
        unitPrice: 14.00,
        condition: 'if_floor_area',
        quantityType: 'fixed',
        quantityBase: 1
    },
    {
        id: 'default-tape',
        name: "Painter's Tape (1.88\")",
        category: "Prep",
        unit: "roll",
        unitPrice: 8.99,
        condition: 'if_floor_area', // Or always? Hardcoded used floor area check for tape too usually
        quantityType: 'per_linear_ft_perimeter',
        quantityBase: 180
    }
];
