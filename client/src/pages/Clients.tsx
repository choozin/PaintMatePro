import { ClientCard } from "@/components/ClientCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState("");

  const mockClients = [
    {
      id: "1",
      name: "John Smith",
      email: "john.smith@email.com",
      phone: "(555) 123-4567",
      address: "123 Main St, Oakland, CA 94612",
      projectCount: 3,
    },
    {
      id: "2",
      name: "Tech Startup Inc",
      email: "contact@techstartup.com",
      phone: "(555) 234-5678",
      address: "456 Market St, San Francisco, CA 94102",
      projectCount: 1,
    },
    {
      id: "3",
      name: "Property Management LLC",
      email: "admin@propertymgmt.com",
      phone: "(555) 345-6789",
      address: "789 Oak Ave, Berkeley, CA 94704",
      projectCount: 5,
    },
    {
      id: "4",
      name: "Retail Corp",
      email: "facilities@retailcorp.com",
      phone: "(555) 456-7890",
      address: "321 Elm St, Oakland, CA 94607",
      projectCount: 2,
    },
    {
      id: "5",
      name: "Logistics Inc",
      email: "ops@logistics.com",
      phone: "(555) 567-8901",
      address: "555 Industrial Pkwy, Fremont, CA 94538",
      projectCount: 1,
    },
  ];

  const filteredClients = mockClients.filter((client) =>
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
        <Button data-testid="button-create-client">
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <ClientCard
            key={client.id}
            {...client}
            onClick={() => console.log(`View client ${client.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
