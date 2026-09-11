import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Learn</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Structured quantum computing learning paths.
          </p>
        </div>
        <Badge variant="outline">Phase 3</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Quantum Fundamentals", description: "Qubits, gates, measurement, and superposition." },
          { title: "Circuit Design", description: "Build multi-qubit circuits and understand entanglement." },
          { title: "Algorithms", description: "Grover, Shor, VQE, and beyond." },
          { title: "Error Correction", description: "Understand noise and quantum error correction codes." },
          { title: "Optimization", description: "Circuit optimization and transpilation techniques." },
          { title: "Hardware", description: "Real quantum hardware and hybrid classical-quantum systems." },
        ].map((topic) => (
          <Card key={topic.title}>
            <CardHeader>
              <CardTitle className="text-lg">{topic.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{topic.description}</p>
              <Badge variant="secondary" className="mt-3">
                Coming in Phase 3
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
