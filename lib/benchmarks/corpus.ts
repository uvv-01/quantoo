/**
 * Official benchmark corpus (Phase 8).
 *
 * Benchmark definitions are application-managed data: fixed programs and
 * execution configurations that any user can run in any registered
 * environment to measure behavior over time. Users cannot define new
 * benchmarks via the API — the corpus grows through code changes, so a
 * benchmark's meaning stays stable and reviewable.
 *
 * Sources are plain Python using only the runtime's approved imports.
 */

export interface BenchmarkDefinition {
  slug: string;
  name: string;
  description: string;
  category:
    | "STATE_PREPARATION"
    | "ENTANGLEMENT"
    | "MEASUREMENT"
    | "ALGORITHMIC"
    | "COMPATIBILITY";
  sourceCode: string;
  shots: number;
  seed: number | null;
}

export const BENCHMARK_CORPUS: BenchmarkDefinition[] = [
  {
    slug: "zero-state-baseline",
    name: "Zero State Baseline",
    description:
      "Prepares the computational zero state and measures it. Every shot should return '0'. A run that deviates indicates a fundamental execution or sampling difference.",
    category: "STATE_PREPARATION",
    shots: 1024,
    seed: null,
    sourceCode: [
      "from qiskit import QuantumCircuit",
      "",
      "qc = QuantumCircuit(1, 1)",
      "qc.measure(0, 0)",
      "",
      "result = qc",
    ].join("\n"),
  },
  {
    slug: "superposition-uniformity",
    name: "Superposition Uniformity",
    description:
      "Applies H to |0> and samples. The empirical distribution should be near-uniform; deviations between environments indicate sampling or simulation differences.",
    category: "STATE_PREPARATION",
    shots: 2048,
    seed: null,
    sourceCode: [
      "from qiskit import QuantumCircuit",
      "",
      "qc = QuantumCircuit(1, 1)",
      "qc.h(0)",
      "qc.measure(0, 0)",
      "",
      "result = qc",
    ].join("\n"),
  },
  {
    slug: "bell-entanglement",
    name: "Bell State Entanglement",
    description:
      "Prepares the Bell state |Phi+> and samples. Only '00' and '11' should occur, with roughly equal probability.",
    category: "ENTANGLEMENT",
    shots: 2048,
    seed: null,
    sourceCode: [
      "from qiskit import QuantumCircuit",
      "",
      "qc = QuantumCircuit(2, 2)",
      "qc.h(0)",
      "qc.cx(0, 1)",
      "qc.measure([0, 1], [0, 1])",
      "",
      "result = qc",
    ].join("\n"),
  },
  {
    slug: "ghz-three-qubit",
    name: "Three-Qubit GHZ",
    description:
      "Prepares the 3-qubit GHZ state. Only '000' and '111' should occur; excess outcomes indicate crosstalk-model or simulation differences.",
    category: "ENTANGLEMENT",
    shots: 2048,
    seed: null,
    sourceCode: [
      "from qiskit import QuantumCircuit",
      "",
      "qc = QuantumCircuit(3, 3)",
      "qc.h(0)",
      "qc.cx(0, 1)",
      "qc.cx(1, 2)",
      "qc.measure([0, 1, 2], [0, 1, 2])",
      "",
      "result = qc",
    ].join("\n"),
  },
  {
    slug: "grover-two-qubit",
    name: "Grover Search (2 qubits)",
    description:
      "Runs one Grover iteration for the |11> marked state and samples. '11' should dominate the distribution.",
    category: "ALGORITHMIC",
    shots: 2048,
    seed: null,
    sourceCode: [
      "from qiskit import QuantumCircuit",
      "",
      "qc = QuantumCircuit(2, 2)",
      "qc.h([0, 1])",
      "qc.cz(0, 1)",
      "qc.h([0, 1])",
      "qc.x([0, 1])",
      "qc.h(1)",
      "qc.cx(0, 1)",
      "qc.h(1)",
      "qc.x([0, 1])",
      "qc.h([0, 1])",
      "qc.measure([0, 1], [0, 1])",
      "",
      "result = qc",
    ].join("\n"),
  },
];

export const BENCHMARK_SLUGS = BENCHMARK_CORPUS.map((b) => b.slug) as [
  string,
  ...string[],
];

export function getBenchmarkDefinition(slug: string): BenchmarkDefinition | null {
  return BENCHMARK_CORPUS.find((b) => b.slug === slug) ?? null;
}
