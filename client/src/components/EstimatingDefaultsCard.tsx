import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { orgOperations, SupplyRule } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ChevronDown, ChevronUp, Settings2, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { hasPermission, OrgRole } from '@/lib/permissions';

export function EstimatingDefaultsCard() {
    const { currentOrgId, currentOrgRole, currentPermissions, org } = useAuth();
    const { toast } = useToast();
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const [defaults, setDefaults] = useState({
        defaultLaborRate: 60,
        defaultProductionRate: 150,
        defaultCoverage: 350,
        defaultWallCoats: 2,
        defaultCeilingCoats: 2,
        defaultTrimCoats: 2,
        defaultTaxRate: 0,
        defaultTaxLines: [] as Array<{ name: string; rate: number }>,
        defaultPaintBilling: 'billable' as 'billable' | 'expense' | 'provided_by_customer',
        defaultPricePerGallon: 45,
        defaultCostPerGallon: 25,
        deductOpeningsFromLabor: false,
    });

    useEffect(() => {
        if (org && org.estimatingSettings) {
            const settings = { ...org.estimatingSettings };
            // Migration: if we have a legacy rate but no lines, initialize lines
            if (settings.defaultTaxRate && settings.defaultTaxRate > 0 && (!settings.defaultTaxLines || settings.defaultTaxLines.length === 0)) {
                settings.defaultTaxLines = [{ name: 'Tax', rate: settings.defaultTaxRate }];
            }
            if (settings.defaultTaxRate === undefined) {
                settings.defaultTaxRate = 0;
            }
            setDefaults(prev => ({
                ...prev,
                ...settings
            }));
        }
    }, [org]);

    // Updated permission check using centralized logic
    const canEdit = hasPermission(currentPermissions, 'manage_org');

    const handleChange = (key: string, value: any) => {
        setDefaults(prev => ({ ...prev, [key]: value }));
        setIsDirty(true);
    };

    const handleToggle = (key: string, value: boolean) => {
        setDefaults(prev => ({ ...prev, [key]: value }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        if (!currentOrgId) return;
        setIsSaving(true);
        try {
            await orgOperations.update(currentOrgId, {
                estimatingSettings: defaults
            });
            toast({ title: "Settings Saved", description: "Estimating defaults updated successfully." });
            setIsDirty(false);
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Estimating Defaults</CardTitle>
                <CardDescription>Set global defaults for new projects. These values can be overridden per project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Labor Rate ($/hr)</Label>
                        <Input
                            type="number"
                            value={defaults.defaultLaborRate}
                            onChange={(e) => handleChange('defaultLaborRate', parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Production Rate (sq ft/hr)</Label>
                        <Input
                            type="number"
                            value={defaults.defaultProductionRate}
                            onChange={(e) => handleChange('defaultProductionRate', parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                        />
                    </div>
                    {/* Paint Price/Cost Fields */}
                    <div className="space-y-2">
                        <Label>Default Paint Price ($/gal)</Label>
                        <Input
                            type="number"
                            value={defaults.defaultPricePerGallon}
                            onChange={(e) => handleChange('defaultPricePerGallon', parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Default Paint Cost ($/gal)</Label>
                        <Input
                            type="number"
                            value={defaults.defaultCostPerGallon}
                            onChange={(e) => handleChange('defaultCostPerGallon', parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Paint Coverage (sq ft/gal)</Label>
                        <Input
                            type="number"
                            value={defaults.defaultCoverage}
                            onChange={(e) => handleChange('defaultCoverage', parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                        />
                    </div>
                    <div className="space-y-4 md:col-span-2 rounded-lg border p-4 bg-muted/5">
                        <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">Default Tax Settings</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const newLines = [...(defaults.defaultTaxLines || []), { name: 'New Tax', rate: 0 }];
                                    handleChange('defaultTaxLines', newLines);
                                }}
                                disabled={!canEdit}
                                className="h-8 gap-1"
                            >
                                <Plus className="h-3.5 w-3.5" /> Add Tax Entry
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {(!defaults.defaultTaxLines || defaults.defaultTaxLines.length === 0) && (
                                <p className="text-sm text-muted-foreground italic">No default taxes configured.</p>
                            )}
                            {(defaults.defaultTaxLines || []).map((tl, idx) => (
                                <div key={idx} className="flex items-end gap-3 bg-background p-3 rounded-md border shadow-sm">
                                    <div className="flex-1 space-y-1.5">
                                        <Label className="text-xs">Tax Label</Label>
                                        <Input
                                            placeholder="e.g. GST"
                                            value={tl.name}
                                            onChange={(e) => {
                                                const newLines = [...(defaults.defaultTaxLines || [])];
                                                newLines[idx].name = e.target.value;
                                                handleChange('defaultTaxLines', newLines);
                                            }}
                                            disabled={!canEdit}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="w-24 space-y-1.5">
                                        <Label className="text-xs">Rate (%)</Label>
                                        <Input
                                            type="number"
                                            value={tl.rate}
                                            onChange={(e) => {
                                                const newLines = [...(defaults.defaultTaxLines || [])];
                                                newLines[idx].rate = parseFloat(e.target.value) || 0;
                                                handleChange('defaultTaxLines', newLines);
                                            }}
                                            disabled={!canEdit}
                                            className="h-9"
                                        />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => {
                                            const newLines = (defaults.defaultTaxLines || []).filter((_, i) => i !== idx);
                                            handleChange('defaultTaxLines', newLines);
                                        }}
                                        disabled={!canEdit}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Configure granular taxes (e.g. GST + PST) that will be applied to new quotes and invoices by default.
                        </p>
                    </div>
                    <div className="flex flex-col space-y-3 rounded-lg border p-4 shadow-sm md:col-span-2">
                        <div className="space-y-1">
                            <Label>Bill Paint to Customer</Label>
                            <p className="text-sm text-muted-foreground">
                                Determine the default behavior for paint costs on new projects. This can be overridden per room.
                            </p>
                        </div>
                        <Select
                            disabled={!canEdit}
                            value={defaults.defaultPaintBilling || 'billable'}
                            onValueChange={(val) => handleChange('defaultPaintBilling', val)}
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
                    </div>
                </div>

                <div className="space-y-4 rounded-lg border p-4 bg-muted/5">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Default Coats
                    </h3>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Wall Coats</Label>
                            <Input
                                type="number"
                                value={defaults.defaultWallCoats}
                                onChange={(e) => handleChange('defaultWallCoats', parseInt(e.target.value) || 0)}
                                disabled={!canEdit}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Ceiling Coats</Label>
                            <Input
                                type="number"
                                value={defaults.defaultCeilingCoats}
                                onChange={(e) => handleChange('defaultCeilingCoats', parseInt(e.target.value) || 0)}
                                disabled={!canEdit}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Trim Coats</Label>
                            <Input
                                type="number"
                                value={defaults.defaultTrimCoats}
                                onChange={(e) => handleChange('defaultTrimCoats', parseInt(e.target.value) || 0)}
                                disabled={!canEdit}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col space-y-3 rounded-lg border p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <Label>Deduct Openings from Labor Hours</Label>
                            <p className="text-sm text-muted-foreground">
                                If enabled, door/window openings will reduce estimated labor hours. Most painters leave this off — cutting-in time around openings offsets the saved rolling area.
                            </p>
                        </div>
                        <Switch
                            checked={defaults.deductOpeningsFromLabor || false}
                            onCheckedChange={(checked) => handleToggle('deductOpeningsFromLabor', checked)}
                            disabled={!canEdit}
                        />
                    </div>
                </div>

                {!canEdit && (
                    <p className="text-sm text-muted-foreground italic">
                        Only organization owners and admins can modify these defaults.
                    </p>
                )}
            </CardContent>
            {canEdit && (
                <CardFooter className="border-t px-6 py-4">
                    <Button onClick={handleSave} disabled={isSaving} className={isDirty ? 'bg-amber-600 hover:bg-amber-700' : ''}>
                        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        {isDirty ? 'Save Changes ●' : 'Save Settings'}
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
