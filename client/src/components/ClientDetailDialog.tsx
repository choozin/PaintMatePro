import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUpdateClient } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import type { Client } from "@/lib/firestore";
import { User, Phone, Mail, MapPin, Building, FileText, Star, Clock, Calendar, Briefcase, Plus } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ProjectDialog } from "@/components/ProjectDialog";

interface ClientDetailDialogProps {
    client: Client & { id: string } | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ClientDetailDialog({ client, open, onOpenChange }: ClientDetailDialogProps) {
    if (!client) return null;

    const { t } = useTranslation();
    const { toast } = useToast();
    const updateClient = useUpdateClient();
    const { data: projects = [] } = useProjects();
    const [, setLocation] = useLocation();

    // Local state for editing fields
    const [formData, setFormData] = useState<Partial<Client>>({});

    const isDirty = (() => {
        if (!client) return false;
        const keys: (keyof Client)[] = ['name', 'email', 'phone', 'address', 'clientType', 'leadStatus', 'source', 'mobilePhone', 'preferences', 'notes'];
        for (const key of keys) {
            if ((formData[key] ?? '') !== (client[key] ?? '')) return true;
        }
        const secForm = formData.secondaryContact || {};
        const secClient = client.secondaryContact || {};
        return (
            (secForm.name ?? '') !== (secClient.name ?? '') ||
            (secForm.email ?? '') !== (secClient.email ?? '') ||
            (secForm.phone ?? '') !== (secClient.phone ?? '') ||
            (secForm.role ?? '') !== (secClient.role ?? '')
        );
    })();

    // Reset form data when client changes
    useEffect(() => {
        if (client) {
            setFormData({
                ...client,
                secondaryContact: client.secondaryContact || { name: "", phone: "", email: "", role: "" }
            });
        }
    }, [client, open]);

    const clientProjects = projects.filter(p => p.clientId === client.id);
    const activeProjects = clientProjects.filter(p => ['in-progress', 'booked'].includes(p.status));
    const completedProjects = clientProjects.filter(p => ['completed', 'paid', 'invoiced'].includes(p.status));
    const totalSpent = clientProjects.reduce((acc, p) => acc + (p.laborConfig?.totalCost || 0), 0); // Placeholder cost logic

    const handleSave = async () => {
        try {
            await updateClient.mutateAsync({ id: client.id, data: formData });
            toast({ title: "Client Updated", description: "Changes saved successfully." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save changes." });
        }
    };

    const handleChange = (field: keyof Client, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSecondaryChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            secondaryContact: { ...prev.secondaryContact!, [field]: value }
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex justify-between items-end">
                        <div className="flex gap-4">
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${client.name}`} />
                                <AvatarFallback>{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <DialogTitle className="text-2xl">{client.name}</DialogTitle>
                                <DialogDescription className="text-base flex items-center gap-2 mt-1">
                                    <Badge variant="outline">{client.leadStatus || 'Lead'}</Badge>
                                    {client.clientType && <Badge variant="secondary" className="capitalize">{client.clientType.replace('_', ' ')}</Badge>}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex gap-2">
                                <ProjectDialog
                                    mode="create"
                                    defaultClientId={client.id}
                                    trigger={<Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" /> New Project</Button>}
                                />
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={!isDirty || updateClient.isPending}
                                    className={isDirty ? "animate-pulse" : ""}
                                >
                                    {updateClient.isPending ? "Saving..." : "Save Changes"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6">
                        <TabsList className="w-full justify-start overflow-x-auto">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="details">Contact & Info</TabsTrigger>
                            <TabsTrigger value="notes">Notes & Preferences</TabsTrigger>
                            <TabsTrigger value="projects">Projects ({clientProjects.length})</TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1 p-6">
                        <TabsContent value="overview" className="space-y-6 mt-0">
                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <Card>
                                    <CardHeader className="p-4 pb-2">
                                        <CardDescription>Active Projects</CardDescription>
                                        <CardTitle className="text-2xl">{activeProjects.length}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card>
                                    <CardHeader className="p-4 pb-2">
                                        <CardDescription>Completed</CardDescription>
                                        <CardTitle className="text-2xl">{completedProjects.length}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card>
                                    <CardHeader className="p-4 pb-2">
                                        <CardDescription>Est. Lifetime Value</CardDescription>
                                        <CardTitle className="text-2xl">${totalSpent.toLocaleString()}</CardTitle>
                                    </CardHeader>
                                </Card>
                            </div>

                            <Separator />

                            {/* Recent Activity / Snapshot */}
                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> Quick Snapshot
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Mail className="h-4 w-4" /> {client.email}
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Phone className="h-4 w-4" /> {client.phone}
                                    </div>
                                    <div className="flex items-start gap-2 text-muted-foreground col-span-2">
                                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" /> {client.address}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="details" className="space-y-6 mt-0">
                            <div className="grid gap-6">
                                {/* Basic Info Form */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <User className="h-4 w-4" /> Primary Contact
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Full Name</Label>
                                            <Input value={formData.name || ''} onChange={(e) => handleChange('name', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <Input value={formData.email || ''} onChange={(e) => handleChange('email', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone</Label>
                                            <Input value={formData.phone || ''} onChange={(e) => handleChange('phone', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>SMS Mobile</Label>
                                            <Input value={formData.mobilePhone || ''} onChange={(e) => handleChange('mobilePhone', e.target.value)} />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label>Address</Label>
                                            <Input value={formData.address || ''} onChange={(e) => handleChange('address', e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Extended Info */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <Building className="h-4 w-4" /> Profile
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Client Type</Label>
                                            <Select value={formData.clientType} onValueChange={(val) => handleChange('clientType', val)}>
                                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="residential">Residential Homeowner</SelectItem>
                                                    <SelectItem value="commercial">Commercial Business</SelectItem>
                                                    <SelectItem value="property_manager">Property Manager</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Source</Label>
                                            <Input placeholder="e.g. Google, Referral" value={formData.source || ''} onChange={(e) => handleChange('source', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Status</Label>
                                            <Select value={formData.leadStatus} onValueChange={(val) => handleChange('leadStatus', val)}>
                                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="new">New Lead</SelectItem>
                                                    <SelectItem value="interested">Interested</SelectItem>
                                                    <SelectItem value="cold">Cold</SelectItem>
                                                    <SelectItem value="archived">Archived</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Secondary Contact */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <User className="h-4 w-4" /> Secondary Contact
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Name</Label>
                                            <Input value={formData.secondaryContact?.name || ''} onChange={(e) => handleSecondaryChange('name', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Role / Relation</Label>
                                            <Input placeholder="e.g. Spouse, Site Mgr" value={formData.secondaryContact?.role || ''} onChange={(e) => handleSecondaryChange('role', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone</Label>
                                            <Input value={formData.secondaryContact?.phone || ''} onChange={(e) => handleSecondaryChange('phone', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <Input value={formData.secondaryContact?.email || ''} onChange={(e) => handleSecondaryChange('email', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="notes" className="space-y-6 mt-0">
                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Star className="h-4 w-4" /> Preferences & Access
                                </h3>
                                <div className="space-y-2">
                                    <Label>Preferences, Gate Codes, etc.</Label>
                                    <Textarea
                                        className="min-h-[100px]"
                                        placeholder="e.g. Gate Code: 1234, Dog is friendly but don't let out."
                                        value={formData.preferences || ''}
                                        onChange={(e) => handleChange('preferences', e.target.value)}
                                    />
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> Internal Notes
                                </h3>
                                <div className="space-y-2">
                                    <Label>General Notes</Label>
                                    <Textarea
                                        className="min-h-[150px]"
                                        placeholder="Keep track of general client details here..."
                                        value={formData.notes || ''}
                                        onChange={(e) => handleChange('notes', e.target.value)}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="projects" className="space-y-4 mt-0">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold">Project History</h3>
                            </div>

                            {clientProjects.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                    No projects found for this client.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {clientProjects.map(project => (
                                        <Card key={project.id}>
                                            <CardContent className="p-4 flex justify-between items-center">
                                                <div>
                                                    <div className="font-medium">{project.name}</div>
                                                    <div className="text-sm text-muted-foreground">{format(project.createdAt!.toDate(), 'MMM d, yyyy')}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Badge variant={project.status === 'completed' ? 'secondary' : 'default'} className="capitalize">
                                                        {project.status}
                                                    </Badge>
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <a href={`/projects/${project.id}`}><Briefcase className="h-4 w-4" /></a>
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
