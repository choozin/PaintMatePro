
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import {
    DevNote,
    DevNoteItem,
    devNoteOperations
} from "@/lib/firestore";
import {
    useFirestoreCollection,
    useCreateFirestoreDocument,
    useUpdateFirestoreDocument,
    useDeleteFirestoreDocument
} from "@/hooks/useFirestoreCrud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ExternalLink, NotebookPen, Link as LinkIcon, X } from "lucide-react";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";

export default function DevNotes() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const { toast } = useToast();
    const [filterType, setFilterType] = useState<string>("all");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<DevNote | null>(null);

    // Queries & Mutations
    const { data: notes, isLoading } = useFirestoreCollection<DevNote>(
        'dev_notes',
        devNoteOperations,
        ['dev_notes', user?.uid],
        async () => {
            if (!user?.uid) return [];
            return devNoteOperations.getByUser(user.uid);
        }
    );

    const createMutation = useCreateFirestoreDocument<DevNote>('dev_notes', devNoteOperations, ['dev_notes', user?.uid], false);
    const updateMutation = useUpdateFirestoreDocument<DevNote>('dev_notes', devNoteOperations, ['dev_notes', user?.uid], false);
    const deleteMutation = useDeleteFirestoreDocument<DevNote>('dev_notes', devNoteOperations, ['dev_notes', user?.uid], false);

    // Form State
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [type, setType] = useState<DevNote['type']>("general");
    const [relatedUrl, setRelatedUrl] = useState("");
    const [items, setItems] = useState<DevNoteItem[]>([]);

    // Local state for new item input
    const [newItemText, setNewItemText] = useState("");
    const [newItemUrl, setNewItemUrl] = useState("");

    const handleOpenDialog = (note?: DevNote) => {
        if (note) {
            setEditingNote(note);
            setTitle(note.title);
            setContent(note.content);
            setType(note.type);
            setRelatedUrl(note.relatedUrl || "");
            setItems(note.items || []);
        } else {
            setEditingNote(null);
            setTitle("");
            setContent("");
            setType("general");
            setRelatedUrl("");
            setItems([]);
        }
        setNewItemText("");
        setNewItemUrl("");
        setIsDialogOpen(true);
    };

    const handleAddItem = () => {
        if (!newItemText.trim()) return;

        const newItem: DevNoteItem = {
            id: uuidv4(),
            text: newItemText.trim(),
            url: newItemUrl.trim() || undefined
        };

        setItems([...items, newItem]);
        setNewItemText("");
        setNewItemUrl("");
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) {
            toast({
                title: "Error",
                description: "Please fill in title and content",
                variant: "destructive",
            });
            return;
        }

        try {
            const noteData = {
                title,
                content,
                type,
                relatedUrl,
                items
            };

            if (editingNote) {
                await updateMutation.mutateAsync({
                    id: editingNote.id,
                    data: noteData,
                });
                toast({
                    title: "Success",
                    description: "Note updated",
                });
            } else {
                await createMutation.mutateAsync({
                    ...noteData,
                    userId: user?.uid,
                } as any);
                toast({
                    title: "Success",
                    description: "Note created",
                });
            }
            setIsDialogOpen(false);
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Error",
                description: error.message || "Failed to save note",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this note?")) {
            try {
                await deleteMutation.mutateAsync(id);
                toast({
                    title: "Success",
                    description: "Note deleted",
                });
            } catch (error: any) {
                console.error(error);
                toast({
                    title: "Error",
                    description: error.message || "Failed to delete note",
                    variant: "destructive",
                });
            }
        }
    };

    const filteredNotes = (notes?.filter(note => {
        if (filterType === "all") return true;
        return note.type === filterType;
    }) || []).sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
    });

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'short_term': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
            case 'long_term': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
            case 'competitor': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'short_term': return 'Short Term';
            case 'long_term': return 'Long Term';
            case 'competitor': return 'Competitor Analysis';
            default: return 'General';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Development Notes</h1>
                    <p className="text-muted-foreground">
                        Personal notes, ideas, and competitive analysis for development.
                    </p>
                </div>
                <Button onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" /> Add Note
                </Button>
            </div>

            <div className="flex items-center space-x-2">
                <Tabs value={filterType} onValueChange={setFilterType} className="w-full">
                    <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="short_term">Short Term</TabsTrigger>
                        <TabsTrigger value="long_term">Long Term</TabsTrigger>
                        <TabsTrigger value="competitor">Competitor Analysis</TabsTrigger>
                        <TabsTrigger value="general">General</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {isLoading ? (
                <div>Loading...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredNotes.map((note) => (
                        <Card key={note.id} className="flex flex-col h-full">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start gap-2">
                                    <Badge variant="secondary" className={getTypeColor(note.type)}>
                                        {getTypeLabel(note.type)}
                                    </Badge>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(note)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(note.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <CardTitle className="pt-2 text-xl">{note.title}</CardTitle>
                                <CardDescription>
                                    {note.createdAt ? format(note.createdAt.toDate(), 'PPP') : 'Just now'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow space-y-4">
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                    {note.content}
                                </p>

                                {note.items && note.items.length > 0 && (
                                    <div className="pt-2">
                                        <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-2 block">Checklist</Label>
                                        <ul className="space-y-2">
                                            {note.items.map((item, idx) => (
                                                <li key={item.id || idx} className="flex items-start justify-between text-sm bg-muted/40 p-2 rounded-md">
                                                    <span className="break-words mr-2">{item.text}</span>
                                                    {item.url && (
                                                        <a
                                                            href={item.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-shrink-0 text-primary hover:text-primary/80 transition-colors"
                                                            title={item.url}
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </a>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </CardContent>
                            {note.relatedUrl && (
                                <CardFooter className="pt-0 border-t bg-muted/20 p-4 mt-auto">
                                    <a
                                        href={note.relatedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline flex items-center gap-2 w-full truncate"
                                    >
                                        <LinkIcon className="h-3 w-3 flex-shrink-0" />
                                        <span className="truncate">{note.relatedUrl}</span>
                                    </a>
                                </CardFooter>
                            )}
                        </Card>
                    ))}
                    {filteredNotes.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg text-muted-foreground bg-muted/10">
                            <NotebookPen className="h-12 w-12 mb-4 opacity-50" />
                            <h3 className="text-lg font-semibold">No notes found</h3>
                            <p className="text-sm">Create a new note to get started.</p>
                        </div>
                    )}
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>{editingNote ? "Edit Note" : "Create Note"}</DialogTitle>
                        <DialogDescription>
                            Add details for your development note.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] pr-4">
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., Implementing New Auth Flow"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="type">Type</Label>
                                <Select value={type} onValueChange={(v: any) => setType(v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="short_term">Short Term</SelectItem>
                                        <SelectItem value="long_term">Long Term</SelectItem>
                                        <SelectItem value="competitor">Competitor Analysis</SelectItem>
                                        <SelectItem value="general">General</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="content">Content</Label>
                                <Textarea
                                    id="content"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Write your notes here..."
                                    className="min-h-[150px]"
                                />
                            </div>

                            <div className="space-y-3 border rounded-lg p-4 bg-muted/10">
                                <div className="flex flex-col gap-2">
                                    <Label>List Items</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Item text..."
                                            value={newItemText}
                                            onChange={(e) => setNewItemText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddItem();
                                                }
                                            }}
                                            className="flex-1"
                                        />
                                        <Input
                                            placeholder="URL (optional)"
                                            value={newItemUrl}
                                            onChange={(e) => setNewItemUrl(e.target.value)}
                                            className="w-1/3"
                                        />
                                        <Button onClick={handleAddItem} size="icon" type="button">
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Press Enter to add item.</p>
                                </div>

                                <div className="space-y-2 mt-2">
                                    {items.map((item) => (
                                        <div key={item.id} className="flex items-center gap-2 bg-background p-2 rounded border">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{item.text}</p>
                                                {item.url && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{item.url}</p>}
                                            </div>
                                            {item.url && <ExternalLink className="h-4 w-4 text-muted-foreground" />}
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="text-destructive h-8 w-8 hover:bg-destructive/10">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {items.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic text-center py-2">No items in list</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="url">Related URL (Optional)</Label>
                                <Input
                                    id="url"
                                    value={relatedUrl}
                                    onChange={(e) => setRelatedUrl(e.target.value)}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>{editingNote ? "Save Changes" : "Create Note"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
