import type { Project, Task } from './types';
import { SEED_PROJECTS, SEED_TASKS } from './seed';
import { getDb, isIndexedDBAvailable } from './db';

const PROJECTS_KEY = 'pt_projects';
const TASKS_KEY = 'pt_tasks';
const MIGRATED_KEY = 'pt_migrated';

// In-memory cache for synchronous API
let cache: { projects: Project[]; tasks: Task[] } | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readJSON<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON<T>(key: string, data: T): void {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(data));
}

function loadCache(): void {
  if (cache) return;
  const projects = readJSON<Project[]>(PROJECTS_KEY) ?? [];
  const tasks = readJSON<Task[]>(TASKS_KEY) ?? [];
  cache = { projects, tasks };
}

function saveCache(): void {
  if (!cache) return;
  writeJSON(PROJECTS_KEY, cache.projects);
  writeJSON(TASKS_KEY, cache.tasks);

  // Async write to IndexedDB (fire-and-forget)
  if (isIndexedDBAvailable()) {
    getDb().then(async (db) => {
      const tx = db.transaction(['projects', 'tasks', 'meta'], 'readwrite');
      // Clear and rewrite
      await tx.objectStore('projects').clear();
      for (const p of cache!.projects) {
        await tx.objectStore('projects').put(p);
      }
      await tx.objectStore('tasks').clear();
      for (const t of cache!.tasks) {
        await tx.objectStore('tasks').put(t);
      }
      await tx.done;
    }).catch(() => {
      // IndexedDB write failed — cache is still in localStorage
    });
  }
}

// Migrate localStorage → IndexedDB on first load
async function migrateToIndexedDB(): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  if (readJSON<boolean>(MIGRATED_KEY)) return;

  const projects = readJSON<Project[]>(PROJECTS_KEY);
  const tasks = readJSON<Task[]>(TASKS_KEY);
  if (!projects || !tasks) return;

  try {
    const db = await getDb();
    const tx = db.transaction(['projects', 'tasks', 'meta'], 'readwrite');
    await tx.objectStore('projects').clear();
    for (const p of projects) {
      await tx.objectStore('projects').put(p);
    }
    await tx.objectStore('tasks').clear();
    for (const t of tasks) {
      await tx.objectStore('tasks').put(t);
    }
    await tx.done;
    writeJSON(MIGRATED_KEY, true);
  } catch {
    // Migration failed — localStorage fallback works
  }
}

// Seed on first load
function ensureSeeded(): void {
  if (!isBrowser()) return;
  if (localStorage.getItem(PROJECTS_KEY) === null) {
    writeJSON(PROJECTS_KEY, SEED_PROJECTS);
    writeJSON(TASKS_KEY, SEED_TASKS);
    cache = { projects: SEED_PROJECTS, tasks: SEED_TASKS };
  }
}

// Async initialization (call on app load for migration & initial IndexedDB sync)
export async function waitForInit(): Promise<void> {
  ensureSeeded();
  loadCache();
  await migrateToIndexedDB();
}

// Projects
export function getProjects(): Project[] {
  ensureSeeded();
  loadCache();
  return cache?.projects ?? [];
}

export function getProject(id: string): Project | null {
  return getProjects().find((p) => p.id === id) ?? null;
}

export function saveProject(project: Project): void {
  loadCache();
  if (!cache) {
    cache = { projects: [], tasks: [] };
  }
  const idx = cache.projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    cache.projects[idx] = project;
  } else {
    cache.projects.push(project);
  }
  saveCache();
}

export function deleteProject(id: string): void {
  loadCache();
  if (!cache) return;
  cache.projects = cache.projects.filter((p) => p.id !== id);
  cache.tasks = cache.tasks.filter((t) => t.projectId !== id);
  saveCache();
}

// Tasks
export function getTasks(projectId?: string): Task[] {
  ensureSeeded();
  loadCache();
  const all = cache?.tasks ?? [];
  return projectId ? all.filter((t) => t.projectId === projectId) : all;
}

export function getTask(id: string): Task | null {
  return getTasks().find((t) => t.id === id) ?? null;
}

export function saveTask(task: Task): void {
  loadCache();
  if (!cache) {
    cache = { projects: [], tasks: [] };
  }
  const idx = cache.tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    cache.tasks[idx] = task;
  } else {
    cache.tasks.push(task);
  }
  saveCache();
}

export function deleteTask(id: string): void {
  loadCache();
  if (!cache) return;
  cache.tasks = cache.tasks.filter((t) => t.id !== id);
  saveCache();
}

export function clearAll(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(PROJECTS_KEY);
  localStorage.removeItem(TASKS_KEY);
  localStorage.removeItem(MIGRATED_KEY);
  cache = { projects: [], tasks: [] };
}

export function exportRaw(): { projects: Project[]; tasks: Task[] } {
  loadCache();
  return { projects: cache?.projects ?? [], tasks: cache?.tasks ?? [] };
}
