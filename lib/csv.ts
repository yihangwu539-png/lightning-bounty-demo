import type { Task, Project, TaskStatus, TaskPriority, ProjectStatus } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeCell(value: string | null | undefined): string {
  const s = value ?? "";
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells: string[]): string {
  return cells.map(escapeCell).join(",");
}

// ---------------------------------------------------------------------------
// CSV parsing helpers
// ---------------------------------------------------------------------------

/** Split a single CSV line into cells, respecting quoted fields. */
function parseLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  cells.push(current);
  return cells;
}

/** Normalise line endings and strip BOM. */
function normaliseCSV(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "") // strip BOM
    .replace(/\r\n/g, "\n") // CRLF → LF
    .replace(/\r/g, "\n"); // old-Mac CR → LF
}

/** Split CSV body into rows, skipping empty lines. */
function parseRows(raw: string): string[] {
  const normalised = normaliseCSV(raw);
  return normalised
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// ---------------------------------------------------------------------------
// Public: Tasks CSV
// ---------------------------------------------------------------------------

const TASK_HEADERS = [
  "id",
  "project",
  "title",
  "description",
  "status",
  "priority",
  "assignee",
  "tags",
  "dueDate",
  "createdAt",
  "updatedAt",
];

export function tasksToCSV(tasks: Task[], projects: Project[]): string {
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const lines = [TASK_HEADERS.join(",")];

  for (const task of tasks) {
    lines.push(
      row([
        task.id,
        projectMap.get(task.projectId) ?? task.projectId,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.assignee,
        task.tags.map((t) => t.name).join(";"),
        task.dueDate ?? "",
        task.createdAt,
        task.updatedAt,
      ]),
    );
  }

  return lines.join("\n");
}

export interface ParseResult<T> {
  items: T[];
  errors: string[];
}

const VALID_TASK_STATUSES = new Set<TaskStatus>([
  "todo",
  "in-progress",
  "done",
  "blocked",
]);

const VALID_TASK_PRIORITIES = new Set<TaskPriority>(["low", "medium", "high"]);

/**
 * Parse a tasks CSV string into an array of partial Task objects.
 * Malformed rows are skipped and reported in `errors`.
 */
export function parseTasksCSV(
  raw: string,
  projects: Project[],
): ParseResult<Omit<Task, "id">> {
  const rows = parseRows(raw);

  if (rows.length < 2) {
    return { items: [], errors: ["CSV file is empty or contains only headers"] };
  }

  // Validate header row
  const header = parseLine(rows[0]);
  const headerLower = header.map((h) => h.toLowerCase().trim());
  const expected = TASK_HEADERS.map((h) => h.toLowerCase());

  const headerOk =
    expected.every((h) => headerLower.includes(h)) &&
    headerLower.includes("title");

  if (!headerOk) {
    return {
      items: [],
      errors: [
        `CSV headers don't match expected format. Expected: ${TASK_HEADERS.join(", ")}`,
      ],
    };
  }

  // Build index mapping from header name → column index
  const colIndex = new Map<string, number>();
  headerLower.forEach((h, i) => colIndex.set(h, i));

  // Build project name → id lookup for the merge strategy
  const projectNameToId = new Map<string, string>();
  for (const p of projects) {
    projectNameToId.set(p.name.toLowerCase().trim(), p.id);
  }

  const items: Omit<Task, "id">[] = [];
  const errors: string[] = [];

  for (let ri = 1; ri < rows.length; ri++) {
    const cells = parseLine(rows[ri]);

    const get = (name: string): string => {
      const idx = colIndex.get(name);
      return idx !== undefined && idx < cells.length ? cells[idx].trim() : "";
    };

    const title = get("title");
    if (!title) {
      errors.push(`Row ${ri + 1}: missing title, skipped`);
      continue;
    }

    const projectName = get("project");
    const status = get("status") || "todo";
    const priority = get("priority") || "medium";

    if (!VALID_TASK_STATUSES.has(status as TaskStatus)) {
      errors.push(
        `Row ${ri + 1}: invalid status "${status}", skipped`,
      );
      continue;
    }

    if (!VALID_TASK_PRIORITIES.has(priority as TaskPriority)) {
      errors.push(
        `Row ${ri + 1}: invalid priority "${priority}", skipped`,
      );
      continue;
    }

    // Resolve projectId from project name
    const matchedProjectId = projectNameToId.get(projectName.toLowerCase().trim());
    if (!matchedProjectId) {
      errors.push(
        `Row ${ri + 1}: unknown project "${projectName}", skipped`,
      );
      continue;
    }

    // Parse tags (semicolon-separated)
    const tagsRaw = get("tags");
    const tagNames = tagsRaw ? tagsRaw.split(";").map((t) => t.trim()).filter(Boolean) : [];

    const now = new Date().toISOString();

    items.push({
      projectId: matchedProjectId,
      title,
      description: get("description"),
      status: status as TaskStatus,
      priority: priority as TaskPriority,
      assignee: get("assignee"),
      dueDate: get("dueDate") || null,
      tags: tagNames.map((name) => ({
        id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        color: defaultTagColor(name),
      })),
      createdAt: now,
      updatedAt: now,
    });
  }

  return { items, errors };
}

// ---------------------------------------------------------------------------
// Public: Projects CSV
// ---------------------------------------------------------------------------

const PROJECT_HEADERS = [
  "id",
  "name",
  "description",
  "status",
  "tags",
  "createdAt",
  "updatedAt",
];

export function projectsToCSV(projects: Project[]): string {
  const lines = [PROJECT_HEADERS.join(",")];

  for (const p of projects) {
    lines.push(
      row([
        p.id,
        p.name,
        p.description,
        p.status,
        p.tags.map((t) => t.name).join(";"),
        p.createdAt,
        p.updatedAt,
      ]),
    );
  }

  return lines.join("\n");
}

const VALID_PROJECT_STATUSES = new Set<ProjectStatus>([
  "active",
  "archived",
  "completed",
]);

/**
 * Parse a projects CSV string into an array of partial Project objects.
 * Malformed rows are skipped and reported in `errors`.
 */
export function parseProjectsCSV(
  raw: string,
): ParseResult<Omit<Project, "id">> {
  const rows = parseRows(raw);

  if (rows.length < 2) {
    return { items: [], errors: ["CSV file is empty or contains only headers"] };
  }

  const header = parseLine(rows[0]);
  const headerLower = header.map((h) => h.toLowerCase().trim());
  const expected = PROJECT_HEADERS.map((h) => h.toLowerCase());

  const headerOk =
    expected.every((h) => headerLower.includes(h)) &&
    headerLower.includes("name");

  if (!headerOk) {
    return {
      items: [],
      errors: [
        `CSV headers don't match expected format. Expected: ${PROJECT_HEADERS.join(", ")}`,
      ],
    };
  }

  const colIndex = new Map<string, number>();
  headerLower.forEach((h, i) => colIndex.set(h, i));

  const items: Omit<Project, "id">[] = [];
  const errors: string[] = [];

  for (let ri = 1; ri < rows.length; ri++) {
    const cells = parseLine(rows[ri]);

    const get = (name: string): string => {
      const idx = colIndex.get(name);
      return idx !== undefined && idx < cells.length ? cells[idx].trim() : "";
    };

    const name = get("name");
    if (!name) {
      errors.push(`Row ${ri + 1}: missing name, skipped`);
      continue;
    }

    const status = get("status") || "active";
    if (!VALID_PROJECT_STATUSES.has(status as ProjectStatus)) {
      errors.push(`Row ${ri + 1}: invalid status "${status}", skipped`);
      continue;
    }

    const tagsRaw = get("tags");
    const tagNames = tagsRaw ? tagsRaw.split(";").map((t) => t.trim()).filter(Boolean) : [];

    const now = new Date().toISOString();

    items.push({
      name,
      description: get("description"),
      status: status as ProjectStatus,
      tags: tagNames.map((name) => ({
        id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        color: defaultTagColor(name),
      })),
      createdAt: now,
      updatedAt: now,
    });
  }

  return { items, errors };
}

// ---------------------------------------------------------------------------
// Merge strategy: skip duplicates by title within project
// ---------------------------------------------------------------------------

/**
 * Merge parsed tasks into existing tasks, skipping any whose title already
 * exists within the same project. Returns the merged array and a count of
 * skipped duplicates.
 */
export function mergeTasks(
  existing: Task[],
  incoming: Omit<Task, "id">[],
): { tasks: Task[]; skipped: number } {
  // Build a set of "<projectId>::<title>" keys for existing tasks
  const existingKeys = new Set<string>();
  for (const t of existing) {
    existingKeys.add(`${t.projectId}::${t.title.toLowerCase().trim()}`);
  }

  const merged = [...existing];
  let skipped = 0;

  for (const item of incoming) {
    const key = `${item.projectId}::${item.title.toLowerCase().trim()}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    existingKeys.add(key);
    merged.push({
      ...item,
      id: generateId(),
    });
  }

  return { tasks: merged, skipped };
}

/**
 * Merge parsed projects into existing projects, skipping any whose name
 * already exists in the project list.
 */
export function mergeProjects(
  existing: Project[],
  incoming: Omit<Project, "id">[],
): { projects: Project[]; skipped: number } {
  const existingNames = new Set(existing.map((p) => p.name.toLowerCase().trim()));
  const merged = [...existing];
  let skipped = 0;

  for (const item of incoming) {
    if (existingNames.has(item.name.toLowerCase().trim())) {
      skipped++;
      continue;
    }
    existingNames.add(item.name.toLowerCase().trim());
    merged.push({
      ...item,
      id: generateId(),
    });
  }

  return { projects: merged, skipped };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

let idCounter = Date.now();

function generateId(): string {
  return `import-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Deterministic-ish colour for a tag name. */
function defaultTagColor(_name: string): string {
  const palette = [
    "#f97316", "#3b82f6", "#8b5cf6", "#10b981",
    "#ec4899", "#14b8a6", "#6366f1", "#f59e0b",
    "#64748b", "#0ea5e9",
  ];
  // Simple hash to pick a colour
  let hash = 0;
  for (let i = 0; i < _name.length; i++) {
    hash = _name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}
