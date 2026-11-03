import { openDB, IDBPDatabase } from 'idb';
import { DocumentItem, AppSettings, ReadingSession } from '../types/document';
import { generateSamplePdfDataUri } from '../utils/fileHelpers';

const DB_NAME = 'MasterDocsVault';
const DB_VERSION = 1;

export interface MasterDocsDBSchema {
  documents: {
    key: string;
    value: DocumentItem;
    indexes: { 'by-name': string; 'by-type': string; 'by-favorite': number };
  };
  recents: {
    key: string;
    value: ReadingSession;
    indexes: { 'by-opened': string };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

let dbPromise: Promise<IDBPDatabase<MasterDocsDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<MasterDocsDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<MasterDocsDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Documents store
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('by-name', 'name');
          docStore.createIndex('by-type', 'type');
          docStore.createIndex('by-favorite', 'isFavorite');
        }

        // Recents store
        if (!db.objectStoreNames.contains('recents')) {
          const recentsStore = db.createObjectStore('recents', { keyPath: 'documentId' });
          recentsStore.createIndex('by-opened', 'lastOpenedAt');
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

// Optional testing fixtures (used ONLY when explicitly triggered in Settings)
export const DEMO_DOCUMENTS: DocumentItem[] = [
  {
    id: 'demo-doc-001',
    name: 'Android_System_Architecture_v14.pdf',
    extension: 'pdf',
    type: 'pdf',
    size: 19084000,
    modifiedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    isFavorite: true,
    pageCount: 220,
    lastReadPage: 42,
    readProgress: 64,
    dataUri: generateSamplePdfDataUri(),
    content: `# Hardware Abstraction Layer & IPC
Kernel 5.15 LTS • Project Treble HIDL/AIDL Specification

ARCHIVAL SHEET #042

The Android binder architecture serves as the cornerstone inter-process communication (IPC) mechanism across user-space sandboxes. By arbitrating process boundary transitions within the dedicated /dev/binder Linux character driver, the kernel implements zero-copy transaction deserialization, guaranteeing synchronous RPC isolation and strict memory safety primitives.`,
  },
  {
    id: 'demo-doc-002',
    name: 'Quarterly_Financial_Report_Q3.xlsx',
    extension: 'xlsx',
    type: 'excel',
    size: 3565158,
    modifiedAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    isFavorite: true,
    pageCount: 1,
    readProgress: 100,
    content: `Quarter,Revenue,Expenses,Net Profit,Growth
Q1 2026,$1,250,000,$780,000,$470,000,12.4%
Q2 2026,$1,480,000,$820,000,$660,000,18.4%
Q3 2026,$1,890,000,$910,000,$980,000,27.7%`,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'light',
  accentColor: '#a92f2e',
  customAccentColor: '#a92f2e',
  defaultZoom: 100,
  pageSpacing: 'normal',
  continuousScroll: true,
  keepScreenAwake: true,
  autoSaveProgress: true,
  encryptVault: true,
};

// Database CRUD operations
export async function getAllDocuments(): Promise<DocumentItem[]> {
  const db = await getDB();
  const docs = await db.getAll('documents');
  return docs;
}

export async function saveDocument(doc: DocumentItem): Promise<void> {
  const db = await getDB();
  await db.put('documents', doc);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('documents', id);
  await db.delete('recents', id);
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const db = await getDB();
  const doc = await db.get('documents', id);
  if (doc) {
    doc.isFavorite = !doc.isFavorite;
    await db.put('documents', doc);
    return doc.isFavorite;
  }
  return false;
}

export async function updateReadingProgress(id: string, page: number, totalPages: number): Promise<void> {
  const db = await getDB();
  const doc = await db.get('documents', id);
  if (doc) {
    doc.lastReadPage = page;
    doc.pageCount = totalPages || doc.pageCount || 1;
    doc.readProgress = Math.min(100, Math.round((page / doc.pageCount) * 100));
    doc.modifiedAt = new Date().toISOString();
    await db.put('documents', doc);

    const session: ReadingSession = {
      documentId: id,
      documentName: doc.name,
      extension: doc.extension,
      currentPage: page,
      totalPages: doc.pageCount,
      progressPercent: doc.readProgress,
      lastOpenedAt: new Date().toISOString(),
      timeSpentSeconds: 120,
    };
    await db.put('recents', session);
  }
}

export async function getRecentSessions(): Promise<ReadingSession[]> {
  const db = await getDB();
  const sessions = await db.getAllFromIndex('recents', 'by-opened');
  return sessions.reverse();
}

export async function clearRecentSessions(): Promise<void> {
  const db = await getDB();
  await db.clear('recents');
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = await getDB();
  const settings = await db.get('settings', 'config');
  return settings || DEFAULT_SETTINGS;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings, 'config');
}

export async function seedDemoDocuments(): Promise<DocumentItem[]> {
  const db = await getDB();
  const tx = db.transaction('documents', 'readwrite');
  for (const doc of DEMO_DOCUMENTS) {
    await tx.store.put(doc);
  }
  await tx.done;
  return await getAllDocuments();
}
