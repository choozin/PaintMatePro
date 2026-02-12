import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { PaintDetails, PaintProduct } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";

export interface NewPaintFormData {
    name: string;
    price: number;
    cost: number;
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

export function PaintProductDialog({
    isOpen,
    onOpenChange,
    onAdd,
    onUpdate,
    initialData
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (data: NewPaintFormData) => Promise<void>;
    onUpdate?: (id: string, data: NewPaintFormData) => Promise<void>;
    initialData?: PaintProduct | null;
}) {
    const { org } = useAuth();
    // Default values from Org Settings or hardcoded fallbacks
    const defaultPrice = org?.estimatingSettings?.defaultPricePerGallon || 45;
    const defaultCost = org?.estimatingSettings?.defaultCostPerGallon || 25;
    const defaultCoverageVal = org?.estimatingSettings?.defaultCoverage || 350;

    const [name, setName] = useState("");
    const [price, setPrice] = useState(defaultPrice);
    const [cost, setCost] = useState(defaultCost);
    const [coverage, setCoverage] = useState(defaultCoverageVal);
    const [details, setDetails] = useState<PaintDetails>(INITIAL_DETAILS);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("identity");
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Initial Data Effect
    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name);
            setPrice(initialData.unitPrice);
            setCost(initialData.unitCost || (initialData.unitPrice * 0.6));
            setCoverage(initialData.coverage || defaultCoverageVal);
            if (initialData.paintDetails) {
                setDetails(initialData.paintDetails);
                setShowAdvanced(true);
            } else {
                setDetails(INITIAL_DETAILS);
            }
        } else if (isOpen && !initialData) {
            // Reset if opening in add mode
            setName("");
            setPrice(defaultPrice);
            setCost(defaultCost);
            setCoverage(defaultCoverageVal);
            setDetails(INITIAL_DETAILS);
            setActiveTab("identity");
            setShowAdvanced(false);
        }
    }, [isOpen, initialData, defaultPrice, defaultCost, defaultCoverageVal]);

    const handleCostChange = (newCost: number) => {
        setCost(newCost);
        if (org?.defaultMarkupValue && org.defaultMarkupValue > 0) {
            let newPrice = price;
            if (org.defaultMarkupType === 'fixed') {
                newPrice = newCost + org.defaultMarkupValue;
            } else {
                newPrice = newCost * (1 + (org.defaultMarkupValue / 100));
            }
            setPrice(parseFloat(newPrice.toFixed(2)));
        }
    };

    const handleSaveAsNew = async () => {
        if (!name) return;

        if (initialData && name === initialData.name) {
            alert("Please change the name to save as a new paint product.");
            return;
        }

        setIsSubmitting(true);
        try {
            await onAdd({ name, price, cost, coverage, details });
            onOpenChange(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOverwrite = async () => {
        if (!initialData || !onUpdate) return;
        if (!name) return;

        if (name !== initialData.name) {
            alert("To overwrite, you must keep the original name. If you want to change the name, please use 'Save as New'.");
            return;
        }

        if (!window.confirm("Are you sure you want to overwrite the existing paint product?")) {
            return;
        }

        setIsSubmitting(true);
        try {
            await onUpdate(initialData.id!, { name, price, cost, coverage, details });
            onOpenChange(false);
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
                    <DialogTitle>{initialData ? 'Edit Paint Product' : 'Add New Paint Product'}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <ScrollArea className="flex-1">
                        <div className="px-6 pb-4 space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Product Name *</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Benjamin Moore Aura" required />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Cost ($/gal) *</Label>
                                    <Input
                                        type="number"
                                        value={cost}
                                        onChange={e => handleCostChange(parseFloat(e.target.value))}
                                        required
                                        min={0}
                                        step={0.01}
                                    />
                                </div>
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
                                            {/* ... other fields can go here ... */}
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="specs" className="mt-0 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label>Gloss Level</Label><Input value={details.glossLevel} onChange={e => updateDetail('glossLevel', e.target.value)} placeholder="e.g. Eggshell, Semi-Gloss" /></div>
                                            <div className="space-y-2"><Label>Base Type</Label><Input value={details.baseType} onChange={e => updateDetail('baseType', e.target.value)} placeholder="e.g. Latex" /></div>
                                            <div className="space-y-2"><Label>VOC</Label><Input value={details.voc} onChange={e => updateDetail('voc', e.target.value)} /></div>
                                            <div className="space-y-2"><Label>Solids Vol.</Label><Input value={details.solidsVol} onChange={e => updateDetail('solidsVol', e.target.value)} /></div>
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="app" className="mt-0 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label>Dry to Touch</Label><Input value={details.dryToTouch} onChange={e => updateDetail('dryToTouch', e.target.value)} /></div>
                                            <div className="space-y-2"><Label>Recoat Time</Label><Input value={details.dryToRecoat} onChange={e => updateDetail('dryToRecoat', e.target.value)} /></div>
                                            <div className="space-y-2"><Label>Cleanup</Label><Input value={details.cleanup} onChange={e => updateDetail('cleanup', e.target.value)} /></div>
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="compliance" className="mt-0 space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-2"><Label>Hazards / SDS</Label><Input value={details.hazards} onChange={e => updateDetail('hazards', e.target.value)} /></div>
                                        </div>
                                    </TabsContent>
                                </div>
                            </Tabs>
                        )}
                    </ScrollArea>

                    <DialogFooter className="p-6 pt-2 border-t mt-auto bg-background z-20 gap-2">
                        {initialData ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleOverwrite}
                                    disabled={isSubmitting}
                                    className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                >
                                    Overwrite Existing
                                </Button>
                                <Button onClick={handleSaveAsNew} disabled={isSubmitting}>
                                    Save as New Copy
                                </Button>
                            </>
                        ) : (
                            <Button onClick={handleSaveAsNew} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save to Catalog
                            </Button>
                        )}
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
