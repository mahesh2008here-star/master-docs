import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  PlusCircle,
  BookOpen,
  Play,
  Star,
  HardDrive,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Clock,
  RefreshCw,
  Search,
  X,
  ArrowUpDown,
  LayoutGrid,
  List as ListIcon,
  Lock,
  Trash2,
  FolderSearch,
  ShieldCheck,
} from 'lucide-react';
import { DocumentItem, ReadingSession, DocumentType } from '../types/document';
import {
  getTypeBadgeConfig,
  formatFileSize,
  formatDateLabel,
} from '../utils/fileHelpers';
import { DocumentIcon } from '../components/common/DocumentIcon';

interface HomeScreenProps {
  documents: DocumentItem[];
  recentSession: ReadingSession | null;
  storagePermissionGranted: boolean;
  isScanningStorage: boolean;
  openingDocId: string | null;
  onOpenDocument: (doc: DocumentItem) => void;
  onImportFile: () => void;
  onRequestStorageAccess: () => void;
  onRescanStorage: () => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onMoveToVault: (doc: DocumentItem, e: React.MouseEvent) => void;
  onDeleteDocument: (id: string, e: React.MouseEvent) => void;
  onOpenVaultTab: () => void;
}

type CategoryFilter = 'all' | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'text';

export const HomeScreen: React.FC<HomeScreenProps> = ({
  documents,
  recentSession,
  storagePermissionGranted,
  isScanningStorage,
  openingDocId,
  onOpenDocument,
  onImportFile,
  onRequestStorageAccess,
  onRescanStorage,
  onToggleFavorite,
  onMoveToVault,
  onDeleteDocument,
  onOpenVaultTab,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'size'>('recent');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Defense in depth: Home never renders private vault documents
  const publicDocs = useMemo(
    () => documents.filter((d) => !d.isPrivate),
    [documents]
  );

  const counts = useMemo(() => {
    return {
      all: publicDocs.length,
      pdf: publicDocs.filter((d) => d.type === 'pdf').length,
      word: publicDocs.filter((d) => d.type === 'word').length,
      excel: publicDocs.filter((d) => d.type === 'excel').length,
      powerpoint: publicDocs.filter((d) => d.type === 'powerpoint').length,
      text: publicDocs.filter(
        (d) => d.type === 'text' || d.type === 'markdown' || d.type === 'image' || d.type === 'other'
      ).length,
    };
  }, [publicDocs]);

  const totalBytes = useMemo(
    () => publicDocs.reduce((acc, doc) => acc + (doc.size || 0), 0),
    [publicDocs]
  );

  const activeDoc = recentSession
    ? publicDocs.find((d) => d.id === recentSession.documentId) || publicDocs[0]
    : publicDocs[0];

  const filteredDocs = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return publicDocs
      .filter((doc) => {
        if (selectedCategory === 'text') {
          if (
            doc.type !== 'text' &&
            doc.type !== 'markdown' &&
            doc.type !== 'image' &&
            doc.type !== 'other'
          ) {
            return false;
          }
        } else if (selectedCategory !== 'all' && doc.type !== selectedCategory) {
          return false;
        }

        if (q) {
          return (
            doc.name.toLowerCase().includes(q) ||
            doc.extension.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'size') return (b.size || 0) - (a.size || 0);
        return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      });
  }, [publicDocs, selectedCategory, filterQuery, sortBy]);

  const categories: Array<{
    id: CategoryFilter;
    title: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    bg: string;
  }> = [
    { id: 'all', title: 'All Docs', count: counts.all, icon: BookOpen, bg: 'bg-[#1d1c11]' },
    { id: 'pdf', title: 'PDF', count: counts.pdf, icon: BookOpen, bg: 'bg-[#E65C56]' },
    { id: 'word', title: 'Word', count: counts.word, icon: FileText, bg: 'bg-[#3478D4]' },
    { id: 'excel', title: 'Sheets', count: counts.excel, icon: FileSpreadsheet, bg: 'bg-[#249B65]' },
    { id: 'powerpoint', title: 'Slides', count: counts.powerpoint, icon: Presentation, bg: 'bg-[#D88B32]' },
    { id: 'text', title: 'Notes & More', count: counts.text, icon: FileCode, bg: 'bg-[#8A65C9]' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full space-y-5 pb-28 min-w-0"
    >
      {/* Hero / All-Files Hub Card */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 sm:p-5 retro-border retro-shadow flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[10px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
            ALL DOCUMENTS HUB
          </span>
          <span className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-[#58413f] dark:text-[#c8bead]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#249B65]" />
            <span>100% On-Device</span>
          </span>
        </div>

        <div>
          <h1 className="font-heading text-xl sm:text-2xl text-[#1d1c11] dark:text-[#f6f1de] tracking-tight font-bold leading-snug">
            Offline Document Reader &amp; Vault
          </h1>
          <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] mt-1 leading-relaxed">
            Open PDFs, Word docs, spreadsheets, slides &amp; notes with smooth pinch-to-zoom and a PIN-protected Vault.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onImportFile}
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="flex-1 min-h-[46px] px-4 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow flex items-center justify-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>IMPORT DOCUMENT</span>
          </motion.button>

          {!storagePermissionGranted ? (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onRequestStorageAccess}
              className="min-h-[46px] px-4 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <FolderSearch className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
              <span>ALLOW ALL FILES</span>
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.96 }}
              disabled={isScanningStorage}
              onClick={onRescanStorage}
              className="min-h-[46px] px-4 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-4 h-4 text-[#249B65] shrink-0 ${
                  isScanningStorage ? 'animate-spin' : ''
                }`}
              />
              <span>{isScanningStorage ? 'SCANNING...' : 'SCAN STORAGE'}</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Continue Reading Spotlight */}
      {activeDoc && (
        <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[10px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
              CONTINUE READING
            </span>
            <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] flex items-center gap-1 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[var(--primary-red)] shrink-0" />
              <span>{formatDateLabel(activeDoc.modifiedAt)}</span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className={`w-11 h-11 rounded-xl ${
                  getTypeBadgeConfig(activeDoc.type, activeDoc.extension).bgColor
                } retro-border-sm retro-shadow-sm flex items-center justify-center text-white shrink-0`}
              >
                <DocumentIcon typeKey={activeDoc.type} className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] truncate">
                  {activeDoc.name}
                </h3>
                <p className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate tabular-nums">
                  Page {activeDoc.lastReadPage ?? 1} of {activeDoc.pageCount ?? 1} ·{' '}
                  {activeDoc.readProgress ?? 0}% complete
                </p>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.94 }}
              disabled={openingDocId === activeDoc.id}
              onClick={() => onOpenDocument(activeDoc)}
              style={{ backgroundColor: 'var(--primary-red)' }}
              className="min-h-[42px] px-3.5 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60"
            >
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>{openingDocId === activeDoc.id ? 'Opening...' : 'RESUME'}</span>
            </motion.button>
          </div>

          <div className="w-full h-2.5 rounded-full bg-white dark:bg-[#212019] border border-[#171717] dark:border-[#474439] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${activeDoc.readProgress ?? 0}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{ backgroundColor: 'var(--primary-red)' }}
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* Format Filter Cards */}
      <div className="flex flex-col space-y-2.5 min-w-0">
        <div className="flex items-center justify-between px-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[10px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
            CATEGORIES
          </span>
          <span className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] tabular-nums">
            {publicDocs.length} total files
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 min-w-0">
          {categories.map((cat) => {
            const IconComp = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.94 }}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-col justify-between p-2.5 rounded-2xl text-left cursor-pointer retro-border-sm retro-shadow-sm transition-colors min-w-0 ${
                  isSelected
                    ? 'bg-[#1d1c11] text-[#fff9e7] dark:bg-[#f6f1de] dark:text-[#1d1c11]'
                    : 'bg-[#f9f4e1] dark:bg-[#2b2921] text-[#1d1c11] dark:text-[#f6f1de] hover:bg-[#f3eedc] dark:hover:bg-[#333128]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl ${cat.bg} retro-border-sm flex items-center justify-center text-white mb-2 shrink-0`}
                >
                  <IconComp className="w-4 h-4" />
                </div>
                <div className="min-w-0 w-full">
                  <span className="block font-heading font-bold text-xs truncate">
                    {cat.title}
                  </span>
                  <span
                    className={`font-sans text-[10px] truncate block tabular-nums ${
                      isSelected ? 'opacity-80' : 'text-[#58413f] dark:text-[#c8bead]'
                    }`}
                  >
                    {cat.count} {cat.count === 1 ? 'file' : 'files'}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Search, Sort & Layout Controls + ALL DOCUMENTS LIST */}
      <div className="flex flex-col space-y-2.5 min-w-0">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[10px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
            YOUR DOCUMENTS ({filteredDocs.length})
          </span>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-1 flex items-center gap-2 h-11 px-3 bg-white dark:bg-[#212019] rounded-xl retro-border-sm retro-shadow-sm min-w-0">
            <Search className="w-4 h-4 text-[#58413f] dark:text-[#c8bead] shrink-0" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter by name or format..."
              className="w-full bg-transparent text-xs font-sans text-[#1d1c11] dark:text-[#f6f1de] focus:outline-none min-w-0"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                aria-label="Clear filter"
                className="w-7 h-7 flex items-center justify-center text-[#58413f] dark:text-[#c8bead] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (sortBy === 'recent') setSortBy('name');
              else if (sortBy === 'name') setSortBy('size');
              else setSortBy('recent');
            }}
            className="h-11 px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase retro-border-sm retro-shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[var(--primary-red)]" />
            <span>{sortBy}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode((v) => (v === 'list' ? 'grid' : 'list'))}
            aria-label="Toggle layout"
            className="h-11 w-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm retro-shadow-sm flex items-center justify-center cursor-pointer shrink-0"
          >
            {viewMode === 'list' ? (
              <LayoutGrid className="w-4 h-4" />
            ) : (
              <ListIcon className="w-4 h-4" />
            )}
          </button>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="p-8 text-center bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow flex flex-col items-center gap-2">
            <HardDrive className="w-10 h-10 text-[#58413f] dark:text-[#c8bead]" />
            <p className="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de]">
              {filterQuery || selectedCategory !== 'all'
                ? 'No Matching Documents'
                : 'No Documents Loaded Yet'}
            </p>
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] max-w-xs">
              {filterQuery || selectedCategory !== 'all'
                ? 'Clear your search filter or switch back to "All Docs".'
                : storagePermissionGranted
                ? 'Tap "Import Document" or "Scan Storage" above to bring your device documents here.'
                : 'Allow "Manage All Files" access above to fetch all documents from device storage, or tap "Import Document".'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow overflow-hidden divide-y-2 divide-[#171717] dark:divide-[#38352b]">
            {filteredDocs.map((doc) => {
              const badge = getTypeBadgeConfig(doc.type, doc.extension);
              const isOpening = openingDocId === doc.id;
              return (
                <motion.div
                  key={doc.id}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onOpenDocument(doc)}
                  className="p-3.5 flex items-center justify-between gap-2.5 hover:bg-[#f3eedc] dark:hover:bg-[#333128] transition-colors cursor-pointer min-w-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl ${badge.bgColor} retro-border-sm flex items-center justify-center text-white shrink-0 retro-shadow-sm`}
                    >
                      <DocumentIcon typeKey={badge.typeKey} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block font-heading font-bold text-xs sm:text-sm text-[#1d1c11] dark:text-[#f6f1de] truncate">
                        {isOpening ? `Opening ${doc.name}...` : doc.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0 flex-wrap">
                        <span className="px-1.5 py-0.2 rounded bg-[#e7e2d1] dark:bg-[#474439] retro-border-sm font-sans text-[10px] text-[#58413f] dark:text-[#c8bead] font-bold uppercase shrink-0">
                          {badge.label}
                        </span>
                        <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate tabular-nums">
                          {formatFileSize(doc.size)} • {formatDateLabel(doc.modifiedAt)}
                        </span>
                        {doc.devicePath && (
                          <span className="px-1.5 py-0.2 rounded bg-[#249B65]/15 text-[#249B65] font-heading font-bold text-[10px] uppercase shrink-0">
                            DEVICE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!doc.devicePath && (
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={(e) => onToggleFavorite(doc.id, e)}
                        aria-label="Favorite"
                        className={`w-10 h-10 rounded-xl bg-white dark:bg-[#212019] retro-border-sm retro-shadow-sm flex items-center justify-center ${
                          doc.isFavorite
                            ? 'text-[#D88B32]'
                            : 'text-[#58413f] dark:text-[#c8bead]'
                        } cursor-pointer`}
                      >
                        <Star className={`w-4 h-4 ${doc.isFavorite ? 'fill-current' : ''}`} />
                      </motion.button>
                    )}

                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={(e) => onMoveToVault(doc, e)}
                      title="Hide in Secure Vault"
                      aria-label="Hide in Secure Vault"
                      className="w-10 h-10 rounded-xl bg-white dark:bg-[#212019] retro-border-sm retro-shadow-sm flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                    </motion.button>

                    {!doc.devicePath && (
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={(e) => onDeleteDocument(doc.id, e)}
                        aria-label="Delete document"
                        className="w-10 h-10 rounded-xl bg-white dark:bg-[#212019] retro-border-sm retro-shadow-sm flex items-center justify-center text-[var(--primary-red)] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredDocs.map((doc) => {
              const badge = getTypeBadgeConfig(doc.type, doc.extension);
              return (
                <motion.div
                  key={doc.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onOpenDocument(doc)}
                  className="p-3.5 bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow flex flex-col justify-between gap-2.5 cursor-pointer min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-10 h-10 rounded-xl ${badge.bgColor} retro-border-sm retro-shadow-sm flex items-center justify-center text-white shrink-0`}
                    >
                      <DocumentIcon typeKey={badge.typeKey} className="w-5 h-5" />
                    </div>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => onMoveToVault(doc, e)}
                        aria-label="Move to Vault"
                        className="w-9 h-9 rounded-lg bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                      {!doc.devicePath && (
                        <button
                          type="button"
                          onClick={(e) => onToggleFavorite(doc.id, e)}
                          aria-label="Favorite"
                          className={`w-9 h-9 rounded-lg bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center cursor-pointer ${
                            doc.isFavorite ? 'text-[#D88B32]' : 'text-[#58413f] dark:text-[#c8bead]'
                          }`}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${doc.isFavorite ? 'fill-current' : ''}`}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-heading font-bold text-xs sm:text-sm text-[#1d1c11] dark:text-[#f6f1de] truncate">
                      {doc.name}
                    </h4>
                    <p className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] mt-0.5 tabular-nums truncate">
                      {badge.label} • {formatFileSize(doc.size)} • {formatDateLabel(doc.modifiedAt)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vault Quick Link Strip */}
      <div className="p-3.5 rounded-2xl bg-[#f3eedc] dark:bg-[#333128] retro-border-sm retro-shadow-sm flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center text-[var(--primary-red)] shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] truncate">
              Secure Vault &amp; Storage
            </p>
            <p className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate tabular-nums">
              {publicDocs.length} public docs · {formatFileSize(totalBytes)} indexed
            </p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={onOpenVaultTab}
          className="h-9 px-3 rounded-xl bg-white dark:bg-[#212019] retro-border-sm retro-shadow-sm text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-[11px] uppercase cursor-pointer shrink-0 whitespace-nowrap"
        >
          OPEN VAULT
        </motion.button>
      </div>
    </motion.div>
  );
};
