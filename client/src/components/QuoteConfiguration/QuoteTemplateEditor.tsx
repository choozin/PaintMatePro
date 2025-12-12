import React, { useState } from 'react';
import { QuoteTemplate, QuoteDisplayConfig } from '@/lib/firestore';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Wand2, Save } from "lucide-react";

interface QuoteTemplateEditorProps {
    template: QuoteTemplate;
    onSave: (template: QuoteTemplate) => void;
    onLaunchWizard: (template: QuoteTemplate) => void;
    existingNames: string[];
}

export function QuoteTemplateEditor({ template, onSave, onLaunchWizard, existingNames }: QuoteTemplateEditorProps) {
    const [name, setName] = useState(template.name);
    const [config, setConfig] = useState<QuoteDisplayConfig>(template.config);
    const [error, setError] = useState('');

    const updateConfig = (key: keyof QuoteDisplayConfig, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        if (!name.trim()) {
            setError('Name is required');
            return;
        }
        if (existingNames.includes(name.trim().toLowerCase()) && name.trim().toLowerCase() !== template.name.toLowerCase()) {
            setError('Name already exists');
            return;
        }

        onSave({ ...template, name, config });
    };

    return (
        <div className="space-y-6 py-4">
            <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                    value={name}
                    onChange={e => { setName(e.target.value); setError(''); }}
                    className={error ? 'border-red-500' : ''}
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Core Settings */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-gray-900 border-b pb-1">Core Config</h3>

                    <div className="space-y-2">
                        <Label className="text-xs">Organization</Label>
                        <Select value={config.organization} onValueChange={v => updateConfig('organization', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="room">By Room</SelectItem>
                                <SelectItem value="surface">By Surface</SelectItem>
                                <SelectItem value="floor">By Floor</SelectItem>
                                <SelectItem value="phase">By Phase</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs">Structure</Label>
                        <Select value={config.itemComposition} onValueChange={v => updateConfig('itemComposition', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bundled">Bundled</SelectItem>
                                <SelectItem value="separated">Separated</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs">Labor Pricing</Label>
                        <Select value={config.laborPricingModel} onValueChange={v => updateConfig('laborPricingModel', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unit_sqft">Unit Price (Sq Ft)</SelectItem>
                                <SelectItem value="fixed">Fixed Price</SelectItem>
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="day_rate">Day Rate</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs">Material Strategy</Label>
                        <Select
                            value={config.materialStrategy}
                            onValueChange={(v: any) => updateConfig('materialStrategy', v)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="inclusive">Inclusive (Hidden)</SelectItem>
                                <SelectItem value="allowance">Allowance</SelectItem>
                                <SelectItem value="itemized_volume">Itemized (Volume)</SelectItem>
                                <SelectItem value="specific_product">Specific Product</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {config.itemComposition !== 'bundled' && config.materialStrategy !== 'inclusive' && (
                        <div className="space-y-2">
                            <Label className="text-xs">Material Grouping</Label>
                            <Select
                                value={config.materialGrouping || 'itemized_per_task'}
                                onValueChange={(v: any) => updateConfig('materialGrouping', v)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="itemized_per_task">Itemized Per Task</SelectItem>
                                    <SelectItem value="combined_section">Combined Section (Bottom)</SelectItem>
                                    <SelectItem value="combined_setup">Combined in Setup</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* Toggles */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-gray-900 border-b pb-1">Display Options</h3>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Show Quantities</Label>
                            <Switch checked={config.showQuantities} onCheckedChange={c => updateConfig('showQuantities', c)} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Show Rates</Label>
                            <Switch checked={config.showRates} onCheckedChange={c => updateConfig('showRates', c)} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Show Coats</Label>
                            <Switch checked={config.showCoatCounts} onCheckedChange={c => updateConfig('showCoatCounts', c)} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Show Prep Details</Label>
                            <Switch checked={config.showPrepTasks} onCheckedChange={c => updateConfig('showPrepTasks', c)} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Show Tax</Label>
                            <Switch checked={config.showTaxLine} onCheckedChange={c => updateConfig('showTaxLine', c)} />
                        </div>
                    </div>
                </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border">
                <div>
                    <h4 className="font-semibold text-sm">Visual Wizard</h4>
                    <p className="text-xs text-muted-foreground">Use the step-by-step wizard for a preview-based experience.</p>
                </div>
                <Button variant="outline" onClick={() => onLaunchWizard({ ...template, name, config })}>
                    <Wand2 className="w-4 h-4 mr-2" /> Open Wizard
                </Button>
            </div>

            <div className="flex justify-end pt-2">
                <Button onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" /> Save Changes
                </Button>
            </div>
        </div>
    );
}
