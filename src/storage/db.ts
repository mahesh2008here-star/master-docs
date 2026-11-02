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

// Initial pre-stocked offline vault items matching screenshot reference
export const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-001',
    name: 'Android_System_Architecture_v14.pdf',
    extension: 'pdf',
    type: 'pdf',
    size: 19084000, // 18.2 MB
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

The Android binder architecture serves as the cornerstone inter-process communication (IPC) mechanism across user-space sandboxes. By arbitrating process boundary transitions within the dedicated /dev/binder Linux character driver, the kernel implements zero-copy transaction deserialization, guaranteeing synchronous RPC isolation and strict memory safety primitives.

FIG 4.2: SHARED MEMORY IPC BUFFER TOPOLOGY
App Process (BpBinder Client) -> /dev/binder mmap() Pool -> System Server (BBinder Stub)

CRITICAL EXECUTION CONSTRAINT
All synchronous IPC transactions are strictly capped at 1MB shared buffer ceiling per active process pool. Exceeding this boundary triggers immediate TransactionTooLargeException faults.

With AIDL (Android Interface Definition Language) transitioning to backend-agnostic NDK toolchains in recent releases, runtime performance yields deterministic latency under 120 microseconds on modern multi-cluster big.LITTLE architectures.`,
  },
  {
    id: 'doc-002',
    name: 'Quarterly_Financial_Report_Q3.xlsx',
    extension: 'xlsx',
    type: 'excel',
    size: 3565158, // 3.4 MB
    modifiedAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    isFavorite: true,
    pageCount: 1,
    readProgress: 100,
    content: `Quarter,Revenue,Expenses,Net Profit,Growth
Q1 2026,$1,250,000,$780,000,$470,000,12.4%
Q2 2026,$1,480,000,$820,000,$660,000,18.4%
Q3 2026,$1,890,000,$910,000,$980,000,27.7%
Q4 Forecast,$2,100,000,$950,000,$1,150,000,31.2%`,
  },
  {
    id: 'doc-003',
    name: 'Design_Systems_Handbook_2026.pdf',
    extension: 'pdf',
    type: 'pdf',
    size: 19084288, // 18.2 MB
    modifiedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    isFavorite: false,
    pageCount: 148,
    lastReadPage: 12,
    readProgress: 8,
    dataUri: generateSamplePdfDataUri(),
    content: `Design Systems Handbook 2026

Chapter 1: Foundational Design Tokens
Design tokens are the atomic visual primitives of a design system. They store visual design attributes like colors, typography, spacing, elevation, and animation curves in a platform-agnostic format (JSON, YAML).

Chapter 2: Tactile Physical Interfaces
In an era dominated by flat, featureless glass slabs, tactile interfaces reintroduce depth, physical feedback, and clear affordances. Heavy outlines, tactile shadows, warm cream canvases, and responsive spring animations communicate clarity.`,
  },
  {
    id: 'doc-004',
    name: 'Product_Requirements_MasterDocs.docx',
    extension: 'docx',
    type: 'word',
    size: 860160, // 840 KB
    modifiedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    isFavorite: false,
    pageCount: 12,
    readProgress: 45,
    content: `Product Requirements Document: MASTER DOCS Android Reader

1. Executive Summary
MASTER DOCS is an all-in-one document reader for Android devices. Designed with a retro tactile aesthetic and a liquid glass navigation dock, it provides zero-cloud offline reading for PDFs, Word files, Excel spreadsheets, presentations, and plain text files.

2. Core Functional Requirements
- PDF Reading: Continuous scroll, page jumping, bookmarking, zoom, night mode, page thumbnails.
- DOCX Reading: Header formatting, styled paragraphs, tables, lists, text formatting.
- XLSX / CSV Reading: Sheet navigation, grid layout, column resizing, formula support.
- Offline Vault: IndexedDB encryption & storage with native Storage Access Framework support.`,
  },
  {
    id: 'doc-005',
    name: 'Release_Notes_Firmware_v4.md',
    extension: 'md',
    type: 'markdown',
    size: 43008, // 42 KB
    modifiedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    isFavorite: false,
    pageCount: 4,
    readProgress: 100,
    content: `# MASTER DOCS Firmware Release Notes v4.2.0

## Highlights
- **Zero Cloud Architecture**: All document processing occurs 100% on-device.
- **Liquid Glass Navigation Dock**: Translucent glass background with dynamic reflections and blur.
- **Enhanced PDF Renderer**: Smooth pinch-to-zoom and page thumbnails.

## Bug Fixes
- Fixed memory overflow when rendering large multi-sheet Excel files.
- Improved dark ink high-contrast reading mode for night reading.
- Resolved Android safe area inset padding on gesture navigation bars.`,
  },
  {
    id: 'doc-006',
    name: 'Contract_Agreement_Signed.pdf',
    extension: 'pdf',
    type: 'pdf',
    size: 2202000, // 2.1 MB
    modifiedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    isFavorite: true,
    isLocked: true,
    pageCount: 8,
    readProgress: 100,
    dataUri: generateSamplePdfDataUri(),
    content: `CONFIDENTIAL - EXECUTED AGREEMENT
This Document Access and Licensing Agreement is entered into between MASTER DOCS Systems Inc. and Authorized Device Owners.

Terms:
1. Local Storage Guarantee: The Software shall operate exclusively offline without mandatory cloud sync.
2. Encryption: Stored files are protected using on-device standard storage access controls.`,
  },
  {
    id: 'doc-007',
    name: 'Keynote_Pitch_Deck_Final.pptx',
    extension: 'pptx',
    type: 'powerpoint',
    size: 25794970, // 24.6 MB
    modifiedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    isFavorite: false,
    pageCount: 18,
    readProgress: 30,
    content: `Slide 1: MASTER DOCS - The Offline Document Reader
Slide 2: Problem - Modern document apps require cloud subscriptions and track user data.
Slide 3: Solution - 100% On-Device, Retro Tactile Interface, Liquid Glass Dock.
Slide 4: Market Opportunity - Enterprise offline workers, privacy-focused professionals, technical engineers.
Slide 5: Architecture - Vite + React + Capacitor + Android Native SAF.`,
  },
  {
    id: 'doc-008',
    name: 'Setup_Environment_Instructions.txt',
    extension: 'txt',
    type: 'text',
    size: 18432, // 18 KB
    modifiedAt: new Date(Date.now() - 86400000 * 13).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 25).toISOString(),
    isFavorite: false,
    pageCount: 2,
    readProgress: 100,
    content: `MASTER DOCS ENVIRONMENT SETUP INSTRUCTIONS

1. Prerequisites
- Node.js LTS (v18 or v20+)
- JDK 17
- Android Studio / SDK Build Tools 34.0.0

2. Build Commands
npm ci
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug

3. Verification
Run the generated APK on an Android emulator or physical device. Verify offline document reading, search, favourites persistence, and settings.`,
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
  if (docs.length === 0) {
    // Seed initial library
    const tx = db.transaction('documents', 'readwrite');
    for (const doc of INITIAL_DOCUMENTS) {
      await tx.store.put(doc);
    }
    await tx.done;
    return INITIAL_DOCUMENTS;
  }
  return docs;
}

export async function saveDocument(doc: DocumentItem): Promise<void> {
  const db = await getDB();
  await db.put('documents', doc);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('documents', id);
  // Also remove from recents if present
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

    // Save session to recents
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
