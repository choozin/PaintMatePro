import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProject, useUpdateProject } from "@/hooks/useProjects";
import { useRooms, useUpdateRoom } from "@/hooks/useRooms";
import { FeatureLock } from "@/components/FeatureLock";
import { Settings2, Save, Loader2, RotateCcw, MoreVertical, Clock, CheckCircle2, DollarSign, PaintBucket, AlertCircle, PlusCircle, ChevronDown, ChevronUp, Ruler, Package, Trash2, ArrowDownToLine, Copy, Pencil, Link as LinkIcon, Palette, Wand2, Camera, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { orgOperations, PaintProduct, PaintDetails, roomOperations, Room, PrepTask, MiscMeasurement, PaintConfig } from "@/lib/firestore";
import { useDebounce } from "@/hooks/useDebounce";
import { FileText } from "lucide-react";
import { useCatalog } from "@/hooks/useCatalog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { PaintProductDialog, NewPaintFormData } from "./dialogs/PaintProductDialog";

// --- Types ---


interface ProjectSpecsProps {
    projectId: string;
    onNext?: () => void;
}



const formatUnit = (unit: string) => {
    switch (unit) {
        case 'linear_ft': return 'Linear Ft.';
        case 'sqft': return 'Sq. Ft.';
        case 'units': return 'Each';
        case 'hours': return 'Hrs';
        case 'fixed': return 'Fixed';
        default: return unit;
    }
};

// --- InfoTip Component (Radix Tooltip with tap support) ---
function InfoTip({ content }: { content: string }) {
    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button type="button" className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none" tabIndex={0}>
                        <Info className="h-3.5 w-3.5" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// --- Sub-Components ---



function PaintSelectorDialog({
    isOpen,
    onOpenChange,
    products,
    onSelect,
    onAddNew,
    onEdit
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    products: PaintProduct[];
    onSelect: (product: PaintProduct) => void;
    onAddNew: () => void;
    onEdit?: (product: PaintProduct) => void;
}) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Select Paint Product</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[50vh] pr-4">
                    <div className="space-y-2 p-1">
                        {products.map(p => (
                            <div key={p.id} className="flex items-center gap-2">
                                <div className="flex-1 flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer group" onClick={() => onSelect(p)}>
                                    <div>
                                        <div className="font-medium group-hover:text-blue-600 transition-colors">{p.name}</div>
                                        <div className="text-sm text-muted-foreground flex gap-3">
                                            <span className="flex items-center"><DollarSign className="h-3 w-3 mr-1" />{p.unitPrice}/gal</span>
                                            <span className="flex items-center"><PaintBucket className="h-3 w-3 mr-1" />{p.coverage || 350} sqft/gal</span>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">Select</Button>
                                </div>
                                {onEdit && (
                                    <Button size="icon" variant="ghost" className="h-full shrink-0 aspect-square border hover:bg-slate-100" onClick={() => onEdit(p)} title="Edit Paint">
                                        <Pencil className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        {products.length === 0 && <div className="text-center py-8 text-muted-foreground">No paint products found.</div>}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" className="w-full border-dashed" onClick={() => { onOpenChange(false); onAddNew(); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Paint to List
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Update AddMiscItemDialog signature and logic
function AddMiscItemDialog({
    isOpen,
    onOpenChange,
    onAdd,
    roomId = 'global',
    roomName = 'Global',
    allItems = [],
    globalItems = [],
    onMove,
    initialItem,
    paintProducts = [],
    defaultProduct,
    onAddNewPaint
}: {
    isOpen: boolean,
    onOpenChange: (o: boolean) => void,
    onAdd: (item: MiscMeasurement) => void,
    roomId?: string,
    roomName?: string,
    allItems?: MiscMeasurement[],
    globalItems?: MiscMeasurement[],
    onMove?: (itemId: string, targetRoomId: string) => void,
    initialItem?: MiscMeasurement | null,
    paintProducts?: any[],
    defaultProduct?: any,
    onAddNewPaint?: () => void
}) {
    const [name, setName] = useState("");
    const [unit, setUnit] = useState<'sqft' | 'linear_ft' | 'units' | 'fixed' | 'hours'>('units');
    const [quantity, setQuantity] = useState(1);
    const [rate, setRate] = useState(0);
    const [width, setWidth] = useState(0.5);
    const [count, setCount] = useState(1);

    // Paint Config State
    const [requiresPaint, setRequiresPaint] = useState(false);
    const [coverage, setCoverage] = useState(350);
    const [coats, setCoats] = useState(2);
    const [paintProductId, setPaintProductId] = useState<string>("default");

    const [excludeFromSharedPaint, setExcludeFromSharedPaint] = useState(false);
    const [customPaintArea, setCustomPaintArea] = useState(0);

    const [paintSelectorOpen, setPaintSelectorOpen] = useState(false);

    // Load initial item on open
    useEffect(() => {
        if (isOpen && initialItem) {
            setName(initialItem.name);
            setUnit(initialItem.unit);
            setQuantity(initialItem.quantity);
            setRate(initialItem.rate);
            if (initialItem.width) setWidth(initialItem.width);
            if (initialItem.count) setCount(initialItem.count);

            // Paint fields
            if (initialItem.coverage || initialItem.paintProductId) {
                setRequiresPaint(true);
                setCoverage(initialItem.coverage || 350);
                setCoats(initialItem.coats || 2);
                setPaintProductId(initialItem.paintProductId || "default");

                setExcludeFromSharedPaint(initialItem.excludeFromSharedPaint || false);
                setCustomPaintArea(initialItem.customPaintArea || 0);
            } else {
                setRequiresPaint(false);
                setCoverage(350);
                setCoats(2);
                setPaintProductId("default");

                setExcludeFromSharedPaint(false);
                setCustomPaintArea(0);
            }
        } else if (isOpen && !initialItem) {
            setName("");
            setUnit('units');
            setQuantity(1);
            setRate(0);
            setCount(1);
            setRequiresPaint(false);
            setCoverage(350);
            setCoats(2);
            setCoverage(350);

            setPaintProductId("default");
            setCustomPaintArea(0);
        }
    }, [isOpen, initialItem]);

    // Import/Template State
    const [openSection, setOpenSection] = useState<'move' | 'copy' | null>(null);
    const [selectedGlobalId, setSelectedGlobalId] = useState<string>('');

    const handleMoveGlobal = () => {
        if (selectedGlobalId && onMove && roomId && roomId !== 'global') {
            onMove(selectedGlobalId, roomId);
            onOpenChange(false);
            setSelectedGlobalId('');
        }
    };

    const handleCopyAttributes = (itemId: string) => {
        const item = allItems.find(i => i.id === itemId);
        if (item) {
            setName(item.name + (roomId !== 'global' ? '' : ' (Copy)'));
            setUnit(item.unit);
            setRate(item.rate);
            if (item.width) setWidth(item.width);
            setQuantity(item.quantity);

            if (item.coverage || item.paintProductId) {
                setRequiresPaint(true);
                setCoverage(item.coverage || 350);
                setCoats(item.coats || 2);
                setPaintProductId(item.paintProductId || "default");

                setExcludeFromSharedPaint(item.excludeFromSharedPaint || false);
                setCustomPaintArea(item.customPaintArea || 0);
            }

            setOpenSection(null); // Close after selection to focus on form
        }
    };

    const handleSubmit = () => {
        const newItem: MiscMeasurement = {
            id: initialItem?.id || crypto.randomUUID(),
            name,
            unit,
            quantity,
            rate,
            width: unit === 'linear_ft' ? width : undefined,
            roomId,
            count
        };

        // Add paint props if applicable
        if (requiresPaint) {
            newItem.coverage = coverage;
            newItem.coats = coats;
            if (paintProductId !== "default") {
                newItem.paintProductId = paintProductId;
                const p = paintProducts?.find(x => x.id === paintProductId);
                if (p) newItem.paintUnitPrice = p.unitPrice || p.price;
            } else {
                newItem.paintUnitPrice = defaultProduct?.unitPrice || defaultProduct?.price || 45;
            }
            newItem.excludeFromSharedPaint = excludeFromSharedPaint;

            if (unit !== 'sqft' && unit !== 'linear_ft') {
                newItem.customPaintArea = customPaintArea;
            }
        }

        onAdd(newItem);
        onOpenChange(false);
        setName(""); setQuantity(1); setRate(0); setCount(1); setExcludeFromSharedPaint(false); setCustomPaintArea(0);
    };

    const totalQty = quantity * count;

    // Paint Calculation
    // Logic: If sqft -> qty is area. If linear -> qty*width is area. If other -> customPaintArea * count is area?
    // Actually, customPaintArea should probably be "Area per Item".
    const effectiveArea = unit === 'sqft' ? totalQty
        : unit === 'linear_ft' ? totalQty * width
            : (customPaintArea * totalQty); // Assuming customPaintArea is per unit. Wait, totalQty includes count? Yes.

    const estimatedPaintVolume = requiresPaint && coverage > 0
        ? (effectiveArea / coverage)
        : 0;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{initialItem ? 'Edit Work Item' : `Add Work Item(${roomName})`}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Collapsible Actions - Hide when editing */}
                        {!initialItem && (
                            <div className="flex flex-col gap-2">
                                {roomId !== 'global' && globalItems.length > 0 && onMove && (
                                    <div className="border rounded-md overflow-hidden">
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-between font-normal rounded-none bg-slate-50 hover:bg-slate-100"
                                            onClick={() => setOpenSection(openSection === 'move' ? null : 'move')}
                                        >
                                            <span className="flex items-center gap-2"><ArrowDownToLine className="h-4 w-4 text-indigo-600" /> Add An Existing Work Item To This Room</span>
                                            {openSection === 'move' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                        {openSection === 'move' && (
                                            <div className="p-3 bg-white border-t space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                <p className="text-xs text-muted-foreground">Select an item from the Global list to move it exclusively to this room.</p>
                                                <div className="flex gap-2">
                                                    <Select value={selectedGlobalId} onValueChange={setSelectedGlobalId}>
                                                        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select global item..." /></SelectTrigger>
                                                        <SelectContent>
                                                            {globalItems.map(i => (
                                                                <SelectItem key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700" disabled={!selectedGlobalId} onClick={handleMoveGlobal}>Move</Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {allItems.length > 0 && (
                                    <div className="border rounded-md overflow-hidden">
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-between font-normal rounded-none bg-slate-50 hover:bg-slate-100"
                                            onClick={() => setOpenSection(openSection === 'copy' ? null : 'copy')}
                                        >
                                            <span className="flex items-center gap-2"><Copy className="h-4 w-4 text-blue-600" /> Copy Attributes from Template</span>
                                            {openSection === 'copy' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                        {openSection === 'copy' && (
                                            <div className="p-3 bg-white border-t space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                <p className="text-xs text-muted-foreground">Pre-fill details from an existing item, then customize for this new entry.</p>
                                                <Select onValueChange={handleCopyAttributes}>
                                                    <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select template item..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {allItems.map(i => (
                                                            <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {!initialItem && <Separator className="my-2" />}

                        <div className="space-y-2">
                            <Label>Item Name</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Window Frames" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Unit Type</Label>
                                <Select value={unit} onValueChange={(v: any) => setUnit(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="units">Each (Per Item)</SelectItem>
                                        <SelectItem value="sqft">SqFt (Area)</SelectItem>
                                        <SelectItem value="linear_ft">Linear Ft</SelectItem>
                                        <SelectItem value="hours">Hours (Labor)</SelectItem>
                                        <SelectItem value="fixed">Flat Fee (No Units)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{unit === 'fixed' ? 'Price' : `Rate($ per ${unit === 'units' ? 'item' : unit === 'hours' ? 'hr' : unit})`}</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                                    <Input
                                        type="number"
                                        value={rate}
                                        onChange={e => setRate(Number(e.target.value))}
                                        className="pl-6"
                                        placeholder="0.00"
                                        step={0.01}
                                    />
                                </div>
                            </div>
                        </div>

                        {unit !== 'fixed' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{unit === 'hours' ? 'Hours' : 'Quantity / Dimensions'}</Label>
                                    <Input
                                        type="number"
                                        value={quantity}
                                        onChange={e => setQuantity(Number(e.target.value))}
                                    />
                                    {unit === 'units' && <span className="text-[10px] text-muted-foreground">Count handles multiplier</span>}
                                </div>
                                {unit === 'linear_ft' && (
                                    <div className="space-y-2">
                                        <Label>Est. Width (ft)</Label>
                                        <Input type="number" step="0.1" value={width} onChange={e => setWidth(Number(e.target.value))} placeholder="0.5" />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {/* Count always visible? Yes, even for flat fee (e.g. 2 x Flat Fee Setup) */}
                            <div className="space-y-2">
                                <Label>Item Count (Multiplier)</Label>
                                <Input type="number" value={count} onChange={e => setCount(Math.max(1, parseInt(e.target.value)))} min={1} />
                            </div>
                        </div>

                        {/* Always show paint toggle now */}
                        <div className="p-3 bg-slate-50 border rounded-md space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold flex items-center gap-2">
                                    <PaintBucket className="h-3 w-3" /> Requires Paint?
                                </Label>
                                <Switch checked={requiresPaint} onCheckedChange={setRequiresPaint} />
                            </div>

                            {requiresPaint && (
                                <div className="space-y-3 pt-2 text-xs">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Paint Product</Label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 p-2 border rounded-md bg-muted/20 text-xs flex justify-between items-center overflow-hidden">
                                                <span className="truncate mr-2">
                                                    {paintProductId === 'default'
                                                        ? (defaultProduct?.name || "Standard Wall Paint")
                                                        : (paintProducts?.find(p => p.id === paintProductId)?.name || "Unknown Product")}
                                                </span>
                                                <span className="text-muted-foreground whitespace-nowrap">
                                                    {paintProductId === 'default'
                                                        ? `$${defaultProduct?.unitPrice || 45}/gal`
                                                        : `$${paintProducts?.find(p => p.id === paintProductId)?.unitPrice || 0}/gal`}
                                                </span >
                                            </div >
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-auto py-1 px-2 text-xs"
                                                onClick={() => setPaintSelectorOpen(true)}
                                            >
                                                Change
                                            </Button>
                                        </div >
                                    </div >
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Coverage (sqft/gal)</Label>
                                            <Input
                                                className="h-7 text-xs"
                                                type="number"
                                                value={coverage}
                                                onChange={e => setCoverage(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">Coats</Label>
                                            <Input
                                                className="h-7 text-xs"
                                                type="number"
                                                value={coats}
                                                onChange={e => setCoats(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                        <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            Exclude from Shared Paint Logic?
                                        </Label>
                                        <Switch checked={excludeFromSharedPaint} onCheckedChange={setExcludeFromSharedPaint} className="scale-75 origin-right" />
                                    </div>
                                    <p className="text-[9px] text-muted-foreground">If enabled, this item's paint usage will not share "leftover" gallons from other items.</p>
                                </div >
                            )}
                        </div >


                        {/* Custom Area Input for Non-Area Types */}
                        {
                            requiresPaint && unit !== 'sqft' && unit !== 'linear_ft' && (
                                <div className="pt-2 border-t border-slate-200">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-semibold text-blue-700">Paintable Area per Item (sqft)</Label>
                                        <div className="flex gap-2 items-center">
                                            <Input
                                                type="number"
                                                className="h-8 w-24"
                                                value={customPaintArea}
                                                onChange={e => setCustomPaintArea(Number(e.target.value))}
                                            />
                                            <span className="text-xs text-muted-foreground">Approx. area to paint per unit</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        }

                        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                            <span className="text-muted-foreground">Est. Paint Volume:</span>
                            <span className="font-medium">{estimatedPaintVolume.toFixed(2)} gal</span>
                        </div>
                    </div >



                    <div className="p-3 bg-blue-50 text-blue-800 rounded text-sm flex justify-between font-medium">
                        <span>{unit === 'fixed' ? 'Total Price' : 'Total Quantity'}:</span>
                        <span>
                            {unit === 'fixed'
                                ? `$${(rate * count).toFixed(2)}`
                                : `${totalQty} ${formatUnit(unit)}`}
                        </span>
                    </div>



                    <DialogFooter>
                        <Button onClick={handleSubmit}>Add Item</Button>
                    </DialogFooter>
                </DialogContent >
            </Dialog >
            <PaintSelectorDialog
                isOpen={paintSelectorOpen}
                onOpenChange={setPaintSelectorOpen}
                products={paintProducts || []}
                onSelect={(p) => { setPaintProductId(p.id || ""); setPaintSelectorOpen(false); }}
                onAddNew={() => { setPaintSelectorOpen(false); if (onAddNewPaint) onAddNewPaint(); }}
            />
        </>
    );
}

// --- Add Prep Task Dialog ---
function AddPrepTaskDialog({
    isOpen,
    onOpenChange,
    onAdd,
    roomId = 'global',
    roomName = 'Global',
    initialTask
}: {
    isOpen: boolean,
    onOpenChange: (o: boolean) => void,
    onAdd: (task: PrepTask) => void,
    roomId?: string,
    roomName?: string,
    initialTask?: PrepTask | null
}) {
    const [name, setName] = useState("");
    const [unit, setUnit] = useState<'sqft' | 'linear_ft' | 'units' | 'fixed' | 'hours'>('units');
    const [quantity, setQuantity] = useState(1);
    const [rate, setRate] = useState(0);
    const [width, setWidth] = useState(0.5); // For linear_ft conversions if needed
    const [count, setCount] = useState(1);

    // Load initial task on open
    useEffect(() => {
        if (isOpen && initialTask) {
            setName(initialTask.name);
            setUnit(initialTask.unit);
            setQuantity(initialTask.quantity);
            setRate(initialTask.rate);
            if (initialTask.width) setWidth(initialTask.width);
            if (initialTask.count) setCount(initialTask.count);
        } else if (isOpen && !initialTask) {
            setName("");
            setUnit('units');
            setQuantity(1);
            setRate(0);
            setCount(1);
        }
    }, [isOpen, initialTask]);

    const handleSubmit = () => {
        onAdd({
            id: initialTask?.id || crypto.randomUUID(),
            name,
            unit,
            quantity,
            rate,
            width: unit === 'linear_ft' ? width : undefined,
            roomId,
            count,
            globalId: initialTask?.globalId
        });
        onOpenChange(false);
        setName(""); setQuantity(1); setRate(0); setCount(1);
    };

    const totalQty = quantity * count;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{initialTask ? 'Edit Prep Task' : `Add Prep Task (${roomName})`}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {!initialTask && roomId === 'global' && (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800 mb-2">
                            <strong>Global Prep:</strong> Items added here will be applied to <u>all rooms</u> by default. You can modify or remove them in specific rooms later.
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Task Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sanding, Patching" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Unit Type</Label>
                            <Select value={unit} onValueChange={(v: any) => setUnit(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="units">Each (Per Item)</SelectItem>
                                    <SelectItem value="sqft">SqFt (Area)</SelectItem>
                                    <SelectItem value="linear_ft">Linear Ft</SelectItem>
                                    <SelectItem value="hours">Hours (Labor)</SelectItem>
                                    <SelectItem value="fixed">Flat Fee (No Units)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{unit === 'fixed' ? 'Price' : `Rate ($ per ${unit === 'units' ? 'item' : unit === 'hours' ? 'hr' : unit})`}</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                                <Input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} className="pl-6" placeholder="0.00" step={0.01} />
                            </div>
                        </div>
                    </div>

                    {unit !== 'fixed' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{unit === 'hours' ? 'Hours' : 'Default Quantity'}</Label>
                                <Input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                            </div>
                            {unit === 'linear_ft' && (
                                <div className="space-y-2">
                                    <Label>Est. Width (ft)</Label>
                                    <Input type="number" step="0.1" value={width} onChange={e => setWidth(Number(e.target.value))} placeholder="0.5" />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Item Count (Multiplier)</Label>
                            <Input type="number" value={count} onChange={e => setCount(Math.max(1, parseInt(e.target.value)))} min={1} />
                        </div>
                    </div>

                    <div className="p-3 bg-blue-50 text-blue-800 rounded text-sm flex justify-between font-medium">
                        <span>{unit === 'fixed' ? 'Total Price' : 'Total Quantity'}:</span>
                        <span>
                            {unit === 'fixed'
                                ? `$${(rate * count).toFixed(2)}`
                                : `${totalQty} ${formatUnit(unit)}`}
                        </span>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit}>{initialTask ? 'Save Changes' : 'Add Prep Task'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Main Component ---

export function ProjectSpecs({ projectId, onNext }: ProjectSpecsProps) {
    const { data: project, isLoading: isLoadingProject } = useProject(projectId);
    const { data: rooms } = useRooms(projectId);
    const updateProject = useUpdateProject();
    const updateRoom = useUpdateRoom();
    const { currentOrgId, org, currentPermissions } = useAuth();
    const { toast } = useToast();
    const { items: catalogItems, addItem } = useCatalog();

    // Dialog State
    const [isAddPaintOpen, setIsAddPaintOpen] = useState(false);
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [activeSelectorField, setActiveSelectorField] = useState<'wallProduct' | 'ceilingProduct' | 'trimProduct' | 'primerProduct' | null>(null);
    const [selectorContext, setSelectorContext] = useState<'global' | { roomId: string }>('global');
    const [activeTab, setActiveTab] = useState("rooms");
    const canManageEstimating = hasPermission(currentPermissions, 'manage_org_estimating');

    // Prep Dialog
    const [prepDialogOpen, setPrepDialogOpen] = useState(false);
    const [activeRoomIdForPrep, setActiveRoomIdForPrep] = useState<string>('global');
    const [editingPrepTask, setEditingPrepTask] = useState<PrepTask | null>(null);

    // Misc Dialog
    const [miscDialogOpen, setMiscDialogOpen] = useState(false);
    const [activeRoomIdForMisc, setActiveRoomIdForMisc] = useState<string>('global');
    const [editingMiscItem, setEditingMiscItem] = useState<MiscMeasurement | null>(null);

    // Room Selection
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

    // Auto-select first room when rooms load
    useEffect(() => {
        if (!selectedRoomId && rooms && rooms.length > 0) {
            setSelectedRoomId(rooms[0].id);
        }
    }, [rooms, selectedRoomId]);

    // Derived Catalog Lists 
    const paintProducts: PaintProduct[] = catalogItems
        .filter(i => i.category === 'paint')
        .map(item => ({
            ...item,
            unitPrice: item.unitPrice || 0,
            coverage: item.coverage || 350
        }));

    const primerProducts: PaintProduct[] = catalogItems
        .filter(i => i.category === 'primer' || i.category === 'paint')
        .map(item => ({
            ...item,
            unitPrice: item.unitPrice || 0,
            coverage: item.coverage || 350
        }));

    const isInitialLoad = useRef(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [editingPaintProduct, setEditingPaintProduct] = useState<PaintProduct | null>(null);

    // State
    const [config, setConfig] = useState<PaintConfig>({
        coveragePerGallon: 350,
        wallCoats: 2,
        ceilingCoats: 2,
        trimCoats: 2,
        includePrimer: false,
        includeCeiling: false,
        includeTrim: false,
        deductionFactor: 0.10,
        ceilingSamePaint: false,
        deductionMethod: 'percent',
        deductionExactSqFt: 0,
        pricePerGallon: 45,
        primerCoats: 1,
        primerCoverage: 300,
        primerAppRate: 0.50,
        includeWallpaperRemoval: false,
        wallpaperRemovalRate: 0.50,
    });

    const [laborConfig, setLaborConfig] = useState({
        hourlyRate: 60,
        productionRate: 150,
        ceilingProductionRate: 100,
        difficultyFactor: 1.0,
        laborPricePerSqFt: 0.75,
    });

    // New Lists
    const [globalPrepTasks, setGlobalPrepTasks] = useState<PrepTask[]>([]);
    const [globalMiscItems, setGlobalMiscItems] = useState<MiscMeasurement[]>([]);

    const debouncedConfig = useDebounce(config, 1000);
    const debouncedLaborConfig = useDebounce(laborConfig, 1000);
    const debouncedPrepTasks = useDebounce(globalPrepTasks, 1000);
    const debouncedMiscItems = useDebounce(globalMiscItems, 1000);

    // Initial Load
    useEffect(() => {
        if (project && isInitialLoad.current) {
            // Priority: Project Config > Org Defaults > Hardcoded
            const orgDefaults = (org?.estimatingSettings as any) || {};

            // 1. Merge Paint/Supply Config
            const mergedConfig: PaintConfig = {
                ...config, // Keep hardcoded defaults as base
                // Map Org Defaults
                coveragePerGallon: orgDefaults.defaultCoverage ?? 350,
                wallCoats: orgDefaults.defaultWallCoats ?? 2,
                ceilingCoats: orgDefaults.defaultCeilingCoats ?? 2,
                trimCoats: orgDefaults.defaultTrimCoats ?? 2,
                pricePerGallon: orgDefaults.defaultPricePerGallon ?? 45,
                // Override with Project Config if it exists
                ...(project.supplyConfig || {})
            };
            setConfig(mergedConfig);

            // 2. Merge Labor Config
            const mergedLabor = {
                ...laborConfig,
                hourlyRate: orgDefaults.defaultLaborRate ?? 60,
                productionRate: orgDefaults.defaultProductionRate ?? 150,
                ...(project.laborConfig || {})
            };
            setLaborConfig(mergedLabor);

            // Load Lists
            if (project.globalPrepTasks) setGlobalPrepTasks(project.globalPrepTasks);
            if (project.globalMiscItems) setGlobalMiscItems(project.globalMiscItems);

            setTimeout(() => { isInitialLoad.current = false; }, 500);
        }
    }, [project, org]);

    // Auto-Save
    useEffect(() => {
        if (isInitialLoad.current) return;
        const saveChanges = async () => {
            setSaveStatus('saving');
            try {
                await updateProject.mutateAsync({
                    id: projectId,
                    data: {
                        supplyConfig: { ...debouncedConfig, deductionExactSqFt: Number(debouncedConfig.deductionExactSqFt) || 0 },
                        laborConfig: debouncedLaborConfig,
                        globalPrepTasks: debouncedPrepTasks,
                        globalMiscItems: debouncedMiscItems
                    }
                });
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (error) {
                setSaveStatus('idle');
            }
        };
        saveChanges();
    }, [debouncedConfig, debouncedLaborConfig, debouncedPrepTasks, debouncedMiscItems]);

    // Auto-Select First Room
    useEffect(() => {
        if (activeTab === 'rooms' && !selectedRoomId && rooms && rooms.length > 0) {
            setSelectedRoomId(rooms[0].id);
        }
    }, [activeTab, rooms, selectedRoomId]);

    const handleConfigChange = (key: keyof PaintConfig, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleRoomSupplyUpdate = async (roomId: string, key: string, value: any) => {
        const room = rooms?.find(r => r.id === roomId);
        if (!room) return;
        const currentConfig = room.supplyConfig || {};
        const newConfig = { ...currentConfig, [key]: value };
        await updateRoom.mutateAsync({ id: roomId, data: { supplyConfig: newConfig } });
    };

    const handleRoomDoorsUpdate = async (roomId: string, doors: Array<{ width: number; height: number; count: number; includeCasing?: boolean }>) => {
        await updateRoom.mutateAsync({ id: roomId, data: { doors } });
    };

    const handleRoomWindowsUpdate = async (roomId: string, windows: Array<{ width: number; height: number; count: number; includeCasing?: boolean }>) => {
        await updateRoom.mutateAsync({ id: roomId, data: { windows } });
    };

    // Calculate trim breakdown for a room
    const calcTrimBreakdown = (room: any) => {
        const perimeter = (room.length + room.width) * 2;
        const doors = room.doors || [];
        const windows = room.windows || [];
        const rConfig = room.supplyConfig || {};

        const totalDoorWidth = doors.reduce((s: number, d: any) => s + (d.width / 12) * d.count, 0);
        const totalWindowWidth = windows.reduce((s: number, w: any) => s + (w.width / 12) * w.count, 0);

        const baseboardLF = Math.max(0, perimeter - totalDoorWidth);
        const doorCasingLF = doors.reduce((s: number, d: any) => {
            if (d.includeCasing === false) return s;
            return s + ((d.height / 12) * 2 + (d.width / 12)) * d.count;
        }, 0);
        const windowCasingLF = windows.reduce((s: number, w: any) => {
            if (w.includeCasing === false) return s;
            return s + ((w.height / 12 + w.width / 12) * 2) * w.count;
        }, 0);
        const crownLF = rConfig.includeCrownMolding ? perimeter : 0;

        const includeBaseboard = rConfig.includeBaseboard !== false; // default true
        const totalLF = (includeBaseboard ? baseboardLF : 0) + doorCasingLF + windowCasingLF + crownLF;

        const openingArea = doors.reduce((s: number, d: any) => s + (d.width / 12) * (d.height / 12) * d.count, 0)
            + windows.reduce((s: number, w: any) => s + (w.width / 12) * (w.height / 12) * w.count, 0);

        return { baseboardLF, doorCasingLF, windowCasingLF, crownLF, totalLF, openingArea, perimeter };
    };

    const handleApplyToAllRooms = async (sourceRoomId: string) => {
        const sourceRoom = rooms?.find(r => r.id === sourceRoomId);
        if (!sourceRoom || !rooms) return;

        const configToApply = sourceRoom.supplyConfig || {};

        // Exclude the source room from updates
        const targetRooms = rooms.filter(r => r.id !== sourceRoomId);

        if (targetRooms.length === 0) {
            toast({ title: "No other rooms", description: "There are no other rooms to apply to." });
            return;
        }

        try {
            await Promise.all(targetRooms.map(room =>
                updateRoom.mutateAsync({
                    id: room.id,
                    data: { supplyConfig: configToApply }
                })
            ));
            toast({ title: "Configuration Applied", description: `Applied to ${targetRooms.length} rooms.` });
        } catch (error) {
            toast({ title: "Error", description: "Failed to apply configuration to all rooms.", variant: "destructive" });
        }
    };

    const handleProductSelect = (product: PaintProduct) => {
        if (!activeSelectorField) return;

        if (selectorContext === 'global') {
            handleConfigChange(activeSelectorField, product);
            if (activeSelectorField === 'wallProduct') {
                handleConfigChange('pricePerGallon', product.unitPrice);
                handleConfigChange('coveragePerGallon', product.coverage);
            }
        } else {
            // Room Context
            handleRoomSupplyUpdate(selectorContext.roomId, activeSelectorField, product);
            toast({ title: "Updated", description: "Room paint product updated." });
        }
        setSelectorOpen(false);
    };

    const { updateItem } = useCatalog();

    const handleAddNewPaint = async (data: NewPaintFormData) => {
        await addItem({
            name: data.name,
            category: 'paint',
            unitPrice: data.price,
            unitCost: data.cost,
            unit: 'gal',
            coverage: data.coverage,
            sheen: data.details.glossLevel,
            paintDetails: data.details
        });
        toast({ title: "Paint Added", description: "Added to your catalog." });
        setEditingPaintProduct(null); // Reset
    };

    const handleUpdatePaint = async (id: string, data: NewPaintFormData) => {
        await updateItem(id, {
            name: data.name,
            unitPrice: data.price,
            unitCost: data.cost,
            coverage: data.coverage,
            sheen: data.details.glossLevel,
            paintDetails: data.details,
            updatedAt: undefined // Let hook handle timestamp
        });
        toast({ title: "Paint Updated", description: "Changes saved to catalog." });
        setEditingPaintProduct(null); // Reset
    };

    // --- Prep Tasks Logic ---
    const addPrepTask = async (task: PrepTask) => {
        if (task.roomId === 'global') {
            setGlobalPrepTasks(prev => {
                const exists = prev.find(t => t.id === task.id);
                if (exists) return prev.map(t => t.id === task.id ? task : t);
                return [...prev, task];
            });
        } else {
            const room = rooms?.find(r => r.id === task.roomId);
            if (room && task.roomId) {
                const current = room.prepTasks || [];
                const exists = current.find(t => t.id === task.id);
                let newTasks;
                if (exists) {
                    newTasks = current.map(t => t.id === task.id ? task : t);
                } else {
                    newTasks = [...current, task];
                }

                await updateRoom.mutateAsync({
                    id: task.roomId,
                    data: { prepTasks: newTasks }
                });
                toast({ title: exists ? "Prep Updated" : "Prep Added", description: `Saved to ${room.name}` });
            }
        }
        setEditingPrepTask(null);
    };

    const removePrepTask = async (roomId: string, taskId: string) => {
        if (roomId === 'global') {
            setGlobalPrepTasks(prev => prev.filter(t => t.id !== taskId));
        } else {
            const room = rooms?.find(r => r.id === roomId);
            if (room) {
                const current = room.prepTasks || [];

                // Check if this is a global task being excluded (inherited)
                const isGlobalTask = globalPrepTasks.find(g => g.id === taskId);

                // Check if this is an override being excluded
                const isOverride = current.find(t => t.id === taskId && t.globalId);

                if (isGlobalTask) {
                    // It's a global task, create an exclusion override
                    const exclusionRecord: PrepTask = {
                        id: crypto.randomUUID(),
                        name: isGlobalTask.name,
                        unit: isGlobalTask.unit,
                        quantity: 0,
                        rate: 0,
                        roomId: roomId,
                        globalId: taskId,
                        excluded: true
                    };
                    await updateRoom.mutateAsync({
                        id: roomId,
                        data: { prepTasks: [...current, exclusionRecord] }
                    });
                    toast({ title: "Task Removed", description: "Global task excluded from this room." });

                } else if (isOverride) {
                    // It's an override, update to excluded
                    const updatedTasks = current.map(t =>
                        t.id === taskId ? { ...t, excluded: true } : t
                    );
                    await updateRoom.mutateAsync({
                        id: roomId,
                        data: { prepTasks: updatedTasks }
                    });
                    toast({ title: "Task Removed", description: "Item removed from room." });

                } else {
                    // It's a regular local task
                    await updateRoom.mutateAsync({
                        id: roomId,
                        data: { prepTasks: current.filter(t => t.id !== taskId) }
                    });
                    toast({ title: "Task Deleted", description: "Item permanently deleted." });
                }
            }
        }
    };

    const openEditPrep = (task: PrepTask, roomId: string) => {
        setEditingPrepTask(task);
        setActiveRoomIdForPrep(roomId);
        setPrepDialogOpen(true);
    };

    // --- Misc Items Logic ---
    const addMiscItem = async (item: MiscMeasurement) => {
        if (item.roomId === 'global') {
            setGlobalMiscItems(prev => {
                const exists = prev.find(i => i.id === item.id);
                if (exists) return prev.map(i => i.id === item.id ? item : i);
                return [...prev, item];
            });
        } else {
            // Add to specific room
            const room = rooms?.find(r => r.id === item.roomId);
            if (room && item.roomId) {
                const currentMisc = room.miscItems || [];
                const exists = currentMisc.find(i => i.id === item.id);
                let newItems;
                if (exists) {
                    newItems = currentMisc.map(i => i.id === item.id ? item : i);
                } else {
                    newItems = [...currentMisc, item];
                }

                await updateRoom.mutateAsync({
                    id: item.roomId,
                    data: { miscItems: newItems }
                });
                toast({ title: exists ? "Item Updated" : "Item Added", description: `Saved to ${room.name}` });
            }
        }
        setEditingMiscItem(null);
    };

    const removeMiscItem = (id: string) => {
        setGlobalMiscItems(prev => prev.filter(i => i.id !== id));
    };

    const removeRoomMiscItem = async (roomId: string, itemId: string) => {
        const room = rooms?.find(r => r.id === roomId);
        if (room) {
            const currentMisc = room.miscItems || [];
            await updateRoom.mutateAsync({
                id: roomId,
                data: { miscItems: currentMisc.filter(i => i.id !== itemId) }
            });
        }
    };

    const openEditMisc = (item: MiscMeasurement, roomId: string) => {
        setEditingMiscItem(item);
        setActiveRoomIdForMisc(roomId);
        setMiscDialogOpen(true);
    };

    const moveMiscItem = async (itemId: string, targetRoomId: string) => {
        const itemToMove = globalMiscItems.find(i => i.id === itemId);
        if (!itemToMove) return;

        // 1. Find linked Global Prep Tasks
        const linkedPrepTasks = globalPrepTasks.filter(t => t.linkedWorkItemId === itemId);

        // 2. Remove from Global
        const newGlobalMisc = globalMiscItems.filter(i => i.id !== itemId);
        const newGlobalPrep = globalPrepTasks.filter(t => t.linkedWorkItemId !== itemId);
        setGlobalMiscItems(newGlobalMisc);
        if (linkedPrepTasks.length > 0) {
            setGlobalPrepTasks(newGlobalPrep);
        }

        // 3. Add to Room
        const room = rooms?.find(r => r.id === targetRoomId);
        if (room) {
            const newItem = { ...itemToMove, roomId: targetRoomId };
            const currentMisc = room.miscItems || [];

            const movedPrepTasks = linkedPrepTasks.map(t => ({
                ...t,
                roomId: targetRoomId,
                // ID stays same? Or new ID? If we move, we can keep ID usually. 
                // But room prep IDs might need to be unique? IDs are UUIDs, so moving is fine.
            }));
            const currentPrep = room.prepTasks || [];

            await updateRoom.mutateAsync({
                id: targetRoomId,
                data: {
                    miscItems: [...currentMisc, newItem],
                    prepTasks: [...currentPrep, ...movedPrepTasks]
                }
            });

            const desc = linkedPrepTasks.length > 0
                ? `Moved with ${linkedPrepTasks.length} linked prep tasks to ${room.name}`
                : `Moved to ${room.name}`;
            toast({ title: "Item Moved", description: desc });
        }
    };

    const handleLinkPrep = async (roomId: string, prepId: string, workItemId: string | null, isGlobal: boolean) => {
        if (roomId === 'global') {
            setGlobalPrepTasks(prev => {
                return prev.map(t => t.id === prepId ? { ...t, linkedWorkItemId: workItemId || undefined } : t);
            });
            // Debounce will save
            toast({ title: workItemId ? "Global Link Created" : "Global Link Removed", description: "Association updated." });
            return;
        }

        const room = rooms?.find(r => r.id === roomId);
        if (!room) return;

        let newPrepTasks = [...(room.prepTasks || [])];
        const existingTaskIndex = newPrepTasks.findIndex(t => t.id === prepId || (isGlobal && t.globalId === prepId));

        if (existingTaskIndex >= 0) {
            // Update existing override or local task
            newPrepTasks[existingTaskIndex] = {
                ...newPrepTasks[existingTaskIndex],
                linkedWorkItemId: workItemId || undefined
            };
        } else if (isGlobal) {
            // Create new override for global task
            const globalTask = globalPrepTasks.find(t => t.id === prepId);
            if (globalTask) {
                newPrepTasks.push({
                    ...globalTask,
                    id: crypto.randomUUID(),
                    globalId: prepId,
                    roomId: roomId,
                    linkedWorkItemId: workItemId || undefined
                });
            }
        }

        await updateRoom.mutateAsync({
            id: roomId,
            data: { prepTasks: newPrepTasks }
        });
        toast({ title: workItemId ? "Link Created" : "Link Removed", description: "Association updated." });
    };

    // Aggregate for templating
    const allProjectItems = [
        ...globalMiscItems,
        ...(rooms?.flatMap(r => r.miscItems || []) || [])
    ];

    if (isLoadingProject) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />Loading...</div>;
    if (!project) return <div className="p-8 text-center text-destructive">Project not found</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Settings2 className="h-5 w-5" /> Project Specifications
                </h2>
                <div className="flex items-center gap-2">
                    {saveStatus === 'saving' && <span className="text-sm text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin" /> Saving...</span>}
                    {saveStatus === 'saved' && <span className="text-sm text-green-600"><CheckCircle2 className="inline h-3 w-3" /> Saved</span>}
                    <Button onClick={onNext}>Next: Supplies</Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start h-auto bg-transparent border-b p-0 rounded-none mb-6">
                    <TabsTrigger value="rooms" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-4 py-3">
                        Rooms
                    </TabsTrigger>
                    <TabsTrigger value="misc" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-4 py-3">
                        Other Work
                    </TabsTrigger>
                    {canManageEstimating && (
                        <TabsTrigger value="labor" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-4 py-3">
                            Labor & Production Settings
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="labor" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle className="text-lg">Labor Rates</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5">
                                        <Label>Hourly Rate ($)</Label>
                                        <InfoTip content="The hourly cost of labor charged per painter. Used to calculate total labor cost from estimated hours." />
                                    </div>
                                    <Input type="number" value={laborConfig.hourlyRate} onChange={e => setLaborConfig({ ...laborConfig, hourlyRate: Number(e.target.value) })} />
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5">
                                        <Label>Difficulty / Waste Factor</Label>
                                        <InfoTip content="Multiplier applied to total labor hours. 1.0 = standard, 1.2 = 20% more time (e.g. high ceilings, detailed trim, furniture moving)." />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" step="0.1" value={laborConfig.difficultyFactor} onChange={e => setLaborConfig({ ...laborConfig, difficultyFactor: Number(e.target.value) })} />
                                        <span className="text-sm text-muted-foreground">x Multiplier</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-lg">Production Rates</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5">
                                        <Label>Wall Production Rate (sqft/hr)</Label>
                                        <InfoTip content="How many square feet of wall a painter can complete per hour. Higher = faster. Industry average: 100-200 sqft/hr." />
                                    </div>
                                    <Input type="number" value={laborConfig.productionRate} onChange={e => setLaborConfig({ ...laborConfig, productionRate: Number(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5">
                                        <Label>Ceiling Production Rate (sqft/hr)</Label>
                                        <InfoTip content="Square feet of ceiling per hour. Ceilings are typically slower than walls due to overhead work. Leave at 0 to use wall rate." />
                                    </div>
                                    <Input type="number" value={laborConfig.ceilingProductionRate} onChange={e => setLaborConfig({ ...laborConfig, ceilingProductionRate: Number(e.target.value) })} placeholder="Uses wall rate if 0" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="rooms">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="md:col-span-1">
                            <CardHeader><CardTitle className="text-sm">Select Room</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="max-h-[60vh] min-h-[200px]">
                                    {rooms?.map(room => {
                                        const hasOverrides = room.supplyConfig && Object.keys(room.supplyConfig).some(k => (room.supplyConfig as any)[k] !== undefined && (room.supplyConfig as any)[k] !== null);
                                        const hasDoors = room.doors && room.doors.length > 0;
                                        const hasWindows = room.windows && room.windows.length > 0;
                                        return (
                                            <div
                                                key={room.id}
                                                onClick={() => setSelectedRoomId(room.id)}
                                                className={`p-3 border-b cursor-pointer transition-colors ${selectedRoomId === room.id ? 'bg-muted border-l-4 border-l-primary' : 'hover:bg-muted/50'}`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{room.name}</span>
                                                        {hasOverrides && <Badge variant="secondary" className="text-[9px] px-1 py-0">Custom</Badge>}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        {room.color && <div className="h-4 w-4 rounded-full border shadow-sm" style={{ backgroundColor: room.color }} />}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                                                    {room.length && room.width ? <span>{room.length}×{room.width} ft</span> : <span className="italic">No dimensions</span>}
                                                    {hasDoors && <span>· {(room.doors || []).reduce((s: number, d: any) => s + d.count, 0)} door{(room.doors || []).reduce((s: number, d: any) => s + d.count, 0) !== 1 ? 's' : ''}</span>}
                                                    {hasWindows && <span>· {(room.windows || []).reduce((s: number, w: any) => s + w.count, 0)} win</span>}
                                                    {(room.supplyConfig?.includeTrim ?? config.includeTrim) && <span>· Trim ✓</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!rooms || rooms.length === 0) && <div className="p-4 text-sm text-muted-foreground text-center">No rooms found.</div>}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                        <Card className="md:col-span-2">
                            {selectedRoomId && rooms?.find(r => r.id === selectedRoomId) ? (
                                (() => {
                                    const room = rooms.find(r => r.id === selectedRoomId)!;
                                    return (
                                        <>
                                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                                <div>
                                                    <CardTitle>{room.name}</CardTitle>
                                                    <CardDescription>Room Configurations</CardDescription>
                                                </div>

                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                {/* Read-only Room Dimensions */}
                                                {(room.length || room.width || room.height) && (
                                                    <div className="flex flex-wrap gap-4 text-sm p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                                        {room.length && room.width && <div><span className="text-muted-foreground text-xs">Dimensions:</span> <span className="font-medium">{room.length} × {room.width} ft</span></div>}
                                                        {room.height && <div><span className="text-muted-foreground text-xs">Height:</span> <span className="font-medium">{room.height} ft</span></div>}
                                                        {room.length && room.width && room.height && (
                                                            <>
                                                                <div><span className="text-muted-foreground text-xs">Wall Area:</span> <span className="font-medium">{((room.length + room.width) * 2 * room.height).toLocaleString()} sqft</span></div>
                                                                <div><span className="text-muted-foreground text-xs">Floor Area:</span> <span className="font-medium">{(room.length * room.width).toLocaleString()} sqft</span></div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                                {/* General Room Details */}
                                                <div className="p-4 border rounded-lg bg-slate-50/50 space-y-4">
                                                    <h3 className="font-semibold text-sm flex items-center gap-2">General Details</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Color Name</Label>
                                                            <Input
                                                                type="text"
                                                                placeholder="e.g. SW 7008 Alabaster"
                                                                defaultValue={room.colorName || (room.color && !room.color.startsWith('#') ? room.color : '')}
                                                                onBlur={e => e.target.value !== (room.colorName || '') && updateRoom.mutate({ id: room.id, data: { colorName: e.target.value } })}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Color Swatch (Hex)</Label>
                                                            <div className="flex gap-2 items-center">
                                                                <Input
                                                                    type="color"
                                                                    className="w-10 h-9 p-1 cursor-pointer"
                                                                    value={room.color?.startsWith('#') ? room.color : '#ffffff'}
                                                                    onChange={e => updateRoom.mutate({ id: room.id, data: { color: e.target.value } })}
                                                                />
                                                                <Input
                                                                    type="text"
                                                                    placeholder="#FFFFFF"
                                                                    className="uppercase font-mono text-xs flex-1"
                                                                    defaultValue={room.color?.startsWith('#') ? room.color : ''}
                                                                    onBlur={e => e.target.value !== (room.color || '') && updateRoom.mutate({ id: room.id, data: { color: e.target.value } })}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Room Paint Config */}
                                                <div className="p-4 border rounded-lg bg-slate-50/50 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="font-semibold text-sm flex items-center gap-2">
                                                            <PaintBucket className="h-4 w-4" /> Paint System Overrides
                                                            <InfoTip content="Override the global paint settings for this specific room. Changes here only affect this room's supply and quote calculations." />
                                                        </h3>
                                                    </div>

                                                    {/* Paint Billing Dropdown */}
                                                    <div className="space-y-2 pb-4 border-b border-dashed">
                                                        <div className="flex justify-between items-center">
                                                            <div className="space-y-0.5">
                                                                <Label className="text-sm">Bill Paint to Customer</Label>
                                                                <p className="text-[10px] text-muted-foreground">Override the default paint billing behavior for this room.</p>
                                                            </div>
                                                            {room.supplyConfig?.paintBilling !== undefined && <Badge variant="secondary" className="text-[10px]">Override</Badge>}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Select
                                                                value={room.supplyConfig?.paintBilling || config.paintBilling || 'billable'}
                                                                onValueChange={(val: any) => handleRoomSupplyUpdate(room.id, 'paintBilling', val)}
                                                            >
                                                                <SelectTrigger className="w-full md:w-[300px]">
                                                                    <SelectValue placeholder="Select billing behavior" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="billable">Billable (On Quote)</SelectItem>
                                                                    <SelectItem value="expense">Internal Expense (Not Billed)</SelectItem>
                                                                    <SelectItem value="provided_by_customer">Provided by Customer ($0)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            {room.supplyConfig?.paintBilling !== undefined && (
                                                                <Button variant="ghost" size="icon" onClick={() => handleRoomSupplyUpdate(room.id, 'paintBilling', null)}>
                                                                    <RotateCcw className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Wall Paint Product */}
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Wall Paint Product</Label>
                                                        <div className="flex gap-2">
                                                            <div className="flex-1 p-2 border rounded-md bg-white text-sm flex justify-between items-center">
                                                                <span className={room.supplyConfig?.wallProduct ? "font-medium" : "text-muted-foreground italic"}>
                                                                    {room.supplyConfig?.wallProduct?.name || config.wallProduct?.name || "Standard Wall Paint"}
                                                                </span>
                                                                <div className="flex items-center">
                                                                    <span className="text-muted-foreground text-xs mr-2">
                                                                        {room.supplyConfig?.wallProduct
                                                                            ? `$${room.supplyConfig.wallProduct.unitPrice}/gal`
                                                                            : (config.wallProduct ? `$${config.wallProduct.unitPrice}/gal` : "$45/gal")}
                                                                    </span>
                                                                    {room.supplyConfig?.wallProduct && <Badge variant="secondary" className="text-[10px]">Override</Badge>}
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setActiveSelectorField('wallProduct');
                                                                    setSelectorContext({ roomId: room.id });
                                                                    setSelectorOpen(true);
                                                                }}
                                                            >
                                                                Change
                                                            </Button>
                                                            {room.supplyConfig?.wallProduct && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    title="Revert to Global"
                                                                    onClick={() => handleRoomSupplyUpdate(room.id, 'wallProduct', null)}
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Wall Coats */}
                                                        <div className="space-y-2 border p-3 rounded bg-white">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="text-xs">Wall Coats <InfoTip content="Number of coats of paint applied to walls. 2 coats is standard for most jobs. More coats may be needed for drastic color changes." /></Label>
                                                                {room.supplyConfig?.wallCoats !== undefined && <Badge variant="secondary" className="text-[10px]">Override</Badge>}
                                                            </div>
                                                            <div className="flex gap-2 items-center">
                                                                <Input
                                                                    type="number"
                                                                    className="h-8"
                                                                    value={room.supplyConfig?.wallCoats ?? config.wallCoats}
                                                                    onChange={e => handleRoomSupplyUpdate(room.id, 'wallCoats', Number(e.target.value))}
                                                                />
                                                                {room.supplyConfig?.wallCoats !== undefined && (
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRoomSupplyUpdate(room.id, 'wallCoats', null)}>
                                                                        <RotateCcw className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                Global Default: {config.wallCoats}
                                                            </p>
                                                        </div>

                                                        {/* Wall Coverage */}
                                                        <div className="space-y-2 border p-3 rounded bg-white">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="text-xs">Coverage (sqft/gal) <InfoTip content="Square feet one gallon of paint will cover. 350 is standard. Rough/textured surfaces may be lower (250-300). Smooth surfaces may be higher (400+)." /></Label>
                                                                {room.supplyConfig?.wallCoverage !== undefined && <Badge variant="secondary" className="text-[10px]">Override</Badge>}
                                                            </div>
                                                            <div className="flex gap-2 items-center">
                                                                <Input
                                                                    type="number"
                                                                    className="h-8"
                                                                    value={room.supplyConfig?.wallCoverage ?? config.coveragePerGallon}
                                                                    onChange={e => handleRoomSupplyUpdate(room.id, 'wallCoverage', Number(e.target.value))}
                                                                />
                                                                {room.supplyConfig?.wallCoverage !== undefined && (
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRoomSupplyUpdate(room.id, 'wallCoverage', null)}>
                                                                        <RotateCcw className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                Global Default: {config.coveragePerGallon}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between space-x-2 border p-2 rounded bg-white col-span-2">
                                                        <div className="space-y-0.5">
                                                            <Label className="text-xs">Exclude from Shared Paint? <InfoTip content="When enabled, this room's paint is calculated independently and won't share leftover gallons with other rooms using the same product." /></Label>
                                                            <p className="text-[9px] text-muted-foreground">Do not share leftover paint with other rooms.</p>
                                                        </div>
                                                        <Switch
                                                            checked={room.supplyConfig?.wallExcludeFromSharedPaint || false}
                                                            onCheckedChange={c => handleRoomSupplyUpdate(room.id, 'wallExcludeFromSharedPaint', c)}
                                                        />
                                                    </div>



                                                    {/* Ceiling Paint Overrides */}
                                                    {(room.supplyConfig?.includeCeiling ?? config.includeCeiling) && (
                                                        <div className="space-y-4 pt-4 border-t border-dashed">
                                                            <div className="flex items-center gap-2">
                                                                <Label className="text-xs font-semibold text-muted-foreground">Ceiling Overrides</Label>
                                                            </div>

                                                            {/* Ceiling Product */}
                                                            <div className="space-y-2">
                                                                <Label className="text-xs">Ceiling Paint Product</Label>
                                                                <div className="flex gap-2">
                                                                    <div className="flex-1 p-2 border rounded-md bg-white text-sm flex justify-between items-center">
                                                                        <span className={room.supplyConfig?.ceilingProduct ? "font-medium" : "text-muted-foreground italic"}>
                                                                            {room.supplyConfig?.ceilingProduct?.name || config.ceilingProduct?.name || "Standard Ceiling Paint"}
                                                                        </span>
                                                                        <div className="flex items-center">
                                                                            <span className="text-muted-foreground text-xs mr-2">
                                                                                {room.supplyConfig?.ceilingProduct
                                                                                    ? `$${room.supplyConfig.ceilingProduct.unitPrice}/gal`
                                                                                    : (config.ceilingProduct ? `$${config.ceilingProduct.unitPrice}/gal` : "$35/gal")}
                                                                            </span>
                                                                            {room.supplyConfig?.ceilingProduct && <Badge variant="secondary" className="text-[10px]">Override</Badge>}
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            setActiveSelectorField('ceilingProduct');
                                                                            setSelectorContext({ roomId: room.id });
                                                                            setSelectorOpen(true);
                                                                        }}
                                                                    >
                                                                        Change
                                                                    </Button>
                                                                    {room.supplyConfig?.ceilingProduct && (
                                                                        <Button variant="ghost" size="icon" onClick={() => handleRoomSupplyUpdate(room.id, 'ceilingProduct', null)}><RotateCcw className="h-4 w-4" /></Button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Ceiling Grid */}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                {/* Ceiling Coats */}
                                                                <div className="space-y-2 border p-3 rounded bg-white">
                                                                    <div className="flex justify-between items-center">
                                                                        <Label className="text-xs">Ceiling Coats</Label>
                                                                        {room.supplyConfig?.ceilingCoats !== undefined && <Badge variant="secondary" className="text-[10px]">Override</Badge>}
                                                                    </div>
                                                                    <div className="flex gap-2 items-center">
                                                                        <Input
                                                                            type="number"
                                                                            className="h-8"
                                                                            value={room.supplyConfig?.ceilingCoats ?? config.ceilingCoats ?? 2}
                                                                            onChange={e => handleRoomSupplyUpdate(room.id, 'ceilingCoats', Number(e.target.value))}
                                                                        />
                                                                        {room.supplyConfig?.ceilingCoats !== undefined && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRoomSupplyUpdate(room.id, 'ceilingCoats', null)}><RotateCcw className="h-3 w-3" /></Button>}
                                                                    </div>
                                                                    <p className="text-[10px] text-muted-foreground">Global: {config.ceilingCoats ?? 2}</p>
                                                                </div>

                                                                {/* Ceiling Coverage */}
                                                                <div className="space-y-2 border p-3 rounded bg-white">
                                                                    <div className="flex justify-between items-center">
                                                                        <Label className="text-xs">Coverage</Label>
                                                                        {room.supplyConfig?.ceilingCoverage !== undefined && <Badge variant="secondary" className="text-[10px]">Override</Badge>}
                                                                    </div>
                                                                    <div className="flex gap-2 items-center">
                                                                        <Input
                                                                            type="number"
                                                                            className="h-8"
                                                                            value={room.supplyConfig?.ceilingCoverage ?? config.ceilingCoverage ?? 400}
                                                                            onChange={e => handleRoomSupplyUpdate(room.id, 'ceilingCoverage', Number(e.target.value))}
                                                                        />
                                                                        {room.supplyConfig?.ceilingCoverage !== undefined && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRoomSupplyUpdate(room.id, 'ceilingCoverage', null)}><RotateCcw className="h-3 w-3" /></Button>}
                                                                    </div>
                                                                    <p className="text-[10px] text-muted-foreground">Global: {config.ceilingCoverage ?? 400}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between space-x-2 border p-2 rounded bg-white col-span-2">
                                                                <div className="space-y-0.5">
                                                                    <Label className="text-xs">Exclude from Shared Paint?</Label>
                                                                    <p className="text-[9px] text-muted-foreground">Do not share leftover paint.</p>
                                                                </div>
                                                                <Switch
                                                                    checked={room.supplyConfig?.ceilingExcludeFromSharedPaint || false}
                                                                    onCheckedChange={c => handleRoomSupplyUpdate(room.id, 'ceilingExcludeFromSharedPaint', c)}
                                                                />
                                                            </div>
                                                        </div>

                                                    )}

                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                        {/* Ceiling Toggle */}
                                                        <div className="flex flex-col justify-between space-y-2 border p-3 rounded bg-white">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="text-xs">Include Ceiling? <InfoTip content="Include ceiling in paint calculations for this room. When off, no ceiling paint will be estimated for this room." /></Label>
                                                                <Switch
                                                                    checked={room.supplyConfig?.includeCeiling ?? config.includeCeiling}
                                                                    onCheckedChange={(c) => handleRoomSupplyUpdate(room.id, 'includeCeiling', c)}
                                                                />
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {room.supplyConfig?.includeCeiling !== undefined ? "Room Override" : `Using Global (${config.includeCeiling ? 'Yes' : 'No'})`}
                                                            </p>
                                                        </div>

                                                        {/* Primer Toggle */}
                                                        <div className="flex flex-col justify-between space-y-2 border p-3 rounded bg-white">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="text-xs">Require Primer? <InfoTip content="Add a coat of primer before painting. Recommended for new drywall, dark-to-light color changes, or stain-blocking." /></Label>
                                                                <Switch
                                                                    checked={room.supplyConfig?.requirePrimer ?? config.includePrimer}
                                                                    onCheckedChange={(c) => handleRoomSupplyUpdate(room.id, 'requirePrimer', c)}
                                                                />
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {room.supplyConfig?.requirePrimer !== undefined ? "Room Override" : `Using Global (${config.includePrimer ? 'Yes' : 'No'})`}
                                                            </p>
                                                        </div>

                                                    </div>

                                                    {/* Enhanced Trim Section */}
                                                    <div className="flex flex-col space-y-2 border p-3 rounded bg-white col-span-2">
                                                        <div className="flex justify-between items-center">
                                                            <Label className="text-xs font-semibold">Trim & Openings</Label>
                                                            <Switch
                                                                checked={room.supplyConfig?.includeTrim ?? config.includeTrim}
                                                                onCheckedChange={(c) => handleRoomSupplyUpdate(room.id, 'includeTrim', c)}
                                                            />
                                                        </div>
                                                        {(room.supplyConfig?.includeTrim ?? config.includeTrim) && (() => {
                                                            const trimBreakdown = calcTrimBreakdown(room);
                                                            const trimRate = room.supplyConfig?.trimRate ?? config.defaultTrimRate ?? 1.50;
                                                            const casingW = room.supplyConfig?.casingWidth ?? 3.5;
                                                            const baseH = room.supplyConfig?.baseboardHeight ?? room.supplyConfig?.trimWidth ?? config.defaultTrimWidth ?? 4;
                                                            const crownW = room.supplyConfig?.crownMoldingWidth ?? 3.5;
                                                            return (
                                                                <TooltipProvider delayDuration={200}>
                                                                    <div className="space-y-4 pt-2 border-t mt-1">
                                                                        {/* Doors */}
                                                                        <div className="space-y-2">
                                                                            <div className="flex justify-between items-center">
                                                                                <div className="flex items-center gap-1">
                                                                                    <Label className="text-xs text-muted-foreground font-semibold">Doors</Label>
                                                                                    <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-[240px]"><p className="text-xs">Door dimensions deduct wall area for paint calculations. If "Paint Casing" is checked, casing trim LF is added to the total.</p></TooltipContent></Tooltip>
                                                                                </div>
                                                                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => {
                                                                                    const current = room.doors || [];
                                                                                    handleRoomDoorsUpdate(room.id, [...current, { width: 36, height: 80, count: 1, includeCasing: true }]);
                                                                                }}>
                                                                                    <PlusCircle className="h-3 w-3 mr-1" /> Add Door
                                                                                </Button>
                                                                            </div>
                                                                            {(room.doors || []).length > 0 && (
                                                                                <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-medium px-0.5">
                                                                                    <span className="w-16">Width (in)</span>
                                                                                    <span className="w-1"></span>
                                                                                    <span className="w-16">Height (in)</span>
                                                                                    <span className="w-1"></span>
                                                                                    <span className="w-12">Qty</span>
                                                                                    <span>Paint Casing?</span>
                                                                                </div>
                                                                            )}
                                                                            {(room.doors || []).map((door: any, idx: number) => (
                                                                                <div key={idx} className="flex items-center gap-2 text-xs">
                                                                                    <Input type="number" className="h-7 text-xs w-16" value={door.width}
                                                                                        onChange={e => { const d = [...(room.doors || [])]; d[idx] = { ...d[idx], width: Number(e.target.value) }; handleRoomDoorsUpdate(room.id, d); }} />
                                                                                    <span className="text-muted-foreground">×</span>
                                                                                    <Input type="number" className="h-7 text-xs w-16" value={door.height}
                                                                                        onChange={e => { const d = [...(room.doors || [])]; d[idx] = { ...d[idx], height: Number(e.target.value) }; handleRoomDoorsUpdate(room.id, d); }} />
                                                                                    <span className="text-muted-foreground">×</span>
                                                                                    <Input type="number" className="h-7 text-xs w-12" value={door.count} min={1}
                                                                                        onChange={e => { const d = [...(room.doors || [])]; d[idx] = { ...d[idx], count: Number(e.target.value) || 1 }; handleRoomDoorsUpdate(room.id, d); }} />
                                                                                    <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                                                                                        <input type="checkbox" className="h-3.5 w-3.5 rounded" checked={door.includeCasing !== false}
                                                                                            onChange={e => { const d = [...(room.doors || [])]; d[idx] = { ...d[idx], includeCasing: e.target.checked }; handleRoomDoorsUpdate(room.id, d); }} />
                                                                                        Casing
                                                                                    </label>
                                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => {
                                                                                        const d = (room.doors || []).filter((_: any, i: number) => i !== idx);
                                                                                        handleRoomDoorsUpdate(room.id, d);
                                                                                    }}><Trash2 className="h-3 w-3" /></Button>
                                                                                </div>
                                                                            ))}
                                                                            {(room.doors || []).length > 0 && trimBreakdown.doorCasingLF > 0 && (
                                                                                <p className="text-[10px] text-muted-foreground pl-0.5">↳ Door casing trim: <span className="font-medium">{trimBreakdown.doorCasingLF.toFixed(0)} LF</span></p>
                                                                            )}
                                                                            {(!room.doors || room.doors.length === 0) && (
                                                                                <p className="text-xs text-muted-foreground italic">No doors added</p>
                                                                            )}
                                                                        </div>

                                                                        {/* Windows */}
                                                                        <div className="space-y-2">
                                                                            <div className="flex justify-between items-center">
                                                                                <div className="flex items-center gap-1">
                                                                                    <Label className="text-xs text-muted-foreground font-semibold">Windows</Label>
                                                                                    <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-[240px]"><p className="text-xs">Window dimensions deduct wall area for paint calculations. If "Paint Casing" is checked, casing trim LF is added to the total.</p></TooltipContent></Tooltip>
                                                                                </div>
                                                                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => {
                                                                                    const current = room.windows || [];
                                                                                    handleRoomWindowsUpdate(room.id, [...current, { width: 36, height: 48, count: 1, includeCasing: true }]);
                                                                                }}>
                                                                                    <PlusCircle className="h-3 w-3 mr-1" /> Add Window
                                                                                </Button>
                                                                            </div>
                                                                            {(room.windows || []).length > 0 && (
                                                                                <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-medium px-0.5">
                                                                                    <span className="w-16">Width (in)</span>
                                                                                    <span className="w-1"></span>
                                                                                    <span className="w-16">Height (in)</span>
                                                                                    <span className="w-1"></span>
                                                                                    <span className="w-12">Qty</span>
                                                                                    <span>Paint Casing?</span>
                                                                                </div>
                                                                            )}
                                                                            {(room.windows || []).map((win: any, idx: number) => (
                                                                                <div key={idx} className="flex items-center gap-2 text-xs">
                                                                                    <Input type="number" className="h-7 text-xs w-16" value={win.width}
                                                                                        onChange={e => { const w = [...(room.windows || [])]; w[idx] = { ...w[idx], width: Number(e.target.value) }; handleRoomWindowsUpdate(room.id, w); }} />
                                                                                    <span className="text-muted-foreground">×</span>
                                                                                    <Input type="number" className="h-7 text-xs w-16" value={win.height}
                                                                                        onChange={e => { const w = [...(room.windows || [])]; w[idx] = { ...w[idx], height: Number(e.target.value) }; handleRoomWindowsUpdate(room.id, w); }} />
                                                                                    <span className="text-muted-foreground">×</span>
                                                                                    <Input type="number" className="h-7 text-xs w-12" value={win.count} min={1}
                                                                                        onChange={e => { const w = [...(room.windows || [])]; w[idx] = { ...w[idx], count: Number(e.target.value) || 1 }; handleRoomWindowsUpdate(room.id, w); }} />
                                                                                    <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                                                                                        <input type="checkbox" className="h-3.5 w-3.5 rounded" checked={win.includeCasing !== false}
                                                                                            onChange={e => { const w = [...(room.windows || [])]; w[idx] = { ...w[idx], includeCasing: e.target.checked }; handleRoomWindowsUpdate(room.id, w); }} />
                                                                                        Casing
                                                                                    </label>
                                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => {
                                                                                        const w = (room.windows || []).filter((_: any, i: number) => i !== idx);
                                                                                        handleRoomWindowsUpdate(room.id, w);
                                                                                    }}><Trash2 className="h-3 w-3" /></Button>
                                                                                </div>
                                                                            ))}
                                                                            {(room.windows || []).length > 0 && trimBreakdown.windowCasingLF > 0 && (
                                                                                <p className="text-[10px] text-muted-foreground pl-0.5">↳ Window casing trim: <span className="font-medium">{trimBreakdown.windowCasingLF.toFixed(0)} LF</span></p>
                                                                            )}
                                                                            {(!room.windows || room.windows.length === 0) && (
                                                                                <p className="text-xs text-muted-foreground italic">No windows added</p>
                                                                            )}
                                                                        </div>

                                                                        <Separator />

                                                                        {/* Trim Types — just baseboard and crown molding */}
                                                                        <div className="space-y-2">
                                                                            <div className="flex items-center gap-1">
                                                                                <Label className="text-xs text-muted-foreground font-semibold">Trim Types</Label>
                                                                                <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-[260px]"><p className="text-xs">Linear footage is auto-calculated from room dimensions. Door/window casing is controlled by the "Paint Casing" checkboxes above.</p></TooltipContent></Tooltip>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-1.5 text-xs">
                                                                                <label className="flex items-center gap-2 p-1.5 rounded border bg-slate-50 cursor-pointer">
                                                                                    <input type="checkbox" className="h-3.5 w-3.5 rounded"
                                                                                        checked={room.supplyConfig?.includeBaseboard !== false}
                                                                                        onChange={e => handleRoomSupplyUpdate(room.id, 'includeBaseboard', e.target.checked)} />
                                                                                    <span>Baseboard</span>
                                                                                    <span className="ml-auto text-muted-foreground">{trimBreakdown.baseboardLF.toFixed(0)} ft</span>
                                                                                </label>
                                                                                <label className="flex items-center gap-2 p-1.5 rounded border bg-slate-50 cursor-pointer">
                                                                                    <input type="checkbox" className="h-3.5 w-3.5 rounded"
                                                                                        checked={room.supplyConfig?.includeCrownMolding || false}
                                                                                        onChange={e => handleRoomSupplyUpdate(room.id, 'includeCrownMolding', e.target.checked)} />
                                                                                    <span>Crown Molding</span>
                                                                                    <span className="ml-auto text-muted-foreground">{trimBreakdown.crownLF.toFixed(0)} ft</span>
                                                                                </label>
                                                                            </div>
                                                                        </div>

                                                                        {/* Trim Pricing */}
                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            <div className="space-y-1">
                                                                                <div className="flex items-center gap-1">
                                                                                    <Label className="text-xs text-muted-foreground">Rate ($/ft)</Label>
                                                                                    <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[200px]"><p className="text-xs">Price per linear foot of trim work charged to the customer.</p></TooltipContent></Tooltip>
                                                                                </div>
                                                                                <Input type="number" step="0.25" className="h-8 text-sm" value={trimRate}
                                                                                    onChange={e => handleRoomSupplyUpdate(room.id, 'trimRate', Number(e.target.value))} />
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <div className="flex items-center gap-1">
                                                                                    <Label className="text-xs text-muted-foreground">Baseboard Ht (in)</Label>
                                                                                    <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[200px]"><p className="text-xs">Height of the baseboard trim. Used to calculate paint area (LF × height).</p></TooltipContent></Tooltip>
                                                                                </div>
                                                                                <Input type="number" className="h-8 text-sm" value={baseH}
                                                                                    onChange={e => handleRoomSupplyUpdate(room.id, 'baseboardHeight', Number(e.target.value))} />
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <div className="flex items-center gap-1">
                                                                                    <Label className="text-xs text-muted-foreground">Casing Width (in)</Label>
                                                                                    <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[200px]"><p className="text-xs">Width of the door/window casing trim. Used to calculate paint area for casing.</p></TooltipContent></Tooltip>
                                                                                </div>
                                                                                <Input type="number" className="h-8 text-sm" value={casingW}
                                                                                    onChange={e => handleRoomSupplyUpdate(room.id, 'casingWidth', Number(e.target.value))} />
                                                                            </div>
                                                                            {room.supplyConfig?.includeCrownMolding && (
                                                                                <div className="space-y-1">
                                                                                    <div className="flex items-center gap-1">
                                                                                        <Label className="text-xs text-muted-foreground">Crown Width (in)</Label>
                                                                                        <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[200px]"><p className="text-xs">Width of crown molding. Used to calculate paint area.</p></TooltipContent></Tooltip>
                                                                                    </div>
                                                                                    <Input type="number" className="h-8 text-sm" value={crownW}
                                                                                        onChange={e => handleRoomSupplyUpdate(room.id, 'crownMoldingWidth', Number(e.target.value))} />
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Summary */}
                                                                        <div className="text-xs bg-slate-50 p-2.5 rounded border space-y-1.5">
                                                                            <div className="flex justify-between font-semibold">
                                                                                <span>Total Trim</span>
                                                                                <span>{trimBreakdown.totalLF.toFixed(0)} LF — ${(trimBreakdown.totalLF * trimRate).toFixed(2)}</span>
                                                                            </div>
                                                                            {trimBreakdown.openingArea > 0 && (
                                                                                <div className="flex justify-between text-muted-foreground">
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span>Wall deduction (openings)</span>
                                                                                        <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[240px]"><p className="text-xs">Total wall area subtracted for door and window openings. Reduces paint volume needed.</p></TooltipContent></Tooltip>
                                                                                    </div>
                                                                                    <span>-{trimBreakdown.openingArea.toFixed(1)} sqft</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Exclude from shared paint */}
                                                                        <div className="flex items-center justify-between space-x-2 pt-2 border-t">
                                                                            <div className="flex items-center gap-1">
                                                                                <Label className="text-xs text-muted-foreground">Exclude from shared paint?</Label>
                                                                                <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger><TooltipContent className="max-w-[220px]"><p className="text-xs">When enabled, trim paint is calculated separately instead of sharing paint with the walls.</p></TooltipContent></Tooltip>
                                                                            </div>
                                                                            <Switch
                                                                                checked={room.supplyConfig?.trimExcludeFromSharedPaint || false}
                                                                                onCheckedChange={c => handleRoomSupplyUpdate(room.id, 'trimExcludeFromSharedPaint', c)}
                                                                                className="scale-75 origin-right"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </TooltipProvider>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>

                                                <Separator className="my-6" />

                                                {/* Room Prep Section */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h3 className="font-medium text-sm">Additional Prep In This Room</h3>
                                                            <p className="text-xs text-muted-foreground">Inherited global prep tasks plus room-specific additions.</p>
                                                        </div>
                                                        <Button variant="outline" size="sm" onClick={() => { setActiveRoomIdForPrep(room.id); setPrepDialogOpen(true); }}>
                                                            <PlusCircle className="h-4 w-4 mr-2" /> Add Prep Task
                                                        </Button>
                                                    </div>

                                                    {(() => {
                                                        const effectivePrep = [
                                                            // 1. Globals (Inherited or Overridden)
                                                            ...globalPrepTasks.map(gt => {
                                                                const override = room.prepTasks?.find(t => t.globalId === gt.id);
                                                                if (override) {
                                                                    if (override.excluded) return null;
                                                                    return { ...override, _status: 'override' };
                                                                }
                                                                return { ...gt, _status: 'inherited' };
                                                            }).filter((t): t is PrepTask & { _status: string } => t !== null),
                                                            // 2. Locals (No globalId)
                                                            ...(room.prepTasks?.filter(t => !t.globalId) || []).map(t => ({ ...t, _status: 'local' }))
                                                        ];

                                                        if (effectivePrep.length === 0) {
                                                            return (
                                                                <div className="text-center p-4 border-2 border-dashed rounded-lg text-muted-foreground text-sm bg-amber-50/50">
                                                                    No prep tasks for this room.
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div className="space-y-2">
                                                                {effectivePrep.map((item, idx) => (
                                                                    <div key={item.id || idx} className={`flex justify-between items-center p-3 border rounded-md text-sm ${item._status === 'inherited' ? 'bg-slate-50 opacity-90' : 'bg-white'}`}>
                                                                        <div>
                                                                            <div className="font-medium flex items-center gap-2">
                                                                                {item.name}
                                                                                {item.count && item.count > 1 && <Badge variant="secondary" className="text-[10px]">x{item.count}</Badge>}
                                                                                {item._status === 'inherited' && <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500">Global</Badge>}
                                                                                {item._status === 'override' && <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700">Override</Badge>}
                                                                            </div>
                                                                            <div className="text-muted-foreground">
                                                                                {item.unit === 'fixed'
                                                                                    ? `Flat Fee: $${item.rate}`
                                                                                    : `${item.quantity} ${formatUnit(item.unit)} @ $${item.rate}/${formatUnit(item.unit)}`}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            <DropdownMenu>
                                                                                <DropdownMenuTrigger asChild>
                                                                                    <Button variant="ghost" size="sm" title={item.linkedWorkItemId ? "Linked to Work Item" : "Link to Work Item"}>
                                                                                        <LinkIcon className={`h-4 w-4 mr-2 ${item.linkedWorkItemId ? "text-indigo-600" : "text-muted-foreground"}`} />
                                                                                        <span className={`${item.linkedWorkItemId ? "text-indigo-600 font-medium" : "text-muted-foreground"}`}>Link to Work Item</span>
                                                                                    </Button>
                                                                                </DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="end" className="w-[200px]">
                                                                                    <div className="p-2 text-xs font-semibold text-muted-foreground border-b mb-1">Link to Work Item</div>
                                                                                    {room.miscItems && room.miscItems.length > 0 ? (
                                                                                        <>
                                                                                            {room.miscItems.map(mi => (
                                                                                                <DropdownMenuItem
                                                                                                    key={mi.id}
                                                                                                    className={`text-xs ${item.linkedWorkItemId === mi.id ? "bg-indigo-50 text-indigo-700" : ""}`}
                                                                                                    onClick={() => handleLinkPrep(room.id, item.id || item.globalId!, mi.id, !!item.globalId)}
                                                                                                >
                                                                                                    {item.linkedWorkItemId === mi.id && <CheckCircle2 className="h-3 w-3 mr-2" />}
                                                                                                    {mi.name}
                                                                                                </DropdownMenuItem>
                                                                                            ))}
                                                                                            {item.linkedWorkItemId && (
                                                                                                <>
                                                                                                    <div className="border-t my-1"></div>
                                                                                                    <DropdownMenuItem className="text-xs text-destructive" onClick={() => handleLinkPrep(room.id, item.id || item.globalId!, null, !!item.globalId)}>
                                                                                                        Unlink
                                                                                                    </DropdownMenuItem>
                                                                                                </>
                                                                                            )}
                                                                                        </>
                                                                                    ) : (
                                                                                        <div className="p-2 text-xs text-muted-foreground">No Work Items in this room.</div>
                                                                                    )}
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                            {item._status === 'inherited' ? (
                                                                                <Button variant="ghost" size="sm" title="Override/Edit" onClick={() => openEditPrep({ ...item, id: undefined, globalId: item.id } as any, room.id)}><Pencil className="h-4 w-4 text-blue-500 opacity-50 hover:opacity-100" /></Button>
                                                                            ) : (
                                                                                <Button variant="ghost" size="sm" onClick={() => openEditPrep(item, room.id)}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                                                            )}
                                                                            <Button variant="ghost" size="sm" onClick={() => removePrepTask(room.id, item.id!)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                <Separator className="my-6" />

                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h3 className="font-medium text-sm">Additional Work Items In This Room</h3>
                                                            <p className="text-xs text-muted-foreground">Items added here apply only to this room. Use the Global tab for project-wide items.</p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {globalMiscItems.length > 0 && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="outline" size="sm" className="border-dashed border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
                                                                            <ArrowDownToLine className="h-4 w-4 mr-2" /> Assign Global Item
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-64">
                                                                        <div className="p-2 text-xs font-semibold text-muted-foreground border-b mb-1">Select Global Item to Move</div>
                                                                        <div className="py-1">
                                                                            <p className="px-2 text-[10px] text-muted-foreground mb-2">
                                                                                Moving an item will remove it from the Global list and add it to this room, along with any linked prep tasks.
                                                                            </p>
                                                                        </div>
                                                                        {globalMiscItems.map(gi => (
                                                                            <DropdownMenuItem key={gi.id} onClick={() => moveMiscItem(gi.id, room.id)}>
                                                                                <div className="flex flex-col">
                                                                                    <span>{gi.name}</span>
                                                                                    <span className="text-[10px] text-muted-foreground">{gi.quantity} {formatUnit(gi.unit)}</span>
                                                                                </div>
                                                                            </DropdownMenuItem>
                                                                        ))}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                            <Button variant="outline" size="sm" onClick={() => { setActiveRoomIdForMisc(room.id); setMiscDialogOpen(true); }}>
                                                                <PlusCircle className="h-4 w-4 mr-2" /> Add Work Item
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    {(!room.miscItems || room.miscItems.length === 0) && (
                                                        <div className="text-center p-6 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                                                            No work items added specifically for this room.
                                                        </div>
                                                    )}
                                                    <div className="space-y-2">
                                                        {room.miscItems?.map((item, idx) => (
                                                            <div key={item.id || idx} className="flex justify-between items-center p-3 border rounded-md bg-white text-sm">
                                                                <div>
                                                                    <div className="font-medium flex items-center gap-2">
                                                                        {item.name}
                                                                        {item.count && item.count > 1 && <Badge variant="secondary" className="text-[10px]">x{item.count}</Badge>}
                                                                    </div>
                                                                    <div className="text-muted-foreground">
                                                                        {item.quantity} {formatUnit(item.unit)} {item.unit === 'linear_ft' && item.width ? `(${item.width}ft wide)` : ''}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Button variant="ghost" size="sm" onClick={() => openEditMisc(item, room.id)}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                                                    <Button variant="ghost" size="sm" onClick={() => removeRoomMiscItem(room.id, item.id!)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="mt-8 pt-4 border-t flex justify-end">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="secondary"
                                                                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 bg-opacity-50"
                                                            >
                                                                <Copy className="h-4 w-4 mr-2" />
                                                                Apply This Configuration To All Rooms
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Apply Configuration to All Rooms?</DialogTitle>
                                                                <DialogDescription>
                                                                    This will overwrite the paint settings (coats, coverage, products, billing, trim, ceiling, and primer) for <strong>{(rooms?.length || 1) - 1}</strong> other room{(rooms?.length || 1) - 1 !== 1 ? 's' : ''} with the configuration from <strong>{room.name}</strong>. This cannot be undone.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <DialogFooter className="gap-2">
                                                                <Button variant="destructive" onClick={() => handleApplyToAllRooms(room.id)}>
                                                                    Yes, Apply to All
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>

                                                {/* Visualizers & Reference Photos Placeholder */}
                                                <div className="space-y-4 pt-8 border-t mt-8">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-5 w-5 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">V</div>
                                                        <h2 className="text-xl font-semibold">Visualizers for {room.name}</h2>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                                                        <FeatureLock feature="visual.recolor">
                                                            <Card>
                                                                <CardHeader>
                                                                    <CardTitle className="flex items-center gap-2">
                                                                        <Wand2 className="h-5 w-5 text-indigo-500" />
                                                                        AI Room Recolor
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="space-y-4">
                                                                    <div className="h-32 bg-muted rounded flex items-center justify-center border-2 border-dashed">
                                                                        <p className="text-muted-foreground">Upload a photo to see new colors instantly</p>
                                                                    </div>
                                                                    <Button variant="outline" className="w-full">Launch AI Recolor Tool</Button>
                                                                </CardContent>
                                                            </Card>
                                                        </FeatureLock>

                                                        <FeatureLock feature="visual.sheenSimulator">
                                                            <Card>
                                                                <CardHeader>
                                                                    <CardTitle className="flex items-center gap-2">
                                                                        <Palette className="h-5 w-5 text-pink-500" />
                                                                        Sheen Simulator
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="space-y-4">
                                                                    <div className="h-32 bg-muted rounded flex items-center justify-center border-2 border-dashed">
                                                                        <p className="text-muted-foreground">Compare Matte, Eggshell, and Semi-Gloss</p>
                                                                    </div>
                                                                    <Button variant="outline" className="w-full">Launch Sheen Simulator</Button>
                                                                </CardContent>
                                                            </Card>
                                                        </FeatureLock>
                                                    </div>

                                                    {/* Reference Photos Placeholder */}
                                                    <div className="space-y-4 pt-4">
                                                        <FeatureLock feature="capture.reference">
                                                            <Card>
                                                                <CardHeader>
                                                                    <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                                                                        <Camera className="h-5 w-5" />
                                                                        Premium Reference Photos
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent>
                                                                    <Button variant="outline" className="w-full h-24 border-dashed text-muted-foreground hover:text-foreground">
                                                                        <PlusCircle className="h-6 w-6 mr-2" />
                                                                        Upload High-Resolution Photos for {room.name}
                                                                    </Button>
                                                                </CardContent>
                                                            </Card>
                                                        </FeatureLock>
                                                    </div>
                                                </div>
                                            </CardContent >
                                        </>
                                    );
                                })()
                            ) : (
                                <CardContent className="flex items-center justify-center h-[400px]">
                                    <div className="text-center text-muted-foreground">
                                        <Ruler className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                        <p>Select a room to configure specific overrides</p>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="misc">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Other Work</CardTitle>
                                <CardDescription>Manage project-wide work items that are not specific to any single room.</CardDescription>
                            </div>
                            <Button onClick={() => { setActiveRoomIdForMisc('global'); setMiscDialogOpen(true); }}>
                                <PlusCircle className="h-4 w-4 mr-2" /> Add Work Item
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-8">
                                {/* Project Notes previously here */}

                                <div className="space-y-4">
                                    <h3 className="font-semibold text-slate-800">Global Work Items</h3>
                                    {globalMiscItems.length === 0 && (
                                        <div className="text-center p-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed flex flex-col items-center justify-center">
                                            <Package className="h-12 w-12 text-slate-300 mb-4" />
                                            <h3 className="text-lg font-medium text-slate-900">No Additional Items</h3>
                                            <p className="text-sm text-slate-500 max-w-sm mt-2 mb-6">
                                                Add work items here that apply to the whole project or don't fit into a specific room (e.g., Exterior Pressure Wash, Dumpster Fee).
                                            </p>
                                            <Button variant="outline" onClick={() => { setActiveRoomIdForMisc('global'); setMiscDialogOpen(true); }}>
                                                Add Your First Item
                                            </Button>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {globalMiscItems.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start p-4 border rounded-lg bg-white hover:border-blue-300 transition-colors shadow-sm">
                                                <div className="space-y-1">
                                                    <div className="font-medium flex items-center gap-2 text-base">
                                                        {item.name}
                                                        {item.count && item.count > 1 && <Badge variant="secondary" className="text-xs">x{item.count}</Badge>}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground flex gap-4">
                                                        <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {item.quantity} {formatUnit(item.unit)}</span>
                                                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> ${item.rate}/{formatUnit(item.unit)}</span>
                                                    </div>
                                                    {(item.paintProductId || (item.customPaintArea && item.customPaintArea > 0)) && (
                                                        <div className="flex gap-2 mt-2">
                                                            {item.paintProductId && (
                                                                <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50">
                                                                    <PaintBucket className="h-3 w-3 mr-1" />
                                                                    {paintProducts.find(p => p.id === item.paintProductId)?.name || 'Default Paint'}
                                                                </Badge>
                                                            )}
                                                            {item.customPaintArea && item.customPaintArea > 0 && (
                                                                <Badge variant="outline" className="text-[10px] text-slate-600 border-slate-200 bg-slate-50">
                                                                    Area: {item.customPaintArea} sqft/unit
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 pl-4 border-l ml-4 h-full">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem disabled className="text-xs font-semibold opacity-50">Move to Room:</DropdownMenuItem>
                                                            {rooms?.map(r => (
                                                                <DropdownMenuItem key={r.id} onClick={() => moveMiscItem(item.id, r.id)}>{r.name}</DropdownMenuItem>
                                                            ))}
                                                            {(!rooms || rooms.length === 0) && <DropdownMenuItem disabled>No Rooms</DropdownMenuItem>}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <Button variant="ghost" size="sm" onClick={() => openEditMisc(item, 'global')}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={() => removeMiscItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            <div className="flex justify-end mt-6">
                <Button onClick={onNext} size="lg" className="w-full md:w-auto">
                    Next: Supplies <ChevronDown className="ml-2 h-4 w-4 rotate-[-90deg]" />
                </Button>
            </div>

            <PaintProductDialog
                isOpen={isAddPaintOpen}
                onOpenChange={(open) => {
                    setIsAddPaintOpen(open);
                    if (!open) setEditingPaintProduct(null);
                }}
                onAdd={handleAddNewPaint}
                onUpdate={handleUpdatePaint}
                initialData={editingPaintProduct}
            />
            <PaintSelectorDialog
                isOpen={selectorOpen}
                onOpenChange={setSelectorOpen}
                products={paintProducts}
                onSelect={handleProductSelect}
                onAddNew={() => {
                    setEditingPaintProduct(null);
                    setIsAddPaintOpen(true);
                }}
                onEdit={(product) => {
                    setEditingPaintProduct(product);
                    setSelectorOpen(false);
                    setIsAddPaintOpen(true);
                }}
            />
            <AddMiscItemDialog
                isOpen={miscDialogOpen}
                onOpenChange={(open) => { setMiscDialogOpen(open); if (!open) setEditingMiscItem(null); }}
                onAdd={addMiscItem}
                roomId={activeRoomIdForMisc}
                roomName={activeRoomIdForMisc === 'global' ? 'Global' : rooms?.find(r => r.id === activeRoomIdForMisc)?.name}
                allItems={allProjectItems}
                globalItems={globalMiscItems}
                onMove={moveMiscItem}
                initialItem={editingMiscItem}
                paintProducts={paintProducts}
                defaultProduct={config.wallProduct}
                onAddNewPaint={() => setIsAddPaintOpen(true)}
            />
            <AddPrepTaskDialog
                isOpen={prepDialogOpen}
                onOpenChange={(open) => { setPrepDialogOpen(open); if (!open) setEditingPrepTask(null); }}
                onAdd={addPrepTask}
                roomId={activeRoomIdForPrep}
                roomName={activeRoomIdForPrep === 'global' ? 'Global' : rooms?.find(r => r.id === activeRoomIdForPrep)?.name}
                initialTask={editingPrepTask}
            />
        </div>
    );
}
