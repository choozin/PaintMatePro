import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeOperations, Employee, orgRoleOperations } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, User, MoreHorizontal, Mail, Phone, Briefcase, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';


export function EmployeesSettings() {
    const { org: currentOrg, loading: authLoading, currentOrgRole, user, isOwner, isAdmin } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [role, setRole] = useState<string>('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [payType, setPayType] = useState<'hourly' | 'salary'>('hourly');
    const [payRate, setPayRate] = useState<number | ''>('');

    const { data: employees, isLoading: queryLoading } = useQuery({
        queryKey: ['employees', currentOrg?.id],
        queryFn: () => employeeOperations.getByOrg(currentOrg!.id),
        enabled: !!currentOrg,
    });

    const { data: orgRoles = [] } = useQuery({
        queryKey: ['orgRoles', currentOrg?.id],
        queryFn: () => orgRoleOperations.getByOrg(currentOrg!.id),
        enabled: !!currentOrg,
    });

    const isLoading = authLoading || queryLoading;

    // Derive available roles from the org's Roles collection
    const availableRoles = orgRoles.map(r => ({ id: r.id, name: r.name }));

    const canEditRole = !editingEmployee || (editingEmployee.email !== user?.email);
    const canManagePayroll = isOwner || isAdmin || currentOrgRole === 'org_owner' || currentOrgRole === 'org_admin';

    const createMutation = useMutation({
        mutationFn: (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => employeeOperations.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees', currentOrg?.id] });
            setIsDialogOpen(false);
            resetForm();
            toast({ title: "Employee added" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<Employee> }) => employeeOperations.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees', currentOrg?.id] });
            setIsDialogOpen(false);
            resetForm();
            toast({ title: "Employee updated" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => employeeOperations.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees', currentOrg?.id] });
            toast({ title: "Employee deleted" });
        },
    });

    const resetForm = () => {
        setEditingEmployee(null);
        setName('');
        setRole('');
        setEmail('');
        setPhone('');
        setPayType('hourly');
        setPayRate('');
    };

    const handleEdit = (employee: Employee) => {
        setEditingEmployee(employee);
        setName(employee.name);
        setRole(employee.role || '');
        setEmail(employee.email ?? '');
        setPhone(employee.phone ?? '');
        setPayType(employee.payType || 'hourly');
        setPayRate(employee.payRate || '');
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentOrg) return;

        const employeeData: Partial<Employee> = {
            orgId: currentOrg.id,
            name,
            role: role as any,
            email,
            phone,
            payType,
            payRate: payRate === '' ? undefined : Number(payRate),
        };

        try {
            if (editingEmployee) {
                await updateMutation.mutateAsync({ id: editingEmployee.id, data: employeeData });
            } else {
                await createMutation.mutateAsync(employeeData as any);
            }
        } catch (error) {
            console.error("Failed to save employee:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to save employee.",
            });
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                    <CardTitle>Employees</CardTitle>
                    <CardDescription>Manage your staff members.</CardDescription>
                </div>
                {/* Only users who can assign at least one role can add employees (roughly) - plus system admins */}
                {(availableRoles.length > 0 || isOwner || isAdmin) && (
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) resetForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button onClick={resetForm} disabled={!currentOrg || isLoading}><Plus className="h-4 w-4 mr-2" /> Add Employee</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
                                <DialogDescription>Enter employee details.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Doe" required />
                                </div>

                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select
                                        value={role}
                                        onValueChange={setRole}
                                        disabled={!canEditRole}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableRoles.map(r => (
                                                <SelectItem key={r.id} value={r.name}>
                                                    {r.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {!canEditRole && <p className="text-xs text-muted-foreground">You cannot change your own role.</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Email (Optional)</Label>
                                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone (Optional)</Label>
                                        <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" />
                                    </div>
                                </div>

                                {canManagePayroll && (
                                    <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-4">
                                        <div className="space-y-2">
                                            <Label>Pay Type</Label>
                                            <Select
                                                value={payType}
                                                onValueChange={(v: 'hourly' | 'salary') => setPayType(v)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="hourly">Hourly</SelectItem>
                                                    <SelectItem value="salary">Salary</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Pay Rate ($)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={payRate}
                                                onChange={e => setPayRate(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder={payType === 'hourly' ? "e.g. 25.00" : "e.g. 60000"}
                                            />
                                        </div>
                                    </div>
                                )}

                                <DialogFooter>
                                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                        {editingEmployee ? 'Save Changes' : 'Add Employee'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading employees...</div>
                ) : employees?.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <h3 className="text-lg font-medium">No Employees</h3>
                        <p className="text-muted-foreground mb-4">Add your team members to get started.</p>
                        <Button onClick={() => setIsDialogOpen(true)} variant="outline">Add Employee</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {employees?.map(employee => (
                            <div key={employee.id} className="group flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                                <div className="flex items-center gap-4">
                                    <Avatar>
                                        <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold">{employee.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="capitalize">
                                                {employee.role || 'N/A'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center text-sm text-muted-foreground gap-3 mt-1">
                                            {employee.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {employee.email}</span>}
                                            {employee.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {employee.phone}</span>}
                                            {canManagePayroll && employee.payRate && (
                                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                                    <DollarSign className="h-3 w-3" />
                                                    {employee.payType === 'hourly' ? `${employee.payRate}/hr` : `${employee.payRate}/yr`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEdit(employee)}>
                                            <Edit2 className="h-4 w-4 mr-2" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteMutation.mutate(employee.id)}>
                                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
