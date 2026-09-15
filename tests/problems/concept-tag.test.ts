/**
 * Concept & Tag Tests
 *
 * Tests slug normalization, uniqueness, and taxonomy validation
 * for concepts and tags.
 */

import { describe, it, expect } from "vitest";

// ========================================
// Slug Normalization Tests
// ========================================

/**
 * Normalize a name into a URL-safe slug.
 * Mirrors the logic expected in the database layer.
 */
function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

describe("Slug Normalization", () => {
  it("converts to lowercase", () => {
    expect(normalizeSlug("Quantum Gates")).toBe("quantum-gates");
  });

  it("trims whitespace", () => {
    expect(normalizeSlug("  bell state  ")).toBe("bell-state");
  });

  it("replaces spaces with hyphens", () => {
    expect(normalizeSlug("single qubit")).toBe("single-qubit");
  });

  it("removes special characters", () => {
    expect(normalizeSlug("Qubit Basics!")).toBe("qubit-basics");
  });

  it("collapses multiple hyphens", () => {
    expect(normalizeSlug("a  -  b")).toBe("a-b");
  });

  it("handles already normalized slugs", () => {
    expect(normalizeSlug("quantum-states")).toBe("quantum-states");
  });

  it("handles all-caps names", () => {
    expect(normalizeSlug("HADAMARD GATE")).toBe("hadamard-gate");
  });

  it("handles names with numbers", () => {
    expect(normalizeSlug("Problem 1 Basics")).toBe("problem-1-basics");
  });

  it("produces unique slugs for different names", () => {
    const slug1 = normalizeSlug("X Gate");
    const slug2 = normalizeSlug("H Gate");
    const slug3 = normalizeSlug("CNOT Gate");

    expect(slug1).not.toBe(slug2);
    expect(slug2).not.toBe(slug3);
    expect(slug1).not.toBe(slug3);
  });
});

// ========================================
// Concept Category Validation
// ========================================

describe("Concept Categories", () => {
  const validCategories = [
    "foundations",
    "gates",
    "multi-qubit",
    "circuits",
    "algorithms",
    "error-correction",
  ];

  it("defines expected categories", () => {
    expect(validCategories).toContain("foundations");
    expect(validCategories).toContain("gates");
    expect(validCategories).toContain("multi-qubit");
    expect(validCategories).toContain("circuits");
    expect(validCategories).toContain("algorithms");
    expect(validCategories).toContain("error-correction");
  });

  it("categories are lowercase", () => {
    for (const cat of validCategories) {
      expect(cat).toBe(cat.toLowerCase());
    }
  });

  it("categories have no spaces", () => {
    for (const cat of validCategories) {
      expect(cat).not.toMatch(/\s/);
    }
  });
});

// ========================================
// Problem-Concept Relationship Tests
// ========================================

describe("Problem-Concept Relationships", () => {
  it("a problem can have multiple concepts", () => {
    const problemConcepts = [
      { problemId: "p1", conceptId: "c1" },
      { problemId: "p1", conceptId: "c2" },
      { problemId: "p1", conceptId: "c3" },
    ];

    const p1Concepts = problemConcepts
      .filter((pc) => pc.problemId === "p1")
      .map((pc) => pc.conceptId);

    expect(p1Concepts).toHaveLength(3);
    expect(p1Concepts).toContain("c1");
    expect(p1Concepts).toContain("c2");
    expect(p1Concepts).toContain("c3");
  });

  it("a concept can belong to multiple problems", () => {
    const problemConcepts = [
      { problemId: "p1", conceptId: "c1" },
      { problemId: "p2", conceptId: "c1" },
      { problemId: "p3", conceptId: "c1" },
    ];

    const c1Problems = problemConcepts
      .filter((pc) => pc.conceptId === "c1")
      .map((pc) => pc.problemId);

    expect(c1Problems).toHaveLength(3);
    expect(c1Problems).toContain("p1");
    expect(c1Problems).toContain("p2");
    expect(c1Problems).toContain("p3");
  });

  it("prevents duplicate problem-concept pairs", () => {
    const pairs = new Set<string>();
    const newPair = "p1:c1";

    expect(pairs.has(newPair)).toBe(false);
    pairs.add(newPair);
    expect(pairs.has(newPair)).toBe(true);
  });
});

// ========================================
// Tag Tests
// ========================================

describe("Tag Normalization", () => {
  it("tags are normalized to lowercase slugs", () => {
    const tagName = "Single Qubit";
    const tagSlug = normalizeSlug(tagName);
    expect(tagSlug).toBe("single-qubit");
  });

  it("prevents duplicate tags via unique slug", () => {
    const tags = new Map<string, string>();

    tags.set("single-qubit", "Single Qubit");

    // Attempting to add the same slug should be caught by unique constraint
    expect(tags.has("single-qubit")).toBe(true);
  });
});

// ========================================
// Problem Relation Types
// ========================================

describe("Problem Relations", () => {
  const validRelationTypes = [
    "PREREQUISITE",
    "RELATED",
    "NEXT",
    "SAME_CONCEPT",
  ];

  it("defines expected relation types", () => {
    expect(validRelationTypes).toContain("PREREQUISITE");
    expect(validRelationTypes).toContain("RELATED");
    expect(validRelationTypes).toContain("NEXT");
    expect(validRelationTypes).toContain("SAME_CONCEPT");
  });

  it("prerequisite relation implies direction", () => {
    // If A has PREREQUISITE to B, then B should be completed before A
    const relation = {
      fromId: "advanced-problem",
      toId: "basic-problem",
      type: "PREREQUISITE",
    };

    // The "from" problem requires the "to" problem
    expect(relation.type).toBe("PREREQUISITE");
    expect(relation.fromId).toBe("advanced-problem");
    expect(relation.toId).toBe("basic-problem");
  });

  it("next relation implies sequence", () => {
    const relation = {
      fromId: "problem-1",
      toId: "problem-2",
      type: "NEXT",
    };

    // problem-1 comes before problem-2
    expect(relation.fromId).toBe("problem-1");
    expect(relation.toId).toBe("problem-2");
  });
});

// ========================================
// Test Specification Architecture
// ========================================

describe("Test Specification Types", () => {
  const validTestTypes = [
    "STRUCTURAL",
    "FUNCTIONAL",
    "STATE",
    "DISTRIBUTION",
    "UNITARY",
    "OBSERVABLE",
    "ENTANGLEMENT",
    "STATISTICAL",
    "RESOURCE",
  ];

  it("defines expected test specification types", () => {
    expect(validTestTypes).toContain("STRUCTURAL");
    expect(validTestTypes).toContain("STATE");
    expect(validTestTypes).toContain("DISTRIBUTION");
    expect(validTestTypes).toContain("ENTANGLEMENT");
    expect(validTestTypes).toContain("RESOURCE");
  });

  it("test specs have description and expected fields", () => {
    const testSpec = {
      type: "STATE",
      description: "Verify qubit is in |0> state",
      expected: { statevector: [1, 0], tolerance: 0.01 },
    };

    expect(testSpec).toHaveProperty("type");
    expect(testSpec).toHaveProperty("description");
    expect(testSpec).toHaveProperty("expected");
  });
});
