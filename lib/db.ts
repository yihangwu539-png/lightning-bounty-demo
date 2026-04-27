import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface LightningDb extends DBSchema {
  projects: {
    key: string;
    value: {
      id: string;
      name: string;
      color: string;
    };
  };
  tasks: {
    key: string;
    value: {
      id: string;
      projectId: string;
      title: string;
      completed: boolean;
      priority: 'low' | 'medium' | 'high';
      status: 'active' | 'completed';
      tags: string[];
      order: number;
    };
  };
  meta: {
    key: string;
    value: string;
  };
}

let dbPromise: Promise<IDBPDatabase<LightningDb>> | null = null;
let dbAvailable: boolean | null = null;

function isIndexedDBAvailable(): boolean {
  if (dbAvailable !== null) return dbAvailable;
  try {
    if (typeof indexedDB === 'undefined') {
      dbAvailable = false;
      return false;
    }
    // Test that indexedDB actually works (fails in private browsing on some browsers)
    const req = indexedDB.open('__test_db__', 1);
    req.transaction;
    dbAvailable = true;
    return true;
  } catch {
    dbAvailable = false;
    return false;
  }
}

function getDb(): Promise<IDBPDatabase<LightningDb>> {
  if (!dbPromise) {
    dbPromise = openDB<LightningDb>('lightning-demo', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export { isIndexedDBAvailable, getDb };
export type { LightningDb };
