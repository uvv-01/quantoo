/**
 * /api/projects/[projectId]
 *
 * GET    — project detail with resolved, evidence-backed items.
 * POST   — add an item (ownership of the referenced resource enforced).
 * DELETE — remove an item (?itemId=...) or the project itself.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkRateLimit, RATE_LIMITS, getRateLimitKey } from "@/lib/auth/rate-limit";
import {
  addItemSchema,
  projectIdSchema,
} from "@/lib/projects/validation";
import {
  addProjectItem,
  deleteProject,
  getProjectDetail,
  removeProjectItem,
} from "@/lib/projects/service";
import { PROJECT_ITEM_TYPES } from "@/lib/projects/service";

type RouteParams = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { projectId } = await params;
    const parsed = projectIdSchema.safeParse(projectId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
    }

    const detail = await getProjectDetail(user.id, parsed.data);
    if (!detail) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ project: detail });
  } catch {
    return NextResponse.json({ error: "Unable to load the project." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const limit = checkRateLimit(getRateLimitKey(user.id, "project"), RATE_LIMITS.project);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const { projectId } = await params;
    const idParsed = projectIdSchema.safeParse(projectId);
    if (!idParsed.success) {
      return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
    }
    const parsed = addItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }
    if (!PROJECT_ITEM_TYPES.includes(parsed.data.itemType)) {
      return NextResponse.json({ error: "Unknown item type." }, { status: 400 });
    }

    const result = await addProjectItem({
      userId: user.id,
      projectId: idParsed.data,
      itemType: parsed.data.itemType,
      itemId: parsed.data.itemId,
      note: parsed.data.note ?? null,
    });
    if ("error" in result) {
      const status = result.error.includes("not found") ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to add the item." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { projectId } = await params;
    const idParsed = projectIdSchema.safeParse(projectId);
    if (!idParsed.success) {
      return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
    }

    const itemId = new URL(request.url).searchParams.get("itemId");
    if (itemId) {
      const itemParsed = zUuid.safeParse(itemId);
      if (!itemParsed.success) {
        return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
      }
      const removed = await removeProjectItem(user.id, idParsed.data, itemParsed.data);
      if (!removed) {
        return NextResponse.json({ error: "Item not found." }, { status: 404 });
      }
      return NextResponse.json({ removed: true });
    }

    const deleted = await deleteProject(user.id, idParsed.data);
    if (!deleted) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete." }, { status: 500 });
  }
}

import { z as zUuidImport } from "zod";
const zUuid = zUuidImport.string().uuid("Invalid item id");
