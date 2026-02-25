import { Room } from "@/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquarePlus, Image as ImageIcon, LayoutTemplate } from "lucide-react";
import { useState } from "react";
import { RoomCollaboration } from "./RoomCollaboration";

interface RoomCardProps {
    room: Room;
    projectId: string;
}

export function RoomCard({ room, projectId }: RoomCardProps) {
    const [isCollabOpen, setIsCollabOpen] = useState(false);

    // Derive status or info
    const taskCount = room.prepTasks?.length || 0;
    const color = room.color || "Not Selected";

    return (
        <>
            <Card className="hover:shadow-md transition-shadow border-muted/60 overflow-hidden flex flex-col h-full">
                {/* Image Placeholder (or actual image if we had one) */}
                <div className={`h-32 flex items-center justify-center relative group transition-colors ${room.type === 'exterior' ? 'bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900' : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900'}`}>
                    {room.type === 'exterior' ? (
                        <LayoutTemplate className="h-8 w-8 text-green-600/40 dark:text-green-400/30" />
                    ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    )}
                    {/* Overlay Button */}
                    <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {/* Could trigger photo upload directly here */}
                    </div>
                </div>

                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg flex items-center gap-2">
                            {room.name}
                        </CardTitle>
                        <Badge variant={room.type === 'exterior' ? 'default' : 'secondary'} className="capitalize text-xs">
                            {room.type === 'exterior' ? 'Exterior' : 'Interior'}
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="flex-grow space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        <span className="font-medium text-foreground">Color:</span> {color}
                        <span className="font-medium text-foreground">Tasks:</span> {taskCount} items
                    </div>
                    {room.notes && (
                        <div className="text-muted-foreground line-clamp-2 italic border-l-2 pl-3 bg-muted/20 py-1 rounded-r">
                            "{room.notes}"
                        </div>
                    )}
                </CardContent>

                <CardFooter className="pt-2 pb-4">
                    <Button
                        variant="default"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                        onClick={() => setIsCollabOpen(true)}
                    >
                        <MessageSquarePlus className="mr-2 h-4 w-4" />
                        Collaborate / Upload
                    </Button>
                </CardFooter>
            </Card>

            {/* Collaboration Drawer/Modal */}
            <RoomCollaboration
                room={room}
                projectId={projectId}
                open={isCollabOpen}
                onOpenChange={setIsCollabOpen}
            />
        </>
    );
}
