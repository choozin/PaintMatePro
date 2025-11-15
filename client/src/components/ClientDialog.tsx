import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useCreateClient, useUpdateClient } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/lib/firestore";
import { Plus, Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const clientFormSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number cannot exceed 15 digits"),
  address: z.string().min(1, "Address is required"),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientDialogProps {
  client?: Client & { id: string };
  trigger?: React.ReactNode;
  mode?: "create" | "edit";
  onSuccess?: () => void;
}

export function ClientDialog({ client, trigger, mode = "create", onSuccess }: ClientDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
    },
  });

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  useEffect(() => {
    if (client && mode === "edit") {
      form.reset({
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
      });
    }
  }, [client, mode, form]);

  const onSubmit = async (values: ClientFormValues) => {
    try {
      if (mode === "edit" && client) {
        await updateClient.mutateAsync({ id: client.id, data: values });
        toast({
          title: "Client Updated",
          description: "Client has been successfully updated",
        });
      } else {
        await createClient.mutateAsync(values);
        toast({
          title: "Client Created",
          description: "Client has been successfully created",
        });
      }

      setOpen(false);
      form.reset(); // Reset form after successful submission
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
      form.reset({
        name: "",
        email: "",
        phone: "",
        address: "",
      });
    } else if (client) {
      form.reset({
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
      });
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., John Smith"
                      data-testid="input-client-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="e.g., john@example.com"
                      data-testid="input-client-email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone *</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="e.g., (555) 123-4567"
                      data-testid="input-client-phone"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., 123 Main St, Cityville, ST 12345"
                      data-testid="input-client-address"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
