import { describe, it, expect, beforeEach } from "vitest";
import {
  getProjects,
  saveProject,
  getProject,
  deleteProject,
  getTasks,
  saveTask,
  getTask,
  deleteTask,
  clearAll,
  exportRaw,
  waitForInit,
} from "@/lib/storage";
import type { Project, Task } from "@/lib/types";
import { SEED_PROJECTS, SEED_TASKS } from "@/lib/seed";

function makeProject(id: string): Project {
  return {
    id,
    name: `Project ${id}`,
    description: "desc",
    status: "active",
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeTask(id: string, projectId: string): Task {
  return {
    id,
    projectId,
    title: `Task ${id}`,
    description: "",
    status: "todo",
    priority: "medium",
    tags: [],
    assignee: "",
    dueDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  clearAll();
  localStorage.clear();
});

describe("storage — projects", () => {
  it("returns seed projects on first load", () => {
    const projects = getProjects();
    expect(projects.length).toBeGreaterThanOrEqual(3);
  });

  it("saves and retrieves a project", () => {
    clearAll();
    localStorage.clear();
    const p = makeProject("test-1");
    saveProject(p);
    expect(getProject("test-1")).toMatchObject({ id: "test-1", name: "Project test-1" });
  });

  it("updates an existing project on save", () => {
    clearAll();
    localStorage.clear();
    const p = makeProject("test-2");
    saveProject(p);
    saveProject({ ...p, name: "Updated" });
    const projects = getProjects();
    const found = projects.find((x) => x.id === "test-2");
    expect(found?.name).toBe("Updated");
  });

  it("deletes a project", () => {
    clearAll();
    localStorage.clear();
    const p = makeProject("test-3");
    saveProject(p);
    deleteProject("test-3");
    expect(getProject("test-3")).toBeNull();
  });

  it("cascades task deletion when project is deleted", () => {
    clearAll();
    localStorage.clear();
    const p = makeProject("proj-x");
    const t = makeTask("task-x", "proj-x");
    saveProject(p);
    saveTask(t);
    deleteProject("proj-x");
    expect(getTask("task-x")).toBeNull();
  });
});

describe("storage — tasks", () => {
  it("saves and retrieves a task", () => {
    clearAll();
    localStorage.clear();
    const t = makeTask("task-1", "proj-1");
    saveTask(t);
    expect(getTask("task-1")).toMatchObject({ id: "task-1" });
  });

  it("filters tasks by projectId", () => {
    clearAll();
    localStorage.clear();
    saveTask(makeTask("t1", "proj-a"));
    saveTask(makeTask("t2", "proj-a"));
    saveTask(makeTask("t3", "proj-b"));
    expect(getTasks("proj-a")).toHaveLength(2);
    expect(getTasks("proj-b")).toHaveLength(1);
  });

  it("deletes a task", () => {
    clearAll();
    localStorage.clear();
    const t = makeTask("del-task", "proj-1");
    saveTask(t);
    deleteTask("del-task");
    expect(getTask("del-task")).toBeNull();
  });
});

describe("storage — exportRaw", () => {
  it("returns projects and tasks", () => {
    clearAll();
    localStorage.clear();
    const p = makeProject("exp-proj");
    saveProject(p);
    saveTask(makeTask("exp-task", "exp-proj"));
    const data = exportRaw();
    expect(data.projects.length).toBeGreaterThanOrEqual(1);
    expect(data.tasks.length).toBeGreaterThanOrEqual(1);
    expect(data.projects.find((x) => x.id === "exp-proj")).toBeTruthy();
  });
});

describe("storage — localStorage migration compat", () => {
  it("reads from localStorage when IndexedDB is not available (jsdom fallback)", () => {
    // In jsdom, IndexedDB is not available — our module falls back to localStorage
    clearAll();
    localStorage.clear();
    const p = makeProject("migrate-proj");
    saveProject(p);
    const stored = localStorage.getItem("pt_projects");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.find((x: Project) => x.id === "migrate-proj")).toBeTruthy();
  });

  it("preserves data across sessions (localStorage roundtrip)", () => {
    clearAll();
    localStorage.clear();
    saveProject(makeProject("roundtrip-1"));
    saveProject(makeProject("roundtrip-2"));
    // Simulate fresh load by reading directly from localStorage
    const raw = localStorage.getItem("pt_projects");
    const projects = JSON.parse(raw!) as Project[];
    expect(projects).toHaveLength(2);
    // Re-fetch via API layer
    expect(getProject("roundtrip-1")).not.toBeNull();
    expect(getProject("roundtrip-2")).not.toBeNull();
  });
});

describe("storage — waitForInit", () => {
  it("resolves without error", async () => {
    await expect(waitForInit()).resolves.toBeUndefined();
  });
});
