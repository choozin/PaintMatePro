import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useCreateProject, useUpdateProject } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import type { Project } from "@/lib/firestore";
import { Plus, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useDeleteProject } from "@/hooks/useProjects";

interface ProjectDialogProps {
  project?: Project & { id: string };
  trigger?: React.ReactNode;
  mode?: "create" | "edit";
  onSuccess?: () => void;
}

export function ProjectDialog({ project, trigger, mode = "create", onSuccess }: ProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<"pending" | "in-progress" | "completed" | "on-hold">("pending");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedCompletion, setEstimatedCompletion] = useState("");

  const { data: clients = [] } = useClients();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { toast } = useToast();

  useEffect(() => {
    if (project && mode === "edit") {
      setName(project.name);
      setClientId(project.clientId);
      setStatus(project.status);
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
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    try {
      const projectData: any = {
        name,
        clientId,
        status,
        location,
        startDate: Timestamp.fromDate(new Date(startDate)),
      };
      
      if (estimatedCompletion && estimatedCompletion.trim() !== '') {
        projectData.estimatedCompletion = Timestamp.fromDate(new Date(estimatedCompletion));
      }

      if (mode === "edit" && project) {
        await updateProject.mutateAsync({ id: project.id, data: projectData });
        toast({
          title: "Project Updated",
          description: "Project has been successfully updated",
        });
      } else {
        await createProject.mutateAsync(projectData);
        toast({
          title: "Project Created",
          description: "Project has been successfully created",
        });
      }

      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save project",
      });
    }
  };

  const resetForm = () => {
    if (mode === "create") {
      setName("");
      setClientId("");
      setStatus("pending");
      setLocation("");
      setStartDate("");
      setEstimatedCompletion("");
    } else if (project) {
      setName(project.name);
      setClientId(project.clientId);
      setStatus(project.status);
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
      Add Project
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New Project" : "Edit Project"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Create a new painting project" : "Update project details"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
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
            <Label htmlFor="client">Client *</Label>
            <Select value={clientId} onValueChange={setClientId} required>
              <SelectTrigger data-testid="select-project-client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., 123 Main St, Cityville"
              required
              data-testid="input-project-location"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger data-testid="select-project-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
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
              <Label htmlFor="estimatedCompletion">Est. Completion</Label>
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
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your project
                      and remove its data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await deleteProject.mutateAsync(project.id);
                          toast({
                            title: "Project Deleted",
                            description: "Project has been successfully deleted",
                          });
                          setOpen(false);
                          onSuccess?.();
                        } catch (error: any) {
                          toast({
                            variant: "destructive",
                            title: "Error",
                            description: error.message || "Failed to delete project",
                          });
                        }
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteProject.isPending}
                    >
                      {deleteProject.isPending ? "Deleting..." : "Continue"}
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
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProject.isPending || updateProject.isPending || deleteProject.isPending}
              data-testid="button-submit-project"
            >
              {createProject.isPending || updateProject.isPending
                ? "Saving..."
                : mode === "create"
                ? "Create Project"
                : "Update Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
