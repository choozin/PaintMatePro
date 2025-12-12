import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';
import { orgOperations } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Users, FileText } from 'lucide-react';

export function GeneralSettings() {
    const { org, currentOrgId } = useAuth();
    const { toast } = useToast();

    const handleToggleTeamFeatures = async (checked: boolean) => {
        if (!currentOrgId) return;
        try {
            await orgOperations.update(currentOrgId, { enableTeamFeatures: checked });
            toast({ title: "Settings Updated", description: `Team features ${checked ? 'enabled' : 'disabled'}.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update settings." });
        }
    };

    const handleQuoteStyleChange = async (value: 'detailed' | 'split' | 'bundled') => {
        if (!currentOrgId) return;
        try {
            await orgOperations.update(currentOrgId, { defaultQuoteStyle: value });
            toast({ title: "Settings Updated", description: "Default quote style updated." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update settings." });
        }
    };

    if (!org) return null;

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Team & Workflow Mode
                    </CardTitle>
                    <CardDescription>Customize the complexity of your workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-0.5">
                            <Label className="text-base">Enable Team Features</Label>
                            <p className="text-sm text-muted-foreground">
                                Show features for Crews, Payroll, and Assignments. Disable for a simpler "Solo" experience.
                            </p>
                        </div>
                        <Switch
                            checked={org.enableTeamFeatures !== false} // Default to true if undefined
                            onCheckedChange={handleToggleTeamFeatures}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Default Quote Style
                    </CardTitle>
                    <CardDescription>Choose how line items are presented to clients by default.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Quote Format</Label>
                        <Select
                            value={org.defaultQuoteStyle || 'detailed'}
                            onValueChange={(val: any) => handleQuoteStyleChange(val)}
                        >
                            <SelectTrigger className="w-full md:w-[300px]">
                                <SelectValue placeholder="Select style" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="detailed">
                                    <span className="font-medium block">Detailed Itemization</span>
                                    <span className="text-xs text-muted-foreground">Show every item and labor hour separately.</span>
                                </SelectItem>
                                <SelectItem value="split">
                                    <span className="font-medium block">Materials & Labor Split</span>
                                    <span className="text-xs text-muted-foreground">Group all materials and all labor into two lines.</span>
                                </SelectItem>
                                <SelectItem value="bundled">
                                    <span className="font-medium block">Bundled (Value Pricing)</span>
                                    <span className="text-xs text-muted-foreground">Hide breakdown, show one total per room/area.</span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
