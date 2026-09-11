import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Folder } from "lucide-react";

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Guided quantum computing projects for your portfolio.
          </p>
        </div>
        <Badge variant="outline">Phase 8</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-quantum-accent" aria-hidden="true" />
            Guided Projects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Projects coming in Phase 8"
            description="Guided projects will help you build portfolio-worthy quantum applications. Each project will include step-by-step guidance, real-world use cases, and produce artifacts for your public portfolio."
            icon={<Folder className="h-12 w-12" />}
            className="py-12"
          />
        </CardContent>
      </Card>
    </div>
  );
}
