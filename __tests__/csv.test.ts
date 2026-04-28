import { describe, it, expect } from "vitest";
import {
  tasksToCSV,
  projectsToCSV,
  parseTasksCSV,
  parseProjectsCSV,
  mergeTasks,
  mergeProjects,
} from "@/lib/csv";
import type { Task, Project } from "@/lib/types";

const projects: Project[] = [
  {
    id: "p1",
    name: "My Project",
    description: "A project",
    status: "active",
    tags: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "p2",
    name: "Another Project",
    description: "Another project",
    status: "active",
    tags: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

const tasks: Task[] = [
  {
    id: "t1",
    projectId: "p1",
    title: "Build feature",
    description: "Implement the main feature",
    status: "in-progress",
    priority: "high",
    tags: [{ id: "tag1", name: "frontend", color: "#f97316" }],
    assignee: "alice@example.com",
    dueDate: "2024-03-01",
    createdAt: "2024-01-10T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "t2",
    projectId: "p1",
    title: 'Task with "quotes"',
    description: "Has commas, and quotes",
    status: "todo",
    priority: "low",
    tags: [],
    assignee: "",
    dueDate: null,
    createdAt: "2024-01-11T00:00:00Z",
    updatedAt: "2024-01-11T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Export tests (existing)
// ---------------------------------------------------------------------------

describe("tasksToCSV", () => {
  it("starts with correct headers", () => {
    const csv = tasksToCSV(tasks, projects);
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toBe(
      "id,project,title,description,status,priority,assignee,tags,dueDate,createdAt,updatedAt",
    );
  });

  it("includes task data", () => {
    const csv = tasksToCSV(tasks, projects);
    expect(csv).toContain("Build feature");
    expect(csv).toContain("My Project");
    expect(csv).toContain("in-progress");
    expect(csv).toContain("frontend");
  });

  it("escapes cells with commas and quotes", () => {
    const csv = tasksToCSV(tasks, projects);
    expect(csv).toContain('"Task with ""quotes"""');
    expect(csv).toContain('"Has commas, and quotes"');
  });

  it("has correct number of rows", () => {
    const csv = tasksToCSV(tasks, projects);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // header + 2 tasks
  });
});

describe("projectsToCSV", () => {
  it("starts with correct headers", () => {
    const csv = projectsToCSV(projects);
    expect(csv.split("\n")[0]).toBe(
      "id,name,description,status,tags,createdAt,updatedAt",
    );
  });

  it("includes project data", () => {
    const csv = projectsToCSV(projects);
    expect(csv).toContain("My Project");
    expect(csv).toContain("active");
  });
});

// ---------------------------------------------------------------------------
// Import tests (new)
// ---------------------------------------------------------------------------

describe("parseTasksCSV", () => {
  it("parses a valid tasks CSV", () => {
    const csv = tasksToCSV(tasks, projects);
    const result = parseTasksCSV(csv, projects);
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe("Build feature");
    expect(result.items[1].title).toBe('Task with "quotes"');
  });

  it("roundtrip preserves task data", () => {
    const csv = tasksToCSV(tasks, projects);
    const result = parseTasksCSV(csv, projects);
    expect(result.items[0].projectId).toBe("p1");
    expect(result.items[0].status).toBe("in-progress");
    expect(result.items[0].priority).toBe("high");
    expect(result.items[0].tags.map((t) => t.name)).toEqual(["frontend"]);
  });

  it("skips rows with missing titles", () => {
    const csv = "id,project,title,description,status\n1,p1,,No title,todo";
    const result = parseTasksCSV(csv, projects);
    expect(result.items).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("missing title");
  });

  it("skips rows with unknown project", () => {
    const csv =
      "id,project,title,description,status,priority\n1,UnknownProject,Test task,desc,todo,medium";
    const result = parseTasksCSV(csv, projects);
    expect(result.items).toHaveLength(0);
    expect(result.errors[0]).toContain("unknown project");
  });

  it("skips rows with invalid status", () => {
    const csv =
      "id,project,title,status,priority\n1,My Project,Test task,invalid_status,medium";
    const result = parseTasksCSV(csv, projects);
    expect(result.items).toHaveLength(0);
    expect(result.errors[0]).toContain("invalid status");
  });

  it("skips rows with invalid priority", () => {
    const csv =
      "id,project,title,status,priority\n1,My Project,Test task,todo,urgent";
    const result = parseTasksCSV(csv, projects);
    expect(result.items).toHaveLength(0);
    expect(result.errors[0]).toContain("invalid priority");
  });

  it("handles empty CSV", () => {
    const result = parseTasksCSV("", projects);
    expect(result.items).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles headers-only CSV", () => {
    const result = parseTasksCSV(
      "id,project,title,description,status,priority,assignee,tags,dueDate,createdAt,updatedAt",
      projects,
    );
    expect(result.items).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles BOM in CSV", () => {
    const csv = "\uFEFF" + tasksToCSV(tasks, projects);
    const result = parseTasksCSV(csv, projects);
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(2);
  });

  it("handles CRLF line endings", () => {
    const csv = tasksToCSV(tasks, projects).replace(/\n/g, "\r\n");
    const result = parseTasksCSV(csv, projects);
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(2);
  });

  it("handles quoted commas in fields", () => {
    const csv =
      'id,project,title,description,status,priority\n1,My Project,"Task with, comma","Description, with comma",todo,medium';
    const result = parseTasksCSV(csv, projects);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Task with, comma");
    expect(result.items[0].description).toBe("Description, with comma");
  });

  it("handles semicolon-separated tags", () => {
    const csv =
      'id,project,title,description,status,priority,tags\n1,My Project,Multi-tag task,desc,todo,medium,"frontend;backend;api"';
    const result = parseTasksCSV(csv, projects);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].tags.map((t) => t.name)).toEqual([
      "frontend",
      "backend",
      "api",
    ]);
  });

  it("ignores extra columns beyond known headers", () => {
    const csv =
      "id,project,title,description,status,priority,extra_col\n1,My Project,Test task,desc,todo,medium,extra";
    const result = parseTasksCSV(csv, projects);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Test task");
  });
});

describe("parseProjectsCSV", () => {
  it("parses a valid projects CSV", () => {
    const csv = projectsToCSV(projects);
    const result = parseProjectsCSV(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe("My Project");
    expect(result.items[1].name).toBe("Another Project");
  });

  it("skips rows with missing names", () => {
    const csv =
      "id,name,description,status\n1,,No name project,active";
    const result = parseProjectsCSV(csv);
    expect(result.items).toHaveLength(0);
    expect(result.errors[0]).toContain("missing name");
  });
});

// ---------------------------------------------------------------------------
// Merge strategy tests
// ---------------------------------------------------------------------------

describe("mergeTasks", () => {
  it("adds new tasks and skips duplicates by title within project", () => {
    const existing: Task[] = [
      {
        id: "existing-1",
        projectId: "p1",
        title: "Existing Task",
        description: "",
        status: "todo",
        priority: "medium",
        tags: [],
        assignee: "",
        dueDate: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];

    const incoming: Omit<Task, "id">[] = [
      {
        projectId: "p1",
        title: "Existing Task", // duplicate
        description: "",
        status: "todo",
        priority: "medium",
        tags: [],
        assignee: "",
        dueDate: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
      {
        projectId: "p1",
        title: "New Task", // not duplicate
        description: "",
        status: "todo",
        priority: "medium",
        tags: [],
        assignee: "",
        dueDate: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];

    const { tasks: merged, skipped } = mergeTasks(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(merged[1].title).toBe("New Task");
    expect(merged[1].id).toBeDefined();
  });

  it("allows same title in different projects", () => {
    const existing: Task[] = [
      {
        id: "e1",
        projectId: "p1",
        title: "Same Title",
        description: "",
        status: "todo",
        priority: "medium",
        tags: [],
        assignee: "",
        dueDate: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];

    const incoming: Omit<Task, "id">[] = [
      {
        projectId: "p2",
        title: "Same Title", // same title, different project — not a duplicate
        description: "",
        status: "todo",
        priority: "medium",
        tags: [],
        assignee: "",
        dueDate: null,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];

    const { tasks: merged, skipped } = mergeTasks(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(skipped).toBe(0);
  });
});

describe("mergeProjects", () => {
  it("adds new projects and skips duplicates by name", () => {
    const existing: Project[] = [
      {
        id: "e1",
        name: "Existing Project",
        description: "",
        status: "active",
        tags: [],
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];

    const incoming: Omit<Project, "id">[] = [
      {
        name: "Existing Project", // duplicate
        description: "",
        status: "active",
        tags: [],
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
      {
        name: "New Project", // not duplicate
        description: "",
        status: "active",
        tags: [],
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];

    const { projects: merged, skipped } = mergeProjects(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(merged[1].name).toBe("New Project");
  });
});

// ---------------------------------------------------------------------------
// Full roundtrip tests
// ---------------------------------------------------------------------------

describe("roundtrip", () => {
  it("tasks CSV roundtrip preserves all data", () => {
    const csv = tasksToCSV(tasks, projects);
    const result = parseTasksCSV(csv, projects);
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(tasks.length);

    // Check each task's key fields survived
    for (let i = 0; i < tasks.length; i++) {
      expect(result.items[i].title).toBe(tasks[i].title);
      expect(result.items[i].status).toBe(tasks[i].status);
      expect(result.items[i].priority).toBe(tasks[i].priority);
      expect(result.items[i].assignee).toBe(tasks[i].assignee);
    }
  });

  it("projects CSV roundtrip preserves all data", () => {
    const csv = projectsToCSV(projects);
    const result = parseProjectsCSV(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.items).toHaveLength(projects.length);

    for (let i = 0; i < projects.length; i++) {
      expect(result.items[i].name).toBe(projects[i].name);
      expect(result.items[i].status).toBe(projects[i].status);
    }
  });

  it("export → parse → merge is lossless for non-duplicates", () => {
    // Export existing data
    const csv = tasksToCSV(tasks, projects);
    const parsed = parseTasksCSV(csv, projects);
    expect(parsed.errors).toHaveLength(0);

    // Merge with empty existing
    const { tasks: merged, skipped } = mergeTasks([], parsed.items);
    expect(skipped).toBe(0);
    expect(merged).toHaveLength(tasks.length);

    // Key content survived
    const mergedTitles = merged.map((t) => t.title);
    expect(mergedTitles).toContain("Build feature");
    expect(mergedTitles).toContain('Task with "quotes"');
  });
});
