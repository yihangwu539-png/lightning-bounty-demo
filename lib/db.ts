/**
 * Low-level IndexedDB wrapper using the `idb` library.
 * Provides an async API for projects and tasks storage.
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "project-tracker";
const DB_VERSION = 1;
const PROJECTS_STORE = "projects";
const TASKS_STORE = "tasks";
const META_STORE = "meta";

let dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

function getDB(): Promise<IDBPDatabase<unknown>> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(TASKS_STORE)) {
          db.createObjectStore(TASKS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

/** Check if IndexedDB is available (not in private browsing / SSR). */
export function isIndexedDBAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof indexedDB === "undefined") return false;
  // Quick test: some private browsing modes block indexedDB
  try {
    const r = indexedDB.open("__probe__");
    r.onerror = () => {};
    r.onsuccess = () => {
      const db = r.result;
      db.close();
      indexedDB.deleteDatabase("__probe__");
    };
    return true;
  } catch {
    return false;
  }
}

// --- Projects ---

export async function getAllProjects(): Promise<any[]> {
  const db = await getDB();
  return (await db.getAll(PROJECTS_STORE)) as any[];
}

export async function getProjectById(id: string): Promise<any | undefined> {
  const db = await getDB();
  return (await db.get(PROJECTS_STORE, id)) as any | undefined;
}

export async function putProject(project: any): Promise<void> {
  const db = await getDB();
  await db.put(PROJECTS_STORE, project);
}

export async function deleteProjectById(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(PROJECTS_STORE, id);
}

// --- Tasks ---

export async function getAllTasks(): Promise<any[]> {
  const db = await getDB();
  return (await db.getAll(TASKS_STORE)) as any[];
}

export async function getTaskById(id: string): Promise<any | undefined> {
  const db = await getDB();
  return (await db.get(TASKS_STORE, id)) as any | undefined;
}

export async function putTask(task: any): Promise<void> {
  const db = await getDB();
  await db.put(TASKS_STORE, task);
}

export async function deleteTaskById(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(TASKS_STORE, id);
}

// --- Meta (migration flags etc.) ---

export async function getMeta(key: string): Promise<any | undefined> {
  const db = await getDB();
  const entry = await db.get(META_STORE, key);
  return entry?.value;
}

export async function setMeta(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put(META_STORE, { key, value });
}

// --- Bulk operations ---

export async function clearAllStores(): Promise<void> {
  const db = await getDB();
  await db.clear(PROJECTS_STORE);
  await db.clear(TASKS_STORE);
  await db.clear(META_STORE);
}

export async function putAllProjects(projects: any[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(PROJECTS_STORE, "readwrite");
  for (const project of projects) {
    await tx.store.put(project);
  }
  await tx.done;
}

export async function putAllTasks(tasks: any[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(TASKS_STORE, "readwrite");
  for (const task of tasks) {
    await tx.store.put(task);
  }
  await tx.done;
}
