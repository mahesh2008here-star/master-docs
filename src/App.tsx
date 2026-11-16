import React, { useState, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import {
  DocumentItem,
  NavigationTab,
  ReadingSession,
  AppSettings,
  DocumentType,
} from './types/document';
import {
  getAllDocuments,
  saveDocument,
  deleteDocument,
  toggleFavorite,
  updateReadingProgress,
  getRecentSessions,
  clearRecentSessions,
  getAppSettings,
  saveAppSettings,
  seedDemoDocuments,
  DEFAULT_SETTINGS,
  getDB,
} from './storage/db';
import {
  dataUriToUint8Array,
  decodeTextBytes,
  detectDocumentFormat,
  uint8ArrayToDataUri,
} from './utils/fileHelpers';
import { parseWordDocument } from './services/docxService';
import { parseSpreadsheetBuffer } from './services/spreadsheetService';
import { parsePptxArrayBuffer } from './services/presentationService';
import { destroyPdfDocument, openPdfDocument } from './services/pdfService';
import { requestAndroidStoragePermissions } from './services/permissionService';
import { TopHeader } from './components/navigation/TopHeader';
import { LiquidGlassDock } from './components/navigation/LiquidGlassDock';
import { HomeScreen } from './screens/HomeScreen';
import { FilesScreen } from './screens/FilesScreen';
import { FavouritesScreen } from './screens/FavouritesScreen';
import { RecentScreen } from './screens/RecentScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ReaderScreen } from './screens/ReaderScreen';
import { SearchScreen } from './screens/SearchScreen';
import { ConfirmModal } from './components/common/ConfirmModal';
import { ToastBanner, ToastMessage } from './components/common/Toast';

export default function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<ReadingSession[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentType | 'all'>('all');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const notify = (type: 'success' | 'error' | 'info', message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), type, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

  useEffect(() => {
    async function initVault() {
      try {
        // Request native Android storage permissions cleanly on launch (no-op on web)
        requestAndroidStoragePermissions().catch(() => {});

        const [loadedDocs, loadedSessions, loadedSettings] = await Promise.all([
          getAllDocuments(),
          getRecentSessions(),
          getAppSettings(),
        ]);

        setDocuments(loadedDocs);
        setRecentSessions(loadedSessions);
        setSettings(loadedSettings);
        applyTheme(loadedSettings.themeMode);
        applyAccentColor(
          loadedSettings.customAccentColor || loadedSettings.accentColor || '#a92f2e'
        );
      } catch (err) {
        console.error('Failed to initialize Master Docs storage:', err);
        notify('error', 'Failed to initialize local document vault.');
      }
    }
    initVault();
  }, []);

  const applyTheme = (mode: 'system' | 'light' | 'dark') => {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (mode === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  };

  const applyAccentColor = (color: string) => {
    if (color) {
      document.documentElement.style.setProperty('--primary-red', color);
    }
  };

  const handleUpdateSettings = async (newSettingsPartial: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettingsPartial };
    setSettings(updated);
    if (newSettingsPartial.themeMode) {
      applyTheme(newSettingsPartial.themeMode);
    }
    if (newSettingsPartial.customAccentColor || newSettingsPartial.accentColor) {
      applyAccentColor(
        newSettingsPartial.customAccentColor || newSettingsPartial.accentColor || '#a92f2e'
      );
    }
    await saveAppSettings(updated);
  };

  // Capacitor Android Back Button handling
  useEffect(() => {
    const listener = CapApp.addListener('backButton', () => {
      if (activeTab === 'reader') {
        setActiveTab('files');
        setSelectedDoc(null);
      } else if (activeTab === 'search') {
        setActiveTab('home');
      } else if (activeTab !== 'home') {
        setActiveTab('home');
      } else {
        CapApp.minimizeApp();
      }
    });

    return () => {
      listener.then((h) => h.remove());
    };
  }, [activeTab]);

  const handleOpenDocument = (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setActiveTab('reader');
    updateReadingProgress(doc.id, doc.lastReadPage || 1, doc.pageCount || 1).then(() => {
      getRecentSessions().then(setRecentSessions);
    });
  };

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isFavorite: !d.isFavorite } : d))
    );
    await toggleFavorite(id);
  };

  // Unified sequential document importer with magic-byte sniffing & metadata extraction
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const importedDocs: DocumentItem[] = [];
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const rawBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(rawBuffer);
        const { type: docType, extension } = await detectDocumentFormat(bytes, file.name);

        let pageCount = 1;
        let searchableContent: string | undefined;

        if (docType === 'pdf') {
          try {
            const pdfDoc = await openPdfDocument(bytes);
            pageCount = pdfDoc.numPages || 1;
            await destroyPdfDocument(pdfDoc);
          } catch {
            // Password-protected or complex PDF will prompt cleanly inside PdfViewer
            pageCount = 1;
          }
        } else if (docType === 'word') {
          try {
            const parsed = await parseWordDocument(bytes, extension);
            searchableContent = parsed.plainText;
          } catch {
            searchableContent = '';
          }
        } else if (docType === 'excel') {
          try {
            const parsed = parseSpreadsheetBuffer(bytes);
            pageCount = Math.max(1, parsed.sheets.length);
          } catch {
            pageCount = 1;
          }
        } else if (docType === 'powerpoint') {
          try {
            const parsedSlides = await parsePptxArrayBuffer(bytes);
            pageCount = Math.max(1, parsedSlides.length);
            searchableContent = parsedSlides
              .map((s) => `${s.title} ${s.bulletPoints.join(' ')}`)
              .join('\n');
          } catch {
            pageCount = 1;
          }
        } else if (docType === 'text' || docType === 'markdown') {
          searchableContent = decodeTextBytes(bytes);
          pageCount = 1;
        }

        const nowIso = new Date().toISOString();
        const newDoc: DocumentItem = {
          id: `doc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          extension,
          type: docType,
          mimeType: file.type || undefined,
          size: file.size,
          modifiedAt: nowIso,
          createdAt: nowIso,
          isFavorite: false,
          pageCount,
          lastReadPage: 1,
          readProgress: Math.round((1 / Math.max(1, pageCount)) * 100),
          arrayBuffer: rawBuffer,
          content: searchableContent,
        };

        await saveDocument(newDoc);
        importedDocs.push(newDoc);
      } catch (err) {
        console.error(`Failed importing file ${file.name}:`, err);
        failCount++;
      }
    }

    if (importedDocs.length > 0) {
      setDocuments((prev) => [...importedDocs.reverse(), ...prev]);
      if (importedDocs.length === 1) {
        handleOpenDocument(importedDocs[0]);
      } else {
        setActiveTab('files');
        notify('success', `Imported ${importedDocs.length} documents into your vault.`);
      }
    }

    if (failCount > 0) {
      notify('error', `Could not read ${failCount} file(s).`);
    }
  };

  // Synchronous click preserves browser user-gesture activation on mobile Brave/Chrome
  const triggerFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDeleteDocument = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const docToDelete = documents.find((d) => d.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Local Document',
      message: `Remove "${docToDelete?.name || 'this file'}" from your offline vault?`,
      action: async () => {
        await deleteDocument(id);
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        setRecentSessions((prev) => prev.filter((s) => s.documentId !== id));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        notify('info', 'Document removed from vault.');
      },
    });
  };

  const handleClearHistory = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Reading History',
      message: 'Clear your recent reading sessions? Your saved vault documents will remain intact.',
      action: async () => {
        await clearRecentSessions();
        setRecentSessions([]);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        notify('success', 'Reading history cleared.');
      },
    });
  };

  const handleClearAllDocuments = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Entire Vault',
      message: 'This will permanently delete all imported documents and reading history from this device.',
      action: async () => {
        const db = await getDB();
        await db.clear('documents');
        await db.clear('recents');
        setDocuments([]);
        setRecentSessions([]);
        setSelectedDoc(null);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        notify('info', 'Local document vault cleared.');
      },
    });
  };

  // Serialize binary ArrayBuffers as base64 dataUri cleanly so exported backups actually restore!
  const handleExportBackup = () => {
    try {
      const serializableDocs = documents.map((doc) => {
        const { arrayBuffer, ...rest } = doc;
        let dataUri = doc.dataUri;
        if (!dataUri && arrayBuffer && arrayBuffer.byteLength > 0) {
          dataUri = uint8ArrayToDataUri(
            new Uint8Array(arrayBuffer),
            doc.mimeType || 'application/octet-stream'
          );
        }
        return { ...rest, dataUri };
      });

      const backupData = JSON.stringify(
        { documents: serializableDocs, settings, recentSessions },
        null,
        2
      );
      const blob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MasterDocs_Vault_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('success', `Exported ${documents.length} document(s) to backup file.`);
    } catch (err) {
      console.error('Export backup error:', err);
      notify('error', 'Failed to export vault backup.');
    }
  };

  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = JSON.parse(evt.target?.result as string);
          if (!data.documents || !Array.isArray(data.documents)) {
            throw new Error('Invalid backup structure');
          }
          for (const rawDoc of data.documents) {
            const restored: DocumentItem = { ...rawDoc };
            if (restored.dataUri && !restored.arrayBuffer) {
              try {
                const bytes = dataUriToUint8Array(restored.dataUri);
                restored.arrayBuffer = bytes.buffer.slice(0) as ArrayBuffer;
              } catch {
                // Keep dataUri if decode fails
              }
            }
            await saveDocument(restored);
          }
          setDocuments(await getAllDocuments());
          notify('success', `Restored ${data.documents.length} document(s) from backup.`);
        } catch {
          notify('error', 'Invalid backup file format.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSeedDemoDocs = async () => {
    const loaded = await seedDemoDocuments();
    setDocuments(loaded);
    notify('success', 'Sample demo documents loaded into local vault.');
  };

  return (
    <div className="min-h-screen bg-[#fff9e7] dark:bg-[#181711] text-[#1d1c11] dark:text-[#f6f1de] flex flex-col font-sans overflow-x-hidden">
      {/* System file picker — unrestricted so Android MIME quirks never block opening any document */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        multiple
        className="hidden"
      />

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Sticky Top Header */}
      <TopHeader
        activeTab={activeTab}
        subtitle={activeTab === 'reader' ? selectedDoc?.name : undefined}
        onOpenSearch={() => setActiveTab('search')}
        onBack={() => {
          if (activeTab === 'reader') {
            setActiveTab('files');
            setSelectedDoc(null);
          } else {
            setActiveTab('home');
          }
        }}
        onOpenSettings={() => setActiveTab('settings')}
      />

      {/* Main View Container */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 min-w-0">
        {activeTab === 'home' && (
          <HomeScreen
            documents={documents}
            recentSession={recentSessions[0] || null}
            onOpenDocument={handleOpenDocument}
            onImportFile={triggerFilePicker}
            onSelectCategory={(type) => {
              setSelectedCategory(type);
              setActiveTab('files');
            }}
            onToggleFavorite={handleToggleFavorite}
            onViewAllFiles={() => setActiveTab('files')}
          />
        )}

        {activeTab === 'files' && (
          <FilesScreen
            documents={documents}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onOpenDocument={handleOpenDocument}
            onImportFile={triggerFilePicker}
            onToggleFavorite={handleToggleFavorite}
            onDeleteDocument={handleDeleteDocument}
          />
        )}

        {activeTab === 'favourites' && (
          <FavouritesScreen
            documents={documents}
            onOpenDocument={handleOpenDocument}
            onToggleFavorite={handleToggleFavorite}
            onImportFile={triggerFilePicker}
          />
        )}

        {activeTab === 'recent' && (
          <RecentScreen
            sessions={recentSessions}
            documents={documents}
            onOpenDocument={handleOpenDocument}
            onClearHistory={handleClearHistory}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onClearAllDocuments={handleClearAllDocuments}
            onClearHistory={handleClearHistory}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onSeedDemoDocs={handleSeedDemoDocs}
          />
        )}

        {activeTab === 'search' && (
          <SearchScreen
            documents={documents}
            onOpenDocument={handleOpenDocument}
            onBack={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'reader' && selectedDoc && (
          <ReaderScreen
            document={selectedDoc}
            settings={settings}
            onBack={() => {
              setActiveTab('files');
              setSelectedDoc(null);
            }}
            onUpdatePage={async (page, totalPages) => {
              await updateReadingProgress(selectedDoc.id, page, totalPages);
              setRecentSessions(await getRecentSessions());
              setDocuments(await getAllDocuments());
            }}
            onToggleFavorite={handleToggleFavorite}
            onNotify={notify}
          />
        )}
      </main>

      {/* Translucent Liquid Glass Bottom Navigation Dock */}
      <LiquidGlassDock activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.action}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
