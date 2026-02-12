import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '@/hooks/useCatalog';
import { useAuth } from '@/contexts/AuthContext';
import { CatalogItem, PaintProduct } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Search, Edit, Trash2, Package, Hammer, HelpCircle, PaintBucket, Plus } from 'lucide-react';
import { PaintProductDialog, NewPaintFormData } from '@/components/dialogs/PaintProductDialog';
import { MaterialProductDialog, NewMaterialFormData } from '@/components/dialogs/MaterialProductDialog';

export default function Catalog() {
    const { t } = useTranslation();
    const { items, loading, addItem, updateItem, deleteItem } = useCatalog();
    const { currentOrgRole } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    // Dialog States
    const [isPaintDialogOpen, setIsPaintDialogOpen] = useState(false);
    const [isMaterialDialogOpen, setIsMaterialDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

    const canManage = ['owner', 'admin', 'org_owner', 'org_admin'].includes(currentOrgRole || '');

    // Filtered Items
    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const paints = filteredItems.filter(i => i.category === 'paint' || i.category === 'primer');
    const materials = filteredItems.filter(i => i.category === 'material' || i.category === 'other');

    // Handlers for Paint
    const handleAddPaint = async (data: NewPaintFormData) => {
        const newItem = {
            name: data.name,
            category: 'paint' as const,
            unit: 'Gallon',
            unitPrice: data.price,
            unitCost: data.cost,
            coverage: data.coverage,
            paintDetails: data.details,
            description: `${data.details.manufacturer || ''} ${data.details.line || ''}`.trim()
        };
        await addItem(newItem);
    };

    const handleUpdatePaint = async (id: string, data: NewPaintFormData) => {
        const updates = {
            name: data.name,
            unitPrice: data.price,
            unitCost: data.cost,
            coverage: data.coverage,
            paintDetails: data.details,
            description: `${data.details.manufacturer || ''} ${data.details.line || ''}`.trim()
        };
        await updateItem(id, updates);
        setEditingItem(null);
    };

    // Handlers for Material
    const handleAddMaterial = async (data: NewMaterialFormData) => {
        // Validation handled in dialog
        const newItem = {
            name: data.name,
            category: data.category,
            unit: data.unit,
            unitPrice: data.unitPrice,
            unitCost: data.unitCost || undefined,
            description: data.description
        };
        await addItem(newItem);
    };

    const handleUpdateMaterial = async (id: string, data: NewMaterialFormData) => {
        const updates = {
            name: data.name,
            category: data.category,
            unit: data.unit,
            unitPrice: data.unitPrice,
            unitCost: data.unitCost || undefined,
            description: data.description
        };
        await updateItem(id, updates);
        setEditingItem(null);
    };

    const openEdit = (item: CatalogItem) => {
        setEditingItem(item);
        if (item.category === 'paint' || item.category === 'primer') {
            setIsPaintDialogOpen(true);
        } else {
            setIsMaterialDialogOpen(true);
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'material': return <Package className="h-4 w-4" />;
            case 'labor': return <Hammer className="h-4 w-4" />;
            case 'paint':
            case 'primer': return <PaintBucket className="h-4 w-4" />;
            default: return <HelpCircle className="h-4 w-4" />;
        }
    };

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Price Catalog</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage standard costs for materials, labor, and paints.
                    </p>
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search catalog..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
            </div>

            <Tabs defaultValue="paints" className="w-full">
                <TabsList>
                    <TabsTrigger value="paints" className="flex items-center gap-2">
                        <PaintBucket className="h-4 w-4" /> Paints & Primers
                    </TabsTrigger>
                    <TabsTrigger value="materials" className="flex items-center gap-2">
                        <Package className="h-4 w-4" /> Materials
                    </TabsTrigger>
                </TabsList>

                {/* PAINTS TAB */}
                <TabsContent value="paints" className="space-y-4 mt-4">
                    <div className="flex justify-end">
                        {canManage && (
                            <Button onClick={() => { setEditingItem(null); setIsPaintDialogOpen(true); }}>
                                <Plus className="mr-2 h-4 w-4" /> Add Paint
                            </Button>
                        )}
                    </div>
                    <div className="rounded-md border bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Manufacturer</TableHead>
                                    <TableHead>Coverage</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Margin</TableHead>
                                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                                ) : paints.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No paints found.</TableCell></TableRow>
                                ) : (
                                    paints.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell>{item.paintDetails?.manufacturer || '-'}</TableCell>
                                            <TableCell>{item.coverage || 350} sqft/gal</TableCell>
                                            <TableCell className="text-right">{item.unitCost ? `$${item.unitCost.toFixed(2)}` : '-'}</TableCell>
                                            <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                {item.unitCost ? (
                                                    <span className={item.unitPrice > item.unitCost ? 'text-green-600 font-medium' : 'text-red-600'}>
                                                        {((item.unitPrice - item.unitCost) / item.unitPrice * 100).toFixed(1)}%
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            {canManage && (
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => item.id && deleteItem(item.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                {/* MATERIALS TAB */}
                <TabsContent value="materials" className="space-y-4 mt-4">
                    <div className="flex justify-end">
                        {canManage && (
                            <Button onClick={() => { setEditingItem(null); setIsMaterialDialogOpen(true); }}>
                                <Plus className="mr-2 h-4 w-4" /> Add Material
                            </Button>
                        )}
                    </div>
                    <div className="rounded-md border bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Margin</TableHead>
                                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                                ) : materials.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No materials found.</TableCell></TableRow>
                                ) : (
                                    materials.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {getCategoryIcon(item.category)}
                                                    <span className="capitalize">{item.category}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{item.unit}</TableCell>
                                            <TableCell className="text-right">{item.unitCost ? `$${item.unitCost.toFixed(2)}` : '-'}</TableCell>
                                            <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                {item.unitCost ? (
                                                    <span className={item.unitPrice > item.unitCost ? 'text-green-600 font-medium' : 'text-red-600'}>
                                                        {((item.unitPrice - item.unitCost) / item.unitPrice * 100).toFixed(1)}%
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            {canManage && (
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => item.id && deleteItem(item.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>

            {/* DIALOGS */}
            <PaintProductDialog
                isOpen={isPaintDialogOpen}
                onOpenChange={(open) => {
                    setIsPaintDialogOpen(open);
                    if (!open) setEditingItem(null);
                }}
                onAdd={handleAddPaint}
                onUpdate={handleUpdatePaint}
                initialData={editingItem as PaintProduct} // Cast assuming correct logic
            />

            <MaterialProductDialog
                isOpen={isMaterialDialogOpen}
                onOpenChange={(open) => {
                    setIsMaterialDialogOpen(open);
                    if (!open) setEditingItem(null);
                }}
                onAdd={handleAddMaterial}
                onUpdate={handleUpdateMaterial}
                initialData={editingItem}
            />
        </div >
    );
}
