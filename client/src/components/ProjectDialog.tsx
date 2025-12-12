import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useCreateProject, useUpdateProject } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import { Project, crewOperations, projectOperations, ProjectStatus } from "@/lib/firestore";
import { Plus, Edit, Users, Calendar } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useDeleteProject } from "@/hooks/useProjects";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { ClientComboSelector } from "./ClientComboSelector";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

interface ProjectDialogProps {
  project?: Project & { id: string };
  trigger?: React.ReactNode;
  mode?: "create" | "edit";
  onSuccess?: () => void;
  defaultClientId?: string;
}

export function ProjectDialog({ project, trigger, mode = "create", onSuccess, defaultClientId }: ProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(defaultClientId || "");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedCompletion, setEstimatedCompletion] = useState("");
  const [status, setStatus] = useState<ProjectStatus>(project?.status || "new");

  // Pause Logic State
  const [pauseStart, setPauseStart] = useState("");
  const [pauseEnd, setPauseEnd] = useState("");

  const { t } = useTranslation();
  const { currentOrgId, currentOrgRole, org } = useAuth();
  const [, navigate] = useLocation();

  // Helper to determine available statuses
  const getAvailableStatuses = () => {
    const options: ProjectStatus[] = [];

    // Base decision on the project's saved status, not the transient form state, to avoid options jumping around
    // or bugs if state initializes to 'lead' default.
    const currentStatus = mode === 'create' ? status : (project?.status || 'lead');

    // Logic 1: Lead
    if (mode === 'create' || currentStatus === 'lead') {
      options.push('lead');
    }

    // Logic 2: Quoted / Pending
    if (['lead', 'quoted', 'pending'].includes(currentStatus) || mode === 'create') {
      options.push('quoted');
      options.push('pending');
    }

    // Logic 3: Booked / In Progress / Paused / On Hold
    // Always available as standard progression
    options.push('booked');
    options.push('in-progress');
    options.push('paused');
    options.push('on-hold');

    // Logic 4: Completed
    // "Only if currently the end date or later"
    // We check the form's estimatedCompletion or startDate relative to today.
    const end = estimatedCompletion ? new Date(estimatedCompletion) : (startDate ? new Date(new Date(startDate).getTime() + 3 * 86400000) : null);
    if (end) {
      // Normalize to midnight to be generous with "today"
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(end);
      endDate.setHours(0, 0, 0, 0);

      if (today >= endDate) {
        options.push('completed');
      }
    } else {
      // If no dates set, maybe allow? Or restrict? User said "only if..."
      // If no dates, we can't verify, so let's allow it if it's already in progress? 
      // Or strict: must set dates first. Let's start strict.
    }
    // Allow keeping 'completed' if already completed
    if (status === 'completed' && !options.includes('completed')) options.push('completed');


    // Logic 5: Invoiced / Paid
    // Only Org/Global Admins
    if (['owner', 'admin'].includes(currentOrgRole || '')) {
      options.push('invoiced');
      options.push('paid');
    } else {
      // If already set (e.g. by admin), keep it visible?
      if (['invoiced', 'paid'].includes(status)) {
        options.push(status);
      }
    }

    return Array.from(new Set(options)); // Dedupe
  };

  const availableStatuses = getAvailableStatuses();

  const [crewId, setCrewId] = useState(project?.assignedCrewId || "");
  const [doubleBookingWarning, setDoubleBookingWarning] = useState<string | null>(null);

  const { data: clients = [] } = useClients();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { toast } = useToast();

  const { data: crews = [] } = useQuery({
    queryKey: ['crews', currentOrgId],
    queryFn: () => crewOperations.getByOrg(currentOrgId!),
    enabled: !!currentOrgId
  });

  const { data: existingProjects = [] } = useQuery({
    queryKey: ['projects', currentOrgId],
    queryFn: createProject.isPending ? undefined : () => projectOperations.getByOrg(currentOrgId!),
    enabled: !!currentOrgId && !!crewId
  });

  // Check for double booking effect
  useEffect(() => {
    if ((!estimatedCompletion && mode === 'edit' && !startDate) || !crewId || !startDate) {
      setDoubleBookingWarning(null);
      return;
    }

    const start = new Date(startDate);
    const end = estimatedCompletion ? new Date(estimatedCompletion) : new Date(start.getTime() + (3 * 86400000));

    // Normalize to compare dates
    const sTime = start.setHours(0, 0, 0, 0);
    const eTime = end.setHours(23, 59, 59, 999);

    const conflicts = existingProjects.filter(p => {
      if (p.id === project?.id) return false; // Don't conflict with self
      if (p.assignedCrewId !== crewId) return false;
      if (!p.startDate) return false;

      const pStart = p.startDate.toDate().getTime();
      const pEnd = p.estimatedCompletion ? p.estimatedCompletion.toDate().getTime() : pStart + (3 * 86400000);

      return (pStart <= eTime && pEnd >= sTime);
    });

    if (conflicts.length > 0) {
      setDoubleBookingWarning(`Warning: Crew is already booked for ${conflicts.length} other project(s) during these dates!`);
    } else {
      setDoubleBookingWarning(null);
    }
  }, [crewId, startDate, estimatedCompletion, existingProjects, project, mode]);

  useEffect(() => {
    if (project && mode === "edit") {
      setName(project.name);
      setClientId(project.clientId);
      setLocation(project.location);
      setStartDate(project.startDate ? new Date(project.startDate.seconds * 1000).toISOString().split('T')[0] : "");
      setEstimatedCompletion(project.estimatedCompletion ? new Date(project.estimatedCompletion.seconds * 1000).toISOString().split('T')[0] : "");
      setCrewId(project.assignedCrewId || "");
    } else if (mode === "create" && defaultClientId && clients.length > 0) {
      // Pre-fill for new project if defaultClientId is provided
      // Only if we haven't selected a different client (or it's unset) AND location is empty
      if ((!clientId || clientId === defaultClientId) && !location) {
        setClientId(defaultClientId);
        const client = clients.find(c => c.id === defaultClientId);
        if (client?.address) setLocation(client.address);
      }
    }
  }, [project, mode, defaultClientId, clients, clientId]);

  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    if (mode === "create") {
      const client = clients.find(c => c.id === newClientId);
      if (client?.address) {
        setLocation(client.address);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For existing projects, keep current status
    // For new projects, ALWAYS start as 'new'
    const statusToSave: Project["status"] = mode === 'create' ? 'new' : status;

    // Validation: Start Date only required if we are editing an active project manually (though UI prevents status change now)
    const requiresStartDate = ['booked', 'in-progress', 'completed', 'paused'].includes(statusToSave);

    if (!name || !clientId || !location || (requiresStartDate && !startDate)) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: requiresStartDate && !startDate
          ? "Start Date is required for active projects (Booked, In Progress, etc.)"
          : "Please fill in all required fields",
      });
      return;
    }

    try {
      // Create dates at Noon UTC to avoid timezone shifts when formatting in local time
      let startDateObj: Date | null = null;
      if (startDate) {
        startDateObj = new Date(startDate);
        startDateObj.setUTCHours(12, 0, 0, 0);
      }

      const projectData: any = {
        name,
        clientId,
        status: statusToSave,
        location,
        assignedCrewId: crewId || undefined,
        startDate: startDateObj ? Timestamp.fromDate(startDateObj) : null, // Save as Noon UTC or null
        timeline: mode === "create" ? [{
          id: 'init-1',
          type: 'lead_created',
          label: 'Project Created',
          date: Timestamp.now(),
          notes: 'Project created manually'
        }] : project?.timeline || [],
      };

      if (estimatedCompletion && estimatedCompletion.trim() !== '') {
        const endDateObj = new Date(estimatedCompletion);
        endDateObj.setUTCHours(12, 0, 0, 0);
        projectData.estimatedCompletion = Timestamp.fromDate(endDateObj);
      }

      // Handle Pause Logic (Date Shifting)
      if (status === 'paused' && pauseStart && pauseEnd) {
        const pStart = new Date(pauseStart);
        const pEnd = new Date(pauseEnd);
        const pauseDurationMs = pEnd.getTime() - pStart.getTime();
        const pauseDurationDays = Math.ceil(pauseDurationMs / (1000 * 60 * 60 * 24));

        if (pauseDurationDays > 0) {
          const currentEnd = projectData.estimatedCompletion
            ? projectData.estimatedCompletion.toDate()
            : new Date((startDateObj?.getTime() || Date.now()) + (3 * 24 * 60 * 60 * 1000));

          // Shift completion
          const newEnd = new Date(currentEnd.getTime() + pauseDurationMs);
          projectData.estimatedCompletion = Timestamp.fromDate(newEnd);

          // Add to pauses array
          const newPause = {
            startDate: Timestamp.fromDate(pStart),
            endDate: Timestamp.fromDate(pEnd),
            originalDuration: pauseDurationDays
          };
          projectData.pauses = [...(project?.pauses || []), newPause];

          // Add event to timeline
          const newTimeline = [...(projectData.timeline || [])];
          newTimeline.push({
            id: crypto.randomUUID(),
            type: 'paused',
            label: 'Project Paused',
            date: Timestamp.fromDate(pStart),
            notes: `Paused for ${pauseDurationDays} days until ${pauseEnd}`
          });
          projectData.timeline = newTimeline;
        }
      }

      if (mode === "edit" && project) {
        await updateProject.mutateAsync({ id: project.id, data: projectData });
        toast({
          title: t('common.success'),
          description: "Project has been successfully updated",
        });
      } else {
        await createProject.mutateAsync(projectData);
        toast({
          title: t('common.success'),
          description: "Project has been successfully created",
        });
      }

      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || "Failed to save project",
      });
    }
  };

  const resetForm = () => {
    if (mode === "create") {
      setName("");
      setClientId(defaultClientId || "");
      const defaultClient = clients.find(c => c.id === defaultClientId);
      setLocation(defaultClient?.address || "");
      setStartDate("");
      setEstimatedCompletion("");
      setCrewId("");
    } else if (project) {
      setName(project.name);
      setClientId(project.clientId);
      setLocation(project.location);
      setStartDate(project.startDate ? new Date(project.startDate.seconds * 1000).toISOString().split('T')[0] : "");
      setEstimatedCompletion(project.estimatedCompletion ? new Date(project.estimatedCompletion.seconds * 1000).toISOString().split('T')[0] : "");
      setStatus(project.status);
      setCrewId(project.assignedCrewId || "");
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTimeout(() => resetForm(), 200);
    }
  };

  const defaultTrigger = mode === "create" ? (
    <Button data-testid="button-add-project">
      <Plus className="h-4 w-4 mr-2" />
      {t('projects.create_new')}
    </Button>
  ) : (
    <Button variant="ghost" size="sm" data-testid={`button-edit-project-${project?.id}`}>
      <Edit className="h-4 w-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t('projects.dialog.add_title') : t('projects.dialog.edit_title')}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? t('projects.dialog.add_description') : t('projects.dialog.edit_description')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('projects.dialog.name')} *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Kitchen Renovation"
              required
              data-testid="input-project-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">{t('projects.dialog.client')} *</Label>
            <ClientComboSelector
              clients={clients as any}
              value={clientId}
              onChange={handleClientChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">{t('projects.dialog.location')} *</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., 123 Main St, Cityville"
              required
              data-testid="input-project-location"
            />
          </div>

          {/* Status Selection Removed - Workflow Driven */}

          {status === 'paused' && (
            <div className="grid grid-cols-2 gap-4 p-4 border border-amber-200 bg-amber-50 rounded-md">
              <div className="col-span-2">
                <Label className="text-amber-800 font-semibold">Pause Configuration</Label>
                <p className="text-xs text-amber-700 mb-2">Defining a pause will automatically shift the project end date.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Pause Start</Label>
                <Input type="date" value={pauseStart} onChange={e => setPauseStart(e.target.value)} required={status === 'paused'} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Resume Date</Label>
                <Input type="date" value={pauseEnd} onChange={e => setPauseEnd(e.target.value)} required={status === 'paused'} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date (Optional)</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-project-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedCompletion">Estimated Completion (Optional)</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="estimatedCompletion"
                  type="date"
                  value={estimatedCompletion}
                  onChange={(e) => setEstimatedCompletion(e.target.value)}
                  className="pl-9"
                  min={startDate}
                  data-testid="input-project-completion-date"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign Crew</Label>
            <Select value={crewId} onValueChange={setCrewId}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select a crew..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_unassigned">Unassigned</SelectItem>
                {crews.map(crew => (
                  <SelectItem key={crew.id} value={crew.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: crew.color }} />
                      {crew.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {doubleBookingWarning && (
              <p className="text-xs font-medium text-destructive mt-1 animate-pulse">{doubleBookingWarning}</p>
            )}
            {crews.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Need to add a crew? You can manage your crews in your business settings. Click on <a href="/organization" className="text-primary hover:underline font-medium" onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  navigate('/organization');
                }}>{org?.name}</a> in the menu to add one.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            {mode === "edit" && project && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-delete-project">
                    {t('common.delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('projects.dialog.delete_title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('projects.dialog.delete_description')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await deleteProject.mutateAsync(project.id);
                          toast({
                            title: t('common.success'),
                            description: "Project has been successfully deleted",
                          });
                          setOpen(false);
                          onSuccess?.();
                        } catch (error: any) {
                          toast({
                            variant: "destructive",
                            title: t('common.error'),
                            description: error.message || "Failed to delete project",
                          });
                        }
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteProject.isPending}
                    >
                      {deleteProject.isPending ? "Deleting..." : t('projects.dialog.delete_confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              data-testid="button-cancel-project"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createProject.isPending || updateProject.isPending || deleteProject.isPending}
              data-testid="button-submit-project"
            >
              {createProject.isPending || updateProject.isPending
                ? "Saving..."
                : mode === "create"
                  ? t('projects.dialog.create_button')
                  : t('projects.dialog.update_button')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
