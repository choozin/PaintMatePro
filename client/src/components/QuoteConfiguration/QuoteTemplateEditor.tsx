import React, { useState } from 'react';
import { QuoteTemplate } from '@/lib/firestore';
import { QuoteConfiguration } from '@/types/quote-config';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    // We don't edit config bits manually here anymore, mainly just metadata + wizard launch
    const [config] = useState<QuoteConfiguration>(template.config); // Keep current config
    const [error, setError] = useState('');

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

            <Separator />

            <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-sm">Configuration</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Current Strategy: <span className="font-medium text-foreground">{config.listingStrategy === 'by_room' ? 'By Room' : 'By Activity'}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Labor Pricing: <span className="font-medium text-foreground capitalize">{config.laborUnit.replace('_', ' ')}</span>
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => onLaunchWizard({ ...template, name, config })}>
                        <Wand2 className="w-4 h-4 mr-2" /> Open Configuration Wizard
                    </Button>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <Button onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" /> Save Changes
                </Button>
            </div>
        </div>
    );
}
