/**
 * /api/hardware/backends
 *
 * GET — execution backends with measured availability. Local simulators
 *       are labeled LOCAL_SIMULATOR; nothing is ever reported as
 *       quantum hardware unless a real provider integration exists and
 *       has been verified.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import { listBackendDescriptors, getBackend } from "@/lib/hardware/registry";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limit = checkRateLimit(getRateLimitKey(user.id, "hardware"), RATE_LIMITS.hardware);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const backends = await Promise.all(
      listBackendDescriptors().map(async (descriptor) => {
        const backend = getBackend(descriptor.id);
        const availability = backend ? await backend.checkAvailability() : null;
        const capabilities = backend ? backend.listCapabilities() : null;
        return { ...descriptor, availability, capabilities };
      }),
    );

    return NextResponse.json({ backends });
  } catch {
    return NextResponse.json({ error: "Unable to load backends." }, { status: 500 });
  }
}
