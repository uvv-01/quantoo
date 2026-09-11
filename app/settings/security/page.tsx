import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Shield } from "lucide-react";

export default function SecuritySettingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Security Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account security.
          </p>
        </div>
        <Badge variant="outline">Phase 2</Badge>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-quantum-accent" aria-hidden="true" />
              Account Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Authentication required"
              description="Security features including multi-factor authentication, passkeys, session management, and password changes will be available in Phase 2."
              icon={<Shield className="h-12 w-12" />}
              className="py-12"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
