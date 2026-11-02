import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DocumentItem, DocumentType } from '../types/document';
import { getTypeBadgeConfig, formatFileSize, formatDateLabel } from '../utils/fileHelpers';

interface FilesScreenProps {
  documents: DocumentItem[];
  selectedCategory: DocumentType | 'all';
  onSelectCategory: (category: DocumentType | 'all') => void;
  onOpenDocument: (doc: DocumentItem) => void;
  onImportFile: () => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDeleteDocument: (id: string, e: React.MouseEvent) => void;
}

export const FilesScreen: React.FC<FilesScreenProps> = ({
  documents,
  selectedCategory,
  onSelectCategory,
  onOpenDocument,
  onImportFile,
  onToggleFavorite,
  onDeleteDocument,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedDocForMenu, setSelectedDocForMenu] = useState<string | null>(null);

  // Category counters
  const categoryCounts = useMemo(() => {
    return {
      all: documents.length,
      pdf: documents.filter((d) => d.type === 'pdf').length,
      word: documents.filter((d) => d.type === 'word').length,
      excel: documents.filter((d) => d.type === 'excel').length,
      powerpoint: documents.filter((d) => d.type === 'powerpoint').length,
      text: documents.filter((d) => d.type === 'text' || d.type === 'markdown').length,
    };
  }, [documents]);

  // Filtered and sorted documents
  const filteredDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        if (selectedCategory !== 'all') {
          if (selectedCategory === 'text') {
            if (doc.type !== 'text' && doc.type !== 'markdown') return false;
          } else if (doc.type !== selectedCategory) {
            return false;
          }
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            doc.name.toLowerCase().includes(q) ||
            doc.extension.toLowerCase().includes(q) ||
            (doc.content && doc.content.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortBy === 'date') {
          comp = new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
        } else if (sortBy === 'name') {
          comp = a.name.localeCompare(b.name);
        } else if (sortBy === 'size') {
          comp = b.size - a.size;
        }
        return sortOrder === 'asc' ? -comp : comp;
      });
  }, [documents, selectedCategory, searchQuery, sortBy, sortOrder]);

  const toggleSort = () => {
    if (sortBy === 'date') setSortBy('name');
    else if (sortBy === 'name') setSortBy('size');
    else {
      setSortBy('date');
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full space-y-4 pb-28"
    >
      {/* Search Bar Input */}
      <div className="relative w-full">
        <div className="flex items-center gap-2 h-12 px-3 bg-white dark:bg-[#212019] rounded-xl retro-border retro-shadow">
          <span className="material-symbols-outlined text-[22px] text-[#58413f] dark:text-[#c8bead]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${documents.length} offline documents...`}
            className="w-full bg-transparent border-none text-sm font-sans text-[#1d1c11] dark:text-[#f6f1de] focus:outline-none placeholder:text-[#58413f]/60 dark:placeholder:text-[#c8bead]/60"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#58413f] hover:text-[#1d1c11] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={toggleSort}
              title="Filter & Sort"
              className="w-8 h-8 rounded-lg bg-[#f3eedc] dark:bg-[#333128] retro-border-sm flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] retro-shadow-sm cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 no-scrollbar">
        {[
          { id: 'all', label: `ALL FILES (${categoryCounts.all})` },
          { id: 'pdf', label: `PDF (${categoryCounts.pdf})` },
          { id: 'word', label: `WORD (${categoryCounts.word})` },
          { id: 'excel', label: `EXCEL (${categoryCounts.excel})` },
          { id: 'powerpoint', label: `SLIDES (${categoryCounts.powerpoint})` },
          { id: 'text', label: `TEXT (${categoryCounts.text})` },
        ].map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <motion.button
              key={cat.id}
              whileTap={{ scale: 0.92 }}
              onClick={() => onSelectCategory(cat.id as any)}
              style={{
                backgroundColor: isSelected ? 'var(--primary-red)' : undefined,
              }}
              className={`px-3 py-1.5 rounded-full font-heading font-bold text-xs uppercase tracking-wider retro-border-sm cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                isSelected
                  ? 'text-white retro-shadow-sm'
                  : 'bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] hover:bg-[#f3eedc]'
              }`}
            >
              {cat.label}
            </motion.button>
          );
        })}
      </div>

      {/* Directory Storage Status Banner */}
      <div className="flex flex-col space-y-2">
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm self-start">
          DIRECTORY
        </span>

        <div className="p-3.5 rounded-2xl bg-[#f9f4e1] dark:bg-[#2b2921] retro-border retro-shadow flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] shrink-0 retro-shadow-sm">
                <span className="material-symbols-outlined text-[18px]">folder_open</span>
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] truncate">
                  Internal Storage &gt; Documents &gt; Vault
                </p>
                <p className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead]">
                  Synchronized 14 mins ago
                </p>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onImportFile}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#212019] retro-border-sm text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-[11px] uppercase tracking-wider retro-shadow-sm cursor-pointer shrink-0"
            >
              CHANGE ↔
            </motion.button>
          </div>

          <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between font-sans text-[11px] text-[#58413f] dark:text-[#c8bead]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#249B65] border border-[#171717] animate-pulse"></span>
              {filteredDocs.length} FILES • 482 MB OFFLINE
            </span>
            <span className="font-bold text-[#1d1c11] dark:text-[#f6f1de]">64.2 GB free</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Sort & View Mode Toggles */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggleSort}
          className="h-9 px-3 rounded-xl bg-white dark:bg-[#212019] retro-border-sm text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">swap_vert</span>
          <span>{sortBy === 'date' ? 'DATE MODIFIED' : sortBy === 'name' ? 'NAME' : 'FILE SIZE'} {sortOrder === 'asc' ? '↑' : '↓'}</span>
        </motion.button>

        <div className="flex items-center bg-[#f3eedc] dark:bg-[#333128] rounded-xl p-1 retro-border-sm retro-shadow-sm">
          <button
            onClick={() => setViewMode('list')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm retro-shadow-sm'
                : 'text-[#58413f] dark:text-[#c8bead]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm retro-shadow-sm'
                : 'text-[#58413f] dark:text-[#c8bead]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
          </button>
        </div>
      </div>

      {/* Document Library Items */}
      {filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow">
          <span className="material-symbols-outlined text-[48px] text-[#58413f] dark:text-[#c8bead] mb-2">folder_open</span>
          <h3 className="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de] mb-1">
            No Documents Found
          </h3>
          <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] mb-4">
            Import local files to your offline vault to start reading.
          </p>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onImportFile}
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="h-10 px-4 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow cursor-pointer transition-colors"
          >
            + IMPORT FILE
          </motion.button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex flex-col space-y-3">
          {filteredDocs.map((doc) => {
            const badge = getTypeBadgeConfig(doc.type, doc.extension);
            const isMenuOpen = selectedDocForMenu === doc.id;

            return (
              <motion.div
                key={doc.id}
                whileTap={{ scale: 0.99 }}
                onClick={() => onOpenDocument(doc)}
                className="relative p-3.5 rounded-2xl bg-[#f9f4e1] dark:bg-[#2b2921] retro-border retro-shadow flex items-center justify-between gap-3 hover:bg-[#f3eedc] dark:hover:bg-[#333128] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div
                      className={`w-10 h-10 rounded-xl ${badge.bgColor} retro-border-sm flex items-center justify-center text-white shrink-0 retro-shadow-sm`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{badge.icon}</span>
                    </div>
                    {doc.isLocked && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#171717] text-white flex items-center justify-center text-[10px]">
                        <span className="material-symbols-outlined text-[12px]">lock</span>
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="block font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] truncate">
                      {doc.name}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      {doc.isLocked && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-900/40 font-heading font-bold text-[9px] uppercase">
                          LOCKED
                        </span>
                      )}
                      <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate">
                        {formatFileSize(doc.size)} • Modified {formatDateLabel(doc.modifiedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={(e) => onToggleFavorite(doc.id, e)}
                    aria-label="Favorite toggle"
                    className={`w-9 h-9 rounded-xl bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center ${
                      doc.isFavorite ? 'text-[#D88B32]' : 'text-[#58413f] dark:text-[#c8bead]'
                    } retro-shadow-sm cursor-pointer`}
                  >
                    <span
                      className="material-symbols-outlined text-[18px]"
                      style={{ fontVariationSettings: doc.isFavorite ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      star
                    </span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setSelectedDocForMenu(isMenuOpen ? null : doc.id)}
                    aria-label="More options"
                    className="w-9 h-9 rounded-xl bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center text-[#58413f] dark:text-[#c8bead] retro-shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">more_vert</span>
                  </motion.button>
                </div>

                {/* Dropdown Action Menu */}
                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -5 }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-3 top-14 z-30 w-44 bg-white dark:bg-[#212019] rounded-xl retro-border retro-shadow p-1 flex flex-col gap-0.5"
                    >
                      <button
                        onClick={() => {
                          setSelectedDocForMenu(null);
                          onOpenDocument(doc);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-heading font-bold text-[#1d1c11] dark:text-[#f6f1de] hover:bg-[#f3eedc] dark:hover:bg-[#333128] rounded-lg text-left cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        <span>Read Document</span>
                      </button>

                      <button
                        onClick={(e) => {
                          setSelectedDocForMenu(null);
                          onToggleFavorite(doc.id, e);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-heading font-bold text-[#1d1c11] dark:text-[#f6f1de] hover:bg-[#f3eedc] dark:hover:bg-[#333128] rounded-lg text-left cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">star</span>
                        <span>{doc.isFavorite ? 'Remove Saved' : 'Save to Vault'}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          setSelectedDocForMenu(null);
                          onDeleteDocument(doc.id, e);
                        }}
                        style={{ color: 'var(--primary-red)' }}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-heading font-bold hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-left cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        <span>Delete Reference</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-2 gap-3">
          {filteredDocs.map((doc) => {
            const badge = getTypeBadgeConfig(doc.type, doc.extension);
            return (
              <motion.div
                key={doc.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => onOpenDocument(doc)}
                className="p-3.5 rounded-2xl bg-[#f9f4e1] dark:bg-[#2b2921] retro-border retro-shadow flex flex-col justify-between h-36 hover:bg-[#f3eedc] dark:hover:bg-[#333128] transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`w-9 h-9 rounded-xl ${badge.bgColor} retro-border-sm flex items-center justify-center text-white shrink-0 retro-shadow-sm`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{badge.icon}</span>
                  </div>

                  <button
                    onClick={(e) => onToggleFavorite(doc.id, e)}
                    className="w-7 h-7 rounded-lg bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center text-[#58413f] dark:text-[#c8bead] cursor-pointer"
                  >
                    <span
                      className="material-symbols-outlined text-[14px]"
                      style={{ fontVariationSettings: doc.isFavorite ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      star
                    </span>
                  </button>
                </div>

                <div>
                  <span className="block font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] line-clamp-2 leading-tight">
                    {doc.name}
                  </span>
                  <span className="font-sans text-[10px] text-[#58413f] dark:text-[#c8bead] mt-1 block">
                    {formatFileSize(doc.size)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Primary Action Button: Import File to Vault */}
      <div className="pt-2">
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.01 }}
          onClick={onImportFile}
          style={{ backgroundColor: 'var(--primary-red)' }}
          className="w-full inline-flex items-center justify-center gap-2 h-14 rounded-2xl text-white font-heading font-bold text-sm uppercase tracking-wider retro-border retro-shadow cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">add_circle</span>
          <span>+ IMPORT FILE TO VAULT</span>
        </motion.button>
        <p className="text-center font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] mt-2 flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-[14px]">graphic_eq</span>
          Offline First: Files stay encrypted locally on device
        </p>
      </div>
    </motion.div>
  );
};
