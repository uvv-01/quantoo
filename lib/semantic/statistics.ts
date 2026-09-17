/**
 * Distribution statistics for semantic comparison (Phase 6).
 *
 * Quantum measurement is probabilistic: two runs of the same program
 * rarely produce identical samples. Equality of sampled distributions is
 * therefore decided with explicit statistical metrics and configurable
 * thresholds — never raw equality, never an unexplained verdict.
 *
 * All functions accept sparse maps keyed by basis-state label (e.g. "01").
 * Missing keys have probability zero.
 */

/** Total variation distance: (1/2) * Σ|p_i − q_i|. Range [0, 1]. */
export function totalVariationDistance(
  p: Record<string, number>,
  q: Record<string, number>,
): number {
  let sum = 0;
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  for (const key of keys) {
    sum += Math.abs((p[key] ?? 0) - (q[key] ?? 0));
  }
  return sum / 2;
}

/** Hellinger distance for discrete distributions. Range [0, 1]. */
export function hellingerDistance(
  p: Record<string, number>,
  q: Record<string, number>,
): number {
  let sum = 0;
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  for (const key of keys) {
    const dp = Math.sqrt(Math.max(p[key] ?? 0, 0));
    const dq = Math.sqrt(Math.max(q[key] ?? 0, 0));
    const diff = dp - dq;
    sum += diff * diff;
  }
  // Classical BC-based definition: H = sqrt(1 - BC) where BC = Σ√(pq).
  // Direct form: H = (1/√2) * sqrt(Σ(√p − √q)²).
  return Math.min(1, Math.SQRT1_2 * Math.sqrt(sum));
}

/**
 * Compare two probability distributions (exact or sampled frequencies)
 * under a metric and threshold.
 */
export function compareDistributions(
  p: Record<string, number>,
  q: Record<string, number>,
  metric: "total_variation" | "hellinger",
  threshold: number,
): {
  value: number;
  pass: boolean;
  supportSize: number;
} {
  const value =
    metric === "hellinger"
      ? hellingerDistance(p, q)
      : totalVariationDistance(p, q);
  const supportSize = new Set([...Object.keys(p), ...Object.keys(q)]).size;
  return { value, pass: value <= threshold, supportSize };
}

/**
 * Sampled-frequency map from raw counts. Returns null for empty or
 * non-positive totals so degenerate artifacts are never compared.
 */
export function frequenciesFromCounts(
  counts: Record<string, number>,
): Record<string, number> | null {
  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  if (total <= 0) return null;
  const freq: Record<string, number> = {};
  for (const [bits, count] of Object.entries(counts)) {
    freq[bits] = count / total;
  }
  return freq;
}
