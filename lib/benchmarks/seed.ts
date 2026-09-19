/**
 * Benchmark corpus seeding.
 *
 * Upserts the official benchmark definitions into the database. Run
 * explicitly (`node scripts-tmp-seed-benchmarks.cjs`) or from the
 * deployment's migration step; it is idempotent.
 */

import { prisma } from "@/lib/prisma";
import { BENCHMARK_CORPUS } from "@/lib/benchmarks/corpus";

export async function seedBenchmarks(): Promise<{ seeded: number }> {
  for (const benchmark of BENCHMARK_CORPUS) {
    await prisma.benchmark.upsert({
      where: { slug: benchmark.slug },
      update: {
        name: benchmark.name,
        description: benchmark.description,
        category: benchmark.category,
        sourceCode: benchmark.sourceCode,
        shots: benchmark.shots,
        seed: benchmark.seed,
      },
      create: {
        slug: benchmark.slug,
        name: benchmark.name,
        description: benchmark.description,
        category: benchmark.category,
        sourceCode: benchmark.sourceCode,
        shots: benchmark.shots,
        seed: benchmark.seed,
      },
    });
  }
  return { seeded: BENCHMARK_CORPUS.length };
}
