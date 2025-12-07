import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { Project } from "@/lib/firestore";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProjectTimelineSheetProps {
    project: Project & { id: string };
    trigger?: React.ReactNode;
}

export function ProjectTimelineSheet({ project, trigger }: ProjectTimelineSheetProps) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <History className="h-4 w-4 mr-2" />
                        Timeline
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full">
                <SheetHeader>
                    <SheetTitle>Project Timeline & History</SheetTitle>
                    <SheetDescription>
                        View the complete history of this project and add notes.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 mt-6 overflow-hidden">
                    <ProjectTimeline project={project} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
