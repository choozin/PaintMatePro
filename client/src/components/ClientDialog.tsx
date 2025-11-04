import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useCreateClient, useUpdateClient } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/lib/firestore";
import { Plus, Edit } from "lucide-react";

interface ClientDialogProps {
  client?: Client & { id: string };
  trigger?: React.ReactNode;
  mode?: "create" | "edit";
  onSuccess?: () => void;
}

export function ClientDialog({ client, trigger, mode = "create", onSuccess }: ClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const { toast } = useToast();

  useEffect(() => {
    if (client && mode === "edit") {
      setName(client.name);
      setEmail(client.email);
      setPhone(client.phone);
      setAddress(client.address);
    }
  }, [client, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !phone || !address) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    try {
      const clientData = {
        name,
        email,
        phone,
        address,
      };

      if (mode === "edit" && client) {
        await updateClient.mutateAsync({ id: client.id, data: clientData });
        toast({
          title: "Client Updated",
          description: "Client has been successfully updated",
        });
      } else {
        await createClient.mutateAsync(clientData);
        toast({
          title: "Client Created",
          description: "Client has been successfully created",
        });
      }

      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save client",
      });
    }
  };

  const resetForm = () => {
    if (mode === "create") {
      setName("");
      setEmail("");
      setPhone("");
      setAddress("");
    } else if (client) {
      setName(client.name);
      setEmail(client.email);
      setPhone(client.phone);
      setAddress(client.address);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTimeout(() => resetForm(), 200);
    }
  };

  const defaultTrigger = mode === "create" ? (
    <Button data-testid="button-add-client">
      <Plus className="h-4 w-4 mr-2" />
      Add Client
    </Button>
  ) : (
    <Button variant="ghost" size="sm" data-testid={`button-edit-client-${client?.id}`}>
      <Edit className="h-4 w-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New Client" : "Edit Client"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Add a new client to your system" : "Update client details"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., John Smith"
              required
              data-testid="input-client-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., john@example.com"
              required
              data-testid="input-client-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., (555) 123-4567"
              required
              data-testid="input-client-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 123 Main St, Cityville, ST 12345"
              required
              data-testid="input-client-address"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              data-testid="button-cancel-client"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createClient.isPending || updateClient.isPending}
              data-testid="button-submit-client"
            >
              {createClient.isPending || updateClient.isPending
                ? "Saving..."
                : mode === "create"
                ? "Create Client"
                : "Update Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
