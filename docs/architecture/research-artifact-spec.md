# Quantoo Research Artifact Specification — `quantoo.artifact.v1`

This document specifies the versioned export/import format for Quantoo
research artifacts. It is designed for long-term evolution: unknown
fields are ignored defensively on import, and the schema version gates
all parsing.

---

## Envelope

An exported artifact is a single JSON document:

```json
{
  "schemaVersion": "quantoo.artifact.v1",
  "kind": "quantoo-artifact",
  "exportedAt": "2026-09-19T12:00:00.000Z",
  "documentHash": "<sha-256 hex of canonical JSON of document>",
  "document": { /* ResearchArtifactDocument */ }
}
```

- `documentHash` is a conventional sha-256 digest over the **canonical
  JSON** of `document` (recursively sorted object keys, no whitespace).
  It is an integrity mechanism for tamper-evidence — not a "quantum
  hash".
- Importers MUST recompute and verify `documentHash` before trusting
  the document.

---

## Document

```text
ResearchArtifactDocument {
  schemaVersion: "quantoo.artifact.v1"
  artifactType:  "COMPATIBILITY_EXPERIMENT"
  title:         string
  description:   string | null
  provenance:    ArtifactProvenance
  source:        ArtifactSourceSection
  evidence:      ArtifactEvidence
}
```

### Provenance

```text
ArtifactProvenance {
  createdBy:           string            // display name at publish time
  createdAt:           string            // ISO 8601 UTC
  problem:             { slug, title } | null
  sourceExperimentId:  string | null     // originating experiment, when any
}
```

Identity is minimal by design: a display name and timestamps. No
emails, no credentials, no session data.

### Source section

```text
ArtifactSourceSection {
  sourceCode:  string          // the program as executed
  language:    string
  shots:       number | null
  seed:        number | null
  policyName:  string | null   // comparison policy, when applicable
}
```

### Evidence section

Evidence sections are **embedded snapshots**, frozen at publish time.
They are never re-resolved against live rows, so the artifact remains
interpretable even if the original data is deleted.

```text
ArtifactEvidence {
  capsules: [ {
    role:           "BASELINE" | "CANDIDATE"
    environmentId:  string | null
    capsule:        <quantoo.execution.v1 capsule>
  } ]
  compatibilityReport: <quantoo.compatibility.v1 report> | null
  reproductions: [ {
    originalSubmissionId:      string
    reproductionSubmissionId:  string
    overallStatus:             string
    report:                    <reproduction report>
  } ]
}
```

---

## Import rules

Imported artifacts are **untrusted input**:

1. The envelope must parse as JSON within hard size limits.
2. `schemaVersion` must match exactly; unknown versions are rejected,
   not coerced.
3. The document must pass structural validation (types, string bounds,
   array caps, nesting-depth limit).
4. `documentHash` must equal the recomputed hash; mismatches are
   rejected as tampered.
5. Nothing is ever executed: not the source code, not scripts, not any
   field. Source code becomes runnable only after import, when a user
   explicitly runs it through the standard sandboxed execution
   pipeline.
6. Import creates a **new private artifact** owned by the importing
   user. The first execution of the imported source establishes the
   local baseline from real local evidence; imported claims are
   displayed as provenance, never as locally verified results.

## Integrity metadata

Each stored version records:

| Field         | Meaning                                            |
| ------------- | -------------------------------------------------- |
| `version`     | Monotonic integer; published versions are immutable |
| `payloadHash` | sha-256 over the canonical JSON of the version payload |
| `sizeBytes`   | Serialized size of the payload                      |

## Evolution

Later schema versions (`quantoo.artifact.v2`, …) must:

- keep parsing v1 documents (or provide a documented migration),
- document every newly available field — fields not implemented by the
  platform are not part of the schema,
- never silently mutate the meaning of an existing field.
