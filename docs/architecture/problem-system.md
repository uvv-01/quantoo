# Problem System Architecture

Quantum Daily's problem system provides a complete content and learning infrastructure for quantum computing education.

## Overview

The problem system is designed as a data-driven architecture that separates:

- **Content** (problems, concepts, tags, learning topics)
- **User Progress** (attempts, completion status)
- **Execution** (Phase 4+ — code execution and judging)

This separation ensures each domain can evolve independently without breaking existing functionality.

## Data Model

### Core Entities

```
Problem
 ├── id, slug, title, description
 ├── difficulty (BEGINNER, EASY, MEDIUM, HARD, EXPERT)
 ├── status (DRAFT, REVIEW, PUBLISHED, ARCHIVED)
 ├── estimatedMinutes
 ├── prerequisites (text)
 ├── learningObjectives (JSON array)
 ├── hints (structured JSON)
 ├── solutionExplanation (structured JSON)
 ├── requirements (structured JSON)
 ├── expectedOutcome (structured JSON)
 ├── testSpecification (structured JSON)
 ├── concepts (M2M via ProblemConcept)
 ├── tags (M2M via ProblemTag)
 ├── relations (M2M via ProblemRelation)
 ├── versions (1:N via ProblemVersion)
 └── progress (1:N via UserProblemProgress)
```

### Concepts

Reusable quantum concept taxonomy:

```typescript
Concept {
  id: string
  name: string          // "Superposition"
  slug: string          // "superposition"
  description: string?
  category: string      // "foundations", "gates", "multi-qubit", etc.
}
```

Concepts are linked to problems via `ProblemConcept` (many-to-many).

### Tags

Flexible tagging system:

```typescript
Tag {
  id: string
  name: string          // "Single Qubit"
  slug: string          // "single-qubit"
}
```

Tags are linked to problems via `ProblemTag` (many-to-many).

### Problem Relations

Define relationships between problems:

```typescript
ProblemRelation {
  fromId: string        // Problem that has the relation
  toId: string          // Related problem
  type: ProblemRelationType  // PREREQUISITE, RELATED, NEXT, SAME_CONCEPT
}
```

## Publication Lifecycle

```
DRAFT → REVIEW → PUBLISHED → ARCHIVED
```

- **DRAFT**: Not visible to public users
- **REVIEW**: Under review (future content authoring)
- **PUBLISHED**: Visible in problem discovery and detail pages
- **ARCHIVED**: No longer discoverable but accessible by direct link

Only `PUBLISHED` problems are returned by the public API.

## Search & Filtering

### Search

Full-text search across `title` and `shortDescription` fields using case-insensitive matching.

### Filters

- **Difficulty**: BEGINNER, EASY, MEDIUM, HARD, EXPERT
- **Concept**: Filter by concept slug
- **Tag**: Filter by tag slug

### Pagination

- Default page size: 20
- Maximum page size: 100
- Page numbers start at 1

## API Endpoints

### Public

- `GET /api/problems` — List problems with filtering and search
- `GET /api/problems/[slug]` — Get problem detail by slug
- `GET /api/learn` — List learning topics
- `GET /api/learn/[slug]` — Get learning topic detail

### Authenticated

- `GET /api/progress` — Get user's progress summary
- `POST /api/progress/problem` — Update problem progress (start, attempt, solve)

## Test Specification Architecture

Problems can define test specifications that the future Judge (Phase 4+) will evaluate:

```json
[
  {
    "type": "STATE",
    "description": "Verify qubit is in |0> state",
    "expected": { "statevector": [1, 0], "tolerance": 0.01 }
  },
  {
    "type": "STRUCTURAL",
    "description": "Circuit must contain an H gate",
    "expected": { "gates": ["h"] }
  }
]
```

### Test Types

| Type | Description |
|------|-------------|
| STRUCTURAL | Validates circuit structure (qubit count, gate usage, depth) |
| STATE | Validates quantum state vector |
| DISTRIBUTION | Validates measurement probability distribution |
| ENTANGLEMENT | Validates entanglement between qubits |
| UNITARY | Validates unitary operation equivalence |
| OBSERVABLE | Validates expectation values |
| FUNCTIONAL | Validates functional behavior |
| STATISTICAL | Validates statistical properties |
| RESOURCE | Validates resource constraints |

### Phase 3 Scope

In Phase 3, test specifications are **stored as data** but **not executed**. The future Judge (Phase 4) will consume these specifications to evaluate user code.

## Learning Architecture

### Learning Topics

Organize problems into structured learning paths:

```typescript
LearningTopic {
  id: string
  title: string
  slug: string
  description: string?
  category: string?
  sortOrder: number
}
```

Topics are linked to:
- **Concepts** via `LearningTopicConcept` (what concepts this topic covers)
- **Problems** via `LearningTopicProblem` (problems in this topic, ordered)

### Current Topics

1. **Quantum Computing Basics** (foundations)
   - Qubits, Quantum States, Measurement
   - Problems: Qubit State Basics, Measure a Qubit

2. **Quantum Gates** (gates)
   - Quantum Gates, Pauli-X Gate, Hadamard Gate
   - Problems: Apply an X Gate, Create Superposition

3. **Multi-Qubit Systems** (multi-qubit)
   - Entanglement, Bell States
   - Problems: Build a Bell State

## Seed Data

Phase 3 includes 5 high-quality educational seed problems:

| # | Title | Difficulty | Concepts |
|---|-------|-----------|----------|
| 1 | Qubit State Basics | BEGINNER | Qubits, Quantum States |
| 2 | Apply an X Gate | BEGINNER | Quantum Gates, Pauli-X Gate |
| 3 | Create Superposition | EASY | Superposition, Hadamard Gate |
| 4 | Measure a Qubit | EASY | Measurement, Superposition |
| 5 | Build a Bell State | MEDIUM | Entanglement, Bell States, Quantum Circuits |

Each problem includes:
- Detailed description with educational content
- Learning objectives
- Hints (progressive disclosure)
- Requirements (qubits, gates, framework)
- Expected outcomes
- Test specifications (for future Judge)

## Future Phases

### Phase 4: Code Workspace + Execution

The problem system provides the Judge with:
- Problem requirements
- Test specifications
- Expected behavior
- Resource limits

### Phase 5: Quantum Debugger

The debugger uses:
- Learning objectives
- Common mistakes (from solution explanation)
- Test failure meanings

### Phase 6+: Noise, Hardware, Projects

The problem model supports:
- Noise-aware test specifications
- Hardware-specific requirements
- Project-based problems
