import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, MapPin } from "lucide-react";

interface ClientCardProps {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  projectCount: number;
  onClick?: () => void;
}

export function ClientCard({
  id,
  name,
  email,
  phone,
  address,
  projectCount,
  onClick,
}: ClientCardProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <Card className="hover-elevate" data-testid={`card-client-${id}`}>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {projectCount} {projectCount === 1 ? "project" : "projects"}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate">{email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{phone}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate">{address}</span>
          </div>
          {onClick && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-4"
              onClick={onClick}
              data-testid={`button-view-client-${id}`}
            >
              View Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
