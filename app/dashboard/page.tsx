import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Target,
  BookOpen,
  BarChart3,
  Activity,
  Folder,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your quantum learning overview.
          </p>
        </div>
        <Badge variant="outline">Phase 1</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Today's Challenge */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-quantum-accent" aria-hidden="true" />
              Today&apos;s Challenge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No challenge yet"
              description="Daily challenges will be available in Phase 3."
              className="border-0 p-0 shadow-none"
            />
          </CardContent>
        </Card>

        {/* Continue Learning */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-quantum-accent" aria-hidden="true" />
              Continue Learning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No progress yet"
              description="Learning paths will be available in Phase 3."
              className="border-0 p-0 shadow-none"
            />
          </CardContent>
        </Card>

        {/* Skill Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-quantum-accent" aria-hidden="true" />
              Skill Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No skill data"
              description="Skills will be tracked as you solve problems."
              className="border-0 p-0 shadow-none"
            />
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-quantum-accent" aria-hidden="true" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No activity yet"
              description="Solve your first challenge to begin building your quantum skill profile."
              className="border-0 p-0 shadow-none"
            />
          </CardContent>
        </Card>
      </div>

      {/* Projects Section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-quantum-accent" aria-hidden="true" />
              Projects
            </CardTitle>
            <Link
              href="/projects"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No projects yet"
            description="Guided projects will be available in Phase 8. They will let you build portfolio-worthy quantum applications."
            icon={<Folder className="h-12 w-12" />}
            className="py-8"
          />
        </CardContent>
      </Card>
    </div>
  );
}
