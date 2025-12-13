import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProject, useUpdateProject } from "@/hooks/useProjects";
import { useRooms, useUpdateRoom } from "@/hooks/useRooms";
import { Settings2, Save, Loader2, RotateCcw, MoreVertical, Clock, CheckCircle2, DollarSign, PaintBucket, AlertCircle, PlusCircle, ChevronDown, ChevronUp, Ruler, Package, Trash2, ArrowDownToLine, Copy, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { orgOperations, PaintProduct, PaintDetails, roomOperations, Room, PrepTask, MiscMeasurement } from "@/lib/firestore";
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
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

// --- Types ---


interface ProjectSpecsProps {
    projectId: string;
    onNext?: () => void;
}

interface NewPaintFormData {
    name: string;
    price: number;
    coverage: number;
    details: PaintDetails;
}

const INITIAL_DETAILS: PaintDetails = {
    productCode: "", manufacturer: "", line: "", colorFamily: "",
    containerSize: "Gallon", availabilityStatus: "", maxTintLoad: "",
    baseType: "", resinType: "", glossLevel: "", voc: "", solidsVol: "", weightPerGallon: "", flashPoint: "", pH: "",
    coverageRate: "", dryToTouch: "", dryToRecoat: "", cureTime: "", performanceRatings: "", recommendedUses: [],
    applicationMethods: [], thinning: "", primerRequirements: "", substrates: [], cleanup: "",
    certifications: [], hazards: "", compositionNotes: ""
};

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

// --- Sub-Components ---

function AddPaintDialog({ isOpen, onOpenChange, onAdd }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onAdd: (data: NewPaintFormData) => Promise<void> }) {
    const [name, setName] = useState("");
    const [price, setPrice] = useState(45);
    const [coverage, setCoverage] = useState(350);
    const [details, setDetails] = useState<PaintDetails>(INITIAL_DETAILS);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("identity");
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        setIsSubmitting(true);
        try {
            await onAdd({ name, price, coverage, details });
            onOpenChange(false);
            setName(""); setPrice(45); setCoverage(350); setDetails(INITIAL_DETAILS); setActiveTab("identity"); setShowAdvanced(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateDetail = (key: keyof PaintDetails, value: any) => {
        setDetails(prev => ({ ...prev, [key]: value }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={`max-w-2xl flex flex-col p-0 transition-all duration-300 ${showAdvanced ? 'h-[90vh]' : 'h-auto'}`}>
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Add New Paint Product</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <ScrollArea className="flex-1">
                        <div className="px-6 pb-4 space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Product Name *</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Benjamin Moore Aura" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Price ($/gal) *</Label>
                                    <Input type="number" value={price} onChange={e => setPrice(parseFloat(e.target.value))} required min={0} step={0.01} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Calc Coverage (sqft/gal) *</Label>
                                    <Input type="number" value={coverage} onChange={e => setCoverage(parseInt(e.target.value))} required min={1} placeholder="350" />
                                </div>
                            </div>
                        </div>

                        <div className="px-6 pb-2">
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center justify-center gap-2 h-8 text-sm"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                            >
                                {showAdvanced ? (
                                    <>Hide Advanced Details <ChevronUp className="h-4 w-4" /></>
                                ) : (
                                    <>Show Advanced Details ({activeTab === 'identity' ? 'TDS' : 'More'}) <ChevronDown className="h-4 w-4" /></>
                                )}
                            </Button>
                        </div>

                        {showAdvanced && (
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col border-t animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-6 border-b sticky top-0 bg-background z-10 pt-2">
                                    <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b-0 space-x-6 overflow-x-auto no-scrollbar">
                                        {["identity", "specs", "app", "compliance"].map(t => (
                                            <TabsTrigger
                                                key={t}
                                                value={t}
                                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 capitalize"
                                            >
                                                {t === 'app' ? 'Application' : t}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </div>

                                <div className="p-6">
                                    <TabsContent value="identity" className="mt-0 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label>Product Code / SKU</Label><Input value={details.productCode} onChange={e => updateDetail('productCode', e.target.value)} placeholder="e.g. N524" /></div>
                                            <div className="space-y-2"><Label>Manufacturer</Label><Input value={details.manufacturer} onChange={e => updateDetail('manufacturer', e.target.value)} placeholder="e.g. Benjamin Moore" /></div>
                                            {/* ... other fields ... */}
                                        </div>
                                    </TabsContent>
                                    {/* ... other tabs ... */}
                                </div>
                            </Tabs>
                        )}
                    </ScrollArea>

                    <DialogFooter className="p-6 pt-2 border-t mt-auto bg-background z-20">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save to Catalog
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PaintSelectorDialog({
    isOpen,
    onOpenChange,
    products,
    onSelect,
    onAddNew
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    products: PaintProduct[];
    onSelect: (product: PaintProduct) => void;
    onAddNew: () => void;
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
                            <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer group" onClick={() => onSelect(p)}>
                                <div>
                                    <div className="font-medium group-hover:text-blue-600 transition-colors">{p.name}</div>
                                    <div className="text-sm text-muted-foreground flex gap-3">
                                        <span className="flex items-center"><DollarSign className="h-3 w-3 mr-1" />{p.unitPrice}/gal</span>
                                        <span className="flex items-center"><PaintBucket className="h-3 w-3 mr-1" />{p.coverage || 350} sqft/gal</span>
                                    </div>
                                </div>
                                <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">Select</Button>
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
    initialItem
}: {
    isOpen: boolean,
    onOpenChange: (o: boolean) => void,
    onAdd: (item: MiscMeasurement) => void,
    roomId?: string,
    roomName?: string,
    allItems?: MiscMeasurement[],
    globalItems?: MiscMeasurement[],
    onMove?: (itemId: string, targetRoomId: string) => void,
    initialItem?: MiscMeasurement | null
}) {
    const [name, setName] = useState("");
    const [unit, setUnit] = useState<'sqft' | 'linear_ft' | 'units' | 'fixed' | 'hours'>('units');
    const [quantity, setQuantity] = useState(1);
    const [rate, setRate] = useState(0);
    const [width, setWidth] = useState(0.5);
    const [count, setCount] = useState(1);

    // Load initial item on open
    useEffect(() => {
        if (isOpen && initialItem) {
            setName(initialItem.name);
            setUnit(initialItem.unit);
            setQuantity(initialItem.quantity);
            setRate(initialItem.rate);
            if (initialItem.width) setWidth(initialItem.width);
            if (initialItem.count) setCount(initialItem.count);
        } else if (isOpen && !initialItem) {
            setName("");
            setUnit('units');
            setQuantity(1);
            setRate(0);
            setCount(1);
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
            setOpenSection(null); // Close after selection to focus on form
        }
    };

    const handleSubmit = () => {
        onAdd({
            id: initialItem?.id || crypto.randomUUID(),
            name,
            unit,
            quantity,
            rate,
            width: unit === 'linear_ft' ? width : undefined,
            roomId,
            count
        });
        onOpenChange(false);
        setName(""); setQuantity(1); setRate(0); setCount(1);
    };

    const totalQty = quantity * count;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{initialItem ? 'Edit Work Item' : `Add Work Item (${roomName})`}</DialogTitle>
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
                            <Label>{unit === 'fixed' ? 'Price' : `Rate ($ per ${unit === 'units' ? 'item' : unit === 'hours' ? 'hr' : unit})`}</Label>
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

                    {unit === 'linear_ft' && (
                        <div className="space-y-2">
                            <Label>Approx Width (ft) for Paint Calc</Label>
                            <Input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} step={0.1} />
                        </div>
                    )}

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
                    <Button onClick={handleSubmit}>Add Item</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog >
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
    const { currentOrgId, org } = useAuth();
    const { toast } = useToast();
    const { items: catalogItems, addItem } = useCatalog();

    // Dialog State
    const [isAddPaintOpen, setIsAddPaintOpen] = useState(false);
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [activeSelectorField, setActiveSelectorField] = useState<'wallProduct' | 'ceilingProduct' | 'trimProduct' | 'primerProduct' | null>(null);
    const [selectorContext, setSelectorContext] = useState<'global' | { roomId: string }>('global');
    const [activeTab, setActiveTab] = useState("global");

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
            // Load Configs
            if (project.supplyConfig) setConfig(prev => ({ ...prev, ...project.supplyConfig }));
            if (project.laborConfig) setLaborConfig(prev => ({ ...prev, ...project.laborConfig }));

            // Load Lists
            if (project.globalPrepTasks) setGlobalPrepTasks(project.globalPrepTasks);
            if (project.globalMiscItems) setGlobalMiscItems(project.globalMiscItems);

            setTimeout(() => { isInitialLoad.current = false; }, 500);
        }
    }, [project]);

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
        // Toast is a bit noisy for toggles, maybe optional?
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

    const handleAddNewPaint = async (data: NewPaintFormData) => {
        await addItem({
            name: data.name,
            category: 'paint',
            unitPrice: data.price,
            unitCost: data.price * 0.6,
            unit: 'gal',
            coverage: data.coverage,
            sheen: data.details.glossLevel,
            paintDetails: data.details
        });
        toast({ title: "Paint Added", description: "Added to your catalog." });
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

        // 1. Remove from Global
        const newGlobals = globalMiscItems.filter(i => i.id !== itemId);
        setGlobalMiscItems(newGlobals);

        // 2. Add to Room
        const room = rooms?.find(r => r.id === targetRoomId);
        if (room) {
            const newItem = { ...itemToMove, roomId: targetRoomId };
            const currentMisc = room.miscItems || [];
            await updateRoom.mutateAsync({
                id: targetRoomId,
                data: { miscItems: [...currentMisc, newItem] }
            });
            // Also need to push global update immediately to avoid sync issues or wait for debounce?
            // Debounce handles global state, so changing setGlobalMiscItems triggers pending project update.
            // But we should probably force project update for atomic feel? 
            // The debouncer will catch it.
            toast({ title: "Item Moved", description: `Moved to ${room.name}` });
        }
    };



    // Aggregate for templating
    const allProjectItems = [
        ...globalMiscItems,
        ...(rooms?.flatMap(r => r.miscItems || []) || [])
    ];



    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
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
                    <TabsTrigger value="global" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-4 py-3">
                        General Specs & Paint
                    </TabsTrigger>
                    <TabsTrigger value="rooms" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-4 py-3">
                        Room-Specific Overrides
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="global" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 1. Paint Systems */}
                        <Card>
                            <CardHeader><CardTitle className="text-lg">Paint Configuration</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                {/* Wall Paint */}
                                <div className="space-y-2">
                                    <Label>Wall Paint</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 p-2 border rounded-md bg-muted/20 text-sm flex justify-between items-center">
                                            <span>{config.wallProduct?.name || "Standard Wall Paint"}</span>
                                            <span className="text-muted-foreground text-xs">{config.wallProduct ? `$${config.wallProduct.unitPrice}/gal` : "$45/gal"}</span>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => { setActiveSelectorField('wallProduct'); setSelectorContext('global'); setSelectorOpen(true); }}>Change</Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div><Label className="text-xs">Coats</Label><Input type="number" value={config.wallCoats} onChange={e => handleConfigChange('wallCoats', Number(e.target.value))} className="h-8" /></div>
                                        <div><Label className="text-xs">Coverage (sqft/gal)</Label><Input type="number" value={config.coveragePerGallon} onChange={e => handleConfigChange('coveragePerGallon', Number(e.target.value))} className="h-8" /></div>
                                    </div>
                                </div>
                                <Separator />
                                {/* Ceiling & Trim Toggles */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Include Ceilings?</Label>
                                        <Switch checked={config.includeCeiling} onCheckedChange={c => handleConfigChange('includeCeiling', c)} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <Label>Include Trim?</Label>
                                            {config.includeTrim && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">Default Rate: $</span>
                                                    <Input
                                                        type="number"
                                                        className="h-6 w-20 text-xs"
                                                        value={config.defaultTrimRate ?? 1.50}
                                                        onChange={e => handleConfigChange('defaultTrimRate', Number(e.target.value))}
                                                    />
                                                    <span className="text-xs text-muted-foreground">/ft</span>
                                                </div>
                                            )}
                                        </div>
                                        <Switch checked={config.includeTrim} onCheckedChange={c => handleConfigChange('includeTrim', c)} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>Include Primer?</Label>
                                        <Switch checked={config.includePrimer} onCheckedChange={c => handleConfigChange('includePrimer', c)} />
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                        <div className="space-y-0.5">
                                            <Label>Bill Paint to Customer</Label>
                                            <p className="text-[10px] text-muted-foreground">If disabled, paint cost is hidden ($0). Defaults to Org setting.</p>
                                        </div>
                                        <Switch
                                            checked={config.billablePaint ?? org?.estimatingSettings?.defaultBillablePaint ?? true}
                                            onCheckedChange={c => handleConfigChange('billablePaint', c)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Labor Rates */}
                        <Card>
                            <CardHeader><CardTitle className="text-lg">Labor & Production</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Hourly Rate ($)</Label>
                                        <Input type="number" value={laborConfig.hourlyRate} onChange={e => setLaborConfig({ ...laborConfig, hourlyRate: Number(e.target.value) })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Prod Rate (sqft/hr)</Label>
                                        <Input type="number" value={laborConfig.productionRate} onChange={e => setLaborConfig({ ...laborConfig, productionRate: Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Difficulty / Waste Factor</Label>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" step="0.1" value={laborConfig.difficultyFactor} onChange={e => setLaborConfig({ ...laborConfig, difficultyFactor: Number(e.target.value) })} />
                                        <span className="text-sm text-muted-foreground">x Multiplier</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                    </div>

                    {/* 3. Global Prep Tasks */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Additional Prep Tasks (Global)</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => setPrepDialogOpen(true)}>
                                <PlusCircle className="h-4 w-4 mr-2" /> Add Prep Default
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {globalPrepTasks.length === 0 && (
                                    <div className="text-center p-4 text-muted-foreground bg-amber-50 rounded-lg border border-amber-100 border-dashed">
                                        No global prep tasks defined. Add tasks here to apply them to all rooms automatically.
                                    </div>
                                )}
                                {globalPrepTasks.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 border rounded-md bg-white">
                                        <div>
                                            <div className="font-medium flex items-center gap-2">
                                                {item.name}
                                                {item.count && item.count > 1 && <Badge variant="secondary" className="text-[10px]">x{item.count}</Badge>}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {item.unit === 'fixed'
                                                    ? `Flat Fee: $${item.rate}`
                                                    : `${item.quantity} ${formatUnit(item.unit)} @ $${item.rate}/${formatUnit(item.unit)}`}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => openEditPrep(item, 'global')}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                            <Button variant="ghost" size="sm" onClick={() => setGlobalPrepTasks(prev => prev.filter(t => t.id !== item.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 4. Global Misc Items */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Additional Work Items</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => { setActiveRoomIdForMisc('global'); setMiscDialogOpen(true); }}>
                                <PlusCircle className="h-4 w-4 mr-2" /> Add Work Item
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {globalMiscItems.length === 0 && (
                                    <div className="text-center p-4 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                                        No project-wide work items added yet.
                                    </div>
                                )}
                                {globalMiscItems.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 border rounded-md bg-white">
                                        <div>
                                            <div className="font-medium flex items-center gap-2">
                                                {item.name}
                                                {item.count && item.count > 1 && <Badge variant="secondary" className="text-[10px]">x{item.count}</Badge>}
                                            </div>
                                            <div className="text-sm text-muted-foreground">{item.quantity} {formatUnit(item.unit)} @ ${item.rate}/{formatUnit(item.unit)}</div>
                                        </div>
                                        <div className="flex items-center gap-1">
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
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rooms">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="md:col-span-1">
                            <CardHeader><CardTitle className="text-sm">Select Room</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[400px]">
                                    {rooms?.map(room => (
                                        <div
                                            key={room.id}
                                            onClick={() => setSelectedRoomId(room.id)}
                                            className={`p-3 border-b cursor-pointer flex justify-between transition-colors ${selectedRoomId === room.id ? 'bg-muted border-l-4 border-l-primary' : 'hover:bg-muted/50'}`}
                                        >
                                            <span className="font-medium">{room.name}</span>
                                            {room.color && <div className="h-4 w-4 rounded-full border shadow-sm" style={{ backgroundColor: room.color }} title={room.color} />}
                                        </div>
                                    ))}
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
                                                {/* Room Paint Config */}
                                                <div className="p-4 border rounded-lg bg-slate-50/50 space-y-4">
                                                    <h3 className="font-semibold text-sm flex items-center gap-2"><PaintBucket className="h-4 w-4" /> Paint System Overrides</h3>

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
                                                                <Label className="text-xs">Wall Coats</Label>
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
                                                                <Label className="text-xs">Coverage (sqft/gal)</Label>
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

                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                        {/* Ceiling Toggle */}
                                                        <div className="flex flex-col justify-between space-y-2 border p-3 rounded bg-white">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="text-xs">Include Ceiling?</Label>
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
                                                                <Label className="text-xs">Require Primer?</Label>
                                                                <Switch
                                                                    checked={room.supplyConfig?.requirePrimer ?? config.includePrimer}
                                                                    onCheckedChange={(c) => handleRoomSupplyUpdate(room.id, 'requirePrimer', c)}
                                                                />
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {room.supplyConfig?.requirePrimer !== undefined ? "Room Override" : `Using Global (${config.includePrimer ? 'Yes' : 'No'})`}
                                                            </p>
                                                        </div>

                                                        {/* Trim Toggle & Pricing */}
                                                        <div className="flex flex-col justify-between space-y-2 border p-3 rounded bg-white col-span-2 md:col-span-1">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="text-xs">Include Trim?</Label>
                                                                <Switch
                                                                    checked={room.supplyConfig?.includeTrim ?? config.includeTrim}
                                                                    onCheckedChange={(c) => handleRoomSupplyUpdate(room.id, 'includeTrim', c)}
                                                                />
                                                            </div>
                                                            {(room.supplyConfig?.includeTrim ?? config.includeTrim) && (
                                                                <div className="space-y-2 pt-2 border-t mt-1">
                                                                    <div className="flex justify-between items-center">
                                                                        <Label className="text-[10px] text-muted-foreground">Rate ($/ft)</Label>
                                                                        {room.supplyConfig?.trimRate !== undefined && <Badge variant="secondary" className="text-[9px] px-1 h-4">Override</Badge>}
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <Input
                                                                            type="number"
                                                                            className="h-7 text-xs"
                                                                            value={room.supplyConfig?.trimRate ?? config.defaultTrimRate ?? 1.50}
                                                                            onChange={e => handleRoomSupplyUpdate(room.id, 'trimRate', Number(e.target.value))}
                                                                        />
                                                                        {room.supplyConfig?.trimRate !== undefined && (
                                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRoomSupplyUpdate(room.id, 'trimRate', null)}>
                                                                                <RotateCcw className="h-3 w-3" />
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] bg-slate-50 p-1 rounded text-center border">
                                                                        Est: <span className="font-semibold">${(((room.length + room.width) * 2) * (room.supplyConfig?.trimRate ?? config.defaultTrimRate ?? 1.50)).toFixed(2)}</span>
                                                                        <span className="text-muted-foreground ml-1">({(room.length + room.width) * 2} ft)</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {!(room.supplyConfig?.includeTrim ?? config.includeTrim) && (
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {room.supplyConfig?.includeTrim !== undefined ? "Room Override" : `Using Global (${config.includeTrim ? 'Yes' : 'No'})`}
                                                                </p>
                                                            )}
                                                        </div>
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
                                                        <Button variant="outline" size="sm" onClick={() => { setActiveRoomIdForMisc(room.id); setMiscDialogOpen(true); }}>
                                                            <PlusCircle className="h-4 w-4 mr-2" /> Add Work Item
                                                        </Button>
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
                                            </CardContent>
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

                <div className="flex justify-end mt-8 border-t pt-4">
                    <Button onClick={onNext} size="lg" className="w-full md:w-auto">
                        Next: Supplies <ChevronDown className="ml-2 h-4 w-4 rotate-[-90deg]" />
                    </Button>
                </div>
            </Tabs>

            <AddPaintDialog isOpen={isAddPaintOpen} onOpenChange={setIsAddPaintOpen} onAdd={handleAddNewPaint} />
            <PaintSelectorDialog isOpen={selectorOpen} onOpenChange={setSelectorOpen} products={paintProducts} onSelect={handleProductSelect} onAddNew={() => setIsAddPaintOpen(true)} />
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
            />
            <AddPrepTaskDialog
                isOpen={prepDialogOpen}
                onOpenChange={(open) => { setPrepDialogOpen(open); if (!open) setEditingPrepTask(null); }}
                onAdd={addPrepTask}
                roomId={activeRoomIdForPrep}
                roomName={activeRoomIdForPrep === 'global' ? 'Global' : rooms?.find(r => r.id === activeRoomIdForPrep)?.name}
                initialTask={editingPrepTask}
            />
        </div >
    );
}

