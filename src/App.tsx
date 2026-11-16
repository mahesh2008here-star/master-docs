import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import {
  DocumentItem,
  NavigationTab,
  ReadingSession,
  AppSettings,
  VaultSecurityConfig,
  ContributorEntry,
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
  getAllContributors,
  saveContributor,
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
  hideDocumentInSystemStorage,
  restoreDocumentFromVaultStorage,
  deleteVaultSandboxCopy,
} from './services/nativeStorageService';
import { fetchApprovedContributorsFromServer } from './services/supportService';
import { subscribeApprovedContributors } from './services/firebaseService';
import { TopHeader } from './components/navigation/TopHeader';
import { LiquidGlassDock } from './components/navigation/LiquidGlassDock';
import { HomeScreen } from './screens/HomeScreen';
import { VaultScreen } from './screens/VaultScreen';
import { FavouritesScreen } from './screens/FavouritesScreen';
import { RecentScreen } from './screens/RecentScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SupportScreen, type SupportReviewParams } from './screens/SupportScreen';
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
  const [contributors, setContributors] = useState<ContributorEntry[]>([]);
  const [reviewParams, setReviewParams] = useState<SupportReviewParams | null>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const id = sp.get('reviewContribution');
      const action = sp.get('action');
      const token = sp.get('token');
      if (id && token && (action === 'approve' || action === 'reject')) {
        return { id, action, token };
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [storagePermissionGranted, setStoragePermissionGranted] = useState<boolean>(false);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState<boolean>(false);
  const [isScanningStorage, setIsScanningStorage] = useState<boolean>(false);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('reviewContribution') && sp.get('token')) {
        return 'support';
      }
    } catch {
      // ignore
    }
    return 'home';
  });
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
  const pendingPrivatePickerRef = useRef<{ active: boolean; timestamp: number }>({
    active: false,
    timestamp: 0,
  });
  const pendingVaultDocRef = useRef<DocumentItem | null>(null);
  const selectedDocRef = useRef<DocumentItem | null>(null);
  const activeTabRef = useRef<NavigationTab>('home');
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    selectedDocRef.current = selectedDoc;
  }, [selectedDoc]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

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

  const navigateToTab = useCallback((nextTab: NavigationTab) => {
    // Immediately lock the Secure Vault whenever leaving the Vault tab
    if (nextTab !== 'vault' && nextTab !== 'reader') {
      setIsVaultUnlocked(false);
      if (selectedDocRef.current?.isPrivate) {
        setSelectedDoc(null);
      }
    }
    setActiveTab(nextTab);
  }, []);

  const mergeAndCacheContributors = useCallback(async (incoming: ContributorEntry[]) => {
    if (!incoming || incoming.length === 0) return;
    for (const item of incoming) {
      await saveContributor(item).catch(() => {});
    }
    setContributors((prev) => {
      const byKey = new Map<string, ContributorEntry>();
      for (const existing of prev) {
        byKey.set(existing.utrHash || existing.id, existing);
      }
      for (const nextItem of incoming) {
        byKey.set(nextItem.utrHash || nextItem.id, nextItem);
      }
      return Array.from(byKey.values()).sort(
        (a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime()
      );
    });
  }, []);

  const refreshApprovedContributors = useCallback(async () => {
    try {
      const res = await fetchApprovedContributorsFromServer();
      await mergeAndCacheContributors(res.contributors);
    } catch {
      // Offline / server unreachable; keep cached & Firestore contributors
    }
  }, [mergeAndCacheContributors]);

  // Initialize local DB, Vault config, contributors, and first-launch storage access check
  useEffect(() => {
    async function initApp() {
      try {
        const [
          loadedDocs,
          loadedSessions,
          loadedSettings,
          loadedVaultConfig,
          loadedContributors,
        ] = await Promise.all([
          getAllDocuments(),
          getRecentSessions(),
          getAppSettings(),
          getVaultSecurityConfig(),
          getAllContributors(),
        ]);

        setDocuments(loadedDocs);
        setRecentSessions(loadedSessions);
        setSettings(loadedSettings);
        setVaultConfig(loadedVaultConfig);
        setContributors(loadedContributors);
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

        void refreshApprovedContributors();
      } catch (err) {
        console.error('Failed to initialize Master Docs:', err);
        notify('error', 'Failed to initialize local document storage.');
      }
    }
    initApp();
  }, [notify, refreshDeviceScan, refreshApprovedContributors]);

  // Live Firestore listener for globally approved contributors
  useEffect(() => {
    const unsubscribe = subscribeApprovedContributors(
      (items) => {
        void mergeAndCacheContributors(items);
      },
      (err) => {
        console.warn('Firestore approved contributors listener notice:', err.message);
      }
    );
    return () => unsubscribe();
  }, [mergeAndCacheContributors]);

  // Immediately lock Secure Vault on app background, tab close, or window hide
  useEffect(() => {
    const lockVaultOnLeave = (forceClose = false) => {
      const pickerWindowValid =
        !forceClose &&
        pendingPrivatePickerRef.current.active &&
        Date.now() - pendingPrivatePickerRef.current.timestamp < 45000;

      if (pickerWindowValid) {
        // Android opens native file chooser as a separate Activity; preserve private import intent until it returns
        return;
      }

      setIsVaultUnlocked(false);
      if (selectedDocRef.current?.isPrivate) {
        setSelectedDoc(null);
        if (activeTabRef.current === 'reader') {
          setActiveTab('vault');
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lockVaultOnLeave(false);
      }
    };
    const handlePageHide = () => lockVaultOnLeave(true);
    const handleBeforeUnload = () => lockVaultOnLeave(true);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const appListener = CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) {
        lockVaultOnLeave(false);
        return;
      }

      if (pendingPrivatePickerRef.current.active) {
        // Clear grace flag shortly after resuming in case user cancelled file picker
        window.setTimeout(() => {
          pendingPrivatePickerRef.current.active = false;
        }, 700);
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
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      appListener.then((h) => h.remove());
    };
  }, [refreshDeviceScan]);

  // Android Hardware Back Button handling
  useEffect(() => {
    const listener = CapApp.addListener('backButton', () => {
      if (activeTab === 'reader') {
        const wasPrivate = Boolean(selectedDoc?.isPrivate);
        setSelectedDoc(null);
        navigateToTab(wasPrivate ? 'vault' : 'home');
      } else if (activeTab === 'support') {
        navigateToTab('settings');
      } else if (activeTab !== 'home') {
        navigateToTab('home');
      } else {
        CapApp.minimizeApp();
      }
    });

    return () => {
      listener.then((h) => h.remove());
    };
  }, [activeTab, selectedDoc?.isPrivate, navigateToTab]);

  // Separate public library (merged with scanned Android device files) vs hidden private vault
  const privateDocuments = useMemo(
    () => documents.filter((d) => Boolean(d.isPrivate)),
    [documents]
  );

  const publicDocuments = useMemo(() => {
    const dbPublic = documents.filter((d) => !d.isPrivate);
    const knownDevicePaths = new Set(
      documents
        .flatMap((d) => [d.devicePath, d.originalDevicePath])
        .filter((p): p is string => Boolean(p))
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

    if (isPrivate) {
      const hideRes = await hideDocumentInSystemStorage(newDoc);
      if (hideRes.vaultFilePath) {
        newDoc.vaultFilePath = hideRes.vaultFilePath;
      }
    }

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
      setIsVaultUnlocked(false);
      setActiveTab('vault');
      notify('info', 'Set up a Vault PIN or Password first to hide private documents.');
      return;
    }

    let prepared = doc;
    if (doc.devicePath && !doc.arrayBuffer && !doc.dataUri && !doc.content) {
      prepared = await loadScannedDeviceDocument(doc);
    }

    const hideRes = await hideDocumentInSystemStorage(prepared);
    const vaultMeta: Partial<DocumentItem> = {
      originalDevicePath:
        hideRes.originalDevicePath || prepared.originalDevicePath || prepared.devicePath,
      vaultFilePath: hideRes.vaultFilePath || prepared.vaultFilePath,
      devicePath: undefined,
    };

    const existsInDb = documents.some((d) => d.id === prepared.id);
    if (existsInDb) {
      await setDocumentPrivate(prepared.id, true, vaultMeta);
    } else {
      await saveDocument({
        ...prepared,
        ...vaultMeta,
        isPrivate: true,
        isFavorite: false,
      });
    }

    if (doc.devicePath) {
      setScannedDeviceDocs((prev) => prev.filter((s) => s.devicePath !== doc.devicePath));
    }

    const [updatedDocs, updatedSessions] = await Promise.all([
      getAllDocuments(),
      getRecentSessions(),
    ]);
    setDocuments(updatedDocs);
    setRecentSessions(updatedSessions);
    notify(
      'success',
      hideRes.deletedOriginal
        ? `"${doc.name}" hidden from internal storage & locked in Secure Vault.`
        : `"${doc.name}" locked inside Secure Vault.`
    );
  };

  const handleRemoveFromVault = async (id: string) => {
    const target = documents.find((d) => d.id === id);
    let restoredOnDisk = false;
    if (target) {
      restoredOnDisk = await restoreDocumentFromVaultStorage(target);
    }
    await setDocumentPrivate(id, false, {
      vaultFilePath: undefined,
      devicePath: restoredOnDisk && target?.originalDevicePath ? target.originalDevicePath : undefined,
      originalDevicePath: undefined,
    });
    setDocuments(await getAllDocuments());
    if (restoredOnDisk && isNativeAndroid()) {
      refreshDeviceScan(true);
    }
    notify(
      'info',
      restoredOnDisk
        ? `"${target?.name || 'Document'}" restored to internal storage & moved to Home.`
        : `"${target?.name || 'Document'}" moved back to Home.`
    );
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    pendingPrivatePickerRef.current.active = false;
    if (!files || files.length === 0) {
      importPrivateRef.current = false;
      return;
    }

    const targetPrivate = importPrivateRef.current && Boolean(vaultConfig);
    importPrivateRef.current = false;

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
            ? `Hidden ${importedDocs.length} private document(s) inside Secure Vault.`
            : `Imported ${importedDocs.length} document(s) onto Home.`
        );
      }
    }

    if (failCount > 0) {
      notify('error', `Could not read ${failCount} file(s).`);
    }
  };

  const triggerFilePicker = (asPrivate = false) => {
    const allowPrivate = asPrivate && Boolean(vaultConfig) && isVaultUnlocked;
    importPrivateRef.current = allowPrivate;
    pendingPrivatePickerRef.current = {
      active: allowPrivate,
      timestamp: Date.now(),
    };
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
        if (docToDelete) {
          await deleteVaultSandboxCopy(docToDelete);
        }
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
        for (const d of documents) {
          if (d.vaultFilePath) {
            await deleteVaultSandboxCopy(d);
          }
        }
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
    <div className="min-h-screen bg-[#fff9e7] dark:bg-[#1d1c11] text-[#1d1c11] dark:text-[#f6f1de] flex flex-col font-sans overflow-x-hidden">
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
        onOpenSearch={() => navigateToTab('search')}
        onBack={() => {
          if (activeTab === 'reader') {
            const wasPrivate = Boolean(selectedDoc?.isPrivate);
            setSelectedDoc(null);
            navigateToTab(wasPrivate ? 'vault' : 'home');
          } else if (activeTab === 'support') {
            navigateToTab('settings');
          } else {
            navigateToTab('home');
          }
        }}
        onOpenSettings={() => navigateToTab('settings')}
      />

      <main className="flex-1 w-full max-w-2xl mx-auto px-3 sm:px-4 pt-4 min-w-0">
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
            onOpenVaultTab={() => navigateToTab('vault')}
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
                const hideRes = await hideDocumentInSystemStorage(prepared);
                const vaultMeta: Partial<DocumentItem> = {
                  originalDevicePath:
                    hideRes.originalDevicePath || prepared.originalDevicePath || prepared.devicePath,
                  vaultFilePath: hideRes.vaultFilePath || prepared.vaultFilePath,
                  devicePath: undefined,
                };
                const existsInDb = documents.some((d) => d.id === prepared.id);
                if (existsInDb) {
                  await setDocumentPrivate(prepared.id, true, vaultMeta);
                } else {
                  await saveDocument({
                    ...prepared,
                    ...vaultMeta,
                    isPrivate: true,
                    isFavorite: false,
                  });
                }
                if (pendingDoc.devicePath) {
                  setScannedDeviceDocs((prev) =>
                    prev.filter((s) => s.devicePath !== pendingDoc.devicePath)
                  );
                }
                setDocuments(await getAllDocuments());
                setRecentSessions(await getRecentSessions());
                notify('success', `"${pendingDoc.name}" hidden & locked inside Secure Vault.`);
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
            contributorsCount={contributors.length}
            onUpdateSettings={handleUpdateSettings}
            onOpenSupport={() => navigateToTab('support')}
            onClearAllDocuments={handleClearAllDocuments}
            onClearHistory={handleClearHistory}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onSeedDemoDocs={handleSeedDemoDocs}
          />
        )}

        {activeTab === 'support' && (
          <SupportScreen
            contributors={contributors}
            reviewParams={reviewParams}
            onClearReviewParams={() => {
              setReviewParams(null);
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete('reviewContribution');
                url.searchParams.delete('action');
                url.searchParams.delete('token');
                window.history.replaceState({}, '', url.toString());
              } catch {
                // ignore
              }
            }}
            onContributorApproved={(entry) => {
              void mergeAndCacheContributors([entry]);
            }}
            onRefreshContributors={refreshApprovedContributors}
            onBack={() => navigateToTab('settings')}
            onNotify={notify}
          />
        )}

        {activeTab === 'search' && (
          <SearchScreen
            documents={publicDocuments}
            onOpenDocument={handleOpenDocument}
            onBack={() => navigateToTab('home')}
          />
        )}

        {activeTab === 'reader' && selectedDoc && (
          <ReaderScreen
            document={selectedDoc}
            settings={settings}
            onBack={() => {
              const wasPrivate = Boolean(selectedDoc.isPrivate);
              setSelectedDoc(null);
              navigateToTab(wasPrivate ? 'vault' : 'home');
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

      <LiquidGlassDock activeTab={activeTab} onSelectTab={navigateToTab} />

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
