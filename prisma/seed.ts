/**
 * Prisma Seed Script — Quantum Daily
 *
 * Seeds the database with:
 * - Quantum concepts (reusable taxonomy)
 * - Tags
 * - Learning topics
 * - 5 high-quality educational seed problems
 *
 * Run with: npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function lines(...parts: string[]): string {
  return parts.join("\n");
}

async function main() {
  console.log("Seeding database...");

  // ========================================
  // Concepts
  // ========================================
  const concepts = await Promise.all([
    prisma.concept.upsert({
      where: { slug: "qubits" },
      update: {},
      create: {
        name: "Qubits",
        slug: "qubits",
        description:
          "The fundamental unit of quantum information. A qubit can exist in a superposition of |0> and |1> states.",
        category: "foundations",
      },
    }),
    prisma.concept.upsert({
      where: { slug: "quantum-states" },
      update: {},
      create: {
        name: "Quantum States",
        slug: "quantum-states",
        description:
          "Mathematical description of a quantum system using state vectors in a Hilbert space.",
        category: "foundations",
      },
    }),
    prisma.concept.upsert({
      where: { slug: "superposition" },
      update: {},
      create: {
        name: "Superposition",
        slug: "superposition",
        description:
          "A qubit can exist in a combination of |0> and |1> simultaneously until measured.",
        category: "foundations",
      },
    }),
    prisma.concept.upsert({
      where: { slug: "measurement" },
      update: {},
      create: {
        name: "Measurement",
        slug: "measurement",
        description:
          "The process of observing a qubit, which collapses its superposition to a definite state.",
        category: "foundations",
      },
    }),
    prisma.concept.upsert({
      where: { slug: "quantum-gates" },
      update: {},
      create: {
        name: "Quantum Gates",
        slug: "quantum-gates",
        description:
          "Unitary operations that manipulate qubit states. The building blocks of quantum circuits.",
        category: "gates",
      },
    }),
    prisma.concept.upsert({
      where: { slug: "x-gate" },
      update: {},
      create: {
        name: "Pauli-X Gate",
        slug: "x-gate",
        description:
          "A single-qubit gate that flips |0> to |1> and vice versa. The quantum analog of a classical NOT gate.",
        category: "gates",
      },
    }),
    prisma.concept.upsert({
      where: { slug: "hadamard-gate" },
      update: {},
      create: {
        name: "Hadamard Gate",
        slug: "hadamard-gate",
        description:
          "A single-qubit gate that creates equal superposition. Maps |0> to (|0>+|1>)/sqrt(2) and |1> to (|0>-|1>)/sqrt(2).",
        category: "gates",
      },
    }),
    prisma.concept.upsert({
      where: { slug: "entanglement" },
      update: {},
      create: {
        name: "Entanglement",
        slug: "entanglement",
        description:
          "A quantum correlation between qubits where the state of one qubit cannot be described independently of the other.",
        category: "multi-qubit",
      },
    }),
    prisma.concept.upsert({
      where: { slug: "bell-states" },
      update: {},
      create: {
        name: "Bell States",
        slug: "bell-states",
        description:
          "The four maximally entangled two-qubit states. A fundamental resource in quantum computing and communication.",
        category: "multi-qubit",
      },
    }),
    prisma.concept.upsert({
      where: { slug: "quantum-circuits" },
      update: {},
      create: {
        name: "Quantum Circuits",
        slug: "quantum-circuits",
        description:
          "A sequence of quantum gates applied to qubits, read from left to right.",
        category: "circuits",
      },
    }),
  ]);

  console.log("Created " + concepts.length + " concepts");

  // ========================================
  // Tags
  // ========================================
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { slug: "single-qubit" }, update: {}, create: { name: "Single Qubit", slug: "single-qubit" } }),
    prisma.tag.upsert({ where: { slug: "multi-qubit" }, update: {}, create: { name: "Multi-Qubit", slug: "multi-qubit" } }),
    prisma.tag.upsert({ where: { slug: "measurement" }, update: {}, create: { name: "Measurement", slug: "measurement" } }),
    prisma.tag.upsert({ where: { slug: "gates" }, update: {}, create: { name: "Gates", slug: "gates" } }),
    prisma.tag.upsert({ where: { slug: "entanglement" }, update: {}, create: { name: "Entanglement", slug: "entanglement" } }),
    prisma.tag.upsert({ where: { slug: "circuits" }, update: {}, create: { name: "Circuits", slug: "circuits" } }),
    prisma.tag.upsert({ where: { slug: "superposition" }, update: {}, create: { name: "Superposition", slug: "superposition" } }),
    prisma.tag.upsert({ where: { slug: "basics" }, update: {}, create: { name: "Basics", slug: "basics" } }),
  ]);

  console.log("Created " + tags.length + " tags");

  // ========================================
  // Learning Topics
  // ========================================

  const foundationsTopic = await prisma.learningTopic.upsert({
    where: { slug: "quantum-computing-basics" },
    update: {},
    create: {
      title: "Quantum Computing Basics",
      slug: "quantum-computing-basics",
      description: "Understand the fundamental building blocks of quantum computing: qubits, states, gates, and measurement.",
      category: "foundations",
      sortOrder: 1,
    },
  });

  const gatesTopic = await prisma.learningTopic.upsert({
    where: { slug: "quantum-gates" },
    update: {},
    create: {
      title: "Quantum Gates",
      slug: "quantum-gates",
      description: "Learn about single-qubit and multi-qubit gates that form the operations of quantum circuits.",
      category: "gates",
      sortOrder: 1,
    },
  });

  const multiQubitTopic = await prisma.learningTopic.upsert({
    where: { slug: "multi-qubit-systems" },
    update: {},
    create: {
      title: "Multi-Qubit Systems",
      slug: "multi-qubit-systems",
      description: "Explore entanglement, Bell states, and multi-qubit circuit design.",
      category: "multi-qubit",
      sortOrder: 1,
    },
  });

  // Link topics to concepts
  await Promise.all([
    prisma.learningTopicConcept.upsert({ where: { topicId_conceptId: { topicId: foundationsTopic.id, conceptId: concepts[0].id } }, update: {}, create: { topicId: foundationsTopic.id, conceptId: concepts[0].id, sortOrder: 0 } }),
    prisma.learningTopicConcept.upsert({ where: { topicId_conceptId: { topicId: foundationsTopic.id, conceptId: concepts[1].id } }, update: {}, create: { topicId: foundationsTopic.id, conceptId: concepts[1].id, sortOrder: 1 } }),
    prisma.learningTopicConcept.upsert({ where: { topicId_conceptId: { topicId: foundationsTopic.id, conceptId: concepts[3].id } }, update: {}, create: { topicId: foundationsTopic.id, conceptId: concepts[3].id, sortOrder: 2 } }),
    prisma.learningTopicConcept.upsert({ where: { topicId_conceptId: { topicId: gatesTopic.id, conceptId: concepts[4].id } }, update: {}, create: { topicId: gatesTopic.id, conceptId: concepts[4].id, sortOrder: 0 } }),
    prisma.learningTopicConcept.upsert({ where: { topicId_conceptId: { topicId: gatesTopic.id, conceptId: concepts[5].id } }, update: {}, create: { topicId: gatesTopic.id, conceptId: concepts[5].id, sortOrder: 1 } }),
    prisma.learningTopicConcept.upsert({ where: { topicId_conceptId: { topicId: gatesTopic.id, conceptId: concepts[6].id } }, update: {}, create: { topicId: gatesTopic.id, conceptId: concepts[6].id, sortOrder: 2 } }),
    prisma.learningTopicConcept.upsert({ where: { topicId_conceptId: { topicId: multiQubitTopic.id, conceptId: concepts[7].id } }, update: {}, create: { topicId: multiQubitTopic.id, conceptId: concepts[7].id, sortOrder: 0 } }),
    prisma.learningTopicConcept.upsert({ where: { topicId_conceptId: { topicId: multiQubitTopic.id, conceptId: concepts[8].id } }, update: {}, create: { topicId: multiQubitTopic.id, conceptId: concepts[8].id, sortOrder: 1 } }),
  ]);

  console.log("Created learning topics");

  // ========================================
  // Problems
  // ========================================

  // Problem 1: Qubit State Basics
  const p1 = await prisma.problem.upsert({
    where: { slug: "qubit-state-basics" },
    update: {},
    create: {
      slug: "qubit-state-basics",
      title: "Qubit State Basics",
      shortDescription: "Understand the fundamental representation of a qubit and its possible states.",
      description: lines(
        "## Overview",
        "",
        "A qubit is the fundamental unit of quantum information. Unlike a classical bit, which can only be 0 or 1, a qubit can exist in a **superposition** of both states.",
        "",
        "## Background",
        "",
        "A qubit state is described by a two-dimensional complex vector:",
        "",
        "    |psi> = alpha|0> + beta|1>",
        "",
        "where alpha and beta are complex probability amplitudes satisfying:",
        "",
        "    |alpha|^2 + |beta|^2 = 1",
        "",
        "The two basis states are:",
        "",
        "- **|0>** = [1, 0] -- the zero state",
        "- **|1>** = [0, 1] -- the one state",
        "",
        "## What You'll Learn",
        "",
        "In this problem, you will:",
        "",
        "1. Create qubits in the |0> and |1> states",
        "2. Verify the state vector representation",
        "3. Understand normalization of quantum states",
        "4. Observe the effect of measurement on qubit states",
      ),
      difficulty: "BEGINNER",
      status: "PUBLISHED",
      estimatedMinutes: 15,
      prerequisites: "Basic linear algebra (vectors, complex numbers). No prior quantum computing knowledge required.",
      learningObjectives: JSON.stringify([
        "Represent a qubit as a 2D state vector in the computational basis.",
        "Understand the normalization condition |alpha|^2 + |beta|^2 = 1.",
        "Create qubits in the |0> and |1> basis states.",
        "Explain the difference between a qubit and a classical bit.",
      ]),
      hints: JSON.stringify([
        { content: "In Qiskit, you can create a quantum circuit with a single qubit using QuantumCircuit(1).", order: 1 },
        { content: "Use the Statevector class from qiskit.quantum_info to inspect the state vector of your circuit.", order: 2 },
        { content: "A qubit initialized without any gates applied starts in the |0> state by convention.", order: 3 },
      ]),
      requirements: JSON.stringify({ qubits: 1, requiredGates: "None (initial state only)", language: "Python", framework: "Qiskit" }),
      expectedOutcome: JSON.stringify({ state: "|0> = [1, 0]", probability: "P(0) = 1.0, P(1) = 0.0", description: "A single qubit in the computational zero state with full certainty." }),
      testSpecification: JSON.stringify([
        { type: "STATE", description: "Verify qubit is in |0> state", expected: { statevector: [1, 0], tolerance: 0.01 } },
        { type: "STRUCTURAL", description: "Circuit must use exactly 1 qubit", expected: { qubits: 1 } },
      ]),
      publishedAt: new Date(),
    },
  });

  // Problem 2: Apply an X Gate
  const p2 = await prisma.problem.upsert({
    where: { slug: "apply-x-gate" },
    update: {},
    create: {
      slug: "apply-x-gate",
      title: "Apply an X Gate",
      shortDescription: "Learn how the Pauli-X gate flips a qubit from |0> to |1>.",
      description: lines(
        "## Overview",
        "",
        "The **Pauli-X gate** (also called the NOT gate or bit-flip gate) is one of the most fundamental single-qubit gates.",
        "",
        "## The Gate",
        "",
        "The X gate is represented by the matrix:",
        "",
        "    X = | 0  1 |",
        "        | 1  0 |",
        "",
        "When applied to the computational basis states:",
        "",
        "- **X|0> = |1>** -- flips |0> to |1>",
        "- **X|1> = |0>** -- flips |1> to |0>",
        "",
        "## What You'll Implement",
        "",
        "1. Create a single-qubit circuit",
        "2. Apply an X gate to flip the qubit",
        "3. Verify the resulting state is |1>",
        "4. Understand the gate's effect on the state vector",
      ),
      difficulty: "BEGINNER",
      status: "PUBLISHED",
      estimatedMinutes: 15,
      prerequisites: "Understanding of qubit states and the computational basis. Complete the Qubit State Basics problem first.",
      learningObjectives: JSON.stringify([
        "Apply the Pauli-X gate to a qubit.",
        "Verify that X|0> = |1> by inspecting the state vector.",
        "Understand the X gate as a quantum NOT operation.",
        "Read and interpret quantum circuit diagrams.",
      ]),
      hints: JSON.stringify([
        { content: "Use circuit.x(0) to apply an X gate to qubit 0 in Qiskit.", order: 1 },
        { content: "After applying the X gate, the state vector should be [0, 1], corresponding to the |1> state.", order: 2 },
      ]),
      requirements: JSON.stringify({ qubits: 1, requiredGates: ["X"], language: "Python", framework: "Qiskit" }),
      expectedOutcome: JSON.stringify({ state: "|1> = [0, 1]", probability: "P(0) = 0.0, P(1) = 1.0", description: "The X gate has flipped the qubit from |0> to |1>." }),
      testSpecification: JSON.stringify([
        { type: "STATE", description: "Verify qubit is in |1> state after X gate", expected: { statevector: [0, 1], tolerance: 0.01 } },
        { type: "STRUCTURAL", description: "Circuit must contain an X gate", expected: { gates: ["x"] } },
      ]),
      publishedAt: new Date(),
    },
  });

  // Problem 3: Create Superposition
  const p3 = await prisma.problem.upsert({
    where: { slug: "create-superposition" },
    update: {},
    create: {
      slug: "create-superposition",
      title: "Create Superposition",
      shortDescription: "Use the Hadamard gate to put a qubit into equal superposition.",
      description: lines(
        "## Overview",
        "",
        "**Superposition** is one of the most fundamental concepts in quantum computing. A qubit in superposition exists in both |0> and |1> simultaneously.",
        "",
        "## The Hadamard Gate",
        "",
        "The Hadamard gate (H) is the standard gate for creating superposition:",
        "",
        "    H = (1/sqrt(2)) * | 1   1 |",
        "                       | 1  -1 |",
        "",
        "When applied to the basis states:",
        "",
        "- **H|0> = (|0> + |1>)/sqrt(2)** -- equal superposition",
        "- **H|1> = (|0> - |1>)/sqrt(2)** -- equal superposition with a phase difference",
        "",
        "## What You'll Implement",
        "",
        "1. Create a single-qubit circuit",
        "2. Apply a Hadamard gate",
        "3. Verify the state vector has equal amplitudes",
        "4. Simulate measurement to observe the probabilistic outcome",
      ),
      difficulty: "EASY",
      status: "PUBLISHED",
      estimatedMinutes: 20,
      prerequisites: "Understanding of qubit states and the X gate. Basic probability.",
      learningObjectives: JSON.stringify([
        "Apply the Hadamard gate to create superposition.",
        "Verify equal probability amplitudes in the resulting state.",
        "Explain the difference between |0>, |1>, and (|0>+|1>)/sqrt(2).",
        "Understand that measurement collapses superposition.",
      ]),
      hints: JSON.stringify([
        { content: "Use circuit.h(0) to apply a Hadamard gate to qubit 0.", order: 1 },
        { content: "The state vector after H|0> should have both amplitudes equal to approximately 0.707 (which is 1/sqrt(2)).", order: 2 },
        { content: "To verify the probabilistic nature, run the circuit multiple times with execute(circuit, backend, shots=1000) and check that both outcomes appear roughly equally.", order: 3 },
      ]),
      requirements: JSON.stringify({ qubits: 1, requiredGates: ["H"], language: "Python", framework: "Qiskit" }),
      expectedOutcome: JSON.stringify({ state: "(|0> + |1>)/sqrt(2)", amplitudes: [0.707, 0.707], probability: "P(0) ~ 0.5, P(1) ~ 0.5", description: "A qubit in equal superposition, with equal probability of measuring |0> or |1>." }),
      testSpecification: JSON.stringify([
        { type: "STATE", description: "Verify equal superposition state (|0>+|1>)/sqrt(2)", expected: { statevector: [0.707, 0.707], tolerance: 0.05 } },
        { type: "DISTRIBUTION", description: "Measurement distribution should be roughly 50/50", expected: { shots: 1000, distribution: { "0": 0.5, "1": 0.5 }, tolerance: 0.1 } },
        { type: "STRUCTURAL", description: "Circuit must contain an H gate", expected: { gates: ["h"] } },
      ]),
      publishedAt: new Date(),
    },
  });

  // Problem 4: Measure a Qubit
  const p4 = await prisma.problem.upsert({
    where: { slug: "measure-qubit" },
    update: {},
    create: {
      slug: "measure-qubit",
      title: "Measure a Qubit",
      shortDescription: "Understand quantum measurement by measuring qubits in various states.",
      description: lines(
        "## Overview",
        "",
        "**Measurement** in quantum computing is the process of observing a qubit, which irreversibly collapses its quantum state to one of the computational basis states.",
        "",
        "## How Measurement Works",
        "",
        "When you measure a qubit in state:",
        "",
        "    |psi> = alpha|0> + beta|1>",
        "",
        "The outcome is:",
        "",
        "- **|0>** with probability **|alpha|^2**",
        "- **|1>** with probability **|beta|^2**",
        "",
        "After measurement, the qubit is in the measured state. This is a fundamental irreversible operation.",
        "",
        "## What You'll Implement",
        "",
        "1. Create qubits in different states (|0>, |1>, superposition)",
        "2. Apply measurement operations",
        "3. Run circuits with many shots to observe probability distributions",
        "4. Compare theoretical and experimental measurement outcomes",
        "5. Understand why measurement is irreversible",
      ),
      difficulty: "EASY",
      status: "PUBLISHED",
      estimatedMinutes: 25,
      prerequisites: "Understanding of qubit states, the X gate, and the Hadamard gate.",
      learningObjectives: JSON.stringify([
        "Apply measurement operations to qubits in Qiskit.",
        "Explain the probabilistic nature of quantum measurement.",
        "Compare theoretical probabilities with experimental shot counts.",
        "Understand that measurement collapses the quantum state.",
        "Interpret measurement histogram results.",
      ]),
      hints: JSON.stringify([
        { content: "In Qiskit, use circuit.measure(qubit, classical_bit) to add a measurement.", order: 1 },
        { content: "You need classical bits to store measurement results. Add them with circuit = QuantumCircuit(n_qubits, n_classical).", order: 2 },
        { content: "Use a real simulator backend like AerSimulator to get accurate measurement results.", order: 3 },
      ]),
      requirements: JSON.stringify({ qubits: "1-2", requiredGates: ["measure"], language: "Python", framework: "Qiskit" }),
      expectedOutcome: JSON.stringify({
        description: "Measurement results that match the expected probability distribution for the prepared state.",
        examples: [
          { state: "|0>", expected: { "0": "100%", "1": "0%" } },
          { state: "|1>", expected: { "0": "0%", "1": "100%" } },
          { state: "(|0>+|1>)/sqrt(2)", expected: { "0": "~50%", "1": "~50%" } },
        ],
      }),
      testSpecification: JSON.stringify([
        { type: "DISTRIBUTION", description: "Measurement of |0> should always give 0", expected: { input: "zero_state", shots: 100, distribution: { "0": 1.0 }, tolerance: 0.0 } },
        { type: "DISTRIBUTION", description: "Measurement of superposition should give ~50/50", expected: { input: "superposition", shots: 1000, distribution: { "0": 0.5, "1": 0.5 }, tolerance: 0.1 } },
      ]),
      publishedAt: new Date(),
    },
  });

  // Problem 5: Build a Bell State
  const p5 = await prisma.problem.upsert({
    where: { slug: "bell-state" },
    update: {},
    create: {
      slug: "bell-state",
      title: "Build a Bell State",
      shortDescription: "Create the maximally entangled Bell state |Phi+> using a Hadamard and CNOT gate.",
      description: lines(
        "## Overview",
        "",
        "A **Bell state** is one of the four maximally entangled two-qubit states. The most common Bell state, |Phi+>, is:",
        "",
        "    |Phi+> = (|00> + |11>)/sqrt(2)",
        "",
        "This means the two qubits are perfectly correlated: if you measure one and get |0>, the other will also be |0>, and likewise for |1>.",
        "",
        "## How to Create a Bell State",
        "",
        "The circuit for creating |Phi+> is:",
        "",
        "1. Start with two qubits in |00>",
        "2. Apply a **Hadamard gate** to qubit 0 -- creates superposition",
        "3. Apply a **CNOT gate** with qubit 0 as control and qubit 1 as target -- creates entanglement",
        "",
        "The result is the Bell state |Phi+>.",
        "",
        "## What You'll Implement",
        "",
        "1. Create a 2-qubit circuit",
        "2. Apply H gate to qubit 0",
        "3. Apply CNOT(0,1) gate",
        "4. Verify the resulting state is the Bell state",
        "5. Measure both qubits and verify correlated outcomes",
      ),
      difficulty: "MEDIUM",
      status: "PUBLISHED",
      estimatedMinutes: 30,
      prerequisites: "Understanding of qubit states, superposition (Hadamard gate), and measurement. Familiarity with multi-qubit systems is helpful but not required.",
      learningObjectives: JSON.stringify([
        "Construct the Bell state |Phi+> using H and CNOT gates.",
        "Explain how entanglement arises from the H + CNOT circuit.",
        "Verify entanglement by observing correlated measurement outcomes.",
        "Distinguish between classical correlation and quantum entanglement.",
        "Understand the CNOT gate as a controlled-NOT operation.",
      ]),
      hints: JSON.stringify([
        { content: "Start with a QuantumCircuit(2) for two qubits.", order: 1 },
        { content: "Apply the Hadamard gate to qubit 0 first: circuit.h(0).", order: 2 },
        { content: "Then apply the CNOT gate: circuit.cx(0, 1) where 0 is the control and 1 is the target.", order: 3 },
        { content: "The state vector should show amplitudes of 1/sqrt(2) for |00> and |11>, and 0 for |01> and |10>.", order: 4 },
      ]),
      requirements: JSON.stringify({ qubits: 2, requiredGates: ["H", "CX"], language: "Python", framework: "Qiskit", maxDepth: 2 }),
      expectedOutcome: JSON.stringify({ state: "(|00> + |11>)/sqrt(2)", amplitudes: { "00": 0.707, "01": 0.0, "10": 0.0, "11": 0.707 }, probability: "P(00) ~ 0.5, P(11) ~ 0.5, P(01) ~ 0, P(10) ~ 0", description: "A maximally entangled Bell state where both qubits are always measured in the same state." }),
      testSpecification: JSON.stringify([
        { type: "STATE", description: "Verify Bell state |Phi+>", expected: { statevector: [0.707, 0, 0, 0.707], tolerance: 0.05 } },
        { type: "ENTANGLEMENT", description: "Verify qubits are entangled", expected: { correlation: 1.0, measurementShots: 1000, description: "All measurements should be |00> or |11> -- never |01> or |10>" } },
        { type: "DISTRIBUTION", description: "Measurement distribution should be ~50/50 for |00> and |11>", expected: { shots: 1000, distribution: { "00": 0.5, "11": 0.5 }, tolerance: 0.1 } },
        { type: "STRUCTURAL", description: "Circuit must use exactly 2 qubits with H and CX gates", expected: { qubits: 2, gates: ["h", "cx"], maxDepth: 2 } },
      ]),
      publishedAt: new Date(),
    },
  });

  // Link concepts to problems
  await Promise.all([
    prisma.problemConcept.upsert({ where: { problemId_conceptId: { problemId: p1.id, conceptId: concepts[0].id } }, update: {}, create: { problemId: p1.id, conceptId: concepts[0].id } }),
    prisma.problemConcept.upsert({ where: { problemId_conceptId: { problemId: p1.id, conceptId: concepts[1].id } }, update: {}, create: { problemId: p1.id, conceptId: concepts[1].id } }),
    prisma.problemConcept.upsert({ where: { problemId_conceptId: { problemId: p2.id, conceptId: concepts[4].id } }, update: {}, create: { problemId: p2.id, conceptId: concepts[4].id } }),
    prisma.problemConcept.upsert({ where: { problemId_conceptId: { problemId: p2.id, conceptId: concepts[5].id } }, update: {}, create: { problemId: p2.id, conceptId: concepts[5].id } }),
    prisma.problemConcept.upsert({ where: { problemId_conceptId: { problemId: p3.id, conceptId: concepts[2].id } }, update: {}, create: { problemId: p3.id, conceptId: concepts[2].id } }),
    prisma.problemConcept.upsert({ where: { problemId_conceptId: { problemId: p3.id, conceptId: concepts[6].id } }, update: {}, create: { problemId: p3.id, conceptId: concepts[6].id } }),
    prisma.problemConcept.upsert({ where: { problemId_conceptId: { problemId: p4.id, conceptId: concepts[3].id } }, update: {}, create: { problemId: p4.id, conceptId: concepts[3].id } }),
    prisma.problemConcept.upsert({ where: { problemId_conceptId: { problemId: p4.id, conceptId: concepts[2].id } }, update: {}, create: { problemId: p4.id, conceptId: concepts[2].id } }),
    prisma.problemConcept.upsert({ where: { problemId_conceptId: { problemId: p5.id, conceptId: concepts[7].id } }, update: {}, create: { problemId: p5.id, conceptId: concepts[7].id } }),
    prisma.problemConcept.upsert({ where: { problemId_conceptId: { problemId: p5.id, conceptId: concepts[8].id } }, update: {}, create: { problemId: p5.id, conceptId: concepts[8].id } }),
    prisma.problemConcept.upsert({ where: { problemId_conceptId: { problemId: p5.id, conceptId: concepts[9].id } }, update: {}, create: { problemId: p5.id, conceptId: concepts[9].id } }),
  ]);

  // Link tags to problems
  await Promise.all([
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p1.id, tagId: tags[0].id } }, update: {}, create: { problemId: p1.id, tagId: tags[0].id } }),
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p1.id, tagId: tags[7].id } }, update: {}, create: { problemId: p1.id, tagId: tags[7].id } }),
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p2.id, tagId: tags[0].id } }, update: {}, create: { problemId: p2.id, tagId: tags[0].id } }),
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p2.id, tagId: tags[3].id } }, update: {}, create: { problemId: p2.id, tagId: tags[3].id } }),
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p3.id, tagId: tags[0].id } }, update: {}, create: { problemId: p3.id, tagId: tags[0].id } }),
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p3.id, tagId: tags[6].id } }, update: {}, create: { problemId: p3.id, tagId: tags[6].id } }),
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p3.id, tagId: tags[3].id } }, update: {}, create: { problemId: p3.id, tagId: tags[3].id } }),
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p4.id, tagId: tags[2].id } }, update: {}, create: { problemId: p4.id, tagId: tags[2].id } }),
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p4.id, tagId: tags[7].id } }, update: {}, create: { problemId: p4.id, tagId: tags[7].id } }),
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p5.id, tagId: tags[1].id } }, update: {}, create: { problemId: p5.id, tagId: tags[1].id } }),
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p5.id, tagId: tags[4].id } }, update: {}, create: { problemId: p5.id, tagId: tags[4].id } }),
    prisma.problemTag.upsert({ where: { problemId_tagId: { problemId: p5.id, tagId: tags[5].id } }, update: {}, create: { problemId: p5.id, tagId: tags[5].id } }),
  ]);

  // Link problems to learning topics
  await Promise.all([
    prisma.learningTopicProblem.upsert({ where: { topicId_problemId: { topicId: foundationsTopic.id, problemId: p1.id } }, update: {}, create: { topicId: foundationsTopic.id, problemId: p1.id, sortOrder: 1 } }),
    prisma.learningTopicProblem.upsert({ where: { topicId_problemId: { topicId: foundationsTopic.id, problemId: p4.id } }, update: {}, create: { topicId: foundationsTopic.id, problemId: p4.id, sortOrder: 2 } }),
    prisma.learningTopicProblem.upsert({ where: { topicId_problemId: { topicId: gatesTopic.id, problemId: p2.id } }, update: {}, create: { topicId: gatesTopic.id, problemId: p2.id, sortOrder: 1 } }),
    prisma.learningTopicProblem.upsert({ where: { topicId_problemId: { topicId: gatesTopic.id, problemId: p3.id } }, update: {}, create: { topicId: gatesTopic.id, problemId: p3.id, sortOrder: 2 } }),
    prisma.learningTopicProblem.upsert({ where: { topicId_problemId: { topicId: multiQubitTopic.id, problemId: p5.id } }, update: {}, create: { topicId: multiQubitTopic.id, problemId: p5.id, sortOrder: 1 } }),
  ]);

  // Create problem relations
  await Promise.all([
    prisma.problemRelation.upsert({ where: { fromId_toId_type: { fromId: p2.id, toId: p1.id, type: "PREREQUISITE" } }, update: {}, create: { fromId: p2.id, toId: p1.id, type: "PREREQUISITE" } }),
    prisma.problemRelation.upsert({ where: { fromId_toId_type: { fromId: p3.id, toId: p2.id, type: "PREREQUISITE" } }, update: {}, create: { fromId: p3.id, toId: p2.id, type: "PREREQUISITE" } }),
    prisma.problemRelation.upsert({ where: { fromId_toId_type: { fromId: p4.id, toId: p3.id, type: "PREREQUISITE" } }, update: {}, create: { fromId: p4.id, toId: p3.id, type: "PREREQUISITE" } }),
    prisma.problemRelation.upsert({ where: { fromId_toId_type: { fromId: p5.id, toId: p4.id, type: "PREREQUISITE" } }, update: {}, create: { fromId: p5.id, toId: p4.id, type: "PREREQUISITE" } }),
    prisma.problemRelation.upsert({ where: { fromId_toId_type: { fromId: p1.id, toId: p2.id, type: "NEXT" } }, update: {}, create: { fromId: p1.id, toId: p2.id, type: "NEXT" } }),
    prisma.problemRelation.upsert({ where: { fromId_toId_type: { fromId: p2.id, toId: p3.id, type: "NEXT" } }, update: {}, create: { fromId: p2.id, toId: p3.id, type: "NEXT" } }),
    prisma.problemRelation.upsert({ where: { fromId_toId_type: { fromId: p3.id, toId: p4.id, type: "NEXT" } }, update: {}, create: { fromId: p3.id, toId: p4.id, type: "NEXT" } }),
    prisma.problemRelation.upsert({ where: { fromId_toId_type: { fromId: p4.id, toId: p5.id, type: "NEXT" } }, update: {}, create: { fromId: p4.id, toId: p5.id, type: "NEXT" } }),
  ]);

  console.log("Created 5 seed problems with concepts, tags, and relations");
  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
