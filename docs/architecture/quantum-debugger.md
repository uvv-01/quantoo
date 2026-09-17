# Quantum Debugger

> **Status: IMPLEMENTED (Phase 5).** See [debugger.md](./debugger.md) for
> the shipped architecture: execution artifact extensions, gate trace,
> state snapshots and scaling limits, the Quantum Time Machine, state
> inspection, failure localization, the reference-comparison (Quantum
> Diff) foundation, debugger modes, and the debugger API.

The original plan for this subsystem is preserved below. Capabilities
marked *deferred* are intentionally out of scope for Phase 5 and belong
to later phases.

## Overview

The Quantum Debugger will provide step-through debugging capabilities for quantum circuits, analogous to traditional debuggers for classical programs. It will be introduced in **Phase 5**.

## Capabilities

### Required Capabilities

| Capability | Description |
|-----------|-------------|
| Breakpoints | Pause execution at specific gates or operations |
| Step Forward | Execute one gate/operation at a time |
| Step Backward | Reconstruct state where possible (state cloning before branching) |
| Gate Trace | Full ordered list of executed gates |
| State Snapshots | Quantum state vector at any point |
| Probability Distribution | Measurement probabilities at any point |
| Amplitudes | Complex amplitude values |
| Phase | Phase information for each basis state |
| Density Matrix | Full density matrix representation |
| Observables | Computed expectation values |
| Measurement Results | Simulated or real measurement outcomes |
| Resource Metrics | Gate count, depth, qubit utilization |
| Failure Localization | Pinpoint where tests fail |
| Reference vs Student | Compare expected vs actual state |

### Visualization Requirements

- Bloch sphere for single-qubit states
- Circuit diagram with execution pointer
- Probability histogram
- State table (amplitudes, phases)
- Gate timeline

### Technical Constraints

- State reconstruction for step-back requires cloning state before irreversible operations
- Measurement collapses the state; stepping back after measurement reconstructs from checkpoint
- Multi-qubit state visualization is inherently limited beyond ~12 qubits
- Performance degrades with circuit depth due to state vector size

## Future Integration

The debugger will consume `Execution Artifact` data from the execution layer and present it through an interactive UI. It will integrate with the Quantum Judge to highlight failures and with the execution layer for re-execution with modified parameters.
