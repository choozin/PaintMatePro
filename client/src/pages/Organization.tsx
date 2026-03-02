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
import { RolesSettings } from '@/components/RolesSettings';
import { GeneralSettings } from '@/components/GeneralSettings';
import { useAuth } from '@/contexts/AuthContext';
import { SupplyRulesEditor } from '@/components/SupplyRulesEditor';
import { useState, useEffect } from 'react';
import { orgOperations, SupplyRule } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';

export default function Organization() {
    const { t } = useTranslation();
    const [, setLocation] = useLocation();
    const { currentOrgRole, currentPermissions, org } = useAuth();

    // Check permission to show tab
    const canManageRoles = hasPermission(currentPermissions, 'manage_roles') || currentOrgRole === 'org_owner';
    const canManageOrgGeneral = hasPermission(currentPermissions, 'manage_org_general') || hasPermission(currentPermissions, 'manage_org');
    const canManageOrgBranding = hasPermission(currentPermissions, 'manage_org_branding') || hasPermission(currentPermissions, 'manage_org');
    const canManageOrgEstimating = hasPermission(currentPermissions, 'manage_org_estimating') || hasPermission(currentPermissions, 'manage_org');
    const canManageOrgQuoting = hasPermission(currentPermissions, 'manage_org_quoting') || hasPermission(currentPermissions, 'manage_org');
    const canManageOrgEmployees = hasPermission(currentPermissions, 'manage_org_employees') || hasPermission(currentPermissions, 'manage_org');
    const canManageOrgCrews = hasPermission(currentPermissions, 'manage_org_crews') || hasPermission(currentPermissions, 'manage_org');
    const canManageOrgSupplyRules = hasPermission(currentPermissions, 'manage_org_supply_rules') || hasPermission(currentPermissions, 'manage_org');
    const canManageAnyOrgSettings = canManageOrgGeneral || canManageOrgBranding || canManageOrgEstimating || canManageOrgQuoting || canManageOrgEmployees || canManageOrgCrews || canManageOrgSupplyRules || canManageRoles;

    const { toast } = useToast();
    const [supplyRules, setSupplyRules] = useState<SupplyRule[]>([]);

    useEffect(() => {
        if (org && org.supplyRules) {
            setSupplyRules(org.supplyRules);
        }
    }, [org]);

    const handleSaveRules = async () => {
        if (!org?.id) return;
        try {
            await orgOperations.update(org.id, {
                supplyRules: supplyRules
            });
            toast({ title: "Rules Saved", description: "Supply generation rules updated successfully." });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to save supply rules.", variant: "destructive" });
        }
    };

    // Redirect if can't view org settings page at all
    React.useEffect(() => {
        if (!currentOrgRole) return; // Wait for load
        if (!hasPermission(currentPermissions, 'view_organization') && !hasPermission(currentPermissions, 'manage_org')) {
            setLocation('/');
        }
    }, [currentOrgRole, currentPermissions, setLocation]);

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{org?.name || t('settings.organization.title')}</h1>
                <p className="text-muted-foreground mt-2">{t('settings.organization.description')}</p>
            </div>

            {canManageAnyOrgSettings ? (
                <Card className="border-none shadow-none">
                    <CardContent className="px-0">
                        <Tabs defaultValue="general" className="w-full">
                            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                                {canManageOrgGeneral && (
                                    <TabsTrigger
                                        value="general"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                    >
                                        General
                                    </TabsTrigger>
                                )}
                                {canManageOrgBranding && (
                                    <TabsTrigger
                                        value="branding"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                    >
                                        Branding
                                    </TabsTrigger>
                                )}
                                {canManageRoles && (
                                    <TabsTrigger
                                        value="roles"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                    >
                                        Roles
                                    </TabsTrigger>
                                )}
                                {canManageOrgEstimating && (
                                    <TabsTrigger
                                        value="estimating"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                    >
                                        {t('settings.organization.estimating')}
                                    </TabsTrigger>
                                )}
                                {canManageOrgQuoting && (
                                    <TabsTrigger
                                        value="quoting"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                    >
                                        Quote Customization
                                    </TabsTrigger>
                                )}
                                {canManageOrgEmployees && (
                                    <TabsTrigger
                                        value="employees"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                    >
                                        Employees
                                    </TabsTrigger>
                                )}
                                {canManageOrgCrews && (
                                    <TabsTrigger
                                        value="crews"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                    >
                                        Crews
                                    </TabsTrigger>
                                )}
                                {canManageOrgSupplyRules && (
                                    <TabsTrigger
                                        value="supply-rules"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                                    >
                                        Supply Rules
                                    </TabsTrigger>
                                )}
                            </TabsList>

                            <div className="mt-6">
                                {canManageOrgGeneral && (
                                    <TabsContent value="general">
                                        <GeneralSettings />
                                    </TabsContent>
                                )}

                                {canManageOrgBranding && (
                                    <TabsContent value="branding">
                                        <BrandingSettings />
                                    </TabsContent>
                                )}

                                {canManageRoles && (
                                    <TabsContent value="roles">
                                        <RolesSettings />
                                    </TabsContent>
                                )}

                                {canManageOrgEstimating && (
                                    <TabsContent value="estimating">
                                        <EstimatingDefaultsCard />
                                    </TabsContent>
                                )}

                                {canManageOrgQuoting && (
                                    <TabsContent value="quoting">
                                        <QuoteConfiguration />
                                    </TabsContent>
                                )}

                                {canManageOrgEmployees && (
                                    <TabsContent value="employees">
                                        <EmployeesSettings />
                                    </TabsContent>
                                )}

                                {canManageOrgCrews && (
                                    <TabsContent value="crews">
                                        <CrewsSettings />
                                    </TabsContent>
                                )}

                                {canManageOrgSupplyRules && (
                                    <TabsContent value="supply-rules">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Supply Generation Rules</CardTitle>
                                                <CardDescription>
                                                    Configure automated rules for generating supply checklists based on project measurements.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <SupplyRulesEditor
                                                    rules={supplyRules}
                                                    onChange={setSupplyRules}
                                                    disabled={!canManageOrgSupplyRules}
                                                />
                                                {canManageOrgSupplyRules && (
                                                    <div className="mt-6 flex justify-end">
                                                        <button
                                                            onClick={handleSaveRules}
                                                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                                                        >
                                                            Save Rules
                                                        </button>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                )}
                            </div>
                        </Tabs>
                    </CardContent>
                </Card>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    You do not have permission to view organization settings.
                </div>
            )}
        </div>
    );
}
