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
  updateTaskOrder,
} from "@/lib/storage";
import { reorderTasks } from "@/lib/sort";
import type { Project, Task } from "@/lib/types";

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

function makeTask(id: string, projectId: string, order = 0): Task {
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
    order,
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

  describe("updateTaskOrder", () => {
    it("persists reordered tasks for a project", () => {
      clearAll();
      localStorage.clear();

      const t1 = makeTask("a", "proj-1", 0);
      const t2 = makeTask("b", "proj-1", 1);
      const t3 = makeTask("c", "proj-1", 2);
      saveTask(t1);
      saveTask(t2);
      saveTask(t3);

      // Reorder: move t3 (index 2) to index 0
      const projectTasks = getTasks("proj-1");
      const reordered = reorderTasks(projectTasks, 2, 0);
      updateTaskOrder(reordered);

      const stored = getTasks("proj-1");
      expect(stored).toHaveLength(3);
      // After reorder: c (order=0), a (order=1), b (order=2)
      expect(stored[0].id).toBe("c");
      expect(stored[0].order).toBe(0);
      expect(stored[1].id).toBe("a");
      expect(stored[1].order).toBe(1);
      expect(stored[2].id).toBe("b");
      expect(stored[2].order).toBe(2);
    });

    it("does not affect tasks from other projects", () => {
      clearAll();
      localStorage.clear();

      saveTask(makeTask("a", "proj-1", 0));
      saveTask(makeTask("b", "proj-1", 1));
      saveTask(makeTask("x", "proj-2", 0));

      const reordered = reorderTasks(getTasks("proj-1"), 1, 0);
      updateTaskOrder(reordered);

      const otherTasks = getTasks("proj-2");
      expect(otherTasks).toHaveLength(1);
      expect(otherTasks[0].id).toBe("x");
      expect(otherTasks[0].order).toBe(0);
    });
  });
});

describe("sort — reorderTasks", () => {
  it("moves a task from one index to another and recomputes order values", () => {
    const tasks = [
      makeTask("a", "p1", 0),
      makeTask("b", "p1", 1),
      makeTask("c", "p1", 2),
    ];
    const result = reorderTasks(tasks, 2, 0);
    expect(result.map((t) => t.id)).toEqual(["c", "a", "b"]);
    expect(result.map((t) => t.order)).toEqual([0, 1, 2]);
  });

  it("moves a task downward", () => {
    const tasks = [
      makeTask("a", "p1", 0),
      makeTask("b", "p1", 1),
      makeTask("c", "p1", 2),
      makeTask("d", "p1", 3),
    ];
    const result = reorderTasks(tasks, 0, 2);
    expect(result.map((t) => t.id)).toEqual(["b", "c", "a", "d"]);
    expect(result.map((t) => t.order)).toEqual([0, 1, 2, 3]);
  });

  it("handles no-op move (same index)", () => {
    const tasks = [makeTask("a", "p1", 0), makeTask("b", "p1", 1)];
    const result = reorderTasks(tasks, 1, 1);
    expect(result.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
