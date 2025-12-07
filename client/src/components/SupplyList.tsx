import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useRooms } from "@/hooks/useRooms";
import { useProject, useUpdateProject } from "@/hooks/useProjects";
import { PaintBucket, CheckSquare, Plus, Trash2, Save, Loader2, Clock, DollarSign, Package, RotateCcw, CheckCircle2, Check, X, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalog } from "@/hooks/useCatalog";
import { useDebounce } from "@/hooks/useDebounce";
import { orgOperations } from "@/lib/firestore";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface PaintConfig {
    coveragePerGallon: number;
    wallCoats: number;
    ceilingCoats: number;
    trimCoats: number;
    includePrimer: boolean;
    includeCeiling: boolean;
    includeTrim: boolean;
    deductionFactor: number;
    ceilingSamePaint?: boolean;
    deductionMethod?: 'percent' | 'exact';
    deductionExactSqFt?: number;
    pricePerGallon?: number;
}

interface SupplyItem {
    id: string;
    name: string;
    qty: number;
    category: string;
    unitPrice?: number;
    unitCost?: number;
    unit?: string;
}

interface SupplyListProps {
    projectId: string;
}

export function SupplyList({ projectId }: SupplyListProps) {
    const { data: rooms, isLoading: isLoadingRooms } = useRooms(projectId);
    const { data: project, isLoading: isLoadingProject } = useProject(projectId);
    const { currentOrgId, currentOrgRole } = useAuth();
    const updateProject = useUpdateProject();
    const { t } = useTranslation();
    const canManageDefaults = currentOrgRole === 'owner' || currentOrgRole === 'admin';
    const { toast } = useToast();
    const { items: catalogItems, loading: loadingCatalog } = useCatalog();
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);

    // Auto-save state
    const isInitialLoad = useRef(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Configuration (Read-only from Project)
    const config: PaintConfig = React.useMemo(() => ({
        coveragePerGallon: project?.supplyConfig?.coveragePerGallon || 350,
        wallCoats: project?.supplyConfig?.wallCoats || 2,
        ceilingCoats: project?.supplyConfig?.ceilingCoats || 2,
        trimCoats: project?.supplyConfig?.trimCoats || 2,
        includePrimer: project?.supplyConfig?.includePrimer || false,
        includeCeiling: project?.supplyConfig?.includeCeiling || false,
        includeTrim: project?.supplyConfig?.includeTrim || false,
        deductionFactor: project?.supplyConfig?.deductionFactor || 0.10,
        ceilingSamePaint: project?.supplyConfig?.ceilingSamePaint || false,
        deductionMethod: project?.supplyConfig?.deductionMethod || 'percent',
        deductionExactSqFt: project?.supplyConfig?.deductionExactSqFt || 0,
        pricePerGallon: project?.supplyConfig?.pricePerGallon || 45,
    }), [project]);

    const laborConfig = React.useMemo(() => ({
        hourlyRate: project?.laborConfig?.hourlyRate || 60,
        productionRate: project?.laborConfig?.productionRate || 150,
        ceilingProductionRate: project?.laborConfig?.ceilingProductionRate || 100,
        difficultyFactor: project?.laborConfig?.difficultyFactor || 1.0,
    }), [project]);

    const [supplyItems, setSupplyItems] = useState<SupplyItem[]>([]);
    const [newSupplyName, setNewSupplyName] = useState("");
    const [newSupplyQty, setNewSupplyQty] = useState(1);
    const [newSupplyPrice, setNewSupplyPrice] = useState<number | undefined>(undefined);

    // Editing State
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingValues, setEditingValues] = useState<{ name: string, price: number }>({ name: '', price: 0 });

    // Load supplies
    useEffect(() => {
        if (project?.customSupplies) {
            setSupplyItems(project.customSupplies);
            // Mark initial load as complete after a short delay
            setTimeout(() => {
                isInitialLoad.current = false;
            }, 500);
        } else if (project && !project.customSupplies) {
            // If project loaded but no supplies, also mark as loaded
            setTimeout(() => {
                isInitialLoad.current = false;
            }, 500);
        }
    }, [project]);

    // Debounced Supply Items
    const debouncedSupplyItems = useDebounce(supplyItems, 1000);

    // Auto-Save Effect
    useEffect(() => {
        if (isInitialLoad.current) return;

        const saveSupplies = async () => {
            setSaveStatus('saving');
            try {
                await updateProject.mutateAsync({
                    id: projectId,
                    data: {
                        customSupplies: debouncedSupplyItems,
                    }
                });
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (error) {
                setSaveStatus('idle');
                toast({ variant: "destructive", title: "Auto-Save Failed", description: "Could not save supplies." });
            }
        };

        saveSupplies();
    }, [debouncedSupplyItems]);

    // Handle Supply Items
    const addSupplyItem = () => {
        if (!newSupplyName.trim()) return;
        const newItem: SupplyItem = {
            id: crypto.randomUUID(),
            name: newSupplyName,
            qty: newSupplyQty,
            category: "Custom",
            unitPrice: newSupplyPrice
        };
        setSupplyItems(prev => [...prev, newItem]);
        setNewSupplyName("");
        setNewSupplyQty(1);
        setNewSupplyPrice(undefined);
    };

    const removeSupplyItem = (id: string) => {
        setSupplyItems(prev => prev.filter(item => item.id !== id));
    };

    const updateSupplyItemQty = (id: string, qty: number) => {
        setSupplyItems(prev => prev.map(item => item.id === id ? { ...item, qty } : item));
    };

    const startEditing = (item: SupplyItem) => {
        setEditingItemId(item.id);
        setEditingValues({
            name: item.name,
            price: item.unitPrice || 0
        });
    };

    const cancelEditing = () => {
        setEditingItemId(null);
        setEditingValues({ name: '', price: 0 });
    };

    const saveEditing = () => {
        if (!editingItemId) return;

        setSupplyItems(prev => prev.map(item => {
            if (item.id === editingItemId) {
                return {
                    ...item,
                    name: editingValues.name,
                    unitPrice: editingValues.price
                };
            }
            return item;
        }));
        setEditingItemId(null);
    };

    const addCatalogItem = (item: any) => {
        const newItem: SupplyItem = {
            id: crypto.randomUUID(),
            name: item.name,
            qty: 1,
            category: item.category,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            unit: item.unit
        };
        setSupplyItems(prev => [...prev, newItem]);
        setIsCatalogOpen(false);
        toast({ title: "Item Added", description: `${item.name} added to supplies.` });
    };

    // Calculations
    const stats = React.useMemo(() => {
        if (!rooms) return { totalWallArea: 0, totalFloorArea: 0, totalPerimeter: 0 };
        return rooms.reduce((acc, room) => {
            const l = room.length || 0;
            const w = room.width || 0;
            const h = room.height || 0;
            const perimeter = (l + w) * 2;

            return {
                totalWallArea: acc.totalWallArea + (perimeter * h),
                totalFloorArea: acc.totalFloorArea + (l * w),
                totalPerimeter: acc.totalPerimeter + perimeter
            };
        }, { totalWallArea: 0, totalFloorArea: 0, totalPerimeter: 0 });
    }, [rooms]);

    const paintNeeds = React.useMemo(() => {
        // Apply deduction logic
        let netWallArea = stats.totalWallArea;
        if (config.deductionMethod === 'exact') {
            netWallArea = Math.max(0, stats.totalWallArea - (config.deductionExactSqFt || 0));
        } else {
            netWallArea = stats.totalWallArea * (1 - config.deductionFactor);
        }

        let wallGallons = 0;
        let ceilingGallons = 0;

        // Ceiling Logic
        const ceilingArea = config.includeCeiling ? stats.totalFloorArea : 0;

        if (config.includeCeiling && config.ceilingSamePaint) {
            // Combine areas for optimization
            const totalPaintableArea = (netWallArea * config.wallCoats) + (ceilingArea * config.ceilingCoats);
            wallGallons = Math.ceil(totalPaintableArea / config.coveragePerGallon);
            // ceilingGallons remains 0 because it's included in wallGallons (which is now "Main Paint")
        } else {
            // Separate calculations
            wallGallons = Math.ceil((netWallArea * config.wallCoats) / config.coveragePerGallon);
            ceilingGallons = config.includeCeiling
                ? Math.ceil((ceilingArea * config.ceilingCoats) / config.coveragePerGallon)
                : 0;
        }

        // Estimate trim area: Perimeter * 0.5ft (6 inches)
        const trimArea = stats.totalPerimeter * 0.5;
        const trimGallons = config.includeTrim
            ? Math.ceil((trimArea * config.trimCoats) / config.coveragePerGallon)
            : 0;
        const primerGallons = config.includePrimer
            ? Math.ceil(netWallArea / config.coveragePerGallon)
            : 0;

        return {
            netWallArea,
            wall: wallGallons,
            ceiling: ceilingGallons,
            trim: trimGallons,
            primer: primerGallons,
            total: wallGallons + ceilingGallons + trimGallons + primerGallons
        };
    }, [stats, config]);

    const laborStats = React.useMemo(() => {
        // Refined Labor Logic
        // Wall Hours
        const wallHours = paintNeeds.netWallArea / laborConfig.productionRate;

        // Ceiling Hours (use specific rate if available, else default production rate)
        let ceilingHours = 0;
        if (config.includeCeiling) {
            const rate = laborConfig.ceilingProductionRate || laborConfig.productionRate;
            ceilingHours = stats.totalFloorArea / rate;
        }

        // Trim Hours (simplified: 150 linear ft per hour approx, or use production rate as proxy for now)
        let trimHours = 0;
        if (config.includeTrim) {
            const trimArea = stats.totalPerimeter * 0.5;
            trimHours = trimArea / laborConfig.productionRate; // Using wall rate for trim for now
        }

        const baseHours = wallHours + ceilingHours + trimHours;
        const totalHours = baseHours * laborConfig.difficultyFactor;
        const totalCost = totalHours * laborConfig.hourlyRate;

        return { totalHours, totalCost };
    }, [paintNeeds, stats, config, laborConfig]);

    const materialsStats = React.useMemo(() => {
        const paintCost = paintNeeds.total * (config.pricePerGallon || 45);
        const suppliesCost = supplyItems.reduce((acc, item) => acc + (item.qty * (item.unitPrice || 0)), 0);
        return {
            paintCost,
            suppliesCost,
            totalCost: paintCost + suppliesCost
        };
    }, [paintNeeds, config.pricePerGallon, supplyItems]);

    // Fetch Org Rules & Tax Rate
    const [orgRules, setOrgRules] = React.useState<any[]>([]);
    const [taxRate, setTaxRate] = React.useState(0);

    React.useEffect(() => {
        if (currentOrgId) {
            orgOperations.get(currentOrgId).then(org => {
                if (org?.supplyRules) {
                    setOrgRules(org.supplyRules);
                }
                if (org?.estimatingSettings?.defaultTaxRate) {
                    setTaxRate(org.estimatingSettings.defaultTaxRate);
                }
            });
        }
    }, [currentOrgId]);

    const projectTotals = React.useMemo(() => {
        const subtotal = materialsStats.totalCost + laborStats.totalCost;
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;
        return { subtotal, taxAmount, total };
    }, [materialsStats.totalCost, laborStats.totalCost, taxRate]);

    // Generate Defaults
    const generateDefaults = () => {
        let items: SupplyItem[] = [];

        if (orgRules.length > 0) {
            // Use Custom Rules
            items = orgRules.map(rule => {
                // Check Condition
                let shouldInclude = false;
                switch (rule.condition) {
                    case 'always': shouldInclude = true; break;
                    case 'if_ceiling': shouldInclude = config.includeCeiling; break;
                    case 'if_trim': shouldInclude = config.includeTrim; break;
                    case 'if_primer': shouldInclude = config.includePrimer; break;
                    case 'if_floor_area': shouldInclude = (stats.totalFloorArea || 0) > 0; break;
                }

                if (!shouldInclude) return null;

                // Calculate Quantity
                let qty = 0;
                switch (rule.quantityType) {
                    case 'fixed':
                        qty = rule.quantityBase;
                        break;
                    case 'per_sqft_wall':
                        qty = Math.ceil(paintNeeds.netWallArea / rule.quantityBase);
                        break;
                    case 'per_sqft_floor':
                        qty = Math.ceil((stats.totalFloorArea || 0) / rule.quantityBase);
                        break;
                    case 'per_gallon_total':
                        qty = Math.ceil(paintNeeds.total / rule.quantityBase);
                        break;
                    case 'per_gallon_primer':
                        qty = Math.ceil(paintNeeds.primer / rule.quantityBase);
                        break;
                    case 'per_linear_ft_perimeter':
                        qty = Math.ceil((stats.totalPerimeter || 0) / rule.quantityBase);
                        break;
                }

                if (qty <= 0) return null;

                return {
                    id: crypto.randomUUID(),
                    name: rule.name,
                    category: rule.category,
                    qty: qty,
                    unitPrice: rule.unitPrice,
                    unitCost: rule.unitCost,
                    unit: rule.unit
                };
            }).filter(Boolean) as SupplyItem[];

        } else {
            // Fallback to Hardcoded Defaults
            items = [
                { id: 'brush', name: "2-inch Angled Sash Brush", category: "Application", qty: 2, unitPrice: 12.99, unit: "each" },
                { id: 'roller-frame', name: "9-inch Roller Frame", category: "Application", qty: 1, unitPrice: 8.50, unit: "each" },
                { id: 'roller-cover', name: "9-inch Roller Covers (3/8\" nap)", category: "Application", qty: Math.ceil(paintNeeds.total / 2) || 1, unitPrice: 5.99, unit: "each" },
                { id: 'tray', name: "Paint Tray and Liners", category: "Application", qty: 1, unitPrice: 7.50, unit: "each" },
                { id: 'pole', name: "Extension Pole", category: "Application", qty: 1, unitPrice: 24.00, unit: "each" },
                { id: 'spackle', name: "Spackling Paste & Putty Knife", category: "Prep", qty: 1, unitPrice: 6.99, unit: "each" },
                { id: 'sandpaper', name: "Sandpaper (120 grit)", category: "Prep", qty: 1, unitPrice: 4.50, unit: "pack" },
            ];

            if (config.includePrimer) {
                items.push({ id: 'primer-sealer', name: "PVA Primer Sealer", category: "Prep", qty: Math.ceil(paintNeeds.primer / 5) || 1, unitPrice: 18.00, unit: "gal" });
            }

            if (stats.totalFloorArea > 0) {
                const dropClothQty = Math.ceil(stats.totalFloorArea / 200); // 1 per 200 sq ft
                items.push({ id: 'drop-cloth', name: "Canvas Drop Cloth (9x12)", category: "Prep", qty: dropClothQty || 1, unitPrice: 22.00, unit: "each" });
                items.push({ id: 'plastic', name: "Plastic Sheeting (9x400)", category: "Prep", qty: 1, unitPrice: 14.00, unit: "roll" });
                items.push({ id: 'tape', name: "Painter's Tape (1.88\")", category: "Prep", qty: Math.ceil(stats.totalPerimeter / 180) || 2, unitPrice: 8.99, unit: "roll" });
            }
        }

        setSupplyItems(prev => {
            return [...prev, ...items];
        });
    };

    // Auto-generate on first load if empty and we have rooms
    useEffect(() => {
        if (supplyItems.length === 0 && rooms && rooms.length > 0 && !isLoadingProject) {
            // Only if we haven't saved before? 
            // Ideally we check if project.customSupplies was undefined.
            // For now, let's rely on the user clicking "Generate" or just doing it once.
            // Actually, let's NOT auto-generate to avoid overwriting if they intentionally cleared it.
            // But for new projects, it's helpful.
            // Let's add a "Generate Recommendations" button instead of auto-magic.
        }
    }, [rooms, isLoadingProject]);

    if (isLoadingRooms || isLoadingProject) {
        return <Skeleton className="h-[600px] w-full" />;
    }

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Supply List</h2>
                    <p className="text-muted-foreground">Manage materials and view estimated costs.</p>
                </div>
                <div className="flex gap-2 items-center">
                    {/* Auto-Save Indicator */}
                    <div className="flex items-center text-xs text-muted-foreground transition-all duration-300 mr-2">
                        {saveStatus === 'saving' && (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                Saving...
                            </>
                        )}
                        {saveStatus === 'saved' && (
                            <>
                                <CheckCircle2 className="h-3 w-3 text-green-500 mr-1" />
                                Saved
                            </>
                        )}
                    </div>

                    <Button
                        variant={supplyItems.length === 0 ? "default" : "outline"}
                        onClick={generateDefaults}
                        className={supplyItems.length === 0 ? "animate-pulse shadow-lg" : ""}
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {supplyItems.length === 0 ? "Generate Recommendations" : "Regenerate Defaults"}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Supply List (Left Column) */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <CheckSquare className="h-5 w-5" />
                                    Supply Items
                                </CardTitle>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setIsCatalogOpen(true)}>
                                        <Package className="h-4 w-4 mr-2" />
                                        Catalog
                                    </Button>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Plus className="h-4 w-4 mr-2" />
                                                Custom
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Add Custom Item</DialogTitle>
                                                <DialogDescription>Add a manual item to the list.</DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid grid-cols-4 items-center gap-4">
                                                    <Label htmlFor="name" className="text-right">Item Name</Label>
                                                    <Input id="name" value={newSupplyName} onChange={(e) => setNewSupplyName(e.target.value)} className="col-span-3" />
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-4">
                                                    <Label htmlFor="qty" className="text-right">Quantity</Label>
                                                    <Input id="qty" type="number" value={newSupplyQty} onChange={(e) => setNewSupplyQty(parseInt(e.target.value) || 1)} className="col-span-3" />
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-4">
                                                    <Label htmlFor="price" className="text-right">Price</Label>
                                                    <Input id="price" type="number" value={newSupplyPrice || ''} onChange={(e) => setNewSupplyPrice(parseFloat(e.target.value))} className="col-span-3" placeholder="0.00" />
                                                </div>
                                            </div>
                                            <Button onClick={addSupplyItem} disabled={!newSupplyName.trim()}>Add Item</Button>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {supplyItems.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                    <Package className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                                    <h3 className="mt-4 text-lg font-semibold">No Supplies Yet</h3>
                                    <p className="text-muted-foreground mb-6">Generate recommendations based on your project specs.</p>
                                    <Button onClick={generateDefaults} size="lg" className="animate-pulse">
                                        <RotateCcw className="h-4 w-4 mr-2" />
                                        Generate Recommendations
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-1">
                                    {supplyItems.map((item, idx) => (
                                        <div key={item.id || idx} className="flex items-center justify-between p-3 rounded-md border bg-muted/30 group hover:bg-muted/50 transition-colors">
                                            {editingItemId === item.id ? (
                                                <div className="flex items-center gap-3 flex-1 mr-4">
                                                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                        {item.qty}
                                                    </div>
                                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                                        <Input
                                                            value={editingValues.name}
                                                            onChange={(e) => setEditingValues(prev => ({ ...prev, name: e.target.value }))}
                                                            placeholder="Item Name"
                                                            className="h-8"
                                                        />
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                                            <Input
                                                                type="number"
                                                                value={editingValues.price}
                                                                onChange={(e) => setEditingValues(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                                                                placeholder="0.00"
                                                                className="h-8 pl-6"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                        {item.qty}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{item.name}</div>
                                                        <div className="text-xs text-muted-foreground">{item.category} • {item.unit || 'each'}</div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-4">
                                                {editingItemId === item.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100" onClick={saveEditing}>
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={cancelEditing}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {item.unitPrice && (
                                                            <div className="text-sm font-medium text-muted-foreground">
                                                                ${(item.unitPrice * item.qty).toFixed(2)}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEditing(item)}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateSupplyItemQty(item.id, Math.max(0, item.qty - 1))}>-</Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateSupplyItemQty(item.id, item.qty + 1)}>+</Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeSupplyItem(item.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Estimates (Right Column) */}
                <div className="space-y-6">
                    {/* Total Paint Needed */}
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-medium text-primary flex items-center gap-2">
                                <PaintBucket className="h-5 w-5" />
                                Paint Needed
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-primary mb-2">{paintNeeds.total} <span className="text-lg font-normal text-muted-foreground">gal</span></div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Walls ({config.wallCoats} coats)</span>
                                    <span className="font-medium">{paintNeeds.wall} gal</span>
                                </div>
                                {config.includeCeiling && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Ceilings ({config.ceilingCoats} coats)</span>
                                        <span className="font-medium">{paintNeeds.ceiling} gal</span>
                                    </div>
                                )}
                                {config.includeTrim && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Trim ({config.trimCoats} coats)</span>
                                        <span className="font-medium">{paintNeeds.trim} gal</span>
                                    </div>
                                )}
                                {config.includePrimer && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Primer</span>
                                        <span className="font-medium">{paintNeeds.primer} gal</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Materials Estimate */}
                    <Card className="border-orange-200 bg-orange-50/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-medium flex items-center gap-2 text-orange-800">
                                <DollarSign className="h-5 w-5" />
                                Materials Cost
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Paint</span>
                                    <span className="font-medium">${materialsStats.paintCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Supplies</span>
                                    <span className="font-medium">${materialsStats.suppliesCost.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-orange-200 flex justify-between items-end">
                                <span className="text-sm font-medium text-orange-800">Total Estimated</span>
                                <span className="text-2xl font-bold text-orange-600">${materialsStats.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Labor Estimator (Read Only) */}
                    <Card className="border-blue-200 bg-blue-50/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-medium flex items-center gap-2 text-blue-800">
                                <Clock className="h-5 w-5" />
                                Labor Estimate
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Rate</span>
                                    <span className="font-medium">${laborConfig.hourlyRate}/hr</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Difficulty</span>
                                    <span className="font-medium">{laborConfig.difficultyFactor}x</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Hours</span>
                                    <span className="font-medium">{laborStats.totalHours.toFixed(1)} hrs</span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-blue-200 flex justify-between items-end">
                                <span className="text-sm font-medium text-blue-800">Total Estimated</span>
                                <span className="text-2xl font-bold text-green-600">${laborStats.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Project Totals */}
                    <Card className="border-green-200 bg-green-50/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-medium flex items-center gap-2 text-green-800">
                                <DollarSign className="h-5 w-5" />
                                Project Totals
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Materials Subtotal</span>
                                    <span className="font-medium">${materialsStats.totalCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Labor Subtotal</span>
                                    <span className="font-medium">${laborStats.totalCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-2 border-t border-green-200/50">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-medium">${projectTotals.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                                    <span className="font-medium">${projectTotals.taxAmount.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-green-200 flex justify-between items-end">
                                <span className="text-sm font-medium text-green-800">Total Estimate</span>
                                <span className="text-3xl font-bold text-green-700">${projectTotals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Catalog Import Dialog */}
            <Dialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Import from Catalog</DialogTitle>
                        <DialogDescription>Select an item to add to your supply list.</DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingCatalog ? (
                                    <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>
                                ) : catalogItems.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="text-center">No items found.</TableCell></TableRow>
                                ) : (
                                    catalogItems.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell className="capitalize">{item.category}</TableCell>
                                            <TableCell>{item.unit}</TableCell>
                                            <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Button size="sm" onClick={() => addCatalogItem(item)}>
                                                    Add
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
