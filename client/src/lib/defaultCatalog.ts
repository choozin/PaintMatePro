import { CatalogItem } from './firestore';
import { Timestamp } from 'firebase/firestore';

export const DEFAULT_CATALOG_ITEMS: CatalogItem[] = [
    {
        id: 'default_brush_2',
        name: "2-inch Angled Sash Brush",
        category: "material",
        unit: "each",
        unitPrice: 12.99,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    {
        id: 'default_roller_frame_9',
        name: "9-inch Roller Frame",
        category: "material",
        unit: "each",
        unitPrice: 8.50,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    {
        id: 'default_roller_cover_9',
        name: "9-inch Roller Cover (3/8\" nap)",
        category: "material",
        unit: "each",
        unitPrice: 5.99,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    {
        id: 'default_tray',
        name: "Paint Tray and Liners",
        category: "material",
        unit: "each",
        unitPrice: 7.50,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    {
        id: 'default_pole',
        name: "Extension Pole",
        category: "material",
        unit: "each",
        unitPrice: 24.00,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    {
        id: 'default_spackle',
        name: "Spackling Paste",
        category: "material",
        unit: "each",
        unitPrice: 6.99,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    {
        id: 'default_sandpaper',
        name: "Sandpaper (120 grit)",
        category: "material",
        unit: "pack",
        unitPrice: 4.50,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    {
        id: 'default_tape',
        name: "Painter's Tape (1.5 inch)",
        category: "material",
        unit: "roll",
        unitPrice: 8.99,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    {
        id: 'default_drop_cloth',
        name: "Drop Cloth (Canvas)",
        category: "material",
        unit: "each",
        unitPrice: 18.00,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    },
    {
        id: 'default_plastic',
        name: "Plastic Sheeting",
        category: "material",
        unit: "roll",
        unitPrice: 12.00,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    }
];
