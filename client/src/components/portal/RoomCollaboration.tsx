import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Room, portalOperations } from "@/lib/firestore";
import { Camera, Send, Loader2, ImagePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

// We'll need firebase storage later, for now mock upload

interface RoomCollaborationProps {
    room: Room;
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RoomCollaboration({ room, projectId, open, onOpenChange }: RoomCollaborationProps) {
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);

    const handleSendMessage = async () => {
        if (!message.trim()) return;
        setSending(true);
        try {
            await portalOperations.submitActivity(projectId, {
                type: 'note',
                roomId: room.id,
                content: message,
                submittedBy: 'client'
            });

            toast({ title: "Sent!", description: "Your note has been added to the project." });
            setMessage("");
            // Close? Or keep open for more?
            // onOpenChange(false); 
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error", description: "Failed to send message." });
        } finally {
            setSending(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // Mock File Upload for now until we set up Storage hook
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            toast({ title: "Uploading...", description: `Uploading ${file.name} (Simulated)` });

            setTimeout(async () => {
                await portalOperations.submitActivity(projectId, {
                    type: 'photo',
                    roomId: room.id,
                    content: `https://mock-storage.com/${file.name}`, // Placeholder
                    fileMetadata: {
                        name: file.name,
                        size: file.size,
                        type: file.type
                    },
                    submittedBy: 'client'
                });
                toast({ title: "Success", description: "Photo uploaded successfully." });
            }, 1500);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-l p-0 shadow-2xl">
                <SheetHeader className="px-6 py-5 border-b bg-background">
                    <SheetTitle>Collaborate: {room.name}</SheetTitle>
                    <SheetDescription>
                        Share photos, notes, or questions specific to this room.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-grow overflow-y-auto px-6 py-6 space-y-6">
                    <Tabs defaultValue="note" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="note">Add Note</TabsTrigger>
                            <TabsTrigger value="photo">Upload Photo</TabsTrigger>
                        </TabsList>

                        <div className="mt-6 space-y-4">
                            <TabsContent value="note" className="space-y-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                                    Have a question about the color? Want to change the trim? Let us know here.
                                </div>
                                <div className="space-y-2">
                                    <Label>Your Message</Label>
                                    <Textarea
                                        placeholder="e.g. Can we paint the ceiling a different white?"
                                        className="min-h-[150px] resize-none"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleSendMessage} disabled={sending || !message.trim()} className="w-full">
                                    {sending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                                    Send Note
                                </Button>
                            </TabsContent>

                            <TabsContent value="photo" className="space-y-4">
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                                    Upload existing conditions or inspiration photos for this room.
                                </div>

                                <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4 hover:bg-muted/10 transition-colors cursor-pointer relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleFileUpload}
                                    />
                                    <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                        <Camera className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Click to Upload Photo</p>
                                        <p className="text-xs text-muted-foreground">JPG, PNG up to 10MB</p>
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>

                    {/* Previous Activity (History) Placeholder */}
                    <div>
                        <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Recent Activity</h4>
                        <div className="space-y-3">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm text-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">You</span>
                                    <span className="text-[10px] text-muted-foreground">Today</span>
                                </div>
                                <p className="text-muted-foreground">Viewed this room.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <SheetFooter className="border-t bg-background px-6 py-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
