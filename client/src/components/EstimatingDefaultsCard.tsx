import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from "@/components/ui/switch";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { orgOperations, SupplyRule } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SupplyRulesEditor } from './SupplyRulesEditor';

export function EstimatingDefaultsCard() {
    const { currentOrgId, currentOrgRole } = useAuth();
    const { toast } = useToast();
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    const [defaults, setDefaults] = useState({
        defaultLaborRate: 60,
        defaultProductionRate: 150,
        defaultCoverage: 350,
        defaultWallCoats: 2,
        defaultCeilingCoats: 2,
        defaultTrimCoats: 2,
        defaultTaxRate: 0,
        defaultBillablePaint: true,
    });

    const [supplyRules, setSupplyRules] = useState<SupplyRule[]>([]);

    const canEdit = currentOrgRole === 'owner' || currentOrgRole === 'admin';

    useEffect(() => {
        if (!currentOrgId) return;

        async function loadDefaults() {
            if (!currentOrgId) return;
            setIsLoading(true);
            try {
                const org = await orgOperations.get(currentOrgId);
                if (org?.estimatingSettings) {
                    setDefaults(prev => ({
                        ...prev,
                        ...org.estimatingSettings
                    }));
                }
                if (org?.supplyRules) {
                    setSupplyRules(org.supplyRules);
                }
            } catch (error) {
                console.error("Failed to load defaults", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to load estimating defaults."
                });
            } finally {
                setIsLoading(false);
            }
        }

        loadDefaults();
    }, [currentOrgId, toast]);

    const handleSave = async () => {
        if (!currentOrgId) return;
        setIsSaving(true);
        try {
            await orgOperations.update(currentOrgId, {
                estimatingSettings: defaults,
                supplyRules: supplyRules
            });
            toast({
                title: "Settings Saved",
                description: "Organization estimating defaults updated successfully."
            });
        } catch (error) {
            console.error("Failed to save defaults", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to save settings."
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (key: string, value: number) => {
        setDefaults(prev => ({ ...prev, [key]: value }));
    };

    const handleToggle = (key: string, value: boolean) => {
        setDefaults(prev => ({ ...prev, [key]: value }));
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Default Project Settings</CardTitle>
                    <CardDescription>Loading settings...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Default Project Settings</CardTitle>
                <CardDescription>
                    Set the baseline values for new projects. These can be overridden on a per-project basis.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Default Labor Rate ($/hr)</Label>
                        <Input
                            type="number"
                            value={defaults.defaultLaborRate}
                            onChange={(e) => handleChange('defaultLaborRate', parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Default Wall Speed (sq ft/hr)</Label>
                        <Input
                            type="number"
                            value={defaults.defaultProductionRate}
                            onChange={(e) => handleChange('defaultProductionRate', parseFloat(e.target.value) || 0)}
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
                    <div className="space-y-2">
                        <Label>Default Tax Rate (%)</Label>
                        <Input
                            type="number"
                            value={defaults.defaultTaxRate}
                            onChange={(e) => handleChange('defaultTaxRate', parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                        />
                    </div>
                    <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm md:col-span-2">
                        <div className="space-y-0.5">
                            <Label>Bill Paint to Customer</Label>
                            <p className="text-sm text-muted-foreground">
                                If enabled, paint costs will be included in the quote total. If disabled, paint is treated as non-billable (internal cost only).
                            </p>
                        </div>
                        <Switch
                            checked={defaults.defaultBillablePaint ?? true}
                            onCheckedChange={(c) => handleToggle('defaultBillablePaint', c)}
                            disabled={!canEdit}
                        />
                    </div>
                </div>

                <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen} className="border rounded-lg p-4 bg-muted/5">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between p-0 h-auto hover:bg-transparent">
                            <div className="flex items-center gap-2 font-semibold">
                                <Settings2 className="h-4 w-4" />
                                Advanced Configuration
                            </div>
                            {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-6 pt-4">
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

                        <div className="pt-4 border-t">
                            <SupplyRulesEditor
                                rules={supplyRules}
                                onChange={setSupplyRules}
                                disabled={!canEdit}
                            />
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                {!canEdit && (
                    <p className="text-sm text-muted-foreground italic">
                        Only organization owners and admins can modify these defaults.
                    </p>
                )}
            </CardContent>
            {
                canEdit && (
                    <CardFooter className="border-t px-6 py-4">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Settings
                        </Button>
                    </CardFooter>
                )
            }
        </Card >
    );
}
