import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EstimatingDefaultsCard } from '@/components/EstimatingDefaultsCard';
import { BrandingSettings } from '@/components/BrandingSettings';
import { QuoteConfiguration } from '@/components/QuoteConfiguration';
import { CrewsSettings } from '@/components/CrewsSettings';
import { EmployeesSettings } from '@/components/EmployeesSettings';
import { RoleGuard } from '@/components/RoleGuard';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { hasPermission, OrgRole } from '@/lib/permissions';
import { GeneralSettings } from '@/components/GeneralSettings';
import { useAuth } from '@/contexts/AuthContext';

export default function Organization() {
    const { t } = useTranslation();
    const [, setLocation] = useLocation();
    const { currentOrgRole, org } = useAuth();

    // Redirect if can't manage org
    React.useEffect(() => {
        if (!currentOrgRole) return; // Wait for load
        if (!hasPermission(currentOrgRole as OrgRole, 'manage_org')) {
            setLocation('/dashboard');
        }
    }, [currentOrgRole, setLocation]);

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{org?.name || t('settings.organization.title')}</h1>
                <p className="text-muted-foreground mt-2">{t('settings.organization.description')}</p>
            </div>

            <RoleGuard scope="org" permission="manage_org">
                <Card className="border-none shadow-none">
                    <CardContent className="px-0">
                        <Tabs defaultValue="branding" className="w-full">
                            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                                <TabsTrigger
                                    value="general"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                >
                                    General
                                </TabsTrigger>
                                <TabsTrigger
                                    value="branding"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                >
                                    Branding
                                </TabsTrigger>
                                <TabsTrigger
                                    value="estimating"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                >
                                    {t('settings.organization.estimating')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="quoting"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                >
                                    Quote Customization
                                </TabsTrigger>
                                <TabsTrigger
                                    value="employees"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                >
                                    Employees
                                </TabsTrigger>
                                <TabsTrigger
                                    value="crews"
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                >
                                    Crews
                                </TabsTrigger>
                            </TabsList>

                            <div className="mt-6">
                                <TabsContent value="general">
                                    <GeneralSettings />
                                </TabsContent>

                                <TabsContent value="branding">
                                    <BrandingSettings />
                                </TabsContent>

                                <TabsContent value="estimating">
                                    <EstimatingDefaultsCard />
                                </TabsContent>

                                <TabsContent value="quoting">
                                    <QuoteConfiguration />
                                </TabsContent>

                                <TabsContent value="employees">
                                    <EmployeesSettings />
                                </TabsContent>

                                <TabsContent value="crews">
                                    <CrewsSettings />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </CardContent>
                </Card>
            </RoleGuard>
        </div>
    );
}
