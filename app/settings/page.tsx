import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Settings, Shield } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account and preferences.
          </p>
        </div>
        <Badge variant="outline">Phase 2</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-quantum-accent" aria-hidden="true" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Authentication required"
              description="Account settings will be available in Phase 2 when authentication is implemented."
              className="py-8"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Link
                href="/settings/security"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Shield className="h-5 w-5 text-quantum-accent" aria-hidden="true" />
                Security Settings
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Authentication required"
              description="Security settings including MFA, password change, and session management will be available in Phase 2."
              className="py-8"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
