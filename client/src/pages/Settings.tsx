import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, CreditCard, Lock } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your organization and account settings.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <CardTitle>Organization Details</CardTitle>
          </div>
          <CardDescription>Your company information and preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="org-name">Company Name</Label>
              <Input
                id="org-name"
                defaultValue="Demo Painting Co"
                data-testid="input-company-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select defaultValue="CA">
                <SelectTrigger data-testid="select-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CA">California</SelectItem>
                  <SelectItem value="NY">New York</SelectItem>
                  <SelectItem value="TX">Texas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="units">Default Units</Label>
              <Select defaultValue="metric">
                <SelectTrigger data-testid="select-units">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metric (m, m²)</SelectItem>
                  <SelectItem value="imperial">Imperial (ft, ft²)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button data-testid="button-save-org">Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>Subscription Plan</CardTitle>
          </div>
          <CardDescription>Manage your plan and features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Current Plan</p>
              <p className="text-sm text-muted-foreground">Free tier with basic features</p>
            </div>
            <Badge variant="secondary" className="text-base px-4 py-1">
              FREE
            </Badge>
          </div>
          
          <div className="border rounded-md p-4 space-y-2">
            <p className="font-medium text-sm">Features on Free Plan:</p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• 1 capture per week</li>
              <li>• Basic measurements and quotes</li>
              <li>• PDF exports with watermark</li>
              <li>• Client portal (view only)</li>
              <li>• Lite analytics</li>
            </ul>
          </div>

          <Button variant="outline" data-testid="button-upgrade">
            Upgrade to Pro
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <CardTitle>Security</CardTitle>
          </div>
          <CardDescription>Update your password and security settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              data-testid="input-current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              data-testid="input-new-password"
            />
          </div>
          <Button data-testid="button-change-password">Change Password</Button>
        </CardContent>
      </Card>
    </div>
  );
}
