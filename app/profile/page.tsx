import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { User } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your quantum computing skill profile.
          </p>
        </div>
        <Badge variant="outline">Phase 2</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-quantum-accent" aria-hidden="true" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Authentication required"
              description="User profiles will be available in Phase 2 when authentication is implemented."
              className="py-8"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Public Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Coming in Phase 8"
              description="Your public profile and portfolio will showcase your quantum computing projects and skills."
              className="py-8"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
