import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AppSettings() {
    const { t, i18n } = useTranslation();

    const currentLanguage = i18n.language || 'en';

    const handleLanguageChange = (value: string) => {
        i18n.changeLanguage(value);
        localStorage.setItem('i18nextLng', value);
    };

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('settings.app.title')}</h1>
                <p className="text-muted-foreground mt-2">{t('settings.app.description')}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('settings.app.language.title', 'Regional Settings')}</CardTitle>
                    <CardDescription>{t('settings.app.language.description', 'Manage global application preferences.')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Language Selection */}
                        <div className="space-y-3">
                            <Label>{t('settings.app.language.label', 'Display Language')}</Label>
                            <p className="text-sm text-muted-foreground">Select the language used throughout the application interface.</p>
                            <Select value={currentLanguage} onValueChange={handleLanguageChange}>
                                <SelectTrigger className="w-[280px]">
                                    <SelectValue placeholder="Select Language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="es">Español (Spanish)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Measurement System (Read-Only Info) */}
                        <div className="space-y-3 pt-6 border-t">
                            <Label>Measurement System</Label>
                            <p className="text-sm text-muted-foreground">For optimal calculation accuracy, PaintMatePro currently standardizes all quotes and measurements to the Imperial system (feet, sq ft, gallons).</p>
                            <Select value="imperial" disabled>
                                <SelectTrigger className="w-[280px] bg-muted/50 cursor-not-allowed hidden">
                                    <SelectValue placeholder="Imperial (ft, sq ft, gal)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="imperial">Imperial (ft, sq ft, gal)</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="inline-flex items-center px-3 py-1.5 rounded bg-muted/50 border text-sm font-medium text-muted-foreground">
                                Imperial (ft, sq ft, gal)
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
