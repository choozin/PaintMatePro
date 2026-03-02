import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PortalAuth } from "@/components/portal/PortalAuth";
import { PortalDashboard } from "@/components/portal/PortalDashboard";
import { portalOperations, projectOperations, clientOperations, roomOperations, invoiceOperations, Project, Client, Room, PortalToken, Invoice } from "@/lib/firestore";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ClientPortal() {
  const [match, params] = useRoute("/portal/:token");
  const token = params?.token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenDoc, setTokenDoc] = useState<PortalToken | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [otherProjects, setOtherProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // 1. Validate Token on Mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError("Invalid access link.");
        setLoading(false);
        return;
      }

      try {
        const tokenDoc = await portalOperations.getToken(token);
        if (!tokenDoc) {
          setError("This link is invalid or has expired.");
          setLoading(false);
          return;
        }

        setTokenDoc(tokenDoc);
        setProjectId(tokenDoc.projectId);

        const sessionKey = `portal_session_${token}`;
        const session = localStorage.getItem(sessionKey);
        if (session) {
          setIsAuthenticated(true);
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Token validation error", err);
        setError(`Access Error: ${err.message || "Unknown error occurred"}`);
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);


  // 2. Fetch Project Data Logic
  useEffect(() => {
    async function loadData() {
      if (!isAuthenticated || !projectId) return;

      try {
        const p = await projectOperations.get(projectId);
        if (p) {
          setProject(p);

          // Fetch Client & Rooms
          const [clientData, roomsData, invoiceData] = await Promise.all([
            clientOperations.get(p.clientId),
            roomOperations.getByProject(p.id),
            invoiceOperations.getByProject(p.id)
          ]);

          setInvoices(invoiceData || []);

          if (clientData) {
            setClient(clientData);

            // Securely fetch other projects for this client
            try {
              const clientProjects = await projectOperations.getByClient(clientData.id);
              setOtherProjects(clientProjects);
            } catch (err) {
              console.error("Failed to load linked projects", err);
            }
          }

          if (roomsData) setRooms(roomsData);
        }
      } catch (e: any) {
        console.error("Failed to load portal data", e);
        setError(`Failed to load project data: ${e.message}`);
      }
    }
    loadData();
  }, [isAuthenticated, projectId]);

  // Handle Switching
  const handleSwitchProject = (newProjectId: string) => {
    setProjectId(newProjectId);
    // We don't need to change token unless we want to, 
    // but keeping the same token active is fine for the session if we validated the user
  };


  // RENDER STATES

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !token || !projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-500 shrink-0" />
              <div>
                <h3 className="font-semibold text-lg text-red-700 mb-1">Access Denied</h3>
                <p className="text-muted-foreground">{error || "Unable to access portal."}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PortalLayout
      orgName="PaintMate Pro"
      clientName={client?.name}
      projects={otherProjects}
      currentProjectId={projectId}
      onSwitchProject={handleSwitchProject}
      onLogout={() => {
        localStorage.removeItem(`portal_session_${token}`);
        setIsAuthenticated(false);
      }}
    >
      {!isAuthenticated ? (
        token && projectId && tokenDoc ? (
          <PortalAuth
            token={token}
            projectId={projectId}
            tokenDoc={tokenDoc}
            onAuthenticated={() => setIsAuthenticated(true)}
          />
        ) : null
      ) : (
        project ? (
          <PortalDashboard
            project={project}
            client={client}
            rooms={rooms}
            invoices={invoices}
            onApproveQuote={async () => {
              if (!project || !token) return;
              try {
                // 1. Update Project Status
                await projectOperations.update(project.id, { status: 'booked' });

                // 2. Create Submission Notification
                await portalOperations.submitActivity(project.id, {
                  type: 'note',
                  content: 'Quote Approved via Client Portal',
                  submittedBy: 'client'
                });

                // 3. Update Local State (Optimistic)
                setProject({ ...project, status: 'booked' });
              } catch (e) {
                console.error("Failed to approve quote", e);
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )
      )}
    </PortalLayout>
  );
}
