import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useCreateClient } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface CreateClientDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (clientId: string) => void;
    initialName?: string;
}

export function CreateClientDialog({ open, onOpenChange, onSuccess, initialName = "" }: CreateClientDialogProps) {
    const [name, setName] = useState(initialName);
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");

    const createClient = useCreateClient();
    const { toast } = useToast();
    const { t } = useTranslation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Name is required",
            });
            return;
        }

        try {
            const clientId = await createClient.mutateAsync({
                name,
                email,
                phone,
                address,
            });

            toast({
                title: "Success",
                description: "Lead created successfully",
            });

            onSuccess?.(clientId);
            onOpenChange(false);

            // Reset form
            setName("");
            setEmail("");
            setPhone("");
            setAddress("");
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to create lead",
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Lead</DialogTitle>
                    <DialogDescription>
                        Quickly add a new lead to potential projects.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="lead-name">Name *</Label>
                        <Input
                            id="lead-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Full Name"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lead-email">Email</Label>
                        <Input
                            id="lead-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="email@example.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lead-phone">Phone</Label>
                        <Input
                            id="lead-phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="(555) 123-4567"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lead-address">Address</Label>
                        <Input
                            id="lead-address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Street Address, City"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createClient.isPending}>
                            {createClient.isPending ? "Adding..." : "Add Lead"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
