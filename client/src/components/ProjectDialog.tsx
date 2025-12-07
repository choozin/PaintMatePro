import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useCreateProject, useUpdateProject } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import type { Project } from "@/lib/firestore";
import { Plus, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useDeleteProject } from "@/hooks/useProjects";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { ClientComboSelector } from "./ClientComboSelector";

interface ProjectDialogProps {
  project?: Project & { id: string };
  trigger?: React.ReactNode;
  mode?: "create" | "edit";
  onSuccess?: () => void;
}

import { useTranslation } from "react-i18next";

export function ProjectDialog({ project, trigger, mode = "create", onSuccess }: ProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedCompletion, setEstimatedCompletion] = useState("");

  const { data: clients = [] } = useClients();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { toast } = useToast();
  const { t } = useTranslation();

  // ... (useEffect and handleSubmit remain the same)

  useEffect(() => {
    if (project && mode === "edit") {
      setName(project.name);
      setClientId(project.clientId);
      setLocation(project.location);
      setStartDate(project.startDate ? new Date(project.startDate.seconds * 1000).toISOString().split('T')[0] : "");
      setEstimatedCompletion(project.estimatedCompletion ? new Date(project.estimatedCompletion.seconds * 1000).toISOString().split('T')[0] : "");
    }
  }, [project, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !clientId || !location || !startDate) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: "Please fill in all required fields",
      });
      return;
    }

    // Determine status based on start date for new projects
    // For existing projects, keep current status to avoid accidental resets
    let statusToSave: Project["status"] = 'lead';
    if (mode === "create") {
      const start = new Date(startDate);
      const now = new Date();
      // Reset time parts for accurate day comparison if needed, but simplistic is fine
      statusToSave = start > now ? 'booked' : 'in-progress';
    } else {
      statusToSave = project!.status;
    }

    try {
      const projectData: any = {
        name,
        clientId,
        status: statusToSave,
        location,
        startDate: Timestamp.fromDate(new Date(startDate)),
        timeline: mode === "create" ? [{
          id: 'init-1',
          type: statusToSave === 'booked' ? 'scheduled' : 'started', // Use appropriate initial event
          label: statusToSave === 'booked' ? 'Project Scheduled' : 'Project Started',
          date: Timestamp.now(),
          notes: 'Project created manually'
        }] : project?.timeline || [],
      };

      if (estimatedCompletion && estimatedCompletion.trim() !== '') {
        projectData.estimatedCompletion = Timestamp.fromDate(new Date(estimatedCompletion));
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
      setClientId("");
      setLocation("");
      setStartDate("");
      setEstimatedCompletion("");
    } else if (project) {
      setName(project.name);
      setClientId(project.clientId);
      setLocation(project.location);
      setStartDate(project.startDate ? new Date(project.startDate.seconds * 1000).toISOString().split('T')[0] : "");
      setEstimatedCompletion(project.estimatedCompletion ? new Date(project.estimatedCompletion.seconds * 1000).toISOString().split('T')[0] : "");
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
              onChange={setClientId}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t('projects.dialog.start_date')} *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                data-testid="input-project-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedCompletion">{t('projects.dialog.est_completion')}</Label>
              <Input
                id="estimatedCompletion"
                type="date"
                value={estimatedCompletion}
                onChange={(e) => setEstimatedCompletion(e.target.value)}
                data-testid="input-project-completion-date"
              />
            </div>
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
