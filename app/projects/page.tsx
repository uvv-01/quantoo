"use client";

/**
 * Projects page (Phase 8).
 *
 * A project is a user-organized evidence container. Items reference
 * existing resources (problems, executions, compatibility experiments,
 * research artifacts) by id; ownership of every referenced private
 * resource is enforced server-side.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Folder } from "lucide-react";

interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ItemView {
  id: string;
  itemType: string;
  itemId: string;
  note: string | null;
  createdAt: string;
  label: string | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ name: string; description: string | null; items: ItemView[] } | null>(null);
  const [newName, setNewName] = useState("");
  const [addType, setAddType] = useState("PROBLEM");
  const [addItemId, setAddItemId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  const loadProjects = useCallback(() => {
    (async () => {
      try {
        const response = await fetch("/api/projects");
        if (response.status === 401) {
          setNeedsAuth(true);
          setLoading(false);
          return;
        }
        const body = (await response.json()) as { projects: ProjectSummary[] };
        setProjects(body.projects);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    })();
  }, []);

  // Only the most recently requested detail render wins; older responses
  // are dropped so a slow request can never overwrite a newer selection.
  const detailRequestRef = useRef(0);

  const loadDetail = useCallback((projectId: string) => {
    const requestToken = ++detailRequestRef.current;
    (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (requestToken !== detailRequestRef.current) return;
        if (!response.ok) {
          setDetail(null);
          return;
        }
        const body = (await response.json()) as {
          project: { name: string; description: string | null; items: ItemView[] };
        };
        if (requestToken !== detailRequestRef.current) return;
        setDetail(body.project);
      } catch {
        // Network failure: keep the last rendered detail.
      }
    })();
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selected) loadDetail(selected);
  }, [selected, loadDetail]);

  const createProject = useCallback(async () => {
    setError(null);
    setNotice(null);
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not create the project.");
      return;
    }
    setNewName("");
    setNotice("Project created.");
    await loadProjects();
  }, [newName, loadProjects]);

  const addItem = useCallback(async () => {
    if (!selected) return;
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/projects/${selected}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: addType, itemId: addItemId }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(body?.error ?? "Could not add the item.");
      return;
    }
    setAddItemId("");
    setNotice("Item added.");
    loadDetail(selected);
    loadProjects();
  }, [selected, addType, addItemId, loadDetail, loadProjects]);

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!selected) return;
      await fetch(`/api/projects/${selected}?itemId=${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      loadDetail(selected);
      loadProjects();
    },
    [selected, loadDetail, loadProjects],
  );

  if (needsAuth) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Projects</h1>
        <EmptyState
          title="Sign in required"
          description="Projects organize your executions, experiments, and research artifacts. Sign in to get started."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize real evidence: executions, experiments, and research artifacts.
          </p>
        </div>
        <Badge variant="outline">
          <Folder className="h-3 w-3 mr-1" aria-hidden="true" />
          Evidence
        </Badge>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mb-4 rounded-md border px-4 py-2 text-sm">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Your projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No projects yet. Create one to start collecting evidence.
              </p>
            ) : (
              <ul className="space-y-2">
                {projects.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selected === project.id ? "border-primary" : ""
                      }`}
                      onClick={() => setSelected(project.id)}
                    >
                      <span className="font-medium">{project.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {project.itemCount} item{project.itemCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t pt-3">
              <label className="sr-only" htmlFor="new-project-name">
                New project name
              </label>
              <div className="flex gap-2">
                <input
                  id="new-project-name"
                  className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
                  placeholder="New project name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  maxLength={120}
                />
                <Button size="sm" onClick={createProject} disabled={newName.trim().length === 0}>
                  Create
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {selected ? "Evidence items" : "Select a project"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected || !detail ? (
              <p className="text-sm text-muted-foreground">
                Choose a project on the left to view and manage its evidence.
              </p>
            ) : (
              <>
                {detail.items.length === 0 ? (
                  <EmptyState
                    title="Empty project"
                    description="Add executions, experiments, or artifacts below. References must belong to you."
                  />
                ) : (
                  <ul className="space-y-2">
                    {detail.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span>
                          <Badge variant="outline" className="mr-2">
                            {item.itemType.replace("_", " ")}
                          </Badge>
                          {item.label ?? (
                            <span className="text-muted-foreground">
                              (referenced resource no longer available)
                            </span>
                          )}
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)}>
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="border-t pt-4 grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                  <label className="sr-only" htmlFor="add-type">
                    Item type
                  </label>
                  <select
                    id="add-type"
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={addType}
                    onChange={(event) => setAddType(event.target.value)}
                  >
                    <option value="PROBLEM">Problem</option>
                    <option value="SUBMISSION">Execution</option>
                    <option value="COMPATIBILITY_EXPERIMENT">Experiment</option>
                    <option value="RESEARCH_ARTIFACT">Artifact</option>
                  </select>
                  <label className="sr-only" htmlFor="add-item-id">
                    Resource id
                  </label>
                  <input
                    id="add-item-id"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    placeholder="Resource id (uuid)"
                    value={addItemId}
                    onChange={(event) => setAddItemId(event.target.value)}
                  />
                  <Button size="sm" onClick={addItem} disabled={addItemId.trim().length === 0}>
                    Add
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
