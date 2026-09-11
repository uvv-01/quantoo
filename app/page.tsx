import Link from "next/link";
import {
  BookOpen,
  Code,
  Cpu,
  FlaskConical,
  Wrench,
  Target,
  Zap,
  Shield,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROUTES, APP_DESCRIPTION } from "@/lib/constants";

const workflowSteps = [
  { icon: BookOpen, label: "Learn", description: "Build quantum fundamentals" },
  { icon: Target, label: "Challenge", description: "Daily quantum problems" },
  { icon: Code, label: "Write", description: "Quantum circuits & code" },
  { icon: Cpu, label: "Execute", description: "Simulate on Qiskit Aer" },
  { icon: FlaskConical, label: "Test", description: "Verify correctness" },
  { icon: Wrench, label: "Debug", description: "Step through execution" },
  { icon: Zap, label: "Optimize", description: "Reduce gate count & depth" },
  { icon: Shield, label: "Hardware", description: "Run on real quantum devices" },
];

const featureCards = [
  {
    title: "Quantum Judge",
    description:
      "Multi-layer evaluation: structural, functional, state, distribution, unitary, observable, entanglement, and statistical analysis.",
    badge: "Planned",
    badgeVariant: "secondary" as const,
  },
  {
    title: "Quantum Debugger",
    description:
      "Step through quantum execution with breakpoints, state snapshots, probability distributions, and gate traces.",
    badge: "Planned",
    badgeVariant: "secondary" as const,
  },
  {
    title: "Noise Simulation",
    description:
      "Simulate real-world noise models and learn how quantum error correction addresses decoherence.",
    badge: "Planned",
    badgeVariant: "secondary" as const,
  },
  {
    title: "Real Hardware",
    description:
      "Transpile and execute circuits on actual quantum processors from IBM, Google, and others.",
    badge: "Planned",
    badgeVariant: "secondary" as const,
  },
];

const roadmapPhases = [
  { phase: 1, name: "Foundation", status: "current" },
  { phase: 2, name: "Authentication", status: "planned" },
  { phase: 3, name: "Problem Engine", status: "planned" },
  { phase: 4, name: "Execution + Judge", status: "planned" },
  { phase: 5, name: "Debugger", status: "planned" },
  { phase: 6, name: "Noise + Optimization", status: "planned" },
  { phase: 7, name: "Real Hardware", status: "planned" },
  { phase: 8, name: "Projects + Portfolio", status: "planned" },
  { phase: 9, name: "AI Tutor + Production", status: "planned" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-4">
              Phase 1 — Foundation
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Quantum Daily
            </h1>
            <p className="mt-3 text-xl font-medium text-quantum-accent sm:text-2xl">
              Practice quantum computing like an engineer.
            </p>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl text-pretty">
              {APP_DESCRIPTION}. Quantum Daily is a developer-first platform for learning, building,
              testing, debugging, and optimizing quantum programs — from simulation to real hardware.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg">
                <Link href={ROUTES.problems} className="flex items-center gap-2">
                  Start Solving
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline">
                <Link href={ROUTES.learn}>Learn Quantum Computing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="border-b" aria-labelledby="workflow-heading">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="text-center">
            <h2 id="workflow-heading" className="text-3xl font-bold tracking-tight">
              The Complete Quantum Workflow
            </h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
              From learning fundamentals to running on real quantum hardware.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {workflowSteps.map((step) => (
              <div key={step.label} className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <span className="mt-3 text-sm font-semibold">{step.label}</span>
                <span className="mt-1 text-xs text-muted-foreground">{step.description}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground italic">
            This workflow is the vision for the complete platform. Features are being built
            incrementally across nine phases.
          </p>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section className="border-b bg-muted/30" aria-labelledby="features-heading">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="text-center">
            <h2 id="features-heading" className="text-3xl font-bold tracking-tight">
              Built for Quantum Engineers
            </h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
              Tools designed to handle the complexity of quantum computing.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((feature) => (
              <Card key={feature.title} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <Badge variant={feature.badgeVariant}>{feature.badge}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="border-b" aria-labelledby="roadmap-heading">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="text-center">
            <h2 id="roadmap-heading" className="text-3xl font-bold tracking-tight">
              Development Roadmap
            </h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
              Nine phases from foundation to production.
            </p>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-3 lg:grid-cols-9">
            {roadmapPhases.map((phase) => (
              <div
                key={phase.phase}
                className={`flex flex-col items-center rounded-lg border p-4 text-center transition-colors ${
                  phase.status === "current"
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  Phase {phase.phase}
                </span>
                <span
                  className={`mt-1 text-sm font-semibold ${
                    phase.status === "current" ? "text-primary" : ""
                  }`}
                >
                  {phase.name}
                </span>
                {phase.status === "current" && (
                  <Badge variant="default" className="mt-2 text-[10px]">
                    Current
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-b bg-muted/30" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 text-center">
          <h2 id="cta-heading" className="text-3xl font-bold tracking-tight">
            Ready to Build Quantum Programs?
          </h2>
          <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
            Start with foundational problems and build your quantum skills systematically.
          </p>            <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg">
              <Link href={ROUTES.problems} className="flex items-center gap-2">
                Browse Problems
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline">
              <Link href={ROUTES.learn}>View Learning Path</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
