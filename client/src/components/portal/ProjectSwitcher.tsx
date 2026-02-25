import { Project } from "@/lib/firestore";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, FolderOpen, Check } from "lucide-react";

interface ProjectSwitcherProps {
    projects: Project[];
    currentProjectId: string;
    onSelectProject: (projectId: string) => void;
}

export function ProjectSwitcher({ projects, currentProjectId, onSelectProject }: ProjectSwitcherProps) {
    const currentProject = projects.find(p => p.id === currentProjectId);

    if (!projects.length) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-between border-dashed border-primary/20 hover:border-primary/50 bg-background/50 backdrop-blur-sm">
                    <span className="truncate flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-primary" />
                        {currentProject?.name || "Select Project"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]" align="start">
                <DropdownMenuLabel>Your Projects</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {projects.map((project) => (
                    <DropdownMenuItem
                        key={project.id}
                        onClick={() => onSelectProject(project.id)}
                        className="flex items-center justify-between cursor-pointer"
                    >
                        <span className="truncate max-w-[150px]">{project.name}</span>
                        {project.id === currentProjectId && (
                            <Check className="h-4 w-4 text-primary" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
