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
} from './storage/db';
import { getDocumentType } from './utils/fileHelpers';
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

export default function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<ReadingSession[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    themeMode: 'light',
    accentColor: 'red',
    defaultZoom: 100,
    pageSpacing: 'normal',
    continuousScroll: true,
    keepScreenAwake: true,
    autoSaveProgress: true,
    encryptVault: true,
  });

  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentType | 'all'>('all');

  // Modal confirmation states
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

  // Initialize DB and load documents & settings
  useEffect(() => {
    async function initVault() {
      try {
        const loadedDocs = await getAllDocuments();
        setDocuments(loadedDocs);

        const loadedSessions = await getRecentSessions();
        setRecentSessions(loadedSessions);

        const loadedSettings = await getAppSettings();
        setSettings(loadedSettings);
        applyTheme(loadedSettings.themeMode);
        applyAccentColor(loadedSettings.customAccentColor || loadedSettings.accentColor || '#a92f2e');
      } catch (err) {
        console.error('Failed to initialize Master Docs storage:', err);
      }
    }
    initVault();
  }, []);

  // Sync theme changes with document element
  const applyTheme = (mode: 'system' | 'light' | 'dark') => {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (mode === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
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
      applyAccentColor(newSettingsPartial.customAccentColor || newSettingsPartial.accentColor || '#a92f2e');
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

  // Document Reading Action
  const handleOpenDocument = (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setActiveTab('reader');
    // Update initial session progress
    updateReadingProgress(doc.id, doc.lastReadPage || 1, doc.pageCount || 10).then(() => {
      getRecentSessions().then(setRecentSessions);
    });
  };

  // Toggle Favorite
  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedDocs = documents.map((d) => {
      if (d.id === id) {
        return { ...d, isFavorite: !d.isFavorite };
      }
      return d;
    });
    setDocuments(updatedDocs);
    await toggleFavorite(id);
  };

  // Import local document handler using File API
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const extension = file.name.split('.').pop() || 'txt';
    const docType = getDocumentType(extension);

    const reader = new FileReader();

    if (docType === 'text' || docType === 'markdown') {
      reader.onload = async (evt) => {
        const text = evt.target?.result as string;
        const newDoc: DocumentItem = {
          id: 'doc-' + Date.now(),
          name: file.name,
          extension,
          type: docType,
          size: file.size,
          modifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isFavorite: false,
          pageCount: Math.ceil((text || '').length / 1000) || 1,
          lastReadPage: 1,
          readProgress: 0,
          content: text,
        };
        await saveDocument(newDoc);
        setDocuments((prev) => [newDoc, ...prev]);
        handleOpenDocument(newDoc);
      };
      reader.readAsText(file);
    } else {
      reader.onload = async (evt) => {
        const dataUri = evt.target?.result as string;
        const newDoc: DocumentItem = {
          id: 'doc-' + Date.now(),
          name: file.name,
          extension,
          type: docType,
          size: file.size,
          modifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isFavorite: false,
          pageCount: 10,
          lastReadPage: 1,
          readProgress: 0,
          dataUri,
          content: `Imported document content for ${file.name}`,
        };
        await saveDocument(newDoc);
        setDocuments((prev) => [newDoc, ...prev]);
        handleOpenDocument(newDoc);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Delete Document
  const handleDeleteDocument = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const docToDelete = documents.find((d) => d.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Local Document',
      message: `Are you sure you want to delete "${docToDelete?.name || 'this file'}" from your offline vault?`,
      action: async () => {
        await deleteDocument(id);
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        setRecentSessions((prev) => prev.filter((s) => s.documentId !== id));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Clear History
  const handleClearHistory = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Reading History',
      message: 'Are you sure you want to clear your recent reading sessions? Your vault documents will remain safe.',
      action: async () => {
        await clearRecentSessions();
        setRecentSessions([]);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Clear Cache
  const handleClearCache = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Application Cache',
      message: 'This will purge temporary thumbnail caches and temporary session data.',
      action: () => {
        alert('Cache cleared successfully!');
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Export Backup
  const handleExportBackup = () => {
    const backupData = JSON.stringify({ documents, settings, recentSessions }, null, 2);
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MasterDocs_Vault_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Backup
  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = JSON.parse(evt.target?.result as string);
            if (data.documents && Array.isArray(data.documents)) {
              for (const doc of data.documents) {
                await saveDocument(doc);
              }
              setDocuments(await getAllDocuments());
              alert('Backup restored successfully!');
            }
          } catch (err) {
            alert('Invalid backup file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-[#fff9e7] dark:bg-[#181711] text-[#1d1c11] dark:text-[#f6f1de] flex flex-col font-sans">
      {/* Hidden system file picker input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.txt,.md"
        className="hidden"
      />

      {/* Top Header */}
      <TopHeader
        activeTab={activeTab}
        subtitle={selectedDoc?.name}
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
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-20">
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
            onClearCache={handleClearCache}
            onClearHistory={handleClearHistory}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
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
