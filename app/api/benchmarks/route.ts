/**
 * /api/benchmarks
 *
 * GET — list the official benchmark corpus. Definitions are
 *       application-managed; users can run them but cannot define new
 *       ones through the API.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const benchmarks = await prisma.benchmark.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        category: true,
        shots: true,
        seed: true,
      },
    });

    return NextResponse.json({ benchmarks });
  } catch {
    return NextResponse.json({ error: "Unable to load benchmarks." }, { status: 500 });
  }
}
