import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useCreateUser } from '@/hooks/useCreateUser';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';

interface AddUserDialogProps {
    orgId: string;
    trigger?: React.ReactNode;
}

export function AddUserDialog({ orgId, trigger }: AddUserDialogProps) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [role, setRole] = useState("member");

    const { mutate: createUser, isPending } = useCreateUser();
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !displayName) return;

        createUser({
            email,
            displayName,
            orgId,
            role
        }, {
            onSuccess: () => {
                toast({
                    title: "User Added",
                    description: `${displayName} has been added to the organization.`,
                });
                setOpen(false);
                setEmail("");
                setDisplayName("");
                setRole("member");
            },
            onError: (error: any) => {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to add user.",
                });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add User
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add User to Organization</DialogTitle>
                    <DialogDescription>
                        Create a profile for a new user. They will need to sign up with this email address.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="displayName">Full Name</Label>
                        <Input
                            id="displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="John Doe"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="john@example.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="owner">Owner</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Add User
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
