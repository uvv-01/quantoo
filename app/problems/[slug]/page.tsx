import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Code } from "lucide-react";

interface ProblemDetailProps {
  params: Promise<{ slug: string }>;
}

export default async function ProblemDetailPage({ params }: ProblemDetailProps) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Problem</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">/{slug}</p>
        </div>
        <Badge variant="outline">Phase 3</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Problem description */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Problem Description</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Problem not yet available"
                description={`The problem "${slug}" will be available when the problem engine is built in Phase 3.`}
                icon={<Code className="h-12 w-12" />}
                className="py-8"
              />
            </CardContent>
          </Card>
        </div>

        {/* Code workspace */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Code Workspace</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Coming in Phase 4"
                description="The code workspace with execution and evaluation will be built in Phase 4."
                className="border-0 p-0 shadow-none"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
