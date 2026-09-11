# Quantum Judge Architecture

> **Status: PLANNED — Not yet implemented.**

## Overview

The Quantum Judge is a multi-layer evaluation system for assessing quantum programs. It will be introduced in **Phase 4**.

## Evaluation Layers

Not every problem uses every criterion. The judge selects relevant layers based on the problem type.

| Layer | Description | When Used |
|-------|-------------|-----------|
| **Structural** | Code compiles, valid imports, correct function signatures | Always |
| **Functional** | Output matches expected result | Always |
| **State** | Final state vector matches expected state | State-based problems |
| **Distribution** | Measurement probability distribution matches | Statistical problems |
| **Unitary** | Implemented unitary matches expected transformation | Circuit problems |
| **Observable** | Computed expectation values match | Physics problems |
| **Entanglement** | Correct entanglement structure verified | Entanglement problems |
| **Statistical** | Over N measurements, distribution is within tolerance | Statistical problems |
| **Resource** | Gate count, depth, qubit count within limits | Optimization problems |
| **Noise** | Behavior under noise model matches expectations | Noise problems |
| **Hardware** | Behavior on real hardware matches simulation | Hardware problems |

## Tolerance & Probabilistic Evaluation

Quantum computing is inherently probabilistic. The judge must handle:

- **Floating-point tolerance** for state vector comparisons
- **Statistical tolerance** for measurement distributions (chi-squared tests, KL divergence)
- **Multiple valid solutions** (e.g., global phase differences)
- **Randomized test cases** with fixed seeds for reproducibility
- **Configurable thresholds** per problem difficulty

## Comparison Modes

1. **Exact state match** — State vectors equal within tolerance
2. **Distribution match** — Probability distributions close within statistical threshold
3. **Property match** — Specific quantum properties match (entanglement, fidelity, etc.)
4. **Output match** — Classical output values match

## Future Integration

The judge will receive `Execution Artifact` data and produce a `Judge Result`:

```typescript
interface JudgeResult {
  passed: boolean;
  score: number; // 0-100
  layers: LayerResult[];
  feedback: FeedbackItem[];
  resourceMetrics: ResourceMetrics;
}
```
