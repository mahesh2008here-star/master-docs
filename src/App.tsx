import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import {
  DocumentItem,
  NavigationTab,
  ReadingSession,
  AppSettings,
  VaultSecurityConfig,
} from './types/document';
import {
  getAllDocuments,
  saveDocument,
  deleteDocument,
  toggleFavorite,
  setDocumentPrivate,
  updateReadingProgress,
  getRecentSessions,
  clearRecentSessions,
  getAppSettings,
  saveAppSettings,
  getVaultSecurityConfig,
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
import {
  isNativeAndroid,
  checkAllFilesStoragePermission,
  requestAllFilesStoragePermission,
  scanAllDeviceDocuments,
  loadScannedDeviceDocument,
} from './services/nativeStorageService';
import { TopHeader } from './components/navigation/TopHeader';
import { LiquidGlassDock } from './components/navigation/LiquidGlassDock';
import { HomeScreen } from './screens/HomeScreen';
import { VaultScreen } from './screens/VaultScreen';
import { FavouritesScreen } from './screens/FavouritesScreen';
import { RecentScreen } from './screens/RecentScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ReaderScreen } from './screens/ReaderScreen';
import { SearchScreen } from './screens/SearchScreen';
import { ConfirmModal } from './components/common/ConfirmModal';
import { StoragePermissionModal } from './components/common/StoragePermissionModal';
import { ToastBanner, ToastMessage } from './components/common/Toast';

const ONBOARDING_STORAGE_KEY = 'masterdocs_storage_onboarding_done';

export default function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [scannedDeviceDocs, setScannedDeviceDocs] = useState<DocumentItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<ReadingSession[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [vaultConfig, setVaultConfig] = useState<VaultSecurityConfig | null>(null);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState<boolean>(false);

  const [storagePermissionGranted, setStoragePermissionGranted] = useState<boolean>(false);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState<boolean>(false);
  const [isScanningStorage, setIsScanningStorage] = useState<boolean>(false);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
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
  const importPrivateRef = useRef<boolean>(false);
  const pendingVaultDocRef = useRef<DocumentItem | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), type, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3600);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

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

  const refreshDeviceScan = useCallback(
    async (silent = true) => {
      if (!isNativeAndroid()) return;
      setIsScanningStorage(true);
      try {
        const scanned = await scanAllDeviceDocuments();
        setScannedDeviceDocs(scanned);
        if (!silent) {
          notify('success', `Found ${scanned.length} document(s) in device storage.`);
        }
      } catch (err) {
        console.warn('Device document scan failed:', err);
        if (!silent) {
          notify('error', 'Could not scan device storage.');
        }
      } finally {
        setIsScanningStorage(false);
      }
    },
    [notify]
  );

  // Initialize local DB, Vault config, and first-launch storage access check
  useEffect(() => {
    async function initApp() {
      try {
        const [loadedDocs, loadedSessions, loadedSettings, loadedVaultConfig] =
          await Promise.all([
            getAllDocuments(),
            getRecentSessions(),
            getAppSettings(),
            getVaultSecurityConfig(),
          ]);

        setDocuments(loadedDocs);
        setRecentSessions(loadedSessions);
        setSettings(loadedSettings);
        setVaultConfig(loadedVaultConfig);
        applyTheme(loadedSettings.themeMode);
        applyAccentColor(
          loadedSettings.customAccentColor || loadedSettings.accentColor || '#a92f2e'
        );

        const hasPermission = await checkAllFilesStoragePermission();
        setStoragePermissionGranted(hasPermission);

        if (hasPermission && isNativeAndroid()) {
          refreshDeviceScan(true);
        }

        const onboardingDone = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (!onboardingDone && !hasPermission) {
          setShowPermissionModal(true);
        }
      } catch (err) {
        console.error('Failed to initialize Master Docs:', err);
        notify('error', 'Failed to initialize local document storage.');
      }
    }
    initApp();
  }, [notify, refreshDeviceScan]);

  // Auto-lock Secure Vault on background & re-check All Files Permission on foreground resume
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setIsVaultUnlocked(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const appListener = CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) {
        setIsVaultUnlocked(false);
        return;
      }

      const granted = await checkAllFilesStoragePermission();
      setStoragePermissionGranted(granted);
      if (granted) {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'granted');
        setShowPermissionModal(false);
        if (isNativeAndroid()) {
          refreshDeviceScan(true);
        }
      }
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      appListener.then((h) => h.remove());
    };
  }, [refreshDeviceScan]);

  // Android Hardware Back Button handling
  useEffect(() => {
    const listener = CapApp.addListener('backButton', () => {
      if (activeTab === 'reader') {
        setActiveTab(selectedDoc?.isPrivate ? 'vault' : 'home');
        setSelectedDoc(null);
      } else if (activeTab !== 'home') {
        setActiveTab('home');
      } else {
        CapApp.minimizeApp();
      }
    });

    return () => {
      listener.then((h) => h.remove());
    };
  }, [activeTab, selectedDoc?.isPrivate]);

  // Separate public library (merged with scanned Android device files) vs hidden private vault
  const privateDocuments = useMemo(
    () => documents.filter((d) => Boolean(d.isPrivate)),
    [documents]
  );

  const publicDocuments = useMemo(() => {
    const dbPublic = documents.filter((d) => !d.isPrivate);
    const knownDevicePaths = new Set(
      documents.map((d) => d.devicePath).filter((p): p is string => Boolean(p))
    );
    const knownSignatures = new Set(
      documents.map((d) => `${d.name.toLowerCase()}::${d.size}`)
    );

    const extraScanned = scannedDeviceDocs.filter(
      (s) =>
        (!s.devicePath || !knownDevicePaths.has(s.devicePath)) &&
        !knownSignatures.has(`${s.name.toLowerCase()}::${s.size}`)
    );

    return [...dbPublic, ...extraScanned].sort(
      (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );
  }, [documents, scannedDeviceDocs]);

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

  const ingestFileObject = async (file: File, isPrivate: boolean): Promise<DocumentItem> => {
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
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      extension,
      type: docType,
      mimeType: file.type || undefined,
      size: file.size,
      modifiedAt: nowIso,
      createdAt: nowIso,
      isFavorite: false,
      isPrivate,
      pageCount,
      lastReadPage: 1,
      readProgress: Math.round((1 / Math.max(1, pageCount)) * 100),
      arrayBuffer: rawBuffer,
      content: searchableContent,
    };

    await saveDocument(newDoc);
    return newDoc;
  };

  const handleGrantStorageAccess = async () => {
    setIsRequestingPermission(true);
    try {
      if (isNativeAndroid()) {
        const res = await requestAllFilesStoragePermission();
        if (res.granted) {
          localStorage.setItem(ONBOARDING_STORAGE_KEY, 'granted');
          setStoragePermissionGranted(true);
          setShowPermissionModal(false);
          await refreshDeviceScan(false);
        } else if (res.openedSettings) {
          localStorage.setItem(ONBOARDING_STORAGE_KEY, 'prompted');
          setShowPermissionModal(false);
          notify(
            'info',
            'Enable "Allow access to manage all files" in Settings, then return to Master Docs.'
          );
        } else {
          notify('error', 'Storage permission was not granted.');
        }
        return;
      }

      // Web / PWA browser path: try directory picker if supported, otherwise mark granted & let user import
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'granted');
      setStoragePermissionGranted(true);
      setShowPermissionModal(false);

      const picker = (window as any).showDirectoryPicker;
      if (typeof picker === 'function') {
        try {
          const dirHandle = await picker({ mode: 'read' });
          const imported: DocumentItem[] = [];
          for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              if (file.size > 0 && file.size <= 50 * 1024 * 1024) {
                const doc = await ingestFileObject(file, false);
                imported.push(doc);
                if (imported.length >= 40) break;
              }
            }
          }
          if (imported.length > 0) {
            setDocuments(await getAllDocuments());
            notify('success', `Imported ${imported.length} document(s) onto your Home screen.`);
          } else {
            notify('info', 'Storage access ready. Tap "Import Document" to add files.');
          }
          return;
        } catch {
          // User cancelled directory picker or iframe blocked; fall back gracefully
        }
      }

      notify('success', 'Storage access enabled. Tap "Import Document" to open files.');
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleSkipStorageOnboarding = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'skipped');
    setShowPermissionModal(false);
  };

  const handleOpenDocument = async (doc: DocumentItem) => {
    if (openingDocId) return;
    setOpeningDocId(doc.id);
    try {
      let readyDoc = doc;
      if (doc.devicePath && !doc.arrayBuffer && !doc.dataUri && !doc.content) {
        readyDoc = await loadScannedDeviceDocument(doc);
      }

      setSelectedDoc(readyDoc);
      setActiveTab('reader');

      // Persist reading progress only for IndexedDB-backed documents (never store private docs in recents)
      if (!readyDoc.devicePath) {
        updateReadingProgress(
          readyDoc.id,
          readyDoc.lastReadPage || 1,
          readyDoc.pageCount || 1
        ).then(() => {
          getRecentSessions().then(setRecentSessions);
        });
      }
    } catch (err: any) {
      console.error('Failed opening document:', err);
      notify('error', err?.message || `Could not open "${doc.name}".`);
    } finally {
      setOpeningDocId(null);
    }
  };

  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isFavorite: !d.isFavorite } : d))
    );
    await toggleFavorite(id);
  };

  const moveDocumentIntoVault = async (doc: DocumentItem) => {
    if (!vaultConfig) {
      pendingVaultDocRef.current = doc;
      setActiveTab('vault');
      notify('info', 'Set up a Vault PIN or Password first to hide private documents.');
      return;
    }

    let prepared = doc;
    if (doc.devicePath && !doc.arrayBuffer && !doc.dataUri && !doc.content) {
      prepared = await loadScannedDeviceDocument(doc);
    }

    const existsInDb = documents.some((d) => d.id === prepared.id);
    if (existsInDb) {
      await setDocumentPrivate(prepared.id, true);
    } else {
      await saveDocument({
        ...prepared,
        isPrivate: true,
        isFavorite: false,
      });
    }

    const [updatedDocs, updatedSessions] = await Promise.all([
      getAllDocuments(),
      getRecentSessions(),
    ]);
    setDocuments(updatedDocs);
    setRecentSessions(updatedSessions);
    notify('success', `"${doc.name}" locked inside Secure Vault.`);
  };

  const handleRemoveFromVault = async (id: string) => {
    const target = documents.find((d) => d.id === id);
    await setDocumentPrivate(id, false);
    setDocuments(await getAllDocuments());
    notify('info', `"${target?.name || 'Document'}" moved back to Home.`);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const targetPrivate = importPrivateRef.current && Boolean(vaultConfig) && isVaultUnlocked;
    const importedDocs: DocumentItem[] = [];
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        const doc = await ingestFileObject(files[i], targetPrivate);
        importedDocs.push(doc);
      } catch (err) {
        console.error(`Failed importing file ${files[i].name}:`, err);
        failCount++;
      }
    }

    if (importedDocs.length > 0) {
      setDocuments(await getAllDocuments());
      if (importedDocs.length === 1 && !targetPrivate) {
        handleOpenDocument(importedDocs[0]);
      } else {
        setActiveTab(targetPrivate ? 'vault' : 'home');
        notify(
          'success',
          targetPrivate
            ? `Locked ${importedDocs.length} private document(s) in Secure Vault.`
            : `Imported ${importedDocs.length} document(s) onto Home.`
        );
      }
    }

    if (failCount > 0) {
      notify('error', `Could not read ${failCount} file(s).`);
    }
  };

  const triggerFilePicker = (asPrivate = false) => {
    importPrivateRef.current = asPrivate;
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
      message: `Remove "${docToDelete?.name || 'this file'}" from app storage?`,
      action: async () => {
        await deleteDocument(id);
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        setRecentSessions((prev) => prev.filter((s) => s.documentId !== id));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        notify('info', 'Document deleted.');
      },
    });
  };

  const handleClearHistory = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Reading History',
      message: 'Clear your recent reading sessions? Your documents remain intact.',
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
      title: 'Clear All App Storage',
      message:
        'This will permanently delete all imported & Vault documents and reading history from this app.',
      action: async () => {
        const db = await getDB();
        await db.clear('documents');
        await db.clear('recents');
        setDocuments([]);
        setRecentSessions([]);
        setSelectedDoc(null);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        notify('info', 'All local documents cleared.');
      },
    });
  };

  const handleExportBackup = () => {
    try {
      const publicOnly = documents.filter((d) => !d.isPrivate);
      const serializableDocs = publicOnly.map((doc) => {
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
      a.download = `MasterDocs_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('success', `Exported ${serializableDocs.length} document(s) to backup.`);
    } catch (err) {
      console.error('Export backup error:', err);
      notify('error', 'Failed to export backup.');
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
    notify('success', 'Sample demo documents loaded onto Home.');
  };

  return (
    <div className="min-h-screen bg-[#fff9e7] dark:bg-[#181711] text-[#1d1c11] dark:text-[#f6f1de] flex flex-col font-sans overflow-x-hidden">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        multiple
        className="hidden"
      />

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <TopHeader
        activeTab={activeTab}
        subtitle={activeTab === 'reader' ? selectedDoc?.name : undefined}
        onOpenSearch={() => setActiveTab('search')}
        onBack={() => {
          if (activeTab === 'reader') {
            setActiveTab(selectedDoc?.isPrivate ? 'vault' : 'home');
            setSelectedDoc(null);
          } else {
            setActiveTab('home');
          }
        }}
        onOpenSettings={() => setActiveTab('settings')}
      />

      <main className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 min-w-0">
        {activeTab === 'home' && (
          <HomeScreen
            documents={publicDocuments}
            recentSession={recentSessions[0] || null}
            storagePermissionGranted={storagePermissionGranted}
            isScanningStorage={isScanningStorage}
            openingDocId={openingDocId}
            onOpenDocument={handleOpenDocument}
            onImportFile={() => triggerFilePicker(false)}
            onRequestStorageAccess={() => setShowPermissionModal(true)}
            onRescanStorage={() => refreshDeviceScan(false)}
            onToggleFavorite={handleToggleFavorite}
            onMoveToVault={(doc, e) => {
              e.stopPropagation();
              moveDocumentIntoVault(doc);
            }}
            onDeleteDocument={handleDeleteDocument}
            onOpenVaultTab={() => setActiveTab('vault')}
          />
        )}

        {activeTab === 'vault' && (
          <VaultScreen
            vaultConfig={vaultConfig}
            isUnlocked={isVaultUnlocked}
            privateDocuments={privateDocuments}
            publicDocuments={publicDocuments}
            onVaultConfigUpdated={async (newConfig) => {
              setVaultConfig(newConfig);
              if (pendingVaultDocRef.current) {
                const pendingDoc = pendingVaultDocRef.current;
                pendingVaultDocRef.current = null;
                let prepared = pendingDoc;
                if (
                  pendingDoc.devicePath &&
                  !pendingDoc.arrayBuffer &&
                  !pendingDoc.dataUri &&
                  !pendingDoc.content
                ) {
                  prepared = await loadScannedDeviceDocument(pendingDoc);
                }
                const existsInDb = documents.some((d) => d.id === prepared.id);
                if (existsInDb) {
                  await setDocumentPrivate(prepared.id, true);
                } else {
                  await saveDocument({ ...prepared, isPrivate: true, isFavorite: false });
                }
                setDocuments(await getAllDocuments());
                setRecentSessions(await getRecentSessions());
                notify('success', `"${pendingDoc.name}" moved into Secure Vault.`);
              }
            }}
            onUnlock={() => setIsVaultUnlocked(true)}
            onLock={() => {
              setIsVaultUnlocked(false);
              notify('info', 'Secure Vault locked.');
            }}
            onOpenDocument={handleOpenDocument}
            onImportPrivateFile={() => triggerFilePicker(true)}
            onMoveToVault={moveDocumentIntoVault}
            onRemoveFromVault={handleRemoveFromVault}
            onDeleteDocument={handleDeleteDocument}
            onNotify={notify}
          />
        )}

        {activeTab === 'favourites' && (
          <FavouritesScreen
            documents={publicDocuments}
            onOpenDocument={handleOpenDocument}
            onToggleFavorite={handleToggleFavorite}
            onImportFile={() => triggerFilePicker(false)}
          />
        )}

        {activeTab === 'recent' && (
          <RecentScreen
            sessions={recentSessions}
            documents={publicDocuments}
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
            documents={publicDocuments}
            onOpenDocument={handleOpenDocument}
            onBack={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'reader' && selectedDoc && (
          <ReaderScreen
            document={selectedDoc}
            settings={settings}
            onBack={() => {
              setActiveTab(selectedDoc.isPrivate ? 'vault' : 'home');
              setSelectedDoc(null);
            }}
            onUpdatePage={async (page, totalPages) => {
              if (!selectedDoc.devicePath) {
                await updateReadingProgress(selectedDoc.id, page, totalPages);
                setRecentSessions(await getRecentSessions());
                setDocuments(await getAllDocuments());
              }
            }}
            onToggleFavorite={handleToggleFavorite}
            onNotify={notify}
          />
        )}
      </main>

      <LiquidGlassDock activeTab={activeTab} onSelectTab={setActiveTab} />

      <StoragePermissionModal
        isOpen={showPermissionModal}
        isBusy={isRequestingPermission}
        onGrantAccess={handleGrantStorageAccess}
        onSkip={handleSkipStorageOnboarding}
      />

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
