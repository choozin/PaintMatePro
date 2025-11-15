import { ClientCard } from "@/components/ClientCard";
import { ClientDialog } from "@/components/ClientDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import type { Client } from "@/lib/firestore";
import { Skeleton } from "@/components/ui/skeleton";

function ClientCardWithProjects({ client }: { client: Client & { id: string } }) {
  const { data: projects = [] } = useProjects();
  const projectCount = projects.filter(p => p.clientId === client.id).length;

  return (
    <ClientCard
      id={client.id}
      name={client.name}
      email={client.email}
      phone={client.phone}
      address={client.address}
      projectCount={projectCount}
      onClick={() => console.log(`View client ${client.id}`)}
    />
  );
}

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: clients = [], isLoading } = useClients();

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Clients</h1>
          <p className="text-muted-foreground mt-2">Manage your client relationships.</p>
        </div>
        <ClientDialog mode="create" />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-clients"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex flex-col space-y-3 rounded-lg border p-6">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex justify-end pt-4">
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery ? 'No clients match your search.' : 'No clients yet. Add your first client to get started!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <ClientCardWithProjects key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}
