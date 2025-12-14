import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, ChevronLeft, Check, LayoutTemplate, PaintBucket, Package, Wrench, DollarSign, ListChecks, Info } from "lucide-react";
import { QuoteConfiguration, DEFAULT_QUOTE_CONFIG } from "@/types/quote-config";
import { QuotePreview } from "./QuotePreview";

interface QuoteConfigWizardProps {
    initialConfig?: QuoteConfiguration;
    onComplete: (config: QuoteConfiguration) => void;
    onCancel: () => void;
}

const STEPS = [
    { id: 1, title: "Listing Strategy", icon: LayoutTemplate, Description: "How should line items be grouped?" },
    { id: 2, title: "Paint Costs", icon: PaintBucket, Description: "How should paint application costs be displayed?" },
    { id: 3, title: "Material Costs", icon: Package, Description: "How should incidental material costs be displayed?" },
    { id: 4, title: "Fine Tuning", icon: ListChecks, Description: "Final adjustment toggles." },
];

export function QuoteConfigWizard({ initialConfig, onComplete, onCancel }: QuoteConfigWizardProps) {
    const [step, setStep] = useState(1);
    const [config, setConfig] = useState<QuoteConfiguration>({ ...DEFAULT_QUOTE_CONFIG, ...initialConfig });

    const updateConfig = (key: keyof QuoteConfiguration, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const updateNestedConfig = (parent: 'paintDetails' | 'materialDetails', key: string, value: any) => {
        setConfig(prev => ({
            ...prev,
            [parent]: {
                ...prev[parent],
                [key]: value
            }
        }));
    };

    const handleNext = () => {
        if (step < STEPS.length) {
            setStep(step + 1);
        } else {
            onComplete(config);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 1: // Listing Strategy
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <RadioGroup value={config.listingStrategy} onValueChange={(val) => updateConfig('listingStrategy', val)}>
                            <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${config.listingStrategy === 'by_room' ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50 hover:bg-muted'}`}>
                                <RadioGroupItem value="by_room" id="by_room" className="mt-1" />
                                <div className="grid gap-1.5 cursor-pointer" onClick={() => updateConfig('listingStrategy', 'by_room')}>
                                    <Label htmlFor="by_room" className="font-semibold text-lg cursor-pointer">By Room</Label>
                                    <p className="text-sm text-muted-foreground">Group items by their location (e.g., Living Room Header &rarr; Walls, Ceiling lines).</p>
                                </div>
                            </div>
                            <div className={`flex flex-col space-y-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${config.listingStrategy === 'by_surface' ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50 hover:bg-muted'}`}>
                                <div className="flex items-start space-x-3">
                                    <RadioGroupItem value="by_surface" id="by_surface" className="mt-1" />
                                    <div className="grid gap-1.5 cursor-pointer" onClick={() => updateConfig('listingStrategy', 'by_surface')}>
                                        <Label htmlFor="by_surface" className="font-semibold text-lg cursor-pointer">By Surface/Activity</Label>
                                        <p className="text-sm text-muted-foreground">Group items by the type of work (e.g., Walls Header &rarr; Living Room, Kitchen lines).</p>
                                    </div>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>
                );

            case 2: // Paint Costs
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid gap-4">
                            <Label className="text-base">Placement Strategy</Label>
                            <Select value={config.paintPlacement} onValueChange={(val: any) => updateConfig('paintPlacement', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inline">In-line (Combined with Labor)</SelectItem>
                                    <SelectItem value="subline">Sub-line (Listed below Item)</SelectItem>
                                    <SelectItem value="separate_area">Separate Area (Bottom Section)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 text-blue-800 p-3 rounded text-sm flex gap-2 items-start">
                            <Info className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                                <strong>About Paint Billing:</strong>
                                <p className="text-xs mt-1 opacity-90">
                                    <em>"You can set your paint costs to be built into your labour rate when you make a quote, in which case the cost of the paint wouldn't appear on the quote."</em>
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <Label className="text-base">Details to Show</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center space-x-2">
                                    <Switch id="show_name" checked={config.paintDetails.showName} onCheckedChange={(c) => updateNestedConfig('paintDetails', 'showName', c)} />
                                    <Label htmlFor="show_name">Show Paint Name</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch id="show_vol" checked={config.paintDetails.showVolume} onCheckedChange={(c) => updateNestedConfig('paintDetails', 'showVolume', c)} />
                                    <Label htmlFor="show_vol">Show Volume</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch id="show_coats" checked={config.paintDetails.showCoats} onCheckedChange={(c) => updateNestedConfig('paintDetails', 'showCoats', c)} />
                                    <Label htmlFor="show_coats">Show Coats</Label>
                                </div>
                                {config.paintPlacement !== 'separate_area' && (
                                    <div className="flex items-center space-x-2">
                                        <Switch id="show_price" checked={config.paintDetails.showPrice} onCheckedChange={(c) => updateNestedConfig('paintDetails', 'showPrice', c)} />
                                        <Label htmlFor="show_price">Show Price</Label>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-4 pt-2">
                            <Label className="text-base">Primer Strategy</Label>
                            <RadioGroup value={config.primerStrategy} onValueChange={(val) => updateConfig('primerStrategy', val)} className="grid grid-cols-2 gap-4">
                                <div className={`flex items-center space-x-2 p-3 rounded border cursor-pointer ${config.primerStrategy === 'separate_line' ? 'border-primary bg-primary/5' : 'border-input'}`}>
                                    <RadioGroupItem value="separate_line" id="sep_line" />
                                    <Label htmlFor="sep_line" className="cursor-pointer">Separate Line</Label>
                                </div>
                                <div className={`flex items-center space-x-2 p-3 rounded border cursor-pointer ${config.primerStrategy === 'combined' ? 'border-primary bg-primary/5' : 'border-input'}`}>
                                    <RadioGroupItem value="combined" id="comb_line" />
                                    <Label htmlFor="comb_line" className="cursor-pointer">Combined (Merged Cost)</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div >
                );

            case 3: // Material Costs
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid gap-4">
                            <Label className="text-base">Placement Strategy</Label>
                            <Select value={config.materialPlacement} onValueChange={(val: any) => updateConfig('materialPlacement', val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inline">In-line (Included in Cost)</SelectItem>
                                    <SelectItem value="subline">Sub-line (Listed below Item)</SelectItem>
                                    <SelectItem value="separate_area">Separate Area (Bottom Section)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>


                        {/* Material Details Toggles Removed as per User Request (Always On) */}



                        {/* Conditional 3.5 */}
                        {config.paintPlacement === 'separate_area' && config.materialPlacement === 'separate_area' && (
                            <div className="pt-4 border-t mt-4">
                                <Label className="text-base text-blue-600 mb-2 block">Separate Area Grouping</Label>
                                <RadioGroup value={config.separateAreaStrategy} onValueChange={(val) => updateConfig('separateAreaStrategy', val)} className="grid grid-cols-2 gap-4">
                                    <div className={`flex items-center space-x-2 p-3 rounded border border-blue-200 bg-blue-50 cursor-pointer`}>
                                        <RadioGroupItem value="combined" id="sep_combined" />
                                        <Label htmlFor="sep_combined" className="cursor-pointer">Combined Section</Label>
                                    </div>
                                    <div className={`flex items-center space-x-2 p-3 rounded border border-blue-200 bg-blue-50 cursor-pointer`}>
                                        <RadioGroupItem value="separate" id="sep_separate" />
                                        <Label htmlFor="sep_separate" className="cursor-pointer">Separate Sections</Label>
                                    </div>
                                </RadioGroup>
                                <p className="text-xs text-muted-foreground mt-2">Since both Paint and Materials are in separate areas, choose how to group them.</p>
                            </div>
                        )}
                    </div>
                );

            case 4: // Fine Tuning
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid gap-6">

                            {/* Moved from Prep Step: Grouping Toggle */}
                            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Group Prep Tasks</Label>
                                    <p className="text-sm text-muted-foreground">Combine all prep tasks into a single line?</p>
                                </div>
                                <Switch
                                    checked={config.prepStrategy === 'group_total'}
                                    onCheckedChange={(c) => updateConfig('prepStrategy', c ? 'group_total' : 'itemized')}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Show Quantities & Rates</Label>
                                    <p className="text-sm text-muted-foreground">Display quantities (500 sqft) and unit prices ($1.00/sqft)?</p>
                                </div>
                                <Switch checked={config.showUnits} onCheckedChange={(c) => {
                                    updateConfig('showUnits', c);
                                    updateConfig('showRates', c);
                                }} />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Show Tax Line</Label>
                                    <p className="text-sm text-muted-foreground">Include a separate line for calculated tax?</p>
                                </div>
                                <Switch checked={config.showTaxLine} onCheckedChange={(c) => updateConfig('showTaxLine', c)} />
                            </div>





                            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Show Disclaimers</Label>
                                    <p className="text-sm text-muted-foreground">Include standard legal disclaimers at bottom?</p>
                                </div>
                                <Switch checked={config.showDisclaimers} onCheckedChange={(c) => updateConfig('showDisclaimers', c)} />
                            </div>


                        </div>
                    </div>
                );
        }
    };



    return (
        <div className="flex gap-6 h-full w-full max-w-7xl mx-auto p-4">
            {/* Wizard Column */}
            <Card className="flex-1 flex flex-col shadow-lg border-2 h-full">
                <CardHeader className="border-b bg-muted/10 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-primary font-bold">
                            {React.createElement(STEPS[step - 1].icon, { className: "w-5 h-5" })}
                            <span className="uppercase tracking-wider text-sm">Step {step} of {STEPS.length}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">CONF-WIZ-v2</span>
                    </div>
                    <CardTitle className="text-2xl">{STEPS[step - 1].title}</CardTitle>
                    <CardDescription className="text-base">{STEPS[step - 1].Description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto pt-6 px-8">
                    {renderStepContent()}
                </CardContent>
                <div className="p-6 border-t bg-muted/10 flex justify-between shrink-0">
                    <Button variant="outline" onClick={step === 1 ? onCancel : handleBack}>
                        {step === 1 ? "Cancel" : "Back"}
                    </Button>
                    <div className="flex gap-2">
                        {step === STEPS.length ? (
                            <Button onClick={handleNext} className="bg-green-600 hover:bg-green-700 w-32">
                                Finish <Check className="ml-2 w-4 h-4" />
                            </Button>
                        ) : (
                            <Button onClick={handleNext} className="w-32">
                                Next <ChevronRight className="ml-2 w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {/* Preview Column */}
            <Card className="flex-1 hidden xl:flex flex-col shadow-lg border-muted h-full bg-slate-50">
                <CardHeader className="border-b bg-white shrink-0 pb-2">
                    <CardTitle className="text-lg text-slate-700">Live Preview</CardTitle>
                    <CardDescription>Real-time quote preview based on current settings.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden">
                    <QuotePreview config={config} />
                </CardContent>
            </Card>
        </div>
    );
}
