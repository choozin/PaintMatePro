import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CatalogItem } from "@/lib/firestore";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

export interface NewMaterialFormData {
    name: string;
    category: 'material' | 'labor' | 'other';
    unit: string;
    unitPrice: number;
    unitCost: number | null;
    description: string;
}

export function MaterialProductDialog({
    isOpen,
    onOpenChange,
    onAdd,
    onUpdate,
    initialData
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (data: NewMaterialFormData) => Promise<void>;
    onUpdate?: (id: string, data: NewMaterialFormData) => Promise<void>;
    initialData?: CatalogItem | null;
}) {
    const { org } = useAuth();
    const [name, setName] = useState("");
    const [category, setCategory] = useState<'material' | 'labor' | 'other'>("material");
    const [unit, setUnit] = useState("");
    const [unitCost, setUnitCost] = useState<string>("");
    const [unitPrice, setUnitPrice] = useState<string>("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name);
            setCategory(initialData.category as any);
            setUnit(initialData.unit);
            setUnitCost(initialData.unitCost ? initialData.unitCost.toString() : "");
            setUnitPrice(initialData.unitPrice.toString());
            setDescription(initialData.description || "");
        } else if (isOpen && !initialData) {
            setName("");
            setCategory("material");
            setUnit("");
            setUnitCost("");
            setUnitPrice("");
            setDescription("");
        }
    }, [isOpen, initialData]);

    const handleCostChange = (val: string) => {
        setUnitCost(val);
        const costNum = parseFloat(val);
        if (!isNaN(costNum) && org?.defaultMarkupValue && org.defaultMarkupValue > 0) {
            let newPriceNum = 0;
            if (org.defaultMarkupType === 'fixed') {
                newPriceNum = costNum + org.defaultMarkupValue;
            } else {
                newPriceNum = costNum * (1 + (org.defaultMarkupValue / 100));
            }
            setUnitPrice(newPriceNum.toFixed(2));
        }
    };

    const getFormData = (): NewMaterialFormData | null => {
        if (!name || !unit || !unitPrice) return null;
        return {
            name,
            category,
            unit,
            unitPrice: parseFloat(unitPrice),
            unitCost: unitCost ? parseFloat(unitCost) : null,
            description
        };
    };

    // ... existing handlers ...
    const handleSaveAsNew = async () => {
        const data = getFormData();
        if (!data) return;

        if (initialData && name === initialData.name) {
            alert("Please change the name to save as a new item.");
            return;
        }

        setIsSubmitting(true);
        try {
            await onAdd(data);
            onOpenChange(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOverwrite = async () => {
        if (!initialData || !onUpdate) return;
        const data = getFormData();
        if (!data) return;

        if (name !== initialData.name) {
            alert("To overwrite, you must keep the original name. If you want to change the name, please use 'Save as New'.");
            return;
        }

        if (!window.confirm("Are you sure you want to overwrite this item?")) {
            return;
        }

        setIsSubmitting(true);
        try {
            await onUpdate(initialData.id!, data);
            onOpenChange(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Edit Catalog Item' : 'Add Catalog Item'}</DialogTitle>
                    <DialogDescription>
                        {initialData ? 'Edit item details.' : 'Add a new item to your catalog.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Select value={category} onValueChange={(val: any) => setCategory(val)}>
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
                            <Label htmlFor="unit">Unit *</Label>
                            <Input id="unit" value={unit} onChange={e => setUnit(e.target.value)} placeholder="e.g. gallon, hour" required />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="unitCost">Unit Cost ($)</Label>
                            <Input
                                id="unitCost"
                                type="number"
                                step="0.01"
                                value={unitCost}
                                onChange={e => handleCostChange(e.target.value)}
                                placeholder="Your cost"
                            />
                            <p className="text-xs text-muted-foreground">What you pay</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unitPrice">Unit Price ($) *</Label>
                            <Input
                                id="unitPrice"
                                type="number"
                                step="0.01"
                                value={unitPrice}
                                onChange={e => setUnitPrice(e.target.value)}
                                required
                                placeholder="Customer price"
                            />
                            <p className="text-xs text-muted-foreground">What you charge</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Input id="description" value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    {initialData ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleOverwrite}
                                disabled={isSubmitting || !name || !unit || !unitPrice}
                                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                            >
                                Overwrite Existing
                            </Button>
                            <Button onClick={handleSaveAsNew} disabled={isSubmitting || !name || !unit || !unitPrice}>
                                Save as New Copy
                            </Button>
                        </>
                    ) : (
                        <Button onClick={handleSaveAsNew} disabled={isSubmitting || !name || !unit || !unitPrice}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Create Item
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
