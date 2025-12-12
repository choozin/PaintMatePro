import React, { useState } from "react";
import { QuoteDisplayConfig, QuoteTemplate } from "@/lib/firestore";
import { DEFAULT_QUOTE_CONFIG } from "@/lib/quote-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuotePreview } from "./QuotePreview";
import { useAuth } from "@/contexts/AuthContext";
import { orgOperations } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Save, Layout, Smartphone, Monitor, Info, ZoomIn, ZoomOut } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface QuoteConfigWizardProps {
    existingTemplates?: QuoteTemplate[];
    activeTemplate?: QuoteTemplate; // For editing
    onClose?: () => void;
}

const WIZARD_STEPS = [
    { id: 1, title: 'Organization', desc: 'How items are grouped' },
    { id: 2, title: 'Detail Level', desc: 'Splitting items' },
    { id: 3, title: 'Labor Pricing', desc: 'Showing labor costs' },
    { id: 4, title: 'Materials', desc: 'Showing supply costs' },
    { id: 5, title: 'Refinements', desc: 'Final touches' }
];

const TIP_CONTENT: Record<string, string> = {
    // 1. Organization
    'org_room': "Most common for Residential. Homeowners understand 'Living Room' better than '1,500 sq ft of Wall'.",
    'org_surface': "Best for Commercial or simple Repaints. Groups all 'Walls' together for a cleaner, production-focused look.",
    'org_floor': "Good for large estates or multi-unit projects. Keeps the quote from getting too long.",
    'org_phase': "Ideal for restoration jobs. Separates 'Prep Work' items from 'Finishing' items clearly.",

    // 2. Composition
    'comp_bundled': "Simplest for the client. One line per task (Labor + Materials included). Less questions about 'why is paint so expensive?'.",
    'comp_separated': "Classic Contractor style. Shows exactly what is Labor vs Materials. Builds trust for cost-plus or T&M jobs.",
    'comp_granular': "High-end detail. Breaks down 'Prep', 'Prime', and 'Finish' into separate lines. Not fully active but good placeholder.",

    // 3. Labor Pricing
    'labor_fixed': "The Safe Bet. Clients like a firm number. 'One price to do the job'.",
    'labor_hourly': "Transparent. Good for small jobs or when scope is unclear. Shows estimated hours.",
    'labor_sqft': "Commercial Standard. Shows production rates ($1.50/sqft). Can feel impersonal for homeowners.",
    'labor_day': "Crew Booking. '2 Days @ $1200/day'. Good for small quick turns.",

    // 4. Material Strategy
    'mat_inclusive': "Hidden. Material cost is built into the labor line. Cleanest look.",
    'mat_allowance': "Flexible. 'We allow $500 for paint'. Good if colors/products aren't picked yet.",
    'mat_volume': "Detailed. '15 Gallons @ $45'. Shows you aren't marking up paint too much.",
    'mat_product': "Premium. 'Benjamin Moore Aura'. Shows value by brand naming.",

    // 4b. Material Grouping
    'group_itemized': "Each task gets its own material line. 'Paint Living Room'. Good for detail.",
    'group_section': "Clean list at the bottom. 'Materials Section'. Keeps the room list focused on labor.",
    'group_setup': "Bundles materials into the Setup cost. Good for hiding small material costs.",
    'group_hidden': "No separate line. Cost is merged into labor.",
};

export function QuoteConfigWizard({ existingTemplates = [], activeTemplate, onClose }: QuoteConfigWizardProps) {
    const { currentOrgId } = useAuth();
    const { toast } = useToast();

    // State
    const [step, setStep] = useState(1);
    const [templateName, setTemplateName] = useState(activeTemplate?.name || "Standard Quote");
    const [config, setConfig] = useState<QuoteDisplayConfig>(activeTemplate?.config || DEFAULT_QUOTE_CONFIG);
    const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
    const [zoomLevel, setZoomLevel] = useState(0.55); // Start zoomed out to fit 8.5x11

    // Navigation Helper
    const getNextStep = (current: number, direction: 'forward' | 'backward') => {
        let candidate = direction === 'forward' ? current + 1 : current - 1;

        // Logic: If 'Bundled', Skip Step 4 (Materials)
        if (candidate === 4 && config.itemComposition === 'bundled') {
            candidate = direction === 'forward' ? 5 : 3;
        }

        return candidate;
    };

    const handleStepChange = (direction: 'forward' | 'backward') => {
        const next = getNextStep(step, direction);
        if (next >= 1 && next <= 5) {
            setStep(next);
        }
    };

    // HELPERS
    const updateConfig = (key: keyof QuoteDisplayConfig, value: any) => {
        setConfig(prev => {
            const next = { ...prev, [key]: value };

            if (key === 'itemComposition' && value === 'bundled') {
                next.materialStrategy = 'inclusive';
            }
            return next;
        });
    };

    const handleSave = async () => {
        if (!currentOrgId) return;
        try {
            const org = await orgOperations.get(currentOrgId);
            if (!org) return;

            // Validation: Unique Name
            const nameExists = existingTemplates.some(t =>
                t.name.toLowerCase() === templateName.trim().toLowerCase() &&
                t.id !== activeTemplate?.id
            );

            if (nameExists) {
                toast({ variant: "destructive", title: "Name Taken", description: "Please choose a unique name for this template." });
                return;
            }

            const newTemplate: QuoteTemplate = {
                id: activeTemplate?.id || crypto.randomUUID(),
                name: templateName,
                config: config,
                isDefault: activeTemplate?.isDefault || (org.quoteTemplates?.length || 0) === 0
            };

            // Update or Add
            let updatedTemplates = [...(org.quoteTemplates || [])];
            if (activeTemplate) {
                updatedTemplates = updatedTemplates.map(t => t.id === activeTemplate.id ? newTemplate : t);
            } else {
                updatedTemplates.push(newTemplate);
            }

            await orgOperations.update(currentOrgId, { quoteTemplates: updatedTemplates });

            toast({ title: "Template Saved", description: `${templateName} has been saved.` });
            if (onClose) onClose();
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error", description: "Failed to save template." });
        }
    };

    // RENDER HELPERS
    const RadioOption = ({
        label,
        value,
        currentValue,
        onChange,
        tipKey
    }: { label: string, value: string, currentValue: string, onChange: (v: string) => void, tipKey: string }) => (
        <div
            className={`
                relative border rounded-lg p-4 cursor-pointer transition-all flex items-start gap-3
                ${currentValue === value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-gray-300 bg-white'}
            `}
            onClick={() => onChange(value)}
        >
            <div className={`mt-1 h-4 w-4 rounded-full border border-primary flex items-center justify-center ${currentValue === value ? 'bg-primary' : ''}`}>
                {currentValue === value && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
            </div>
            <div className="flex-1">
                <div className="font-semibold text-sm">{label}</div>
                <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed pr-2">
                    {TIP_CONTENT[tipKey]}
                </div>
            </div>
        </div>
    );

    const renderStepContent = () => {
        switch (step) {
            case 1: // Organization
                return (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <Label className="text-base">How do you want to group items?</Label>
                            <div className="grid grid-cols-1 gap-3">
                                <RadioOption label="By Room (Location)" value="room" currentValue={config.organization} onChange={(v) => updateConfig('organization', v)} tipKey="org_room" />
                                <RadioOption label="By Surface (Activity)" value="surface" currentValue={config.organization} onChange={(v) => updateConfig('organization', v)} tipKey="org_surface" />
                                <RadioOption label="By Floor / Level" value="floor" currentValue={config.organization} onChange={(v) => updateConfig('organization', v)} tipKey="org_floor" />
                                <RadioOption label="By Project Phase" value="phase" currentValue={config.organization} onChange={(v) => updateConfig('organization', v)} tipKey="org_phase" />
                            </div>
                        </div>
                    </div>
                );
            case 2: // Composition
                return (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <Label className="text-base">How should line items be split?</Label>
                            <div className="grid grid-cols-1 gap-3">
                                <RadioOption label="Bundled (Simple)" value="bundled" currentValue={config.itemComposition} onChange={(v) => updateConfig('itemComposition', v)} tipKey="comp_bundled" />
                                <RadioOption label="Separated (Labor & Materials)" value="separated" currentValue={config.itemComposition} onChange={(v) => updateConfig('itemComposition', v)} tipKey="comp_separated" />
                                {/* <RadioOption label="Granular (Prep vs Finish)" value="granular" currentValue={config.itemComposition} onChange={(v) => updateConfig('itemComposition', v)} tipKey="comp_granular" /> */}
                            </div>
                        </div>
                    </div>
                );
            case 3: // Labor Pricing
                return (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <Label className="text-base">How should Labor be priced?</Label>
                            <div className="grid grid-cols-1 gap-3">
                                <RadioOption label="Unit Price (Per Sq Ft)" value="unit_sqft" currentValue={config.laborPricingModel} onChange={(v) => updateConfig('laborPricingModel', v)} tipKey="labor_sqft" />
                                <RadioOption label="Fixed Price (Lump Sum)" value="fixed" currentValue={config.laborPricingModel} onChange={(v) => updateConfig('laborPricingModel', v)} tipKey="labor_fixed" />
                                <RadioOption label="Hourly Estimate" value="hourly" currentValue={config.laborPricingModel} onChange={(v) => updateConfig('laborPricingModel', v)} tipKey="labor_hourly" />
                                <RadioOption label="Day Rate" value="day_rate" currentValue={config.laborPricingModel} onChange={(v) => updateConfig('laborPricingModel', v)} tipKey="labor_day" />
                            </div>
                        </div>
                    </div>
                );
            case 4: // Materials
                const isBundled = config.itemComposition === 'bundled';
                return (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <Label className="text-base">How should Materials be shown?</Label>
                            {isBundled && (
                                <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm mb-2 flex items-start gap-2">
                                    <Info className="w-4 h-4 mt-0.5" />
                                    Since you selected "Bundled", materials are included in the main line item. You can choose to just hide them or add bottom-line allowances.
                                </div>
                            )}
                            <div className="grid grid-cols-1 gap-3">
                                <RadioOption label="Inclusive (Hidden)" value="inclusive" currentValue={config.materialStrategy} onChange={(v) => updateConfig('materialStrategy', v)} tipKey="mat_inclusive" />
                                <RadioOption label="Lump Sum Allowance" value="allowance" currentValue={config.materialStrategy} onChange={(v) => updateConfig('materialStrategy', v)} tipKey="mat_allowance" />
                                <RadioOption label="Itemized by Vol" value="itemized_volume" currentValue={config.materialStrategy} onChange={(v) => updateConfig('materialStrategy', v)} tipKey="mat_volume" />
                                <RadioOption label="Specific Product" value="specific_product" currentValue={config.materialStrategy} onChange={(v) => updateConfig('materialStrategy', v)} tipKey="mat_product" />
                            </div>

                            {!isBundled && config.materialStrategy !== 'inclusive' && (
                                <div className="mt-6 pt-4 border-t">
                                    <Label className="text-base mb-3 block">Material Layout</Label>
                                    <div className="grid grid-cols-1 gap-3">
                                        <RadioOption label="Next to Task (Itemized)" value="itemized_per_task" currentValue={config.materialGrouping || 'itemized_per_task'} onChange={(v) => updateConfig('materialGrouping', v)} tipKey="group_itemized" />
                                        <RadioOption label="Bottom Section (Combined)" value="combined_section" currentValue={config.materialGrouping || 'itemized_per_task'} onChange={(v) => updateConfig('materialGrouping', v)} tipKey="group_section" />
                                        <RadioOption label="Bundle into Setup" value="combined_setup" currentValue={config.materialGrouping || 'itemized_per_task'} onChange={(v) => updateConfig('materialGrouping', v)} tipKey="group_setup" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 5: // Details
                return (
                    <div className="space-y-6">
                        <Label className="text-base">Fine Tuning</Label>
                        <div className="space-y-4 bg-white rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <Label>Show Coat Counts</Label>
                                <Switch checked={config.showCoatCounts} onCheckedChange={(c) => updateConfig('showCoatCounts', c)} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <Label>Show Prep Tasks</Label>
                                <Switch checked={config.showPrepTasks} onCheckedChange={(c) => updateConfig('showPrepTasks', c)} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <Label>Show Quantities & Units</Label>
                                <Switch checked={config.showQuantities} onCheckedChange={(c) => updateConfig('showQuantities', c)} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <Label>Show Rates</Label>
                                <Switch checked={config.showRates} onCheckedChange={(c) => updateConfig('showRates', c)} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <Label>Show Colors (If selected)</Label>
                                <Switch checked={config.showColors} onCheckedChange={(c) => updateConfig('showColors', c)} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <Label>Show Subtotals</Label>
                                <Switch checked={config.showSubtotals} onCheckedChange={(c) => updateConfig('showSubtotals', c)} />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <Label>Show Tax Line</Label>
                                <Switch checked={config.showTaxLine} onCheckedChange={(c) => updateConfig('showTaxLine', c)} />
                            </div>
                            <div className="pt-2 text-xs text-muted-foreground">
                                * Toggling these details does not change the Total Price.
                            </div>
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
            <div className="fixed inset-0 bg-white flex flex-col md:flex-row h-full w-full">

                {/* Left Panel: Wizard Controls (Mobile: Top) */}
                <div className={`
                    w-full md:w-[450px] lg:w-[500px] flex flex-col border-r bg-gray-50/50
                    ${mobileTab === 'preview' ? 'hidden md:flex' : 'flex'}
                `}>
                    {/* Header */}
                    <div className="p-6 border-b bg-white">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex-1 mr-4">
                                <Label className="text-xs text-muted-foreground mb-1 block">Template Name</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={templateName}
                                        onChange={e => setTemplateName(e.target.value)}
                                        placeholder="My Template"
                                        className="h-8 text-sm"
                                    />
                                    <Button size="sm" onClick={handleSave} className="h-8 px-3">
                                        <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                                    </Button>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
                                <span className="sr-only">Close</span>
                                <span className="text-xl">×</span>
                            </Button>
                        </div>

                        {/* Progress */}
                        <div className="flex items-center gap-1 mt-2">
                            {WIZARD_STEPS.map(s => {
                                // Clickable Step
                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => setStep(s.id)}
                                        className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer hover:bg-primary/50 ${s.id <= step ? 'bg-primary' : 'bg-gray-200'}`}
                                        title={`Go to ${s.title}`}
                                    />
                                )
                            })}
                        </div>
                        <div className="text-xs font-semibold text-primary mt-2 uppercase tracking-wide">
                            Step {step}: {WIZARD_STEPS[step - 1].title}
                        </div>
                    </div>

                    {/* Step Content Area */}
                    <ScrollArea className="flex-1 p-6">
                        {renderStepContent()}
                    </ScrollArea>

                    {/* Footer Nav */}
                    <div className="p-6 border-t bg-white flex justify-between items-center">
                        <Button
                            variant="outline"
                            onClick={() => handleStepChange('backward')}
                            disabled={step === 1}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back
                        </Button>

                        {step < 5 ? (
                            <Button onClick={() => handleStepChange('forward')}>
                                Next <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button variant="ghost" disabled>
                                End of Wizard
                            </Button>
                        )}
                    </div>
                </div>

                {/* Right Panel: Live Preview */}
                <div className={`
                    flex-1 bg-muted/30 p-4 md:p-8 overflow-hidden flex flex-col relative
                    ${mobileTab === 'edit' ? 'hidden md:flex' : 'flex'}
                `}>
                    <div className="mb-4 flex justify-between items-center z-10 relative">
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Monitor className="w-4 h-4" /> Live Preview
                        </span>

                        {/* Zoom Controls */}
                        <div className="flex items-center gap-2 bg-white rounded-md shadow-sm border p-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoomLevel(Math.max(0.3, zoomLevel - 0.1))}>
                                <ZoomOut className="w-3 h-3" />
                            </Button>
                            <span className="text-xs font-mono w-8 text-center">{Math.round(zoomLevel * 100)}%</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoomLevel(Math.min(1.5, zoomLevel + 0.1))}>
                                <ZoomIn className="w-3 h-3" />
                            </Button>
                        </div>

                        {/* Mobile Toggle */}
                        <div className="md:hidden flex bg-white rounded-lg border p-1 ml-2">
                            <Button size="sm" variant={mobileTab === 'edit' ? 'secondary' : 'ghost'} onClick={() => setMobileTab('edit')}>Edit</Button>
                            <Button size="sm" variant={mobileTab === 'preview' ? 'secondary' : 'ghost'} onClick={() => setMobileTab('preview')}>Preview</Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto flex justify-center bg-gray-100/50 rounded-xl border border-dashed relative">
                        <div
                            className="origin-top my-8 transition-transform duration-200 ease-out"
                            style={{ transform: `scale(${zoomLevel})` }}
                        >
                            <QuotePreview config={config} variant="residential" />
                        </div>
                    </div>
                </div>

                {/* Mobile Bottom Bar */}
                <div className="md:hidden border-t bg-white p-2 flex justify-around">
                    <Button variant={mobileTab === 'edit' ? 'default' : 'ghost'} className="flex-1" onClick={() => setMobileTab('edit')}>
                        <Layout className="w-4 h-4 mr-2" /> Options
                    </Button>
                    <Button variant={mobileTab === 'preview' ? 'default' : 'ghost'} className="flex-1" onClick={() => setMobileTab('preview')}>
                        <Smartphone className="w-4 h-4 mr-2" /> Preview
                    </Button>
                </div>
            </div>
        </div>
    );
}
