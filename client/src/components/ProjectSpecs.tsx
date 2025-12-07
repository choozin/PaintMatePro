import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProject, useUpdateProject } from "@/hooks/useProjects";
import { useRooms } from "@/hooks/useRooms";
import { Settings2, Save, Loader2, RotateCcw, MoreVertical, Clock, CheckCircle2, DollarSign } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { orgOperations } from "@/lib/firestore";
import { useDebounce } from "@/hooks/useDebounce";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

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
}

interface ProjectSpecsProps {
    projectId: string;
}

export function ProjectSpecs({ projectId }: ProjectSpecsProps) {
    const { data: project, isLoading: isLoadingProject } = useProject(projectId);
    const { data: rooms } = useRooms(projectId);
    const updateProject = useUpdateProject();
    const { currentOrgId } = useAuth();
    const { toast } = useToast();

    // Track if we are in the initial load phase to prevent auto-save on mount
    const isInitialLoad = useRef(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Configuration State
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
    });

    // Labor State
    const [laborConfig, setLaborConfig] = useState({
        hourlyRate: 60,
        productionRate: 150,
        ceilingProductionRate: 100,
        difficultyFactor: 1.0,
    });

    // Debounced Values
    const debouncedConfig = useDebounce(config, 1000);
    const debouncedLaborConfig = useDebounce(laborConfig, 1000);

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
                        difficultyFactor: project.laborConfig?.difficultyFactor || 1.0
                    }));
                } else if (currentOrgId && !project.supplyConfig) {
                    // Fallback to Org Defaults
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
                            }));
                            setLaborConfig(prev => ({
                                ...prev,
                                hourlyRate: s.defaultLaborRate || 60,
                                productionRate: s.defaultProductionRate || 150,
                            }));
                        }
                    } catch (e) {
                        console.error("Failed to load org defaults", e);
                    }
                }
                // Mark initial load as complete after a short delay to allow state to settle
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
                await updateProject.mutateAsync({
                    id: projectId,
                    data: {
                        supplyConfig: {
                            ...debouncedConfig,
                            deductionExactSqFt: Number(debouncedConfig.deductionExactSqFt) || 0
                        },
                        laborConfig: debouncedLaborConfig
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
    }, [debouncedConfig, debouncedLaborConfig]);

    const handleConfigChange = (key: keyof PaintConfig, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleLaborChange = (key: string, value: number) => {
        setLaborConfig(prev => ({ ...prev, [key]: value }));
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
                }));
                setLaborConfig(prev => ({
                    ...prev,
                    hourlyRate: s.defaultLaborRate || 60,
                    productionRate: s.defaultProductionRate || 150,
                }));
                toast({ title: "Reset Complete", description: "Loaded organization defaults." });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Reset Failed", description: "Could not load defaults." });
        }
    };

    if (isLoadingProject) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Paint Configuration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Settings2 className="h-5 w-5" />
                            Paint Configuration
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {/* Auto-Save Indicator */}
                            <div className="flex items-center text-xs text-muted-foreground transition-all duration-300">
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
                    <CardDescription>Define scope, coverage, and coats.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Price & Coverage */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label>Paint Price ($/gal)</Label>
                                <span className="text-sm text-muted-foreground">${config.pricePerGallon || 45}</span>
                            </div>
                            <Slider
                                value={[config.pricePerGallon || 45]}
                                min={20}
                                max={150}
                                step={1}
                                onValueChange={([val]) => handleConfigChange('pricePerGallon', val)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label>Coverage (sq ft/gal)</Label>
                                <span className="text-sm text-muted-foreground">{config.coveragePerGallon}</span>
                            </div>
                            <Slider
                                value={[config.coveragePerGallon]}
                                min={200}
                                max={500}
                                step={10}
                                onValueChange={([val]) => handleConfigChange('coveragePerGallon', val)}
                            />
                        </div>
                    </div>

                    <Separator />

                    {/* Scope Switches */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="wall-coats">Wall Coats</Label>
                            <Input
                                id="wall-coats"
                                type="number"
                                className="w-20 h-8"
                                value={config.wallCoats}
                                onChange={(e) => handleConfigChange('wallCoats', parseInt(e.target.value) || 0)}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Primer</Label>
                                <p className="text-xs text-muted-foreground">Add 1 coat of primer</p>
                            </div>
                            <Switch
                                checked={config.includePrimer}
                                onCheckedChange={(checked) => handleConfigChange('includePrimer', checked)}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Ceilings</Label>
                                <p className="text-xs text-muted-foreground">Include ceiling paint</p>
                            </div>
                            <Switch
                                checked={config.includeCeiling}
                                onCheckedChange={(checked) => handleConfigChange('includeCeiling', checked)}
                            />
                        </div>
                        {config.includeCeiling && (
                            <div className="space-y-3 pl-4 border-l-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm">Ceiling Coats</Label>
                                    <Input
                                        type="number"
                                        className="w-16 h-7 text-sm"
                                        value={config.ceilingCoats}
                                        onChange={(e) => handleConfigChange('ceilingCoats', parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm">Use Wall Paint?</Label>
                                        <p className="text-[10px] text-muted-foreground">Combine with walls</p>
                                    </div>
                                    <Switch
                                        checked={config.ceilingSamePaint}
                                        onCheckedChange={(checked) => handleConfigChange('ceilingSamePaint', checked)}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Trim & Baseboards</Label>
                                <p className="text-xs text-muted-foreground">Est. based on perimeter</p>
                            </div>
                            <Switch
                                checked={config.includeTrim}
                                onCheckedChange={(checked) => handleConfigChange('includeTrim', checked)}
                            />
                        </div>
                        {config.includeTrim && (
                            <div className="flex items-center justify-between pl-4 border-l-2">
                                <Label className="text-sm">Trim Coats</Label>
                                <Input
                                    type="number"
                                    className="w-16 h-7 text-sm"
                                    value={config.trimCoats}
                                    onChange={(e) => handleConfigChange('trimCoats', parseInt(e.target.value) || 0)}
                                />
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Deductions */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center mb-2">
                            <Label>Deductions (Windows/Doors)</Label>
                            <div className="flex items-center gap-2 bg-muted p-1 rounded-md">
                                <button
                                    className={`text-xs px-2 py-0.5 rounded ${config.deductionMethod !== 'exact' ? 'bg-white shadow-sm' : ''}`}
                                    onClick={() => handleConfigChange('deductionMethod', 'percent')}
                                >
                                    %
                                </button>
                                <button
                                    className={`text-xs px-2 py-0.5 rounded ${config.deductionMethod === 'exact' ? 'bg-white shadow-sm' : ''}`}
                                    onClick={() => handleConfigChange('deductionMethod', 'exact')}
                                >
                                    Sq Ft
                                </button>
                            </div>
                        </div>

                        {config.deductionMethod === 'exact' ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={config.deductionExactSqFt ?? ''}
                                    onChange={(e) => handleConfigChange('deductionExactSqFt', e.target.value)}
                                    className="h-8"
                                />
                                <span className="text-sm text-muted-foreground whitespace-nowrap">sq ft</span>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-xs text-muted-foreground">Percent Deduction</span>
                                    <span className="text-sm text-muted-foreground">{(config.deductionFactor * 100).toFixed(0)}%</span>
                                </div>
                                <Slider
                                    value={[config.deductionFactor]}
                                    min={0}
                                    max={0.5}
                                    step={0.05}
                                    onValueChange={([val]) => handleConfigChange('deductionFactor', val)}
                                />
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Labor Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Labor Settings
                    </CardTitle>
                    <CardDescription>Set rates and production speeds.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Hourly Rate ($)</Label>
                            <Input
                                type="number"
                                value={laborConfig.hourlyRate}
                                onChange={(e) => handleLaborChange('hourlyRate', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Wall Speed (sq ft/hr)</Label>
                            <Input
                                type="number"
                                value={laborConfig.productionRate}
                                onChange={(e) => handleLaborChange('productionRate', parseFloat(e.target.value) || 0)}
                            />
                            <p className="text-xs text-muted-foreground">Average square footage painted per hour.</p>
                        </div>
                        {config.includeCeiling && (
                            <div className="space-y-2">
                                <Label>Ceiling Speed (sq ft/hr)</Label>
                                <Input
                                    type="number"
                                    value={laborConfig.ceilingProductionRate}
                                    onChange={(e) => handleLaborChange('ceilingProductionRate', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Difficulty Factor (Multiplier)</Label>
                            <div className="flex items-center gap-4">
                                <Slider
                                    value={[laborConfig.difficultyFactor]}
                                    min={0.5}
                                    max={2.0}
                                    step={0.1}
                                    className="flex-1"
                                    onValueChange={([val]) => handleLaborChange('difficultyFactor', val)}
                                />
                                <span className="w-12 text-sm font-medium text-right">{laborConfig.difficultyFactor}x</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Adjust for complex layouts or conditions.</p>
                        </div>

                        {/* Labor Cost Estimate */}
                        <div className="pt-4 border-t">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-green-600" />
                                    Estimated Labor
                                </span>
                                <span className="text-xl font-bold text-green-700">
                                    ${(() => {
                                        if (!rooms) return "0.00";

                                        // Calculate stats (simplified version of SupplyList logic)
                                        const stats = rooms.reduce((acc, room) => {
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

                                        // Net Wall Area
                                        let netWallArea = stats.totalWallArea;
                                        if (config.deductionMethod === 'exact') {
                                            netWallArea = Math.max(0, stats.totalWallArea - (Number(config.deductionExactSqFt) || 0));
                                        } else {
                                            netWallArea = stats.totalWallArea * (1 - config.deductionFactor);
                                        }

                                        // Hours Calculation
                                        const wallHours = netWallArea / laborConfig.productionRate;

                                        let ceilingHours = 0;
                                        if (config.includeCeiling) {
                                            const rate = laborConfig.ceilingProductionRate || laborConfig.productionRate;
                                            ceilingHours = stats.totalFloorArea / rate;
                                        }

                                        let trimHours = 0;
                                        if (config.includeTrim) {
                                            const trimArea = stats.totalPerimeter * 0.5;
                                            trimHours = trimArea / laborConfig.productionRate;
                                        }

                                        const totalHours = (wallHours + ceilingHours + trimHours) * laborConfig.difficultyFactor;
                                        const totalCost = totalHours * laborConfig.hourlyRate;

                                        return totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                    })()}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 text-right">Based on current rooms and rates.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
