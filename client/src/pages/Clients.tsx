import { useState } from "react";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import type { Client, Project } from "@/lib/firestore";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ClientDialog } from "@/components/ClientDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MoreHorizontal, Phone, Mail, MapPin, Tag } from "lucide-react";

// Smart Status Logic
function getClientStatus(client: Client & { id: string }, projects: Project[]) {
  const clientProjects = projects.filter(p => p.clientId === client.id);

  // 1. Active Client: Has any project In Progress or Booked (Scheduled)
  const hasActiveProject = clientProjects.some(p => ['in-progress', 'booked'].includes(p.status));
  if (hasActiveProject) {
    return { label: "Active Client", color: "bg-green-100 text-green-800 border-green-200" };
  }

  // 2. Manual Override (Interested, Cold, etc.)
  if (client.leadStatus === 'interested') {
    return { label: "Interested", color: "bg-blue-100 text-blue-800 border-blue-200" };
  }
  if (client.leadStatus === 'cold') {
    return { label: "Cold Lead", color: "bg-gray-100 text-gray-800 border-gray-200" };
  }

  // 3. Past Client: Has Completed/Paid projects ONLY (and no active ones was checked above)
  const hasPastProject = clientProjects.some(p => ['completed', 'paid', 'invoiced'].includes(p.status));
  if (hasPastProject) {
    return { label: "Past Client", color: "bg-slate-100 text-slate-800 border-slate-200" };
  }

  // 4. New Lead: Created < 30 days ago, no projects
  if (client.createdAt) {
    const daysSinceCreation = (new Date().getTime() - client.createdAt.toDate().getTime()) / (1000 * 3600 * 24);
    if (daysSinceCreation < 30) {
      return { label: "New Lead", color: "bg-amber-100 text-amber-800 border-amber-200" };
    }
  }

  // 5. Default
  return { label: "Lead", color: "bg-gray-50 text-gray-600 border-gray-200" };
}

import { CsvImportDialog } from "@/components/CsvImportDialog";
import { ClientDetailDialog } from "@/components/ClientDetailDialog";

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<(Client & { id: string }) | null>(null);
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { t } = useTranslation();

  const isLoading = clientsLoading || projectsLoading;

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads & Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your customer relationships and lead pipeline.</p>
        </div>
        <div className="flex gap-2">
          <CsvImportDialog />
          <ClientDialog mode="create">
            <Button>
              <span className="mr-2">+</span> Add Lead
            </Button>
          </ClientDialog>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        {/* Potentially add Filter dropdowns for Status here later */}
      </div>

      {/* Table Content */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Client / Lead</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Projects</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-10 rounded-full inline-block mr-3" /> <Skeleton className="h-4 w-32 inline-block" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-8 inline-block" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <p>{searchQuery ? "No results found." : "No leads or clients yet."}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => {
                const status = getClientStatus(client, projects);
                const clientProjects = projects.filter(p => p.clientId === client.id);

                return (
                  <TableRow
                    key={client.id}
                    className="group cursor-pointer hover:bg-muted/50"
                    onClick={(e) => {
                      // Prevent opening detail when clicking the action menu
                      if ((e.target as HTMLElement).closest('[data-radix-collection-item], button')) return;
                      setSelectedClient(client);
                    }}
                  >
                    {/* Name & Avatar */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${client.name}`} />
                          <AvatarFallback>{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{client.name}</span>
                          <span className="text-xs text-muted-foreground">Added {client.createdAt ? format(client.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      <Badge variant="outline" className={`font-normal ${status.color}`}>
                        {status.label}
                      </Badge>
                      {/* Show Tags if any */}
                      {client.tags && client.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {client.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-[10px] h-4 px-1">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>

                    {/* Contact Info */}
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        {client.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            <span>{client.email}</span>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Location */}
                    <TableCell>
                      <div className="flex items-start gap-2 max-w-[200px] text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span className="truncate">{client.address || "-"}</span>
                      </div>
                    </TableCell>

                    {/* Projects Count */}
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="font-mono">
                        {clientProjects.length}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <ClientDialog mode="edit" client={client}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              Quick Edit
                            </DropdownMenuItem>
                          </ClientDialog>
                          <DropdownMenuItem onSelect={() => setSelectedClient(client)}>
                            View Full Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ClientDetailDialog
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
        client={selectedClient}
      />
    </div>
  );
}
