# Content System Architecture

Quantum Daily's content system manages the educational taxonomy, learning paths, and content authoring infrastructure.

## Content Taxonomy

The content taxonomy provides a hierarchical structure for organizing quantum computing knowledge:

```
Quantum Computing
├── Foundations
│   ├── Qubits
│   ├── Quantum States
│   ├── Superposition
│   └── Measurement
├── Gates
│   ├── Quantum Gates
│   ├── Pauli-X Gate
│   ├── Hadamard Gate
│   └── Controlled Gates
├── Multi-Qubit Systems
│   ├── Entanglement
│   ├── Bell States
│   └── Tensor Products
├── Circuits
│   ├── Quantum Circuits
│   └── Circuit Design
├── Algorithms
│   ├── Grover's Algorithm
│   ├── Quantum Fourier Transform
│   └── Phase Estimation
└── Error Correction
    ├── Noise Models
    └── Error Correction Codes
```

## Domain Separation

The content system maintains clear separation between domains:

### Content Domain

```
Concept        — Reusable quantum concept (e.g., "Superposition")
Tag            — Flexible problem tag (e.g., "single-qubit")
Problem        — Educational problem with structured content
ProblemVersion — Versioned problem content (future)
LearningTopic  — Organized learning path
```

### User Domain

```
UserProblemProgress  — User's progress on a problem
UserLearningProgress — User's progress on a learning topic
UserActivity         — Activity log for analytics
```

### Execution Domain (Phase 4+)

```
Submission          — User's code submission
Execution           — Code execution record
ExecutionArtifact   — Execution results and state
```

### Judge Domain (Phase 4+)

```
JudgeResult         — Evaluation results
```

This separation ensures each domain can evolve independently.

## Content Versioning Strategy

Problem content can evolve through versions:

```
Problem (metadata: slug, title, difficulty)
  └── ProblemVersion (versioned content snapshot)
       ├── version number
       ├── content JSON
       └── changelog
```

### Rules

1. Published problems should not change in a way that invalidates historical progress
2. Content changes should create new versions
3. The active version is the latest published version
4. Previous versions are preserved for historical reference

### Implementation

- `ProblemVersion` stores content snapshots as JSON
- Each version is immutable once created
- The `version` field is auto-incremented per problem
- `changelog` describes what changed

## Content Authoring Architecture

Content authoring will be implemented in a future phase. The current architecture supports:

### Problem Content Fields

| Field | Type | Purpose |
|-------|------|---------|
| `description` | Text | Full problem statement (Markdown) |
| `learningObjectives` | JSON | Array of learning objectives |
| `hints` | JSON | Progressive hints array |
| `requirements` | JSON | Problem constraints and requirements |
| `expectedOutcome` | JSON | What a correct solution achieves |
| `testSpecification` | JSON | Test cases for the Judge |
| `solutionExplanation` | JSON | Post-solution explanation |
| `prerequisites` | Text | Required prior knowledge |

### JSON Schema Guidelines

Problem content uses structured JSON for machine-readable fields:

```json
{
  "hints": [
    { "content": "First hint text", "order": 1 },
    { "content": "Second hint text", "order": 2 }
  ],
  "requirements": {
    "qubits": 2,
    "requiredGates": ["H", "CX"],
    "language": "Python",
    "framework": "Qiskit",
    "maxDepth": 2
  },
  "expectedOutcome": {
    "state": "(|00> + |11>)/sqrt(2)",
    "probability": "P(00) ~ 0.5, P(11) ~ 0.5"
  }
}
```

### Markdown Content

The `description` field supports Markdown for rich educational content:

```markdown
## Overview
Problem introduction...

## Background
Theoretical background...

## What You'll Implement
Step-by-step guide...
```

## Learning Path Architecture

Learning topics organize problems into structured paths:

```
LearningTopic
  ├── Concepts (what is covered)
  └── Problems (ordered exercises)
```

### Path Ordering

- Topics have `sortOrder` for category-level ordering
- Problems within a topic have `sortOrder` for exercise ordering
- Problem relations (`NEXT`, `PREREQUISITE`) define cross-topic sequencing

### Current Paths

1. **Quantum Computing Basics** (foundations)
   - Concepts: Qubits, Quantum States, Measurement
   - Problems: Qubit State Basics → Measure a Qubit

2. **Quantum Gates** (gates)
   - Concepts: Quantum Gates, Pauli-X Gate, Hadamard Gate
   - Problems: Apply an X Gate → Create Superposition

3. **Multi-Qubit Systems** (multi-qubit)
   - Concepts: Entanglement, Bell States
   - Problems: Build a Bell State

## Future Execution Contract

Phase 4 will consume Phase 3's content through this pipeline:

```
Problem
  ↓
Problem Specification (requirements, test specs, expected outcomes)
  ↓
User Code (Python/Qiskit)
  ↓
Execution (sandboxed Python runtime)
  ↓
Execution Artifact (state snapshots, probabilities, measurements)
  ↓
Judge Evaluation (structural, functional, state, distribution tests)
  ↓
Result (pass/fail, feedback, hints)
```

The problem model provides the Judge with:
- Problem requirements (qubits, gates, depth limits)
- Test specifications (what to validate)
- Expected behavior (correct outcomes)
- Learning context (objectives, concepts, common mistakes)

## Seed Content Guidelines

Seed content must be:

1. **Educational** — Real quantum computing concepts, not placeholders
2. **Accurate** — Correct physics and mathematics
3. **Progressive** — Ordered from simple to complex
4. **Complete** — Each problem has all content fields populated
5. **Testable** — Clear expected outcomes for future Judge evaluation

### Current Seed Problems

| Problem | Difficulty | Concepts |
|---------|-----------|----------|
| Qubit State Basics | BEGINNER | Qubits, Quantum States |
| Apply an X Gate | BEGINNER | Quantum Gates, Pauli-X Gate |
| Create Superposition | EASY | Superposition, Hadamard Gate |
| Measure a Qubit | EASY | Measurement, Superposition |
| Build a Bell State | MEDIUM | Entanglement, Bell States, Quantum Circuits |
