import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { AlertCircle } from "lucide-react";

export function OrgSetup({ onOrgIdSet }: { onOrgIdSet: () => void }) {
  const [orgId, setOrgId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orgId.trim()) {
      localStorage.setItem('fallbackOrgId', orgId.trim());
      window.location.reload(); // Reload to trigger auth context update
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <CardTitle>Organization Setup Required</CardTitle>
          </div>
          <CardDescription>
            Your Firebase account doesn't have custom claims set. Please enter your organization ID from Firestore to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgId">Organization ID</Label>
              <Input
                id="orgId"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="e.g., org_abc123"
                required
                data-testid="input-org-id"
              />
              <p className="text-sm text-muted-foreground">
                Find this in your Firebase Console → Firestore → orgs collection
              </p>
            </div>

            <Button type="submit" className="w-full" data-testid="button-set-org">
              Continue
            </Button>

            <div className="text-sm text-muted-foreground border-t pt-4">
              <Button
                variant="ghost"
                className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => import('@/lib/firebaseAuth').then(m => m.signOut().then(() => window.location.reload()))}
              >
                Sign Out / Try Different Account
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
