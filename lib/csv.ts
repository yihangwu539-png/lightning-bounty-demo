import type { Task, Project, TaskStatus, TaskPriority, ProjectStatus, Tag } from "./types";

function escapeCell(value: string | null | undefined): string {
  const s = value ?? "";
  // Wrap in quotes if contains comma, quote, or newline
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells: string[]): string {
  return cells.map(escapeCell).join(",");
}

export function tasksToCSV(tasks: Task[], projects: Project[]): string {
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const headers = [
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
  const lines = [headers.join(",")];

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
      ])
    );
  }

  return lines.join("\n");
}

export function projectsToCSV(projects: Project[]): string {
  const headers = ["id", "name", "description", "status", "tags", "createdAt", "updatedAt"];
  const lines = [headers.join(",")];

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
      ])
    );
  }

  return lines.join("\n");
}

/**
 * Parse a single CSV line respecting RFC 4180 (quoted fields with escaped quotes).
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
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
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

export interface CSVParseResult<T> {
  data: T[];
  errors: { row: number; message: string }[];
}

/**
 * Parse tasks CSV text into an array of partial Task-like objects.
 * Skips the header row and returns errors for malformed rows.
 * Merge strategy: duplicates by title within the same project are skipped.
 *
 * Expected CSV columns (matching tasksToCSV output):
 *   id, project, title, description, status, priority, assignee, tags, dueDate, createdAt, updatedAt
 */
export function parseTasksFromCSV(
  csvText: string,
  existingTitles: Set<string>
): CSVParseResult<Omit<Task, "projectId"> & { projectName: string }> {
  const result: CSVParseResult<Omit<Task, "projectId"> & { projectName: string }> = {
    data: [],
    errors: [],
  };

  const lines = splitCSVLines(csvText);
  if (lines.length === 0) return result;

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Check if headers match (be lenient — just check first few)
  if (headers.length < 4) {
    result.errors.push({ row: 0, message: "Invalid CSV: header row does not match expected format" });
    return result;
  }

  const validStatuses = new Set<string>(["todo", "in-progress", "done", "blocked"]);
  const validPriorities = new Set<string>(["low", "medium", "high"]);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip empty lines

    const fields = parseCSVLine(line);

    if (fields.length < 6) {
      result.errors.push({ row: i + 1, message: `Row ${i + 1}: too few fields (expected 11, got ${fields.length})` });
      continue;
    }

    const [
      id, projectName, title, description, status, priority,
      assignee, tagsStr, dueDate, createdAt, updatedAt,
    ] = fields;

    // Validate required fields
    if (!title.trim()) {
      result.errors.push({ row: i + 1, message: `Row ${i + 1}: title is required` });
      continue;
    }

    // Validate status
    const normalizedStatus = status.trim().toLowerCase().replace(" ", "-");
    if (!validStatuses.has(normalizedStatus)) {
      result.errors.push({ row: i + 1, message: `Row ${i + 1}: invalid status "${status}" (expected todo, in-progress, done, or blocked)` });
      continue;
    }

    // Validate priority
    const normalizedPriority = priority.trim().toLowerCase();
    if (!validPriorities.has(normalizedPriority)) {
      result.errors.push({ row: i + 1, message: `Row ${i + 1}: invalid priority "${priority}" (expected low, medium, or high)` });
      continue;
    }

    // Project name is required
    const taskProjectName = projectName.trim();
    if (!taskProjectName) {
      result.errors.push({ row: i + 1, message: `Row ${i + 1}: project name is required` });
      continue;
    }

    // Check for duplicate by title within project
    const dedupKey = `${taskProjectName}::${title.trim()}`;
    if (existingTitles.has(dedupKey)) {
      result.errors.push({ row: i + 1, message: `Row ${i + 1}: duplicate task "${title.trim()}" in project "${taskProjectName}" — skipped` });
      continue;
    }
    existingTitles.add(dedupKey);

    // Parse tags (semicolon-separated)
    const tags: Tag[] = [];
    if (tagsStr.trim()) {
      const tagNames = tagsStr.split(";").map((t) => t.trim()).filter(Boolean);
      for (const tagName of tagNames) {
        tags.push({
          id: `import-tag-${tagName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
          name: tagName,
          color: stringToColor(tagName),
        });
      }
    }

    result.data.push({
      id: id.trim() || generateId(),
      projectName: taskProjectName,
      title: title.trim(),
      description: description.trim(),
      status: normalizedStatus as TaskStatus,
      priority: normalizedPriority as TaskPriority,
      assignee: assignee.trim(),
      tags,
      dueDate: dueDate.trim() || null,
      createdAt: createdAt.trim() || new Date().toISOString(),
      updatedAt: updatedAt.trim() || new Date().toISOString(),
    });
  }

  return result;
}

/**
 * Parse projects CSV text into an array of Project objects.
 *
 * Expected CSV columns (matching projectsToCSV output):
 *   id, name, description, status, tags, createdAt, updatedAt
 */
export function parseProjectsFromCSV(
  csvText: string,
  existingNames: Set<string>
): CSVParseResult<Project> {
  const result: CSVParseResult<Project> = { data: [], errors: [] };

  const lines = splitCSVLines(csvText);
  if (lines.length === 0) return result;

  // Parse header
  const headers = parseCSVLine(lines[0]);
  if (headers.length < 3) {
    result.errors.push({ row: 0, message: "Invalid CSV: header row does not match expected format" });
    return result;
  }

  const validProjectStatuses = new Set<string>(["active", "archived", "completed"]);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 4) {
      result.errors.push({ row: i + 1, message: `Row ${i + 1}: too few fields` });
      continue;
    }

    const [id, name, description, status, tagsStr, createdAt, updatedAt] = fields;

    if (!name.trim()) {
      result.errors.push({ row: i + 1, message: `Row ${i + 1}: project name is required` });
      continue;
    }

    // Check for duplicate by name
    if (existingNames.has(name.trim())) {
      result.errors.push({ row: i + 1, message: `Row ${i + 1}: duplicate project "${name.trim()}" — skipped` });
      continue;
    }
    existingNames.add(name.trim());

    const normalizedStatus = status.trim().toLowerCase().replace(" ", "-");
    if (!validProjectStatuses.has(normalizedStatus)) {
      result.errors.push({ row: i + 1, message: `Row ${i + 1}: invalid project status "${status}" (expected active, archived, or completed)` });
      continue;
    }

    // Parse tags (semicolon-separated)
    const tags: Tag[] = [];
    if (tagsStr.trim()) {
      const tagNames = tagsStr.split(";").map((t) => t.trim()).filter(Boolean);
      for (const tagName of tagNames) {
        tags.push({
          id: `import-tag-${tagName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
          name: tagName,
          color: stringToColor(tagName),
        });
      }
    }

    result.data.push({
      id: id.trim() || generateId(),
      name: name.trim(),
      description: description.trim(),
      status: normalizedStatus as ProjectStatus,
      tags,
      createdAt: createdAt.trim() || new Date().toISOString(),
      updatedAt: updatedAt.trim() || new Date().toISOString(),
    });
  }

  return result;
}

/**
 * Normalize line endings (CRLF -> LF) and strip BOM, split into lines.
 */
function splitCSVLines(text: string): string[] {
  // Strip BOM if present
  let cleaned = text;
  if (cleaned.charCodeAt(0) === 0xFEFF) {
    cleaned = cleaned.slice(1);
  }
  // Normalize CRLF -> LF
  cleaned = cleaned.replace(/\r\n/g, "\n");
  // Split by newline
  return cleaned.split("\n");
}

/**
 * Generate a simple unique ID for imported items.
 */
function generateId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Derive a deterministic colour from a string.
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
