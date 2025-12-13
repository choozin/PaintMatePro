import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { orgOperations, QuoteTemplate } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Edit2, Copy, Trash2, CheckCircle, Star } from "lucide-react";
import { QuoteConfigWizard } from "./QuoteConfiguration/QuoteConfigWizard";
import { QuoteTemplateEditor } from "./QuoteConfiguration/QuoteTemplateEditor";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function QuoteConfiguration() {
    const { currentOrgId, currentOrgRole } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [templates, setTemplates] = useState<QuoteTemplate[]>([]);

    // UI State
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | undefined>(undefined);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    // Legacy support or new? We'll load the new `quoteTemplates` array

    const loadSettings = async () => {
        if (!currentOrgId) return;
        setIsLoading(true);
        try {
            const org = await orgOperations.get(currentOrgId);
            if (org && org.quoteTemplates) {
                setTemplates(org.quoteTemplates);
            }
        } catch (error) {
            console.error("Failed to load quote settings", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, [currentOrgId, isWizardOpen]); // Reload when wizard closes

    // ACTIONS
    const handleSaveTemplate = async (template: QuoteTemplate) => {
        if (!currentOrgId) return;
        try {
            // Optimistic Update
            const updated = templates.some(t => t.id === template.id)
                ? templates.map(t => t.id === template.id ? template : t)
                : [...templates, template];

            setTemplates(updated);
            await orgOperations.update(currentOrgId, { quoteTemplates: updated });

            toast({ title: "Saved", description: "Template updated successfully." });
            setIsEditorOpen(false);
            setEditingTemplate(undefined);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save.' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!currentOrgId) return;
        if (!confirm("Are you sure you want to delete this template?")) return;

        try {
            const updated = templates.filter(t => t.id !== id);
            setTemplates(updated);
            await orgOperations.update(currentOrgId, { quoteTemplates: updated });
            toast({ title: "Deleted", description: "Template removed." });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete.' });
        }
    };

    const handleSetDefault = async (template: QuoteTemplate) => {
        if (!currentOrgId) return;
        try {
            // Optimistic Update
            const updated = templates.map(t => ({
                ...t,
                isDefault: t.id === template.id
            }));

            setTemplates(updated);

            // Update Org (defaultId) AND array
            await orgOperations.update(currentOrgId, {
                defaultQuoteTemplateId: template.id,
                quoteTemplates: updated
            });

            toast({ title: "Updated Default", description: `${template.name} is now the default.` });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to update default.' });
        }
    };

    const openWizard = (template?: QuoteTemplate) => {
        setEditingTemplate(template);
        setIsWizardOpen(true);
        setIsEditorOpen(false); // Close manual editor if open
    };

    const openManualEditor = (template: QuoteTemplate) => {
        setEditingTemplate(template);
        setIsEditorOpen(true);
    };

    // Wizard Overlay
    if (isWizardOpen) {
        return (
            <div className="fixed inset-0 z-50 bg-background overflow-hidden">
                <QuoteConfigWizard
                    initialConfig={editingTemplate?.config}
                    onComplete={async (newConfig) => {
                        if (editingTemplate) {
                            // Update existing
                            await handleSaveTemplate({ ...editingTemplate, config: newConfig });
                        } else {
                            // Create new
                            const newTemplate: QuoteTemplate = {
                                id: crypto.randomUUID(),
                                name: "New Template " + (templates.length + 1),
                                config: newConfig,
                                isDefault: false,
                                description: "Created via Wizard"
                            };
                            await handleSaveTemplate(newTemplate);
                        }
                        setIsWizardOpen(false);
                        setEditingTemplate(undefined);
                    }}
                    onCancel={() => {
                        setIsWizardOpen(false);
                        setEditingTemplate(undefined);
                        loadSettings(); // Refresh
                    }}
                />
            </div>
        );
    }

    return (
        <>
            <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogTitle>Edit Template: {editingTemplate?.name}</DialogTitle>
                    {editingTemplate && (
                        <QuoteTemplateEditor
                            template={editingTemplate}
                            existingNames={templates.map(t => t.name.toLowerCase())}
                            onSave={handleSaveTemplate}
                            onLaunchWizard={(t) => openWizard(t)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold">Quote Templates</CardTitle>
                        <CardDescription>
                            Configure how your quotes look and feel. Create templates for different job types.
                        </CardDescription>
                    </div>
                    <Button onClick={() => openWizard()}>
                        <Plus className="mr-2 h-4 w-4" /> New Template
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8">Loading templates...</div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">No Templates Yet</h3>
                            <p className="text-muted-foreground mb-4">Create your first quote template to get started.</p>
                            <Button variant="outline" onClick={() => setIsWizardOpen(true)}>Create One</Button>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {templates.map((template) => (
                                <Card key={template.id} className="relative overflow-hidden hover:border-primary transition-colors cursor-pointer group flex flex-col h-full">
                                    <CardHeader className="pb-3 flex-none">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-base font-semibold">{template.name}</CardTitle>
                                            {template.isDefault && <Badge variant="secondary">Default</Badge>}
                                        </div>
                                        {/* Expanded Description */}
                                        <CardDescription className="text-xs">
                                            Strategy: <span className="font-medium text-foreground">{template.config.listingStrategy === 'by_room' ? 'By Room' : 'By Activity'}</span>
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pb-3 text-sm text-muted-foreground flex-1">
                                        {/* Expanded Attribute List */}
                                        <ScrollArea className="h-[120px] w-full pr-2">
                                            <ul className="space-y-1.5 text-xs text-gray-600">
                                                <li className="flex justify-between border-b pb-1">
                                                    <span>Labor Model:</span>
                                                    <span className="font-medium capitalize">{template.config.laborUnit}</span>
                                                </li>
                                                <li className="flex justify-between pt-1">
                                                    <span>Show Units:</span>
                                                    <span className={template.config.showUnits ? "text-green-600 font-bold" : "text-gray-400"}>{template.config.showUnits ? 'ON' : 'OFF'}</span>
                                                </li>
                                                <li className="flex justify-between">
                                                    <span>Show Rates:</span>
                                                    <span className={template.config.showRates ? "text-green-600 font-bold" : "text-gray-400"}>{template.config.showRates ? 'ON' : 'OFF'}</span>
                                                </li>
                                                <li className="flex justify-between">
                                                    <span>Show Tax:</span>
                                                    <span className={template.config.showTaxLine ? "text-green-600 font-bold" : "text-gray-400"}>{template.config.showTaxLine ? 'ON' : 'OFF'}</span>
                                                </li>
                                            </ul>
                                        </ScrollArea>
                                    </CardContent>
                                    <CardFooter className="bg-muted/50 p-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
                                        {!template.isDefault && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 text-xs hover:bg-primary/10 hover:text-primary mr-auto"
                                                onClick={(e) => { e.stopPropagation(); handleSetDefault(template); }}
                                            >
                                                Make Default
                                            </Button>
                                        )}
                                        <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => openManualEditor(template)}>
                                            <Edit2 className="h-3 w-3 mr-1.5" /> Edit
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(template.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
