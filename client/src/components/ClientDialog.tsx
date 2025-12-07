import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useCreateClient, useUpdateClient } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/lib/firestore";
import { Plus, Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useTranslation } from "react-i18next";

const clientFormSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number cannot exceed 15 digits"),
  mobilePhone: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  leadStatus: z.enum(['new', 'interested', 'cold', 'archived']).optional(),
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
  const { t } = useTranslation();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      mobilePhone: "",
      address: "",
      leadStatus: "new",
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
        mobilePhone: client.mobilePhone || "",
        address: client.address,
        leadStatus: client.leadStatus || "new",
      });
    }
  }, [client, mode, form]);

  const onSubmit = async (values: ClientFormValues) => {
    try {
      if (mode === "edit" && client) {
        await updateClient.mutateAsync({ id: client.id, data: values });
        toast({
          title: t('common.success'),
          description: "Client has been successfully updated",
        });
      } else {
        await createClient.mutateAsync(values);
        toast({
          title: t('common.success'),
          description: "Client has been successfully created",
        });
      }

      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
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
        mobilePhone: "",
        address: "",
        leadStatus: "new",
      });
    } else if (client) {
      form.reset({
        name: client.name,
        email: client.email,
        phone: client.phone,
        mobilePhone: client.mobilePhone || "",
        address: client.address,
        leadStatus: client.leadStatus || "new",
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
      {t('clients.create_new')}
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
          <DialogTitle>{mode === "create" ? t('clients.dialog.add_title') : t('clients.dialog.edit_title')}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? t('clients.dialog.add_description') : t('clients.dialog.edit_description')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('clients.dialog.name')} *</FormLabel>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('clients.dialog.email')} *</FormLabel>
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
                name="leadStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new">New Lead</SelectItem>
                        <SelectItem value="interested">Interested</SelectItem>
                        <SelectItem value="cold">Cold</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('clients.dialog.phone')} *</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="(555) 123-4567"
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
                name="mobilePhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMS Text Number (if different)</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="(555) 987-6543"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('clients.dialog.address')} *</FormLabel>
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
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createClient.isPending || updateClient.isPending}
                data-testid="button-submit-client"
              >
                {createClient.isPending || updateClient.isPending
                  ? "Saving..."
                  : mode === "create"
                    ? t('clients.dialog.create_button')
                    : t('clients.dialog.update_button')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
