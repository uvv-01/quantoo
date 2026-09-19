/**
 * Projects service.
 *
 * A project is a user-organized container for evidence. Items reference
 * existing resources by id and type; payloads are never duplicated.
 * Ownership is enforced twice: the project belongs to the caller, and
 * every referenced private resource (submission, experiment, artifact)
 * must also belong to them. Problems are platform-global and may be
 * referenced freely.
 */

import { prisma } from "@/lib/prisma";

export const PROJECT_ITEM_TYPES = [
  "PROBLEM",
  "SUBMISSION",
  "COMPATIBILITY_EXPERIMENT",
  "RESEARCH_ARTIFACT",
] as const;

export type ProjectItemType = (typeof PROJECT_ITEM_TYPES)[number];

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItemView {
  id: string;
  itemType: ProjectItemType;
  itemId: string;
  note: string | null;
  createdAt: string;
  /** Resolved display data; null entries indicate a deleted resource. */
  label: string | null;
  href: string | null;
}

// ========================================
// Projects
// ========================================

export async function createProject(params: {
  userId: string;
  name: string;
  description: string | null;
}): Promise<{ id: string } | { error: string }> {
  const count = await prisma.project.count({ where: { userId: params.userId } });
  if (count >= 50) {
    return { error: "Project limit reached." };
  }
  const project = await prisma.project.create({
    data: {
      userId: params.userId,
      name: params.name,
      description: params.description,
    },
    select: { id: true },
  });
  return { id: project.id };
}

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { items: { select: { id: true } } },
  });
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    itemCount: project.items.length,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }));
}

export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const result = await prisma.project.deleteMany({ where: { id: projectId, userId } });
  return result.count > 0;
}

// ========================================
// Items
// ========================================

/**
 * Verify the referenced resource exists and (for private resource types)
 * belongs to the user. Returns a display label when verification passes.
 */
async function verifyOwnership(
  userId: string,
  itemType: ProjectItemType,
  itemId: string,
): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  switch (itemType) {
    case "PROBLEM": {
      const problem = await prisma.problem.findUnique({
        where: { id: itemId },
        select: { title: true, status: true },
      });
      if (!problem || problem.status !== "PUBLISHED") {
        return { ok: false, error: "Problem not found." };
      }
      return { ok: true, label: problem.title };
    }
    case "SUBMISSION": {
      const submission = await prisma.submission.findUnique({
        where: { id: itemId },
        select: { id: true, userId: true, status: true, createdAt: true },
      });
      if (!submission || submission.userId !== userId) {
        return { ok: false, error: "Execution not found." };
      }
      return {
        ok: true,
        label: `Execution ${submission.id.slice(0, 8)} (${submission.status.toLowerCase()})`,
      };
    }
    case "COMPATIBILITY_EXPERIMENT": {
      const experiment = await prisma.compatibilityExperiment.findUnique({
        where: { id: itemId },
        select: { userId: true, name: true },
      });
      if (!experiment || experiment.userId !== userId) {
        return { ok: false, error: "Experiment not found." };
      }
      return { ok: true, label: experiment.name };
    }
    case "RESEARCH_ARTIFACT": {
      const artifact = await prisma.researchArtifact.findUnique({
        where: { id: itemId },
        select: { userId: true, title: true },
      });
      if (!artifact || artifact.userId !== userId) {
        return { ok: false, error: "Artifact not found." };
      }
      return { ok: true, label: artifact.title };
    }
  }
}

export async function addProjectItem(params: {
  userId: string;
  projectId: string;
  itemType: ProjectItemType;
  itemId: string;
  note: string | null;
}): Promise<{ id: string; label: string } | { error: string }> {
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId: params.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found." };

  const itemCount = await prisma.projectItem.count({
    where: { projectId: params.projectId },
  });
  if (itemCount >= 200) {
    return { error: "Project item limit reached." };
  }

  const verified = await verifyOwnership(params.userId, params.itemType, params.itemId);
  if (!verified.ok) return { error: verified.error };

  try {
    const item = await prisma.projectItem.create({
      data: {
        projectId: params.projectId,
        itemType: params.itemType,
        itemId: params.itemId,
        note: params.note,
      },
      select: { id: true },
    });
    return { id: item.id, label: verified.label };
  } catch {
    // Unique constraint: the item is already in this project.
    return { error: "This item is already in the project." };
  }
}

export async function removeProjectItem(
  userId: string,
  projectId: string,
  itemId: string,
): Promise<boolean> {
  // The compound delete ensures both the project and the item are owned
  // by the caller before anything is removed.
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) return false;
  const result = await prisma.projectItem.deleteMany({
    where: { id: itemId, projectId },
  });
  return result.count > 0;
}

export async function getProjectDetail(
  userId: string,
  projectId: string,
): Promise<{ name: string; description: string | null; items: ProjectItemView[] } | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!project) return null;

  const items: ProjectItemView[] = [];
  for (const item of project.items) {
    let label: string | null = null;
    let href: string | null = null;
    const type = item.itemType as ProjectItemType;
    if (PROJECT_ITEM_TYPES.includes(type)) {
      const verified = await verifyOwnership(userId, type, item.itemId);
      if (verified.ok) {
        label = verified.label;
        switch (type) {
          case "PROBLEM":
            href = `/problems/${item.itemId}`; // replaced below with slug-based route
            break;
          default:
            href = null;
        }
      }
    }
    items.push({
      id: item.id,
      itemType: type,
      itemId: item.itemId,
      note: item.note,
      createdAt: item.createdAt.toISOString(),
      label,
      href,
    });
  }

  return { name: project.name, description: project.description, items };
}
