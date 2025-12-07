import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '@/hooks/useCatalog';
import { useAuth } from '@/contexts/AuthContext';
import { CatalogItem } from '@/lib/firestore';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Plus, Search, Edit, Trash2, Package, Hammer, HelpCircle } from 'lucide-react';

export default function Catalog() {
    const { t } = useTranslation();
    const { items, loading, addItem, updateItem, deleteItem } = useCatalog();
    const { currentOrgRole } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

    const canManage = currentOrgRole === 'owner' || currentOrgRole === 'admin';

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newItem = {
            name: formData.get('name') as string,
            category: formData.get('category') as 'material' | 'labor' | 'other',
            unit: formData.get('unit') as string,
            unitPrice: parseFloat(formData.get('unitPrice') as string),
            unitCost: formData.get('unitCost') ? parseFloat(formData.get('unitCost') as string) : null,
            description: formData.get('description') as string,
        };
        // Ensure we don't send NaN
        if (Number.isNaN(newItem.unitPrice)) newItem.unitPrice = 0;
        if (Number.isNaN(newItem.unitCost)) newItem.unitCost = null;
        await addItem(newItem);
        setIsAddDialogOpen(false);
    };

    const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingItem?.id) return;
        const formData = new FormData(e.currentTarget);
        const updates = {
            name: formData.get('name') as string,
            category: formData.get('category') as 'material' | 'labor' | 'other',
            unit: formData.get('unit') as string,
            unitPrice: parseFloat(formData.get('unitPrice') as string),
            unitCost: formData.get('unitCost') ? parseFloat(formData.get('unitCost') as string) : null,
            description: formData.get('description') as string,
        };
        // Ensure we don't send NaN
        if (Number.isNaN(updates.unitPrice)) updates.unitPrice = 0;
        if (Number.isNaN(updates.unitCost)) updates.unitCost = null;
        await updateItem(editingItem.id, updates);
        setEditingItem(null);
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'material': return <Package className="h-4 w-4" />;
            case 'labor': return <Hammer className="h-4 w-4" />;
            default: return <HelpCircle className="h-4 w-4" />;
        }
    };

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Price Catalog</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage standard costs for materials and labor.
                    </p>
                </div>
                {canManage && (
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Add Item
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Catalog Item</DialogTitle>
                                <DialogDescription>Create a new item for your price catalog.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" name="name" required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="category">Category</Label>
                                        <Select name="category" defaultValue="material">
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="material">Material</SelectItem>
                                                <SelectItem value="labor">Labor</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="unit">Unit</Label>
                                        <Input id="unit" name="unit" placeholder="e.g. gallon, hour" required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="unitCost">Unit Cost ($)</Label>
                                        <Input id="unitCost" name="unitCost" type="number" step="0.01" placeholder="Your cost" />
                                        <p className="text-xs text-muted-foreground">What you pay</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="unitPrice">Unit Price ($)</Label>
                                        <Input id="unitPrice" name="unitPrice" type="number" step="0.01" required placeholder="Customer price" />
                                        <p className="text-xs text-muted-foreground">What you charge</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description (Optional)</Label>
                                    <Input id="description" name="description" />
                                </div>
                                <DialogFooter>
                                    <Button type="submit">Create Item</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
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
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                            </TableRow>
                        ) : filteredItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredItems.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getCategoryIcon(item.category)}
                                            <span className="capitalize">{item.category}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{item.unit}</TableCell>
                                    <TableCell className="text-right">
                                        {item.unitCost ? `$${item.unitCost.toFixed(2)}` : '-'}
                                    </TableCell>
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
                                                <Button variant="ghost" size="icon" onClick={() => setEditingItem(item)}>
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

            {/* Edit Dialog */}
            <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Item</DialogTitle>
                    </DialogHeader>
                    {editingItem && (
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Name</Label>
                                <Input id="edit-name" name="name" defaultValue={editingItem.name} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-category">Category</Label>
                                    <Select name="category" defaultValue={editingItem.category}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="material">Material</SelectItem>
                                            <SelectItem value="labor">Labor</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-unit">Unit</Label>
                                    <Input id="edit-unit" name="unit" defaultValue={editingItem.unit} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-unitCost">Unit Cost ($)</Label>
                                    <Input id="edit-unitCost" name="unitCost" type="number" step="0.01" defaultValue={editingItem.unitCost} placeholder="Your cost" />
                                    <p className="text-xs text-muted-foreground">What you pay</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-unitPrice">Unit Price ($)</Label>
                                    <Input id="edit-unitPrice" name="unitPrice" type="number" step="0.01" defaultValue={editingItem.unitPrice} required placeholder="Customer price" />
                                    <p className="text-xs text-muted-foreground">What you charge</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-description">Description</Label>
                                <Input id="edit-description" name="description" defaultValue={editingItem.description} />
                            </div>
                            <DialogFooter>
                                <Button type="submit">Save Changes</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
