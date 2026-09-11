import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Code, Filter } from "lucide-react";

export default function ProblemsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Problems</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quantum computing challenges to build your skills.
          </p>
        </div>
        <Badge variant="outline">Phase 3</Badge>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-6 p-3 rounded-lg border bg-muted/30">
        <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">
          Filtering will be available when problems are added in Phase 3.
        </span>
      </div>

      {/* Problem list placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-quantum-accent" aria-hidden="true" />
            Problem Catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No problems available yet"
            description="The problem catalog will be populated in Phase 3. Problems will cover qubits, gates, circuits, entanglement, measurement, and more."
            icon={<Code className="h-12 w-12" />}
            className="py-12"
          />
        </CardContent>
      </Card>
    </div>
  );
}
