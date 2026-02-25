import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientSubmission, portalOperations, Room, roomOperations } from "@/lib/firestore";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Image as ImageIcon, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
// import { useSearchParams } from "wouter";

interface ClientActivityFeedProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ClientActivityFeed({ projectId, open, onOpenChange }: ClientActivityFeedProps) {
    const [submissions, setSubmissions] = useState<ClientSubmission[]>([]);
    const [loading, setLoading] = useState(false);
    const [rooms, setRooms] = useState<Record<string, string>>({}); // id -> name map

    // Fetch Submissions when open
    useEffect(() => {
        if (open) {
            setLoading(true);
            const fetchData = async () => {
                const [subs, roomList] = await Promise.all([
                    portalOperations.getProjectSubmissions(projectId),
                    roomOperations.getByProject(projectId)
                ]);

                setSubmissions(subs);

                // Map rooms for easy lookup
                const rMap: Record<string, string> = {};
                roomList.forEach(r => rMap[r.id] = r.name);
                setRooms(rMap);

                setLoading(false);
            };
            fetchData();
        }
    }, [open, projectId]);

    const unreadCount = submissions.filter(s => !s.isRead).length;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        Client Activity
                        {unreadCount > 0 && <Badge variant="destructive">{unreadCount} New</Badge>}
                    </SheetTitle>
                    <SheetDescription>
                        Recent updates, photos, and notes from the client.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 h-full pb-20">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="animate-spin text-muted-foreground" />
                        </div>
                    ) : submissions.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            No client activity yet.
                        </div>
                    ) : (
                        <ScrollArea className="h-full pr-4">
                            <div className="space-y-4">
                                {submissions.map((item) => (
                                    <div key={item.id} className={`p-4 rounded-lg border ${!item.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-card'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs font-normal">
                                                    {item.type === 'photo' ? <ImageIcon className="h-3 w-3 mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
                                                    {item.type}
                                                </Badge>
                                                {item.roomId && rooms[item.roomId] && (
                                                    <span className="text-xs text-muted-foreground">
                                                        in {rooms[item.roomId]}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true })}
                                            </span>
                                        </div>

                                        {item.type === 'note' && (
                                            <p className="text-sm">{item.content}</p>
                                        )}

                                        {item.type === 'photo' && (
                                            <div className="mt-2">
                                                <div className="bg-muted h-32 w-full rounded-md flex items-center justify-center text-xs text-muted-foreground">
                                                    Photo Placeholder: {item.fileMetadata?.name}
                                                </div>
                                            </div>
                                        )}

                                        {!item.isRead && (
                                            <div className="mt-3 flex justify-end">
                                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                                                    // Mark as read logic would go here
                                                }}>
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Mark as Read
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
