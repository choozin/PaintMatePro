import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export default function AppSettings() {
    const { t } = useTranslation();

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('settings.app.title')}</h1>
                <p className="text-muted-foreground mt-2">{t('settings.app.description')}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('settings.app.language.title')}</CardTitle>
                    <CardDescription>{t('settings.app.language.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label>{t('settings.app.language.label')}</Label>
                        <LanguageSwitcher />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
