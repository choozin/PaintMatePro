import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crewOperations, Crew, employeeOperations } from '@/lib/firestore';
import { CREW_PALETTES } from '@/lib/crew-palettes';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, Users, Palette, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export function CrewsSettings() {
    const { org: currentOrg } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCrew, setEditingCrew] = useState<Crew | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [color, setColor] = useState('#3b82f6'); // Default Blue
    const [paletteId, setPaletteId] = useState(CREW_PALETTES[0].id);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [specs, setSpecs] = useState<Record<string, string>>({});

    const { data: crews, isLoading } = useQuery({
        queryKey: ['crews', currentOrg?.id],
        queryFn: () => crewOperations.getByOrg(currentOrg!.id),
        enabled: !!currentOrg,
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees', currentOrg?.id],
        queryFn: () => employeeOperations.getByOrg(currentOrg!.id),
        enabled: !!currentOrg,
    });

    const createMutation = useMutation({
        mutationFn: (data: Omit<Crew, 'id' | 'createdAt' | 'updatedAt'>) => crewOperations.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crews', currentOrg?.id] });
            setIsDialogOpen(false);
            resetForm();
            toast({ title: "Crew created" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<Crew> }) => crewOperations.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crews', currentOrg?.id] });
            setIsDialogOpen(false);
            resetForm();
            toast({ title: "Crew updated" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => crewOperations.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crews', currentOrg?.id] });
            toast({ title: "Crew deleted" });
        },
    });

    const resetForm = () => {
        setEditingCrew(null);
        setName('');
        setColor('#3b82f6');
        setPaletteId(CREW_PALETTES[0].id);
        setSelectedMemberIds([]);
        setSpecs({});
    };

    const handleEdit = (crew: Crew) => {
        setEditingCrew(crew);
        setName(crew.name);
        setColor(crew.color);
        setPaletteId(crew.paletteId || CREW_PALETTES[0].id);
        setSelectedMemberIds(crew.memberIds || []);
        setSpecs(crew.specs || {});
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentOrg) return;

        const crewData = {
            orgId: currentOrg.id,
            name,
            color,
            paletteId,
            memberIds: selectedMemberIds,
            specs,
        };

        if (editingCrew) {
            updateMutation.mutate({ id: editingCrew.id, data: crewData });
        } else {
            createMutation.mutate(crewData);
        }
    };

    // Specs Management Helper (Simplified for V1: Just a string representation or simple add row?)
    // Let's keep specs simple for this iteration: Add generic specs via text or limit scope.
    // User asked for "customize each crews specs". Let's provide a key-value list.
    const [newSpecKey, setNewSpecKey] = useState('');
    const [newSpecValue, setNewSpecValue] = useState('');

    const addSpec = () => {
        if (newSpecKey && newSpecValue) {
            setSpecs(prev => ({ ...prev, [newSpecKey]: newSpecValue }));
            setNewSpecKey('');
            setNewSpecValue('');
        }
    };

    const removeSpec = (key: string) => {
        const newSpecs = { ...specs };
        delete newSpecs[key];
        setSpecs(newSpecs);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                    <CardTitle>Crews</CardTitle>
                    <CardDescription>Manage your work crews and their capabilities.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}><Plus className="h-4 w-4 mr-2" /> Add Crew</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingCrew ? 'Edit Crew' : 'Add New Crew'}</DialogTitle>
                            <DialogDescription>Define the crew details and specifications.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Crew Name</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alpha Team" required />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Visual Style</Label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {CREW_PALETTES.map(p => (
                                            <div
                                                key={p.id}
                                                className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-all ${paletteId === p.id ? 'border-black ring-2 ring-offset-1 ring-black/20' : 'border-transparent hover:scale-105'}`}
                                                style={{ backgroundColor: p.previewColor }}
                                                title={p.name}
                                                onClick={() => {
                                                    setPaletteId(p.id);
                                                    setColor(p.previewColor); // Sync for backwards compat
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Selected: {CREW_PALETTES.find(p => p.id === paletteId)?.name}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Crew Members</Label>
                                    <div className="border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-2">
                                        {employees.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No employees found. Add employees in the "Employees" tab first.</p>
                                        ) : (
                                            employees.map(emp => (
                                                <div key={emp.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`emp-${emp.id}`}
                                                        checked={selectedMemberIds.includes(emp.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedMemberIds([...(selectedMemberIds || []), emp.id]);
                                                            } else {
                                                                setSelectedMemberIds((selectedMemberIds || []).filter(id => id !== emp.id));
                                                            }
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={`emp-${emp.id}`}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {emp.name} <span className="text-muted-foreground text-xs">({emp.role})</span>
                                                    </label>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 border-t pt-4">
                                <Label>Crew Specs / Attributes</Label>
                                <div className="flex gap-2">
                                    <Input value={newSpecKey} onChange={e => setNewSpecKey(e.target.value)} placeholder="Attribute (e.g. Size)" className="flex-1" />
                                    <Input value={newSpecValue} onChange={e => setNewSpecValue(e.target.value)} placeholder="Value (e.g. 4-man)" className="flex-1" />
                                    <Button type="button" variant="secondary" onClick={addSpec}>Add</Button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {Object.entries(specs).map(([k, v]) => (
                                        <Badge key={k} variant="outline" className="pl-2 pr-1 py-1 flex items-center gap-1">
                                            {k}: <span className="font-semibold">{v}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-4 ml-1 hover:bg-transparent hover:text-destructive"
                                                onClick={() => removeSpec(k)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                    {editingCrew ? 'Save Changes' : 'Create Crew'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading crews...</div>
                ) : crews?.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <h3 className="text-lg font-medium">No Crews Found</h3>
                        <p className="text-muted-foreground mb-4">Set up your first crew to start tracking assignments.</p>
                        <Button onClick={() => setIsDialogOpen(true)} variant="outline">Create Crew</Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {crews?.map(crew => {
                            const palette = CREW_PALETTES.find(p => p.id === crew.paletteId);
                            const cardClass = palette ? palette.class : 'bg-card border-border';

                            return (
                                <div key={crew.id} className={`group border rounded-lg p-4 transition-colors relative ${cardClass}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            {!palette && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: crew.color }} />}
                                            <h3 className="font-semibold text-lg">{crew.name}</h3>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(crew)}>
                                                    <Edit2 className="h-4 w-4 mr-2" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteMutation.mutate(crew.id)}>
                                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Members</div>
                                            <div className="flex flex-wrap gap-1">
                                                {crew.memberIds && crew.memberIds.length > 0 ? (
                                                    crew.memberIds.map((mId, i) => {
                                                        const emp = employees.find(e => e.id === mId);
                                                        return (
                                                            <Badge key={i} variant="secondary" className="text-xs font-normal">
                                                                {emp ? emp.name : 'Unknown'}
                                                            </Badge>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="text-sm text-muted-foreground italic">No members assigned</span>
                                                )}
                                            </div>
                                        </div>

                                        {crew.specs && Object.keys(crew.specs).length > 0 && (
                                            <div>
                                                <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Specs</div>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                                    {Object.entries(crew.specs).map(([k, v]) => (
                                                        <div key={k} className="flex justify-between border-b border-dashed border-muted pb-0.5 last:border-0">
                                                            <span className="text-muted-foreground">{k}:</span>
                                                            <span className="font-medium">{v}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
