import { openDB, IDBPDatabase } from 'idb';
import {
  DocumentItem,
  AppSettings,
  ReadingSession,
  VaultSecurityConfig,
} from '../types/document';
import { generateSamplePdfBytes, uint8ArrayToDataUri } from '../utils/fileHelpers';

const DB_NAME = 'MasterDocsVault';
const DB_VERSION = 2;

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
  vault_security: {
    key: string;
    value: VaultSecurityConfig;
  };
}

let dbPromise: Promise<IDBPDatabase<MasterDocsDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<MasterDocsDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<MasterDocsDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('by-name', 'name');
          docStore.createIndex('by-type', 'type');
          docStore.createIndex('by-favorite', 'isFavorite');
        }

        if (!db.objectStoreNames.contains('recents')) {
          const recentsStore = db.createObjectStore('recents', { keyPath: 'documentId' });
          recentsStore.createIndex('by-opened', 'lastOpenedAt');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        if (!db.objectStoreNames.contains('vault_security')) {
          db.createObjectStore('vault_security');
        }
      },
    });
  }
  return dbPromise;
}

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'light',
  accentColor: '#a92f2e',
  customAccentColor: '#a92f2e',
  defaultZoom: 100,
  pageSpacing: 'normal',
  continuousScroll: true,
  keepScreenAwake: true,
};

export async function getAllDocuments(): Promise<DocumentItem[]> {
  const db = await getDB();
  const docs = await db.getAll('documents');
  return docs.sort(
    (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );
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

export async function setDocumentPrivate(
  id: string,
  isPrivate: boolean
): Promise<DocumentItem | null> {
  const db = await getDB();
  const doc = await db.get('documents', id);
  if (!doc) return null;
  doc.isPrivate = isPrivate;
  if (isPrivate) {
    // Remove from public recent reading history when moved to private vault
    await db.delete('recents', id);
  }
  await db.put('documents', doc);
  return doc;
}

export async function updateReadingProgress(
  id: string,
  page: number,
  totalPages: number
): Promise<void> {
  const db = await getDB();
  const doc = await db.get('documents', id);
  if (doc) {
    const safeTotal = Math.max(1, totalPages || doc.pageCount || 1);
    const safePage = Math.min(Math.max(1, page), safeTotal);
    doc.lastReadPage = safePage;
    doc.pageCount = safeTotal;
    doc.readProgress = Math.min(100, Math.round((safePage / safeTotal) * 100));
    doc.modifiedAt = new Date().toISOString();
    await db.put('documents', doc);

    // Keep private vault documents hidden from recent sessions list
    if (!doc.isPrivate) {
      const session: ReadingSession = {
        documentId: id,
        documentName: doc.name,
        extension: doc.extension,
        currentPage: safePage,
        totalPages: safeTotal,
        progressPercent: doc.readProgress,
        lastOpenedAt: doc.modifiedAt,
      };
      await db.put('recents', session);
    }
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
  return settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', settings, 'config');
}

export async function getVaultSecurityConfig(): Promise<VaultSecurityConfig | null> {
  const db = await getDB();
  const cfg = await db.get('vault_security', 'lock_config');
  return cfg || null;
}

export async function saveVaultSecurityConfig(config: VaultSecurityConfig): Promise<void> {
  const db = await getDB();
  await db.put('vault_security', config, 'lock_config');
}

export async function seedDemoDocuments(): Promise<DocumentItem[]> {
  const samplePdfBytes = generateSamplePdfBytes();
  const samplePdfBuffer = samplePdfBytes.buffer.slice(0) as ArrayBuffer;
  const sampleCsvText = `Quarter,Revenue,Expenses,Net Profit,Growth
Q1 2026,$1250000,$780000,$470000,12.4%
Q2 2026,$1480000,$820000,$660000,18.4%
Q3 2026,$1890000,$910000,$980000,27.7%`;

  const demoDocs: DocumentItem[] = [
    {
      id: 'demo-doc-001',
      name: 'Android_System_Architecture_v14.pdf',
      extension: 'pdf',
      type: 'pdf',
      mimeType: 'application/pdf',
      size: samplePdfBytes.byteLength,
      modifiedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      isFavorite: true,
      isPrivate: false,
      pageCount: 1,
      lastReadPage: 1,
      readProgress: 100,
      arrayBuffer: samplePdfBuffer,
      dataUri: uint8ArrayToDataUri(samplePdfBytes, 'application/pdf'),
      content:
        'MASTER DOCS - Android System Architecture v14 Kernel 5.15 LTS Project Treble Specification Hardware Abstraction Layer & IPC Binder Architecture',
    },
    {
      id: 'demo-doc-002',
      name: 'Quarterly_Financial_Report_Q3.csv',
      extension: 'csv',
      type: 'excel',
      mimeType: 'text/csv',
      size: sampleCsvText.length,
      modifiedAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      isFavorite: true,
      isPrivate: false,
      pageCount: 1,
      lastReadPage: 1,
      readProgress: 100,
      content: sampleCsvText,
    },
  ];

  const db = await getDB();
  const tx = db.transaction('documents', 'readwrite');
  for (const doc of demoDocs) {
    await tx.store.put(doc);
  }
  await tx.done;
  return await getAllDocuments();
}
