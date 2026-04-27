import { describe, it, expect } from "vitest";
import {
  tasksToCSV,
  projectsToCSV,
  parseTasksFromCSV,
  parseProjectsFromCSV,
} from "@/lib/csv";
import type { Task, Project } from "@/lib/types";

const projects: Project[] = [
  { id: "p1", name: "My Project", description: "A project", status: "active", tags: [], createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
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

describe("tasksToCSV", () => {
  it("starts with correct headers", () => {
    const csv = tasksToCSV(tasks, projects);
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toBe("id,project,title,description,status,priority,assignee,tags,dueDate,createdAt,updatedAt");
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
    expect(csv.split("\n")[0]).toBe("id,name,description,status,tags,createdAt,updatedAt");
  });

  it("includes project data", () => {
    const csv = projectsToCSV(projects);
    expect(csv).toContain("My Project");
    expect(csv).toContain("active");
  });
});

describe("parseTasksFromCSV", () => {
  it("roundtrip: export then import yields same task data", () => {
    const csv = tasksToCSV(tasks, projects);
    const existingTitles = new Set<string>();
    // Simulate existing titles in the system so roundtrip sees duplicates for t1
    // Actually, they won't exist yet since we start fresh
    const parsed = parseTasksFromCSV(csv, existingTitles);

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.data).toHaveLength(2);

    // First task
    expect(parsed.data[0].title).toBe("Build feature");
    expect(parsed.data[0].projectName).toBe("My Project");
    expect(parsed.data[0].status).toBe("in-progress");
    expect(parsed.data[0].priority).toBe("high");
    expect(parsed.data[0].assignee).toBe("alice@example.com");
    expect(parsed.data[0].dueDate).toBe("2024-03-01");
    expect(parsed.data[0].tags).toHaveLength(1);
    expect(parsed.data[0].tags[0].name).toBe("frontend");

    // Second task with escaped content
    expect(parsed.data[1].title).toBe('Task with "quotes"');
    expect(parsed.data[1].description).toBe("Has commas, and quotes");
    expect(parsed.data[1].status).toBe("todo");
    expect(parsed.data[1].priority).toBe("low");
    expect(parsed.data[1].dueDate).toBeNull();
  });

  it("skips empty lines", () => {
    const csv = tasksToCSV(tasks, projects) + "\n\n\n";
    const parsed = parseTasksFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(2);
    expect(parsed.errors).toHaveLength(0);
  });

  it("reports errors for rows with too few fields", () => {
    const csv = "id,project,title,description,status,priority,assignee,tags,dueDate,createdAt,updatedAt\n1,Proj,My Task";
    const parsed = parseTasksFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(0);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors[0].message).toContain("too few fields");
  });

  it("rejects invalid status values", () => {
    const csv = "id,project,title,description,status,priority,assignee,tags,dueDate,createdAt,updatedAt\n1,Proj,Task1,Desc,invalid_status,high,,,,";
    const parsed = parseTasksFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(0);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors[0].message).toContain("invalid status");
  });

  it("rejects invalid priority values", () => {
    const csv = "id,project,title,description,status,priority,assignee,tags,dueDate,createdAt,updatedAt\n1,Proj,Task1,Desc,todo,urgent,,,,";
    const parsed = parseTasksFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(0);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors[0].message).toContain("invalid priority");
  });

  it("skips duplicate tasks by title within project", () => {
    const existing = new Set<string>();
    existing.add("My Project::Build feature");

    const csv = tasksToCSV(tasks, projects);
    const parsed = parseTasksFromCSV(csv, existing);

    // First task should be skipped (duplicate)
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].title).toBe('Task with "quotes"');
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].message).toContain("duplicate");
  });

  it("handles BOM prefix", () => {
    const csv = "\uFEFF" + tasksToCSV(tasks, projects);
    const parsed = parseTasksFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(2);
    expect(parsed.errors).toHaveLength(0);
  });

  it("handles CRLF line endings", () => {
    const csv = tasksToCSV(tasks, projects).replace(/\n/g, "\r\n");
    const parsed = parseTasksFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(2);
    expect(parsed.errors).toHaveLength(0);
  });

  it("handles quoted commas in cells", () => {
    const csv = "id,project,title,description,status,priority,assignee,tags,dueDate,createdAt,updatedAt\n1,Proj,\"Task, with comma\",\"Desc, with comma\",todo,high,,,,";
    const parsed = parseTasksFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].title).toBe("Task, with comma");
    expect(parsed.data[0].description).toBe("Desc, with comma");
    expect(parsed.errors).toHaveLength(0);
  });

  it("requires title", () => {
    const csv = "id,project,title,description,status,priority,assignee,tags,dueDate,createdAt,updatedAt\n1,Proj,,Desc,todo,high,,,,";
    const parsed = parseTasksFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(0);
    expect(parsed.errors[0].message).toContain("title is required");
  });

  it("requires project name", () => {
    const csv = "id,project,title,description,status,priority,assignee,tags,dueDate,createdAt,updatedAt\n1,,My Task,Desc,todo,high,,,,";
    const parsed = parseTasksFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(0);
    expect(parsed.errors[0].message).toContain("project name is required");
  });

  it("parses semicolon-separated tags", () => {
    const csv = "id,project,title,description,status,priority,assignee,tags,dueDate,createdAt,updatedAt\n1,Proj,Task1,Desc,todo,high,,frontend;backend;api,2024-01-01,,";
    const parsed = parseTasksFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].tags).toHaveLength(3);
    expect(parsed.data[0].tags.map((t) => t.name)).toEqual(["frontend", "backend", "api"]);
  });
});

describe("parseProjectsFromCSV", () => {
  it("roundtrip: export then import yields same project data", () => {
    const csv = projectsToCSV(projects);
    const parsed = parseProjectsFromCSV(csv, new Set());

    expect(parsed.errors).toHaveLength(0);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe("My Project");
    expect(parsed.data[0].description).toBe("A project");
    expect(parsed.data[0].status).toBe("active");
  });

  it("skips empty lines", () => {
    const csv = projectsToCSV(projects) + "\n\n";
    const parsed = parseProjectsFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(1);
  });

  it("skips duplicate projects by name", () => {
    const existing = new Set<string>();
    existing.add("My Project");

    const csv = projectsToCSV(projects);
    const parsed = parseProjectsFromCSV(csv, existing);
    expect(parsed.data).toHaveLength(0);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].message).toContain("duplicate");
  });

  it("rejects invalid project status", () => {
    const csv = "id,name,description,status,tags,createdAt,updatedAt\n1,Proj1,Desc,deleted,,";
    const parsed = parseProjectsFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(0);
    expect(parsed.errors[0].message).toContain("invalid project status");
  });

  it("requires project name", () => {
    const csv = "id,name,description,status,tags,createdAt,updatedAt\n1,,Desc,active,,";
    const parsed = parseProjectsFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(0);
    expect(parsed.errors[0].message).toContain("project name is required");
  });

  it("handles BOM prefix", () => {
    const csv = "\uFEFF" + projectsToCSV(projects);
    const parsed = parseProjectsFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(1);
    expect(parsed.errors).toHaveLength(0);
  });

  it("handles CRLF line endings", () => {
    const csv = projectsToCSV(projects).replace(/\n/g, "\r\n");
    const parsed = parseProjectsFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(1);
    expect(parsed.errors).toHaveLength(0);
  });

  it("handles quoted commas in project fields", () => {
    const csv = "id,name,description,status,tags,createdAt,updatedAt\n1,\"My, Project\",\"Desc, with, commas\",active,,";
    const parsed = parseProjectsFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe("My, Project");
    expect(parsed.data[0].description).toBe("Desc, with, commas");
  });

  it("parses semicolon-separated tags", () => {
    const csv = "id,name,description,status,tags,createdAt,updatedAt\n1,Proj1,Desc,active,frontend;backend;api,,";
    const parsed = parseProjectsFromCSV(csv, new Set());
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].tags).toHaveLength(3);
    expect(parsed.data[0].tags.map((t) => t.name)).toEqual(["frontend", "backend", "api"]);
  });
});
