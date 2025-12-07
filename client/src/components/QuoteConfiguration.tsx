import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { orgOperations } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function QuoteConfiguration() {
    const { currentOrgId, currentOrgRole } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const canEdit = currentOrgRole === 'owner' || currentOrgRole === 'admin';

    const [settings, setSettings] = useState({
        defaultTerms: '',
        defaultExpirationDays: 30,
        templateLayout: 'standard' as 'standard' | 'modern' | 'minimal'
    });

    useEffect(() => {
        if (!currentOrgId) return;

        async function loadSettings() {
            if (!currentOrgId) return;
            setIsLoading(true);
            try {
                const org = await orgOperations.get(currentOrgId);
                if (org && org.quoteSettings) {
                    setSettings(prev => ({ ...prev, ...org.quoteSettings }));
                }
            } catch (error) {
                console.error("Failed to load quote settings", error);
                toast({ variant: "destructive", title: "Error", description: "Failed to load settings." });
            } finally {
                setIsLoading(false);
            }
        }
        loadSettings();
    }, [currentOrgId]);

    const handleSave = async () => {
        if (!currentOrgId) return;
        setIsSaving(true);
        try {
            await orgOperations.update(currentOrgId, {
                quoteSettings: settings
            });
            toast({ title: "Settings Saved", description: "Quote configuration updated successfully." });
        } catch (error) {
            console.error("Failed to save settings", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save settings." });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Quote Configuration
                </CardTitle>
                <CardDescription>Set defaults for your quote templates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Default Expiration (Days)</Label>
                        <Input
                            type="number"
                            value={settings.defaultExpirationDays}
                            onChange={e => setSettings(prev => ({ ...prev, defaultExpirationDays: parseInt(e.target.value) || 30 }))}
                            disabled={!canEdit}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Template Layout</Label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['standard', 'modern', 'minimal'] as const).map(layout => (
                                <button
                                    key={layout}
                                    type="button"
                                    onClick={() => canEdit && setSettings(prev => ({ ...prev, templateLayout: layout }))}
                                    disabled={!canEdit}
                                    className={`relative border-2 rounded-lg p-3 text-left transition-all hover:border-primary/50 ${settings.templateLayout === layout
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border'
                                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <div className="space-y-2">
                                        <div className="font-medium capitalize flex items-center justify-between">
                                            {layout}
                                            {settings.templateLayout === layout && (
                                                <Badge variant="default" className="text-xs">Selected</Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {layout === 'standard' && 'Classic layout with header and footer'}
                                            {layout === 'modern' && 'Clean design with bold typography'}
                                            {layout === 'minimal' && 'Simple, text-focused layout'}
                                        </div>
                                        {/* Mini Preview */}
                                        <div className="mt-2 border rounded bg-white p-2 space-y-1">
                                            <div className={`h-1 rounded ${layout === 'standard' ? 'bg-gray-300 w-full' :
                                                layout === 'modern' ? 'bg-primary w-3/4' :
                                                    'bg-gray-200 w-1/2'
                                                }`} />
                                            <div className="h-1 bg-gray-100 w-full rounded" />
                                            <div className="h-1 bg-gray-100 w-5/6 rounded" />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label>Default Terms & Conditions</Label>
                        <Textarea
                            value={settings.defaultTerms}
                            onChange={e => setSettings(prev => ({ ...prev, defaultTerms: e.target.value }))}
                            disabled={!canEdit}
                            rows={6}
                            placeholder="e.g. Payment due upon completion. We are not responsible for moving heavy furniture..."
                        />
                        <p className="text-xs text-muted-foreground">These terms will appear on all new quotes by default.</p>
                    </div>
                </div>
            </CardContent>
            {canEdit && (
                <CardFooter className="border-t px-6 py-4">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Configuration
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
