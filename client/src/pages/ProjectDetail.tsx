import React from "react";
import { useParams, useLocation } from "wouter";
import { useProject } from "@/hooks/useProjects";
import { useClient } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoomMeasurement } from "@/components/RoomMeasurement";
import { QuoteBuilder } from "@/components/QuoteBuilder";
import { ArrowLeft, Calendar, MapPin, User, Ruler, Settings2, PaintBucket, DollarSign, CheckCircle2 } from "lucide-react";
import { ProjectSpecs } from "@/components/ProjectSpecs";
import { ProjectHeader } from "@/components/ProjectHeader";
import { useTranslation } from "react-i18next";
import { SupplyList } from "@/components/SupplyList";

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params.id || null;
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: client } = useClient(project?.clientId || null);

  // Manage tab state for stepper
  const [activeTab, setActiveTabState] = React.useState("rooms");
  const tabsRef = React.useRef<HTMLDivElement>(null);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    // Scroll to the tabs section
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    { id: "specs", label: "Project Specs", icon: Settings2 },
    { id: "supplies", label: t('supplies.title'), icon: PaintBucket },
    { id: "quotes", label: t('project_details.tabs.quotes'), icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <ProjectHeader
        project={project}
        clientName={client?.name}
        clientPhone={client?.phone}
        clientMobilePhone={client?.mobilePhone}
        clientEmail={client?.email}
      />

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
        {activeTab === "rooms" && <RoomMeasurement projectId={projectId!} onNext={() => setActiveTab("specs")} />}
        {activeTab === "specs" && <ProjectSpecs projectId={projectId!} onNext={() => setActiveTab("supplies")} />}
        {activeTab === "supplies" && <SupplyList projectId={projectId!} onNext={() => setActiveTab("quotes")} />}
        {activeTab === "quotes" && <QuoteBuilder projectId={projectId!} />}
      </div>
    </div>
  );
}
