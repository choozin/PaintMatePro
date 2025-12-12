import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProject, useUpdateProject } from "@/hooks/useProjects";
import { useRooms } from "@/hooks/useRooms";
import { Settings2, Save, Loader2, RotateCcw, MoreVertical, Clock, CheckCircle2, DollarSign, PaintBucket, AlertCircle, PlusCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { orgOperations, PaintProduct, PaintDetails } from "@/lib/firestore";
import { useDebounce } from "@/hooks/useDebounce";
import { FileText } from "lucide-react";
import { useCatalog } from "@/hooks/useCatalog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

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
    deductionExactSqFt?: number | string;
    pricePerGallon?: number;

    wallProduct?: PaintProduct;
    ceilingProduct?: PaintProduct;
    trimProduct?: PaintProduct;
    primerProduct?: PaintProduct;

    // Primer Specifics
    primerCoats?: number;
    primerCoverage?: number;
    primerAppRate?: number; // $/sqft for labor

    includeWallpaperRemoval?: boolean;
    wallpaperRemovalRate?: number; // Now $/sqft
}

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
                                            <div className="space-y-2"><Label>Product Line</Label><Input value={details.line} onChange={e => updateDetail('line', e.target.value)} placeholder="e.g. Regal Select" /></div>
                                            <div className="space-y-2"><Label>Color Family</Label><Input value={details.colorFamily} onChange={e => updateDetail('colorFamily', e.target.value)} placeholder="e.g. Neutral, Base 1" /></div>
                                            <div className="space-y-2"><Label>Container Size</Label><Input value={details.containerSize} onChange={e => updateDetail('containerSize', e.target.value)} placeholder="e.g. 5 Gallon" /></div>
                                            <div className="space-y-2"><Label>Availability Status</Label><Input value={details.availabilityStatus} onChange={e => updateDetail('availabilityStatus', e.target.value)} placeholder="e.g. In Stock" /></div>
                                            <div className="space-y-2"><Label>Max Tint Load</Label><Input value={details.maxTintLoad} onChange={e => updateDetail('maxTintLoad', e.target.value)} placeholder="e.g. 2 oz/gal" /></div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="specs" className="mt-0 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label>Finish / Sheen</Label><Input value={details.glossLevel} onChange={e => updateDetail('glossLevel', e.target.value)} placeholder="e.g. Eggshell, 35@60" /></div>
                                            <div className="space-y-2"><Label>Base Type</Label><Input value={details.baseType} onChange={e => updateDetail('baseType', e.target.value)} placeholder="e.g. Acrylic Latex" /></div>
                                            <div className="space-y-2"><Label>VOC (g/L)</Label><Input value={details.voc} onChange={e => updateDetail('voc', e.target.value)} placeholder="e.g. <50 g/L" /></div>
                                            <div className="space-y-2"><Label>Solids % Vol</Label><Input value={details.solidsVol} onChange={e => updateDetail('solidsVol', e.target.value)} placeholder="e.g. 40%" /></div>
                                            <div className="space-y-2"><Label>Resin Type</Label><Input value={details.resinType} onChange={e => updateDetail('resinType', e.target.value)} placeholder="e.g. 100% Acrylic" /></div>
                                            <div className="space-y-2"><Label>Weight/Gal</Label><Input value={details.weightPerGallon} onChange={e => updateDetail('weightPerGallon', e.target.value)} placeholder="e.g. 10.5 lbs" /></div>
                                            <div className="space-y-2"><Label>Flash Point</Label><Input value={details.flashPoint} onChange={e => updateDetail('flashPoint', e.target.value)} /></div>
                                            <div className="space-y-2"><Label>pH</Label><Input value={details.pH} onChange={e => updateDetail('pH', e.target.value)} /></div>
                                        </div>
                                        <Separator />
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2"><Label>Dry to Touch</Label><Input value={details.dryToTouch} onChange={e => updateDetail('dryToTouch', e.target.value)} placeholder="1 hr" /></div>
                                            <div className="space-y-2"><Label>Dry to Recoat</Label><Input value={details.dryToRecoat} onChange={e => updateDetail('dryToRecoat', e.target.value)} placeholder="4 hr" /></div>
                                            <div className="space-y-2"><Label>Full Cure</Label><Input value={details.cureTime} onChange={e => updateDetail('cureTime', e.target.value)} placeholder="14 days" /></div>
                                        </div>
                                        <div className="space-y-2"><Label>Performance / Durability</Label><Textarea value={details.performanceRatings} onChange={e => updateDetail('performanceRatings', e.target.value)} placeholder="Scrub resistance, mildew resistance..." className="h-20" /></div>
                                    </TabsContent>

                                    <TabsContent value="app" className="mt-0 space-y-4">
                                        <div className="space-y-2"><Label>Rec. Application Methods</Label><Input value={details.applicationMethods?.join(', ')} onChange={e => updateDetail('applicationMethods', e.target.value.split(', '))} placeholder="Brush, Roll, Spray (comma sep)" /></div>
                                        <div className="space-y-2"><Label>Cleanup</Label><Input value={details.cleanup} onChange={e => updateDetail('cleanup', e.target.value)} placeholder="Soap & Water" /></div>
                                        <div className="space-y-2"><Label>Thinning</Label><Input value={details.thinning} onChange={e => updateDetail('thinning', e.target.value)} placeholder="Do not thin" /></div>
                                        <div className="space-y-2"><Label>Primer Requirements</Label><Textarea value={details.primerRequirements} onChange={e => updateDetail('primerRequirements', e.target.value)} className="h-20" placeholder="Specific primer codes..." /></div>
                                        <div className="space-y-2"><Label>Compatible Substrates</Label><Input value={details.substrates?.join(', ')} onChange={e => updateDetail('substrates', e.target.value.split(', '))} placeholder="Drywall, Plaster, Wood (comma sep)" /></div>
                                    </TabsContent>

                                    <TabsContent value="compliance" className="mt-0 space-y-4">
                                        <div className="space-y-2"><Label>Certifications</Label><Input value={details.certifications?.join(', ')} onChange={e => updateDetail('certifications', e.target.value.split(', '))} placeholder="LEED v4, MPI, GREENGUARD (comma sep)" /></div>
                                        <div className="space-y-2"><Label>Hazards / Safety (SDS)</Label><Textarea value={details.hazards} onChange={e => updateDetail('hazards', e.target.value)} className="h-20" placeholder="First aid, handling instructions..." /></div>
                                        <div className="space-y-2"><Label>Composition Notes</Label><Textarea value={details.compositionNotes} onChange={e => updateDetail('compositionNotes', e.target.value)} className="h-20" placeholder="Binders, pigments..." /></div>
                                    </TabsContent>
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
                                        <span className="flex items-center"><DollarSign className="h-3 w-3 mr-1" />{p.pricePerGallon}/gal</span>
                                        <span className="flex items-center"><PaintBucket className="h-3 w-3 mr-1" />{p.coverage} sqft/gal</span>
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

export function ProjectSpecs({ projectId, onNext }: ProjectSpecsProps) {
    const { data: project, isLoading: isLoadingProject } = useProject(projectId);
    const { data: rooms } = useRooms(projectId);
    const updateProject = useUpdateProject();
    const { currentOrgId } = useAuth();
    const { toast } = useToast();
    const { items: catalogItems, addItem } = useCatalog();

    // Dialog State
    const [isAddPaintOpen, setIsAddPaintOpen] = useState(false);
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [activeSelectorField, setActiveSelectorField] = useState<'wallProduct' | 'ceilingProduct' | 'trimProduct' | 'primerProduct' | null>(null);

    // Derived Catalog Lists with Mapping to PaintProduct
    const paintProducts: PaintProduct[] = catalogItems
        .filter(i => i.category === 'paint')
        .map(item => ({
            id: item.id,
            name: item.name,
            pricePerGallon: item.unitPrice || 0,
            coverage: item.coverage || 350,
            sheen: item.sheen || item.paintDetails?.glossLevel,
            dryingTime: item.paintDetails?.dryToRecoat,
            cleanup: item.paintDetails?.cleanup
        }));

    const primerProducts: PaintProduct[] = catalogItems
        .filter(i => i.category === 'primer' || i.category === 'paint')
        .map(item => ({
            id: item.id,
            name: item.name,
            pricePerGallon: item.unitPrice || 0,
            coverage: item.coverage || 350,
            sheen: item.sheen || item.paintDetails?.glossLevel
        }));

    // Track if we are in the initial load phase to prevent auto-save on mount
    const isInitialLoad = useRef(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Configuration State - DEFAULTS OFF
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
        primerAppRate: 0.50, // Default primer labor rate
        includeWallpaperRemoval: false,
        wallpaperRemovalRate: 0.50, // $/sqft
    });

    // Labor State
    const [laborConfig, setLaborConfig] = useState({
        hourlyRate: 60,
        productionRate: 150,
        ceilingProductionRate: 100,
        difficultyFactor: 1.0,
        laborPricePerSqFt: 0.75, // Per Coat Rate
    });

    const [internalConfig, setInternalConfig] = useState({
        method: 'standard', // 'standard' | 'custom'
        estimatedHours: 0,
        crewCount: 2,
        averageWage: 25, // Internal Cost
    });

    const [quoteTemplates, setQuoteTemplates] = useState<any[]>([]);

    // Debounced Values
    const debouncedConfig = useDebounce(config, 1000);
    const debouncedLaborConfig = useDebounce(laborConfig, 1000);
    const debouncedInternalConfig = useDebounce(internalConfig, 1000);

    // Load initial data
    useEffect(() => {
        async function loadData() {
            if (project && isInitialLoad.current) {
                if (project.supplyConfig) {
                    setConfig(prev => ({ ...prev, ...project.supplyConfig }));
                }
                if (project.laborConfig) {
                    setLaborConfig(prev => ({
                        ...prev,
                        hourlyRate: project.laborConfig?.hourlyRate || 60,
                        productionRate: project.laborConfig?.productionRate || 150,
                        ceilingProductionRate: project.laborConfig?.ceilingProductionRate || 100,
                        difficultyFactor: project.laborConfig?.difficultyFactor || 1.0,
                        laborPricePerSqFt: project.laborConfig?.laborPricePerSqFt || 0.75,
                    }));
                }
                if (project.internalCostConfig) {
                    setInternalConfig(prev => ({ ...prev, ...(project.internalCostConfig as any) }));
                }

                if (currentOrgId) {
                    try {
                        const org = await orgOperations.get(currentOrgId);
                        if (org) {
                            if (org.quoteTemplates) {
                                setQuoteTemplates(org.quoteTemplates);
                            }

                            if (!project.supplyConfig && !project.laborConfig && org.estimatingSettings) {
                                // Fallback to Org Defaults
                                const s = org.estimatingSettings;
                                setConfig(prev => ({
                                    ...prev,
                                    coveragePerGallon: s.defaultCoverage || 350,
                                    wallCoats: s.defaultWallCoats || 2,
                                    ceilingCoats: s.defaultCeilingCoats || 2,
                                    trimCoats: s.defaultTrimCoats || 2,
                                    primerCoats: 1,
                                    primerCoverage: 300,
                                    primerAppRate: 0.50
                                }));
                                setLaborConfig(prev => ({
                                    ...prev,
                                    hourlyRate: s.defaultLaborRate || 60,
                                    productionRate: s.defaultProductionRate || 150,
                                    laborPricePerSqFt: 0.75, // Default if not in settings yet
                                }));
                            }
                        }
                    } catch (e) {
                        console.error("Failed to load org defaults", e);
                    }
                }
                setTimeout(() => {
                    isInitialLoad.current = false;
                }, 500);
            }
        }
        loadData();
    }, [project, currentOrgId]);

    // Auto-Save Effect
    useEffect(() => {
        if (isInitialLoad.current) return;

        const saveChanges = async () => {
            setSaveStatus('saving');
            try {
                // Calculate estimated hours if standard method (Area / Production Rate)
                let hours = internalConfig.estimatedHours;
                if (internalConfig.method === 'standard' && rooms) {
                    const totalArea = rooms.reduce((acc, r) => acc + (2 * (Number(r.length) + Number(r.width)) * Number(r.height)), 0);
                    hours = laborConfig.productionRate > 0 ? totalArea / laborConfig.productionRate : 0;
                }

                await updateProject.mutateAsync({
                    id: projectId,
                    data: {
                        supplyConfig: {
                            ...debouncedConfig,
                            deductionExactSqFt: Number(debouncedConfig.deductionExactSqFt) || 0
                        },
                        laborConfig: debouncedLaborConfig,
                        internalCostConfig: {
                            ...debouncedInternalConfig,
                            method: debouncedInternalConfig.method as 'standard' | 'custom',
                            estimatedHours: hours
                        }
                    }
                });
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (error) {
                setSaveStatus('idle');
                toast({ variant: "destructive", title: "Auto-Save Failed", description: "Could not save changes." });
            }
        };

        saveChanges();
    }, [debouncedConfig, debouncedLaborConfig, debouncedInternalConfig]);

    const handleConfigChange = (key: keyof PaintConfig, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleProductSelect = (product: PaintProduct) => {
        if (!activeSelectorField) return;

        handleConfigChange(activeSelectorField, product);

        if (activeSelectorField === 'wallProduct') {
            handleConfigChange('pricePerGallon', product.pricePerGallon);
            handleConfigChange('coveragePerGallon', product.coverage);
        }
        if (activeSelectorField === 'primerProduct') {
            handleConfigChange('primerCoverage', product.coverage);
        }
        setSelectorOpen(false);
    };

    const handleAddNewPaint = async (data: NewPaintFormData) => {
        if (!currentOrgId) return;
        try {
            await addItem({
                name: data.name,
                category: 'paint',
                unitPrice: data.price,
                unitCost: data.price * 0.6, // Estimate
                unit: 'gal',
                coverage: data.coverage,
                sheen: data.details.glossLevel,
                paintDetails: data.details
            });
            toast({ title: "Paint Added", description: "Added to your catalog." });
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to add item." });
        }
    };

    const handleResetToDefaults = async () => {
        if (!currentOrgId) return;
        try {
            const org = await orgOperations.get(currentOrgId);
            if (org?.estimatingSettings) {
                const s = org.estimatingSettings;
                setConfig(prev => ({
                    ...prev,
                    coveragePerGallon: s.defaultCoverage || 350,
                    wallCoats: s.defaultWallCoats || 2,
                    ceilingCoats: s.defaultCeilingCoats || 2,
                    trimCoats: s.defaultTrimCoats || 2,
                    primerCoats: 1,
                    primerCoverage: 300,
                    primerAppRate: 0.30
                }));
                setLaborConfig(prev => ({
                    ...prev,
                    hourlyRate: s.defaultLaborRate || 60,
                    productionRate: s.defaultProductionRate || 150,
                    laborPricePerSqFt: 0.75,
                }));
                toast({ title: "Reset Complete", description: "Loaded organization defaults." });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Reset Failed", description: "Could not load defaults." });
        }
    };

    // Calculations for UI
    const calculateFinancials = () => {
        if (!rooms || rooms.length === 0) return { clientPrice: 0, internalCost: 0, margin: 0, totalArea: 0, estimatedClientHours: 0, wallpaperSeparatedCost: 0, effectiveHourlyRate: 0 };
        const totalArea = rooms.reduce((acc, r) => acc + (2 * (Number(r.length) + Number(r.width)) * Number(r.height)), 0);

        // Wallpaper Cost
        const wallpaperSeparatedCost = config.includeWallpaperRemoval ? (totalArea * (config.wallpaperRemovalRate || 0)) : 0;

        // Client Price (Revenue)
        // Coats Logic: Standard rate assumes 2 coats. Scale if different.
        const wallCoats = config.wallCoats || 2;
        const coatsMultiplier = wallCoats; // 1 to 1 multiplier since rate is per coat

        const basePaintPrice = totalArea * (laborConfig.laborPricePerSqFt || 0) * (laborConfig.difficultyFactor || 1);

        // Primer Labor Cost (Price/sqft * Area * Coats)
        const primerLaborCost = config.includePrimer ? (totalArea * (config.primerAppRate || 0) * (config.primerCoats || 1)) : 0;

        const clientPrice = (basePaintPrice * coatsMultiplier) + wallpaperSeparatedCost + primerLaborCost;

        // Internal Cost
        let internalCost = 0;
        let estimatedHours = 0;

        if (internalConfig.method === 'standard') {
            const baseHours = laborConfig.productionRate > 0 ? totalArea / laborConfig.productionRate : 0;
            const hours = baseHours * coatsMultiplier;
            const primerHours = config.includePrimer ? ((totalArea * (config.primerCoats || 1)) / (laborConfig.productionRate || 150)) : 0;
            // Scale primer hrs
            // For now, let's just stick to base hours scaling for simplicity unless requested.
            // Actually, we should include primer labor hours if primer is selected.

            internalCost = (hours + primerHours) * (internalConfig.averageWage || 0);
            estimatedHours = hours + primerHours; // For display
        } else {
            estimatedHours = (internalConfig.estimatedHours || 0);
            internalCost = estimatedHours * (internalConfig.averageWage || 0);
        }

        const clientHoursBasedOnProdRate = laborConfig.productionRate > 0 ? (totalArea / laborConfig.productionRate) * coatsMultiplier : 0;
        const effectiveHourlyRate = clientHoursBasedOnProdRate > 0 ? clientPrice / clientHoursBasedOnProdRate : 0;

        const margin = clientPrice > 0 ? ((clientPrice - internalCost) / clientPrice) * 100 : 0;
        return { clientPrice, internalCost, margin, totalArea, estimatedClientHours: clientHoursBasedOnProdRate, wallpaperSeparatedCost, effectiveHourlyRate };
    };

    const { clientPrice, internalCost, margin, totalArea, estimatedClientHours, wallpaperSeparatedCost, effectiveHourlyRate } = calculateFinancials();

    // Helper for Product Selection
    const renderProductSelect = (label: string, field: 'wallProduct' | 'ceilingProduct' | 'trimProduct' | 'primerProduct', products: PaintProduct[]) => (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    className="flex-1 justify-between text-left font-normal"
                    onClick={() => {
                        setActiveSelectorField(field);
                        setSelectorOpen(true);
                    }}
                >
                    {config[field]?.name ? (
                        <span className="flex items-center">
                            <PaintBucket className="mr-2 h-4 w-4 text-blue-500" />
                            {config[field]?.name}
                        </span>
                    ) : <span className="text-muted-foreground">Select from Paint List...</span>}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
                {config[field] && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleConfigChange(field, undefined)}
                        title="Clear Selection"
                    >
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                    </Button>
                )}
            </div>
        </div>
    );

    // Determine which list to show in selector
    const currentSelectorProducts = activeSelectorField === 'primerProduct' ? primerProducts : paintProducts;

    if (isLoadingProject) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-6">
            <AddPaintDialog isOpen={isAddPaintOpen} onOpenChange={setIsAddPaintOpen} onAdd={handleAddNewPaint} />
            <PaintSelectorDialog
                isOpen={selectorOpen}
                onOpenChange={setSelectorOpen}
                products={currentSelectorProducts}
                onSelect={handleProductSelect}
                onAddNew={() => setIsAddPaintOpen(true)}
            />
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Project Specifications</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {saveStatus === 'saving' && <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>}
                    {saveStatus === 'saved' && <><CheckCircle2 className="h-4 w-4 text-green-600" /> Saved</>}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={handleResetToDefaults}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reset to Defaults
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>



            <div className="grid gap-6 md:grid-cols-2">
                {/* Paint Specs */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PaintBucket className="h-5 w-5" /> Paint Specs</CardTitle>
                        <CardDescription>Select products from your catalog.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {renderProductSelect("Wall Paint", "wallProduct", paintProducts)}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Coats</Label><Input type="number" value={config.wallCoats} onChange={e => setConfig({ ...config, wallCoats: parseInt(e.target.value) || 2 })} /></div>
                            <div className="space-y-2"><Label>Coverage (sqft/gal)</Label><Input type="number" value={config.coveragePerGallon} onChange={e => setConfig({ ...config, coveragePerGallon: parseInt(e.target.value) || 350 })} /></div>
                        </div>

                        <Separator />
                        <div className="flex items-center justify-between">
                            <Label>Include Primer?</Label>
                            <Switch checked={config.includePrimer} onCheckedChange={c => setConfig({ ...config, includePrimer: c })} />
                        </div>
                        {config.includePrimer && (
                            <div className="space-y-4 pl-4 border-l-2 bg-slate-50/50 p-2 rounded-r-md">
                                {renderProductSelect("Primer", "primerProduct", primerProducts)}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground uppercase">Primer Coats</Label>
                                        <Input type="number" value={config.primerCoats || 1} onChange={e => setConfig({ ...config, primerCoats: parseInt(e.target.value) || 1 })} className="h-8" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground uppercase">Coverage (sqft/gal)</Label>
                                        <Input type="number" value={config.primerCoverage || 300} onChange={e => setConfig({ ...config, primerCoverage: parseInt(e.target.value) || 300 })} className="h-8" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground uppercase">Primer $/sqft</Label>
                                    <Input type="number" step="0.05" value={config.primerAppRate || 0.30} onChange={e => setConfig({ ...config, primerAppRate: parseFloat(e.target.value) || 0 })} className="h-8" />
                                </div>
                            </div>
                        )}

                        <Separator />
                        <div className="flex items-center justify-between">
                            <Label>Wallpaper Removal?</Label>
                            <Switch checked={config.includeWallpaperRemoval} onCheckedChange={c => setConfig({ ...config, includeWallpaperRemoval: c })} />
                        </div>
                        {config.includeWallpaperRemoval && (
                            <div className="pl-4 border-l-2 space-y-3">
                                <div className="space-y-2">
                                    <Label>Removal Rate ($/sqft)</Label>
                                    <Input type="number" step="0.1" value={config.wallpaperRemovalRate} onChange={e => setConfig({ ...config, wallpaperRemovalRate: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div className="text-sm rounded-md bg-muted p-2 flex justify-between">
                                    <span className="text-muted-foreground">Est. Extra Cost:</span>
                                    <span className="font-semibold text-green-700">+${wallpaperSeparatedCost.toFixed(0)}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Double Ledger Pricing */}
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Production & Pricing</CardTitle>
                        <CardDescription>Client Price vs. Internal Cost</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Client Facing */}
                        <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
                            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Client Pricing (Revenue)</h3>
                            <div className="grid grid-cols-2 gap-4 items-start">
                                <div className="space-y-2">
                                    <Label className="h-10 flex items-end pb-1">Base Rate ($/sqft/coat)</Label>
                                    <Input
                                        type="number"
                                        value={laborConfig.laborPricePerSqFt}
                                        onChange={e => setLaborConfig({ ...laborConfig, laborPricePerSqFt: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="h-10 flex items-end pb-1">Difficulty Multiplier</Label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={laborConfig.difficultyFactor}
                                        onChange={e => setLaborConfig({ ...laborConfig, difficultyFactor: parseFloat(e.target.value) || 1 })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm font-medium">Projected Revenue:</span>
                                <span className="text-lg font-bold text-green-700">${clientPrice.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-muted-foreground mt-1 px-1">
                                <span>Est. Time ({estimatedClientHours.toFixed(1)} hrs)</span>
                                <span>Effective: ${effectiveHourlyRate.toFixed(2)}/hr</span>
                            </div>
                        </div>

                        {/* Internal Cost */}
                        <div className="space-y-4 p-4 bg-yellow-50/50 rounded-lg border border-yellow-100">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Internal Cost (Estimated)</h3>
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs">Method:</Label>
                                    <Select
                                        value={internalConfig.method}
                                        onValueChange={(val: any) => setInternalConfig({ ...internalConfig, method: val })}
                                    >
                                        <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="standard">Standard Rate</SelectItem><SelectItem value="custom">Custom Hours</SelectItem></SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Avg Wage ($/hr)</Label>
                                    <Input
                                        type="number"
                                        value={internalConfig.averageWage}
                                        onChange={e => setInternalConfig({ ...internalConfig, averageWage: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                {internalConfig.method === 'standard' ? (
                                    <div className="space-y-2">
                                        <Label>Prod Rate (sqft/hr)</Label>
                                        <Input
                                            type="number"
                                            value={laborConfig.productionRate}
                                            onChange={e => setLaborConfig({ ...laborConfig, productionRate: parseFloat(e.target.value) || 150 })}
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label>Est. Hours</Label>
                                        <Input
                                            type="number"
                                            value={internalConfig.estimatedHours}
                                            onChange={e => setInternalConfig({ ...internalConfig, estimatedHours: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm font-medium">Estimated Cost:</span>
                                <span className="text-lg font-bold text-amber-700">${internalCost.toFixed(0)}</span>
                            </div>
                        </div>

                        {/* Margin */}
                        <div className="flex items-center justify-between p-4 bg-slate-100 rounded-lg">
                            <span className="font-semibold text-slate-700">Projected Margin <span className="text-xs font-normal text-muted-foreground">(Labor, Pre-Expense)</span></span>
                            <div className={`text-xl font-bold ${margin >= 40 ? 'text-green-600' : margin >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {margin.toFixed(1)}%
                            </div>
                        </div>

                    </CardContent>
                </Card>

            </div>

            <div className="flex justify-end pt-4 pb-8">
                <Button onClick={onNext} className="w-full md:w-auto font-semibold" size="default">
                    Next Step: Supplies
                    <PaintBucket className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div >
    );
}
