import React, { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useProject } from "@/hooks/useProjects";
import { useClient } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoomMeasurement } from "@/components/RoomMeasurement";
import { QuoteBuilder } from "@/components/QuoteBuilder";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, MapPin, User, Ruler, Settings2, PaintBucket, DollarSign, CheckCircle2, Share2, Copy, Mail, Palette, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ProjectSpecs } from "@/components/ProjectSpecs";
import { ProjectHeader } from "@/components/ProjectHeader";
import { useTranslation } from "react-i18next";
import { SupplyList } from "@/components/SupplyList";

import { ClientActivityFeed } from "@/components/project/ClientActivityFeed";
import { Bell } from "lucide-react";
import { portalOperations } from "@/lib/firestore";
import { FeatureLock } from "@/components/FeatureLock";

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params.id || null;
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: client } = useClient(project?.clientId || null);

  // Activity Feed State
  const [showActivity, setShowActivity] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);

  // Poll for unread count (simple version)
  useEffect(() => {
    if (projectId) {
      const checkActivity = async () => {
        try {
          const subs = await portalOperations.getProjectSubmissions(projectId);
          setUnreadCount(subs.filter(s => !s.isRead).length);
        } catch (e) { console.error(e); }
      };
      checkActivity();
    }
  }, [projectId]);

  useEffect(() => {
    // Debug logs removed
  }, [project]);

  // Manage tab state for stepper
  const [activeTab, setActiveTabState] = React.useState("rooms");
  const tabsRef = React.useRef<HTMLDivElement>(null);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    // Scroll to the tabs section
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [isShareOpen, setIsShareOpen] = React.useState(false);
  const [generatedLink, setGeneratedLink] = React.useState("");

  const handleOpenShare = async () => {
    if (!projectId) return;

    // Debugging
    console.log("Opening Share Dialog. Client:", client);
    if (!client?.email) {
      toast({
        variant: "destructive",
        title: "Missing Email",
        description: "This client has no email address. Secure portal access requires a client email.",
      });
      // We allow opening but the token will have empty email, causing auth to fail unless we handle it
      // validToken would be created with empty string.
      // return; // Let's not return, but warn.
    }

    try {
      // 1. Check for existing valid token (Static Link)
      let token = await portalOperations.getActiveToken(projectId);

      // 2. If no token, create new one
      if (!token) {
        token = await portalOperations.createToken(projectId, client?.email);
      }

      const url = `${window.location.origin}/portal/${token}`;
      setGeneratedLink(url);
      setIsShareOpen(true);
    } catch (e: any) {
      console.error("Share Portal Error:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to generate portal link: ${e.message}`,
      });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast({
      title: "Copied!",
      description: "Link copied to clipboard.",
    });
  };

  const handleSendEmail = () => {
    if (!client?.email) {
      toast({
        variant: "destructive",
        title: "No Email",
        description: "Client does not have an email address.",
      });
      return;
    }
    const subject = encodeURIComponent(`Project Portal Access: ${project?.name}`);
    const body = encodeURIComponent(`Hi ${client.name},\n\nYou can view your project quote, photos, and progress at the following link:\n\n${generatedLink}\n\nBest regards,\nPaintMate Pro`);
    window.location.href = `mailto:${client.email}?subject=${subject}&body=${body}`;
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t('project_details.loading')}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">{t('project_details.not_found')}</p>
        <Button onClick={() => setLocation("/projects")} data-testid="button-back-to-projects">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('project_details.back_to_projects')}
        </Button>
      </div>
    );
  }

  const steps = [
    { id: "rooms", label: "Rooms & Surfaces", icon: Ruler },
    { id: "visuals", label: "Visualizers", icon: Palette },
    { id: "specs", label: "Project Specs", icon: Settings2 },
    { id: "supplies", label: t('supplies.title'), icon: PaintBucket },
    { id: "quotes", label: t('project_details.tabs.quotes'), icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* Header Area with Notification Bell */}
      <div className="relative">
        <ProjectHeader
          project={project}
          client={client}
          clientName={client?.name}
          clientPhone={client?.phone}
          clientMobilePhone={client?.mobilePhone}
          clientEmail={client?.email}
          extraActions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="bg-background/80 backdrop-blur shadow-sm"
                onClick={handleOpenShare}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Portal
              </Button>

              <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Share Client Portal</DialogTitle>
                    <DialogDescription>
                      Give your client access to quotes, photos, and project updates.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-4">
                    <div className="flex items-center space-x-2">
                      <div className="grid flex-1 gap-2">
                        <Label htmlFor="link" className="sr-only">
                          Link
                        </Label>
                        <Input
                          id="link"
                          defaultValue={generatedLink}
                          readOnly
                          className="h-9"
                        />
                      </div>
                      <Button type="button" size="sm" className="px-3" onClick={handleCopyLink}>
                        <span className="sr-only">Copy</span>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold">Portal Settings</h4>
                      <FeatureLock feature="portal.fullView">
                        <div className="flex items-center justify-between border p-3 rounded-md">
                          <div className="space-y-0.5">
                            <Label>Enable Full Detailed Client View</Label>
                            <p className="text-xs text-muted-foreground">Show complete quote breakdowns and internal notes.</p>
                          </div>
                          <div className="h-5 w-9 bg-muted rounded-full" /> {/* Fake toggle */}
                        </div>
                      </FeatureLock>

                      <FeatureLock feature="portal.advancedActionsLocked">
                        <div className="flex items-center justify-between border p-3 rounded-md">
                          <div className="space-y-0.5">
                            <Label>Unlock Advanced Client Actions</Label>
                            <p className="text-xs text-muted-foreground">Allow clients to digitally sign and pay online.</p>
                          </div>
                          <div className="h-5 w-9 bg-muted rounded-full" /> {/* Fake toggle */}
                        </div>
                      </FeatureLock>
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center">
                      <Button variant="outline" size="sm" onClick={async () => {
                        if (!projectId) return;
                        try {
                          const token = await portalOperations.createToken(projectId, client?.email, true); // Force new & invalidate old
                          const url = `${window.location.origin}/portal/${token}`;
                          setGeneratedLink(url);
                          toast({ title: "Link Regenerated", description: "Old links have been invalidated." });
                        } catch (e: any) {
                          console.error(e);
                          toast({ variant: "destructive", title: "Error", description: `Failed to regenerate link: ${e.message}` });
                        }
                      }}>
                        Regenerate Link
                      </Button>

                      <Button size="sm" onClick={() => {
                        window.location.href = `mailto:${client?.email || ''}?subject=Project Portal Access&body=Here is your secure link to access the project portal: ${generatedLink}`;
                      }}>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Email
                      </Button>
                    </div>
                  </div>
                  <DialogFooter className="sm:justify-start">
                    <Button type="button" variant="secondary" onClick={() => setIsShareOpen(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                variant={unreadCount > 0 ? "default" : "outline"}
                size="icon"
                className={`rounded-full shadow-lg ${unreadCount > 0 ? "animate-pulse" : "bg-background/80 backdrop-blur"}`}
                onClick={() => setShowActivity(true)}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </>
          }
        />
      </div>

      {/* Stepper Navigation */}
      <div className="relative" ref={tabsRef}>
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -z-10" />
        <div className="flex justify-between items-center">
          {steps.map((step, index) => {
            const isActive = activeTab === step.id;
            const isCompleted = steps.findIndex(s => s.id === activeTab) > index;
            const Icon = step.icon;

            return (
              <button
                key={step.id}
                onClick={() => setActiveTab(step.id)}
                className={`flex flex-col items-center gap-2 bg-background px-4 py-2 rounded-lg transition-colors ${isActive ? "text-primary" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/60"}`}
              >
                <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${isActive ? "border-primary bg-primary text-primary-foreground shadow-lg scale-110" : isCompleted ? "border-primary/50 bg-primary/10 text-primary" : "border-muted bg-background"}`}>
                  {isCompleted ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className={`text-sm font-medium ${isActive ? "text-foreground" : ""}`}>{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "rooms" && <RoomMeasurement projectId={projectId!} onNext={() => setActiveTab("visuals")} />}

        {activeTab === "visuals" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Visualizers & Reference</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FeatureLock feature="visual.recolor">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wand2 className="h-5 w-5 text-indigo-500" />
                      AI Room Recolor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="h-32 bg-muted rounded flex items-center justify-center border-2 border-dashed">
                      <p className="text-muted-foreground">Upload a photo to see new colors instantly</p>
                    </div>
                    <Button variant="outline" className="w-full">Launch AI Recolor Tool</Button>
                  </CardContent>
                </Card>
              </FeatureLock>

              <FeatureLock feature="visual.sheenSimulator">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5 text-pink-500" />
                      Sheen Simulator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="h-32 bg-muted rounded flex items-center justify-center border-2 border-dashed">
                      <p className="text-muted-foreground">Compare Matte, Eggshell, and Semi-Gloss</p>
                    </div>
                    <Button variant="outline" className="w-full">Launch Sheen Simulator</Button>
                  </CardContent>
                </Card>
              </FeatureLock>
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={() => setActiveTab("specs")} className="w-full md:w-auto font-semibold">
                Next Step: Project Specs
                <Settings2 className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {activeTab === "specs" && <ProjectSpecs projectId={projectId!} onNext={() => setActiveTab("supplies")} />}
        {activeTab === "supplies" && <SupplyList projectId={projectId!} onNext={() => setActiveTab("quotes")} />}
        {activeTab === "quotes" && <QuoteBuilder projectId={projectId!} />}
      </div>

      {/* Activity Sheet */}
      {projectId && (
        <ClientActivityFeed
          projectId={projectId}
          open={showActivity}
          onOpenChange={setShowActivity}
        />
      )}
    </div>
  );
}
