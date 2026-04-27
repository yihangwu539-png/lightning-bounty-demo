/**
 * Storage layer — wraps IndexedDB with a synchronous API for backwards compatibility.
 *
 * Architecture:
 * - On first browser load, checks localStorage for existing data and migrates it to IndexedDB.
 * - Maintains an in-memory cache so all public functions remain synchronous
 *   (callers don't need to await).
 * - Falls back to localStorage if IndexedDB is unavailable (private browsing, SSR).
 * - Seeds default data on first load (matching original behavior).
 */

import type { Project, Task } from "./types";
import { SEED_PROJECTS, SEED_TASKS } from "./seed";
import {
  getAllProjects,
  getProjectById,
  putProject,
  deleteProjectById,
  getAllTasks,
  getTaskById,
  putTask,
  deleteTaskById,
  clearAllStores,
  getMeta,
  setMeta,
  putAllProjects,
  putAllTasks,
  isIndexedDBAvailable,
} from "./db";

// localStorage keys (legacy, used for migration detection + fallback)
const PROJECTS_KEY = "pt_projects";
const TASKS_KEY = "pt_tasks";
const MIGRATION_FLAG_KEY = "pt_migrated_to_idb";

// In-memory cache
let projectsCache: Project[] = [];
let tasksCache: Task[] = [];
let initialized = false;
let initPromise: Promise<void> | null = null;
let useLocalStorage = false;

// ── Browser/SSR guards ────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

// ── localStorage helpers (fallback) ───────────────────────────────

function lsReadJSON<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function lsWriteJSON<T>(key: string, data: T): void {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ── Initialization + migration ────────────────────────────────────

async function init(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!isBrowser()) {
      initialized = true;
      return;
    }

    // Check if IndexedDB is available
    const idbAvail = isIndexedDBAvailable();

    if (!idbAvail) {
      // Fallback to localStorage
      useLocalStorage = true;
      initialized = true;
      return;
    }

    // Check if migration from localStorage is needed
    const alreadyMigrated =
      (await getMeta("migrated")) === true ||
      localStorage.getItem(MIGRATION_FLAG_KEY) === "true";

    if (!alreadyMigrated) {
      // Check for existing localStorage data
      const lsProjects = lsReadJSON<Project[]>(PROJECTS_KEY);
      const lsTasks = lsReadJSON<Task[]>(TASKS_KEY);

      if (lsProjects || lsTasks) {
        // Migrate existing data to IndexedDB
        if (lsProjects) {
          await putAllProjects(lsProjects);
        }
        if (lsTasks) {
          await putAllTasks(lsTasks);
        }
        // Mark migration complete in both places
        await setMeta("migrated", true);
        try {
          localStorage.setItem(MIGRATION_FLAG_KEY, "true");
        } catch {
          // Ignore localStorage write failures
        }
        // Clear localStorage keys after migration
        try {
          localStorage.removeItem(PROJECTS_KEY);
          localStorage.removeItem(TASKS_KEY);
        } catch {
          // ignore
        }
      } else {
        // No existing data — seed if needed later (check in loadCache)
        await setMeta("migrated", true);
        try {
          localStorage.setItem(MIGRATION_FLAG_KEY, "true");
        } catch {
          // ignore
        }
      }
    }

    // Load cache from IndexedDB
    await loadCache();
    initialized = true;
  })();

  return initPromise;
}

async function loadCache(): Promise<void> {
  if (useLocalStorage) return;
  try {
    const projects = await getAllProjects();
    const tasks = await getAllTasks();

    // If empty, seed with default data
    if (projects.length === 0) {
      await putAllProjects(SEED_PROJECTS);
      projectsCache = [...SEED_PROJECTS];
    } else {
      projectsCache = projects as Project[];
    }

    if (tasks.length === 0) {
      await putAllTasks(SEED_TASKS);
      tasksCache = [...SEED_TASKS];
    } else {
      tasksCache = tasks as Task[];
    }
  } catch {
    // If IndexedDB read fails, fall back to localStorage
    useLocalStorage = true;
  }
}

// Ensure the cache is loaded (synchronous — init happens on first call)
function ensureReady(): void {
  if (initialized) return;
  if (!isBrowser()) return;

  if (useLocalStorage) {
    ensureSeededLS();
    return;
  }

  // Kick off async init but don't block — the cache will be ready next call
  if (!initPromise) {
    init();
  }
}

// Legacy local-storage seeding (used when falling back or before IDB is ready)
function ensureSeededLS(): void {
  if (!isBrowser()) return;
  if (localStorage.getItem(PROJECTS_KEY) === null) {
    lsWriteJSON(PROJECTS_KEY, SEED_PROJECTS);
    lsWriteJSON(TASKS_KEY, SEED_TASKS);
  }
}

// ── Public API (synchronous, matching original signatures) ────────

// Projects

export function getProjects(): Project[] {
  ensureReady();

  if (useLocalStorage) {
    ensureSeededLS();
    return lsReadJSON<Project[]>(PROJECTS_KEY) ?? [];
  }

  if (!initialized) {
    // During initial async load, read from localStorage as fallback
    ensureSeededLS();
    return lsReadJSON<Project[]>(PROJECTS_KEY) ?? [];
  }

  return projectsCache;
}

export function getProject(id: string): Project | null {
  return getProjects().find((p) => p.id === id) ?? null;
}

export function saveProject(project: Project): void {
  ensureReady();

  if (useLocalStorage) {
    const projects = lsReadJSON<Project[]>(PROJECTS_KEY) ?? [];
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = project;
    } else {
      projects.push(project);
    }
    lsWriteJSON(PROJECTS_KEY, projects);
    return;
  }

  // Update cache
  const idx = projectsCache.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projectsCache[idx] = project;
  } else {
    projectsCache.push(project);
  }

  // Write to IndexedDB (fire-and-forget)
  putProject(project).catch(() => {
    // If IndexedDB write fails, sync to localStorage as fallback
    lsWriteJSON(PROJECTS_KEY, projectsCache);
  });
}

export function deleteProject(id: string): void {
  ensureReady();

  if (useLocalStorage) {
    const projects = (lsReadJSON<Project[]>(PROJECTS_KEY) ?? []).filter(
      (p) => p.id !== id
    );
    lsWriteJSON(PROJECTS_KEY, projects);
    const tasks = (lsReadJSON<Task[]>(TASKS_KEY) ?? []).filter(
      (t) => t.projectId !== id
    );
    lsWriteJSON(TASKS_KEY, tasks);
    return;
  }

  // Update cache
  projectsCache = projectsCache.filter((p) => p.id !== id);
  tasksCache = tasksCache.filter((t) => t.projectId !== id);

  // Write to IndexedDB
  deleteProjectById(id).catch(() => {
    lsWriteJSON(PROJECTS_KEY, projectsCache);
    lsWriteJSON(TASKS_KEY, tasksCache);
  });
}

// Tasks

export function getTasks(projectId?: string): Task[] {
  ensureReady();

  if (useLocalStorage) {
    ensureSeededLS();
    const all = lsReadJSON<Task[]>(TASKS_KEY) ?? [];
    return projectId ? all.filter((t) => t.projectId === projectId) : all;
  }

  if (!initialized) {
    ensureSeededLS();
    const all = lsReadJSON<Task[]>(TASKS_KEY) ?? [];
    return projectId ? all.filter((t) => t.projectId === projectId) : all;
  }

  return projectId
    ? tasksCache.filter((t) => t.projectId === projectId)
    : tasksCache;
}

export function getTask(id: string): Task | null {
  return getTasks().find((t) => t.id === id) ?? null;
}

export function saveTask(task: Task): void {
  ensureReady();

  if (useLocalStorage) {
    const tasks = lsReadJSON<Task[]>(TASKS_KEY) ?? [];
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      tasks[idx] = task;
    } else {
      tasks.push(task);
    }
    lsWriteJSON(TASKS_KEY, tasks);
    return;
  }

  // Update cache
  const idx = tasksCache.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    tasksCache[idx] = task;
  } else {
    tasksCache.push(task);
  }

  // Write to IndexedDB
  putTask(task).catch(() => {
    lsWriteJSON(TASKS_KEY, tasksCache);
  });
}

export function deleteTask(id: string): void {
  ensureReady();

  if (useLocalStorage) {
    const tasks = (lsReadJSON<Task[]>(TASKS_KEY) ?? []).filter(
      (t) => t.id !== id
    );
    lsWriteJSON(TASKS_KEY, tasks);
    return;
  }

  // Update cache
  tasksCache = tasksCache.filter((t) => t.id !== id);

  // Write to IndexedDB
  deleteTaskById(id).catch(() => {
    lsWriteJSON(TASKS_KEY, tasksCache);
  });
}

export function clearAll(): void {
  if (!isBrowser()) return;

  if (useLocalStorage) {
    localStorage.removeItem(PROJECTS_KEY);
    localStorage.removeItem(TASKS_KEY);
    return;
  }

  // Clear caches
  projectsCache = [];
  tasksCache = [];

  // Clear IndexedDB + re-seed
  clearAllStores()
    .then(async () => {
      await putAllProjects(SEED_PROJECTS);
      await putAllTasks(SEED_TASKS);
      projectsCache = [...SEED_PROJECTS];
      tasksCache = [...SEED_TASKS];
    })
    .catch(() => {
      localStorage.removeItem(PROJECTS_KEY);
      localStorage.removeItem(TASKS_KEY);
    });
}

export function exportRaw(): { projects: Project[]; tasks: Task[] } {
  return { projects: getProjects(), tasks: getTasks() };
}

/**
 * Wait for the async IndexedDB initialization to complete.
 * Useful for tests or scenarios that need to ensure data is loaded before proceeding.
 */
export async function waitForInit(): Promise<void> {
  if (initialized) return;
  if (!isBrowser()) return;
  await init();
}
