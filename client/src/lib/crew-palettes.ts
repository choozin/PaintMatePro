export interface CrewPalette {
    id: string;
    name: string;
    class: string; // Tailwind classes for background/border/text
    previewColor: string; // Hex for simple previews
}

export const CREW_PALETTES: CrewPalette[] = [
    {
        id: 'palette-1',
        name: 'Ocean Blue',
        class: 'bg-blue-100 text-blue-800 border-blue-300',
        previewColor: '#dbeafe'
    },
    {
        id: 'palette-2',
        name: 'Emerald Green',
        class: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        previewColor: '#d1fae5'
    },
    {
        id: 'palette-3',
        name: 'Violet Purple',
        class: 'bg-violet-100 text-violet-800 border-violet-300',
        previewColor: '#ede9fe'
    },
    {
        id: 'palette-4',
        name: 'Amber Orange',
        class: 'bg-amber-100 text-amber-800 border-amber-300',
        previewColor: '#fef3c7'
    },
    {
        id: 'palette-5',
        name: 'Rose Red',
        class: 'bg-rose-100 text-rose-800 border-rose-300',
        previewColor: '#ffe4e6'
    },
    {
        id: 'palette-6',
        name: 'Cyan Sky',
        class: 'bg-cyan-100 text-cyan-800 border-cyan-300',
        previewColor: '#cffafe'
    },
    {
        id: 'palette-7',
        name: 'Fuchsia Pink',
        class: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
        previewColor: '#fae8ff'
    },
    {
        id: 'palette-8',
        name: 'Lime Green',
        class: 'bg-lime-100 text-lime-800 border-lime-300',
        previewColor: '#ecfccb'
    },
    {
        id: 'palette-9',
        name: 'Indigo Night',
        class: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        previewColor: '#e0e7ff'
    },
    {
        id: 'palette-10',
        name: 'Teal Teal',
        class: 'bg-teal-100 text-teal-800 border-teal-300',
        previewColor: '#ccfbf1'
    }
];

export const PAUSE_STYLE = "bg-gray-100/50 text-gray-500 border-gray-200 border-dashed hover:bg-gray-100";
