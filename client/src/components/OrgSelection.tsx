
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Building, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { orgOperations, getDocById, Org } from "@/lib/firestore";

export function OrgSelection() {
    const { user, claims } = useAuth();
    const [orgs, setOrgs] = useState<(Org & { id: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const isGlobalAdmin = claims?.globalRole === 'platform_owner' || claims?.globalRole === 'platform_admin';

    useEffect(() => {
        async function loadOrgs() {
            setIsLoading(true);
            try {
                if (isGlobalAdmin) {
                    // Admin sees all
                    const allOrgs = await orgOperations.getAll();
                    setOrgs(allOrgs);
                } else if (claims?.orgIds && claims.orgIds.length > 0) {
                    // User sees specific orgs
                    // Note: We'd ideally have a batch fetch, but loop is fine for small N
                    const fetchedOrgs = [];
                    for (const id of claims.orgIds) {
                        const org = await getDocById<Org>('orgs', id);
                        if (org) fetchedOrgs.push(org);
                    }
                    setOrgs(fetchedOrgs);
                }
            } catch (e) {
                console.error("Failed to load orgs", e);
            } finally {
                setIsLoading(false);
            }
        }
        loadOrgs();
    }, [claims, isGlobalAdmin]);

    const handleSelectOrg = (orgId: string) => {
        localStorage.setItem('fallbackOrgId', orgId);
        window.location.reload();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Building className="h-6 w-6 text-primary" />
                        <CardTitle>Select Organization</CardTitle>
                    </div>
                    <CardDescription>
                        {isGlobalAdmin
                            ? "Global Access: Select any organization to manage."
                            : "You belong to multiple organizations. Please choose one to continue."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading organizations...</div>
                    ) : (
                        <div className="grid gap-3">
                            {orgs.map((org) => (
                                <Button
                                    key={org.id}
                                    variant="outline"
                                    className="h-auto p-4 justify-between group hover:border-primary"
                                    onClick={() => handleSelectOrg(org.id)}
                                >
                                    <div className="flex flex-col items-start text-left">
                                        <span className="font-semibold text-base">{org.name}</span>
                                        <span className="text-xs text-muted-foreground capitalize">{org.plan} Plan</span>
                                    </div>
                                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Button>
                            ))}

                            {orgs.length === 0 && (
                                <div className="text-center py-6 bg-muted/50 rounded-lg">
                                    <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground">No organizations found.</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
                <div className="p-4 bg-muted/20 border-t flex justify-center">
                    <Button
                        variant="link"
                        className="text-muted-foreground"
                        onClick={() => import('@/lib/firebaseAuth').then(m => m.signOut().then(() => window.location.reload()))}
                    >
                        Sign Out
                    </Button>
                </div>
            </Card>
        </div>
    );
}


